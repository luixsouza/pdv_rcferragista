---
phase: 04-devolucao-completa
plan: "04"
subsystem: sales-ui
tags: [Sales.tsx, haver-capping, installment-cancel, crediario_pending, DEV-04, DEV-06]
dependency_graph:
  requires: [04-01]
  provides: [sales-return-path-capping-aware, sales-installment-cancel-on-full-return]
  affects: [src/pages/Sales.tsx]
tech_stack:
  added: []
  patterns:
    - "installments passed to processReturn (DEV-04 capping) — mirrors Returns.tsx pattern"
    - "cancelledInstallmentIds applied via setInstallments map (idempotent, mirrors handleRefund pattern)"
    - "cancelledInstallmentIds persisted on sale record for DEV-07 reversal parity"
    - "toast reports returnRecord.creditGenerated (capped) not raw totalRefunded"
    - "canReturn left intact — crediario_pending sales remain returnable (DEV-06)"
key_files:
  created: []
  modified:
    - src/pages/Sales.tsx
decisions:
  - "installments already loaded via useLocalStorage (Phase 3); no new storage slice needed"
  - "cancelledInstallmentIds persisted on sale.cancelledInstallmentIds only when allItemsReturned (partial return leaves sale record unchanged)"
  - "toast branches: no-client / creditGenerated>0 / zero-paid crediario — distinct messages for each case"
  - "preview label changed from 'Credito em haver' to 'Valor a devolver' (accurate pre-confirm display)"
  - "AlertDialog description updated to 'proporcional ao valor efetivamente pago' (avoids misleading uncapped figure)"
  - "canReturn (lines 404-408) left completely untouched — crediario_pending eligibility preserved (DEV-06 / BUG-4)"
metrics:
  duration: "~5 min"
  completed_date: "2026-06-20"
  tasks_completed: 1
  files_modified: 1
---

# Phase 04 Plan 04: Sales.tsx Return Path — Capping + Installment Cancel Summary

**One-liner:** Sales.tsx handleReturnFromSale now passes installments to processReturn for DEV-04 haver capping, cancels open/overdue installments on full crediario return (BUG-2 parity), and reports capped creditGenerated in the toast; canReturn preserved for crediario_pending (DEV-06).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Pass installments to processReturn and cancel installments on full crediario return | cf7752f | src/pages/Sales.tsx |

## What Was Built

### src/pages/Sales.tsx — handleReturnFromSale Rewired

**DEV-04 / T-04-10 — Haver capping:**
- `installments` added to `processReturn` call input so the capping logic from 04-01 runs.
- `cancelledInstallmentIds` destructured from result.
- For crediario zero-paid sales: `creditGenerated = 0`; toast reports "Divida cancelada — nenhum valor pago, nenhum haver gerado."
- Cash/card/pix sales unchanged: `creditGenerated = totalRefunded`.

**BUG-2 / T-04-11 — Installment cancellation on full crediario return:**
- After `setReturns`, a conditional `setInstallments` maps open/overdue installments to `status: 'cancelled'` when `cancelledInstallmentIds.length > 0`.
- Pattern mirrors `finalizeRefund` (the estorno path) — idempotent map (not filter).
- `cancelledInstallmentIds` persisted on the sale record (`sale.cancelledInstallmentIds`) on `allItemsReturned` — enables DEV-07 reversal parity.

**T-04-12 / DEV-06 — canReturn regression guard:**
- `canReturn` (lines 404-408) left completely untouched. It allows `crediario_pending` by not filtering that status; `crediario_pending` token confirmed present at line 401 (inside `canRefund`).

**Toast / UI accuracy:**
- Success toast now reports `returnRecord.creditGenerated` (capped figure) instead of `returnRecord.totalRefunded`.
- Preview label changed from "Credito em haver" to "Valor a devolver" (accurate before capping is computed).
- AlertDialog confirmation description updated to note "proporcional ao valor efetivamente pago" — avoids showing uncapped `returnTotal` as a promised haver figure.

## Acceptance Criteria

| Check | Result |
|-------|--------|
| `npm run build` exits 0 | PASS |
| `installments,` inside handleReturnFromSale processReturn input (line 338) | PASS |
| `cancelledInstallmentIds.includes` in return path (line 364) | PASS |
| `returnRecord.creditGenerated` in toast (line 379, 382) | PASS |
| `cancelledInstallmentIds && sale.cancelledInstallmentIds.length` (WR-02 guard) intact (line 399) | PASS |
| `crediario_pending` token present; canReturn at 404-408 unchanged | PASS |
| No `returnRecord.totalRefunded` as "credito em haver" in toast | PASS (zero occurrences) |

## Deviations from Plan

### Auto-applied (not deviations — implementation choices within scope)

**1. Preview label and AlertDialog description updated:** The plan targeted the success toast only. The pre-confirmation preview ("Credito em haver" + uncapped `returnTotal`) and the AlertDialog description were also misleading for crediario sales. Updated both to accurate neutral text. This is a UX accuracy improvement within the same file — no behavior change.

## Known Stubs

None. All logic is complete and wired to correct inputs. No placeholder values or TODO comments introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's `<threat_model>` already covers:
- T-04-10: toast now reports `returnRecord.creditGenerated` (capped); raw `totalRefunded` no longer shown as haver.
- T-04-11: `setInstallments` applied only when `cancelledInstallmentIds.length > 0`; only open/overdue affected (via processReturn's getEffectiveStatus filter).
- T-04-12: `canReturn` (404-408) untouched; `crediario_pending` token confirmed at line 401.
- T-04-SC: no new packages installed.

## Self-Check: PASSED

- `src/pages/Sales.tsx`: EXISTS (modified)
- Commit `cf7752f`: EXISTS (verified via git log)
- `npm run build`: PASSED (0 errors, built in 11.44s)
- `grep -n "installments," src/pages/Sales.tsx`: line 338 (inside handleReturnFromSale)
- `grep -n "cancelledInstallmentIds.includes" src/pages/Sales.tsx`: line 364
- `grep -n "returnRecord.creditGenerated" src/pages/Sales.tsx`: lines 379, 382
- `grep -n "crediario_pending" src/pages/Sales.tsx`: lines 246, 401, 737, 743
- `grep -n "canReturn" src/pages/Sales.tsx`: lines 404, 485, 629 (no modification to function body)
- `grep -n "returnRecord.totalRefunded" src/pages/Sales.tsx`: (empty — no occurrences)
