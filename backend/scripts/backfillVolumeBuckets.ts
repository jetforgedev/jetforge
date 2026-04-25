/**
 * One-time backfill: populate TradeVolumeBucket from existing Trade rows and
 * recompute Token.volume24h for every affected mint.
 *
 * Usage (run once after deploying the migration):
 *   cd backend
 *   npx ts-node scripts/backfillVolumeBuckets.ts [lookbackHours]
 *
 * Default lookback is 48h so tokens active before the deploy keep correct volume.
 */

import dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getMinuteBucketStart(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000);
}

async function main() {
  const lookbackHours = parseInt(process.argv[2] ?? "48", 10);
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  console.log(`Backfilling TradeVolumeBucket for last ${lookbackHours}h (since ${since.toISOString()})…`);

  const trades = await prisma.trade.findMany({
    where: { timestamp: { gte: since } },
    select: { mint: true, solAmount: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  console.log(`Found ${trades.length} trade(s) to bucket.`);

  // Aggregate into (mint, bucketStart) buckets in memory first
  const bucketMap = new Map<string, { mint: string; bucketStart: Date; volumeLamports: bigint; trades: number }>();

  for (const t of trades) {
    const bucketStart = getMinuteBucketStart(t.timestamp);
    const key = `${t.mint}|${bucketStart.getTime()}`;
    const existing = bucketMap.get(key);
    if (existing) {
      existing.volumeLamports += t.solAmount;
      existing.trades += 1;
    } else {
      bucketMap.set(key, { mint: t.mint, bucketStart, volumeLamports: t.solAmount, trades: 1 });
    }
  }

  console.log(`Upserting ${bucketMap.size} bucket(s)…`);

  // Upsert in batches of 100
  const buckets = Array.from(bucketMap.values());
  const BATCH = 100;
  for (let i = 0; i < buckets.length; i += BATCH) {
    const batch = buckets.slice(i, i + BATCH);
    await Promise.all(
      batch.map((b) =>
        (prisma as any).tradeVolumeBucket.upsert({
          where: { mint_bucketStart: { mint: b.mint, bucketStart: b.bucketStart } },
          update: { volumeLamports: { increment: b.volumeLamports }, trades: { increment: b.trades } },
          create: { mint: b.mint, bucketStart: b.bucketStart, volumeLamports: b.volumeLamports, trades: b.trades },
        })
      )
    );
    console.log(`  upserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(buckets.length / BATCH)}`);
  }

  // Recompute Token.volume24h for every affected mint from the bucket table
  const affectedMints = [...new Set(buckets.map((b) => b.mint))];
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  console.log(`Recomputing volume24h for ${affectedMints.length} mint(s)…`);

  for (const mint of affectedMints) {
    const sum = await (prisma as any).tradeVolumeBucket.aggregate({
      where: { mint, bucketStart: { gte: oneDayAgo } },
      _sum: { volumeLamports: true },
    });
    const volume24h = Number(sum._sum.volumeLamports ?? 0n) / 1e9;
    await prisma.token.update({ where: { mint }, data: { volume24h } });
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
