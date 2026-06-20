---
phase: 03-estorno-correto
reviewed: 2026-06-20T16:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/types/index.ts
  - src/lib/processRefund.ts
  - src/pages/Sales.tsx
  - src/pages/Reports.tsx
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 03: Estorno Correto — Code Review Report

**Reviewed:** 2026-06-20T16:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The pure `processRefund` core (EST-01..04) is financially sound: haver capping, ground-truth
`crediarioPaid` from installment sums, open/overdue-only cancellation, and double-restock-safe
stock restoration are all correctly implemented. Two critical defects exist in the UI wiring layer
(Sales.tsx), not in the pure computation module.

**Critical #1** is a data-corruption path: when the operator aborts the haver/cash dialog, stock
and installments have already been mutated but the sale status remains `crediario_pending`,
making the sale eligible for a second estorno that will double-restock.

**Critical #2** is a financial mis-classification: non-crediário sales paid with `store_credit`
(haver) are routed through the cash-out path, recording a phantom cash disbursement and failing
to restore the client's `storeCredit` balance.

The `processRefund.ts` module and `src/types/index.ts` extensions pass review cleanly.
`Reports.tsx` cashRefundOut aggregation is correct within its scope.

---

## Critical Issues

### CR-01: Abort dialog leaves sale in permanently inconsistent state (double-restock on retry)

**File:** `src/pages/Sales.tsx:133-145` (handleRefund) and `src/pages/Sales.tsx:747`

**Issue:**
When a crediário sale has `paidAmount > 0`, `handleRefund` applies side effects unconditionally
before opening the decision dialog:

```
line 133: setProducts(result.updatedProducts)      // stock restored NOW
line 136: setInstallments(installments.map(...))   // installments cancelled NOW
line 145: setPendingRefund({ sale, result })        // dialog opens
```

The `AlertDialogCancel` button at line 747 calls only `setPendingRefund(null)`, returning the
user to the sale detail view. At this point:

- Product stock has been increased (as if the estorno completed).
- Open/overdue installments have been set to `cancelled`.
- The sale's `status` is still `crediario_pending` (not `refunded`).

Because `canRefund()` (line 338) checks `sale.status !== 'refunded'`, the "Estornar Venda"
button remains active. A second click of "Estornar Venda" calls `handleRefund` again:

1. Idempotency guard at line 122 (`sale.status === 'refunded'`) does NOT fire — status is still
   `crediario_pending`.
2. `processRefund` is called again with `getReturnedQuantities(sale.id)` — which uses `returns`
   records, not the already-applied stock change. The `alreadyReturnedQtys` map is therefore
   unchanged, so `qtyToRestore = saleItem.quantity - 0` again.
3. `setProducts(result.updatedProducts)` fires a second time, adding stock again (double-restock).
4. `setInstallments` fires again (already-cancelled installments are mapped again — idempotent,
   so no duplicate corruption here, but the operation is wasted).
5. A second `setPendingRefund` opens the dialog again for the same already-mutated sale.

Additionally, `cancelledInstallmentIds` is never persisted on the sale after an abort, so the
audit trail required by EST-02 is permanently lost for that sale.

The SUMMARY (03-02-SUMMARY.md, Deviations section) acknowledges "stock and installment cancel
happen before setPendingRefund so the register state is always consistent regardless of dialog
outcome." This is incorrect: the state is NOT consistent when the user clicks Cancel — the
aborted sale is left with cancelled installments and increased stock but an unchanged
`crediario_pending` status.

**Fix:**
Move `setProducts` and `setInstallments` out of `handleRefund` and into `finalizeRefund`, so
side effects only occur after the operator commits to a mode. The idempotency guard already
handles the `refunded` check, so there is no window for double application.

```typescript
const handleRefund = (sale: Sale) => {
  if (sale.status === 'refunded') return;

  const result = processRefund({
    sale,
    products,
    installments,
    alreadyReturnedQtys: getReturnedQuantities(sale.id),
  });

  // Do NOT apply setProducts / setInstallments here.
  // Dispatch based on whether a user decision is needed.
  if (result.isCrediarioSale && result.paidAmount > 0) {
    setPendingRefund({ sale, result });          // dialog opens; side effects deferred
  } else if (!result.isCrediarioSale) {
    finalizeRefund(sale, result, 'cash');
  } else {
    finalizeRefund(sale, result, 'none');
  }
};

const finalizeRefund = (sale: Sale, result: ProcessRefundResult, mode: 'haver' | 'cash' | 'none') => {
  const paid = roundCurrency(result.paidAmount);

  // Apply stock + installment changes HERE (exactly once, after mode is committed)
  setProducts(result.updatedProducts);
  setInstallments(installments.map(inst =>
    result.cancelledInstallmentIds.includes(inst.id)
      ? { ...inst, status: 'cancelled' as const }
      : inst
  ));

  if (mode === 'haver' && sale.clientId) {
    setClients(clients.map(c =>
      c.id === sale.clientId
        ? { ...c, storeCredit: roundCurrency((c.storeCredit || 0) + paid), updatedAt: new Date().toISOString() }
        : c
    ));
    setSales(sales.map(s =>
      s.id === sale.id
        ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds }
        : s
    ));
    // ... toast, cleanup
  } else if (mode === 'cash') {
    // ... (store_credit case also needs fixing per CR-02)
    setSales(sales.map(s =>
      s.id === sale.id
        ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds, cashRefundOut: paid }
        : s
    ));
    // ... toast, cleanup
  } else {
    setSales(sales.map(s =>
      s.id === sale.id
        ? { ...s, status: 'refunded' as const, cancelledInstallmentIds: result.cancelledInstallmentIds }
        : s
    ));
    // ... toast, cleanup
  }
};
```

If deferring side effects is not acceptable (e.g., UX requires immediate stock feedback),
at minimum the "Cancelar" button must roll back the mutations:

```typescript
// In AlertDialogCancel onClick:
onClick={() => {
  // Roll back stock to pre-estorno state
  setProducts(productsBeforeRefund);
  // Roll back installment statuses
  setInstallments(installmentsBeforeRefund);
  setPendingRefund(null);
}}
```
This requires saving snapshots before applying the changes, which is more error-prone than
simply deferring them.

---

### CR-02: store_credit sales refunded as cash-out instead of restoring haver balance

**File:** `src/pages/Sales.tsx:146-148` (handleRefund) and `src/lib/processRefund.ts:93-95`

**Issue:**
`processRefund` classifies a sale with `paymentMethod === 'store_credit'` (or a pure
`store_credit` paymentEntry) as `isCrediarioSale = false` (line 63-67 of processRefund.ts).
No branch of the `isCrediarioSale` check covers `store_credit`.

Consequence in `handleRefund`:
```
line 146: } else if (!result.isCrediarioSale) {
line 148:   finalizeRefund(sale, result, 'cash');
```

`finalizeRefund('cash')` then:
1. Sets `cashRefundOut = roundCurrency(sale.total)` on the refunded sale (line 191).
2. Does NOT touch `client.storeCredit`.
3. Reports.tsx reports this as a cash disbursement from the register.

This is financially incorrect. When a client pays with `store_credit` (haver), no actual cash
entered the register at sale time. Reversing that sale should restore the haver credit to the
client's balance — it should NOT record a cash outflow.

Additionally, the `store_credit` path has no client guard: a `store_credit` sale with no
`clientId` would attempt to generate `cashRefundOut` for a sale that had no real cash exchange.

**Fix:**
Add `store_credit` to the `isCrediarioSale` detection in `processRefund.ts`, OR handle it as a
distinct third category. The simplest correct fix is to treat `store_credit` sales as requiring
a `storeCredit` restoration (the haver path), similar to how haver estornos work:

In `processRefund.ts`, expand the `isCrediarioSale` check to also flag `store_credit` payments,
OR add a separate `isStoreCreditSale` boolean to `ProcessRefundResult`.

In `handleRefund` (Sales.tsx):

```typescript
// After processRefund call:
if (result.isCrediarioSale && result.paidAmount > 0) {
  setPendingRefund({ sale, result });
} else if (result.isStoreCreditSale) {
  // Restore storeCredit to the client; no cash changes
  finalizeRefund(sale, result, 'haver');
} else if (!result.isCrediarioSale) {
  // True cash/card/pix — record as cash outflow
  finalizeRefund(sale, result, 'cash');
} else {
  finalizeRefund(sale, result, 'none');
}
```

And in `processRefund.ts`:

```typescript
const isStoreCreditSale =
  sale.paymentMethod === 'store_credit' ||
  (sale.paymentEntries?.every(e => e.method === 'store_credit') === true);

// For store_credit sales, paidAmount = sale.total (the haver that was spent)
const paidAmount = isCrediarioSale
  ? roundCurrency(crediarioPaid + otherPaid)
  : roundCurrency(sale.total);  // covers cash, card, pix, and store_credit
```

Then in `finalizeRefund`, the `haver` path already correctly increments `storeCredit` —
it just needs a clientId guard, which already exists at line 167.

---

## Warnings

### WR-01: `otherPaid` double-counts `store_credit` entries for mixed-payment crediário sales

**File:** `src/lib/processRefund.ts:83-87`

**Issue:**
`otherPaid` sums all `paymentEntries` where `method !== 'crediario'`. For a mixed-payment sale
that includes a `store_credit` entry (haver used at checkout alongside crediário), that haver
amount is included in `otherPaid` and therefore in `paidAmount`.

This means when the operator chooses the "cash" path in the dialog, `cashRefundOut` would
include the `store_credit` portion — recording a cash disbursement for money that was never in
the register (it was store credit, not physical cash).

Example: Sale R$ 300 = R$ 100 store_credit entry + R$ 200 crediário (R$ 50 paid). `paidAmount`
= 50 (crediário) + 100 (store_credit, incorrectly labeled "otherPaid") = R$ 150. If operator
picks "Dinheiro", `cashRefundOut = 150` but only R$ 50 actually exists as a cash obligation
(the crediário paid portion). The R$ 100 store credit should be restored to `storeCredit`, not
handed out as cash.

The dialog hint text at Sales.tsx line 733 reads "pago em dinheiro/entrada (nao crediario)" but
`otherPaid` can include `store_credit` entries which are neither cash nor crediário.

**Fix:**
Split `otherPaid` further:

```typescript
const cashPaid = roundCurrency(
  (sale.paymentEntries ?? [])
    .filter(e => e.method !== 'crediario' && e.method !== 'store_credit')
    .reduce((sum, e) => sum + e.amount, 0)
);

const storeCreditUsed = roundCurrency(
  (sale.paymentEntries ?? [])
    .filter(e => e.method === 'store_credit')
    .reduce((sum, e) => sum + e.amount, 0)
);

const otherPaid = roundCurrency(cashPaid + storeCreditUsed); // kept for paidAmount total
```

Return `cashPaid` and `storeCreditUsed` separately in `ProcessRefundResult` so the caller can
handle each correctly (cash → cashRefundOut; store_credit → storeCredit restoration).

Until this is fixed, the dialog hint text should at minimum be corrected to "pago em
dinheiro/cartão/entrada ou crédito em haver (não crediário)" to avoid misleading the operator.

---

### WR-02: `canRefund` allows estorno of `crediario_pending` sales that may already be partially cancelled

**File:** `src/pages/Sales.tsx:337-339`

**Issue:**
`canRefund` returns `true` for `crediario_pending` status (line 338). Combined with CR-01
(abort leaves sale as `crediario_pending` with partially applied side effects), this means
the broken sale state from an aborted estorno is indistinguishable from a legitimate
`crediario_pending` sale. There is no UI indicator that installments have already been
cancelled or that stock was already restored.

Even independent of CR-01, if an operator opens a `crediario_pending` sale that has had all
its installments administratively cancelled via another path (e.g., manual intervention), the
estorno path will process it without warning.

**Fix:**
Add a check in `canRefund` (or in the dialog description) that detects whether
`cancelledInstallmentIds` is already populated on the sale:

```typescript
const canRefund = (sale: Sale) => {
  if (sale.status === 'refunded') return false;
  // Prevent re-estorno if cancelledInstallmentIds already set (indicates a prior partial estorno)
  if (sale.cancelledInstallmentIds && sale.cancelledInstallmentIds.length > 0) return false;
  return sale.status === 'completed' || sale.status === 'crediario_paid' ||
    sale.status === 'crediario_pending' || !sale.status;
};
```

This also serves as a partial idempotency guard independent of `sale.status === 'refunded'`.

---

## Info

### IN-01: Confirmation dialog shows sale.total instead of paidAmount for crediário hint

**File:** `src/pages/Sales.tsx:674`

**Issue:**
The initial "Confirmar estorno" AlertDialog (the first confirmation before `handleRefund` is
called) shows `formatCurrency(selectedSale.total)` at line 674 in the bullet:
"O valor de R$ X será revertido." For a crediário sale with partial payment (e.g., sale total
R$ 300, paid R$ 50), this suggests R$ 300 will be reversed, which is misleading. Only R$ 50
will actually change hands (as haver or cash) — the remaining R$ 250 is just debt cancellation.

The same dialog at lines 682-690 does correctly show the actual paid amount for the
haver/cash hint, but the top-level "valor de R$ X será revertido" line remains inaccurate
for partial-payment crediário cases.

**Fix:**
For crediário sales (where `sale.status === 'crediario_pending' || 'crediario_paid'`), replace
the blanket "valor de R$ X será revertido" bullet with a more accurate breakdown:

```tsx
{'•'} A dívida de <strong>{formatCurrency(selectedSale.total)}</strong> será cancelada.
```

Or conditionally show:
```tsx
{(selectedSale.status === 'crediario_pending' || selectedSale.status === 'crediario_paid')
  ? `• A dívida crediário de R$ ${selectedSale.total} será cancelada (sem devolução de dinheiro pelo total — apenas pelo valor já pago).`
  : `• O valor de R$ ${selectedSale.total} será revertido.`
}
```

---

## Structural Findings (fallow)

No structural pre-pass was provided for this phase.

---

_Reviewed: 2026-06-20T16:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
