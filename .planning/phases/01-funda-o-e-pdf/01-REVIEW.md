---
phase: 01-funda-o-e-pdf
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/lib/formatters.ts
  - src/types/index.ts
  - src/pages/POS.tsx
  - src/lib/generateReceipt.ts
  - src/lib/generateQuote.ts
  - src/lib/processReturn.ts
  - src/pages/Sales.tsx
  - src/pages/Returns.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
fixes_applied:
  - id: CR-01
    status: fixed
    commit: af1ae05
    file: src/pages/POS.tsx
  - id: WR-01
    status: fixed
    commit: 82aed98
    file: src/lib/processReturn.ts
  - id: WR-03
    status: fixed
    commit: a42c367
    file: src/pages/POS.tsx
  - id: WR-04
    status: fixed
    commit: c805ea1
    file: src/pages/Sales.tsx
  - id: CR-02
    status: deferred
    reason: planned as EST-04 in Phase 3
  - id: WR-02
    status: deferred
    reason: planned as DEV-06 in Phase 4
  - id: WR-05
    status: deferred
    reason: Phase 4 devolução UI work
  - id: IN-01
    status: deferred
    reason: out of scope for Phase 1 fixes
  - id: IN-02
    status: deferred
    reason: Phase 5 fractional units work
  - id: IN-03
    status: deferred
    reason: out of scope for Phase 1 fixes
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

---

## Summary

Phase 1 delivers four building blocks: `roundCurrency`, the `processReturn` extraction, type additions, and dynamic PDF heights. The fundamentals are solid — `roundCurrency` is correct, the last-installment residual absorption is correctly implemented, and `processReturn` is a genuine pure function. The `cancelledInstallmentIds` type field is present and optional (retrocompatible).

However, two Critical issues exist: (1) `installmentValue` on line 147 of POS.tsx is still the raw unrounded float and is exposed in the UI preview, so the installment preview text will show irrational numbers like "R$ 33,333333..." for some totals; and (2) `handleRefund` in Sales.tsx restores stock for ALL sale items without subtracting quantities already returned via prior partial devoluções, producing a double-restock bug that was documented in FINANCIAL-PITFALLS.md §2 and explicitly called out as a correction site.

Five Warning findings cover: the `processReturn` stock restock using `returnItem.quantity / 1000` raw division (a float edge case for `mil` unit); `Returns.tsx` filtering eligible sales to only `completed | crediario_paid` which silently blocks `crediario_pending` returns (a behavioral divergence from `Sales.tsx` which allows `canReturn` on `crediario_pending`); the `subtotal` and `total` in `POS.tsx` being derived from unrounded sums of already-rounded cart items (which is acceptable but the discount calculation `subtotal * discountValue / 100` is never rounded before being stored in `Sale.discount`); the `Returns.tsx` local `formatCurrency` reimplementation instead of importing from `src/lib/formatters.ts`; and the PDF base constants lacking a `Math.max(floor, estimatedHeight)` correction for the "no items" edge case (quotes or receipts with zero items would produce pages shorter than the base itself, since `estimatedHeight < 200/250` only when `items.length * 8 < 100/110`).

Three Info findings note the `parseInt` call in the cart quantity input handler, a misleading UI label in the Returns flow, and the toast in `Sales.handleReturnFromSale` referencing `returnTotal` (the pre-`processReturn` local variable) rather than the rounded `returnRecord.totalRefunded`.

---

## Fix Status (2026-06-20)

| Finding | Status | Commit | Notes |
|---------|--------|--------|-------|
| CR-01 | **Fixed** | `af1ae05` | `installmentValue` wrapped in `roundCurrency` |
| CR-02 | Deferred | — | Planned as EST-04 in Phase 3 |
| WR-01 | **Fixed** | `82aed98` | mil-unit restock wrapped in `roundCurrency` |
| WR-02 | Deferred | — | Planned as DEV-06 in Phase 4 |
| WR-03 | **Fixed** | `a42c367` | `finalDiscountValue` and `total` wrapped in `roundCurrency` |
| WR-04 | **Fixed** | `c805ea1` | Toast uses `returnRecord.totalRefunded` |
| WR-05 | Deferred | — | Phase 4 devolução UI work |
| IN-01 | Deferred | — | Out of scope for Phase 1 fixes |
| IN-02 | Deferred | — | Phase 5 fractional units |
| IN-03 | Deferred | — | Out of scope for Phase 1 fixes |

---

## Critical Issues

### CR-01: `installmentValue` Display Uses Raw Unrounded Float (POS.tsx:147)

**File:** `src/pages/POS.tsx:147`

**Issue:** `installmentValue` is computed as the raw division `crediarioFinanced / installmentCount` with no rounding applied:

```typescript
const installmentValue = installmentCount > 0 ? crediarioFinanced / installmentCount : 0;
```

This value is displayed directly in the installment preview text at line 860:
```typescript
`${installmentCount}x de ${formatCurrency(installmentValue)}`
```

`formatCurrency` calls `Intl.NumberFormat` which rounds for display only — the visible text will show a rounded amount but `installmentValue` is the raw float. For R$ 100 / 3 installments, `formatCurrency(33.333...)` happens to display "R$ 33,33", but the stored `amount` for each installment is computed from `baseInstallment` (line 444), which is `roundCurrency(crediarioFinanced / installmentCount)` — consistent. The bug is not in storage (which is correct) but in the preview label: the preview says `3x de R$ 33,33` while what actually gets stored is installments of R$ 33,33 + R$ 33,33 + R$ 33,34. An operator relying on the preview for 3+ installments may be confused when the last installment differs from the displayed "per installment" amount. More critically, for cases like R$ 10 / 3 = R$ 3.3333..., the preview will show `formatCurrency(3.3333...)` = "R$ 3,33" but stored installments are 3.33 + 3.33 + 3.34. This is a correctness gap between what is communicated and what is stored.

**Fix:** Use `roundCurrency` for `installmentValue`:

```typescript
// line 147
const installmentValue = installmentCount > 0
  ? roundCurrency(crediarioFinanced / installmentCount)
  : 0;
```

The preview will now always reflect the base installment value (all installments except possibly the last), which matches what is stored for installments 1..N-1. Add a note in the preview for cases where the last installment differs:

```typescript
const lastInstallmentAmount = installmentCount > 1
  ? roundCurrency(crediarioFinanced - installmentValue * (installmentCount - 1))
  : installmentValue;

// In JSX preview label:
{installmentCount > 1 && lastInstallmentAmount !== installmentValue
  ? `${installmentCount - 1}x de ${formatCurrency(installmentValue)} + 1x de ${formatCurrency(lastInstallmentAmount)}`
  : `${installmentCount}x de ${formatCurrency(installmentValue)}`
}
```

At minimum, apply `roundCurrency` to `installmentValue` so the displayed amount is not a raw float.

---

### CR-02: Double Stock Restock in `handleRefund` (Sales.tsx:117-127)

**File:** `src/pages/Sales.tsx:117-127`

**Issue:** `handleRefund` (estorno) restores stock for ALL sale items unconditionally, ignoring any quantities already restocked via prior partial devolução records (`ReturnRecord`s). This was explicitly documented in FINANCIAL-PITFALLS.md §2 ("Double Stock Restock"):

```typescript
// Current code — restores full saleItem.quantity for every item
const updatedProducts = products.map(product => {
  const saleItem = sale.items.find(item => item.productId === product.id);
  if (saleItem) {
    return {
      ...product,
      stock: product.stock + saleItem.quantity  // BUG: ignores already-restocked qty
    };
  }
  return product;
});
```

Scenario: Sale has 5 units of Product A. Operator partially returns 2 units via `Returns` page → stock restored to +2. Then operator does full estorno from `Sales` page → stock restored by another +5. Net effect: +7 units added to stock for a sale of 5 units.

`getReturnedQuantities` (line 201 in `Sales.tsx`) is already defined in scope and correctly excludes reversed returns. It should be called here.

**Fix:**

```typescript
const handleRefund = (sale: Sale) => {
  const alreadyReturnedQtys = getReturnedQuantities(sale.id); // ADD THIS

  const updatedProducts = products.map(product => {
    const saleItem = sale.items.find(item => item.productId === product.id);
    if (!saleItem) return product;

    const alreadyReturned = alreadyReturnedQtys[saleItem.productId] || 0;
    const qtyToRestore = saleItem.quantity - alreadyReturned;
    if (qtyToRestore <= 0) return product; // already fully restocked

    // mil unit: stock is tracked in thousands
    const restock = product.unit === 'mil' ? qtyToRestore / 1000 : qtyToRestore;
    return { ...product, stock: product.stock + restock };
  });
  setProducts(updatedProducts);
  // ... rest unchanged
};
```

Note: the existing code also does not apply the `mil` unit scaling (it adds `saleItem.quantity` instead of `saleItem.quantity / 1000`), compounding the bug for mil-unit products. The fix above addresses both issues.

---

## Warnings

### WR-01: `processReturn` Stock Restock for `mil` Units Uses Raw Float Division (processReturn.ts:107-109)

**File:** `src/lib/processReturn.ts:107-109`

**Issue:**

```typescript
const restock = product.unit === 'mil'
  ? returnItem.quantity / 1000
  : returnItem.quantity;
return { ...product, stock: product.stock + restock, updatedAt: now };
```

`returnItem.quantity / 1000` introduces an IEEE 754 float for non-round quantities. E.g., if 1501 units of a milheiro product are returned, `1501 / 1000 = 1.501` — which is exact. But `1100 / 1000 = 1.1` — which is not exactly representable in binary float. Accumulated over many returns, `product.stock` may drift. FINANCIAL-PITFALLS.md §4 identifies this as a documented hazard.

**Fix:**

```typescript
import { roundCurrency } from '@/lib/formatters'; // already imported

const restock = product.unit === 'mil'
  ? Math.round(returnItem.quantity) / 1000  // quantity must be integer for mil units
  : returnItem.quantity;
```

Or, since `roundCurrency` is already imported and available:

```typescript
const restock = product.unit === 'mil'
  ? roundCurrency(returnItem.quantity / 1000)
  : returnItem.quantity;
```

`roundCurrency` (2 decimal places) is appropriate since milheiro stock is tracked as e.g. `2.500` (2500 units / 1000). Apply the same pattern to `handleReverseReturn` in `Returns.tsx:190`.

---

### WR-02: `Returns.tsx` Filters Eligible Sales to `completed | crediario_paid` Only — Silently Blocks `crediario_pending` Returns (Returns.tsx:60-62)

**File:** `src/pages/Returns.tsx:60-62`

**Issue:**

```typescript
const eligibleSales = sales
  .filter(s => s.status === 'completed' || s.status === 'crediario_paid')
  .sort(...);
```

`Sales.tsx:canReturn` (line 286-290) allows returns on sales with any non-`refunded` status, including `crediario_pending`. This means a `crediario_pending` sale can be returned from the Sales page but is invisible in the Returns page. This is a behavioral divergence from the original code that was not flagged as intentional.

The 01-CONTEXT.md mandates **behavioral parity**: "Esta fase apenas EXTRAI e unifica o comportamento atual sem mudar regras financeiras." If `crediario_pending` returns were allowed before, they must remain allowed through both entry points.

**Fix:** Align `eligibleSales` with `canReturn`:

```typescript
const eligibleSales = sales
  .filter(s => s.status !== 'refunded')
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

Note: you may want to additionally filter out sales with all items already returned (as `canReturn` does), but the current filter excludes too broadly.

---

### WR-03: `Sale.discount` Stored Without Rounding (POS.tsx:120-124, 388-390)

**File:** `src/pages/POS.tsx:120-124`

**Issue:**

```typescript
const finalDiscountValue = isPercentage
  ? (subtotal * discountValue) / 100
  : discountValue;

const total = Math.max(0, subtotal - finalDiscountValue);
```

`finalDiscountValue` and `total` are raw floats stored directly into the `Sale` record (lines 388-390). For a percentage discount on a subtotal that is itself a sum of `roundCurrency`-rounded items, the intermediate multiplication `subtotal * discountValue / 100` can produce unbounded decimal places. These raw floats are then persisted in `electron-store` and later summed in reports, which can accumulate R$ 0.01 drift.

Example: subtotal = R$ 199.97, discount = 15% → `199.97 * 15 / 100 = 29.995499...` → stored as `29.995499...` → `toFixed(2)` in PDF shows `R$ 30.00` but stored value disagrees.

**Fix:**

```typescript
const finalDiscountValue = roundCurrency(isPercentage
  ? (subtotal * discountValue) / 100
  : discountValue);

const total = Math.max(0, roundCurrency(subtotal - finalDiscountValue));
```

---

### WR-04: `handleReturnFromSale` Toast Shows Unrounded `returnTotal`, Not `returnRecord.totalRefunded` (Sales.tsx:274-279)

**File:** `src/pages/Sales.tsx:274-279`

**Issue:**

```typescript
toast({
  title: "Devolução registrada",
  description: hasClient
    ? `${formatCurrency(returnTotal)} adicionado ao crédito em haver do cliente.`
    : `Estoque restaurado. (Sem cliente, crédito não gerado)`,
});
```

`returnTotal` (line 230-232) is computed as:
```typescript
const returnTotal = returnItems
  .filter(ri => ri.selected && ri.quantity > 0)
  .reduce((sum, ri) => sum + ri.quantity * ri.item.unitPrice, 0);
```

This is the raw unrounded float. `processReturn` already rounds the same value internally and returns `returnRecord.totalRefunded`. The toast shows `returnTotal` which may be R$ 0.01 different from what was actually credited to the client. The client's `storeCredit` is incremented by `returnRecord.totalRefunded` (via `updatedClients`), but the operator sees a different value in the toast confirmation.

**Fix:**

```typescript
toast({
  title: "Devolução registrada",
  description: hasClient
    ? `${formatCurrency(returnRecord.totalRefunded)} adicionado ao crédito em haver do cliente.`
    : `Estoque restaurado. (Sem cliente, crédito não gerado)`,
});
```

---

### WR-05: `Returns.tsx` Quantity Input Allows `val = 0` Reaching `processReturn` (Returns.tsx:465-471)

**File:** `src/pages/Returns.tsx:465-471`

**Issue:**

```typescript
onChange={(e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val) && val >= 0) {   // <-- val >= 0 allows quantity 0
    const returnedQtys = getReturnedQuantities(selectedSale.id);
    const maxReturnable = ri.item.quantity - (returnedQtys[ri.item.productId] || 0);
    setReturnItems(returnItems.map((item, i) =>
      i === index ? { ...item, quantity: Math.min(val, maxReturnable) } : item
    ));
  }
}}
```

Setting quantity to 0 creates a `returnItem` with `quantity: 0` that remains in `itemsToReturn` (selected). `handleReturn` filters `itemsToReturn.filter(ri => ri.selected && ri.quantity > 0)` so it is caught there, but `processReturn` will silently receive a zero-quantity item if called with `ri.quantity > 0` filtering omitted elsewhere. More immediately, a 0-quantity selected item produces a confusing UI state where the item appears selected but contributes R$ 0.00 to the total — the operator may not notice.

**Fix:** Change the guard to `val >= 1`:

```typescript
if (!isNaN(val) && val >= 1) {
```

Alternatively, use `Math.max(1, Math.min(val, maxReturnable))` as `Sales.tsx:544-547` does.

---

## Info

### IN-01: `Returns.tsx` Reimplements `formatCurrency` Locally Instead of Importing (Returns.tsx:50-55)

**File:** `src/pages/Returns.tsx:50-55`

**Issue:** `Returns.tsx` defines its own local `formatCurrency`:

```typescript
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};
```

This is identical to the shared implementation in `src/lib/formatters.ts`. The CONVENTIONS.md notes this duplication: "formatCurrency is reimplemented locally in src/pages/Returns.tsx (not imported from src/lib/formatters.ts)." Phase 1 adds `roundCurrency` to `formatters.ts` and both `Sales.tsx` and `processReturn.ts` import from there. `Returns.tsx` was not updated to import `formatCurrency` as well, leaving the duplication in place.

**Fix:**

```typescript
import { formatCurrency } from '@/lib/formatters';
// Remove the local formatCurrency definition at lines 50-55
```

---

### IN-02: Cart Quantity Input Uses `parseInt` — Breaks Future Fractional Units (POS.tsx:664)

**File:** `src/pages/POS.tsx:664`

**Issue:**

```typescript
onChange={(e) => {
  const val = parseInt(e.target.value);
  if (!isNaN(val)) updateItemQuantity(item.productId, val);
}}
```

`parseInt` truncates decimals, which is correct for integer-unit products but will silently truncate valid fractional quantities for `kg`, `mt`, `lt` units (planned for Phase 5). FINANCIAL-PITFALLS.md §4 calls out `parseInt` → `parseFloat` as a required fix. While Phase 5 is out of scope here, this is a pre-existing pattern that Phase 1 left unchanged despite adding `roundCurrency` to adjacent code — noting it so Phase 5 has a clear target.

**Fix (at Phase 5, flag now):** Replace `parseInt` with `parseFloat` and add unit-aware rounding:

```typescript
const val = parseFloat(e.target.value);
if (!isNaN(val) && val > 0) updateItemQuantity(item.productId, val);
```

---

### IN-03: PDF Height Base Constants — `generateReceipt` May Undersize for Crediário Sales With Many Payment Entries (generateReceipt.ts:14-21)

**File:** `src/lib/generateReceipt.ts:14-21`

**Issue:** The `receiptBase = 140` accounts for: "header, client, separators, totals block, payment block, optional card-fee block, optional crediário note, and footer." The split payment block (lines 134-139) adds `4mm` per payment entry with `y += 3`. A sale with 6 split payment entries (the max `paymentMethods` array has 6) consumes an additional `6 × 3 = 18mm` beyond the `y += 4` single-payment path. With a base of 140mm and 30 items (`30 × 8 = 240mm`), total estimate = 380mm vs. actual content ≈ 398mm for 6 split entries. The crediário note (lines 157-170) adds another ~18mm when present. In a worst-case scenario (30 items + 6 split entries + crediário note), content could exceed the estimated height by up to 36mm.

The `Math.max(250, estimatedHeight)` floor ensures at least 250mm, which is sufficient for small sales, but for large sales the extra content from split entries is not counted.

**Fix:** Add split-payment and crediário overhead to the height estimate:

```typescript
const splitPaymentOverhead = (sale.paymentEntries && sale.paymentEntries.length > 1)
  ? sale.paymentEntries.length * 3
  : 0;
const crediarioOverhead = sale.status === 'crediario_pending' ? 18 : 0;
const cardFeeOverhead = (sale.cardFeePercent != null) ? 8 : 0;

const estimatedHeight = receiptBase
  + (sale.items.length * perItem)
  + splitPaymentOverhead
  + crediarioOverhead
  + cardFeeOverhead;
```

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
