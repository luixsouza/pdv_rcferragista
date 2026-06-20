---
phase: 05-venda-fracionada
fixed_at: 2026-06-20T00:00:00Z
review_path: .planning/phases/05-venda-fracionada/05-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-06-20
**Source review:** .planning/phases/05-venda-fracionada/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 Critical + 2 Warning + 1 Info)
- Fixed: 4 findings in 3 atomic commits (CR-01 + IN-01 combined; CR-02 + WR-02 POS; WR-01 + WR-02 Quotes)
- Skipped: 0

## Fixed Issues

### CR-01 + IN-01: parseQuantity comma replace only hits first comma

**Files modified:** `src/lib/units.ts`
**Commit:** fae7d6c
**Applied fix:** Replaced `raw.replace(',', '.')` (which only replaces the first comma) with a robust two-step normalization: check if a comma is present; if so, strip all thousands-separator dots with `/\./g` first, then replace the decimal comma. Handles "1,5"→1.5, "1.000,50"→1000.5, "2.5"→2.5, "1000"→1000. Corrected the misleading comment that claimed "Only replaces the last comma" (IN-01).

### CR-02 + WR-02 (POS): Stock guard and step increment in POS.tsx addToCart

**Files modified:** `src/pages/POS.tsx`
**Commit:** d0bbb3f
**Applied fix:**
- CR-02: Changed `effectiveStock < 1` guard to `isMilheiro ? effectiveStock < 1 : effectiveStock <= 0`. Milheiro still requires a whole unit; all other units (including fractional mt/kg/lt) only need stock > 0, so 0.7 kg remaining is now sellable.
- WR-02: Changed hardcoded `+1` increment in the existing-item branch to `quantityStep(product.unit)`, so re-selecting a fractional product from search adds +0.5 (consistent with +/- buttons). `quantityStep` was already imported.

### WR-01 + WR-02 (Quotes): roundCurrency and step increment in Quotes.tsx

**Files modified:** `src/pages/Quotes.tsx`
**Commit:** e5e0d0d
**Applied fix:**
- WR-01: Wrapped `finalDiscountValue` and `total` with `roundCurrency`, mirroring POS.tsx, so float drift (e.g. 0.35000000000000003) is not persisted into the quote record or PDF.
- WR-02: Changed hardcoded `+1` increment in addToCart existing-item branch to `quantityStep(product.unit)`. `quantityStep` was already imported.

## Build Result

`npm run build` exits 0 after all fixes. 2967 modules transformed, no TypeScript errors. Chunk size warning is pre-existing and unrelated to these changes.

---

_Fixed: 2026-06-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
