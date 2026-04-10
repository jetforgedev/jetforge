-- Fix realTokenReserves default: set to 700000000000000 (700M = 70% curve allocation).
-- 70/30 model: 700M tokens go to the bonding curve for trading; 300M are locked in
-- reserve_vault for the Raydium CPMM pool at graduation.
ALTER TABLE "Token" ALTER COLUMN "realTokenReserves" SET DEFAULT 700000000000000;

-- Backfill tokens that were seeded or created with a wrong default (793100000000000 or
-- 1000000000000000 = old or incorrectly-patched values) and have never been traded
-- (trades = 0), so the indexer has not yet written the correct on-chain value.
-- Tokens with real trades already carry the correct reserve from the indexer.
UPDATE "Token"
SET "realTokenReserves" = 700000000000000
WHERE "realTokenReserves" IN (793100000000000, 1000000000000000)
  AND trades = 0;
