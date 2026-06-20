---
phase: 03-estorno-correto
fixed_at: 2026-06-20T15:35:00Z
review_path: .planning/phases/03-estorno-correto/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Estorno Correto — Code Review Fix Report

**Fixed at:** 2026-06-20T15:35:00Z
**Source review:** .planning/phases/03-estorno-correto/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Abort dialog leaves sale in permanently inconsistent state (double-restock on retry)

**Files modified:** `src/pages/Sales.tsx`, `src/lib/processRefund.ts`
**Commit:** e31db79
**Applied fix:** Removed `setProducts` and `setInstallments` calls from `handleRefund`. Both are now called at the top of `finalizeRefund` (before the mode branch), so stock and installment mutations happen exactly once, only after the operator commits to a mode. Cancelling the haver/cash `AlertDialog` calls only `setPendingRefund(null)` — the sale remains fully intact (status, stock, and installments unchanged), preventing double-restock on a second click.

### CR-02: store_credit sales refunded as cash-out instead of restoring haver balance

**Files modified:** `src/lib/processRefund.ts`, `src/pages/Sales.tsx`
**Commit:** e31db79
**Applied fix:** Added `isStoreCreditSale` boolean to `ProcessRefundResult`. In `processRefund.ts`, it is set to `true` when `paymentMethod === 'store_credit'` or all `paymentEntries` have `method === 'store_credit'`, and `isCrediarioSale` is false. In `handleRefund`, a new branch checks `result.isStoreCreditSale` and routes to `finalizeRefund(sale, result, 'haver')` — restoring `client.storeCredit`, never recording `cashRefundOut` for the store_credit portion.

### WR-01: `otherPaid` lumps `store_credit` entries in with cash

**Files modified:** `src/lib/processRefund.ts`, `src/pages/Sales.tsx`
**Commit:** e31db79
**Applied fix:** Split `otherPaid` into `cashPaid` (cash/credit/debit/pix entries) and `storeCreditUsed` (store_credit entries). Both are returned in `ProcessRefundResult`. `otherPaid` is preserved as their sum for backward-compatible `paidAmount` calculation. In `finalizeRefund` cash mode, `cashRefundOut` is set to `cashPaid` only; if `storeCreditUsed > 0`, the haver portion is restored to `client.storeCredit`. The dialog hint now shows `cashPaid` and `storeCreditUsed` as separate lines, accurately describing each portion.

### WR-02: `canRefund` allows estorno of sales that may already be partially cancelled

**Files modified:** `src/pages/Sales.tsx`
**Commit:** e31db79
**Applied fix:** Added a guard to `canRefund`: if `sale.cancelledInstallmentIds && sale.cancelledInstallmentIds.length > 0`, return `false`. This blocks re-estorno even if `sale.status` is still `crediario_pending` (defense-in-depth complementing CR-01's deferred-mutation fix).

### IN-01: Confirmation dialog shows sale.total instead of paidAmount for crediário hint

**Files modified:** `src/pages/Sales.tsx`
**Commit:** e31db79
**Applied fix:** The first confirmation `AlertDialog` now conditionally shows different bullet text for crediário sales: "A dívida de R$ X será cancelada (apenas o valor já pago será devolvido)" instead of the blanket "O valor de R$ X será revertido." Non-crediário sales continue to show the original text. This prevents misleading the operator into thinking the full crediário debt amount will be refunded.

---

_Fixed: 2026-06-20T15:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
