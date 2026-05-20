/**
 * backfill.js — re-index ALL historical JetForge program transactions into Postgres.
 * Run with: node backfill.js
 * Uses the compiled dist modules and existing .env config.
 */
"use strict";
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const { Connection, PublicKey } = require("@solana/web3.js");
const { BorshCoder, EventParser } = require("@coral-xyz/anchor");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const PROGRAM_ID_STR = process.env.PROGRAM_ID || "7rXDkm484DDp2YoPkLBBLtGMzuwrxysFGUgPUc4EpDmk";
const PROGRAM_ID = new PublicKey(PROGRAM_ID_STR);
const connection = new Connection(RPC_URL, "confirmed");

// Constants — must match Rust program
const INITIAL_VIRTUAL_SOL   = 30_000_000_000n;   // 30 SOL in lamports
const INITIAL_VIRTUAL_TOKENS = 1_073_000_191_000_000n;
const REAL_TOKEN_RESERVES_INIT = 793_100_000_000_000n;
const TOTAL_SUPPLY = 1_000_000_000_000_000n;
const GRADUATION_THRESHOLD = 85_000_000_000n;     // 85 SOL in lamports

const IDL = {
  version: "0.1.0", name: "token_launch",
  instructions: [], accounts: [],
  events: [
    { name: "BuyEvent", fields: [
      { name: "mint",                 type: "publicKey" },
      { name: "buyer",                type: "publicKey" },
      { name: "solAmount",            type: "u64" },
      { name: "tokenAmount",          type: "u64" },
      { name: "virtualSolReserves",   type: "u64" },
      { name: "virtualTokenReserves", type: "u64" },
      { name: "realSolReserves",      type: "u64" },
      { name: "realTokenReserves",    type: "u64" },
      { name: "fee",                  type: "u64" },
      { name: "isGraduated",          type: "bool" },
      { name: "timestamp",            type: "i64" },
    ]},
    { name: "SellEvent", fields: [
      { name: "mint",                 type: "publicKey" },
      { name: "seller",               type: "publicKey" },
      { name: "tokenAmount",          type: "u64" },
      { name: "solAmount",            type: "u64" },
      { name: "virtualSolReserves",   type: "u64" },
      { name: "virtualTokenReserves", type: "u64" },
      { name: "realSolReserves",      type: "u64" },
      { name: "realTokenReserves",    type: "u64" },
      { name: "fee",                  type: "u64" },
      { name: "timestamp",            type: "i64" },
    ]},
    { name: "TokenCreatedEvent", fields: [
      { name: "mint",                 type: "publicKey" },
      { name: "creator",              type: "publicKey" },
      { name: "name",                 type: "string" },
      { name: "symbol",               type: "string" },
      { name: "uri",                  type: "string" },
      { name: "virtualSolReserves",   type: "u64" },
      { name: "virtualTokenReserves", type: "u64" },
      { name: "realTokenReserves",    type: "u64" },
      { name: "timestamp",            type: "i64" },
    ]},
    { name: "GraduationEvent", fields: [
      { name: "mint",              type: "publicKey" },
      { name: "creator",           type: "publicKey" },
      { name: "realSolReserves",   type: "u64" },
      { name: "realTokenReserves", type: "u64" },
      { name: "tokensBurned",      type: "u64" },
      { name: "totalVolumeSol",    type: "u64" },
      { name: "totalTrades",       type: "u64" },
      { name: "timestamp",         type: "i64" },
    ]},
  ],
  errors: [],
};

let eventParser;
try {
  const coder = new BorshCoder(IDL);
  eventParser = new EventParser(PROGRAM_ID, coder);
} catch(e) {
  console.error("Failed to build EventParser:", e);
  process.exit(1);
}

let tokensCreated = 0, tradesIndexed = 0, skipped = 0, errors = 0;

async function processTransaction(sig) {
  try {
    const tx = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx || tx.meta?.err) { skipped++; return; }

    const logs = tx.meta?.logMessages ?? [];
    const events = [...eventParser.parseLogs(logs)];

    for (const event of events) {
      if (event.name === "TokenCreatedEvent") {
        const d = event.data;
        const mint    = d.mint.toString();
        const creator = d.creator.toString();
        const name    = d.name;
        const symbol  = d.symbol;
        const realTokenReserves = d.realTokenReserves
          ? BigInt(d.realTokenReserves.toString())
          : REAL_TOKEN_RESERVES_INIT;

        await prisma.token.upsert({
          where: { mint },
          create: {
            mint, name, symbol, creator,
            virtualSolReserves:  INITIAL_VIRTUAL_SOL,
            virtualTokenReserves: INITIAL_VIRTUAL_TOKENS,
            realSolReserves: 0n,
            realTokenReserves,
            totalSupply: TOTAL_SUPPLY,
          },
          update: {},  // don't overwrite if already synced with live curve state
        });
        tokensCreated++;
        console.log(`  [CREATE] ${symbol} (${mint.slice(0,8)}…) by ${creator.slice(0,8)}…`);

      } else if (event.name === "BuyEvent" || event.name === "SellEvent") {
        const d = event.data;
        const mint  = d.mint.toString();
        const trader = event.name === "BuyEvent" ? d.buyer.toString() : d.seller.toString();
        const type  = event.name === "BuyEvent" ? "BUY" : "SELL";
        const solAmount   = BigInt(d.solAmount.toString());
        const tokenAmount = BigInt(d.tokenAmount.toString());
        const virtualSol  = BigInt(d.virtualSolReserves.toString());
        const virtualTok  = BigInt(d.virtualTokenReserves.toString());
        const realSol     = BigInt(d.realSolReserves.toString());
        const fee         = BigInt(d.fee.toString());
        const timestamp   = Number(d.timestamp.toString());
        const price = Number(virtualSol) / Number(virtualTok);
        const marketCapSol = (Number(virtualSol) * Number(TOTAL_SUPPLY)) / Number(virtualTok) / 1e9;

        // Skip duplicates
        const exists = await prisma.trade.findUnique({ where: { signature: sig }, select: { id: true } });
        if (exists) { skipped++; continue; }

        // Ensure token exists in DB (might not have been in our fetched window)
        const tokenExists = await prisma.token.findUnique({ where: { mint }, select: { mint: true } });
        if (!tokenExists) {
          console.log(`  [SKIP-TRADE] Token ${mint.slice(0,8)}… not in DB yet`);
          skipped++; continue;
        }

        await prisma.trade.create({
          data: { signature: sig, mint, trader, type, solAmount, tokenAmount, price, fee, timestamp: new Date(timestamp * 1000) }
        });

        // Update holder balance
        const delta = type === "BUY" ? tokenAmount : -tokenAmount;
        await prisma.$executeRaw`
          INSERT INTO "Holder" (mint, wallet, balance, "updatedAt")
          VALUES (${mint}, ${trader}, ${delta}, NOW())
          ON CONFLICT (mint, wallet) DO UPDATE SET balance = GREATEST(0, "Holder".balance + ${delta}), "updatedAt" = NOW()
        `;

        // Update token curve state + market cap
        await prisma.token.update({
          where: { mint },
          data: { virtualSolReserves: virtualSol, virtualTokenReserves: virtualTok, realSolReserves: realSol, marketCapSol }
        });

        tradesIndexed++;
      } else if (event.name === "GraduationEvent") {
        const d = event.data;
        await prisma.token.update({
          where: { mint: d.mint.toString() },
          data: { isGraduated: true, graduatedAt: new Date() }
        }).catch(() => {});
      }
    }
  } catch(err) {
    if (!err?.message?.includes("not found")) {
      errors++;
      console.error(`  [ERR] ${sig.slice(0,8)}…:`, err?.message?.slice(0,80));
    }
  }
}

async function main() {
  console.log("=== JetForge DB Backfill ===");
  console.log("Program:", PROGRAM_ID_STR);
  console.log("RPC:", RPC_URL);

  // Page through ALL historical signatures for the program
  let before = undefined;
  let totalFetched = 0;
  const PAGE = 50;

  while (true) {
    const opts = { limit: PAGE, commitment: "confirmed" };
    if (before) opts.before = before;

    let sigs;
    try {
      sigs = await connection.getSignaturesForAddress(PROGRAM_ID, opts);
    } catch(e) {
      console.error("Failed to fetch sigs:", e.message);
      break;
    }

    if (!sigs || sigs.length === 0) break;
    totalFetched += sigs.length;
    console.log(`\nFetched ${sigs.length} sigs (total: ${totalFetched}), oldest slot: ${sigs[sigs.length-1].slot}`);

    // Process oldest-first within this batch
    for (const s of [...sigs].reverse()) {
      if (!s.err) await processTransaction(s.signature);
    }

    before = sigs[sigs.length - 1].signature;
    if (sigs.length < PAGE) break; // last page
    await new Promise(r => setTimeout(r, 500)); // rate limit
  }

  console.log("\n=== Backfill Complete ===");
  console.log(`Tokens created: ${tokensCreated}`);
  console.log(`Trades indexed: ${tradesIndexed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total sigs fetched: ${totalFetched}`);

  // Update 24h volumes
  const oneDayAgo = new Date(Date.now() - 24*60*60*1000);
  const vols = await prisma.trade.groupBy({
    by: ["mint"],
    where: { timestamp: { gte: oneDayAgo } },
    _sum: { solAmount: true },
  });
  for (const v of vols) {
    await prisma.token.update({
      where: { mint: v.mint },
      data: { volume24h: Number(v._sum.solAmount ?? 0n) / 1e9 }
    });
  }
  console.log(`Updated 24h volumes for ${vols.length} tokens`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
