# Nova Campus Marketplace — Listing Coins & Direct Contact Model Update (V5)

This update transitions Nova Campus Marketplace from the managed-fulfillment/post-sale commission model to a **Prepaid Listing Coins + Direct Buyer-to-Seller Contact** model for Woldia University students and Weldiya town merchants.

## Summary of Changes

### 1. Monetization: Listing Coins Economy
- **Prepaid Listing Coins**: Sellers purchase coins upfront to publish their products; the marketplace takes **0% post-sale commission**.
- **Student Discounted Pricing**:
  - **1 Coin**: Student: 10 ETB | Merchant: 20 ETB
  - **5 Coins (Starter Pack)**: Student: 50 ETB | Merchant: 90 ETB
  - **15 Coins (Pro Seller)**: Student: 130 ETB | Merchant: 250 ETB
  - **Custom Coins**: Student: 12 ETB/coin | Merchant: 22 ETB/coin
- **Product Price Tier Listing Cost**:
  - Up to 500 ETB: **1 Coin**
  - 501 – 2,500 ETB: **2 Coins**
  - 2,501 – 10,000 ETB: **3 Coins**
  - Above 10,000 ETB: **5 Coins**
- **Welcome Coins**: **3 free Listing Coins** automatically credited on 1st-time registration (both auto-approved students and merchants, as well as students approved manually by admins).

### 2. Direct Buyer-to-Seller Contact
- Sellers provide their `contactPhone` (prefilled from profile) and optional `telegramHandle` when listing an item.
- Product detail pages feature prominent, one-click action buttons:
  - **Call Seller** (`tel:...`)
  - **Chat on Telegram** (`https://t.me/...`)
  - **Send SMS** (`sms:...`)
- Includes campus safety recommendations: advising students to meet in public campus areas (Library, Student Union, Cafeteria) and inspect products in person before payment.
- Dedicated safety report modal on product pages for reporting scams or prohibited items.

### 3. AI Moderation Refinement
- Updated Gemini 2.5 Flash prompt in `lib/gemini.ts` to allow seller phone numbers and Telegram handles.
- AI screening continues to detect prohibited items (weapons, drugs, counterfeit goods, academic cheating) and offensive content without stripping legitimate seller contacts.

### 4. Admin Management Suite Overhaul
- **Removed Clunky Dropdowns**: Replaced slow select dropdowns across admin queues with prominent, color-coded, single-click action buttons.
- **Live Command Center Dashboard** (`/admin/dashboard`): Real-time metrics counters for Pending Coins, Pending Listings, Pending Student IDs, Total Coin Revenue (ETB), and Total Coins Sold.
- **Coin Approvals Queue** (`/admin/coins`): Inspect bank receipts (TeleBirr, CBE, BOA) and approve or reject coin orders with one click.
- **User Management & Individual Drawer** (`/admin/users`):
  - Filter by role (Students vs. Weldiya Merchants) and status.
  - Clicking any user opens an individual slide-over drawer displaying full contact info, verification details, student ID card zoom, active product listings, coin transaction history, and direct controls (+ / - coin adjustment, suspend, approve).
- **Visual Category Template Builder** (`/admin/categories`): Replaced raw JSON textareas with an interactive field builder modal to manage category attribute specifications.

### 5. Database & Compatibility
- Additive schema updates in `prisma/schema.prisma`:
  - `User.coinBalance`
  - `Product.contactPhone`, `Product.telegramHandle`, `Product.coinCost`
  - New `CoinPurchase` model for purchase receipts & manual review
  - New `CoinTransaction` model for coin ledger logging
- Reviewable SQL patch provided in `database/migrations/2026-11-07-add-coin-and-contact-fields.sql`. Does not delete or rewrite existing data.
