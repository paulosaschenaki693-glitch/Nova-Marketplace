-- Nova Campus Marketplace V4 compatibility patch.
-- Review against the live schema before running. This is additive only.
-- Run once in the Supabase SQL Editor; it does not delete or rewrite existing rows.
ALTER TABLE public."User"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "studentIdStorageKey" TEXT;
