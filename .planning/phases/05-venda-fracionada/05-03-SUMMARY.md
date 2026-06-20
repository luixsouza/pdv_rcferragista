---
phase: 05-venda-fracionada
plan: "03"
subsystem: quotes
tags: [fractional-qty, quotes, rounding, units, FRAC-02, FRAC-04]
dependency_graph:
  requires: ["05-01"]
  provides: [fractional-qty-quotes, rounded-quote-totals]
  affects: [src/pages/Quotes.tsx]
tech_stack:
  added: []
  patterns: [parseQuantity, quantityStep, clampQuantityForUnit, roundCurrency]
key_files:
  created: []
  modified:
    - src/pages/Quotes.tsx
decisions:
  - "05-03: IIFE pattern used in JSX to compute step per item without intermediate variable declaration outside map"
  - "05-03: updateItemQuantity clamps before stock check to avoid discrete-unit out-of-range comparisons on floored values"
metrics:
  duration: "~5 min"
  completed: "2026-06-20"
  tasks: 2
  files: 1
---

# Phase 05 Plan 03: Fractional Quantity + Rounded Totals in Quotes Summary

**One-liner:** Quotes.tsx wired to units.ts helpers for decimal input (parseQuantity, quantityStep, clampQuantityForUnit) and roundCurrency on all line totals — parity with PDV (FRAC-04, FRAC-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire fractional quantity + rounded totals into Quotes cart | c81176f | src/pages/Quotes.tsx |
| 2 | Build verification | c81176f | — (no code changes; build exit 0) |

## What Was Built

**src/pages/Quotes.tsx** — All five action points from the plan applied:

(a) Quantity `<Input>` onChange: replaced `parseInt` with `parseQuantity` (accepts "1,5" for mt products). Added `step={quantityStep(...)}` and `min="0"` attributes.

(b) +/- buttons: `step` computed per item via `quantityStep(product.unit)` using an IIFE in JSX. Minus calls `updateQuantity(id, -step)`, Plus calls `updateQuantity(id, step)`.

(c) `updateItemQuantity`: calls `clampQuantityForUnit(newQuantity, product.unit)` before applying — discrete units are floored to integer, fractional units pass through. Line total set to `roundCurrency(clampedQuantity * unitPrice)`.

(d) `updateQuantity`: float drift guard `Math.round(result * 100) / 100` on the accumulated quantity. Line total set to `roundCurrency(newQuantity * unitPrice)`.

(e) `addToCart`: initial `total: roundCurrency(unitPrice)` and incremented `total: roundCurrency((qty+1) * unitPrice)`.

## Acceptance Criteria Check

- `import ... from '@/lib/units'` present in Quotes.tsx: YES
- `roundCurrency` imported from formatters: YES
- Quantity input onChange uses `parseQuantity`, not `parseInt`: YES (grep confirms)
- +/- buttons use unit-derived step via `quantityStep`: YES
- `updateItemQuantity` and `updateQuantity` set line total via `roundCurrency` and clamp discrete units: YES
- `npm run build` exits 0: YES

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- src/pages/Quotes.tsx: FOUND
- Commit c81176f: FOUND
