---
phase: 06-layout-fiscal
fixed_at: 2026-06-20T20:30:00Z
review_path: .planning/phases/06-layout-fiscal/06-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-06-20T20:30:00Z
**Source review:** .planning/phases/06-layout-fiscal/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, WR-01 through WR-07; WR-05 was retracted in REVIEW.md)
- Fixed: 8 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-06, WR-07)
- Skipped: 1 (WR-05 — retracted by reviewer)

## Fixed Issues

### CR-01: bwip-js toCanvas awaited — barcode now renders real CODE-128

**Files modified:** `src/lib/fiscalBarcode.ts`
**Commit:** f764ea2
**Applied fix:** Added `await` before `bwipjs.toCanvas(canvas, ...)`. The function was already declared `async`; the missing `await` caused `canvas.toDataURL()` to fire on a blank canvas before bwip-js finished drawing.

---

### CR-02: Date format in DANFE Quadro 2 guarded with try/catch

**Files modified:** `src/lib/generateDANFE.ts`
**Commit:** 38001e7
**Applied fix:** Wrapped both `format(new Date(sale.createdAt), ...)` calls in Quadro 2 (DATA DA EMISSÃO at line 337, HORA SAÍDA at line 400) in IIFE try/catch blocks that return `''` on error. Matches the existing pattern in `generateNFCe.ts` lines 284-289.

---

### WR-01: Fiscal PDF async errors surfaced via toast in Sales.tsx

**Files modified:** `src/pages/Sales.tsx`
**Commit:** 5d56af6
**Applied fix:** Replaced all 6 `void fn(...)` fiscal onClick handlers with `.catch(() => toast({ title, description }))` calls using the existing `useToast` hook already imported in Sales.tsx. Synchronous `printReceipt`/`downloadReceipt` handlers are unchanged.

---

### WR-02: Item unit resolved from products lookup in NFCe and DANFE

**Files modified:** `src/lib/generateNFCe.ts`, `src/lib/generateDANFE.ts`, `src/pages/Sales.tsx`
**Commit:** af4db65
**Applied fix:** Added optional `products?: Product[]` parameter to `generateNFCe`, `generateDANFE`, `printNFCe`, `downloadNFCe`, `printDANFE`, `downloadDANFE`. Each item now resolves its unit as `(products?.find(p => p.id === item.productId)?.unit ?? 'UN').toUpperCase()`. All 6 call sites in Sales.tsx updated to pass the existing `products` slice.

---

### WR-03: NFCe minimum cupom height reduced from 250mm to 175mm

**Files modified:** `src/lib/generateNFCe.ts`
**Commit:** 4888393
**Applied fix:** Changed `Math.max(250, ...)` to `Math.max(175, ...)` in `calcHeight()`. Static blocks total ~165mm; 175mm is a safe minimum that avoids excessive blank space on small (1-2 item) sales without risking content clipping.

---

### WR-04: Access-key split in DANFE uses lastIndexOf for safety

**Files modified:** `src/lib/generateDANFE.ts`
**Commit:** bca8adf
**Applied fix:** Replaced `grouped.indexOf(' ', halfLen)` (which returns -1 for malformed keys, rendering wrong second line) with `grouped.lastIndexOf(' ', Math.ceil(grouped.length / 2))` and added an explicit fallback that renders the full string on one line when no split point exists.

---

### WR-06: Dead drawPageHeader stub removed from generateDANFE.ts

**Files modified:** `src/lib/generateDANFE.ts`
**Commit:** 4ca6a00
**Applied fix:** Removed the `drawPageHeader` function and its JSDoc entirely. The function body ignored 3 of its 4 parameters and was never called — all overflow-page headers are drawn inline in the item loop and totals-overflow block.

---

### WR-07: NFCe crediário payment shows entryAmount, not full total

**Files modified:** `src/lib/generateNFCe.ts`
**Commit:** 33ee3e1
**Applied fix:** In the single-payment branch, when `sale.paymentMethod === 'crediario'` and `sale.entryAmount != null`, display `sale.entryAmount` (the down payment actually collected) as the payment amount. An additional "Financiado (crediário)" row shows the remaining financed amount. Non-crediário sales unchanged.

---

## Skipped Issues

### WR-05: DANFE center column label missing accent — RETRACTED

**File:** `src/lib/generateDANFE.ts:205-210`
**Reason:** Retracted by reviewer in REVIEW.md — the accent `ELETRÔNICA` is already present and correct in the source. No fix needed.

---

_Fixed: 2026-06-20T20:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
