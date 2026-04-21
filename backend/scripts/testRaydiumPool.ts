/**
 * Step-by-step Raydium CPMM pool creation diagnostic.
 * Usage: npx ts-node scripts/testRaydiumPool.ts <MINT_ADDRESS>
 */

import dotenv from "dotenv";
dotenv.config();

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Raydium, TxVersion, DEVNET_PROGRAM_ID } = require("@raydium-io/raydium-sdk-v2");

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import { config } from "../src/config";

const WSOL_MINT   = "So11111111111111111111111111111111111111112";
const TREASURY_PK = "13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW";

function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY;
  if (!raw) throw new Error("TREASURY_PRIVATE_KEY not set in .env");
  let cleaned = raw.trim().replace(/^"|"$/g, "");
  if (!cleaned.startsWith("[")) cleaned = `[${cleaned}]`;
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(cleaned)));
}

async function main() {
  const mint = process.argv[2];
  if (!mint) {
    console.error("Usage: npx ts-node scripts/testRaydiumPool.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  const mintPk    = new PublicKey(mint);
  const treasury  = new PublicKey(TREASURY_PK);
  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  const isDevnet  = config.solana.rpcUrl.includes("devnet");
  const cluster   = isDevnet ? "devnet" : "mainnet";

  console.log("=".repeat(60));
  console.log(`Cluster : ${cluster}`);
  console.log(`RPC     : ${config.solana.rpcUrl}`);
  console.log(`Mint    : ${mint}`);
  console.log("=".repeat(60));

  // ── Step 1: Treasury balances ─────────────────────────────────────────────
  console.log("\n[1] Treasury balances");
  const solBalance = await connection.getBalance(treasury);
  console.log(`    SOL  : ${solBalance / LAMPORTS_PER_SOL} SOL (${solBalance} lamports)`);

  const ata = await getAssociatedTokenAddress(mintPk, treasury);
  let tokenBalance = 0n;
  try {
    const acct = await getAccount(connection, ata);
    tokenBalance = acct.amount;
    console.log(`    Token ATA : ${ata.toBase58()}`);
    console.log(`    Tokens    : ${Number(tokenBalance) / 1e6} (${tokenBalance} raw)`);
  } catch {
    console.warn(`    Token ATA not found: ${ata.toBase58()}`);
    console.warn("    ⚠  Treasury has no tokens — graduate instruction may not have run");
  }

  if (solBalance < 0.1 * LAMPORTS_PER_SOL) {
    console.error("\n❌ Treasury SOL too low to create pool (need > 0.1 SOL for fees)");
    process.exit(1);
  }
  if (tokenBalance === 0n) {
    console.error("\n❌ Treasury has 0 tokens — cannot seed pool");
    process.exit(1);
  }

  // ── Step 2: Load Raydium SDK ───────────────────────────────────────────────
  console.log("\n[2] Loading Raydium SDK");
  const kp = getTreasuryKeypair();
  console.log(`    Keypair pubkey : ${kp.publicKey.toBase58()}`);

  const raydium = await Raydium.load({
    connection,
    owner: kp,
    cluster,
    disableFeatureCheck: true,
    blockhashCommitment: "finalized",
  });
  console.log("    SDK loaded ✓");

  // ── Step 3: DEVNET_PROGRAM_ID values ──────────────────────────────────────
  console.log("\n[3] CPMM Program IDs");
  const cpmmProgram = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM;
  const cpmmFeeAcc  = DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_FEE_ACC;
  console.log(`    CPMM program : ${cpmmProgram?.toBase58?.() ?? cpmmProgram}`);
  console.log(`    Fee account  : ${cpmmFeeAcc?.toBase58?.() ?? cpmmFeeAcc}`);

  // ── Step 4: AMM configs ────────────────────────────────────────────────────
  console.log("\n[4] Fetching AMM fee configs");
  let feeConfig: any;
  try {
    const ammConfigs = await raydium.api.getCpmmConfigs();
    if (!ammConfigs?.length) throw new Error("Empty config list");
    feeConfig = ammConfigs[0];
    console.log(`    Configs returned : ${ammConfigs.length}`);
    console.log(`    Using index=${feeConfig.index}  tradeFee=${feeConfig.tradeFeeRate}  createFee=${Number(feeConfig.createPoolFee)/1e9} SOL`);
  } catch (e: any) {
    console.error("    ❌ getCpmmConfigs failed:", e?.message ?? e);
    process.exit(1);
  }

  // ── Step 5: Determine amounts ──────────────────────────────────────────────
  const liquiditySol    = BigInt(Math.floor(solBalance * 0.85)); // use 85% of available SOL
  const liquidityTokens = tokenBalance;

  console.log("\n[5] Pool amounts");
  console.log(`    SOL    : ${Number(liquiditySol) / 1e9} SOL`);
  console.log(`    Tokens : ${Number(liquidityTokens) / 1e6}`);

  // ── Step 6: Build pool creation tx ────────────────────────────────────────
  console.log("\n[6] Building createPool transaction");
  const wsolPk    = new PublicKey(WSOL_MINT);
  const tokenPk   = new PublicKey(mint);
  const wsolFirst = Buffer.compare(wsolPk.toBuffer(), tokenPk.toBuffer()) < 0;

  const mintA = {
    address  : wsolFirst ? WSOL_MINT : mint,
    decimals : wsolFirst ? 9 : 6,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  };
  const mintB = {
    address  : wsolFirst ? mint : WSOL_MINT,
    decimals : wsolFirst ? 6 : 9,
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  };
  const mintAAmount = new BN(wsolFirst ? liquiditySol.toString() : liquidityTokens.toString());
  const mintBAmount = new BN(wsolFirst ? liquidityTokens.toString() : liquiditySol.toString());

  console.log(`    mintA : ${mintA.address.slice(0,8)}… amount=${mintAAmount.toString()}`);
  console.log(`    mintB : ${mintB.address.slice(0,8)}… amount=${mintBAmount.toString()}`);

  let execute: any, extInfo: any;
  try {
    ({ execute, extInfo } = await raydium.cpmm.createPool({
      programId      : cpmmProgram,
      poolFeeAccount : cpmmFeeAcc,
      mintA,
      mintB,
      mintAAmount,
      mintBAmount,
      startTime      : new BN(0),
      feeConfig,
      associatedOnly : false,
      ownerInfo      : { useSOLBalance: true },
      txVersion      : TxVersion.LEGACY,
    }));
    console.log("    Transaction built ✓");
    console.log(`    Pool ID (pre-send) : ${extInfo.address.poolId.toBase58()}`);
  } catch (e: any) {
    console.error("    ❌ createPool build failed:", e?.message ?? e);
    process.exit(1);
  }

  // ── Step 7: Send ───────────────────────────────────────────────────────────
  console.log("\n[7] Sending transaction…");
  try {
    const result = await execute({ sendAndConfirm: true });
    console.log(`    ✅ Pool created!`);
    console.log(`    Tx      : ${JSON.stringify(result)}`);
    console.log(`    Pool ID : ${extInfo.address.poolId.toBase58()}`);
    console.log(`    LP Mint : ${extInfo.address.lpMint.toBase58()}`);
  } catch (e: any) {
    console.error("    ❌ Send failed:", e?.message ?? e);
    if (e?.logs?.length) {
      console.error("    Logs:\n" + e.logs.join("\n"));
    }
    if (typeof e?.getLogs === "function") {
      try { console.error("    Logs:\n" + (await e.getLogs())?.join("\n")); } catch {}
    }
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
