# Attention Modest Fashion — Phase 1: Domain Foundation

Status: **COMPLETE** · Commit `1744957` · Branch `production-hardening-payments`

> This report was reconstructed after the fact from the Phase 1 commit, its
> migration, and the current source tree. It documents what shipped in Phase 1
> so the phase record is complete; the authoritative detail for any specific
> module is the code itself.

## Goal

Give the storefront a real atelier operations backbone — the domain layer that
the later commerce, production, and finance screens build on — without changing
storefront behaviour. Phase 1 is the schema + service foundation; Phase 2 adds
authentication and permissions on top.

## What was implemented

### Schema and migration

Migration `prisma/migrations/1_phase1_domain_foundation` (additive — no `DROP`,
new NOT NULL columns carry defaults; applied cleanly to a fresh MySQL database):

- **Tailor settlements**: `Settlement`, `SettlementItem`, and frozen tailoring
  fees on order items, so a fee is preserved even if the product's fee changes.
- **Production lifecycle**: production-task acceptance/QC timestamps and status
  values, QC attempts, and rejection reasons.
- **Finance**: expense categories and expenses, with an approval workflow.
- **Staff notifications** and **membership tiers**.
- **Quick-order links** and **measurement snapshots** (`cutId` + JSON values) so
  a customer's measurements are captured at order time, not read live.

### Domain modules (`src/lib`)

| Module | Responsibility |
|---|---|
| `sequences.ts` | Atomic, concurrency-safe human-readable numbers via native `INSERT … ON DUPLICATE KEY UPDATE`. Prisma `upsert` is not atomic and races on first insert; a concurrency test caught this, so it is avoided here. |
| `orders.ts` | Allocates order numbers through `nextSequence` **inside** the order transaction. |
| `settlements.ts` | Tailor settlement state machine (draft → approved → paid) and gross computation from completed tasks. |
| `tailor-fees.ts` | Resolves the tailoring fee for a task, with `TailorFeeError` when none is configured. |
| `assignments.ts` | Tailor scoping helpers (task/order visibility by `tailorId`). |
| `workflow.ts` | Generic transition validation (`canTransition`) used by production and order status changes. |
| `lateness.ts` / `bahrain-time.ts` | Due-date lateness in the business timezone (Asia/Bahrain), independent of server TZ. |
| `membership.ts` | Membership-tier resolution and benefits. |
| `quick-order.ts` | Quick-order link generation and redemption. |
| `expense-categories.ts` | Canonical expense category list. |
| `size-guide.ts` | Size-guide data and conversion helpers. |
| `order-measurements.ts` | Measurement snapshot capture/formatting. |
| `tokens.ts` | Opaque token generation for quick-order and reset flows. |

### Security

- `sanitize.ts` — an allow-list HTML sanitiser for admin-authored page and
  accordion bodies, closing a stored-XSS vector. Applied on the content page and
  the `Accordion` component.
- `account.ts` — self-service password change with server-side current-password
  verification, rate limiting, and audit logging.

### Admin routes wired to the new services

`qc`, `expenses`, `production`, and `settlements` API routes were rewired from
placeholder logic to the real domain services.

## Tests

122 tests passing across 17 files, including DB-backed integration tests for
sequence concurrency and the settlement state machine. Typecheck, lint, and the
production build all passed at the Phase 1 commit.

## Verification gates (at `1744957`)

| Gate | Result |
|---|---|
| Prisma migrate (fresh DB) | PASS |
| Typecheck | PASS |
| Lint | PASS |
| Unit + integration tests | 122 passing (17 files) |
| Production build | PASS |

## Follow-on

Phase 2 builds directly on this foundation: the `assignments.ts` scoping helpers
gain an explicit principal model, and the production/QC/settlement routes gain
permission enforcement rather than role-name checks.
