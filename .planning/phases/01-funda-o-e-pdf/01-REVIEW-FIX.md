---
phase: 01-funda-o-e-pdf
fixed_at: 2026-06-20T00:00:00Z
review_path: .planning/phases/01-funda-o-e-pdf/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 4
skipped: 3
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-06-20
**Source review:** `.planning/phases/01-funda-o-e-pdf/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 7
- Fixed: 4
- Skipped/deferred: 3 (intentionally deferred to later phases per directive)

## Fixed Issues

### CR-01: `installmentValue` Display Uses Raw Unrounded Float

**Files modified:** `src/pages/POS.tsx`
**Commit:** `af1ae05`
**Applied fix:** Wrapped `crediarioFinanced / installmentCount` in `roundCurrency(...)` at line 147. The installment preview now displays the base centavo-rounded installment amount, consistent with what gets stored for installments 1..N-1.

### WR-01: `processReturn` Stock Restock for `mil` Units Uses Raw Float Division

**Files modified:** `src/lib/processReturn.ts`
**Commit:** `82aed98`
**Applied fix:** Wrapped `returnItem.quantity / 1000` in `roundCurrency(...)` at line 108. Stock for milheiro products is now restored to 2-decimal precision, avoiding IEEE 754 drift over accumulated returns.

### WR-03: `Sale.discount` and `Sale.total` Stored Without Rounding

**Files modified:** `src/pages/POS.tsx`
**Commit:** `a42c367`
**Applied fix:** Wrapped `finalDiscountValue` computation in `roundCurrency(...)` and the `total` assignment in `roundCurrency(...)` at lines 120-124. Percentage discounts (e.g. 15% of R$199.97) now store a clean centavo value instead of a raw float like `29.9955...`.

### WR-04: Toast Shows Unrounded `returnTotal` Instead of `returnRecord.totalRefunded`

**Files modified:** `src/pages/Sales.tsx`
**Commit:** `c805ea1`
**Applied fix:** Changed the toast `description` in `handleReturnFromSale` to use `formatCurrency(returnRecord.totalRefunded)` instead of `formatCurrency(returnTotal)`. The operator now sees exactly the amount that was credited to the client's `storeCredit`.

## Skipped Issues (Intentionally Deferred)

### CR-02: Double Stock Restock in `handleRefund`

**File:** `src/pages/Sales.tsx:117-127`
**Reason:** Intentionally deferred — planned as EST-04 in Phase 3. Touching `handleRefund` now would conflict with the planned Phase 3 estorno rework.

### WR-02: `Returns.tsx` Filters Eligible Sales Excluding `crediario_pending`

**File:** `src/pages/Returns.tsx:60-62`
**Reason:** Intentionally deferred — planned as DEV-06 in Phase 4 devolução UI work.

### WR-05: `Returns.tsx` Quantity Input Allows `val = 0`

**File:** `src/pages/Returns.tsx:465-471`
**Reason:** Intentionally deferred — Phase 4 devolução UI work.

---

## Build Verification

`npm run build` exited 0 after all 4 fixes were applied. No TypeScript errors. Chunk size warning is pre-existing (unrelated to these fixes).

---

_Fixed: 2026-06-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
