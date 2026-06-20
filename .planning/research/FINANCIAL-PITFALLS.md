# Financial Pitfalls — Crediário Estorno, Installment Cancellation, Debt Abatement, Decimal Precision

**Domain:** POS crediário (store credit / installment sales) reverse/return flows and fractional quantities
**Researched:** 2026-06-20
**Overall confidence:** HIGH — findings are based directly on the existing source code combined with established financial-correctness patterns for BRL POS systems

---

## 1. Estorno / Devolução — Haver Capping (BUG-1)

### What Goes Wrong

Both `handleReturnFromSale()` in `Sales.tsx` (line 258) and `handleReturn()` in `Returns.tsx` (line 157) set `creditGenerated: hasClient ? totalRefund : 0`. `totalRefund` is computed as `sum of (returnQty × unitPrice)` for the selected items — it represents the **retail value** of the returned goods, not the amount the client actually paid.

For a crediário sale where `crediarioPaid === 0` (nothing yet paid), this wrongly mints R$ X of haver for the client. For a partial-payment sale, it over-credits: client paid R$ 50, returns goods worth R$ 200, receives R$ 200 haver.

The estorno path in `handleRefund()` (Sales.tsx line 143) is largely correct — it credits `totalPaidBack` (sum of `installment.amountPaid`). However it still has a secondary bug: if the sale used a split payment (e.g., R$ 100 cash + R$ 300 crediário, `crediarioPaid` = R$ 50 so far), the refund should split the have logic between cash-paid portion (cash refund) and crediário-paid portion (haver or cash per operator choice).

### Correct Algorithm

**For estorno (`handleRefund`) — crediário sale:**

```
crediarioPaidBack = sum(installments where saleId === sale.id, i => i.amountPaid)

// Cap: never generate haver > what was actually paid as crediário
haverToGenerate = crediarioPaidBack   // NOT sale.crediarioPaid (may be stale)

// For mixed-payment sales (paymentEntries includes cash/pix + crediario):
cashPortion = sum(paymentEntries where method !== 'crediario', e => e.amount)
// Cash portion should be returned as cash (saída de caixa), not as haver
// Operator dialog: "Cliente pagou R$ X em dinheiro. Devolver como: [Dinheiro / Haver]"

if (haverToGenerate > 0 && sale.clientId) {
  // show operator dialog: return as haver or cash
} else {
  // nothing was paid, just cancel debt — no credit, no cash out
}
```

**For devolução (`handleReturn` / `handleReturnFromSale`) — crediário sale:**

```
// Determine crediário payment entries in the original sale
const isCrediarioSale = sale.paymentMethod === 'crediario'
  || sale.paymentEntries?.some(e => e.method === 'crediario')

if (!isCrediarioSale) {
  // Cash/card/pix sale: generate haver = returnTotal as before (existing behavior, correct)
  creditGenerated = returnTotal
} else {
  // Crediário sale: haver = pro-rated paid amount, capped by returnTotal
  const totalSaleValue = sale.total  // or sale.subtotal - sale.discount
  const crediarioPaidSoFar = installments
    .filter(i => i.saleId === sale.id)
    .reduce((s, i) => s + i.amountPaid, 0)

  // Proportion of sale value that was actually paid
  const paidProportion = totalSaleValue > 0
    ? crediarioPaidSoFar / totalSaleValue
    : 0

  // Haver = paid proportion × goods being returned (capped at returnTotal)
  creditGenerated = Math.min(returnTotal, Math.round(returnTotal * paidProportion * 100) / 100)
}
```

**Why use installments sum and not `sale.crediarioPaid`:**
`sale.crediarioPaid` is updated by `handlePayment()` in `CreditNotes.tsx` which checks if all installments are paid before flipping it. It is initialised to `0` at sale creation and incremented per payment. Summing `installment.amountPaid` directly is the ground truth and avoids a stale field race.

### Critical Edge Cases

| Scenario | Expected Haver | Wrong If |
|----------|----------------|----------|
| Zero payments, full return | R$ 0 — cancel debt only | Code generates `returnTotal` as haver |
| Partial payment (R$ 50 of R$ 200), full return | R$ 50 | Code generates R$ 200 |
| Paid in full (crediario_paid), full return | Full `returnTotal` as haver | — correct as-is in estorno path |
| Mixed payment (R$ 100 cash + R$ 200 crediário, R$ 50 crediário paid), return | R$ 100 cash out + R$ 50 haver (or all haver per operator choice) | Code generates R$ 300 haver |
| Partial item return on zero-paid crediário | R$ 0 | Code generates `returnedItemsValue` as haver |

---

## 2. Installment Cancellation on Return (BUG-2)

### What Goes Wrong

`handleRefund()` in Sales.tsx (line 138) correctly cancels installments via `setInstallments(installments.map(inst => inst.saleId === sale.id ? { ...inst, status: 'cancelled' } : inst))`.

Neither `handleReturnFromSale()` (Sales.tsx line 233) nor `handleReturn()` (Returns.tsx line 122) cancels installments at all. When all items are returned (allItemsReturned = true) and the sale is marked `refunded`, the installments remain `open` or `overdue`, creating ghost obligations visible in `CreditNotes.tsx` and inflating `clientCreditUsed` in POS.tsx (line 132–134), which may block new crediário sales.

### Correct Rule

**Cancel installments only when `allItemsReturned === true` (full return).** Partial returns do not cancel installments because the client still owes the remainder of the debt.

```typescript
// In handleReturnFromSale() and handleReturn(), after allItemsReturned check:
if (allItemsReturned && isCrediarioSale) {
  const updatedInstallments = installments.map(inst =>
    inst.saleId === selectedSale.id && (inst.status === 'open' || inst.status === 'overdue')
      ? { ...inst, status: 'cancelled' as const }
      : inst
  );
  setInstallments(updatedInstallments);

  // Record which installments were cancelled for reversibility:
  cancelledInstallmentIds = updatedInstallments
    .filter(i => i.saleId === selectedSale.id && i.status === 'cancelled')
    .map(i => i.id)
  // Store on ReturnRecord (requires schema change below)
}
```

**Do not cancel already-paid installments** (`status === 'paid'`). They are historical records. Only cancel `open` and `overdue`.

### Idempotency

`handleRefund()` runs `installments.map(...)` unconditionally — if called twice, the second call is a no-op since cancelled installments are already cancelled. The devolução fix must follow the same pattern (mapping, not filtering) so re-execution is safe.

Guard at the top of the return handler:

```typescript
const isAlreadyRefunded = selectedSale.status === 'refunded'
// should be impossible if UI prevents it, but defensive
if (isAlreadyRefunded) return
```

### Double Stock Restock (BUG documented in Fragile Areas)

`handleRefund()` (Sales.tsx lines 115–126) restores `product.stock + saleItem.quantity` for ALL sale items — it does not subtract quantities already restocked via prior devolução records.

**Correct stock restoration in estorno:**

```typescript
const alreadyReturnedQtys = getReturnedQuantities(sale.id)
// getReturnedQuantities() is already defined at Sales.tsx line 200 — reuse it

const updatedProducts = products.map(product => {
  const saleItem = sale.items.find(item => item.productId === product.id)
  if (!saleItem) return product

  const alreadyReturned = alreadyReturnedQtys[saleItem.productId] || 0
  const qtyToRestore = saleItem.quantity - alreadyReturned
  if (qtyToRestore <= 0) return product  // already restocked via devolução

  const restock = product.unit === 'mil' ? qtyToRestore / 1000 : qtyToRestore
  return { ...product, stock: product.stock + restock }
})
```

`getReturnedQuantities()` already correctly excludes reversed returns (`!r.reversedAt`), so this is safe.

### ReturnRecord Schema — Add `cancelledInstallmentIds`

Current `ReturnRecord` in `src/types/index.ts` (line 100) has no reference to cancelled installments. `handleReverseReturn()` in Returns.tsx (lines 213–263) restores stock and removes haver, but after BUG-2 is fixed, it would leave installments in `cancelled` state permanently.

**Required schema extension:**

```typescript
export interface ReturnRecord {
  id: string;
  originalSaleId: string;
  clientId: string;
  clientName: string;
  items: SaleItem[];
  totalRefunded: number;
  creditGenerated: number;
  createdAt: string;
  reversedAt?: string;
  cancelledInstallmentIds?: string[];  // ADD THIS — retrocompatible (optional)
}
```

`cancelledInstallmentIds` is optional so existing `ReturnRecord` objects without the field continue to deserialise correctly (retrocompatible with data already in electron-store).

**Restore installments in `handleReverseReturn()`:**

```typescript
// After marking ReturnRecord.reversedAt:
if (ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0) {
  setInstallments(installments.map(inst =>
    ret.cancelledInstallmentIds!.includes(inst.id)
      ? { ...inst, status: 'open' as const }  // restore to open; overdue detection will re-evaluate
      : inst
  ))
}
```

Restoring to `open` (not `overdue`) is correct because the overdue `useEffect` in CreditNotes.tsx will re-evaluate on next mount. Avoid writing `overdue` directly to avoid stale date comparisons.

---

## 3. Return for Debt Abatement (Devolução Modalidade B — Sem Haver)

### Concept

The client returns goods; instead of generating haver (`storeCredit`), the return value reduces open installment balances. This is operationally different from a normal return:

- No `client.storeCredit` increase
- Selected installment(s) get `amountPaid` increased and/or `discountApplied` increased
- A `CreditPayment` record with `type: 'discount'` is created for audit

### Correct Algorithm

```
operator selects: one or more open installments to abate

returnValue = sum(returnedItems × unitPrice)  // capped at total open balance

for each selected installment (sorted: overdue first, then earliest dueDate):
  remaining = installment.amount - installment.amountPaid - (installment.discountApplied || 0)
  abatement = Math.min(remaining, remainingReturnValue)
  if abatement <= 0: continue

  installment.discountApplied = (installment.discountApplied || 0) + abatement
  remainingReturnValue -= abatement

  if (installment.amountPaid + installment.discountApplied >= installment.amount):
    installment.status = 'paid'
    installment.paidAt = now.toISOString()

  // Audit record
  creditPayments.push({
    id: uuid(),
    saleId: installment.saleId,
    installmentId: installment.id,
    clientId: sale.clientId,
    clientName: client.name,
    amount: abatement,
    paymentMethod: 'cash',  // not really cash, but required field — consider adding 'abatement' type
    type: 'discount',
    createdAt: now.toISOString()
  })

// ReturnRecord
returnRecord.creditGenerated = 0  // explicitly zero — no haver generated
```

**Key invariant:** `creditGenerated === 0` on the ReturnRecord distinguishes Modalidade B from Modalidade A. This feeds `handleReverseReturn()` — if `creditGenerated === 0`, no haver is deducted on reversal (reversal must restore the abatement instead).

### Abatement Reversal

Reversing a Modalidade B return is significantly more complex than Modalidade A. The `discountApplied` fields on installments must be decremented. This is why `cancelledInstallmentIds` alone is insufficient — a separate `abatedInstallmentMap?: Record<string, number>` on `ReturnRecord` may be needed to store `{ installmentId: abatementAmount }` for reversal:

```typescript
// On ReturnRecord (future extension, not required for initial implementation):
abatedInstallments?: { installmentId: string; amount: number }[]
```

For the initial implementation, reversal of Modalidade B can be deferred (show a warning that it cannot be reversed automatically).

---

## 4. Decimal / Float Precision in JavaScript (BUG-5 adjacent)

### The Problem

JavaScript uses IEEE 754 double-precision floats. Classic examples:
- `0.1 + 0.2 === 0.30000000000000004`
- `1.005 * 100 === 100.49999999999999` — not 100.50

In this codebase, floating-point errors arise in:

1. **Installment value division:** `installmentValue = crediarioFinanced / installmentCount` — e.g., R$ 100 / 3 = R$ 33.333... Each installment stores `amount: 33.333333333333336`. Summing 3 installments: `99.99999999999999 ≠ 100`.

2. **Fractional quantity × price:** `2.5mt × R$ 12.99 = R$ 32.475` — should round to R$ 32.48 at display, but stored float may cause totals that are R$ 0.01 off.

3. **Split payment validation:** `Math.abs(totalAllocated - total) > 0.01` epsilon guard (POS.tsx, present) is the correct pattern — but epsilon must be chosen per context.

4. **Stock deduction for `mil` unit:** `cartItem.quantity / 1000` — introduces divide-by-1000 floating-point errors for quantities like 1500 (1500/1000 = 1.5 — exact) but `1501/1000 = 1.501` — acceptable.

### Recommended Strategy: "Centavo Integer at Boundary"

**Do NOT introduce a Decimal.js or big.js library.** The existing codebase has no such dependency, and adding one would require migrating all existing stored values and all calculation sites — high risk for a brownfield fix.

**Do:** Apply `Math.round(x * 100) / 100` at every money-producing calculation boundary (not display, but storage). This is already the pattern in `calculateFee()` in `cardFees.ts` (line 62) and bulk price adjustments in `Products.tsx` (line 486). Extend this consistently.

**Rounding helper (add to `src/lib/formatters.ts`):**

```typescript
/**
 * Round a monetary value to 2 decimal places (centavos).
 * Uses "round half up" via Math.round to match BRL currency convention.
 * Avoids the 0.1+0.2 floating-point trap.
 */
export const roundCurrency = (value: number): number =>
  Math.round(value * 100) / 100;
```

**Rounding helper for quantities (add to `src/lib/formatters.ts`):**

```typescript
/**
 * Round a quantity to at most 3 decimal places (e.g., 2.500 kg).
 * Integer units (un, cx, pc, par, jg, rl) should use Math.round() with 0 decimals.
 */
export const roundQuantity = (value: number, decimals: number = 3): number =>
  Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
```

### Application Sites

| Site | Current | Fix |
|------|---------|-----|
| `installmentValue = crediarioFinanced / installmentCount` (POS.tsx ~line 147) | Raw division | `roundCurrency(crediarioFinanced / installmentCount)` |
| Last-installment correction | Missing | Store N-1 equal installments; last = `crediarioFinanced - (N-1) × roundedInstallmentValue` to avoid R$ 0.01 gap |
| `SaleItem.total = quantity × unitPrice` (cart addToCart, updateQuantity) | Raw multiply | `roundCurrency(quantity * unitPrice)` |
| `returnTotal = sum(qty × unitPrice)` (Sales.tsx line 229, Returns.tsx line 118) | Raw multiply in reduce | Apply `roundCurrency` to each term before summing |
| `parseFloat(e.target.value)` for quantity input (POS.tsx BUG-5 fix) | `parseInt` (truncates) | `parseFloat` + `roundQuantity(value, unitDecimals[product.unit])` |
| PDF receipt `value.toFixed(2)` | Existing `.toFixed(2)` | Acceptable for display; keep as-is |

### Unit Decimal Places

Define per-unit max decimal places centrally (add to `src/types/index.ts` or `src/lib/unitConfig.ts`):

```typescript
export const UNIT_DECIMAL_PLACES: Record<string, number> = {
  un: 0,   // unidade — integers only
  cx: 0,   // caixa — integers only
  pc: 0,   // peça — integers only
  par: 0,  // par — integers only
  jg: 0,   // jogo — integers only
  rl: 0,   // rolo — integers only
  mil: 0,  // milheiro — integer count of thousands
  kg: 3,   // kilograma — up to grams
  mt: 3,   // metro — up to millimeters
  lt: 3,   // litro — up to milliliters
  m2: 2,   // metro quadrado — 2 decimals typical
};
```

The `step` attribute on `<Input type="number">` should derive from this map:
```typescript
const step = UNIT_DECIMAL_PLACES[product.unit] === 0 ? '1' : '0.001'
```

### Installment Rounding — Last-Installment Correction

Naive division distributes a R$ 0.01 rounding error. For crediário:

```typescript
const baseInstallment = roundCurrency(crediarioFinanced / installmentCount)
// All installments 1..(N-1) get baseInstallment
// Installment N gets: roundCurrency(crediarioFinanced - baseInstallment * (installmentCount - 1))
// This ensures: sum of all installments === crediarioFinanced exactly
```

Example: R$ 100 / 3 installments
- Base: `roundCurrency(100/3) = roundCurrency(33.333...) = 33.33`
- Installments 1 and 2: R$ 33.33
- Installment 3: `roundCurrency(100 - 33.33 × 2) = roundCurrency(100 - 66.66) = roundCurrency(33.34) = 33.34`
- Sum: 33.33 + 33.33 + 33.34 = 100.00 ✓

---

## 5. Edge Cases — Mandatory Test List

These scenarios must be manually tested (no automated tests exist) after implementing the fixes.

### BUG-1: Haver Capping

| # | Scenario | Setup | Expected Result |
|---|----------|-------|-----------------|
| E1 | Zero-paid crediário full estorno | Sale R$ 200 crediário, 0 payments, estorno | No haver generated. Toast says "parcelas canceladas, nenhum valor pago". |
| E2 | Zero-paid crediário full devolução via Returns.tsx | Same sale, return all items via /returns | No haver. ReturnRecord.creditGenerated = 0. |
| E3 | Partial-paid crediário estorno | Sale R$ 200, R$ 50 paid, estorno | Operator dialog: "R$ 50 pago. Devolver como haver ou dinheiro?" |
| E4 | Fully paid crediário estorno | Sale R$ 200, R$ 200 paid (crediario_paid), estorno | Haver = R$ 200 or operator chooses cash. |
| E5 | Cash sale return via Returns.tsx | Sale R$ 100 cash, return all items | Haver = R$ 100 (existing correct behavior must be preserved). |
| E6 | Split payment (R$ 100 cash + R$ 100 crediário), crediário R$ 0 paid, return | Return all items | Haver = R$ 100 (cash portion only). Crediário debt cancelled. |

### BUG-2: Installment Cancellation

| # | Scenario | Setup | Expected Result |
|---|----------|-------|-----------------|
| I1 | Full devolução cancels installments | Sale with 3 open installments, return all items | All 3 installments → cancelled. Sale → refunded. |
| I2 | Partial devolução does NOT cancel installments | Return 1 of 3 items | Installments remain open. Sale stays crediario_pending. |
| I3 | Partial devolução then full estorno — no double stock | Return 1 item (qty 2 of 5), then estorno sale | Estorno only restores 3 units (not 5). Stock correct. |
| I4 | Return reversal restores installments | Complete case I1, then reverse the ReturnRecord | Installments return to open. Sale status unrefunded. |
| I5 | Estorno after zero-paid crediário | Sale crediario_pending, R$ 0 paid, estorno | Installments cancelled. No haver. No crash. |
| I6 | CreditNotes shows no ghost installments after full devolução | Case I1 | /credit-notes no longer shows those installments as pending. |

### Floating-Point / Quantity

| # | Scenario | Setup | Expected Result |
|---|----------|-------|-----------------|
| F1 | Installment sum equals sale total | R$ 100 / 3 installments | 33.33 + 33.33 + 33.34 = 100.00 exactly |
| F2 | Fractional quantity × price (kg) | 2.5 kg × R$ 12.99 | Total = R$ 32.48 (rounded, not 32.475) |
| F3 | Fractional quantity stock deduction | 2.5 kg sold from 10.0 kg stock | Stock = 7.5 (not 7.499999...) |
| F4 | Split payment total validation | R$ 33.33 + R$ 33.33 + R$ 33.34 | Math.abs(total - allocated) <= 0.01 passes |
| F5 | Integer unit rejects decimal input | POS, product unit=un, user types "2.5" | Input clamped/rounded to 2 |
| F6 | Fractional unit accepts decimal input | POS, product unit=kg, user types "0.75" | Cart shows 0.75 kg, total correct |

### Debt Abatement (Modalidade B)

| # | Scenario | Setup | Expected Result |
|---|----------|-------|-----------------|
| A1 | Return covers one full installment | R$ 50 return, open installment R$ 50 | Installment marked paid, creditGenerated = 0, no haver |
| A2 | Return covers partial installment | R$ 30 return, open installment R$ 50 | Installment.discountApplied += 30, still open |
| A3 | Return exceeds single installment | R$ 120 return, two open installments R$ 50 + R$ 80 | First fully paid, second R$ 30 discount applied |
| A4 | Return on zero-paid crediário (debt abatement) | Sale R$ 200, 0 payments, Modalidade B return R$ 200 | All installments paid via discount, creditGenerated = 0, no haver |

---

## 6. Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Fix BUG-1 haver capping | Breaking cash-sale devolução (correct behavior) by over-checking for crediário | Always check `isCrediarioSale` before applying cap; for cash/pix/card sales, existing `returnTotal` as haver is correct |
| Extract `processReturn.ts` | The two return functions have subtle differences (Returns.tsx validates quantities; Sales.tsx does not) | Run edge cases I1–I6 against both entry points after extraction |
| Installment cancellation (BUG-2) | Setting `status: 'cancelled'` on already-paid installments deletes payment history | Only cancel `open` and `overdue`; skip `paid` |
| ReturnRecord schema addition | `cancelledInstallmentIds` missing from existing records breaks `handleReverseReturn` if it calls `.includes()` | Guard: `if (ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0)` |
| Fractional quantity (BUG-5) | `parseFloat('') = NaN` causes `NaN * price = NaN` total in cart | Always follow `parseFloat(v) || 0` or `isNaN(v) ? 0 : v` |
| installmentValue rounding | Changing rounding creates a R$ 0.01 discrepancy vs existing persisted installments | Only apply to NEW installments; existing stored amounts are unchanged |
| Debt abatement reversal | `discountApplied` field can go negative if not guarded | `Math.max(0, current - abatement)` on reversal; warn if data is inconsistent |

---

## 7. Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| BUG-1 haver capping algorithm | HIGH | Derived from reading actual code in Sales.tsx:233–306 and Returns.tsx:122–210; the exact lines producing the bug are confirmed |
| BUG-2 installment cancellation | HIGH | Confirmed by reading Sales.tsx:136–140 (correct in estorno) vs Returns.tsx:122–210 and Sales.tsx:233–306 (both missing it) |
| Double stock restock risk | HIGH | Confirmed from Fragile Areas section in CONCERNS.md and code in Sales.tsx:115–126 |
| ReturnRecord schema gap | HIGH | `cancelledInstallmentIds` absence confirmed in types/index.ts:100–110; handleReverseReturn in Returns.tsx:213–263 confirmed not restoring installments |
| Decimal rounding strategy | HIGH | Based on IEEE 754 fundamentals + existing `Math.round(x*100)/100` pattern in cardFees.ts:62, which is the correct approach for this codebase |
| Last-installment rounding correction | HIGH | Standard BRL installment arithmetic; confirmed the raw division in POS.tsx:147 does not apply correction |
| Debt abatement algorithm | MEDIUM | Pattern derived from existing `handleApplyDiscount()` in CreditNotes.tsx (lines 176+); adapting that pattern is well-understood but the exact UI flow is still to be designed |

---

## 8. Sources

- `src/pages/Sales.tsx` lines 114–163 (`handleRefund`), 233–306 (`handleReturnFromSale`)
- `src/pages/Returns.tsx` lines 59–61 (`eligibleSales`), 122–210 (`handleReturn`), 213–263 (`handleReverseReturn`)
- `src/pages/POS.tsx` lines 130–148 (crediário calculations), 404–513 (`finalizeSale`)
- `src/lib/cardFees.ts` line 62 (existing `Math.round(x*100)/100` pattern)
- `src/lib/formatters.ts` (existing `formatCurrency` — no rounding helper present)
- `src/types/index.ts` lines 49–110 (`Sale`, `Installment`, `ReturnRecord`)
- `.planning/codebase/CONCERNS.md` BUG-1 through BUG-5 and Fragile Areas
- `.planning/codebase/ARCHITECTURE.md` Sale Estorno Flow, Devolução Flow, Key Abstractions
- `.planning/codebase/CONVENTIONS.md` Money and Decimal Value Handling section
