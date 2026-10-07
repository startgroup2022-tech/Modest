# Attention Modest Fashion — Phase 2: Authentication, Employee Permissions & Tailor Account Auth

Status: **COMPLETE** · Branch `production-hardening-payments` · PR #1
Head at authoring: `817f33c` · Phase 2 commits: `733e0b0`, `817f33c`

> This is the authoritative Phase 2 deliverable report. It covers the
> employee-specific permission model, the enforcement review, and the tailor
> account lifecycle. `ATTENTION_PHASE2_AUTH_RBAC_REPORT.md` is retained as the
> design-detail companion written during implementation.

## Goal

Move authorization from "role name + job title" to a canonical permission
registry with per-employee overrides, close privilege-escalation and data-
disclosure paths, add a revocable session model, and give tailors a real,
admin-issued login — without changing storefront behaviour.

## 1. Employee-specific permissions

- `src/lib/permission-defs.ts` is the single source of truth: every permission
  key, its admin group, EN/AR labels, and the default grant set per role
  (ADMIN / MANAGER / SUPPORT / CUSTOMER / TAILOR). `ALL_PERMISSIONS`,
  `PERMISSION_GROUPS`, and `PERMISSION_COUNT` are derived, never hand-counted.
  `isPermission()` is a runtime type guard used by every write path.
- `src/lib/permissions.ts#resolveEffectivePermissions` computes
  `(role grants ∪ ALLOW overrides) \ DENY overrides`. Role templates live in
  `RolePermission`; per-employee deltas live in `UserPermission`
  (`@@unique([userId, permission])`). Two employees with the same role and job
  title can therefore hold different permissions, and a job title is never
  consulted for authorization.
- `PUT /api/admin/employees/[id]/permissions` replaces the whole override set in
  one transaction (wipe + insert), so a permission can flip ALLOW → DENY without
  a stale row surviving. Audited, then bumps the target's session version.
  UI: `src/components/admin/EmployeePermissions.tsx`.

## 2. Enforcement review (this session)

An authorization model is only real where a route actually consults it. A full
audit of the admin surface found every route guarded by `adminHandler`/`guardApi`
and every admin page using `requireAdminPage`, but four enforcement gaps remained
where the permission was declared and rendered yet not enforced server-side.
All four are now fixed.

| # | Gap | Fix |
|---|---|---|
| 1 | **Dashboard data disclosure.** `getDashboardData` loaded and returned sales totals, customer names, refunds, and expenses regardless of the viewer's permissions; the sidebar hid sections but the data still reached the page. | `getDashboardData(locale, permissions)` now computes each block only when the viewer holds the governing permission (`reports.view`, `reports.profits`, `orders.view`, `payments.view`, `production.view`, `qc.view`, `inventory.view`, `customers.view`, `orders.refund`, `finance.view`). The dashboard page renders each KPI/panel under the same check. |
| 2 | **Product publish/archive not gated.** A user with `products.edit` could set any status, including publishing. | New `productStatusChangeRequiresApproval(current, next)`; `POST`/`PATCH /api/admin/products*` require `products.approve` for any status change (creating in a non-DRAFT state counts). Keeping the current status needs only `products.edit`. `ProductForm` disables the status control and explains why when the actor lacks approval. |
| 3 | **Tailor assignment not gated.** `production.manage` alone could assign a tailor. | `POST /api/admin/production` and `PATCH /api/admin/production/[id]` require `orders.assign` when a tailor is named/reassigned (checked before any order lookup, so the refusal is not a probe for record existence). |
| 4 | **Last-admin guard counted role name only.** `PATCH /api/admin/employees/[id]` used `prisma.user.count({ role: { name: 'ADMIN' } })`, so an ADMIN whose `users.manage` was stripped by a DENY override still counted as coverage. | Switched to `countEffectiveAdmins(id)`, matching the permissions endpoint, so coverage measures the resolved set. |

### Test-isolation defect also fixed

`phase2-auth.integration.test.ts` added `orders.view` / `orders.refund` to the
seeded SUPPORT role and, in `afterAll`, deleted exactly those two keys. On a
database where SUPPORT is seeded **with** `orders.view` (the real default), that
deleted a legitimate permission and never restored it — corrupting the live role
for every later run. The suite now snapshots the role's permission set in
`beforeAll` and restores the exact prior set in `afterAll`. The seeded roles were
re-seeded to their canonical defaults and verified (ADMIN 57 / MANAGER 50 /
SUPPORT 14 / CUSTOMER 0 / TAILOR 0).

## 3. Privilege-escalation and self-protection

- `isSuperAdmin` (an active ADMIN) and `forbiddenGrants` prevent a non-ADMIN from
  granting a permission they do not themselves hold. Applied to employee
  create/update, the atomic permissions endpoint, and role updates.
- Self-lockout is refused: an admin cannot disable/demote themselves, change
  their own role, or strip their own `users.manage` (`SELF_LOCKOUT`, 409).
- **Last-effective-admin guard**: `countEffectiveAdmins()` counts active ADMIN
  users whose *resolved* permissions still include `users.manage`, so a DENY
  override cannot silently produce an unadministrable system (`LAST_ADMIN`, 409).

## 4. Revocable sessions

- `User.sessionVersion` is embedded in the `att_session` JWT. `bumpSessionVersion`
  increments it on role change, status change, password reset, and permission
  edits; `getCurrentUser` rejects any token whose embedded version is stale, so
  revocation is immediate rather than up to 30 days.
- Session `kind` (`staff` | `customer` | `tailor`) is authoritative. `isStaff`
  refuses any non-`staff` kind, so a tailor or customer cookie can never satisfy
  an admin guard even if the role string were mis-set.
- `POST /api/auth/signin` refuses `TAILOR`-role users (they use the Tailor
  Portal) and mints `staff` for ADMIN/MANAGER/SUPPORT regardless of whether the
  user also has a customer profile.

## 5. Tailor account authentication

- `src/lib/tailor-auth.ts`: bcrypt-only `TailorCredential`, admin-issued one-time
  temporary password (`POST /api/admin/tailors/[id]/credentials`, returned once,
  never persisted), forced first-login change, persistent lockout
  (`failedLoginAttempts` / `lockedUntil`, survives restarts), enable/disable with
  session invalidation.
- Separate `att_tailor` cookie and session kind. Routes:
  `/api/tailor/auth/{signin,signout,password}`. Pages:
  `/[locale]/tailor/sign-in`, `/[locale]/tailor/password`. UI:
  `TailorSignInForm`, `TailorPasswordForm`, `TailorCredentials`.
- First-login password change re-mints the session cookie, so a tailor is not
  silently logged out after changing their temporary password (QA fix `817f33c`).
- Supervisor viewing is read-only: `buildSupervisorContext` / `canActAsTailor`
  keep the staff identity and refuse tailor write actions — no impersonation.
- **Work scope** (added this session): `resolveReadableTailorId`,
  `canWriteTailorWork`, and `canReadTailorTask` are the single place a future
  Tailor Portal resolves "which tailor's data may this request touch". A tailor
  may read and write only their own work; a supervisor may read the tailor they
  view but never write; an unassigned task is refused.

## 6. Route-level enforcement fixes

- Expenses: approve requires `expenses.approve`; delete requires
  `expenses.delete`.
- Reports: net revenue is gated behind `reports.profits`.
- Promotions: create/edit require `promotions.create` / `promotions.edit`.
- Admin nav and badge counts are filtered by the actor's effective permissions.

## Schema changes

Migration `prisma/migrations/20261007025107_phase2_auth_permissions` (additive):

- `User.sessionVersion Int @default(0)`
- `TailorCredential.sessionVersion Int @default(0)`,
  `failedLoginAttempts Int @default(0)`, `lockedUntil DateTime?`
- New `UserPermission` (`permission`, `effect: ALLOW|DENY`,
  unique on `[userId, permission]`, cascade delete)

## Tests

| Suite | Tests | Scope |
|---|---|---|
| `src/lib/permissions.test.ts` | 14 | resolution, overrides, guards |
| `src/lib/tailor-auth.test.ts` | 15 | temp password, policy, username, supervisor, **work scope** |
| `src/lib/session-boundaries.test.ts` | 5 | `isStaff` boundaries, JWT round-trip, tamper |
| `src/lib/authorization-matrix.test.ts` | 12 | **same-title/different-permission, deny-by-default, escalation guard, product approval gate, operating-spec coverage, stale session version** |
| `src/lib/role-boundaries.test.ts` | 6 | **customer/tailor cannot reach admin; role + kind, never kind alone** |
| `src/lib/phase2-auth.integration.test.ts` | 11 | real DB: overrides, atomic replace, session bump, effective-admin counting, disabled account, full tailor credential lifecycle |

The DB suite runs only when `RUN_DB_TESTS=1` (it creates and removes its own rows
and now restores the seeded role exactly). Without it the file is skipped, so CI
without a database stays green.

## Verification gates

| Gate | Command | Result |
|---|---|---|
| Prisma schema | `npx prisma validate` | PASS |
| Typecheck | `npm run typecheck` | PASS (exit 0) |
| Lint | `npm run lint` | PASS, no warnings |
| Unit + integration tests | `RUN_DB_TESTS=1 npm test` | **23 files, 185 passed** |
| Production build | `npm run build` | PASS (exit 0) |

## Live authorization smoke test

Against a production build (`next start`, port 3210) with real sessions:

| Actor | Action | Expected | Actual |
|---|---|---|---|
| SUPPORT (Sales Employee) | `POST /api/admin/refunds` | 403 | 403 |
| SUPPORT | `POST /api/admin/employees` | 403 | 403 |
| SUPPORT | `GET /api/admin/orders/export` | 403 | 403 |
| SUPPORT | page `/en/admin/orders`, `/products`, `/customers` | allowed | 200 |
| SUPPORT | page `/en/admin/refunds`, `/settings`, `/employees` | denied | redirect → `/en/admin?denied=…` |
| SUPPORT + per-employee `products.edit` | PATCH product, same status | 200 | 200 |
| SUPPORT + `products.edit` (no approve) | PATCH product, status change | 403 `APPROVAL_REQUIRED` | 403 `APPROVAL_REQUIRED` |
| ADMIN | PATCH product, status change | 200 | 200 |
| employee + `production.manage`, no `orders.assign` | create task naming a tailor | 403 `ASSIGN_FORBIDDEN` | 403 `ASSIGN_FORBIDDEN` |
| ADMIN | DENY own `users.manage` | 409 `SELF_LOCKOUT` | 409 `SELF_LOCKOUT` |
| employee with `users.manage` | grant self `settings.edit` | 403 `PRIVILEGE_ESCALATION` | 403 `PRIVILEGE_ESCALATION` |
| employee with `users.manage` | grant self a held permission | 200 | 200 |

All smoke-test employees were removed afterwards; the seeded roles were verified
intact.

## Deploy notes

- Run `npx prisma migrate deploy` before starting the new build.
- After deploy, existing staff sessions remain valid until their account is next
  modified; to force everyone to re-authenticate, increment `User.sessionVersion`
  for all staff (or rotate `AUTH_SECRET`).
- No new environment variables are required for this phase.

## Owner-configurable values still required

- Confirm the SUPPORT and MANAGER default permission sets match the intended job
  roles; they are editable in Admin → Settings → Roles & Permissions.
- Decide which staff may hold `reports.profits`, `expenses.delete`, and
  `products.approve` — the last is the publish/archive authority.
- Decide which staff may hold `orders.assign` (tailor assignment).
