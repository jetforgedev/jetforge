/**
 * retryGraduation.js  — plain JS, no ts-node needed
 *
 * Recovers a graduated token whose on-chain graduate instruction never ran
 * (DB shows isGraduated=true but real_sol_reserves > 0 on-chain).
 *
 * Usage (from /var/www/jetforge/backend):
 *   node scripts/retryGraduation.js <MINT_ADDRESS>
 */

require("dotenv").config();

const path = require("path");
const { Connection, PublicKey } = require("@solana/web3.js");

// Use compiled dist output — built by deploy.sh before pm2 restart
const { callGraduateInstruction } = require(path.join(__dirname, "../dist/services/graduateKeeper"));
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID || "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk"
);
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

function getBondingCurvePDA(mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding_curve"), mint.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

async function main() {
  const mintStr = process.argv[2];
  if (!mintStr) {
    console.error("Usage: node scripts/retryGraduation.js <MINT_ADDRESS>");
    process.exit(1);
  }

  console.log(`\n=== Retry graduation for ${mintStr.slice(0, 8)}… ===\n`);

  const connection = new Connection(RPC_URL, "confirmed");
  const mint = new PublicKey(mintStr);
  const bondingCurvePDA = getBondingCurvePDA(mint);

  // ── Read on-chain bonding curve state ──────────────────────────────────────
  const bcInfo = await connection.getAccountInfo(bondingCurvePDA);
  if (!bcInfo) {
    console.error("Bonding curve account not found on-chain. Wrong mint?");
    process.exit(1);
  }

  // BondingCurveState offsets: 8 disc | 32 mint | 32 creator | 8 vSol | 8 vTok | 8 realSol | 8 realTok | 8 supply | 1 complete
  const realSolReserves   = bcInfo.data.readBigUInt64LE(88);
  const realTokenReserves = bcInfo.data.readBigUInt64LE(96);
  const complete          = bcInfo.data[112] === 1;

  console.log("On-chain bonding curve:");
  console.log(`  complete          = ${complete}`);
  console.log(`  real_sol_reserves = ${realSolReserves} (${Number(realSolReserves) / 1e9} SOL)`);
  console.log(`  real_tok_reserves = ${realTokenReserves} (${Number(realTokenReserves) / 1e6} tokens)`);

  if (!complete) {
    console.error("\nBonding curve is NOT complete — cannot graduate yet.");
    await prisma.$disconnect();
    process.exit(1);
  }

  if (realSolReserves === 0n) {
    console.log("\nGraduate instruction already ran on-chain (realSol=0).");
    const token = await prisma.token.findUnique({
      where: { mint: mintStr },
      select: { raydiumPoolId: true },
    });
    if (token?.raydiumPoolId) {
      console.log(`Pool already stored: ${token.raydiumPoolId}`);
    } else {
      console.log("Pool not yet stored — check PM2 logs for [RAYDIUM] entries.");
    }
    await prisma.$disconnect();
    return;
  }

  // ── Run graduate instruction ────────────────────────────────────────────────
  console.log("\nRunning graduate instruction...");
  await callGraduateInstruction(mintStr);
  console.log("Graduate instruction call returned.");

  // ── Wait for indexer to pick up GraduationEvent and create pool ────────────
  console.log("\nWaiting 15s for indexer to detect GraduationEvent and create Raydium pool...");
  await new Promise(r => setTimeout(r, 15_000));

  const updated = await prisma.token.findUnique({
    where: { mint: mintStr },
    select: { raydiumPoolId: true },
  });

  if (updated?.raydiumPoolId) {
    console.log(`\n✅ Success! Pool ID: ${updated.raydiumPoolId}`);
    console.log(`   Trade link: https://devnet.raydium.io/swap/?inputMint=sol&outputMint=${mintStr}`);
  } else {
    console.log("\n⚠️  Pool not yet stored. The Raydium pool creation may still be in progress.");
    console.log("Run: pm2 logs jetforge-backend --lines 80");
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal:", e.message || e);
  process.exit(1);
});
