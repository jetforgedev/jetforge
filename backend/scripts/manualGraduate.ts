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
import { config } from "../src/config";

const prisma = new PrismaClient();

async function main() {
  const mint = process.argv[2];
  if (!mint) {
    console.error("Usage: ts-node scripts/manualGraduate.ts <MINT_ADDRESS>");
    process.exit(1);
  }

  const token = await prisma.token.findUnique({
    where: { mint },
    select: { name: true, isGraduated: true, raydiumPoolId: true, realSolReserves: true, realTokenReserves: true },
  });

  if (!token) {
    console.error("Token not found in DB:", mint);
    process.exit(1);
  }

  console.log(`Token: ${token.name} | graduated=${token.isGraduated} | poolId=${token.raydiumPoolId}`);

  if (token.raydiumPoolId) {
    console.log("Pool already exists:", token.raydiumPoolId);
    process.exit(0);
  }

  // Step 1: Call on-chain graduate instruction (distributes SOL + tokens to treasury)
  console.log("\n=== Step 1: Calling on-chain graduate instruction ===");
  await callGraduateInstruction(mint);

  // Wait for confirmation to propagate
  await new Promise((r) => setTimeout(r, 4000));

  // Step 2: Check how much SOL/tokens treasury received from the graduation event.
  // Use the values stored in DB (real_sol_reserves = 90% liquidity SOL from event).
  // If the graduate event already fired in the indexer, those values are set.
  // Otherwise estimate from what's on-chain.
  const connection = new Connection(config.solana.rpcUrl, "confirmed");

  // Re-fetch token to see if GraduationEvent updated the values
  const updated = await prisma.token.findUnique({
    where: { mint },
    select: { raydiumPoolId: true, realSolReserves: true, realTokenReserves: true },
  });

  if (updated?.raydiumPoolId) {
    console.log("Pool was created automatically by the indexer:", updated.raydiumPoolId);
    process.exit(0);
  }

  // Estimate liquidity amounts: 90% of realSolReserves and all realTokenReserves
  const realSol = BigInt(token.realSolReserves?.toString() ?? "0");
  const realTokens = BigInt(token.realTokenReserves?.toString() ?? "0");
  const liquiditySol = (realSol * 90n) / 100n;
  const liquidityTokens = realTokens;

  console.log(`\n=== Step 2: Creating Raydium CPMM pool ===`);
  console.log(`  SOL: ${Number(liquiditySol) / 1e9}`);
  console.log(`  Tokens: ${Number(liquidityTokens) / 1e6}`);

  if (liquiditySol === 0n || liquidityTokens === 0n) {
    console.error("Zero amounts — cannot create pool. Check that graduate instruction ran correctly.");
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
