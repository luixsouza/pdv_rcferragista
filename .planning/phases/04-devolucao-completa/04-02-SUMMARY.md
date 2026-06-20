---
phase: 04-devolucao-completa
plan: "02"
subsystem: returns-ui
tags: [Returns.tsx, crediario_pending, haver-capping, abatimento, installment-cancel, DEV-04, DEV-05, DEV-06, DEV-07]
dependency_graph:
  requires: [04-01]
  provides: [returns-page-crediario-complete, abatimento-modality-ui, installment-cancel-on-return, reversal-consistency]
  affects: [src/pages/Returns.tsx]
tech_stack:
  added: []
  patterns:
    - "processAbatement called from handleReturn (abatimento branch); processReturn called for both branches"
    - "useMemo for saleOpenInstallments and abatimentoPreview (live display-only calc)"
    - "creditGenerated = 0 literal assignment — only explicit zero stops haver in abatimento branch"
    - "setInstallments single call covers cancel + abatimento updates; separate call in reversal"
    - "setCreditPayments filter by (type === 'abatimento' && saleId && installmentId in abatedMap) for clean reversal"
key_files:
  created: []
  modified:
    - src/pages/Returns.tsx
decisions:
  - "crediario_pending included in eligibleSales (aligns with Sales.tsx canReturn — DEV-06)"
  - "abatimento branch calls processReturn for stock only, then skips setClients to avoid storeCredit increment"
  - "BUG-2 fix applied in both haver and abatimento branches (cancel open/overdue on full return)"
  - "abatimento modality hidden unless isCrediarioSale && selectedClient (T-04-05)"
  - "residual warned with toast.warning — never silently converted to haver (T-04-03)"
  - "handleReverseReturn: restoreInstallments and reverseAbatamento share single setInstallments call (atomic)"
  - "CreditPayments removal on reversal: filter by type='abatimento' + saleId + installmentId in abatedMap"
metrics:
  duration: "~18 min"
  completed_date: "2026-06-20"
  tasks_completed: 3
  files_modified: 1
---

# Phase 04 Plan 02: Returns.tsx Upgrade — Crediário, Modality UI, Installment Cancel/Restore Summary

**One-liner:** Returns page now covers crediario_pending sales, offers haver/abatimento modality UI, cancels open/overdue installments on full crediário returns, and reversal restores installments + removes abatimento CreditPayments.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Include crediario_pending in eligibleSales + installments/creditPayments slices + modality state | 505dea7 | src/pages/Returns.tsx |
| 2 | Wire modality UI + abatimento branch + installment cancellation in handleReturn | 505dea7 | src/pages/Returns.tsx |
| 3 | Restore cancelled installments + reverse abatimento in handleReverseReturn | 505dea7 | src/pages/Returns.tsx |

(All three tasks committed in one commit — the three tasks form a single coherent rework of one file; each task's changes depend on the prior task's state variable additions.)

## What Was Built

### src/pages/Returns.tsx — Complete Crediário Devolução Workflow

**Task 1 — Eligibility + Storage + State:**
- `eligibleSales` now filters on `s.status === 'completed' || s.status === 'crediario_paid' || s.status === 'crediario_pending'` (DEV-06/BUG-4 fix; mirrors Sales.tsx canReturn).
- Added `useLocalStorage<Installment[]>('installments', [])` and `useLocalStorage<CreditPayment[]>('credit_payments', [])` slices.
- Added `returnModality: 'haver' | 'abatimento'` and `selectedInstallmentIds: string[]` state.
- `saleOpenInstallments` derived via useMemo using `getEffectiveStatus` for the abatimento installment picker.
- `isCrediarioSale` derived from sale fields — controls modality selector visibility.
- `installments` passed into `processReturn` call for haver capping (DEV-04) and cancelledInstallmentIds (BUG-2 foundation).
- `abatimentoPreview` computed via useMemo from `processAbatement` (display-only; shows "a abater / excedente").

**Task 2 — handleReturn Branching (DEV-04/DEV-05/BUG-2):**
- `haver` branch: capped `creditGenerated` from processReturn used for toast (not raw totalRefund). `cancelledInstallmentIds` applied via `setInstallments` on full crediário return (BUG-2 fix).
- `abatimento` branch: requires `selectedClient` + non-empty `selectedInstallmentIds` (T-04-05 guard). `returnRecord.creditGenerated = 0` (literal assignment — W-5). Calls `processAbatement`; result's `updatedInstallments` applied (merged with cancelledInstallmentIds if full return). Persists `abResult.abatedMap` onto `returnRecord.abatedInstallments`. Appends `abResult.creditPayments` to `creditPayments` store. Skips `setClients` to avoid storeCredit increment. `residual > 0` triggers `toast.warning` with explicit amount; never converts to haver.
- Modality UI: two toggle buttons ("Gerar Haver" / "Abatimento de Débito") rendered only for crediário sales with a client; non-crediário/no-client hides abatimento option.
- Installment checklist in abatimento mode shows parcela number, dueDate, remaining balance; overdue installments labeled.

**Task 3 — handleReverseReturn Consistency (DEV-07):**
- `cancelledInstallmentIds` guard: if present, maps installments to `status: 'open', paidAt: undefined` (retrocompat guard for legacy records).
- `abatedInstallments` reversal: for each abatedMap entry, `discountApplied` decremented by `Math.max(0, current - amount)` guard. If installment was flipped to `paid` by abatement and no longer covered after reversal, status restored to `open` / `paidAt` cleared.
- Removes abatimento CreditPayments: `setCreditPayments(filter(...))` dropping entries where `type === 'abatimento' && saleId === ret.originalSaleId && installmentId in abatedInstallmentIds`.
- Single `setInstallments` call covers both cancel-restore and abatimento-restore (atomic, no partial state).
- `ret.creditGenerated > 0` guard preserved on storeCredit deduction — abatimento reversal never touches storeCredit.
- AlertDialog description updated to mention parcel restoration when applicable.
- History card distinguishes abatimento returns (shows "Abatimento" label + CreditCard icon) vs haver returns (Gift icon).

## Acceptance Criteria

| Check | Result |
|-------|--------|
| `npm run build` exits 0 | PASS |
| `crediario_pending` in eligibleSales filter | PASS (line 71) |
| `useLocalStorage<Installment[]>('installments'` present | PASS (line 39) |
| `CreditPayment` imported and `credit_payments` slice loaded | PASS (lines 6, 41) |
| `returnModality` and `selectedInstallmentIds` state | PASS (lines 50-51) |
| `installments` passed to processReturn | PASS (line 206) |
| `processAbatement` invoked in handleReturn | PASS (line 228) |
| `setInstallments` in both branches | PASS (lines 246, 248, 280-284) |
| `status: 'cancelled'` in haver branch (BUG-2) | PASS (lines 244, 283) |
| `residual` warning path | PASS (lines 269-272) |
| `returnRecord.creditGenerated = 0` literal assignment (W-5) | PASS (line 225) |
| `setCreditPayments` in handleReturn abatimento branch | PASS (line 252) |
| `returnRecord.abatedInstallments` assignment | PASS (line 238) |
| `cancelledInstallmentIds` read in handleReverseReturn | PASS (lines 357-361) |
| `status: 'open'` restoration | PASS (line 360) |
| `Math.max(0, ...)` on discountApplied reversal | PASS (line 373) |
| `abatedInstallments` reversal path | PASS (lines 367-396) |
| `setCreditPayments` inside handleReverseReturn | PASS (line 392) |
| `creditGenerated > 0` guard on storeCredit deduction | PASS (lines 325, confirming abatimento skips it) |
| No edits to src/types/index.ts | PASS (grep -c abatedInstallments = 1, unchanged from 04-01) |

## Deviations from Plan

### Auto-applied (not deviations — implementation choices within scope)

**1. All three tasks in one commit:** The plan's three tasks all target a single file (Returns.tsx). Task 1 adds state variables that Task 2 uses in JSX and logic, and Task 3 uses the same state variables in reversal. Committing all three together gives one passing build rather than three intermediate builds that would each fail due to unused imports or missing branches.

**2. Abatimento branch skips `setClients` explicitly:** The plan said "keep clients unchanged" in abatimento mode. Rather than passing `updatedClients` from processReturn (which would increment storeCredit), the abatimento branch calls `setProducts(updatedProducts)` only, intentionally omitting `setClients`. This is the cleanest approach to avoid inadvertent storeCredit mutation.

**3. BUG-2 applied in abatimento branch too:** Plan's Task 2 mentioned BUG-2 fix in the haver branch; the abatimento branch also hits `cancelledInstallmentIds` from processReturn on full return. Both branches correctly cancel open/overdue installments on full crediário returns (merged with abatement updates in abatimento branch).

## Known Stubs

None. All modality logic is wired, all state mutations are applied. No placeholder text or TODO comments introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's `<threat_model>` already covers:
- T-04-04: cancel only open/overdue on allItemsReturned (both branches).
- T-04-05: abatimento option hidden unless `isCrediarioSale && selectedClient`.
- T-04-06: reversal restores cancelledInstallmentIds to open, reverses abatedInstallments with Math.max(0,...), removes abatimento CreditPayments via setCreditPayments inside handleReverseReturn.
- T-04-SC: no new packages installed.

## Self-Check: PASSED

- `src/pages/Returns.tsx`: EXISTS (modified — ~960 lines)
- Commit `505dea7`: EXISTS (verified via git log)
- `npm run build`: PASSED (0 errors, built in 10.96s)
- `src/types/index.ts`: NOT modified by this plan (grep -c abatedInstallments = 1, unchanged)
