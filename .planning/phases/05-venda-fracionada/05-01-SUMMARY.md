---
phase: 05-venda-fracionada
plan: "01"
subsystem: lib/units
tags: [fractional-units, quantity-helpers, pure-module, FRAC-01]
dependency_graph:
  requires: []
  provides: [src/lib/units.ts]
  affects: [src/pages/POS.tsx, src/pages/Quotes.tsx, src/pages/Products.tsx]
tech_stack:
  added: []
  patterns: [pure-helper-module, named-exports, JSDoc-@param/@returns, ReadonlySet]
key_files:
  created: [src/lib/units.ts]
  modified: []
decisions:
  - "quantityStep returns 0.5 for fractional units (mt/kg/lt/m2/m²) — half-unit step matches how pipe/rope/fabric is sold at hardware stores; operators can still type arbitrary values like 1.25"
  - "clampQuantityForUnit uses Math.floor (not Math.round) for discrete units so typing 1.5 un yields 1, never 2 — operator is never over-charged"
  - "mil excluded from FRACTIONAL_UNITS — it is a per-milheiro selling unit; cart quantities stay whole; ÷1000 applies only to price and stock deduction"
  - "parseQuantity returns NaN (not 0) for unparseable input so callers can distinguish zero from invalid input via isNaN guard"
metrics:
  duration: "~3 min"
  completed: "2026-06-20T16:38:56Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
requirements_satisfied: [FRAC-01]
---

# Phase 05 Plan 01: Fractional-Unit Helpers (units.ts) Summary

Pure helper module establishing the single source of truth for fractional-quantity behavior, based on the FRAC-01 "conforme a unidade" decision: `isFractionalUnit`, `quantityStep`, `parseQuantity`, `clampQuantityForUnit`, and `FRACTIONAL_UNITS` — all exported from `src/lib/units.ts` with no React or page imports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create src/lib/units.ts with fractional-unit helpers | 8e3a47b | src/lib/units.ts (created, 97 lines) |
| 2 | Smoke-verify helper behavior and build | — | No code changes; verification only |

## Behavioral Assertions (all 31 passed)

| Case | Expected | Actual |
|------|----------|--------|
| isFractionalUnit('mt') | true | PASS |
| isFractionalUnit('kg') | true | PASS |
| isFractionalUnit('lt') | true | PASS |
| isFractionalUnit('m2') | true | PASS |
| isFractionalUnit('m²') | true | PASS |
| isFractionalUnit('un') | false | PASS |
| isFractionalUnit('cx') | false | PASS |
| isFractionalUnit('mil') | false | PASS |
| isFractionalUnit('') | false | PASS |
| isFractionalUnit('MT') — uppercase | true | PASS |
| quantityStep('mt') | 0.5 | PASS |
| quantityStep('un') | 1 | PASS |
| quantityStep('mil') | 1 | PASS |
| parseQuantity('1,5') | 1.5 | PASS |
| parseQuantity('2.5') | 2.5 | PASS |
| parseQuantity('abc') | NaN | PASS |
| clampQuantityForUnit(1.5, 'un') | 1 | PASS |
| clampQuantityForUnit(1.5, 'mt') | 1.5 | PASS |
| clampQuantityForUnit(0.5, 'un') | 0 | PASS |
| clampQuantityForUnit(-1, 'un') | 0 | PASS |
| clampQuantityForUnit(1.5, 'mil') | 1 | PASS |

## Build Verification

`npm run build` exits 0. The large-chunk warning (>500 kB) is pre-existing and unrelated to this plan.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This is a pure helper module with no UI rendering.

## Threat Flags

None. Pure computation module with no network endpoints, auth paths, file access, or storage mutations.

## Self-Check: PASSED

- [x] `src/lib/units.ts` exists with all five named exports
- [x] Commit 8e3a47b verified: `git log --oneline | grep 8e3a47b`
- [x] `npm run build` exits 0
- [x] All 31 behavioral assertions pass
