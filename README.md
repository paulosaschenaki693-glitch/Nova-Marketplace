# Nova Campus Marketplace

Full-stack Next.js marketplace pilot for Woldiya University. Features include student/merchant account approval, product listings and AI-assisted moderation, favorites, multi-seller combined orders, manual TeleBirr/CBE/BOA payment-proof review, seller fulfillment, commissions, notifications, reports, and a responsive light/dark UI.

## Technology stack
- Next.js App Router + TypeScript
- Supabase PostgreSQL database accessed through Prisma
- Firebase Authentication for email/password credentials
- Cloudflare R2: public product images and private student-ID/payment-proof files
- Signed HttpOnly JWT session cookie

## Quick start
1. Read `DEPLOYMENT.md` and `CLOUDFLARE_R2_SETUP.md`.
2. Copy `.env.example` to `.env` and add your own credentials. Never commit `.env` or expose the Firebase service-account private key, R2 secret key, or `AUTH_SECRET`.
3. Install and validate:

   ```bash
   npm install
   npx prisma validate
   npx prisma generate
   npm run lint
   npm run build
   npm run dev
   ```

4. Open http://localhost:3000.

**Database safety:** This project may be connected to an existing Supabase database. Do not run `prisma db push`, `prisma migrate reset`, or seed commands against a database containing real data without reviewing the exact schema diff and taking a verified backup. For the four known missing nullable `User` fields, review the additive SQL in `database/migrations/2026-11-05-add-user-verification-fields.sql`.

## Authentication and account status
Students register with full name, email, phone, student ID number, student ID image, and password. Merchants register with shop name, email, phone, and password. Firebase manages credentials; Supabase stores the marketplace profile. Student accounts are automatically checked when Gemini is configured and otherwise remain pending for manual review. Merchants activate after required form validation. Public registration cannot create administrators.

## Storage
Create the public and private Cloudflare R2 buckets described in `CLOUDFLARE_R2_SETUP.md`. The private bucket must remain private; documents are streamed only through admin-protected routes.

## Admin setup
Follow section 5 of `DEPLOYMENT.md`. Admin accounts must be created privately in Firebase Authentication and then linked to an `ACTIVE` `ADMIN` profile row in Supabase using the Firebase UID. The seed script only creates marketplace categories; it deliberately does not create password-based demo accounts.

## Payment settings
Set these server-side environment variables only after confirming the accounts are owned/controlled by the marketplace:
- `PAYMENT_TELEBIRR_ACCOUNT_NAME`, `PAYMENT_TELEBIRR_NUMBER`
- `PAYMENT_CBE_ACCOUNT_NAME`, `PAYMENT_CBE_ACCOUNT_NUMBER`
- `PAYMENT_BOA_ACCOUNT_NAME`, `PAYMENT_BOA_ACCOUNT_NUMBER`
- `DEFAULT_DELIVERY_FEE`

A screenshot is not proof by itself; the admin must verify the actual funds received before approving a payment.

## Notes before public launch
Test registration, approval, product upload, favorites, combined checkout, payment review, fulfillment, and commission flows against configured projects using non-production accounts. Review privacy/terms/refund policies, enable backups, add rate limiting and monitoring, and verify all payment account details before taking real orders. Free hosting/storage plans have limits and may pause inactive projects. See `DEPLOYMENT.md` for setup.


## Current marketplace business model

Nova Campus Marketplace uses prepaid Listing Coins. The approved student packages are 1 coin = ETB 10, 5 coins = ETB 50, and 15 coins = ETB 130. Merchant packages are 1 coin = ETB 20, 5 coins = ETB 90, and 15 coins = ETB 250. Custom purchases use ETB 12 per student coin and ETB 22 per merchant coin. Eligible active accounts receive 3 welcome coins. Listing coin cost is determined by the configured product-price tiers in `lib/coins.ts`.

Listings last 30 days from publication. AI verification that immediately publishes a listing counts as approval and charges the fee at activation. Listings sent to human review reserve coins, then deduct them only after approval; rejection or seller archival releases the reservation. Expired listings can be renewed for another 30 days by paying the listing fee again.

Buyers contact sellers directly. Seller phone numbers are required and the listing form explicitly obtains consent to display the number publicly. Nova does not collect buyer payments or take percentage sales commissions. Legacy order/checkout/commission pages and APIs are retired; historical records are preserved in the database.
