ALTER TYPE public."ListingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Additive migration for 30-day listings and approval-time coin deduction.
-- Review against the live schema before applying. No tables or historical rows are deleted.
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "reservedCoinBalance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "coinReserved" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "coinChargedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contactPhonePublic" BOOLEAN NOT NULL DEFAULT TRUE;

-- Existing V11 listings were charged at submission, even while awaiting review.
-- Convert old pending fees into reservations: restore the debit and reserve the same
-- amount so approval later finalizes the deduction, while rejection releases it.
WITH pending_legacy AS (
  SELECT p."sellerId", SUM(p."coinCost")::INTEGER AS coins
  FROM public."Product" p
  WHERE p."status" = 'PENDING_REVIEW'
    AND p."coinReserved" = FALSE
    AND p."coinChargedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM public."CoinTransaction" ct
      WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public."CoinTransaction" refund
      WHERE refund."referenceId" = p."id" AND refund."type" = 'LISTING_REFUND'
    )
  GROUP BY p."sellerId"
)
UPDATE public."User" u
SET "coinBalance" = u."coinBalance" + pending_legacy.coins,
    "reservedCoinBalance" = u."reservedCoinBalance" + pending_legacy.coins
FROM pending_legacy
WHERE u."id" = pending_legacy."sellerId";

UPDATE public."Product" p
SET "coinReserved" = TRUE
WHERE p."status" = 'PENDING_REVIEW'
  AND p."coinReserved" = FALSE
  AND p."coinChargedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM public."CoinTransaction" ct
    WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public."CoinTransaction" refund
    WHERE refund."referenceId" = p."id" AND refund."type" = 'LISTING_REFUND'
  );

-- Record the balance restoration in the ledger so the old premature debit is netted
-- out. The actual listing fee will be recorded only when this reservation is approved.
INSERT INTO public."CoinTransaction" ("id", "userId", "amount", "type", "description", "referenceId", "createdAt")
SELECT md5(random()::TEXT || clock_timestamp()::TEXT), p."sellerId", p."coinCost",
       'LISTING_REFUND'::public."CoinTransactionType",
       'V11 migration adjustment: reversed premature listing fee; coins are reserved until approval.',
       p."id", CURRENT_TIMESTAMP
FROM public."Product" p
WHERE p."status" = 'PENDING_REVIEW'
  AND p."coinReserved" = TRUE
  AND p."coinChargedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM public."CoinTransaction" ct
    WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public."CoinTransaction" refund
    WHERE refund."referenceId" = p."id" AND refund."type" = 'LISTING_REFUND'
  );

-- Previously rejected V11 listings were charged before approval. Refund those old
-- fees once, record the refund in the ledger, and leave them eligible for a fresh
-- approval-time charge if the seller edits and resubmits the listing.
WITH rejected_legacy AS (
  SELECT p."id", p."sellerId", p."coinCost"
  FROM public."Product" p
  WHERE p."status" = 'REJECTED'
    AND p."coinChargedAt" IS NULL
    AND EXISTS (
      SELECT 1 FROM public."CoinTransaction" ct
      WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public."CoinTransaction" refund
      WHERE refund."referenceId" = p."id" AND refund."type" = 'LISTING_REFUND'
    )
)
UPDATE public."User" u
SET "coinBalance" = u."coinBalance" + refunds.coins
FROM (
  SELECT "sellerId", SUM("coinCost")::INTEGER AS coins
  FROM rejected_legacy GROUP BY "sellerId"
) refunds
WHERE u."id" = refunds."sellerId";

INSERT INTO public."CoinTransaction" ("id", "userId", "amount", "type", "description", "referenceId", "createdAt")
SELECT md5(random()::TEXT || clock_timestamp()::TEXT), p."sellerId", p."coinCost",
       'LISTING_REFUND'::public."CoinTransactionType",
       'One-time V11 migration refund: listing was rejected before publication.',
       p."id", CURRENT_TIMESTAMP
FROM public."Product" p
WHERE p."status" = 'REJECTED'
  AND p."coinChargedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM public."CoinTransaction" ct
    WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public."CoinTransaction" refund
    WHERE refund."referenceId" = p."id" AND refund."type" = 'LISTING_REFUND'
  );

-- Listings already published (or previously sold/archived) keep their historical
-- fee as paid. Pending and rejected items are deliberately excluded above.
UPDATE public."Product" p
SET "coinChargedAt" = COALESCE(p."publishedAt", p."createdAt")
WHERE p."coinChargedAt" IS NULL
  AND p."status" IN ('ACTIVE', 'SOLD', 'ARCHIVED')
  AND EXISTS (
    SELECT 1 FROM public."CoinTransaction" ct
    WHERE ct."referenceId" = p."id" AND ct."type" = 'LISTING_FEE'
  );

-- Existing active and sold listings receive an expiry from their original publish date,
-- so restocking a sold listing cannot silently create a fresh unpaid 30-day period.
UPDATE public."Product"
SET "expiresAt" = COALESCE("publishedAt", "createdAt") + INTERVAL '30 days'
WHERE "status" IN ('ACTIVE', 'SOLD') AND "expiresAt" IS NULL;

-- Ensure the coin transaction reference is unique when a provider reference exists.
-- Check for existing duplicate non-empty references before creating this index:
-- SELECT "paymentMethod", UPPER("transactionReference"), COUNT(*) FROM public."CoinPurchase"
-- WHERE "transactionReference" IS NOT NULL GROUP BY 1,2 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "CoinPurchase_paymentMethod_transactionReference_key"
ON public."CoinPurchase" ("paymentMethod", UPPER("transactionReference"))
WHERE "transactionReference" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Product_status_expiresAt_idx"
ON public."Product" ("status", "expiresAt");
