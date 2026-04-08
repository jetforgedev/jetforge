/**
 * Manual graduation script — use when a token graduated before the auto-keeper was running.
 * Usage: ts-node scripts/manualGraduate.ts <MINT_ADDRESS>
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { callGraduateInstruction } from "../src/services/graduateKeeper";
import { createRaydiumPool } from "../src/services/raydiumService";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { config } from "../src/config";

const prisma = new PrismaClient();

// Treasury pubkey (must match TREASURY_PUBKEY in program)
const TREASURY = new PublicKey("13DWuEycYuJvGpo2EwPMgaiBDfRKmpoxdXjJ5GKe9RPW");

// BondingCurveState layout offsets (after 8-byte discriminator):
//  +0  mint       (32)
//  +32 creator    (32)
//  +64 vSol       (8)
//  +72 vToken     (8)
//  +80 rSol       (8)   ← real_sol_reserves
//  +88 rToken     (8)   ← real_token_reserves
//  +96 supply     (8)
//  +104 complete  (1)
const REAL_SOL_OFFSET = 8 + 32 + 32 + 8 + 8;       // = 88
const REAL_TOK_OFFSET = 8 + 32 + 32 + 8 + 8 + 8;   // = 96
const COMPLETE_OFFSET = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8; // = 112

async function main() {
  const mint = process.argv[2];
  if (!mint) {
    console.error("Usage: ts-node scripts/manualGraduate.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  const mintPubkey = new PublicKey(mint);

  // Read on-chain bonding curve state
  const [bondingCurvePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mintPubkey.toBuffer()],
    new PublicKey("7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk")
  );
  const bcInfo = await connection.getAccountInfo(bondingCurvePDA);
  if (!bcInfo) {
    console.error("Bonding curve account not found on-chain");
    process.exit(1);
  }

  const onChainRealSol = bcInfo.data.readBigUInt64LE(REAL_SOL_OFFSET);
  const onChainRealTok = bcInfo.data.readBigUInt64LE(REAL_TOK_OFFSET);
  const onChainComplete = bcInfo.data[COMPLETE_OFFSET] === 1;

  console.log(`On-chain bonding curve:`);
  console.log(`  complete=${onChainComplete}  realSol=${onChainRealSol}  realToken=${onChainRealTok}`);

  const token = await prisma.token.findUnique({
    where: { mint },
    select: { name: true, isGraduated: true, raydiumPoolId: true },
  });
  if (!token) { console.error("Token not found in DB"); process.exit(1); }
  console.log(`DB: name=${token.name} | graduated=${token.isGraduated} | poolId=${token.raydiumPoolId}`);

  if (token.raydiumPoolId) {
    console.log("Pool already exists:", token.raydiumPoolId);
    process.exit(0);
  }

  // ── Step 1: Graduate on-chain (only if not already drained) ─────────────────
  if (onChainComplete && onChainRealSol > 0n) {
    console.log("\n=== Step 1: Calling on-chain graduate instruction ===");
    await callGraduateInstruction(mint);
    await new Promise((r) => setTimeout(r, 4000));
  } else if (onChainComplete && onChainRealSol === 0n) {
    console.log("\n=== Step 1: Skipped — graduate already ran (realSol=0 on-chain) ===");
  } else {
    console.error("Token not graduated on-chain (complete=false)");
    process.exit(1);
  }

  // Check if indexer already created pool
  const updated = await prisma.token.findUnique({
    where: { mint },
    select: { raydiumPoolId: true },
  });
  if (updated?.raydiumPoolId) {
    console.log("Pool was created automatically by the indexer:", updated.raydiumPoolId);
    process.exit(0);
  }

  // ── Step 2: Determine liquidity amounts from treasury's ACTUAL balances ──────
  console.log("\n=== Step 2: Creating Raydium CPMM pool ===");

  // Read treasury's actual token balance
  const treasuryAta = await getAssociatedTokenAddress(mintPubkey, TREASURY);
  let treasuryTokenBalance = 0n;
  try {
    const ataInfo = await getAccount(connection, treasuryAta);
    treasuryTokenBalance = ataInfo.amount;
  } catch {
    console.warn("Treasury token ATA not found or empty");
  }

  // Treasury SOL balance (use a portion for liquidity — 90% of graduation amount)
  // Since we can't know the exact graduation amount anymore, use the on-chain event value.
  // As a safe fallback: use 90% of original realSol (from DB or estimation).
  // The treasury already received the SOL from graduate.rs, so we compute from what was sent.
  // 90% of realSol = liquidity_sol as emitted in GraduationEvent.
  // Since onChainRealSol is 0 now, we re-derive from the original:
  // We'll use a fixed amount: 90% of GRADUATION_THRESHOLD (0.5 SOL) ≈ 0.45 SOL minimum.
  // Better: read from DB realSolReserves before graduation.
  const dbToken = await prisma.token.findUnique({
    where: { mint },
    select: { realSolReserves: true, realTokenReserves: true },
  });

  // Use DB values if available, otherwise fallback to 90% of threshold
  let liquiditySol = 0n;
  if (dbToken?.realSolReserves && BigInt(dbToken.realSolReserves.toString()) > 0n) {
    const rawSol = BigInt(dbToken.realSolReserves.toString());
    liquiditySol = (rawSol * 90n) / 100n;
  } else {
    // fallback: 90% of graduation threshold
    liquiditySol = 450_000_000n; // 0.45 SOL
  }
  const liquidityTokens = treasuryTokenBalance;

  console.log(`  SOL (90% of graduation): ${Number(liquiditySol) / 1e9}`);
  console.log(`  Tokens (treasury balance): ${Number(liquidityTokens) / 1e6}`);

  if (liquiditySol === 0n || liquidityTokens === 0n) {
    console.error("❌ Zero amounts — cannot create pool.");
    console.error(`   liquiditySol=${liquiditySol}  treasuryTokens=${liquidityTokens}`);
    process.exit(1);
  }

  const poolId = await createRaydiumPool(mint, liquiditySol, liquidityTokens);

  if (poolId) {
    await prisma.token.update({
      where: { mint },
      data: { raydiumPoolId: poolId },
    });
    console.log(`\n✅ Pool created and saved: ${poolId}`);
    console.log(`   URL: https://devnet.raydium.io/liquidity/pool/${poolId}`);
  } else {
    console.error("\n❌ Pool creation failed — check logs above");
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
