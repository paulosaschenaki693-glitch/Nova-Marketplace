# Cloudflare R2 setup

1. In Cloudflare Dashboard, open **R2 Object Storage** and create two buckets: one public bucket (for example `nova-campus-public`) and one private bucket (for example `nova-campus-private`).
2. Create an R2 API token with Object Read & Write permission scoped only to this bucket. Copy its Access Key ID and Secret Access Key once.
3. Set `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (public) and `R2_PRIVATE_BUCKET_NAME` (private) in local `.env` and the production host's environment settings.
4. For public product images, connect a custom domain to the bucket and set `R2_PUBLIC_BASE_URL` to that HTTPS domain. Do not expose private student ID or payment proof folders through the public domain.
5. Keep the private bucket private; student ID images and payment screenshots are stored there and served through authenticated admin-only application endpoints. Only the public bucket receives the public custom domain.
6. Deploy the application only after the environment variables are set. No database migration is required for this storage change.

Uploads are converted server-side to WebP with Sharp. Product images use quality 82; identity/payment evidence uses quality 90 to preserve legibility. Existing Supabase objects are not migrated or deleted by this change. Existing Supabase URLs remain valid if the old bucket stays available; move those objects to R2 separately before disabling Supabase.
