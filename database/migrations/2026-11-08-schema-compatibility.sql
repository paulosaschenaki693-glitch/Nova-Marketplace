-- Compatibility patch for fields required by the current Prisma schema.
-- Additive only; review the live schema before applying.
ALTER TABLE public."Category"
  ADD COLUMN IF NOT EXISTS "listingTemplate" JSONB;

ALTER TABLE public."Notification"
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key"
ON public."Notification" ("dedupeKey");

ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS "moderationData" JSONB,
  ADD COLUMN IF NOT EXISTS "moderationSource" TEXT,
  ADD COLUMN IF NOT EXISTS "moderationNote" TEXT;

ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "studentIdStorageKey" TEXT;
