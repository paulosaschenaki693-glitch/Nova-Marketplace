# Seller profiles and Nova Verified Seller setup

## Database deployment

This feature adds seller profile fields and a `VerifiedSeller` table. After reviewing the schema change, apply it to the intended Supabase database before deploying the new application version:

```bash
npx prisma db push
npx prisma generate
```

The project currently uses Prisma schema push rather than checked-in SQL migrations. Do not run this against production until the current database is backed up and the target Supabase project has been confirmed. The schema change is additive; it does not delete existing marketplace or student-verification fields.

## Storage configuration

No new R2 secrets are required. Existing configuration is reused:

- `R2_BUCKET_NAME`: public marketplace bucket; product images and seller profile images are stored under separate `products/` and `profile-images/` prefixes.
- `R2_PRIVATE_BUCKET_NAME`: private bucket for student IDs, payment proofs and signed seller agreements under `seller-agreements/`.
- `R2_PUBLIC_BASE_URL`: public base URL for images in the public bucket.
- `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`: existing R2 credentials.

Profile images are normalized to WebP, limited to 5 MB at upload, and require explicit public-display consent. Signed agreements accept PDF, JPG and PNG up to 10 MB. Agreement objects are stored privately and are never served from the public image domain.

## Seller workflow

1. An active student or merchant opens **Profile → Nova Verified Seller** and submits an application.
2. Nova reviews the existing account/identity information and any applicable business details offline or through the existing admin review process.
3. Nova and the seller sign the agreement.
4. The admin records the payment method/reference, uploads the signed agreement, and activates the verification.
5. The application stores the fixed fee for that seller's role: 3,999 ETB for students or 5,999 ETB for merchants.
6. Activation lasts six calendar months. The badge is derived from an unexpired `ACTIVE` record; there is no user-editable badge flag.
7. The admin can request a seller response, immediately suspend the badge for serious issues, restore a valid suspended term, or revoke verification with a recorded reason.

The app does not collect money automatically. The admin must confirm that payment was actually received before pressing the activation action. Verified Seller charges are separate from Listing Coins and coin-purchase approvals.

## Admin workflow and access

Use **Admin → Verified Sellers** to search and filter applications, record payment and agreement details, activate badges, request explanations, suspend, restore and revoke.

Signed agreements are accessible only to an active owner account for that verification record and authorized admins. They are delivered as private attachments with no-store caching and content-sniffing protection. The admin actions are recorded in `AdminAuditLog`; verification terms and old agreements are retained as separate records.

## Expiry and reminders

The existing Vercel cron `/api/cron/expire-listings` runs daily at `0 0 * * *` and requires the existing `CRON_SECRET`. It now sends a 30-day verification expiry reminder and marks ended active terms as `EXPIRED`. The badge check itself also verifies the expiry timestamp, so an overdue badge is hidden even before the cron runs.

## Important behavior retained

The new profile editor does not allow changes to email, account role/status, student ID number/image, student verification, or coin balances. Student registration and verification, student discounts, listing fees and coin reservation logic are unchanged.

Nova Verified means Nova checked the seller information recorded for the relevant term. It is not a warranty, endorsement of specific products, proof of a successful transaction, or guarantee of safe conduct. The fee is for the verification and administration process, not for positive reviews or ratings.
