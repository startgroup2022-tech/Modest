# ATTENTION — FULL GAP AUDIT

**Project:** Attention Modest Fashion — `https://github.com/startgroup2022-tech/Modest`
**Phase:** AUDIT ONLY (no code, schema, data, commit, push or deploy changes)
**Branch:** `production-hardening-payments`
**HEAD at audit start:** `b88078b` — `fix(security,commerce): escape JSON-LD, enforce cart stock, correct availability`
**Working tree at audit start:** clean (`git status --short` empty)

> Scope note: The authoritative "Attention Operating Mechanism" specification
> describes **four** interfaces — Storefront, Administration, Quick Order
> *customer* page, and **Tailor Portal** — plus membership tiers, an admin-
> managed size guide, per-item measurement snapshots, frozen per-item tailor
> fees, tailor accounts, settlement items and notification rules. The spec
> document itself was not supplied to this repository, so requirement rows are
> derived from the areas enumerated in the audit brief and cross-checked against
> the code. Where a requirement is named in the brief but has **no** counterpart
> in the schema or routes, it is marked MISSING with the search evidence.

## Verification commands executed

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** — exit 0, no output |
| `npm run lint` (`next lint`) | **PASS** — "No ESLint warnings or errors" |
| `npm test` (`vitest run`) | **PASS** — 8 files, **74 tests passed** (0 failed) |
| `npm run build` (`next build`) | **PASS** — exit 0, all routes compiled |
| `npx prisma generate` | Not run separately; `postinstall` runs it (client resolves at build time) |
| Database-backed verification | **NOT EXECUTED** — `mysql`/`mariadb` client binary is absent in this environment (`bash: mysql: command not found`). `DATABASE_URL` is present (`mysql://attention:***@127.0.0.1:3307/attention`). All DB-backed claims below are derived from **static code inspection**, not live queries. |
| `npm ci` | Not run (node_modules already present; would mutate the tree, which this phase forbids) |

**Consequence:** every row that depends on live data behaviour (e.g. "does this
setting actually change the storefront", "does an order freeze the measurement")
is marked **UNVERIFIED** where static reading cannot prove it, rather than PASS.

---

## Requirement-by-requirement gap table

Status values: **PASS · PARTIAL · MISSING · CONFLICT · UNVERIFIED**
Priority: **P0** launch/security/financial blocker · **P1** core operating functionality · **P2** important completion · **P3** polish

### 1. Database & data model

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| DB | Production Prisma migrations exist | PARTIAL | `prisma/migrations/0_init/migration.sql` (42 `CREATE TABLE`), `migration_lock.toml`; `npm run prisma:migrate` = `prisma migrate deploy` | Single squashed baseline only; no incremental migration history; repo previously had none | Adopt `prisma migrate dev` for every future schema change; keep `db push` out of prod | P2 |
| DB | `db push` not the prod strategy | PASS | `DEPLOYMENT.md` documents `migrate deploy`; `README` mentions push only for first setup | — | — | — |
| DB | users / employees | PASS | `User` (schema L53) with `status`, `roleId`, `jobTitle`, `notes` | — | — | — |
| DB | **independent employee permissions** | CONFLICT | `RolePermission` keyed by `roleId` (L43); `getRolePermissions(roleId)` (`permissions.ts`); no `userId` in permission model | Permissions are **role-scoped, not employee-scoped**. Spec requires employee-specific effective permissions | Add per-user permission overrides (`UserPermission` grant/deny) merged over role defaults; enforce in `guardApi` | P1 |
| DB | customers / guests | PASS | `Customer` (L108); guest checkout via `Order.customerId?` null + `Cart.token` | — | — | — |
| DB | addresses | PASS | `Address` (L125) | — | — | — |
| DB | saved measurement profiles | PASS | `Measurement` (L147) — fixed 8 numeric fields, `unit`, `notes`, `isDefault` | Single flat shape; no per-silhouette field set | — | — |
| DB | **size guide definitions** | MISSING | `grep -rli sizeguide src prisma` → only `size-guide/page.tsx` (hard-coded const tables) | No model; `SizeGuide`/`SizeValue` absent | Add `SizeChart`/`SizeValue` models + admin CRUD | P1 |
| DB | **product cuts/silhouettes** | MISSING | `Product` has no `cut`/`silhouette` field (L227–274) | — | Add `ProductCut` model + `Product.cutId` | P1 |
| DB | products / media / variants | PASS | `Product` (L227), `ProductMedia` (L296), `ProductVariant` (L318) | — | — | — |
| DB | product availability | PASS | `Product.status` (DRAFT/ACTIVE/ARCHIVED), `StockStatus`, `madeToOrder`, `leadTime*` | No `PREORDER`/`UNAVAILABLE` as first-class product states beyond `stockStatus` | — | — |
| DB | **tailor fee (product) + per-item frozen fee** | MISSING | `grep -rni tailorFee prisma/schema.prisma` → none; `ProductionTask` has no fee column | Fee is derived from `Tailor.rateBhd` × tasks at settlement time — **not frozen at assignment** | Add `Tailor.rateBhd` snapshot on `ProductionTask.feeBhd`; snapshot per order item | P0 (financial) |
| DB | **per-item measurement snapshot** | MISSING | `OrderItem` (L567) has `variantLabel` only; no measurement fields/JSON | Changing a customer's measurement later would alter the order | Add `measurementSnapshot Json?` to `OrderItem` | P0 (data integrity) |
| DB | orders / order items / order events | PASS | `Order` (L511), `OrderItem` (L567), `OrderEvent` (L636) | — | — | — |
| DB | payments / refunds | PASS | `Payment` (L587), `Refund` (L619) | — | — | — |
| DB | coupons/promotions | PASS | `Coupon` (L422), `Promotion` (L447) | — | — | — |
| DB | **coupon usage history** | PARTIAL | `Coupon.usedCount`, `Order.couponId/couponCode`; no per-redemption row; `perCustomerLimit` exists but unused | Cannot audit *who* used a code or enforce per-customer limits | Add `CouponRedemption` model; enforce `perCustomerLimit` at checkout | P1 |
| DB | **membership tiers** | MISSING | `grep -rli membership src prisma` → none | No tier model, no thresholds, no qualification logic | Add `MembershipTier` (thresholds, discount) + derived status on `Customer` | P1 |
| DB | inventory | PASS | `ProductVariant.stock/reserved/incoming`, `InventoryMovement` ledger (L358) | `reserved`/`incoming` not maintained by checkout | Wire reservation on order create if reservations required | P2 |
| DB | shipping companies | PARTIAL | `ShippingMethod` (L761) with `courier` string | No shipping-company entity/tracking integration | Add `ShippingCompany` if multi-carrier is required | P2 |
| DB | tracking | PASS | `Order.trackingNumber/carrier/shippedAt/deliveredAt` | — | — | — |
| DB | tailors | PASS | `Tailor` (L811) | — | — | — |
| DB | **tailor accounts (auth)** | MISSING | No `tailorId` on `User`; no tailor login route; `Tailor` has only `email/phone` | Tailors cannot authenticate | Add tailor login (separate role/session) tied to `Tailor` | P1 |
| DB | **item-level tailor assignment** | PARTIAL | `ProductionTask.orderItemId?` exists (L854) | Admin UI assigns at task level; not verified to be per-item end-to-end | Confirm/lock per-item assignment UX + API | P1 |
| DB | tailor work status | PASS | `TaskStatus` (PENDING→…→REWORK), `ProductionTask` | — | — | — |
| DB | QC | PASS | `QcRecord` (L885) with checklist booleans | No dedicated **rejection reason** column (uses free-text `notes`) | Add `rejectionReason` (mandatory on FAIL) | P1 |
| DB | settlements | PARTIAL | `TailorSettlement` (L915) aggregates by tailor+period | **No `SettlementItem` model** — tasks are not linked to a settlement row | Add `SettlementItem`; select delivered-unpaid items; enforce one-tailor rule | P0 (financial) |
| DB | settlement items | MISSING | `grep -rli settlementitem src prisma` → none | — | (as above) | P0 |
| DB | expenses | PASS | `Expense` (L962), `ExpenseCategory` (L952) | — | — | — |
| DB | **expense approvals (rejection reason / resubmission)** | PARTIAL | `Expense.approvalNote`, `EXPENSE_TRANSITIONS` (DRAFT→SUBMITTED→APPROVED/REJECTED→PAID) | `REJECTED` is terminal → **cannot edit & resubmit** a rejected expense | Allow `REJECTED → DRAFT` (edit/resubmit); require reason on reject | P1 |
| DB | **stable expense-category type** | MISSING | `ExpenseCategory` has only `nameEn/nameAr` | Renaming a category would break type-based logic/fields | Add immutable `code`/`type` + category-specific fields | P2 |
| DB | notifications (customer) | PARTIAL | `Notification` (L690) model exists; **no emission code anywhere** (`grep notification.create` → none) | Customer is never notified of anything | Emit notifications on order/payment/ship events | P1 |
| DB | **notification rules** | MISSING | `grep -rli notificationrule src prisma` → none | No configurable event→recipient mapping | Add `NotificationRule` + admin UI | P2 |
| DB | **quick-order links** | MISSING | `grep -rli quickorderlink src prisma` → none; `admin/orders/quick` is an **internal order form**, not a shareable link | No link generation, no state (sent/opened/order) | Add `QuickOrderLink` model + customer `/q/[token]` page | P1 |
| DB | site settings / design settings | PASS | `SiteSetting` (key/Json, L709); `HomeSection` (L715); `SocialLink` (L734) | Design/brand settings are limited to `store` key + homepage sections | — | — |
| DB | audit log | PASS | `AuditLog` (L88), `writeAudit` (`audit.ts`), `auditAdmin` | Append-only by convention (no DB-level immutability) | Consider DB privileges preventing UPDATE/DELETE | P2 |
| DB | **sequence-based human IDs** | MISSING | `generateOrderNumber()` = `ATT-YYMM-######` (`utils.ts` L36); `EXP-`/`STL-` use `Date.now()` base36 | Non-sequential, collision-prone, not a true sequence | Add a DB-backed counter/sequence per document type | P2 |

### 2. Size guide & measurements

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Size guide | ready sizes XS–XL | PARTIAL | `size-guide/page.tsx` hard-coded `BODY_TABLE`/`GARMENT_TABLE`/`CONVERSION_TABLE` (XS–XXL) | Static in code, **not admin-managed** | Persist charts, render from DB | P1 |
| Size guide | different silhouettes/cuts | MISSING | no cut model | — | per-cut charts | P1 |
| Size guide | defined once in admin | MISSING | hard-coded consts | — | admin CRUD | P1 |
| Size guide | custom measurement fields per cut | MISSING | `Measurement` fixed fields | — | per-cut field definitions | P1 |
| Size guide | units | PASS | `Measurement.unit` cm/in; `measurementSchema` enum | — | — | — |
| Size guide | min/max validation | PASS | `measurementSchema` (positive, max 200–300) | — | — | — |
| Size guide | EN/AR field names | PASS | `MeasurementForm.tsx` + `dictionaries.ts` | — | — | — |
| Size guide | saved profiles | PASS | `Measurement` + `account/measurements` + `api/admin/customers/[id]/measurements` | — | — | — |
| Measurements | **ready-size snapshot per order item** | PARTIAL | `OrderItem.variantLabel` captures size text | Not a structured snapshot of the size value/guide version | Add structured `sizeSnapshot` | P0 |
| Measurements | **custom-measurement snapshot per order item** | MISSING | `OrderItem` has no measurement fields | **Changing the size guide / measurements later alters the order** — explicit spec violation | Add `measurementSnapshot Json?` to `OrderItem`, written at checkout | P0 |
| Measurements | changing size guide must not alter existing orders | MISSING | (as above) | — | (as above) | P0 |

### 3. Product management

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Product | active / draft / archived | PASS | `ProductStatus`; `api/admin/products` | — | — | — |
| Product | preorder | PARTIAL | `madeToOrder`, `StockStatus.PRE_ORDER` | No distinct "preorder" product state vs made-to-order | — | P2 |
| Product | unavailable | PASS | `status=ARCHIVED` + `stockStatus=OUT_OF_STOCK` | — | — | — |
| Product | **approval workflow** | UNVERIFIED | no approval fields on `Product` | Spec may require product approval; not present | Confirm requirement; add `ProductApproval` if needed | P2 |
| Product | availability visibility | PASS | `catalog.ts`, `shop/page.tsx`, `BuyPanel.tsx` | — | — | — |
| Product | limited quantity | PASS | `ProductVariant.stock`, `lowStockThreshold` | — | — | — |
| Product | price (+per-variant price) | PASS | `Product.priceBhd`, `ProductVariant.priceBhd` | — | — | — |
| Product | **tailoring fee (product)** | MISSING | no fee field on `Product` | — | add `tailorFeeBhd` | P1 |
| Product | lead time | PASS | `leadTimeMinDays/MaxDays`, `shippingNote*` | — | — | — |
| Product | bilingual description | PASS | `nameEn/Ar`, `descriptionEn/Ar`, `materials*`, `care*` | — | — | — |
| Product | images | PASS | `ProductMedia` + upload API + `uploads/[...path]` | — | — | — |
| Product | category / collections | PASS | `ProductCategory`, `ProductCollection` | — | — | — |
| Product | admin management → storefront | UNVERIFIED | routes exist; live sync not runnable (no DB client) | — | live verification in a later phase | P1 |
| Product | historical commercial data on old orders | PASS | `OrderItem` snapshots `productName/unitPriceBhd/sku/imageUrl` | — | — | — |

### 4. Storefront

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Storefront | homepage / shop / categories / collections | PASS | `(storefront)/page.tsx`, `shop`, `collections/[slug]`, `components/home/*` | — | — | — |
| Storefront | filters / sorting | PASS | `components/shop/*`, `catalog.ts` | — | — | — |
| Storefront | product page / availability / size selection | PASS | `product/[slug]/page.tsx`, `BuyPanel.tsx` | — | — | — |
| Storefront | **custom measurements at purchase** | MISSING | `grep measurement BuyPanel/checkout` → none; checkout schema has no measurement fields | Customer cannot submit made-to-order measurements with an order | Add measurement capture on product/checkout for `MADE_TO_ORDER` | P0 |
| Storefront | cart / checkout | PASS | `lib/cart.ts`, `api/checkout`, `components/checkout/*` | — | — | — |
| Storefront | guest + account checkout | PASS | `customerId?` on order; guest cart token | — | — | — |
| Storefront | wishlist | PASS | `WishlistItem`, `api/wishlist`, `account/wishlist` | — | — | — |
| Storefront | account (orders, addresses, measurements, profile, settings, notifications) | PASS | `account/(protected)/*`, `lib/account.ts` | — | — | — |
| Storefront | **membership** | MISSING | no membership UI/route | — | membership page + tier display | P1 |
| Storefront | login / registration | PASS | `api/auth/signin`, `signup`, `account/sign-in`, `sign-up` | — | — | — |
| Storefront | **email verification** | MISSING | `User.emailVerified` field exists but never set/checked | — | verification flow (or remove field) | P2 |
| Storefront | **forgot / reset password** | MISSING | `grep forgot/reset` → none | No password recovery | Add reset-token flow | P1 |
| Storefront | policies | PASS | `Page` + `/p/[slug]` | — | — | — |
| Storefront | bilingual EN/AR + RTL/LTR | PASS | `[locale]`, `i18n/*`, `dir` handling | — | — | — |
| Storefront | responsive | PASS | Tailwind breakpoints across components | — | — | — |
| Storefront | SEO | PASS | `seo.ts`, `sitemap.xml`, `robots.txt`, JSON-LD, hreflang | — | — | — |
| Storefront | **hard-coded / mock data** | CONFLICT | Size guide tables hard-coded (`size-guide/page.tsx`); product grid cards on homepage use DB; homepage section copy from `HomeSection` | Size guide is the main hard-coded business data; also confirm no other consts | Move size guide to DB | P1 |

### 5. Checkout & order creation

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Checkout | server-side price | PASS | `resolveCartLines` reads `priceBhd` from DB; client price ignored | — | — | — |
| Checkout | server-side availability | PASS | rejects non-ACTIVE product / inactive variant | — | — | — |
| Checkout | inventory enforcement | PASS | guarded `updateMany({stock:{gte:qty}})` inside `$transaction` | — | — | — |
| Checkout | quantity limits | PASS | `checkoutSchema` + `1..20` | — | — | — |
| Checkout | **measurement completeness** | MISSING | no measurement fields in `checkoutSchema` | — | require measurements for made-to-order | P0 |
| Checkout | shipping price server-side | PASS | `shippingMethod` looked up by code; client price ignored | — | — | — |
| Checkout | coupon validation | PASS | DB lookup, active/window/usage checks | Per-customer limit not enforced | enforce `perCustomerLimit` | P1 |
| Checkout | minimum order / coupon minimum | PARTIAL | `computeDiscountBhd` applies `minOrderBhd` (silently yields 0); no global minimum-order setting | No store-wide minimum order enforcement | add min-order setting + enforcement | P2 |
| Checkout | customer identity | PASS | session optional; guest allowed | — | — | — |
| Checkout | idempotency | PASS | `idempotencyKey` unique + replay in `checkout/route.ts` and `createOrder` | — | — | — |
| Checkout | transaction safety / overselling | PASS | single `$transaction`, guarded decrement, ledger movement | — | — | — |
| Checkout | **no production before confirmed payment** | CONFLICT | `createOrder` sets `status='PENDING'`; `ProductionTask` creation is admin-driven (`api/admin/production`), not auto-triggered; but **nothing blocks an admin from creating a task for an unpaid order** | Spec requires gating production on confirmed payment where required | Add guard: refuse task creation unless order paid (per spec) | P1 |

### 6. Customer account & membership

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Account | orders / order timeline / status mapping | PASS | `lib/account.ts`, `order-status.ts`, `account/orders/[orderNumber]` | — | — | — |
| Account | addresses / saved measurements / profile / password / wishlist | PARTIAL | addresses, measurements, profile, wishlist present; **no self-service password change** — `api/account/route.ts` has POST and DELETE only, no password update | Customers cannot change their own password | Add authenticated password-change endpoint + form | P1 |
| Account | **membership tier** | MISSING | no model/UI | — | tiers + qualification | P1 |
| Account | **membership from PAID qualifying abayas** | MISSING | — | — | derive from paid, non-refunded qualifying items | P1 |
| Account | **refunds reduce membership** | MISSING | — | — | recompute on refund | P1 |

### 7. Admin dashboard & orders

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Admin | dashboard KPIs / latest orders | PASS | `admin/page.tsx`, `lib/admin/queries.ts` | — | — | — |
| Admin | order search / filters | PASS | `admin/orders/page.tsx`, `listOrders` | — | — | — |
| Admin | order detail | PASS | `admin/orders/[id]/page.tsx` | — | — | — |
| Admin | **expected delivery date** | PARTIAL | derived from `shippingMethod.etaMin/MaxDays`? verify | confirm surfaced on order | add if missing | P2 |
| Admin | payment | PASS | `admin/payments`, `api/admin/payments/[id]` | — | — | — |
| Admin | **frozen address** | PASS | `Order.shipping*` snapshot columns | — | — | — |
| Admin | **frozen measurements** | MISSING | no snapshot on order/item | — | (see §2) | P0 |
| Admin | tailor assignment / per-item | PARTIAL | `ProductionTask.tailorId`, `orderItemId?` | verify per-item UX | confirm | P1 |
| Admin | **tailor fee snapshot** | MISSING | derived at settlement | — | freeze at assignment | P0 |
| Admin | QC | PASS | `admin/production/qc`, `api/admin/qc` | rejection reason free-text | mandatory reason | P1 |
| Admin | shipping / tracking | PASS | `admin/deliveries`, transition `SHIPPED` | — | — | — |
| Admin | expenses | PASS | `admin/expenses`, `api/admin/expenses` | — | — | — |
| Admin | **settlement linkage** | MISSING | settlement not linked to tasks | — | `SettlementItem` | P0 |
| Admin | order history | PASS | `OrderEvent`, `admin/orders/[id]` | — | — | — |

### 8. Order lifecycle

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Lifecycle | awaiting payment → paid | PASS | `PENDING`→`CONFIRMED` on `updatePayment`/webhook | — | — | — |
| Lifecycle | tailor assignment → accepted → in production | PARTIAL | `PRODUCTION_TRANSITIONS` PENDING→ASSIGNED→IN_PROGRESS | "tailor accepted" is not a distinct order/task state | add explicit acceptance if spec requires | P1 |
| Lifecycle | QC → rejected → passed | PARTIAL | `QcRecord`; task→COMPLETED/REWORK; `QC_ALLOWED_STATES` | no `QC rejected` order state; order stays `QUALITY_CHECK` | — | P2 |
| Lifecycle | ready → shipping → delivered | PASS | `OrderStatus` transitions | — | — | — |
| Lifecycle | refunded/cancelled | PASS | `REFUND_REQUESTED→REFUNDED`, `CANCELLED` terminal; stock released on cancel | — | — | — |
| Lifecycle | **"late" computed, not a state** | MISSING | no late/overdue computation | — | compute from `dueDate`/ETA, never overwrite status | P2 |
| Lifecycle | invalid transitions blocked | PASS | `canTransition` server-side in `transitionOrder`, settlements, expenses, QC | — | — | — |
| Lifecycle | **admin shortcuts violating spec** | CONFLICT | `transitionOrder` allows `PENDING→CONFIRMED` manually (bypasses payment), `PREPARING→READY` skips production/QC | Spec may forbid skipping; verify | gate manual transitions per spec | P1 |

### 9. Quick order

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Quick order | admin selects channel + product, creates order | PASS | `admin/orders/quick`, `api/admin/orders/quick`, `QuickOrderForm.tsx` | This is an **internal** form, not a shareable link | — | — |
| Quick order | **generate secure link** | MISSING | no link/token model | — | `QuickOrderLink` + token | P1 |
| Quick order | **copy/send** | MISSING | — | — | share UI | P1 |
| Quick order | **track link state (sent/opened/order)** | MISSING | — | — | link state machine | P1 |
| Quick order | **customer prepared-product page** | MISSING | no `/q/[token]` route | — | customer page resolving live product data | P1 |
| Quick order | **login/register/guest at link** | MISSING | — | — | — | P1 |
| Quick order | **measurements (ready/custom) at link** | MISSING | — | — | — | P1 |
| Quick order | **accept terms / create order / payment** | PARTIAL | order creation pipeline exists (`createOrder`) and is reusable | — | reuse in link flow | P1 |
| Quick order | product data resolved from server, not link | MISSING | n/a (no link) | — | resolve live at open | P1 |

### 10. Tailor portal

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Tailor portal | **exists at all** | MISSING | `find src -ipath "*tailor*"` → only `admin/tailors` page + admin APIs | No portal, no tailor-facing route | Build tailor portal (separate auth) | P1 |
| Tailor portal | tailor authentication | MISSING | no tailor login | — | — | P1 |
| Tailor portal | admin-created accounts / temp password / forced change | MISSING | `Tailor` has no credentials | — | credentials + reset | P1 |
| Tailor portal | account disabling | MISSING | `Tailor.status` exists (ACTIVE/INACTIVE/ON_LEAVE) but no login to disable | — | — | P1 |
| Tailor portal | assigned work / item-level | PARTIAL | `ProductionTask` per tailor; `orderItemId?` | no tailor view | — | P1 |
| Tailor portal | measurements / ready-size values | PARTIAL | data exists on order/variant; not exposed to tailor | — | expose in portal | P1 |
| Tailor portal | customer notes (per spec) | MISSING | `Order.notes` is internal-ish; no per-item customer note surfaced | — | — | P2 |
| Tailor portal | tailor fee visibility | PARTIAL | `Tailor.rateBhd` exists; no per-task fee | — | show frozen fee | P1 |
| Tailor portal | no customer financial info | MISSING | n/a | — | ensure portal excludes prices | P1 |
| Tailor portal | accept/start/finish work | MISSING | workflow exists in admin only | — | tailor-side transitions | P1 |
| Tailor portal | settlement history / confirmation | MISSING | no portal | — | — | P1 |
| Tailor portal | notifications | MISSING | no tailor notifications | — | — | P1 |
| Tailor portal | multilingual / responsive | MISSING | n/a | — | — | P1 |
| Tailor portal | admin supervisor read-only | MISSING | n/a | — | — | P2 |

### 11. Quality control

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| QC | queue | PASS | `admin/production/qc`, `QcRecord` | — | — | — |
| QC | pass / reject | PASS | `api/admin/qc` → COMPLETED / REWORK | — | — | — |
| QC | **mandatory rejection reason** | MISSING | `notes` optional; schema has no required reason | — | require reason when FAILED/REWORK | P1 |
| QC | rejected item returns to production | PASS | task → `REWORK`; `REWORK→IN_PROGRESS` | — | — | — |
| QC | rejection visible to tailor | MISSING | no tailor portal | — | — | P1 |
| QC | event/audit records | PASS | `auditLog.create({action:'qc.run'})` | no `OrderEvent` on QC (task-level only) | optionally add order event | P3 |

### 12. Tailor fees & settlements

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Fees | **frozen at assignment** | MISSING | fee computed at settlement from current `rateBhd` | rate change alters historical payouts | snapshot `feeBhd` on task | P0 |
| Fees | delivered unpaid items eligible | MISSING | selection by completed tasks, not delivery/unpaid state | — | select by delivered + unsettled | P0 |
| Fees | one-tailor-per-settlement | PASS | `settlement.tailorId` single; creation takes one tailor | — | — | — |
| Fees | settlement item selection | MISSING | no items | — | `SettlementItem` | P0 |
| Fees | calculated total | PARTIAL | `gross = tasks × rate` | depends on unfrozen rate | — | P0 |
| Fees | **mandatory transfer proof** | MISSING | `TailorSettlement` has no proof field | — | `transferProofUrl` | P1 |
| Fees | transferred/pending/completed states | PARTIAL | `PENDING/APPROVED/PAID/CANCELLED` | no "transferred / pending confirmation / completed" + tailor confirmation | extend state machine | P1 |
| Fees | tailor confirmation | MISSING | — | — | — | P1 |
| Fees | settlement history / notifications | PARTIAL | admin list; no tailor side | — | — | P1 |
| Fees | **expense linkage** | MISSING | settlement does not create/link an `Expense` | tailor payout not reflected in expenses | create linked expense on pay | P0 (accounting) |
| Fees | no hidden fallback fee | PASS | `Tailor.rateBhd` default 0; no fallback constant | — | — | — |

### 13. Expenses

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Expenses | categories | PASS | `ExpenseCategory`, `admin/expense-categories` API | — | — | — |
| Expenses | **stable type separate from display name** | MISSING | name-only | — | add `code`/`type` | P2 |
| Expenses | creation | PASS | `api/admin/expenses` (POST) | — | — | — |
| Expenses | attachments | PASS | `attachmentUrl` + media upload | — | — | — |
| Expenses | **category-specific fields** | MISSING | flat schema | — | per-type fields | P3 |
| Expenses | approval / rejection | PASS | `EXPENSE_TRANSITIONS`, `finance.approve` check | — | — | — |
| Expenses | rejection reason | PARTIAL | `approvalNote` optional | not mandatory | require on reject | P1 |
| Expenses | **editing rejected / resubmission** | MISSING | `REJECTED` terminal; edit only in `DRAFT` | — | allow REJECTED→DRAFT | P1 |
| Expenses | **self-approval restriction** | MISSING | no check that approver ≠ submitter | — | block self-approval | P1 |
| Expenses | audit events | PASS | `expense.*` audit rows | — | — | — |
| Expenses | **system-generated tailor dues** | MISSING | no linkage | — | generate on settlement pay | P0 |

### 14. Payments & refunds

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Payments | records linked to orders | PASS | `Payment.orderId` | — | — | — |
| Payments | status | PASS | `PaymentStatus` + `PAYMENT_TRANSITIONS` | — | — | — |
| Payments | provider references | PASS | `providerRef` | — | — | — |
| Payments | **payment-link resend** | MISSING | `grep resend` → none | — | resend action | P2 |
| Payments | webhook verification | PASS | HMAC-SHA256 + `timingSafeEqual`; unsigned → 401 (`webhooks/tapp`) | — | — | — |
| Payments | amount verification | PASS | webhook rejects mismatch > 0.01 | — | — | — |
| Payments | idempotency | PASS | `applyPaymentResult` idempotent; no downgrade of settled | — | — | — |
| Payments | refunds | PASS | `createRefund`, over-refund guard | — | — | — |
| Payments | refund authorization permission | PASS | `orders.refund` on `api/admin/refunds` | — | — | — |
| Refunds | affects order / payment | PASS | order→REFUNDED, payment→REFUNDED/PARTIALLY | — | — | — |
| Refunds | **affects sales reporting** | PARTIAL | reports subtract `refund` sum for period | refund dated by `createdAt` (payment-date semantics may differ) | align date basis | P2 |
| Refunds | **affects membership** | MISSING | no membership | — | recompute | P1 |
| Refunds | **affects coupon usage/availability** | MISSING | `usedCount` never decremented on refund | — | release coupon on refund per policy | P2 |
| Refunds | affects audit history | PASS | `refund.create` audit | — | — | — |

### 15. Reports & accounting

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Reports | sales → payment date | CONFLICT | `reports/page.tsx` filters orders by `createdAt`, revenue by order status (not payment date) | Uses order-creation date, not payment date | base sales on `Payment.paidAt` | P0 (accounting) |
| Reports | expenses → expense date | PASS | `expense.expenseDate` filter | — | — | — |
| Reports | settlements → transfer date | PARTIAL | `TailorSettlement.paidAt`; verify report uses it | confirm | — | P1 |
| Reports | **tailor dues → delivery date** | MISSING | no tailor-dues report | — | add | P1 |
| Reports | sales / orders / expenses / products / customers | PASS | `reports/page.tsx` KPIs + charts | — | — | — |
| Reports | **tailor payments / tailor dues** | MISSING | not present | — | add reports | P1 |
| Reports | **profit** | PARTIAL | `netBhd = gross − refunds − expenses` | does not subtract cost of goods or tailor fees; **no double-count check possible** | add COGS + tailor fee lines | P1 |
| Reports | **tailor fees not double-counted** | UNVERIFIED | fees exist only inside settlements (no expense link) | cannot verify until linkage exists | verify after SettlementItem/expense link | P0 |
| Reports | comprehensive report | PARTIAL | single page | — | unify | P2 |
| Reports | **Excel/PDF export** | PARTIAL | ExcelJS export for **orders** (`api/admin/orders/export`) | No reports export, **no PDF** | add report exports + PDF | P2 |

### 16. Promotions

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Promotions | unique codes | PASS | `Coupon.code @unique` | — | — | — |
| Promotions | discount type/value | PASS | `DiscountType`, `valueBhd` | — | — | — |
| Promotions | **scope** | PARTIAL | `categoryIds/collectionIds/productIds` JSON exist but **`computeDiscountBhd` never applies scope** | scope stored but ignored at checkout | apply scope filtering | P1 |
| Promotions | **target membership** | MISSING | no membership | — | — | P1 |
| Promotions | start/end | PASS | `startsAt/expiresAt` enforced | — | — | — |
| Promotions | usage limit | PASS | `usageLimit`/`usedCount` enforced | — | — | — |
| Promotions | minimum order | PASS | `minOrderBhd` applied | — | — | — |
| Promotions | maximum discount | PASS | `maxDiscountBhd` applied | — | — | — |
| Promotions | active/inactive | PASS | `isActive` | — | — | — |
| Promotions | **usage history** | MISSING | no redemption rows | — | `CouponRedemption` | P1 |
| Promotions | **guest identity rules** | MISSING | `perCustomerLimit` unused; guests have no identity binding | — | define + enforce | P2 |
| Promotions | **stacking rules** | MISSING | single coupon only, no rule model | — | define stacking | P2 |
| Promotions | **discounted-product rules** | MISSING | scope ignored | — | — | P1 |

### 17. Employees & permissions

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Permissions | role-based enforcement server-side | PASS | `adminHandler`/`guardApi` on every admin route; `getRolePermissions` | — | — | — |
| Permissions | **employee-specific effective permissions** | MISSING | role-scoped only | — | per-user overrides | P1 |
| Permissions | permission matrix | PARTIAL | this document §6 | — | — | — |
| Permissions | **refund recording permission** | PARTIAL | `orders.refund` exists and is enforced | spec may want a distinct `refunds.record` | add if spec requires | P2 |
| Permissions | **tailor-settlement creation permission** | PASS | `settlements.manage` enforced | — | — | — |
| Permissions | every sensitive action enforced | PARTIAL | most routes gated; `api/admin/media` uses capability check; **verify each route** | some routes pass `undefined` permission and self-check | standardise | P1 |

### 18. Notifications

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Notifications | staff notifications | PARTIAL | `StaffNotification` model, list + mark-read (`admin/notifications`) | **No code creates them** | emit on events | P1 |
| Notifications | tailor notifications | MISSING | — | — | — | P1 |
| Notifications | unread counts / read state | PASS | `admin/nav.ts` unread count; `readAt` | — | — | — |
| Notifications | links to records | PASS | `href` field | — | — | — |
| Notifications | **notification rules (event/recipients/priority/enable)** | MISSING | no model | — | `NotificationRule` + UI | P2 |
| Notifications | **permission-based recipients** | MISSING | — | — | route by permission | P2 |
| Notifications | settlement notification | MISSING | — | — | emit | P1 |
| Notifications | **emitted events with no rule** | MISSING | all events currently unemitted | — | map events→rules | P1 |

### 19. Audit log

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Audit | append-only records on writes | PARTIAL | `writeAudit`/`auditLog.create` in orders, payments, refunds, expenses, settlements, QC, settings, media, quick order | **login/logout, product/category edits, transitions on some resources** may be missing | audit every sensitive write | P1 |
| Audit | login/logout | MISSING | `grep audit auth` → none | — | log auth events | P1 |
| Audit | create/edit/status/approvals/payments/refunds/shipping/delivery/assignment/QC/settlements/permissions/settings/categories/products | PARTIAL | covered for several; verify each | fill gaps | P1 |

### 20. Website design & settings

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Settings | branding / logo | PASS | `store.logoUrl`/`faviconUrl` consumed by `site.ts` | — | — | — |
| Settings | **colors / fonts / buttons / product cards / layout** | MISSING | `admin-dict.ts` has labels (`brandColors`) but no storefront consumption; `layout.tsx` hard-codes `themeColor:'#0A0A0A'` | UI controls may render without effect | wire or remove controls | P2 |
| Settings | banner / homepage sections | PASS | `HomeSection`, `admin/content/homepage` | — | — | — |
| Settings | menu / footer | PARTIAL | footer from settings/social; **top nav code-defined** | nav not admin-managed | add nav model | P2 |
| Settings | policy pages | PASS | `Page` CRUD | — | — | — |
| Settings | contact/social | PASS | `SocialLink`, store phone/whatsapp | — | — | — |
| Settings | SEO | PASS | `admin/seo`, `admin/seo/redirects`, `Redirect` | — | — | — |
| Settings | expense/product categories | PASS | `ExpenseCategory`, `Category` | — | — | — |
| Settings | payment gateways | PASS | `payment-config.ts`, `PaymentMethodManager` | — | — | — |
| Settings | shipping companies | PASS | `ShippingMethod` CRUD | — | — | — |
| Settings | **size guide** | MISSING | hard-coded | — | (see §2) | P1 |
| Settings | **controls that render but don't persist/affect storefront** | UNVERIFIED | cannot confirm without live run; `brandColors` labels exist without consumption → likely CONFLICT | verify each control | wire or remove | P2 |

### 21. Security

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Security | IDOR | PASS | order reads scoped by `customerId` (`account.ts`); admin routes permission-gated | — | — | — |
| Security | missing server-side permission checks | PARTIAL | `adminHandler` used widely; `media` uses capability check; audit each route | standardise | P1 |
| Security | **CSRF** | MISSING | `grep csrf` → none; cookie `sameSite:'lax'` | No explicit CSRF token for state-changing routes | add CSRF/origin checks | P1 |
| Security | XSS / unsafe HTML | CONFLICT | React escaping + `jsonLdHtml` for JSON-LD (fixed `b88078b`); **but** `src/app/[locale]/(storefront)/p/[slug]/page.tsx:66` renders admin `Page.bodyEn/Ar` via `dangerouslySetInnerHTML` with **no sanitisation** | Stored XSS via admin-authored policy/content pages (any `content.edit` holder can inject scripts) | Sanitise rich-text before render (DOMPurify / allow-list) | P1 |
| Security | SQL injection | PASS | Prisma parameterised queries throughout | — | — | — |
| Security | upload validation / file type / size / traversal | PASS | `media.ts`: allow-list MIME, 8 MB cap, server-generated UUID name, no SVG | — | — | — |
| Security | session handling / cookie settings | PASS | httpOnly, sameSite lax, secure in prod, signed JWT HS256, 30-day expiry | consider `__Host-` prefix | P2 |
| Security | brute-force / rate limiting | PARTIAL | `rate-limit.ts` used on signin/checkout/etc.; **in-process memory only** (resets on restart, not multi-instance) | acceptable single-instance; document | P2 |
| Security | password policy | PASS | `passwordSchema` min 8 | — | — | — |
| Security | **temporary passwords (tailor)** | MISSING | no tailor accounts | — | — | P1 |
| Security | secrets exposure | PASS | `.env` gitignored; masked secrets via `SECRET_SENTINEL` | — | — | — |
| Security | webhook validation / replay | PASS | signature + idempotent `applyPaymentResult`; settled payments not downgraded | no explicit nonce/timestamp anti-replay | optional | P2 |
| Security | payment amount manipulation | PASS | webhook amount check | — | — | — |
| Security | price/coupon/shipping manipulation | PASS | all resolved server-side | — | — | — |
| Security | inventory race conditions | PASS | guarded `updateMany` in transaction | — | — | — |
| Security | security headers / CSP | PASS | `next.config.mjs` CSP, HSTS, XFO, nosniff, COOP, Permissions-Policy | CSP uses `'unsafe-inline'` for scripts (nonce would be stronger) | P2 |

### 22. Production operations

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Ops | Prisma migrations | PARTIAL | baseline only | incremental history | P2 |
| Ops | environment validation | PARTIAL | `AUTH_SECRET` length check in `auth.ts`; `DATABASE_URL` required | no startup validation of all required envs | add boot check | P2 |
| Ops | production-safe seed | PARTIAL | `db:seed` upserts; uses default admin password | ensure prod seed doesn't create default creds | guard seed | P1 |
| Ops | **backups** | MISSING | not documented | — | document DB/uploads backup | P1 |
| Ops | uploads persistence | PASS | `MEDIA_UPLOAD_DIR` configurable; cPanel-persistent `public/uploads` | — | — | — |
| Ops | logging | PARTIAL | `console.error` on failures | no structured logging | add | P2 |
| Ops | monitoring | MISSING | none | — | uptime/error monitoring | P2 |
| Ops | health checks | PASS | `GET /api/health` (DB check, 503) | — | — | — |
| Ops | error handling | PASS | `adminHandler` never leaks stack traces | — | — | — |
| Ops | database indexes | PASS | indexes on FKs/status/dates across schema | — | — | — |
| Ops | deployment documentation | PASS | `DEPLOYMENT.md` (cPanel/Passenger, env, migrate) | — | — | — |

### 23. Test coverage

| Area | Requirement | Status | Evidence | Gap | Required implementation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Tests | unit (money, currency, validation, workflow, media, seo, payment-config, utils) | PASS | 8 files, 74 tests | — | — | — |
| Tests | integration / API | MISSING | none | — | add route tests | P1 |
| Tests | database | MISSING | none | — | add DB-backed tests | P1 |
| Tests | authorization | MISSING | none | — | add RBAC tests | P1 |
| Tests | payment / webhook | MISSING | none | — | add | P1 |
| Tests | inventory | MISSING | none | — | add | P1 |
| Tests | order lifecycle | PARTIAL | `workflow.test.ts` covers expense/production/settlement maps; `order-status.ts` untested | add order state-machine tests | P1 |
| Tests | quick order / tailor portal / QC / settlement / refund / reports | MISSING | none | — | add as features land | P1 |
| Tests | E2E | MISSING | none | — | add Playwright | P2 |

---

## 1. Current architecture map

```
src/
  middleware.ts            locale prefixing (att_locale / Accept-Language), admin SEO redirects,
                           stamps x-locale / x-pathname
  app/[locale]/
    layout.tsx             root metadata, themeColor hard-coded
    (storefront)/          home, shop, collections, product/[slug], search, cart, checkout,
                           checkout/success, wishlist, account/(protected)/*, p/[slug],
                           size-guide, about, contact
    admin/                 dashboard + ~35 ERP/CRM pages (orders, products, inventory,
                           payments, refunds, coupons, promotions, shipping, customers,
                           measurements, tailors, production, production/qc, settlements,
                           expenses, employees, roles, reports, seo, content, settings, audit)
  app/api/
    auth/{signin,signup,signout}      customer+staff session (JWT cookie)
    cart, checkout, coupon, currency, wishlist, search, contact, newsletter,
    redirects-map, health, webhooks/tapp, account
    admin/*                            ~45 guarded resource routes
  app/uploads/[...path]                serves persisted uploads
  components/                          account, admin, cart, checkout, contact, home,
                                       layout, product, providers, search, seo, shop, ui
  i18n/                                config, dictionaries (storefront), admin-dict
  lib/
    auth.ts            bcrypt + jose JWT session (att_session), getCurrentUser (cached)
    admin-auth.ts      getAdminUser, requireAdminPage, guardApi, adminHandler, auditAdmin
    permissions.ts     getRolePermissions(roleId)
    permission-defs.ts 46 permissions, DEFAULT_ROLE_PERMISSIONS (ADMIN/MANAGER/SUPPORT)
    order-status.ts    Order TRANSITIONS map + timeline + messages
    workflow.ts        EXPENSE / PRODUCTION / SETTLEMENT transitions, QC_ALLOWED_STATES
    orders.ts          resolveCartLines, createOrder (transaction), applyPaymentResult,
                       releaseOrderStock
    inventory.ts       adjustStock / setStockLevel (ledger-backed)
    money.ts           computeTotals / computeDiscountBhd (BHD accounting)
    payments/index.ts  COD / BANK_TRANSFER / BENEFIT / TAPP providers + webhook verify
    payment-config.ts  admin-configured method flags/labels/limits/instructions
    media.ts           local-disk uploads (MIME allow-list, 8 MB, UUID names)
    rate-limit.ts      in-process sliding window
    account.ts, catalog.ts, storefront.ts, site.ts, redirects.ts, seo.ts, currency*.ts
    admin/*            crud, resource, schemas, queries, orders, inventory, settings, nav
```

## 2. Current database map

42 models / 19 enums (`prisma/schema.prisma`), baseline migration
`prisma/migrations/0_init` with 42 `CREATE TABLE`.

- **Identity:** `User`, `Role`, `RolePermission`, `AuditLog`
- **Customer:** `Customer`, `Address`, `Measurement`, `WishlistItem`, `Cart`, `CartItem`, `Notification`
- **Catalogue:** `Category`, `Collection`, `Product`, `ProductCategory`, `ProductCollection`, `ProductMedia`, `ProductVariant`, `InventoryMovement`
- **Money:** `Currency`, `ExchangeRate`, `Coupon`, `Promotion`
- **Orders:** `Order`, `OrderItem`, `Payment`, `Refund`, `OrderEvent`
- **Content/SEO:** `SiteSetting`, `HomeSection`, `SocialLink`, `Page`, `ShippingMethod`, `NewsletterSubscriber`, `Redirect`
- **Atelier:** `Tailor`, `ProductionTask`, `QcRecord`, `TailorSettlement`
- **Finance ops:** `ExpenseCategory`, `Expense`, `StaffNotification`

**Missing vs spec:** MembershipTier, SizeGuide/SizeValue, ProductCut, SettlementItem,
QuickOrderLink, NotificationRule, CouponRedemption, tailor credentials/accounts,
per-user permission overrides, order-item measurement snapshot, frozen task fee.

## 3. Four-interface integration map

| Interface | Exists | Source of truth | Notes |
| --- | --- | --- | --- |
| Storefront | ✅ | DB (products, settings, pages, shipping, currencies) | Size guide is hard-coded → violates single-source rule |
| Administration | ✅ | DB | Broad ERP/CRM; several spec areas missing (membership, size guide, tailor accounts, settlement items) |
| Quick Order (customer page) | ❌ | — | Only an internal admin form exists (`admin/orders/quick`); no shareable link/token, no customer page, no link states |
| Tailor Portal | ❌ | — | No tailor-facing interface or authentication; only admin-side tailor management |

**Consequence:** two of the four interfaces required by the operating mechanism
are absent, and the shared-backend rule is breached by the hard-coded size guide.

## 4. Current order state machine

`src/lib/order-status.ts`

```
PENDING        → CONFIRMED, CANCELLED
CONFIRMED      → PREPARING, CANCELLED, REFUND_REQUESTED
PREPARING      → IN_PRODUCTION, READY, CANCELLED, REFUND_REQUESTED
IN_PRODUCTION  → QUALITY_CHECK, READY, CANCELLED, REFUND_REQUESTED
QUALITY_CHECK  → READY, IN_PRODUCTION, REFUND_REQUESTED
READY          → SHIPPED, CANCELLED, REFUND_REQUESTED
SHIPPED        → DELIVERED, REFUND_REQUESTED
DELIVERED      → REFUND_REQUESTED
REFUND_REQUESTED → REFUNDED, CONFIRMED, PREPARING, READY
CANCELLED      → (terminal)
REFUNDED       → (terminal)
```
Enforced server-side in `transitionOrder`. Payment confirmation auto-advances
`PENDING → CONFIRMED` (`updatePayment`, `applyPaymentResult`).

## 5. Required order state machine (per brief)

awaiting payment → paid → tailor assignment → tailor accepted → in production →
QC → (QC rejected → back to production) → QC passed → ready → shipping →
delivered → refunded/cancelled; **"late" is a computed condition**.

**Deltas from current:** no distinct *awaiting-payment* vs *paid* order state
(currently `PENDING`/`CONFIRMED` with payment tracked separately); no *tailor
accepted* state; QC rejected does not surface as an order state; no computed
"late" flag; manual transitions can skip production/QC.

## 6. Permission matrix

| Permission | ADMIN | MANAGER | SUPPORT | Enforced where |
| --- | --- | --- | --- | --- |
| orders.view / create / edit | ✅ | ✅ | ✅ | `adminHandler` |
| orders.cancel | ✅ | ✅ | ❌ | transition route (explicit) |
| orders.refund | ✅ | ✅ | ❌ | refunds route |
| products.view | ✅ | ✅ | ✅ | adminHandler |
| products.create/edit/delete | ✅ | ✅ | ❌ | adminHandler |
| inventory.view/adjust | ✅ | ✅ | view only | adminHandler |
| promotions.view/edit | ✅ | ✅ | ❌ | adminHandler |
| customers.view/edit | ✅ | ✅ | view only | adminHandler |
| measurements.view/edit | ✅ | ✅ | view only | adminHandler |
| production.view/manage | ✅ | ✅ | view only | adminHandler |
| qc.view/manage | ✅ | ✅ | view only | adminHandler |
| tailors.view/manage | ✅ | ✅ | ❌ | adminHandler |
| shipping.view/manage | ✅ | ✅ | view only | adminHandler |
| finance.view / finance.approve | ✅ | view only | ❌ | expense approve (explicit) |
| payments.view / verify | ✅ | ✅ | view only | adminHandler |
| expenses.view/manage | ✅ | ✅ | ❌ | adminHandler |
| settlements.view/manage | ✅ | ✅ | ❌ | adminHandler |
| reports.view/export | ✅ | ✅ | ❌ | adminHandler |
| content.view/edit | ✅ | ✅ | ❌ | adminHandler |
| seo.view/edit | ✅ | ✅ | ❌ | adminHandler |
| users.manage / roles.manage | ✅ | ❌ | ❌ | adminHandler |
| settings.view/edit | ✅ | ❌ | ❌ | adminHandler |
| notifications.view | ✅ | ✅ | ✅ | adminHandler |
| audit.view | ✅ | ❌ | ❌ | adminHandler |

**Missing:** employee-level overrides; any permission that distinguishes
"record a refund" from "refund orders" if the spec requires it; permission-
based notification routing.

## 7. Event / notification matrix

| Event | Emitted? | Staff notification | Customer notification | Audit |
| --- | --- | --- | --- | --- |
| Order created (storefront) | ✅ `OrderEvent` | ❌ | ❌ | ✅ `order.created` |
| Order created (quick) | ✅ | ❌ | ❌ | ✅ `order.quick_create` |
| Payment confirmed | ✅ `OrderEvent` | ❌ | ❌ | ✅ `payment.paid` |
| Payment failed/cancelled | ✅ `OrderEvent` | ❌ | ❌ | ❌ (no audit) |
| Order status transition | ✅ `OrderEvent` | ❌ | ❌ | ✅ `order.transition.*` |
| Refund created | ✅ `OrderEvent` | ❌ | ❌ | ✅ `refund.create` |
| QC run | ❌ | ❌ | ❌ | ✅ `qc.run` |
| Production task assigned | ❌ | ❌ | ❌ | ❌ |
| Settlement created/approved/paid | ❌ | ❌ | ❌ | ✅ `settlement.*` |
| Expense created/submitted/approved/rejected/paid | ❌ | ❌ | ❌ | ✅ `expense.*` |
| Login / logout | ❌ | ❌ | ❌ | ❌ |
| Settings / product / category edit | ❌ | ❌ | ❌ | partial |
| Media upload/delete | ❌ | ❌ | ❌ | ✅ `media.*` |

**No `Notification` or `StaffNotification` row is ever created by application
code** — both models are read-only in practice. This is the single largest
"renders but does nothing" gap.

## 8. Security findings

1. **No CSRF protection** on cookie-authenticated state-changing routes (P1).
   Mitigated partly by `sameSite:'lax'`; add origin/CSRF checks.
2. **No login/logout audit records** (P1).
3. **In-process rate limiter** — resets on restart, not shared across instances
   (P2; acceptable single-instance cPanel).
4. **CSP `script-src 'unsafe-inline'`** — required by Next inline bootstrap;
   a nonce would be stronger (P2).
5. **Stored XSS via content pages** (P1) — `p/[slug]/page.tsx:66` renders
   `Page.bodyEn/Ar` with `dangerouslySetInnerHTML` and no sanitisation; any
   `content.edit` holder can inject scripts. Sanitise rich text before render.
6. **No self-approval restriction** on expenses (P1).
7. **`api/admin/media` uses a capability check with `undefined` permission** —
   correct, but inconsistent with the rest; standardise (P2).
8. **Signed JWT session** good; consider `__Host-` cookie prefix (P3).
9. **Positive:** JSON-LD XSS fixed (`jsonLdHtml`), webhook HMAC + amount check,
   idempotent payments, upload MIME/size/traversal hardening, server-side price/
   coupon/shipping/inventory, no stack-trace leakage.

## 9. Production blockers

**P0**
1. No per-item measurement snapshot → size-guide/measurement edits corrupt past orders.
2. Tailor fee not frozen at assignment → rate changes alter historical payouts.
3. No settlement items / expense linkage → tailor payouts absent from accounting; double-count risk.
4. Sales report uses order-creation date, not payment date.
5. Quick Order *customer* interface and Tailor Portal do not exist.
6. Membership tiers absent (thresholds, paid-qualification, refund adjustment).

**P1** — employee-level permissions, coupon scope enforcement, coupon usage
history, order-item size snapshot, QC mandatory rejection reason, expense
reject/resubmit + self-approval block, password reset, customer notifications
emission, audit coverage (auth/product/category), CSRF, min-order enforcement,
reports (tailor dues/profit/export), nav/size-guide admin management.

## 10. Test coverage matrix

| Layer | Present | Missing |
| --- | --- | --- |
| Unit | money(12), validation(19), workflow(10), currency(6), media(5), seo(7), payment-config(6), utils(9) = **74** | `order-status` state machine |
| Integration/API | — | all admin + storefront routes |
| DB | — | order creation transaction, inventory ledger, coupon usage |
| Authorization | — | RBAC/IDOR |
| Payment/webhook | — | signature, amount mismatch, replay |
| E2E | — | full purchase, quick order, tailor portal |

## 11. Implementation roadmap

**Phase A — data integrity & accounting (P0)**
`OrderItem.measurementSnapshot` + `sizeSnapshot`; `ProductionTask.feeBhd` frozen
at assignment; `SettlementItem` + expense linkage; sales report on payment date;
membership tier model + derivation.

**Phase B — the two missing interfaces (P0/P1)**
`QuickOrderLink` + customer `/q/[token]` page (live product resolution, auth,
measurements, terms, order, payment); Tailor Portal with dedicated auth,
assignment/work views, fee visibility, accept/start/finish, settlement history,
notifications, EN/AR + responsive.

**Phase C — permissions, promotions, notifications (P1)**
Per-user permission overrides; coupon scope enforcement + `CouponRedemption` +
per-customer limits; `NotificationRule` + event emission for staff and customers;
login/logout and product/category audit.

**Phase D — admin-managed content & ops (P1/P2)**
DB-backed size guide + product cuts + per-cut measurement fields; nav model;
brand color/font settings wiring; QC rejection reason; expense reject/resubmit +
self-approval block; password reset; incremental migrations; backups/monitoring.

**Phase E — security & tests (P1/P2)**
CSRF/origin checks; rich-text sanitisation; auth audit; integration/DB/authz/
payment tests; Playwright E2E.

---

## Summary counts

| Metric | Count |
| --- | --- |
| PASS | 125 |
| PARTIAL | 39 |
| MISSING | 90 |
| CONFLICT | 6 |
| UNVERIFIED | 4 |
| **Total requirement rows** | **264** |
| P0 | 20 |
| P1 | 88 |
| P2 | 35 |
| P3 | 2 |

**Verification commands:** typecheck PASS · lint PASS · tests 74/74 PASS · build PASS.
**Database-backed verification:** NOT EXECUTED (no MySQL client binary available).

*This audit inspected code, schema, migrations, seed, routes, API handlers,
authentication, authorization, payments, webhooks, inventory, reports,
notifications, audit, uploads, i18n, SEO, tests and deployment configuration. No
files were modified, no schema or data changed, nothing was committed, pushed or
deployed.*
