/**
 * Raydium CPMM pool creation service.
 *
 * Called by the indexer when a GraduationEvent is detected.
 * Requires TREASURY_PRIVATE_KEY in backend .env (JSON array format from Solana CLI).
 *
 * Flow:
 *  1. Treasury wallet already holds SOL (95% of graduation amount) + tokens (from graduate.rs)
 *  2. This service wraps the 90% liquidity SOL + tokens into a Raydium CPMM pool
 *  3. LP tokens are sent to the incinerator (burn address) — permanently locked
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Raydium, TxVersion, DEVNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from "@solana/spl-token";
import BN from "bn.js";
import { config } from "../config";

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM_STR = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");

function getTreasuryKeypair(): Keypair | null {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) return null;
  try {
    let cleaned = raw.trim().replace(/^"|"$/g, "");
    if (!cleaned.startsWith("[")) cleaned = `[${cleaned}]`;
    const secretKey = Uint8Array.from(JSON.parse(cleaned));
    return Keypair.fromSecretKey(secretKey);
  } catch {
    console.error("[RAYDIUM] Failed to parse TREASURY_PRIVATE_KEY");
    return null;
  }
}

/**
 * Create a Raydium CPMM pool for a graduated token.
 *
 * @param mint          Token mint address
 * @param solLamports   SOL to use as liquidity (90% of graduation SOL, in lamports)
 * @param tokenAmount   Tokens to use as liquidity (unsold tokens from bonding curve)
 * @returns             Pool ID string, or null if creation failed
 */
export async function createRaydiumPool(
  mint: string,
  solLamports: bigint,
  tokenAmount: bigint
): Promise<string | null> {
  const treasuryKeypair = getTreasuryKeypair();
  if (!treasuryKeypair) {
    console.warn("[RAYDIUM] TREASURY_PRIVATE_KEY not configured — skipping pool creation");
    return null;
  }

  if (solLamports <= 0n || tokenAmount <= 0n) {
    console.warn("[RAYDIUM] Zero amounts — skipping pool creation");
    return null;
  }

  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  const isDevnet = config.solana.rpcUrl.includes("devnet");
  const cluster = isDevnet ? "devnet" : "mainnet";

  console.log(`[RAYDIUM] Creating CPMM pool for ${mint.slice(0, 8)}… on ${cluster}`);
  console.log(`[RAYDIUM]   SOL: ${Number(solLamports) / 1e9} | Tokens: ${Number(tokenAmount) / 1e6}`);

  try {
    const raydium = await Raydium.load({
      connection,
      owner: treasuryKeypair,
      cluster,
      disableFeatureCheck: true,
      blockhashCommitment: "finalized",
    });

    // Fetch AMM fee configs for CPMM — use the first (lowest fee, 0.25%) config
    const ammConfigs = await raydium.api.getCpmmConfigs();
    if (!ammConfigs?.length) {
      throw new Error("No AMM configs returned from Raydium on " + cluster);
    }
    const feeConfig = ammConfigs[0];
    console.log(`[RAYDIUM] Using fee config: index=${feeConfig.index} tradeFee=${feeConfig.tradeFeeRate} createFee=${Number(feeConfig.createPoolFee)/1e9}SOL`);

    // Raydium CPMM requires mint0 < mint1 (lexicographic pubkey order)
    const wsolPubkey = new PublicKey(WSOL_MINT);
    const tokenPubkey = new PublicKey(mint);
    const wsolFirst = Buffer.compare(wsolPubkey.toBuffer(), tokenPubkey.toBuffer()) < 0;

    const mintA = {
      address: wsolFirst ? WSOL_MINT : mint,
      decimals: wsolFirst ? 9 : 6,
      programId: TOKEN_PROGRAM_STR,
    };
    const mintB = {
      address: wsolFirst ? mint : WSOL_MINT,
      decimals: wsolFirst ? 6 : 9,
      programId: TOKEN_PROGRAM_STR,
    };
    const mintAAmount = new BN(wsolFirst ? solLamports.toString() : tokenAmount.toString());
    const mintBAmount = new BN(wsolFirst ? tokenAmount.toString() : solLamports.toString());

    console.log(`[RAYDIUM] DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM = ${DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM?.toBase58?.() ?? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM}`);
    console.log(`[RAYDIUM] DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC = ${DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC?.toBase58?.() ?? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC}`);

    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
      mintA,
      mintB,
      mintAAmount,
      mintBAmount,
      startTime: new BN(0),
      feeConfig,
      associatedOnly: false,
      ownerInfo: { useSOLBalance: true },
      txVersion: TxVersion.LEGACY,
    });

    const txResult = await execute({ sendAndConfirm: true });
    console.log(`[RAYDIUM] Pool created! Tx: ${txResult}`);

    const poolId: string = extInfo.address.poolId.toBase58();
    const lpMint: PublicKey = extInfo.address.lpMint;
    console.log(`[RAYDIUM] Pool ID: ${poolId}`);
    console.log(`[RAYDIUM] LP Mint: ${lpMint.toBase58()}`);

    // Burn LP tokens — send treasury's LP tokens to incinerator
    await burnLpTokens(connection, treasuryKeypair, lpMint);

    return poolId;
  } catch (error: any) {
    console.error("[RAYDIUM] Pool creation failed:", error?.message ?? error);
    // Try to get program logs for SendTransactionError
    if (typeof error?.getLogs === "function") {
      try {
        const logs = await error.getLogs();
        console.error("[RAYDIUM] Transaction logs:\n" + (logs ?? []).join("\n"));
      } catch (e2) {
        console.error("[RAYDIUM] getLogs() failed:", e2);
      }
    } else if (error?.logs?.length) {
      console.error("[RAYDIUM] Transaction logs:\n" + error.logs.join("\n"));
    }
    // Extract signature from error message and fetch tx logs
    const sigMatch = error?.message?.match(/Transaction ([A-Za-z0-9]+) resulted/);
    if (sigMatch) {
      try {
        const tx = await connection.getTransaction(sigMatch[1], {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        console.error("[RAYDIUM] On-chain logs:\n" + (tx?.meta?.logMessages ?? []).join("\n"));
      } catch {}
    }
    return null;
  }
}

/**
 * Transfer all LP tokens from treasury to the incinerator address.
 * This permanently locks liquidity (LP tokens can never be retrieved).
 */
async function burnLpTokens(
  connection: Connection,
  treasury: Keypair,
  lpMint: PublicKey
): Promise<void> {
  try {
    // Get treasury's LP token account
    const treasuryLpAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      lpMint,
      treasury.publicKey
    );

    if (treasuryLpAta.amount === 0n) {
      console.log("[RAYDIUM] No LP tokens to burn");
      return;
    }

    // Create/get incinerator's LP token account
    const incineratorLpAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,          // treasury pays for the incinerator ATA creation
      lpMint,
      INCINERATOR,
      false,
      "confirmed",
      undefined,
      TOKEN_PROGRAM_ID,
      // Allow creating ATA for non-system accounts
    );

    const burnTx = new Transaction().add(
      createTransferInstruction(
        treasuryLpAta.address,
        incineratorLpAta.address,
        treasury.publicKey,
        treasuryLpAta.amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const sig = await sendAndConfirmTransaction(connection, burnTx, [treasury]);
    console.log(`[RAYDIUM] LP tokens burned (sent to incinerator). Tx: ${sig}`);
    console.log(`[RAYDIUM] Burned ${Number(treasuryLpAta.amount)} LP tokens — liquidity permanently locked`);
  } catch (err: any) {
    // Non-fatal: pool is still created even if LP burn fails
    console.error("[RAYDIUM] LP burn failed (non-fatal):", err?.message ?? err);
  }
}
