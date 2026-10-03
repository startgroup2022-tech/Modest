# Attention Modest Fashion

Premium modest-fashion e-commerce platform for **Attention** (Manama, Bahrain).
Next.js App Router + TypeScript + Prisma + MySQL, bilingual (English LTR / Arabic RTL),
multi-currency (BHD accounting base), and a payment-provider abstraction (COD, bank
transfer, BENEFIT, TAPP).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components) |
| Language | TypeScript |
| Styling | Tailwind CSS with a custom design system (`tailwind.config.ts`, `src/app/globals.css`) |
| Database | MySQL 8 / MariaDB 10.4+ via Prisma |
| Auth | bcrypt password hashing + signed httpOnly JWT session cookie, RBAC roles |
| Payments | Provider abstraction in `src/lib/payments` |
| Tests | Vitest (`src/lib/*.test.ts`) |

## Local development

```bash
cp .env.example .env          # then fill in real values
npm install                   # runs prisma generate on postinstall
npx prisma migrate deploy     # or: npx prisma db push  (first setup)
npm run db:seed               # 16 products, 4 categories, 4 collections, 6 currencies, policies
npm run dev                   # http://localhost:3000
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm start`.

## Environment variables

See `.env.example` for the full annotated list. Required in production:

- `DATABASE_URL` — MySQL connection string.
- `AUTH_SECRET` — long random secret (`openssl rand -base64 48`). Signs the session cookie.
- `NEXT_PUBLIC_SITE_URL` — public origin, no trailing slash (used for canonical URLs, hreflang, sitemap, OG images).

Optional (leave blank to disable a payment method at init time):

- TAPP: `TAPP_ENV`, `TAPP_BASE_URL`, `TAPP_MERCHANT_ID`, `TAPP_API_KEY`, `TAPP_WEBHOOK_SECRET`
- BENEFIT: `BENEFIT_ALIAS`, `BENEFIT_ACCOUNT_NAME`, `BENEFIT_ACCOUNT_NUMBER`
- Bank transfer: `BANK_NAME`, `BANK_IBAN`, `BANK_ACCOUNT_NAME`
- Seed bootstrap only: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_CUSTOMER`, `SEED_DEMO_PASSWORD`

Payment credentials can also be stored (encrypted at the application layer) via
`SiteSetting` rows (`tapp_config`, `benefit_details`, `bank_transfer_details`) so the
owner can manage them without redeploying. Secrets are never sent to the browser.

## cPanel deployment (Node.js Application Manager)

1. **Node version** — Node.js 20 LTS or newer (tested on Node 24). Select it in the
   Application Manager's *Node.js version* dropdown.
2. **Application root** — upload the repository to e.g. `/home/<user>/attention`.
3. **Application startup file** — `node_modules/next/dist/bin/next` is *not* used;
   set the startup file to `node_modules/.bin/next` or use the npm start command below.
4. **Install dependencies** — run `npm install` (or `npm ci`) from the cPanel terminal in
   the application root. `postinstall` runs `prisma generate`.
5. **Build** — `npm run build`.
6. **Startup command** — `npm start` (runs `next start -p ${PORT:-3000}`). Map the
   application's assigned port to `PORT`.
7. **Environment variables** — add every variable from `.env.example` in the
   Application Manager's *Environment Variables* section (do not upload `.env`).
8. **Database migration** — `npx prisma migrate deploy` (or `npx prisma db push` for a
   fresh database), then `npm run db:seed` once.
9. **Static / public storage** — product and brand imagery lives under `public/media`.
   Uploaded media should be written to `public/uploads` (create it on the server and
   keep it writable). Next.js serves `public/` directly; nothing else is required.
10. **Rewrite / proxy** — point the domain document root at the Node.js application so
    all requests are proxied to the app (Passenger/Node.js selector does this
    automatically). No custom `.htaccess` rewrites are needed.
11. **SSL** — issue a certificate via AutoSSL / Let's Encrypt and force HTTPS. Set
    `NEXT_PUBLIC_SITE_URL` to the `https://` origin.
12. **Cron** — none required for the storefront. If scheduled tasks are added later
    (e.g. abandoned-cart reminders), register them here.

## Payment architecture

`src/lib/payments/index.ts` exposes `getPaymentProvider(method)`. Each provider returns
an `init()` result and (where applicable) a `verifyWebhook()` result.

- COD / bank transfer / BENEFIT produce `PENDING` orders with transfer instructions; the
  owner confirms payment from the management side.
- TAPP creates a hosted payment session and is verified through
  `POST /api/webhooks/tapp`, which rejects any request whose HMAC signature does not
  match the configured `webhookSecret` before touching order state.

Order creation (`src/lib/orders.ts`) is transactional: stock is decremented with a
guarded `updateMany` so concurrent checkouts cannot oversell, an idempotency key blocks
duplicate submissions, and `applyPaymentResult` is idempotent so replayed webhooks do
not double-apply.

## Multi-currency

All accounting values are stored in **BHD**. Each order additionally preserves the
presentment currency, the presentment total, the exchange rate used, and the timestamp
at which that rate was captured, so historical orders never change when today's rates
are updated. Rates are managed through the `ExchangeRate` / `Currency` tables.

## Bilingual (en / ar)

Locale is resolved in `src/middleware.ts` (`/en`, `/ar`, cookie + `Accept-Language`
fallback) and applied as `dir="rtl"` for Arabic. UI copy lives in
`src/i18n/dictionaries.ts`; product/category/collection content is stored bilingually in
the database. Metadata, canonical URLs and `hreflang` alternates are generated per
locale.

## SEO / AI-search readiness

`sitemap.xml` (with `hreflang` alternates), `robots.txt`, web manifest, OpenGraph image
route, canonical URLs, and JSON-LD (`Organization`, `WebSite`, `BreadcrumbList`,
`Product`, `Offer`, `ItemList`) are generated from real database values. Content is
server-rendered so it is crawlable without client JavaScript.

## Owner-configurable values

The following are intentionally owner-controlled (database, not code): store contact
details, social links, home sections, product/category/collection content and pricing,
currencies and exchange rates, shipping methods, coupons/promotions, policies, SEO
fields, and payment/shipping settings. Provide the real values before launch.
