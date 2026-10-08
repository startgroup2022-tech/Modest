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
- A settlement callback is only trusted for money the order actually carries: the
  TAPP webhook requires the gateway-reported currency to be present and equal to
  the payment's presentment currency, and the reported amount to match the
  captured presentment amount. A signed callback is proof of sender, not of the
  monetary unit, so a missing/mismatched currency or amount is rejected outright.
- Provider callbacks are de-duplicated durably: the SHA-256 of the raw signed body
  is stored in `PaymentWebhookEvent.eventKey` (unique) inside the same transaction
  as the state change. Replaying the exact same body is a no-op (the route returns
  `{ duplicate: true }` and appends no order event), while a genuinely distinct
  transition hashes differently and still applies. Only a P2002 on that insert is
  treated as a duplicate — any other error propagates.
- If provider initialisation fails at checkout the order is **cancelled** and its
  reserved stock released (transactionally), not left `PENDING`: an order that
  never reached a live payment session must not sit in the queue as "awaiting
  payment". `resendPaymentLink` refuses to mint a new link for a
  cancelled/refunded order.
- A checkout shipping method is selected server-side by DB code. An unknown or
  inactive code is rejected (`INVALID_SHIPPING`), never silently downgraded to a
  cheaper fallback; the fallback applies only when no methods exist.

## Quick Order links (Phase 5)
- A Quick Order link is an opaque handle to one product for one customer. The raw
  token is shown once at creation and only its SHA-256 digest is stored
  (`QuickOrderLink.tokenHash`, unique); `tokenLast4` is display-only. Nothing
  trusted (price, name, tailoring fee, availability, measurement requirements,
  payable amount) is ever encoded in the URL — the public page and the order API
  resolve all of it from the DB by token hash.
- `/q/[token]` is `noindex` and both `/en/q/` and `/ar/q/` are disallowed in
  `robots.ts`: a link is a private handle and must never be crawled or indexed.
- The public order route resolves **exactly one line, cart-free**. It never
  touches the caller's cart, so a signed-in shopper cannot sweep unrelated bag
  items into a quick order.
- A size/variant is required whenever the product is sold by size — including a
  cut product offered in ready sizes — so stock is enforced against that variant.
  Variant prices are surfaced in both the storefront and admin quick-order forms
  so the quoted total always matches what the server charges.
- A cut line is priced per physical piece: when a line carries one piece per
  ordered unit, its total is the sum of each piece's effective price (its
  size-matched variant override, else the product base) and each `OrderItem`
  carries that piece price. Differently-priced sizes therefore sum correctly
  instead of one representative price being multiplied by the quantity. Lines
  without per-piece data keep `unitPriceBhd × quantity`.
- Link lifecycle states are derived from timestamps, never stored. `SEND_INITIATED`
  means a send action began (a WhatsApp deep link was opened); it is explicitly
  not proof of delivery. Opens are stamped best-effort on the public page so the
  staff console's "opened" count reflects real usage.
- Claiming a link is atomic inside the order transaction
  (`where: { id, orderId: null, revokedAt: null }`); a second attempt raises
  `CheckoutError('This quick order link has already been used', 'LINK_USED')`.
  The order carries `channel: QUICK_ORDER` and `quickOrderSource`.
- A staff manual discount is a first-class order amount (`manualDiscountBhd`,
  clamped to the subtotal). It never rewrites per-line prices, and the final
  amounts are persisted inside the order transaction.

## Tailor Portal, production & QC (Phase 6A)
- The portal has its own principal: `resolveTailorAccess` / `resolveTailorApiPrincipal`
  (`src/lib/tailor-principal.ts`) return either the signed-in tailor (read+write,
  own work only) or a staff **read-only supervisor** (`?tailorId=` plus
  `tailors.view`). Every write path goes through `guardTailorWrite`, which also
  enforces the origin/CSRF check; a supervisor is refused structurally
  (`SUPERVISOR_READ_ONLY`) — never impersonate the tailor.
- Server layouts/pages read the request URL from the `x-pathname` header. It
  **includes the query string** (`middleware.ts` stamps `${pathname}${search}`)
  because a layout cannot receive `searchParams` as a prop; without this the
  supervisor `?tailorId=` never reaches the layout.
- `src/lib/tailor-work.ts` is the portal read/write service. Reads use explicit
  allow-list projections — customer money (order totals, item prices, payments,
  profit) is never selected, so it cannot leak into the portal. Ownership is
  enforced by scoping every query to `tailorId`; a task that is not yours is
  indistinguishable from one that does not exist.
- Settlement payout is a **strict, no-skip chain**: `APPROVED → TRANSFERRED`
  (transfer proof URL **or** reference mandatory) `→ PAID → CONFIRMED`
  (`SETTLEMENT_TRANSITIONS` in `src/lib/workflow.ts`). `applySettlementAction`
  refuses `APPROVED → PAID`, and `pay` re-checks `status === 'TRANSFERRED'`.
  Only the tailor may confirm (`confirmSettlementByTailor`), and only after PAID;
  a supervisor can never confirm.
- Paying a settlement raises exactly one `TAILOR_DUE` `Expense` in the same
  transaction, linked via the unique `TailorSettlement.expenseId`
  (`ensureSettlementExpense`), so a retried payout cannot double-count dues. The
  system category is resolved by the stable `ExpenseCategoryType` (`TAILOR_DUE`),
  never by display name.
- Tailor notifications live in `TailorNotification` (a tailor is not a `User`).
  Delivery honours a `NotificationRule` with `targetType = TAILOR`: an inactive
  rule for the event suppresses the row, a missing rule delivers it
  (`src/lib/tailor-notifications.ts`). Assignment and QC both emit them.
- Assignment side-effects have exactly one home: `applyAssignmentSideEffects`
  (`src/lib/assignments.ts`). Both the per-piece service (`assignTailorToItem`)
  and the admin production API (`POST /api/admin/production`,
  `assignTailorToProductionTask` from the queue's reassign action) funnel
  through it inside their own transaction, so the `production.assigned`
  notification is emitted exactly once, to the new tailor only, and never for a
  failed/rolled-back or same-tailor re-assignment. The helper also re-points the
  order item's `assignedTailorId` on every change, so a reassigned piece can
  never stay settle-payable to the tailor who lost it.
- QC requires a rejection reason whenever the result is not `PASSED`, and only
  runs on `QC_ALLOWED_STATES`. A PASS sets the task `COMPLETED`, otherwise
  `REWORK`; the tailor sees the reason in the portal.
- `/en/tailor/` and `/ar/tailor/` are `noindex` and disallowed in `robots.ts`.
- Admin-side controls: `ProductionTaskActions` (reassign/priority/due/workflow,
  `production.manage`; reassignment also needs `orders.assign`) and
  `SettlementRowActions` (the payout chain, `settlements.manage`) live on the
  production and settlements pages.

## Deployment
- cPanel target: see `DEPLOYMENT.md`. Entry point is `server.js` (Passenger).
- Baseline Prisma migration is committed at `prisma/migrations/0_init`.
  Production uses `npx prisma migrate deploy`; existing databases baseline once
  with `npx prisma migrate resolve --applied 0_init`.
- `GET /api/health` is the liveness/readiness probe (checks the DB).
