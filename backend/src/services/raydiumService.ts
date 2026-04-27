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
const { Raydium, TxVersion, DEVNET_PROGRAM_ID, MAINNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");

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

    // Ensure treasury has a WSOL ATA — Raydium SDK requires it to exist before
    // building the createPool transaction (throws "you don't has some token account"
    // if the WSOL ATA is absent, even when useSOLBalance: true is set).
    const wsolMintPk = new PublicKey(WSOL_MINT);
    await getOrCreateAssociatedTokenAccount(
      connection,
      treasuryKeypair,           // payer
      wsolMintPk,
      treasuryKeypair.publicKey, // owner
    );
    console.log(`[RAYDIUM] WSOL ATA ensured for treasury`);

    // Fetch AMM fee configs for CPMM — use the first (lowest fee, 0.25%) config
    const ammConfigs = await raydium.api.getCpmmConfigs();
    if (!ammConfigs?.length) {
      throw new Error("No AMM configs returned from Raydium on " + cluster);
    }
    const feeConfig = ammConfigs[0];
    console.log(`[RAYDIUM] Using fee config: index=${feeConfig.index} tradeFee=${feeConfig.tradeFeeRate} createFee=${Number(feeConfig.createPoolFee)/1e9}SOL`);

    // Raydium CPMM requires mint0 < mint1 (lexicographic pubkey order)
    const tokenPubkey = new PublicKey(mint);
    const wsolFirst = Buffer.compare(wsolMintPk.toBuffer(), tokenPubkey.toBuffer()) < 0;

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

    // ── DEVNET-TEST: program IDs are cluster-selected at runtime ──────────────
    // isDevnet is derived from config.solana.rpcUrl (set in .env).
    // BEFORE MAINNET: ensure SOLANA_RPC_URL points to a mainnet endpoint so
    // isDevnet=false and MAINNET_PROGRAM_ID is used here automatically.
    // ─────────────────────────────────────────────────────────────────────────
    const CLUSTER_PROGRAM_ID = isDevnet ? DEVNET_PROGRAM_ID : MAINNET_PROGRAM_ID;
    console.log(`[RAYDIUM] Using ${isDevnet ? "DEVNET" : "MAINNET"} program IDs`);
    console.log(`[RAYDIUM] CPMM_POOL_PROGRAM = ${CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM?.toBase58?.() ?? CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM}`);
    console.log(`[RAYDIUM] CPMM_POOL_FEE_ACC = ${CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC?.toBase58?.() ?? CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC}`);

    const { execute, extInfo } = await raydium.cpmm.createPool({
      programId: CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: CLUSTER_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC,
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

    // Extract poolId and lpMint BEFORE execute() — they are deterministic and
    // available immediately from extInfo. This way, if execute() throws a
    // confirmation timeout (tx already landed), we can still verify and return
    // the poolId rather than losing it.
    const poolId: string = extInfo.address.poolId.toBase58();
    const lpMint: PublicKey = extInfo.address.lpMint;
    console.log(`[RAYDIUM] Expected Pool ID: ${poolId}`);
    console.log(`[RAYDIUM] Expected LP Mint: ${lpMint.toBase58()}`);

    try {
      const EXECUTE_TIMEOUT_MS = 120_000;
      const timeoutErr = new Error(`execute() timed out after ${EXECUTE_TIMEOUT_MS / 1000}s`);
      const { txId } = await Promise.race([
        execute({ sendAndConfirm: true }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(timeoutErr), EXECUTE_TIMEOUT_MS)
        ),
      ]);
      console.log(`[RAYDIUM] Pool created! Tx: ${Array.isArray(txId) ? txId[0] : txId}`);
    } catch (execErr: any) {
      // execute() can throw a confirmation timeout even when the tx already
      // landed on-chain (common on devnet). Verify the pool state account
      // exists before deciding to give up.
      console.warn(`[RAYDIUM] execute() threw — verifying pool on-chain: ${execErr?.message?.slice(0, 120)}`);
      const poolStateInfo = await connection.getAccountInfo(new PublicKey(poolId)).catch(() => null);
      if (!poolStateInfo) {
        // Pool did not land — propagate the error to outer catch
        throw execErr;
      }
      console.log(`[RAYDIUM] Pool confirmed on-chain despite execute() error — proceeding`);
    }

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

    // Create/get incinerator's LP token account.
    // allowOwnerOffCurve=true is required — the incinerator is not on the ed25519 curve.
    const incineratorLpAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,          // treasury pays for the incinerator ATA creation
      lpMint,
      INCINERATOR,
      true,              // allowOwnerOffCurve — incinerator has no private key
      "confirmed",
      undefined,
      TOKEN_PROGRAM_ID,
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
