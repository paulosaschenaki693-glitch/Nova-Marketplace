# Nova Campus Marketplace — updated architecture and setup

This project uses **Firebase Authentication for email/password credentials**, **Supabase PostgreSQL for the complete relational marketplace database through Prisma**, and **Cloudflare R2 for product images plus private student-ID/payment-proof files**. The marketplace data stays relational so combined orders, seller commissions, payment review, fulfillment, favorites, notifications, and admin workflows continue to use the existing Prisma data model.

## Important changes in this package
- Prisma datasource changed from MySQL to PostgreSQL and now accepts Supabase pooled/direct connection URLs.
- Student registration now requires email + password while keeping student ID number, phone number, and student ID image.
- Student and merchant login use email + password through Firebase Authentication. The backend looks up the Firebase UID in the Supabase `User` row and rejects pending/rejected/suspended accounts.
- Product images use the public R2 bucket; student IDs and payment proofs use the private R2 bucket and admin-only proxy routes.
- Mobile hamburger navigation now opens/closes a real mobile menu.
- Authentication forms handle server error responses and show a loading state.

## Do not deploy before completing setup
This archive cannot connect to your private Firebase/Supabase projects on your behalf. Create the projects, configure environment variables, review/apply the documented additive database compatibility SQL where needed, provision the first admin, and run the checks described in `DEPLOYMENT.md`.

## Existing accounts
This migration changes the password authority to Firebase Authentication. Old MySQL user records do not automatically become Firebase accounts. For a fresh MVP, create accounts after setup. For existing users, use a planned account migration/reset flow; do not copy old password hashes into Firebase.
