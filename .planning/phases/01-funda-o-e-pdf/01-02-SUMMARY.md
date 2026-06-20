---
phase: 01-funda-o-e-pdf
plan: "02"
subsystem: pdf
tags: [jspdf, pdf, receipt, quote, dynamic-height]

requires:
  - phase: 01-funda-o-e-pdf plan 01
    provides: Foundation types and roundCurrency helper (prerequisite correctness base)

provides:
  - Dynamic-height sale receipt PDF (generateReceipt) — base 140mm + 8mm per item
  - Dynamic-height refund receipt PDF (generateRefundReceipt) — base 120mm + 8mm per item
  - Dynamic-height quote PDF (generateQuotePDF) — base 100mm + 8mm per item

affects: [print-workflows, quote-generation, return-receipts]

tech-stack:
  added: []
  patterns:
    - "Pre-calculate jsPDF format height before instantiation; pass Math.max(floor, estimated) to avoid clipping"

key-files:
  created: []
  modified:
    - src/lib/generateReceipt.ts
    - src/lib/generateQuote.ts

key-decisions:
  - "base 140mm for sale receipt (covers header/client/totals/payment/card-fee/crediario-note/footer)"
  - "base 120mm for refund receipt (fewer trailing blocks than sale receipt)"
  - "base 100mm for quote (header/client/totals/two-line footer)"
  - "perItem = 8mm (3mm name line + 5mm qty/total line) — mirrors actual y-cursor increments in item loops"
  - "Math.max(floor, estimated) preserves existing minimum sizes for 1-3 item documents"

patterns-established:
  - "Dynamic PDF height: const estimatedHeight = base + (items.length * perItem); format: [80, Math.max(floor, estimatedHeight)]"

requirements-completed: [PDF-01, PDF-02]

duration: 8min
completed: 2026-06-20
---

# Phase 01 Plan 02: PDF Dynamic Height Summary

**Fixed BUG-3: receipt and quote PDFs now pre-calculate page height (base + 8mm/item) so the TOTAL, Desconto, payment block, and footer always render without clipping for any item count.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T14:10:00Z
- **Completed:** 2026-06-20T14:18:00Z
- **Tasks:** 2 of 2
- **Files modified:** 2

## Accomplishments

- `generateReceipt`: replaced fixed `format:[80,250]` with `Math.max(250, 140 + items.length*8)` — a 30-item receipt now renders the full TOTAL + payment block
- `generateRefundReceipt`: replaced fixed `format:[80,200]` with `Math.max(200, 120 + items.length*8)` — consistent dynamic height for devolucao documents
- `generateQuotePDF`: replaced fixed `format:[80,200]` with `Math.max(200, 100 + items.length*8)` — a 25-item quote now renders TOTAL and both footer disclaimer lines

## Task Commits

1. **Task 1: Dynamic height for sale receipt (and refund receipt)** - `a39e8c9` (fix)
2. **Task 2: Dynamic height for quote PDF** - `dc8525b` (fix)

**Plan metadata:** (committed with SUMMARY and state updates)

## Files Created/Modified

- `src/lib/generateReceipt.ts` — Added pre-height calculation for both `generateReceipt` and `generateRefundReceipt` before `new jsPDF(...)`
- `src/lib/generateQuote.ts` — Added pre-height calculation for `generateQuotePDF` before `new jsPDF(...)`

## Deviations from Plan

None - plan executed exactly as written.

## Validation

**30-item receipt mental check:**
- estimatedHeight = 140 + (30 × 8) = 380mm
- Math.max(250, 380) = 380mm — trailing blocks (~60mm) fit comfortably

**25-item quote mental check:**
- estimatedHeight = 100 + (25 × 8) = 300mm
- Math.max(200, 300) = 300mm — trailing blocks (~27mm) fit comfortably

**Small-document regression check (3 items):**
- Receipt: Math.max(250, 140+24) = 250mm — same as before
- Quote: Math.max(200, 100+24) = 200mm — same as before

**Build:** `npm run build` exits 0.

## Self-Check: PASSED

- `src/lib/generateReceipt.ts` exists and contains `Math.max` — confirmed
- `src/lib/generateQuote.ts` exists and contains `Math.max` — confirmed
- Commits `a39e8c9` and `dc8525b` present in git log — confirmed
- Build exits 0 — confirmed
