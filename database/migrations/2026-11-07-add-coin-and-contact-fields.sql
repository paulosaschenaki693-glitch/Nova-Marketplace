-- Nova Campus Marketplace Listing Coins & Direct Contact Compatibility Patch
-- Safe and additive only. Run in the Supabase SQL Editor.
-- Does NOT delete or alter existing data.

-- 1. Add coin balance to User
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "coinBalance" INTEGER NOT NULL DEFAULT 0;

-- 2. Add contact and coin cost fields to Product
ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "telegramHandle" TEXT,
  ADD COLUMN IF NOT EXISTS "coinCost" INTEGER NOT NULL DEFAULT 1;

-- 3. Add CoinTransactionType enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CoinTransactionType') THEN
    CREATE TYPE public."CoinTransactionType" AS ENUM (
      'WELCOME_BONUS',
      'PURCHASE',
      'LISTING_FEE',
      'LISTING_REFUND',
      'ADMIN_ADJUSTMENT'
    );
  END IF;
END $$;

-- 4. Add COIN to NotificationType enum if not exists
DO $$
BEGIN
  ALTER TYPE public."NotificationType" ADD VALUE IF NOT EXISTS 'COIN';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create CoinPurchase table
CREATE TABLE IF NOT EXISTS public."CoinPurchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "coinsCount" INTEGER NOT NULL,
  "amountPaid" DECIMAL(12,2) NOT NULL,
  "paymentMethod" public."PaymentMethod" NOT NULL,
  "screenshotUrl" TEXT NOT NULL,
  "transactionReference" TEXT,
  "status" public."PaymentStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "adminNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CoinPurchase_status_createdAt_idx" ON public."CoinPurchase"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CoinPurchase_userId_idx" ON public."CoinPurchase"("userId");

-- 6. Create CoinTransaction table
CREATE TABLE IF NOT EXISTS public."CoinTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES public."User"("id") ON DELETE CASCADE,
  "amount" INTEGER NOT NULL,
  "type" public."CoinTransactionType" NOT NULL,
  "description" TEXT NOT NULL,
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CoinTransaction_userId_createdAt_idx" ON public."CoinTransaction"("userId", "createdAt");
