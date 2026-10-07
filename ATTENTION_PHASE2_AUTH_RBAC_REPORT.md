# Attention Modest Fashion — Phase 2: Authentication & RBAC Hardening

Status: **COMPLETE** · Branch `production-hardening-payments` · PR #1

## Goal

Move authorization from "role name + job title" to a canonical permission
registry with per-employee overrides, close privilege-escalation paths, add a
revocable session model, and give tailors a real, admin-issued login — all
without changing storefront behaviour.

## What was implemented

### 1. Canonical permission registry
- `src/lib/permission-defs.ts` is the single source of truth: every permission
  key, its admin group, EN/AR labels, and the default grant set per role
  (ADMIN / MANAGER / SUPPORT / CUSTOMER / TAILOR). `ALL_PERMISSIONS` and
  `PERMISSION_COUNT` are derived, never hand-counted.
- `isPermission()` is a runtime type guard used by every write path.

### 2. Effective-permission resolution
- `src/lib/permissions.ts#resolveEffectivePermissions` computes
  `(role grants ∪ ALLOW overrides) \ DENY overrides`.
- Role templates live in `RolePermission`; per-employee deltas in the new
  `UserPermission` table (`@@unique([userId, permission])`). Two employees with
  the same role can therefore hold different permissions, and a job title is
  never consulted for authorization.
- `getRolePermissions` / `getEffectivePermissions` are React-cached per request.

### 3. Revocable sessions
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

### 4. Privilege-escalation guards
- `isSuperAdmin` (an active ADMIN) and `forbiddenGrants` prevent a non-ADMIN
  from granting a permission they do not themselves hold.
- Applied to employee create/update, the atomic permissions endpoint, and
  `PATCH /api/admin/roles/[id]`.
- Self-lockout is refused: an admin cannot disable/demote themselves, strip
  their own `users.manage`, or remove their own last admin grant.
- **Last-effective-admin guard**: `countEffectiveAdmins()` counts active ADMIN
  users whose *resolved* permissions still include `users.manage`, so a DENY
  override cannot silently produce an unadministrable system. The permission
  endpoint refuses to strip the final such admin (`LAST_ADMIN`, 409), and the
  self-strip check (`SELF_LOCKOUT`, 409) applies to ADMIN too — removing your
  own ability to manage employees is never allowed, regardless of role.
- Employee `PATCH` was split: identity fields and permission overrides are
  separate operations; overrides are written atomically in one transaction.

### 5. Atomic permissions endpoint
- `PUT /api/admin/employees/[id]/permissions` replaces the whole override set in
  a transaction (wipe + insert), so a permission can be flipped ALLOW → DENY
  without a stale row surviving. Audited, then bumps the target's session
  version. UI: `src/components/admin/EmployeePermissions.tsx`.

### 6. Tailor authentication lifecycle
- `src/lib/tailor-auth.ts`: bcrypt-only `TailorCredential`, admin-issued
  one-time temporary password (`POST /api/admin/tailors/[id]/credentials`,
  returned once, never persisted), forced first-login change, persistent
  lockout (`failedLoginAttempts` / `lockedUntil`, survives restarts),
  enable/disable with session invalidation.
- Separate `att_tailor` cookie and session kind. Routes:
  `/api/tailor/auth/{signin,signout,password}`. Pages:
  `/[locale]/tailor/sign-in`, `/[locale]/tailor/password`. UI:
  `TailorSignInForm`, `TailorPasswordForm`, `TailorCredentials`.
- Supervisor viewing is read-only: `buildSupervisorContext` / `canActAsTailor`
  keep the staff identity and refuse tailor write actions — no impersonation.

### 7. Route-level enforcement fixes
- Expenses: approve requires `expenses.approve`; delete requires
  `expenses.delete` (previously both were `finance.approve`).
- Reports: net revenue is gated behind `reports.profits`.
- Promotions: create/edit now require `promotions.create` / `promotions.edit`
  instead of the broader `content.edit`.
- Admin nav and badge counts are filtered by the actor's effective permissions.

### 8. Build correctness
- Extracted the shared `productSchema` out of
  `src/app/api/admin/products/route.ts` into
  `src/lib/admin/product-schema.ts`. A route module may only export handlers and
  reserved fields, so the old inline export broke `next build`.

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
| `src/lib/tailor-auth.test.ts` | 11 | temp password, policy, username, supervisor |
| `src/lib/session-boundaries.test.ts` | 5 | `isStaff` boundaries, JWT round-trip, tamper |
| `src/lib/phase2-auth.integration.test.ts` | 10 | real DB: overrides, atomic replace, session bump, effective-admin counting, full tailor credential lifecycle |

The DB suite runs only when `RUN_DB_TESTS=1` (it creates and removes its own
rows). Without it the file is skipped, so CI without a database stays green.

## Verification gates

| Gate | Command | Result |
|---|---|---|
| Prisma schema | `npx prisma validate` / `migrate status` | up to date |
| Typecheck | `npm run typecheck` | PASS (exit 0) |
| Lint | `npm run lint` | PASS, no warnings |
| Unit tests | `npm test` | 21 files, 162 passed (with `RUN_DB_TESTS=1`) |
| Production build | `npm run build` | PASS (exit 0) |

## Deploy notes

- Run `npx prisma migrate deploy` before starting the new build.
- After deploy, existing staff sessions are still valid until their account is
  next modified; to force everyone to re-authenticate, increment
  `User.sessionVersion` for all staff (or rotate `AUTH_SECRET`).
- No new environment variables are required for this phase.

## Owner-configurable values still required

- Confirm the SUPPORT and MANAGER default permission sets match the intended
  job roles; they are editable in Admin → Settings → Roles & Permissions.
- Decide which staff may hold `reports.profits` and `expenses.delete`.
