# Attention Modest Fashion — Phase 6B Report

## Admin Production & Quality Control

- Branch: `production-hardening-payments`
- Base / HEAD before this work: `f9f231d1940cc7c279d690193c70a5239b3d2a3e`
- PR #1 remains **OPEN / DRAFT** (not merged, not deployed).
- Stack: Next.js 15 App Router, TypeScript, Prisma, MariaDB 11.8.6, bilingual EN/AR (RTL).
- All work is real and DB-backed. No mock data, no rebuilt functionality.

---

## 1. Scope

Phase 6A delivered the Tailor Portal and the assignment/production plumbing
(centralised `applyAssignmentSideEffects`, `production.assigned` notifications,
the settlement payout chain, tailor tasks/settlements/notifications). Phase 6B
completes the **administration** side of production and quality control and
closes the loop between QC and order fulfillment.

The mandate was to identify and implement only what was genuinely missing, build
on the existing domain architecture, introduce no mock data, and keep PR #1 open
and in draft.

---

## 2. Read-only audit — what already existed vs. the gaps

### Already implemented (NOT rebuilt)

| Area | Present before Phase 6B | Location |
| --- | --- | --- |
| Production task model + lifecycle | `ProductionTask`, `TaskStatus`, `PRODUCTION_TRANSITIONS` | `prisma/schema.prisma`, `src/lib/workflow.ts` |
| Per-piece assignment, frozen fee, order-item mirror, `production.assigned` notification | `assignTailorToItem`, `assignTailorToProductionTask`, `applyAssignmentSideEffects` | `src/lib/assignments.ts` |
| Production API: create task, reassign, status/priority/due | `POST /api/admin/production`, `PATCH /api/admin/production/[id]` | `src/app/api/admin/production/**` |
| Payment-before-production gate | `assertOrderSettledForProduction` | `src/lib/production-gate.ts` |
| QC record model + append-only attempt history | `QcRecord`, `QC_ALLOWED_STATES` | schema, `workflow.ts` |
| QC API (inline, one-off) | `POST /api/admin/qc` | `src/app/api/admin/qc/route.ts` |
| Tailor task transitions, QC visibility, tailor notifications | `tailor-work.ts`, `tailor-notifications.ts` | `src/lib/**` |
| Payout chain APPROVED → TRANSFERRED → PAID → CONFIRMED | `SETTLEMENT_TRANSITIONS`, `applySettlementAction` | `workflow.ts`, `settlements.ts` |
| Basic production + QC list pages | static tables | `src/app/[locale]/admin/production/**` |
| Permissions | `production.view/manage`, `qc.view/manage`, `orders.assign` | `src/lib/permission-defs.ts` |

### Gaps found (implemented in Phase 6B)

1. **QC logic was inline in the route** with no shared domain service, no
   stale-decision/conflict guard, and duplicate with the pattern used elsewhere.
2. **No fulfillment gate.** `READY`/`SHIPPED` could be reached while a piece was
   still in production or awaiting QC — QC could be bypassed entirely.
3. **No QC workflow UI.** The QC page was read-only: no inspection form, no
   pending-inspection queue, no rejection-reason capture, no history detail.
4. **Production page had no operational tooling**: no filters/search, no
   paid-and-unassigned work queue, no overdue/awaiting-QC KPIs, no tailor
   workload, no QC-outcome column, redundant dead status tabs.
5. **Reassignment of a completed piece was stuck** (`COMPLETED` had no edge to
   `ASSIGNED`), so a piece that changed hands after a QC pass could not re-enter
   the workflow.
6. **No Phase 6B test coverage.**

---

## 3. Implementation

### 3.1 QC decision service — `src/lib/qc.ts` (new)

Single decision point `runQcInspection`, used by `POST /api/admin/qc` (now a
thin wrapper). It:

- requires a rejection reason for any non-`PASSED` result (`REASON_REQUIRED`);
- only runs on `QC_ALLOWED_STATES`, and validates the transition edge;
- appends a new immutable `QcRecord` with the next `attempt` (history is never
  overwritten); PASS → task `COMPLETED`, otherwise → `REWORK`;
- refuses a **stale** decision when the client's observed `expectedStatus` no
  longer matches (`CONFLICT`) — two inspectors cannot race one piece;
- writes the audit record and notifies the tailor in the same transaction.

### 3.2 Fulfillment gate — `src/lib/fulfillment-gate.ts` (new)

`assertOrderReadyForFulfillment` / `incompleteProductionPieces` enforce that an
order reaches `READY` or `SHIPPED` only when every production piece is
QC-complete. A piece "requires production" when it has a task, is
`measurementKind = CUSTOM`, is made-to-order, or is cut-based; such a piece must
have **all** its tasks `COMPLETED`. Plain in-stock `READY` pieces are exempt, so
ordinary stock fulfillment still works. Wired into `transitionOrder`
(`src/lib/admin/orders.ts`) alongside the existing payment gate.

### 3.3 Reopen-on-reassignment — `src/lib/assignments.ts`

`assignTailorToProductionTask` now reopens a `COMPLETED` task to `ASSIGNED`
(clearing `completedAt`/`acceptedAt`/`startedAt`) when it is handed to a named
tailor, so a re-worked piece re-enters the workflow. All other illegal edges are
still refused.

### 3.4 Admin production query layer — `src/lib/admin/production.ts` (new)

`listProductionTasks` (filter/search/scope), `productionCounts` (paid-unassigned,
unassigned, in-progress, awaiting-QC, rework, overdue, completed) and
`tailorWorkload` (open pieces vs. capacity). Keeps the page a thin renderer and
the queries testable.

### 3.5 Admin production page — `src/app/[locale]/admin/production/page.tsx`

URL-driven search/status/priority/tailor filters, scope chips (all /
paid-unassigned / unassigned / assigned / overdue), seven KPIs, a QC-outcome
column, and a tailor-workload panel. Assignment rows flow through
`ProductionTaskActions` → the existing API; the page never writes task state.

### 3.6 Admin QC page + form

`src/app/[locale]/admin/production/qc/page.tsx` now has a **pending-inspection
queue** and an **inspection history** table. `QcInspectionForm`
(`src/components/admin/QcInspectionForm.tsx`) captures the checklist, a
mandatory-on-fail rejection reason and notes, posts the observed `taskStatus` as
`expectedStatus`, and refreshes.

### 3.7 Component update — `ProductionTaskActions.tsx`

Accepts `taskStatus`, hides the editor for locked (`COMPLETED`/`CANCELLED`)
tasks so the UI matches the API's rules.

### 3.8 E2E fixture — `scripts/e2e-production-qc-setup.ts` (new)

Disposable `E2E6B`-marked paid order + submitted-for-QC task, cleaned by the
existing `e2e-teardown.ts` (`E2E_MARK=E2E6B`).

---

## 4. Acceptance verification (final evidence)

Branch `production-hardening-payments`, HEAD `f9f231d1940cc7c279d690193c70a5239b3d2a3e`
(working tree carries the Phase 6B changes, uncommitted). MariaDB 11.8.6 on
`127.0.0.1:3306`, database `attention_phase6a`, seeded, migrations applied.
New tests: `src/lib/phase6b-production-qc.integration.test.ts` (15 tests,
DB-backed, `RUN_DB_TESTS=1`).

### 4.1 QC FAIL → REWORK → tailor resubmission → QC PASS (two immutable attempts)

`src/lib/phase6b-production-qc.integration.test.ts > acceptance: full QC fail →
rework → resubmit → pass loop`:

- `runQcInspection(REWORK_REQUIRED, reason="Uneven hem")` → **attempt 1**,
  `status = REWORK_REQUIRED`, `rejectionReason = "Uneven hem"`.
- Task status becomes `REWORK`; tailor notification `qc.failed` body contains
  `Uneven hem`.
- Resubmit (`SUBMITTED_FOR_QC`) → `runQcInspection(PASSED)` → **attempt 2**,
  task `COMPLETED`.
- `qcRecord` rows for the task are exactly `[1, 2]`; attempt 1 keeps
  `REWORK_REQUIRED` + reason, attempt 2 is `PASSED` with a null reason. Nothing
  overwritten.
- `incompleteProductionPieces(order)` → 0 (piece is QC-complete).

### 4.2 Concurrent QC decisions — only one wins, the other fails safely

- Integration (`acceptance: concurrent QC decisions on one task`): two
  `runQcInspection` calls fired with `Promise.allSettled` → **1 fulfilled, 1
  rejected**; the rejection is a `QcError`; exactly **1** `QcRecord` row exists.
- Live HTTP (two `curl` requests in parallel against `next start`):
  - `{"ok":true,"id":"cmuzrphq3000bya0zed3tnmdp","attempt":1}` → **HTTP 200**
  - `{"error":"This piece has already been inspected or moved on","code":"CONFLICT"}`
    → **HTTP 409**

  Root cause handled: under InnoDB `REPEATABLE READ` the losing write raises
  MariaDB error 1020 ("Record has changed since last read"), which the service
  now translates to a `CONFLICT` `QcError` via `isConcurrentWriteConflict`.
  A compare-and-swap on the observed status (`updateMany where status = <read>`)
  is what makes the outcome deterministic.

### 4.3 Mixed READY + CUSTOM order — shipping blocked until the CUSTOM piece passes QC

`acceptance: mixed READY + CUSTOM order`: an order with one `measurementKind =
READY` item and one `CUSTOM` item (task `SUBMITTED_FOR_QC`).

- `incompleteProductionPieces(order)` → **1**, and it is the **CUSTOM** item
  (the READY item is exempt).
- `transitionOrder(→ SHIPPED)` → rejected with `/still in production/i`.
- After `runQcInspection(PASSED)` on the custom piece →
  `incompleteProductionPieces` → 0 and `transitionOrder(→ SHIPPED)` **resolves**.

### 4.4 Admin QC permission checks and audit records

Live HTTP against `next start`:

| Caller | Request | Result |
| --- | --- | --- |
| no session | `POST /api/admin/qc` | **401** `{"error":"Unauthorized"}` |
| `SUPPORT` (`qc.view` only) | `POST /api/admin/qc` | **403** `{"error":"Forbidden"}` |
| `ADMIN` (`qc.manage`) | PASS | **200** `{"ok":true,"id":"…","attempt":1}` |
| `ADMIN` | non-PASSED without reason | **422** "A rejection reason is required…" |

`qc.manage` is the route gate (`adminHandler('qc.manage', …)`); `SUPPORT` holds
`qc.view` only, so it can read the QC screens but cannot decide.

Audit (`auditLog` for the accepted decision):

```json
{
  "action": "qc.run", "entity": "QcRecord",
  "userId": "<admin id>",
  "metadata": { "status": "PASSED", "attempt": 1,
                "from": "SUBMITTED_FOR_QC", "to": "COMPLETED",
                "orderItemId": "…" }
}
```

The integration suite also pins that a refused (no-reason) decision writes
**no** audit row (`auditLog.count(...) === 0`).

### 4.5 Toolchain

| Check | Command | Result |
| --- | --- | --- |
| Prisma schema | `npx prisma validate` | `The schema at prisma/schema.prisma is valid 🚀` |
| Migrations | `npx prisma migrate deploy` | all applied (through `9_phase6a_tailor_portal`) |
| TypeScript | `tsc --noEmit` | **0 errors** |
| Lint | `next lint` | **no warnings or errors** |
| DB tests | `RUN_DB_TESTS=1 npx vitest run` | **307 / 307 passed** (32 files) |
| Production build | `next build` | **success** |

Test count history: 292 (Phase 6A baseline) → 302 (first Phase 6B cut) → **307**
(15 Phase 6B tests, including the acceptance cases).

### 4.6 Earlier live UI checks (still valid)

- `/en/admin/production` rendered the E2E6B task, the paid-unassigned KPI and the
  tailor-workload panel.
- `/en/admin/production/qc` and `/ar/admin/production/qc` rendered the
  pending-inspection queue and "Inspect" control; Arabic strings confirmed (RTL).
- Order → `READY` with a piece awaiting QC → **409 `PRODUCTION_INCOMPLETE`**;
  after a QC pass the same transition succeeded.
- `?scope=paid_unassigned` filter responded 200.

Teardown removed every fixture; post-run counts verified **0** for E2E6B orders,
tasks, tailors, users and **0** `qcRecord` rows. No seeded/production rows were
touched.

---

## 5. Files

New:
- `src/lib/qc.ts` (incl. compare-and-swap + `isConcurrentWriteConflict` → `CONFLICT`)
- `src/lib/fulfillment-gate.ts`
- `src/lib/admin/production.ts`
- `src/components/admin/QcInspectionForm.tsx`
- `src/lib/phase6b-production-qc.integration.test.ts`
- `scripts/e2e-production-qc-setup.ts`
- `ATTENTION_PHASE6B_PRODUCTION_QC_REPORT.md`

Modified:
- `src/app/[locale]/admin/production/page.tsx`
- `src/app/[locale]/admin/production/qc/page.tsx`
- `src/app/api/admin/qc/route.ts`
- `src/components/admin/ProductionTaskActions.tsx`
- `src/lib/admin/orders.ts`
- `src/lib/assignments.ts`
- `AGENTS.md`

No schema migration was required — all models and enums already existed.

---

## 6. Status

- Working tree contains the Phase 6B changes above; **nothing committed, pushed,
  merged or deployed** — awaiting approval.
- PR #1 stays **OPEN / DRAFT**.
