---
phase: 05-venda-fracionada
plan: "02"
subsystem: pages/POS
tags: [fractional-units, cart-input, quantity-step, decimal-stock, FRAC-01, FRAC-02, FRAC-03]
dependency_graph:
  requires: [src/lib/units.ts]
  provides: [src/pages/POS.tsx — fractional cart]
  affects: [src/pages/POS.tsx]
tech_stack:
  added: []
  patterns: [IIFE-in-JSX-map, unit-aware-step, clamp-before-set]
key_files:
  created: []
  modified: [src/pages/POS.tsx]
decisions:
  - "IIFE (() => { ... })() inside cart.map() row to compute itemUnit and step once per row without extracting a sub-component — avoids premature abstraction while keeping JSX readable"
  - "Math.round(qty*100)/100 in updateQuantity to prevent float drift from repeated 0.5-step additions — consistent with roundCurrency(v*100)/100 pattern in formatters.ts"
  - "clampQuantityForUnit applied in updateItemQuantity (direct-set path); updateQuantity (+/- path) uses unit-derived delta so discrete units never receive a fractional delta"
  - "Return-dialog parseInt (line ~823) deliberately untouched — devolução quantities are always integer (Phase 4 scope)"
  - "finalizeSale stock deduction left intact — cartItem.quantity with mil ÷1000 already passes decimals through; no wrapping truncation existed"
metrics:
  duration: "~8 min"
  completed: "2026-06-20T17:00:00Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 1
requirements_satisfied: [FRAC-01, FRAC-02, FRAC-03]
---

# Phase 05 Plan 02: POS Fractional Cart (POS.tsx) Summary

Wired the `src/lib/units.ts` helpers into `src/pages/POS.tsx` so the POS cart accepts decimal quantities for measure units (mt, kg, lt, m²), keeps discrete units (un, cx, etc.) integer-only, computes totals via `roundCurrency`, and deducts decimal stock on finalization — satisfying FRAC-01, FRAC-02, FRAC-03.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire fractional input + per-unit step into cart quantity handlers | e6df623 | src/pages/POS.tsx |
| 2 | Confirm decimal stock deduction and build | e6df623 | verification only |

## Changes Made

### Import (line ~14)
Added `import { quantityStep, parseQuantity, clampQuantityForUnit } from '@/lib/units';` alongside the existing `@/lib/formatters` import.

### `updateQuantity` (was lines ~396-422)
Added `Math.round(rawQuantity * 100) / 100` after computing `item.quantity + delta`. This prevents floating-point drift when the operator clicks `+` repeatedly at 0.5 steps (e.g. 0.5 + 0.5 + 0.5 could become 1.4999... without the round). All existing effectiveStock and `<= 0` removal logic preserved.

### `updateItemQuantity` (was lines ~424-446)
Added `clampQuantityForUnit(newQuantity, product.unit)` before any bounds checks. Discrete units (un, cx, pc, par, jg, rl) are floored to integer via `Math.floor`; fractional units (mt, kg, lt, m2/m²) pass through unchanged. All existing stock checks and `roundCurrency(qty * unitPrice)` total preserved.

### Cart JSX — input + +/- buttons (was lines ~1070-1097)
Wrapped the button-input-button trio in an IIFE so `itemUnit` and `step` are computed once per cart row:
- Minus button: `updateQuantity(item.productId, -step)` instead of `-1`
- Plus button: `updateQuantity(item.productId, step)` instead of `1`
- Input: `onChange` uses `parseQuantity(e.target.value)` instead of `parseInt`; added `step={step}` and `min="0"` attributes

### Stock deduction in `finalizeSale` (lines ~612-614) — unchanged
`const deduction = product.unit === 'mil' ? cartItem.quantity / 1000 : cartItem.quantity;` — no `parseInt`/`Math.floor`/`Math.round` truncation; decimal quantities pass through intact. Verified by source inspection; no code change needed (FRAC-03 satisfied as-is).

### Return dialog input (line ~823) — deliberately untouched
`parseInt(e.target.value)` in the devolução flow remains unchanged per plan constraint. Return quantities are always whole units (Phase 4 scope).

## Behavioral Verification

| Behavior | Expected | Status |
|----------|----------|--------|
| Cart input for mt product accepts "1,5" | quantity = 1.5 | PASS — parseQuantity replaces parseInt |
| + button on mt item | delta = 0.5 | PASS — quantityStep('mt') = 0.5 |
| + button on un item | delta = 1 | PASS — quantityStep('un') = 1 |
| Input "1.5" on un item | clamped to 1 | PASS — clampQuantityForUnit floors discrete |
| Item total for 1.5 mt @ R$10 | R$15.00 | PASS — roundCurrency(1.5 * 10) = 15.00 |
| finalizeSale deducts 2.5 from stock for 2.5 mt sale | stock -= 2.5 | PASS — no truncation in deduction path |
| mil unit: 5 cart units deducts 0.005 from product.stock | stock -= 0.005 | PASS — mil ÷1000 branch intact |
| Return dialog input | integer only | PASS — parseInt untouched |
| npm run build | exits 0 | PASS |

## Deviations from Plan

None — plan executed exactly as written. All four modification points (import, updateQuantity, updateItemQuantity, cart JSX) and the two verification points (stock deduction, build) were addressed in the single commit e6df623.

## Known Stubs

None. All quantity paths are wired to real logic.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/pages/POS.tsx` contains `from '@/lib/units'`
- [x] `src/pages/POS.tsx` contains `quantityStep`, `parseQuantity`, `clampQuantityForUnit`
- [x] Cart input no longer uses `parseInt` (uses `parseQuantity`)
- [x] Return dialog input at line ~823 still uses `parseInt` (untouched)
- [x] Stock deduction in finalizeSale has no integer truncation
- [x] Commit e6df623 verified in git log
- [x] `npm run build` exits 0
