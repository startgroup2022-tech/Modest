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

## Admin resources → storefront
- Admin content screens ship with matching `/api/admin/<resource>` create/update/
  delete routes (coupons, promotions, shipping, pages, content/social,
  content/homepage, redirects). Their forms post there — never add a UI screen
  without its route, or saves silently 404.

## Authentication, RBAC & permissions (Phase 2)
- Sessions are JWTs in `att_session` (httpOnly). Each token carries a `kind`
  (`staff` | `customer` | `tailor`) and a `sessionVersion` snapshot. `isStaff`
  (`src/lib/admin-auth.ts`) refuses any token whose kind is not `staff`, so a
  tailor or customer cookie can never satisfy an admin guard.
- Effective permissions = `(role grants ∪ ALLOW overrides) \ DENY overrides`.
  Role templates live in `RolePermission`; per-employee deltas in
  `UserPermission` (`src/lib/permissions.ts#resolveEffectivePermissions`). Two
  employees with the same role can therefore hold different permissions. A
  job title is never consulted for authorization.
- Changing a user's role, status, password, or permission overrides calls
  `bumpSessionVersion` (`src/lib/auth.ts`); `getCurrentUser` rejects a token
  whose embedded version is stale, so revocation is immediate.
- Privilege-escalation guard: `forbiddenGrants` stops a non-super-admin
  (non-ADMIN) from granting a permission they do not themselves hold. Applied
  in `PUT /api/admin/employees/[id]/permissions`, the employee create/update
  routes, and `PATCH /api/admin/roles/[id]`. Self-lockout (disabling or
  demoting yourself, or stripping your own `users.manage`) is refused for every
  role, ADMIN included (`SELF_LOCKOUT`, 409).
- Last-effective-admin guard: `countEffectiveAdmins` (`src/lib/admin-auth.ts`)
  counts active ADMIN users whose *resolved* permissions still include
  `users.manage`. The permissions endpoint refuses to strip the final such
  admin (`LAST_ADMIN`, 409), so a DENY override cannot make the system
  unadministrable.
- Tailors authenticate through a separate `TailorCredential` (bcrypt hash only)
  and `att_tailor` cookie; an admin issues a one-time temporary password via
  `POST /api/admin/tailors/[id]/credentials` (returned once, never persisted).
  Login enforces a persistent lockout (`failedLoginAttempts` / `lockedUntil`).
  The first-login password change is at `/[locale]/tailor/password`.
- Supervisor viewing is read-only: `buildSupervisorContext` /
  `canActAsTailor` (`src/lib/tailor-auth.ts`) keep the supervisor's own identity
  and refuse tailor write actions — never impersonate the tailor.
- Tailor work scope resolves through `resolveReadableTailorId` /
  `canWriteTailorWork` / `canReadTailorTask` in the same module. A tailor may
  read/write only their own work; a supervisor may read the tailor they view but
  never write; an unassigned task is refused.
- Permission-specific gates beyond the route's base permission:
  - Product status change (publish/archive) requires `products.approve`;
    `ProductForm` receives `canApprove` and locks the status control otherwise.
  - Naming/reassigning a tailor on a production task requires `orders.assign`.
  - The dashboard loads each block only if the viewer holds the governing
    permission (`getDashboardData(locale, permissions)`), so hidden sections do
    not leak sales/customer/refund/expense data into the page payload.

## Testing notes
- `RUN_DB_TESTS=1 npm test` enables the DB-backed integration suites. They create
  and remove their own rows. **Any suite that mutates a seeded role must snapshot
  and restore the exact prior permission set** — deleting only the keys it added
  can strip a real seeded permission (this happened to SUPPORT `orders.view`).
- After DB tests, re-seed roles if in doubt: `npx prisma db seed`.

## Catalog lifecycle & made-to-measure (Phase 3)
- Storefront visibility is one rule: `STOREFRONT_PRODUCT_STATUSES` in
  `src/lib/catalog.ts` (`ACTIVE`, `PREORDER`). `DRAFT`, `UNAVAILABLE` and
  `ARCHIVED` never reach listings, PDP, search or counts. Change the list, not
  each query, to alter visibility.
- A cut-based product (`Product.cutId` set) is configured per physical piece.
  `CartItem.configKey` groups a commercial line by product+variant+measurement
  config; `CartItemPiece` rows hold one identity per unit and are written
  server-side at add-to-cart. `resolveCartLines` re-reads those snapshots from
  the stored cart (never from the client) and validates against the product's
  stored cut; cut lines then itemise one `OrderItem` per piece.
- Staff quick-order passes `{ requireMeasurements: false }`; buyer checkout is
  measured by default.
- The size guide (`/[locale]/size-guide`) and `SizeGuideManager` are DB-backed
  by `ProductCut`/`MeasurementField`/`SizeChart`. Admin edits go live
  immediately. Deleting an in-use cut archives it instead of removing it, so
  historical order snapshots stay intact.

## Admin resources → storefront
- Admin Promotions drive the storefront: `placement: "announcement"` renders the
  dismissible `AnnouncementBar` in the storefront layout; `placement: "home_banner"`
  renders an editorial section on the homepage.
- SEO redirects are enforced in `src/middleware.ts` via `src/lib/redirects.ts`,
  which reads the cached, edge-safe `GET /api/redirects-map`. The map caches for
  ~60s, so a redirect change may take up to a minute to go live; hit counts raise
  via `POST /api/redirects-map` off the hot path.
- Admin APIs are mutation-only. Admin pages read data through server components,
  so `GET /api/admin/...` returning 405/404 is expected.

## Order lifecycle, payments & membership (Phase 4)
- A payment reaching `PAID` is the single event that (a) confirms a `PENDING`
  order, (b) emits a customer notification, and (c) refreshes the derived
  membership. This must run **after** the transaction commits: the membership
  recompute reads through the global Prisma client, so calling it inside `tx`
  reads pre-commit state and under-counts. Both admin (`updatePayment`) and
  webhook (`applyPaymentResult`) paths follow this pattern.
- `Notification.href` is stored **locale-less** (`/account/orders/{number}`).
  The notifications page prefixes the active locale so Arabic customers are not
  sent to English routes. Never store a locale-prefixed href.
- `transitionOrder` refuses to enter `IN_PRODUCTION` unless a payment is settled
  (`PAID`/`PARTIALLY_REFUNDED`/`REFUNDED`) — the gate lives in the domain layer
  (`src/lib/production-gate.ts`), not the UI. The same gate covers tailor
  assignment and both `/api/admin/production` routes, so a direct API call cannot
  start manufacturing before money is captured.
- `applyPaymentResult` only applies `PENDING → CONFIRMED`. A late or duplicate
  `PAID` callback for an order that already advanced (or was cancelled/refunded)
  must not drag it backwards; it records the payment, not the status.
- A refund's ceiling is the amount actually captured — `min(captured, total)`
  minus prior completed refunds — never the order total, so a discount cannot be
  refunded as cash. A full refund reverts coupon redemptions and decrements each
  coupon's `usedCount` by the redemptions actually reverted.
- The customer order timeline is projected through `toCustomerTimeline`, which
  allowlists customer-safe statuses and substitutes canonical messages. Internal
  event notes (e.g. staff/QC notes) must never reach the storefront.
- Historical order money renders through `OrderPrice` using the order's frozen
  `presentmentCode`/`presentmentRate`; the storefront's live currency selection
  and today's exchange rate must never change a past order. `Price` is for
  live catalogue amounts only.
- `AUTH_SECRET` is required and fails closed (`src/lib/secrets.ts`); there is no
  fallback salt for `hashGuestEmail` or session signing.
- Membership tiers are **seeded** (`SIGNATURE`/`GOLD`/`PLATINUM`) and their
  thresholds live only in `MembershipTier`; the qualifying count is always
  derived from settled, non-refunded order pieces (`src/lib/membership-db.ts`).
  A `membership` site setting can exclude products from qualification.
- Coupon membership targeting (`Coupon.minQualifyingPieces`) is exposed in the
  admin coupon form and enforced in `evaluateCoupon` against the
  server-computed count.
- Measurement profiles are multi-row per customer: `measurementSchema` accepts
  `id` (edit) and `create: true` (explicit add). Without `create`, a POST with no
  id updates the default profile in place.

## Deployment
- cPanel target: see `DEPLOYMENT.md`. Entry point is `server.js` (Passenger).
- Baseline Prisma migration is committed at `prisma/migrations/0_init`.
  Production uses `npx prisma migrate deploy`; existing databases baseline once
  with `npx prisma migrate resolve --applied 0_init`.
- `GET /api/health` is the liveness/readiness probe (checks the DB).
