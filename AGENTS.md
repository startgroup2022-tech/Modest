# Attention Modest Fashion — repository notes

Bilingual (EN/AR, RTL) modest-fashion commerce platform + admin ERP/CRM.
Next.js 15 App Router · TypeScript · Tailwind · Prisma/MySQL · Vitest.

## Commands
- `npm run dev` · `npm run build` · `npm run start` (`PORT` env, default 3000)
- `npm run typecheck` · `npm run lint` · `npm test`
- `npm run prisma:migrate` (deploy) · `npm run prisma:push` · `npm run db:seed`

## Architecture
- Storefront routes live under `src/app/[locale]/(storefront)/…`; admin under
  `src/app/[locale]/admin/…`. `src/middleware.ts` prefixes un-prefixed paths with
  a locale and stamps `x-locale` / `x-pathname` headers.
- Admin authorization: `requireAdminPage(permission, locale)` for pages,
  `adminHandler(permission, fn)` for API routes (`src/lib/admin-auth.ts`).
  Staff roles are ADMIN / MANAGER / SUPPORT; permissions are in
  `src/lib/permission-defs.ts` and the nav catalogue in `src/lib/admin-nav.ts`.
- Admin UI primitives: `src/components/admin/ui.tsx`, `AdminTable.tsx`,
  `ResourceForm.tsx`, `SettingForm.tsx`, `Drawer`.
- Money is stored in BHD. Orders snapshot the presentment currency in
  `presentmentCode` / `presentmentRate` / `presentmentTotal` / `rateCapturedAt`;
  changing a currency rate must never alter historical orders. Base currency
  (`isDefault`) is rate-locked at 1 and recorded in `ExchangeRate` on change.

## Conventions / gotchas
- **Never pass functions as props from a Server Component to a Client Component.**
  `AdminTable` is a server component (sorting via `Link` + `pathname`/`query`);
  `ResourceForm` takes a `transformKey` into the client registry
  `src/components/admin/transforms.ts` instead of a `transform` callback.
- Page/route modules may only export `default`, `metadata`, `generateMetadata`,
  `dynamic`, `revalidate`, and route handlers — extra exports fail `next build`.
- The ESLint config only extends `next/core-web-vitals`; do not reference rules
  from `@typescript-eslint` (that plugin is not installed).
- `.env` is gitignored. Secrets (`TAPP_*`, `BENEFIT_*`, `BANK_*`, `AUTH_SECRET`)
  must never be committed; admin settings preserve masked secrets via
  `src/lib/admin/settings.ts`.

## Testing
- Seeded creds come from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`
  (defaults `admin@attention-modestfashion.com` / `ChangeMe123!`).
- `POST /api/auth/signin` returns an httpOnly cookie usable for authed curl
  smoke tests of `/en/admin/*` and `/ar/admin/*`.

## Payments
- `src/lib/payment-config.ts` is the single source of truth for method
  enable/visibility, labels, ordering, order-value limits and instructions.
  It reads the `payments_config` site setting and falls back to the legacy
  `payments` booleans, then to code defaults. Checkout enforces the method
  server-side via `assertMethodAllowed` — never trust the client's method list.
- `src/lib/payments/index.ts` holds the provider abstraction
  (`getPaymentProvider`, `listEnabledPaymentMethods`, `testTappConnection`).
  TAPP availability requires credentials; the on/off switch is the method flag.
- `applyPaymentResult` is idempotent and refuses to downgrade a settled payment
  from a late/replayed webhook. The TAPP webhook rejects unsigned requests
  (HTTP 401) and refuses an amount mismatch.
- `PaymentMethodManager` (client) edits `payments_config`; the TAPP "Test
  configuration" button hits `POST /api/admin/payments/tapp-test`, which reports
  missing fields or reachability and never fakes a connected state.

## Deployment
- cPanel target: see `DEPLOYMENT.md`. Entry point is `server.js` (Passenger).
- Baseline Prisma migration is committed at `prisma/migrations/0_init`.
  Production uses `npx prisma migrate deploy`; existing databases baseline once
  with `npx prisma migrate resolve --applied 0_init`.
- `GET /api/health` is the liveness/readiness probe (checks the DB).
