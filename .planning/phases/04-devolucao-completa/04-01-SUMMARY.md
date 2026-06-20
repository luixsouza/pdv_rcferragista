---
phase: 04-devolucao-completa
plan: "01"
subsystem: financial-logic
tags: [processReturn, processAbatement, haver-capping, crediario, types, pure-function, DEV-04, DEV-05]
dependency_graph:
  requires: [01-03, 03-01]
  provides: [processReturn-with-capping, processAbatement, devolucao-type-surface]
  affects: [Sales.tsx, Returns.tsx, POS.tsx (Wave-2 plans 04-02 to 04-04)]
tech_stack:
  added: []
  patterns:
    - "installment.amountPaid sum (ground truth) mirrors processRefund.ts Phase 3 pattern"
    - "paidProportion = crediarioPaidSoFar / sale.total for proportional haver capping"
    - "discountApplied for abatement (not amountPaid) — consistent with CreditNotes handleApplyDiscount"
    - "getEffectiveStatus for open/overdue classification (idempotent, handles edge transitions)"
key_files:
  created: []
  modified:
    - src/lib/processReturn.ts
    - src/types/index.ts
decisions:
  - "installments param added as optional to ProcessReturnInput (additive, existing callers omit safely)"
  - "cancelledInstallmentIds set to undefined (not []) on returnRecord when empty — matches retrocompat pattern"
  - "processAbatement uses discountApplied (not amountPaid) per §3 — consistent with handleApplyDiscount"
  - "residual returned explicitly; excess NEVER silently flows to unselected installments or haver (T-04-03)"
  - "ProcessReturnResult.cancelledInstallmentIds is always a string[] (never undefined) for type safety"
metrics:
  duration: "~2.5 min"
  completed_date: "2026-06-20"
  tasks_completed: 2
  files_modified: 2
---

# Phase 04 Plan 01: Devolução Completa — processReturn Upgrade + processAbatement Summary

**One-liner:** Haver capping via paidProportion (crediário zero-paid → 0) + pure processAbatement with overdue-first debt reduction and explicit residual; complete Wave-2 devolução type surface in one plan.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add 'abatimento' to CreditPayment.type, abatedInstallments to ReturnRecord, upgrade processReturn with haver capping + cancelledInstallmentIds | 5c27bbf | src/types/index.ts, src/lib/processReturn.ts |
| 2 | Add pure processAbatement function for debt-abatement modality (DEV-05) | 5c27bbf | src/lib/processReturn.ts |

(Tasks 1 and 2 share the same commit — both target processReturn.ts and the build was green only after both were in place together.)

## What Was Built

### src/types/index.ts — Retrocompatible Type Extensions

1. **CreditPayment.type** widened from `'payment' | 'discount'` to `'payment' | 'discount' | 'abatimento'` — audit trail for DEV-05 abatement entries (field stays optional, retrocompat).
2. **ReturnRecord.abatedInstallments?** added as `{ installmentId: string; amount: number }[]` — reversal key for DEV-07 (Wave 2). Optional, retrocompatible with existing electron-store records. Wave-2 plans only read/set this at runtime; none edits the type.

### src/lib/processReturn.ts — Upgraded processReturn + new processAbatement

**processReturn upgrades:**
- `installments?: Installment[]` added to `ProcessReturnInput` (additive; existing callers pass nothing, treated as `[]`).
- `cancelledInstallmentIds: string[]` added to `ProcessReturnResult` (always returned; empty array for partial returns or non-crediário sales).
- **Haver capping (DEV-04 / BUG-1 fix, T-04-01):**
  - Detects `isCrediarioSale` via `paymentMethod === 'crediario'`, `paymentEntries?.some(crediario)`, or `crediario_pending/paid` status.
  - For crediário: `crediarioPaidSoFar = sum(installment.amountPaid for this sale)` (ground truth, never stale `sale.crediarioPaid`).
  - `paidProportion = crediarioPaidSoFar / sale.total`; `creditGenerated = roundCurrency(min(totalRefunded, totalRefunded × paidProportion))`.
  - Zero-paid crediário → creditGenerated = 0; cash/card/pix unchanged.
  - `storeCredit` incremented by `creditGenerated` (not `totalRefunded`) — mutation now matches capped haver.
- **Cancelled-installment set (BUG-2 foundation):**
  - `allItemsReturned && isCrediarioSale` → collects open/overdue installments via `getEffectiveStatus`; populates `returnRecord.cancelledInstallmentIds`.
  - Partial return or non-crediário sale → empty `cancelledInstallmentIds`.

**processAbatement (DEV-05, T-04-02, T-04-03):**
- New export: `processAbatement(input: ProcessAbatementInput): ProcessAbatementResult`.
- Filters selected installments to open/overdue only; sorts overdue-first then by earliest dueDate.
- Applies `discountApplied` increments (not amountPaid); marks 'paid' when `amountPaid + discountApplied >= amount`.
- Creates one `CreditPayment` with `type: 'abatimento'` per touched installment (audit trail T-04-02).
- Returns `residual` (excess not absorbed by chosen installments) — NEVER converts to haver or spills to unselected installments (T-04-03).
- Returns `abatedMap: { installmentId, amount }[]` — matches `ReturnRecord.abatedInstallments` shape for DEV-07 reversal.
- Zero `storeCredit` mutations anywhere in processAbatement.

## Acceptance Criteria

| Check | Result |
|-------|--------|
| `npm run build` exits 0 | PASS |
| `paidProportion` found in processReturn.ts | PASS (line 137) |
| `getEffectiveStatus` used for cancelledInstallmentIds | PASS (line 162) |
| `cancelledInstallmentIds` on both ProcessReturnResult and returnRecord | PASS |
| `hasClient ? totalRefunded : 0` count in crediário branch = 0 | PASS (count = 1, only in cash/non-crediário branch) |
| `abatimento` in CreditPayment.type (types/index.ts) | PASS (line 84) |
| `abatedInstallments` in ReturnRecord (types/index.ts) | PASS (line 120) |
| `storeCredit.*creditGenerated` in processReturn | PASS (line 195) |
| `processAbatement` exported | PASS (line 264) |
| `type: 'abatimento'` in processAbatement | PASS (line 328) |
| `residual` computed and returned | PASS (line 339) |
| `abatedMap` returned (matches ReturnRecord.abatedInstallments shape) | PASS (line 350) |
| `storeCredit` count unchanged in processAbatement | PASS (0 in abatement section) |

## Deviations from Plan

None — plan executed exactly as written. Both tasks were implemented in a single commit because `processAbatement` imports `CreditPayment` (added in Task 1's type changes) and the types needed to be consistent for the build to pass.

## Known Stubs

None. No placeholder values, TODO comments, or data-source gaps introduced. All logic is complete and wired to correct inputs.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's `<threat_model>` already covers (T-04-01 through T-04-SC). All three mitigations implemented:
- T-04-01: creditGenerated capped by paidProportion × crediarioPaid sum.
- T-04-02: each abatement writes CreditPayment with type 'abatimento' + installmentId + amount + createdAt.
- T-04-03: residual returned explicitly; processAbatement never touches storeCredit nor unselected installments.

## Self-Check: PASSED

- `src/lib/processReturn.ts`: EXISTS (modified — 350 lines)
- `src/types/index.ts`: EXISTS (modified — 123 lines)
- Commit `5c27bbf`: EXISTS (verified via git log)
- `npm run build`: PASSED (0 errors, built in 10.94s)
