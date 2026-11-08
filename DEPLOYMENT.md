# Nova Campus Marketplace — setup, test, and deployment

## 1. Create Supabase PostgreSQL and Cloudflare R2 storage
1. Create a Supabase project. This application uses Supabase for PostgreSQL only; product photos and private verification/payment images are stored in Cloudflare R2.
2. In **Project Settings → Database**, copy the PostgreSQL connection strings.
3. Put the transaction-pooler connection string in `DATABASE_URL` (port 6543, include `?pgbouncer=true&connection_limit=1`). Put a direct database connection string in `DIRECT_URL` (usually port 5432). If your network/host cannot use direct IPv6, use Supabase's session pooler connection for `DIRECT_URL`.
4. Create the two Cloudflare R2 buckets and configure them by following `CLOUDFLARE_R2_SETUP.md`. Do not create Supabase Storage buckets for this application.

## 2. Create Firebase Authentication
1. Create a project at https://console.firebase.google.com/.
2. Open **Authentication → Sign-in method** and enable **Email/Password**.
3. Open **Project settings → General** and copy the Web API key into `NEXT_PUBLIC_FIREBASE_API_KEY`; copy the project ID into `FIREBASE_PROJECT_ID`.
4. In **Project settings → Service accounts**, generate a private service-account key. Set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from that JSON. Keep them secret. In the environment editor, preserve newlines as `\n` inside the key value.
5. Never allow public sign-up to select the ADMIN role. The app's public registration accepts only STUDENT and MERCHANT.

## 3. Configure environment variables
1. Copy `.env.example` to `.env` for local development, or add the same values to your deployment provider's environment settings.
2. Set a strong random `AUTH_SECRET` (at least 32 characters). Do not deploy with the example value.
3. Set `NEXT_PUBLIC_APP_URL` to the actual site origin after deployment.
4. Configure payment account numbers only after you have verified the destination accounts.

## 4. Install dependencies, validate schema, and test locally
Requires Node.js 20 or newer.

```bash
npm install
npx prisma validate
npx prisma generate
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000 and test using non-production accounts. This project already targets an existing Supabase PostgreSQL database. Do not run `prisma db push`, `prisma migrate reset`, or seed commands against that database as a routine setup step. First compare the live schema with `prisma/schema.prisma`; use the reviewed additive compatibility SQL documented below for the four known missing nullable `User` columns. For a completely new, empty development database only, `prisma db push` may be used after reviewing the schema and confirming the database contains no data to preserve.

## 5. Provision the first admin account (manual, private setup)
1. In Firebase Console → Authentication, manually add an admin email and a strong password. Copy the Firebase user's **UID**.
2. In Supabase SQL Editor, run the SQL below after replacing the four placeholder values. The Firebase UID must be used as the `id`, because the app joins the auth identity to the marketplace profile by UID.

```sql
insert into public."User" (id, role, status, email, phone, "passwordHash", "preferredLanguage", "createdAt", "updatedAt")
values ('FIREBASE_UID_HERE', 'ADMIN', 'ACTIVE', 'admin@example.com', '0000000000', null, 'en', now(), now());
```

Use the same email you created in Firebase. Do not expose admin credentials or make an admin-creation endpoint public. If the table names/casing differ in your Supabase SQL editor, first inspect the generated schema in Table Editor.

## 6. Deploy the Next.js app
Recommended path: Vercel (https://vercel.com/), or another host that supports Next.js Node.js route handlers.
1. Push this project to a private GitHub repository.
2. Import the repository into Vercel.
3. Add every required environment variable from `.env.example` in Vercel's project settings for Preview and Production.
4. Deploy. If your deployment build does not automatically generate Prisma Client, keep the `build` script as `prisma generate && next build` (already configured).
5. After the first deployment, test registration, login, pending-account rejection, admin approval, uploads, product listing, favorites, order creation, and payment review using test accounts.

## 7. File privacy and free-tier notes
- The public R2 bucket serves product images only. The private R2 bucket stores student ID images and payment screenshots and must remain private.
- Private files are streamed only through server routes that require an active admin session.
- Supabase Free plans have usage limits and may pause projects for inactivity. Review current plan limits at https://supabase.com/pricing before using the site for real orders.
- Configure backups and do not treat an unpaid/free database as your only copy of important order records.

## Known deployment boundary
The project file is prepared for this architecture, but I cannot verify live Firebase/Supabase connectivity without your own project credentials. A successful local typecheck/build does not replace an end-to-end test against configured services.


## Cloudflare R2 image storage (updated)

Image uploads now require Cloudflare R2 rather than Supabase Storage. Follow `CLOUDFLARE_R2_SETUP.md` and configure these server-side variables in both local `.env` and your production host:
- `CLOUDFLARE_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (public product-image bucket)
- `R2_PRIVATE_BUCKET_NAME` (private student-ID and payment-proof bucket)
- `R2_PUBLIC_BASE_URL` (HTTPS custom domain connected only to the public bucket)

Install dependencies with `npm install` after extracting this update. Sharp converts accepted uploads to WebP. Private verification documents are only streamed through admin-authenticated routes. Existing Supabase image objects are not automatically migrated; keep the old Supabase storage bucket active until existing URLs have been migrated and checked.


## Existing Supabase database compatibility (V4)

The current Prisma schema includes four nullable `User` columns that may be absent from an earlier database created before the V4 verification and soft-deactivation work:

- `deletedAt`
- `verificationMethod`
- `verificationReason`
- `studentIdStorageKey`

Before using account moderation, deactivation/restore, or student-ID verification against that existing database, compare the live `public."User"` table with `prisma/schema.prisma`. If those four columns are missing, review and run the additive SQL in `database/migrations/2026-11-05-add-user-verification-fields.sql` using the Supabase SQL Editor. It uses `ADD COLUMN IF NOT EXISTS` and does not delete or rewrite existing records. Do not run `prisma db push`, reset, seed, or destructive migrations against production as a shortcut.

The public product feed and core session lookup use active account status as the soft-deactivation guard, so a missing `deletedAt` column will not break those paths. The admin deactivated-user view and the account soft-delete/restore actions do require the SQL compatibility patch.


## V12 additive database update and listing expiry

Before deploying this version, review and apply `database/migrations/2026-11-08-listing-expiry-and-coin-reservations.sql` to the existing Supabase database. It adds reserved coin balance and 30-day listing fields. Existing V11 pending listings with a recorded fee are converted into coin reservations; previously rejected V11 listings with a recorded fee receive a one-time ledgered refund; already published/sold/archived listings retain their historical paid status. It also adds a payment-reference uniqueness index. It does not drop or reset existing data. Review the balance adjustments and verify the exact live table/column names first.

Set `CRON_SECRET` to a long random secret. The included `vercel.json` schedules `/api/cron/expire-listings` daily; Vercel supplies the cron authorization header when configured. If deploying elsewhere, schedule a daily GET with `Authorization: Bearer <CRON_SECRET>`.

Coin purchase submission requires an uploaded private receipt and a transaction reference. Configure the TeleBirr/CBE/BOA account variables before enabling purchases. The wallet UI disables submission when the selected payment account is missing.

New listing submission requires sellers to confirm that their phone number will be publicly visible to buyers. Existing listings retain the V11 public-contact behavior.

Before applying the migration, run the duplicate-reference diagnostic query commented in the SQL file. Resolve any duplicate non-empty payment references manually before creating the unique index; do not delete purchase records.


### Database migration order

Apply reviewed SQL compatibility patches in this order when the corresponding fields are not already present:
1. `2026-11-05-add-user-verification-fields.sql`
2. `2026-11-08-schema-compatibility.sql`
3. `2026-11-07-add-coin-and-contact-fields.sql` (only if its coin tables/columns are not already present)
4. `2026-11-08-listing-expiry-and-coin-reservations.sql`

The SQL uses `IF NOT EXISTS` for additive columns and is designed to be rerun safely. The final migration adds the `EXPIRED` enum value, converts legacy pending/rejected fees, and adds a unique payment-reference index. Export a database backup first because the migration adjusts coin balances. Run the duplicate-reference diagnostic in that file before creating the index. Do not run `prisma db push`, reset, or destructive migrations against the production database as a substitute for reviewing these patches.

Cloudflare R2 token permissions must allow object upload and object read/HEAD operations on the configured private bucket. The coin purchase endpoint verifies the uploaded receipt with a HEAD request before accepting the request.

After the first V12 deployment, unregister the old Nova service worker once (browser DevTools → Application → Service Workers → Unregister), clear the site's cached storage, and hard-refresh. The V12 worker will then take over and will no longer cache Next.js build chunks.
