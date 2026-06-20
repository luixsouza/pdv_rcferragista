---
phase: 03-estorno-correto
plan: "01"
subsystem: estorno
tags: [pure-function, financial-core, crediario, refund, estorno]
dependency_graph:
  requires: []
  provides: [processRefund, Sale.cashRefundOut, Sale.cancelledInstallmentIds]
  affects: [Sales.tsx (Plan 02 wiring), src/types/index.ts]
tech_stack:
  added: []
  patterns: [pure-mutation-return (mirrors processReturn.ts FND-02), roundCurrency, getEffectiveStatus]
key_files:
  created:
    - src/lib/processRefund.ts
  modified:
    - src/types/index.ts
decisions:
  - "crediarioPaid derived from installment.amountPaid sum (ground truth) — never from stale sale.crediarioPaid"
  - "paidAmount = crediarioPaid + otherPaid for crediário sales to prevent silent under-refund on split/mixed payments"
  - "cancelledInstallmentIds uses getEffectiveStatus so open-past-due are correctly treated as overdue"
  - "cashRefundOut and cancelledInstallmentIds placed on Sale (not new storage key) — mirrors ReturnRecord.cancelledInstallmentIds? retrocompat pattern"
metrics:
  duration: "2 minutes"
  completed: "2026-06-20T15:17:06Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 01: Estorno Correto — Pure processRefund Module Summary

**One-liner:** Pure refund-computation core with haver capping, open/overdue-only cancellation set, double-restock-safe stock restore, and full paidAmount breakdown for mixed-payment crediário sales.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Sale.cashRefundOut? and Sale.cancelledInstallmentIds? | c780308 | src/types/index.ts |
| 2 | Create pure processRefund computation module | 426399c | src/lib/processRefund.ts |

## What Was Built

### Task 1 — Sale type extension (src/types/index.ts)

Two optional fields added to the `Sale` interface after `crediarioPaid?: number`:

- `cashRefundOut?: number` — records the cash amount refunded out of the register at estorno (EST-03 option b); excludes haver, which goes to `client.storeCredit`.
- `cancelledInstallmentIds?: string[]` — the explicit list of installment ids flipped to `cancelled` by the estorno (EST-02 audit trail; basis for Phase 4 DEV-07 reversal).

Both fields are optional and additive — existing stored `Sale` objects without them remain valid (retrocompatible with electron-store). The pre-existing `ReturnRecord.cancelledInstallmentIds?` (Phase 1) was left untouched.

### Task 2 — processRefund pure module (src/lib/processRefund.ts)

Exports `processRefund(input: ProcessRefundInput): ProcessRefundResult`. Mirrors the side-effect-free, mutation-return pattern of `processReturn.ts` (FND-02). No React hooks, no `useLocalStorage`, no `window.electron`.

**Financial rules encoded:**

| Rule | Implementation |
|------|----------------|
| EST-01: zero-paid → paidAmount = 0 | `crediarioPaid` sum = 0 + `otherPaid` = 0 → `paidAmount = 0`; no haver, no cash-out |
| EST-02: only open/overdue cancelled | `getEffectiveStatus(i)` filter; excludes `paid` (preserves history) and `cancelled` (idempotent) |
| EST-04: double-restock-safe | `qtyToRestore = saleItem.quantity - alreadyReturnedQtys[id]`; skips if `<= 0` |
| EST-04: mil /1000 rule | `product.unit === 'mil' ? qtyToRestore / 1000 : qtyToRestore` |
| Mixed payment (no under-refund) | `paidAmount = roundCurrency(crediarioPaid + otherPaid)` — NOT just the crediário slice |
| Ground-truth crediarioPaid | `sum(installments where saleId === sale.id, i => i.amountPaid)` — never stale `sale.crediarioPaid` |

**Result shape:**
```typescript
{
  updatedProducts: Product[];          // stock restored, double-restock-safe
  cancelledInstallmentIds: string[];   // only open/overdue ids
  paidAmount: number;                  // full amount to refund (operator decides haver vs cash)
  crediarioPaid: number;               // crediário slice (for Plan 02 split dialog hint)
  otherPaid: number;                   // non-crediário slice (cash/card/pix entries)
  isCrediarioSale: boolean;            // Plan 02 uses this to decide whether to show dialog
}
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a pure computation module with no UI rendering.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The module is pure computation over locally-loaded data; no new IO surface introduced (T-03-03: accept disposition confirmed).

T-03-01 (Tampering — haver base): Mitigated. `paidAmount` derived from `sum(installment.amountPaid)` + non-crediário `paymentEntries`; zero-paid → paidAmount = 0; split sales report full paid amount.

T-03-02 (Repudiation — installment cancellation): Mitigated. `cancelledInstallmentIds` returned as explicit set (only open/overdue) for caller to record on Sale.

## Self-Check: PASSED
