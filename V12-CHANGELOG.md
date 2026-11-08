# Nova Campus Marketplace V12 — implementation notes

## Business model
- Applied the approved student and merchant coin package prices, custom coin rates, and 3-coin welcome bonus from `lib/coins.ts`.
- Removed active percentage commission and managed buyer-order/checkout workflows. Legacy routes redirect or return HTTP 410; historical database records are retained.
- Buyers contact sellers directly. New listings require a valid Ethiopian mobile phone and explicit consent to public display.

## Listing and wallet rules
- AI verification that publishes a listing immediately is an approval event and charges coins when the listing becomes active.
- Listings requiring human review reserve coins at submission. Admin approval finalizes the deduction; rejection or archival releases the reservation.
- Coin reservations are reflected in the available balance, listing form, header, and wallet.
- Listings are active for 30 days from approval. Expiration is enforced by API date filters, seller dashboard checks, and the daily cron route. Sellers receive 3-day and expiration notifications and can renew for another 30 days with coins.
- Editing a paid active listing does not charge again. Editing a rejected or sold listing into a new publication requires a fresh fee. Restocking a sold listing does not silently extend its original paid period.

## Buy Coins and integrity
- Coin purchase requires a receipt upload, payment method, and transaction reference.
- Missing payment-account settings block submission; placeholder account numbers were removed.
- R2 HEAD errors now distinguish a missing receipt from storage/permission failures.
- Duplicate payment references are blocked, and admin approval is idempotent under concurrent review.
- Wallet updates use guarded atomic SQL; admin adjustments cannot reduce the balance below reserved coins.
- Legacy V11 pending listing fees are converted to reservations; old rejected listing fees are refunded once by the additive migration where a fee ledger entry exists.

## UI and security
- Removed duplicate service-worker registration and cache-first caching of Next.js bundles; the new worker clears old caches.
- Stabilized navbar/profile sidebar initial markup and removed hydration-warning suppression.
- Added responsive rules for mobile navigation, product details, listing forms, category template editor, wallet modal, Explore filters, admin tables, and home layout.
- Public product and favorites endpoints expose only active, available, unexpired listings from active sellers. Public seller phone data is limited to the explicit listing contact field.
- Updated terms, privacy, safety, support, and dashboard messaging for direct buyer-seller transactions.

## Required before deployment
1. Back up/export Supabase.
2. Review and apply the SQL migrations in the order documented in `DEPLOYMENT.md`.
3. Configure payment account numbers, Cloudflare R2 write + read/HEAD permissions, Firebase, Supabase, Gemini, and `CRON_SECRET`.
4. Run `npm install`, `npx prisma generate`, `npm run lint`, and `npm run build` in an environment with registry access.
5. Test real R2 receipt upload/verification, admin credit/reject, AI-approved listing, human-reviewed listing, rejection reservation release, expiry, renewal, and the 320–1440px responsive breakpoints.

## Verification performed during this update
- 108 TypeScript/TSX files parsed with zero TypeScript transpilation syntax diagnostics.
- JSON configuration files parse successfully.
- CSS brace balance is zero; Prisma schema duplicate-field scan found no duplicate model fields.
- Full `tsc` and Next.js production build were not verified because project dependencies could not be installed in this environment (npm registry access timed out and offline cache lacked dependencies).
- No live Supabase/R2/Firebase credentials were used and no production database was modified.
