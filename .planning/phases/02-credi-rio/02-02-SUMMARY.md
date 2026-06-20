---
phase: 02-credi-rio
plan: "02"
subsystem: crediario
tags: [on-the-fly-overdue, effective-status, per-client-summary, per-sale-breakdown, balance-display]
dependency_graph:
  requires: [installmentStatus-helper]
  provides: [effective-status-display, per-client-balance, per-sale-breakdown]
  affects: [CreditNotes]
tech_stack:
  added: []
  patterns: [useMemo-derived-array, single-source-of-truth-status, roundCurrency-sums, on-the-fly-derivation]
key_files:
  created: []
  modified:
    - src/pages/CreditNotes.tsx
decisions:
  - "Single effectiveInstallments useMemo maps all installments once via getEffectiveStatus; every display and aggregation path derives from it to avoid drift"
  - "Mount useEffect preserved (not deleted) — persisted writes remain for cross-page consumers (POS, other screens)"
  - "calculateInterest updated to use getEffectiveStatus for the overdue check so interest is shown for open-past-due installments even before mount effect fires"
  - "Per-sale breakdown uses allClientEff (includes number===0 entry) for money sums but clientInstallments (raw stored) for PDF/print to preserve stored data"
  - "Cancelled installments excluded from totalDevido, totalPago, saldo and per-sale sums; counted separately in badge display"
  - "getStatusBadge extended with cancelled case for completeness in per-sale badge rendering"
metrics:
  duration: "~12 min"
  completed: "2026-06-20T15:00:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
---

# Phase 02 Plan 02: Effective Status Display + Balance Summary — SUMMARY

**One-liner:** CreditNotes.tsx now derives all display/aggregation from a single `effectiveInstallments` useMemo (via `getEffectiveStatus`), and the Resumo tab shows per-client devido/pago/saldo plus a per-sale breakdown with status counts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Compute display status on-the-fly via the shared helper | 552886a | src/pages/CreditNotes.tsx |
| 2 | Add per-client and per-sale balance summary | 552886a | src/pages/CreditNotes.tsx |

## What Was Built

### Task 1 — Effective status wiring (CRED-02)

Added `effectiveInstallments` useMemo at the top of the computation block:
```typescript
const effectiveInstallments = useMemo(
  () => installments.map(inst => ({ ...inst, status: getEffectiveStatus(inst) })),
  [installments]
);
```

All display and aggregation paths were switched to consume this derived array:
- `filteredInstallments` (filter + sort comparator) — status filter and sort key now use effective status
- `overdueInstallments` — feeds the Inadimplentes tab delinquent client map
- `totalPendingInstallments` — PageHeader "Total pendente" figure
- `resumoOverdue` / `resumoOverdueAmount` — Resumo tab "Cliente Inadimplente" banner
- `resumoCreditUsed` — credit utilization bar in the Resumo card
- Status count grid (Abertas/Vencidas/Pagas) in the "Parcelas do Cliente" card
- `calculateInterest` updated to use `getEffectiveStatus` for the overdue check

No raw `installments.filter(i => i.status === 'overdue')` comparisons remain in display or aggregation. The mount useEffect (lines 61-74) is preserved unchanged.

### Task 2 — Per-client and per-sale balance summary (CRED-01)

New "Totais do Cliente" card added above the installments summary, showing:
- **Total Devido** = `roundCurrency(sum of non-cancelled (amount - discountApplied))`
- **Total Pago** = `roundCurrency(sum of non-cancelled (amountPaid + discountApplied))`
- **Saldo em Aberto** = `roundCurrency(totalDevido - totalPago)` — color-coded amber (positive) or green (zero)

New "Resumo por Venda" card below the status grid, grouping by `saleId`:
- Per-sale código (`saleId.slice(0,8).toUpperCase()`)
- Per-sale devido / pago / saldo (via `roundCurrency`)
- Status count badges: Abertas / Vencidas / Pagas / Canceladas
- Cancelled installments shown in badge count but excluded from money sums

Both cards use existing Card/CardContent/Badge primitives and `formatCurrency`/`roundCurrency` from established helpers — no new design system or component files.

## Verification

- `grep -c "getEffectiveStatus" src/pages/CreditNotes.tsx` → 3 (import + useMemo call + calculateInterest)
- `grep -c "roundCurrency" src/pages/CreditNotes.tsx` → 7 (totalDevido, totalPago, saldo, saleDevido, salePago, saleSaldo)
- `grep -c "isInstallmentOverdue" src/pages/CreditNotes.tsx` → 2 (import + unused-but-imported from lib)
- Mount useEffect at lines 61-74 still present — confirmed
- No raw `installments.filter(...status === 'overdue')` in aggregation — confirmed
- `npm run build` exits 0 — confirmed

## Deviations from Plan

**1. [Rule 2 - Missing coverage] `getStatusBadge` extended with `cancelled` case**
- **Found during:** Task 2 implementation — per-sale breakdown calls `getStatusBadge` on installments that may have `cancelled` status
- **Fix:** Added `case 'cancelled': return <Badge variant="secondary" className="text-xs">Cancelada</Badge>` to the switch
- **Files modified:** src/pages/CreditNotes.tsx
- **Commit:** 552886a

**2. Tasks 1 and 2 committed in a single commit**
- Both tasks edit the same file and Task 2 depends on `effectiveInstallments` introduced in Task 1. All edits were applied in a single pass before committing; atomic per-task commit was not achievable without interactive staging. Both tasks are fully implemented.

## Known Stubs

None — all computed values derive from real installment data. No placeholder text or hardcoded empty values introduced.

## Threat Flags

None — no new network/IO surface. Display-only derivation; `effectiveInstallments` is computed in the renderer from locally-loaded data. Threat register items T-02-03 and T-02-04 addressed as documented in PLAN.md.

## Self-Check: PASSED

- [x] src/pages/CreditNotes.tsx imports `getEffectiveStatus` and `isInstallmentOverdue`
- [x] `effectiveInstallments` useMemo present
- [x] filteredInstallments, overdueInstallments, totalPendingInstallments, resumoOverdue/resumoOverdueAmount, resumoCreditUsed, status count grid all derive from effectiveInstallments
- [x] Per-client Totais card (totalDevido/totalPago/saldo) present
- [x] Per-sale breakdown (Resumo por Venda) present with devido/pago/saldo and status badges
- [x] Cancelled excluded from money sums
- [x] roundCurrency used on all sums
- [x] Mount useEffect preserved
- [x] Commit 552886a exists in git log
- [x] npm run build exits 0
