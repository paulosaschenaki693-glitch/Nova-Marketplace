# Nova Campus Marketplace update notes

This archive is an updated copy of the project snapshot supplied for the requested UI, authentication, inventory, checkout, and admin workflow changes. It does not connect to or modify a live database.

## Changes included

- Replaced category links in the header with Home, Explore, Start Selling, and About/Help; added authenticated profile avatar and a responsive mobile navigation menu.
- Added `/api/auth/me`, `/profile`, and `/start-selling` flows. Successful login returns to the homepage with a welcome toast. Start Selling routes active students and merchants to their own seller area and blocks non-active accounts.
- Added a profile hub with overview, security, orders, products, sold-out products, and support sections. Product sections are hidden for admins.
- Removed hardcoded sample/demo products from Home, Explore, and product detail. Home categories and products now come from the marketplace APIs.
- Public product queries now exclude zero-stock products and products owned by non-active sellers. Seller stock can be restocked through an ownership-checked endpoint; zero stock marks the listing sold out.
- Reworked order creation to reserve/decrement inventory in the order transaction, roll back reservations if order creation fails, use collision-resistant order numbers, and log server-side failure details.
- Made payment selection and order summary use responsive layouts with wrapping for long account details.
- Replaced admin order “advance” clicks with separate order-status and seller-fulfillment dropdowns; added server-side workflow transition validation. Payment, listing, and account review actions also use dropdowns.
- Fixed merchant registration validation so the optional student-ID image can be an empty string for merchants.

## Database and verification notes

- No Prisma schema change was made, so this archive does not require a schema migration for these code changes.
- Existing database records are not deleted or modified by this archive. No seed command was run.
- TypeScript/TSX syntax parsing passed for changed files.
- A full TypeScript/Next.js build and live account/checkout regression tests could not be completed in this environment because dependencies could not be installed before the install timeout and the supplied archive does not include runtime environment secrets or a connected database.
- The checkout intermittent failure was not reproducible without the live runtime. The order route now logs the underlying exception server-side and makes stock reservation transactional, but the actual production root cause still needs confirmation from the server logs when testing this archive with the configured Firebase/Supabase environment.


## V4.2 follow-up

The V4.2 completion work is recorded in `IMPLEMENTATION_PROGRESS.md`. The main additions include a real seller listing editor/archive UI for both account types, correct auto-approved registration routing, shared notifications for students and merchants, per-seller admin fulfillment controls, buyer order support details, and the reviewed additive database SQL patch. The project uses Cloudflare R2 for image storage (not Supabase Storage). The source passes syntax transpilation and static route checks, but dependency installation timed out here, so no full TypeScript or Next.js production build is claimed.
