-- Fix realTokenReserves default: was 793100000000000 (old reserve split), now 1000000000000000 (100% to trading vault)
ALTER TABLE "Token" ALTER COLUMN "realTokenReserves" SET DEFAULT 1000000000000000;

-- Backfill existing tokens that were created with the wrong default and have 0 real trades
-- (tokens with actual trades already have correct on-chain values via indexer)
UPDATE "Token"
SET "realTokenReserves" = 1000000000000000
WHERE "realTokenReserves" = 793100000000000;
