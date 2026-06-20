---
phase: 01-funda-o-e-pdf
plan: 01
subsystem: core-math
tags: [rounding, types, crediario, pos]
dependency_graph:
  requires: []
  provides: [roundCurrency, ReturnRecord.cancelledInstallmentIds, centavo-correct-cart, centavo-correct-installments]
  affects: [src/lib/formatters.ts, src/types/index.ts, src/pages/POS.tsx]
tech_stack:
  added: []
  patterns: [round-half-up centavo boundary, last-installment residual absorption]
key_files:
  created: []
  modified:
    - src/lib/formatters.ts
    - src/types/index.ts
    - src/pages/POS.tsx
decisions:
  - "Use Math.round(value * 100) / 100 (no external library) — mirrors cardFees.ts pattern"
  - "Last installment absorbs residual: roundCurrency(total - base * (N-1)) ensures exact sum"
  - "cancelledInstallmentIds optional field — retrocompatible with existing electron-store records"
metrics:
  duration_seconds: 227
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 01 Plan 01: Fundacao Rounding and Type Foundation Summary

**One-liner:** Single `roundCurrency` primitive exported from formatters.ts with last-installment residual absorption in POS crediario generation and centavo-correct cart totals throughout POS.tsx.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add roundCurrency helper and ReturnRecord field | 54c4309 | src/lib/formatters.ts, src/types/index.ts |
| 2 | Apply roundCurrency to POS cart totals and installment generation | 7d611d3 | src/pages/POS.tsx |

## What Was Built

### Task 1 — roundCurrency helper + ReturnRecord type

Added `export const roundCurrency = (value: number): number => Math.round(value * 100) / 100` to `src/lib/formatters.ts` with a JSDoc explaining the round-half-up BRL convention and the float trap it avoids. No new dependency introduced.

Added `cancelledInstallmentIds?: string[]` (optional) to `ReturnRecord` in `src/types/index.ts` after `reversedAt?`. Existing electron-store records without this field continue to deserialise correctly — the field is additive and optional (FND-03 retrocompatibility).

`SaleItem.quantity` confirmed already typed `number` — no change made, no migration needed.

### Task 2 — POS.tsx cart totals and installment generation

Imported `roundCurrency` alongside `formatCurrency` from `@/lib/formatters`.

Applied `roundCurrency(quantity * unitPrice)` at all four cart total computation sites:
- `addToCart` existing-item branch
- `addToCart` new-item branch
- `updateQuantity`
- `updateItemQuantity`

Implemented last-installment residual absorption in the crediario installment generation loop:
- `baseInstallment = roundCurrency(crediarioFinanced / installmentCount)` assigned to installments 1..(N-1)
- Last installment (N) receives `roundCurrency(crediarioFinanced - baseInstallment * (installmentCount - 1))`
- Entry installment (number 0) amount rounded with `roundCurrency(entryAmount)`

Manual verification scenario F1: R$100 / 3 installments → 33.33 + 33.33 + 33.34 = 100.00 exactly.
Manual verification scenario F2: 2.5 × R$12.99 → `Math.round(32.475 * 100) / 100 = 32.48`.

## Verification

- `npm run build` exits 0 with all changes (both tasks verified individually).
- No visible behavior change beyond centavo correctness.
- No new dependencies introduced.
- Threat mitigation T-01-01 (installment sum integrity) satisfied by last-installment residual absorption.
- Threat T-01-02 (ReturnRecord type change) accepted — optional field, additive.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder values or hardcoded empties introduced.

## Threat Flags

No new security-relevant surface introduced. Changes are purely computational (arithmetic + type extension). No new network endpoints, auth paths, or schema changes at trust boundaries beyond those already enumerated in the plan's threat model.

## Self-Check: PASSED

- src/lib/formatters.ts exists and contains `export const roundCurrency`
- src/types/index.ts ReturnRecord contains `cancelledInstallmentIds?: string[]`
- src/pages/POS.tsx imports `roundCurrency` from `@/lib/formatters`
- Commits 54c4309 and 7d611d3 both present in git log
- npm run build exits 0
