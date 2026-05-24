-- Add TradeVolumeBucket table.
-- Replaces the per-trade Trade.aggregate(last 24h) scan in the indexer.
-- 24h of 1-minute buckets = ≤1440 rows per mint; indexed on (mint, bucketStart).
CREATE TABLE "TradeVolumeBucket" (
    "id"             SERIAL NOT NULL,
    "mint"           TEXT NOT NULL,
    "bucketStart"    TIMESTAMP(3) NOT NULL,
    "volumeLamports" BIGINT NOT NULL DEFAULT 0,
    "trades"         INTEGER NOT NULL DEFAULT 0,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeVolumeBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TradeVolumeBucket_mint_bucketStart_key"
    ON "TradeVolumeBucket"("mint", "bucketStart");

CREATE INDEX "TradeVolumeBucket_mint_bucketStart_idx"
    ON "TradeVolumeBucket"("mint", "bucketStart");
