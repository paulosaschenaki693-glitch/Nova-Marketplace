# Nova Campus Marketplace — setup, test, and deployment

## 1. Create Supabase (database + file storage)
1. Create a project at https://supabase.com/dashboard.
2. In **Project Settings → Database**, copy the PostgreSQL connection strings.
3. Put the transaction-pooler connection string in `DATABASE_URL` (port 6543, include `?pgbouncer=true&connection_limit=1`). Put a direct database connection string in `DIRECT_URL` (usually port 5432). If your network/host cannot use direct IPv6, use Supabase's session pooler connection for `DIRECT_URL`.
4. In **Storage**, create two buckets with these exact names:
   - `product-images` — **Public** (product photos are public marketplace content).
   - `private-documents` — **Private** (student ID images and payment proofs). Do not make this bucket public.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only. It bypasses Storage policies and must never use a `NEXT_PUBLIC_` prefix.

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

## 4. Install, generate the Supabase database schema, and test locally
Requires a supported Node.js LTS version (Node 20 or newer recommended).

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma db push
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000. Check the home page, register a student with email/password + student ID image, register a merchant, verify new profiles are `PENDING` in Supabase, and test login rejection while pending. After creating an admin (next step), approve a test account and verify the student can log in and use favorites, listing upload, checkout, and payment proof upload.

`prisma db push` creates/updates the PostgreSQL tables in the Supabase database based on `prisma/schema.prisma`. Review the schema changes before running it against a database with valuable data. It does not migrate existing MySQL rows for you.

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
- `product-images` must be public for public product photo URLs to load.
- `private-documents` must stay private. The app streams private files only through server routes that require an active admin session.
- Supabase free plans have usage limits and may pause projects for inactivity. Review current plan limits at https://supabase.com/pricing before using the site for real orders.
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
