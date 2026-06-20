---
phase: 05-venda-fracionada
plan: "04"
subsystem: Products
tags: [decimal-stock, parseFloat, unit-aware, FRAC-03]
dependency_graph:
  requires: ["05-01"]
  provides: ["decimal-preserving-stock-edit"]
  affects: ["src/pages/Products.tsx"]
tech_stack:
  added: []
  patterns: ["parseFloat + unit-derived step mirroring price fields"]
key_files:
  modified:
    - src/pages/Products.tsx
decisions:
  - "clampQuantityForUnit applied once at handleSave (not on keystroke) so operator can type freely"
  - "minStock left as-is (no integer concern for stock floor thresholds)"
metrics:
  duration: "~5 min"
  completed: "2026-06-20"
  tasks_completed: 2
  files_modified: 1
---

# Phase 05 Plan 04: Decimal Stock Field in Products Summary

**One-liner:** Stock input in Products.tsx switched from `parseInt` to `parseFloat` with unit-derived `step` and save-time `clampQuantityForUnit` clamp so fractional stock (e.g. 8.5 mt) survives edit-and-save without truncation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Make the stock field decimal-preserving and unit-aware | 793d7ce | src/pages/Products.tsx |
| 2 | Build verification | 793d7ce | — |

## What Was Done

**Task 1 — Stock field fix (FRAC-03):**

Three changes to `src/pages/Products.tsx`:

1. Added import: `import { quantityStep, clampQuantityForUnit } from '@/lib/units';`
2. Stock `<Input>` onChange: `parseInt(e.target.value) || 0` → `parseFloat(e.target.value) || 0`, plus added `step={quantityStep(formData.unit)}` and `min="0"` attributes.
3. `handleSave`: computed `const clampedStock = clampQuantityForUnit(formData.stock, formData.unit)` and spread it explicitly into both the edit (`setProducts` map) and new-product (`newProduct`) object, overriding the raw `formData.stock`.

**Task 2 — Build:** `npm run build` exits 0 with no TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written. `minStock` was inspected per plan guidance; it has no `parseInt` and no decimal concern for threshold values, so it was left unchanged.

## Verification

- Automated check from plan: `node -e "..."` → `ok`
- `npm run build` → exit 0

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/pages/Products.tsx` modified and committed at 793d7ce
- [x] `import ... from '@/lib/units'` present in Products.tsx
- [x] Stock onChange uses `parseFloat`, no `parseInt` in stock block
- [x] `step={quantityStep(formData.unit)}` on stock Input
- [x] `clampQuantityForUnit` applied in handleSave
- [x] `npm run build` exits 0
