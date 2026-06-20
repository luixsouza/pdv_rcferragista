---
phase: 05-venda-fracionada
reviewed: 2026-06-20T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/units.ts
  - src/pages/POS.tsx
  - src/pages/Quotes.tsx
  - src/pages/Products.tsx
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: all_fixed
---

# Phase 5: Venda Fracionada — Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 5 introduces `src/lib/units.ts` as a clean, well-documented helper (isFractionalUnit, quantityStep,
parseQuantity, clampQuantityForUnit) and correctly wires it into POS.tsx, Quotes.tsx, and Products.tsx.
The `mil` unit is correctly excluded from fractional treatment; stock deduction in `finalizeSale` is correct
(no double-application of the ÷1000 scaling). The `clampQuantityForUnit` floor-on-discrete path works.

Two critical bugs were found: (1) `parseQuantity` in units.ts uses `String.replace` with a string argument
which only replaces the *first* comma — its own comment claims it replaces the *last* comma, which is
factually wrong — corrupting values typed with a thousands separator (e.g. "1.500,50" typed as "1,500.50").
(2) POS.tsx rejects adding a fractional-unit product when `effectiveStock < 1`, silently blocking legitimate
sales of partial remaining stock (e.g. 0.7 kg remaining).

Two warnings exist: Quotes.tsx does not apply `roundCurrency` to `finalDiscountValue` or `total` (POS.tsx
does), causing unrounded floats to be persisted in the quote record. The `addToCart` function in both
POS.tsx and Quotes.tsx increments existing cart items by hardcoded `+1` instead of `+quantityStep(unit)`,
meaning re-selecting a fractional product from the search popup jumps by 1 instead of 0.5.

---

## Critical Issues

### CR-01: parseQuantity comma replace only hits first comma — thousands-separator input silently truncates

**File:** `src/lib/units.ts:74`

**Issue:** `raw.replace(',', '.')` uses a string literal as the first argument to `String.replace`. JavaScript's
`String.prototype.replace` with a string pattern replaces only the **first** occurrence. The code comment
(line 73) claims "Only replaces the last comma so '1.000,50' also works" — this is wrong in two ways:
(a) it replaces the *first* comma, not the last; (b) for a value like "1.000,50" (BRL thousands notation)
the replace turns it into "1.00.50", which `parseFloat` reads as `1.00` (stops at the second dot), silently
losing the fractional part. For the typical single-comma input "1,5" → "1.5" the function is correct, so
the bug is latent but real for anyone who types a value with a thousands separator in the quantity field.

A safe implementation should strip the thousands separator dots first, then replace the decimal comma:

```typescript
export function parseQuantity(raw: string): number {
  if (!raw) return NaN;
  // Strip thousands-separator dots (BRL: "1.500" → "1500"),
  // then replace the decimal comma with a dot ("1.500,75" → "1500.75").
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}
```

Note: if the app ever uses plain dots as decimal separators (e.g. from the HTML number input in non-BRL
locales) stripping all dots would break those. A more robust guard would limit the replace to only when a
comma is present:

```typescript
export function parseQuantity(raw: string): number {
  if (!raw) return NaN;
  const hasComma = raw.includes(',');
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  return parseFloat(normalized);
}
```

---

### CR-02: POS.tsx blocks adding fractional-unit products when effectiveStock is between 0 and 1

**File:** `src/pages/POS.tsx:379`

**Issue:** In `addToCart`, when the product is not yet in the cart, the guard is:

```typescript
if (effectiveStock < 1) {
  toast.error('Estoque insuficiente');
  return;
}
```

For a discrete unit this is correct (you cannot sell 0.7 un). For a **fractional unit** (mt, kg, lt, m2),
a product with `stock = 0.7` (e.g. 0.7 kg remaining) has `effectiveStock = 0.7`, which is `< 1`. The
operator cannot add it at all, even though 0.7 kg is a perfectly valid quantity to sell. The stock deduction
in `finalizeSale` is correct and would handle 0.7 properly; the bug is only in the entry guard.

**Fix:** Gate on `<= 0` unconditionally, or gate on `< 1` only for discrete units:

```typescript
// In addToCart, new-item branch:
const isFractional = isFractionalUnit(product.unit); // import from @/lib/units
const minRequired = isFractional ? 0 : 1;            // fractional: > 0 is fine; discrete: >= 1

if (effectiveStock <= 0) {
  toast.error('Estoque insuficiente');
  return;
}
// Optionally warn (not block) when fractional stock < 1 but > 0:
if (!isFractional && effectiveStock < 1) {
  toast.error('Estoque insuficiente');
  return;
}
```

Simplest correct fix that matches the existing style:

```typescript
// Replace lines 379-382 in addToCart:
const stockIsInsufficient = isMilheiro
  ? effectiveStock < 1          // milheiro: must have at least 1 unit of 1000
  : effectiveStock <= 0;        // all other units: > 0 is sufficient (fractional ok)

if (stockIsInsufficient) {
  toast.error('Estoque insuficiente');
  return;
}
```

Note: `isFractionalUnit` must be imported from `@/lib/units`; it is already imported at line 14.

---

## Warnings

### WR-01: Quotes.tsx does not apply roundCurrency to finalDiscountValue or total — unrounded floats persisted

**File:** `src/pages/Quotes.tsx:54-58`

**Issue:** POS.tsx applies `roundCurrency` to `finalDiscountValue` (line 215) and `total` (line 219).
Quotes.tsx computes both without rounding:

```typescript
const finalDiscountValue = isPercentage
  ? (subtotal * discountValue) / 100   // no roundCurrency
  : discountValue;

const total = Math.max(0, subtotal - finalDiscountValue);  // no roundCurrency
```

With fractional quantities (e.g. 1.5 kg at R$2.33 = R$3.495, rounded to R$3.50 per item by roundCurrency),
a 10% discount on a subtotal that itself is a sum of rounded items may produce a finalDiscountValue like
`0.35000000000000003`. This unrounded value is persisted in `quote.discount` and `quote.total` at lines
168-170, and is passed to the PDF generator. The project convention (CLAUDE.md) and FRAC-02 explicitly
require `roundCurrency` on totals.

**Fix:**

```typescript
// src/pages/Quotes.tsx lines 54-58 — mirror the POS.tsx pattern exactly:
const finalDiscountValue = roundCurrency(isPercentage
  ? (subtotal * discountValue) / 100
  : discountValue);

const total = Math.max(0, roundCurrency(subtotal - finalDiscountValue));
```

---

### WR-02: addToCart in POS and Quotes increments existing cart item by hardcoded +1 instead of quantityStep

**File:** `src/pages/POS.tsx:374`, `src/pages/Quotes.tsx:76`

**Issue:** When a product already in the cart is selected again from the search popup, `addToCart` does:

```typescript
{ ...item, quantity: item.quantity + 1, total: roundCurrency((item.quantity + 1) * item.unitPrice) }
```

The hardcoded `+1` ignores the unit's step. For a fractional unit (mt, kg, lt), re-selecting the product
from search jumps the quantity by 1 instead of 0.5. This is inconsistent with the `+/-` buttons which
correctly use `quantityStep`. The operator could unintentionally add 1.0 kg when intending 0.5 kg increments.

Note: this is only triggered by re-clicking a product in the search popup, not by the +/- cart buttons.
The bug does not affect stock safety (stock check precedes the update) but it violates FRAC-01 consistency.

**Fix:**

```typescript
// POS.tsx addToCart, existingItem branch (around line 373):
const step = quantityStep(product.unit);  // already imported
setCart(cart.map(item =>
  item.productId === product.id
    ? {
        ...item,
        quantity: item.quantity + step,
        total: roundCurrency((item.quantity + step) * item.unitPrice)
      }
    : item
));
```

Apply the same fix in Quotes.tsx `addToCart` (line 74-78).

---

## Info

### IN-01: units.ts parseQuantity comment is factually wrong about "last comma"

**File:** `src/lib/units.ts:73`

**Issue:** The comment reads:

```
// Only replaces the last comma so "1.000,50" also works.
```

`String.replace` with a string argument replaces the *first* match, not the last. The comment was presumably
intended to justify that the function handles the BRL thousands-dot + decimal-comma pattern correctly, but
as noted in CR-01 it actually doesn't. Regardless of the fix chosen for CR-01, this comment should be
corrected to accurately describe the behaviour so future readers are not misled.

**Fix:** Update the comment to accurately describe the actual normalization logic once CR-01 is resolved.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
