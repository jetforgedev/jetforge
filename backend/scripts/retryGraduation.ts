/**
 * retryGraduation.ts
 *
 * One-off script to finish graduation for a token that has:
 *   - bonding_curve.complete = true (on-chain)
 *   - real_sol_reserves > 0        (on-chain — graduate.rs never ran)
 *   - isGraduated = true in DB     (set prematurely by BuyEvent handler)
 *   - raydiumPoolId = null          (Raydium pool never created)
 *
 * Usage (from backend/):
 *   npx ts-node scripts/retryGraduation.ts <MINT_ADDRESS>
 *
 * Example:
 *   npx ts-node scripts/retryGraduation.ts GXEbVxQEcYGyK3tkt93TsQTZLXA4WsxPqHktayD4ZFve
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

import { Connection, PublicKey } from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";
import { callGraduateInstruction } from "../src/services/graduateKeeper";
import { createRaydiumPool } from "../src/services/raydiumService";
import { config } from "../src/config";

const prisma = new PrismaClient();
const PROGRAM_ID = new PublicKey(config.solana.programId);

function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  const mintStr = process.argv[2];
  if (!mintStr) {
    console.error("Usage: npx ts-node scripts/retryGraduation.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log(`\n=== Retry graduation for ${mintStr.slice(0, 8)}… ===\n`);

  const connection = new Connection(config.solana.rpcUrl, "confirmed");
  const mint = new PublicKey(mintStr);
  const bondingCurvePDA = getBondingCurvePDA(mint);

  // ── 1. Read on-chain state ────────────────────────────────────────────────
  const bcInfo = await connection.getAccountInfo(bondingCurvePDA);
  if (!bcInfo) {
    console.error("Bonding curve account not found on-chain. Wrong mint?");
    process.exit(1);
  }

  if (bcInfo.data.length < 113) {
    console.error("Bonding curve data too short — wrong account?");
    process.exit(1);
  }

  // BondingCurveState layout offsets:
  // 8  disc | 32 mint | 32 creator | 8 vSol | 8 vTok | 8 realSol | 8 realTok | 8 supply | 1 complete
  const realSolReserves  = bcInfo.data.readBigUInt64LE(88);
  const realTokenReserves = bcInfo.data.readBigUInt64LE(96);
  const complete          = bcInfo.data[112] === 1;

  console.log(`On-chain bonding curve:`);
  console.log(`  complete          = ${complete}`);
  console.log(`  real_sol_reserves = ${realSolReserves} (${Number(realSolReserves) / 1e9} SOL)`);
  console.log(`  real_tok_reserves = ${realTokenReserves} (${Number(realTokenReserves) / 1e6} tokens)`);

  if (!complete) {
    console.error("Bonding curve is NOT complete — cannot graduate yet.");
    process.exit(1);
  }

  if (realSolReserves === 0n) {
    console.log("\nGraduate instruction already ran on-chain (realSol=0).");
    console.log("Checking if Raydium pool is missing...");

    const token = await prisma.token.findUnique({
      where: { mint: mintStr },
      select: { raydiumPoolId: true },
    });

    if (token?.raydiumPoolId) {
      console.log(`Pool already stored: ${token.raydiumPoolId}`);
      console.log("Nothing to do.");
      await prisma.$disconnect();
      return;
    }

    // Graduate instruction ran but pool wasn't created — skip to pool creation
    console.log("Graduate instruction ran but pool was not created. Creating pool now...");
    // We can't recover liquiditySol/liquidityTokens from chain at this point
    // (SOL already distributed). Nothing to do for pool without the amounts.
    console.error("Cannot create pool: SOL already distributed, original amounts unknown.");
    console.error("A new graduation test is needed to verify the full fix.");
    await prisma.$disconnect();
    return;
  }

  // ── 2. Run graduate instruction ──────────────────────────────────────────
  console.log("\nRunning graduate instruction...");
  // callGraduateInstruction now checks on-chain state, not DB flag
  // so this will proceed even though DB shows isGraduated=true
  await callGraduateInstruction(mintStr);
  console.log("Graduate instruction done.");

  // ── 3. Wait for GraduationEvent to be picked up by indexer ──────────────
  // The GraduationEvent emitted by graduate.rs carries the liquiditySol and
  // liquidityTokens values. The indexer will detect it and call createRaydiumPool.
  // Wait a few seconds to let the event propagate.
  console.log("\nWaiting 10s for indexer to pick up GraduationEvent...");
  await new Promise(r => setTimeout(r, 10_000));

  // ── 4. Check if pool was created by the indexer ──────────────────────────
  const updated = await prisma.token.findUnique({
    where: { mint: mintStr },
    select: { raydiumPoolId: true },
  });

  if (updated?.raydiumPoolId) {
    console.log(`\n✅ Pool created and stored: ${updated.raydiumPoolId}`);
  } else {
    console.log("\n⚠️  Pool not yet stored — indexer may still be processing.");
    console.log("Check PM2 logs: pm2 logs jetforge-backend --lines 100");
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
