-- Security hardening migration
--   1. Money columns Float(double precision) -> Decimal(20,9) for exact balances.
--   2. Append-only Payout ledger (idempotency + audit trail for real SOL payouts).
--   3. Token.raydiumLpBurned flag so an unlocked-LP graduation is reconcilable.

-- 1. Referral money -> Decimal. USING cast preserves existing values.
ALTER TABLE "ReferralAccount"
  ALTER COLUMN "pendingBalance" TYPE DECIMAL(20,9) USING "pendingBalance"::numeric,
  ALTER COLUMN "pendingBalance" SET DEFAULT 0,
  ALTER COLUMN "totalEarned"    TYPE DECIMAL(20,9) USING "totalEarned"::numeric,
  ALTER COLUMN "totalEarned"    SET DEFAULT 0;

ALTER TABLE "ReferralLink"
  ALTER COLUMN "cashbackBalance" TYPE DECIMAL(20,9) USING "cashbackBalance"::numeric,
  ALTER COLUMN "cashbackBalance" SET DEFAULT 0,
  ALTER COLUMN "cashbackEarned"  TYPE DECIMAL(20,9) USING "cashbackEarned"::numeric,
  ALTER COLUMN "cashbackEarned"  SET DEFAULT 0;

-- 2. Payout ledger.
DO $$ BEGIN
  CREATE TYPE "PayoutKind" AS ENUM ('REFERRAL', 'CASHBACK');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE "Payout" (
    "id"        TEXT NOT NULL,
    "wallet"    TEXT NOT NULL,
    "kind"      "PayoutKind" NOT NULL,
    "amountSol" DECIMAL(20,9) NOT NULL,
    "status"    "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "txSig"     TEXT,
    "error"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Payout_wallet_idx" ON "Payout"("wallet");
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- 3. LP-burn flag.
ALTER TABLE "Token"
  ADD COLUMN "raydiumLpBurned" BOOLEAN NOT NULL DEFAULT false;
