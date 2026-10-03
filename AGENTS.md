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
