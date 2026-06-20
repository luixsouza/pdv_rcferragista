---
phase: 06-layout-fiscal
plan: "03"
subsystem: fiscal
tags: [sales, nfce, danfe, ui, pdf, fiscal, integration]

requires:
  - phase: 06-01
    provides: printNFCe/downloadNFCe async wrappers from generateNFCe.ts
  - phase: 06-02
    provides: printDANFE/downloadDANFE async wrappers from generateDANFE.ts

provides:
  - Sales.tsx: NFCe and DANFE generation actions wired into list rows and detail dialog

affects:
  - FISC-01: reachability fulfilled — operator can generate NFCe cupom from Sales screen
  - FISC-02: reachability fulfilled — operator can generate DANFE NFe from Sales screen

tech-stack:
  added: []
  patterns:
    - Fire-and-forget async call via `void printNFCe(...)` consistent with existing non-awaited sync calls
    - clientFor(sale) helper resolves Client from clients array using sale.clientId
    - Ghost icon buttons in list row; outline text buttons in detail dialog — mirrors existing non-fiscal cupom pattern

key-files:
  created: []
  modified:
    - src/pages/Sales.tsx

key-decisions:
  - "Async generators called via `void fn(...)` (fire-and-forget) consistent with existing printReceipt/downloadReceipt which are also called without await in onClick handlers"
  - "Receipt icon (lucide) for NFCe, FileText icon for DANFE — visually distinct from Printer/Download used by non-fiscal cupom"
  - "Detail dialog fiscal buttons split into two rows (NFCe row, DANFE row) each with print + download, below the existing non-fiscal cupom row"
  - "clientFor helper defined at component scope so both list-row and dialog buttons share the same lookup"

requirements-completed: [FISC-01, FISC-02]

duration: 5min
completed: 2026-06-20
---

# Phase 06 Plan 03: Layout Fiscal — NFCe + DANFE UI Integration Summary

**NFCe and DANFE generation wired into Sales.tsx list rows (ghost icon buttons) and detail dialog (outline text buttons) alongside existing non-fiscal cupom; clientFor helper resolves matched client; all actions fire-and-forget via void; build passes**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-20T17:15:00Z
- **Completed:** 2026-06-20T17:20:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `import { printNFCe, downloadNFCe } from '@/lib/generateNFCe'` and `import { printDANFE, downloadDANFE } from '@/lib/generateDANFE'` to Sales.tsx
- Added `Receipt` and `FileText` lucide icons to the existing icon import line
- Added `clientFor` helper: `const clientFor = (sale: Sale) => clients.find(c => c.id === sale.clientId)`
- List row action group: added two ghost icon buttons after existing Printer/Download — Receipt icon ("Gerar NFCe (cupom)") and FileText icon ("Gerar DANFE (NFe)"), each passing `clientFor(sale)`
- Detail dialog: added two rows of outline buttons below the existing Imprimir/Baixar PDF row — NFCe row (Gerar NFCe + Baixar NFCe) and DANFE row (Gerar DANFE + Baixar DANFE), each passing `clientFor(selectedSale)`
- Existing `printReceipt` / `downloadReceipt` buttons preserved exactly as-is (non-fiscal cupom unchanged)
- `npm run build` exits 0

## Task Commits

1. **Task 1: Add NFCe + DANFE actions to Sales list rows and detail dialog** - `e991dce` (feat)

**Plan metadata:** (committed in final metadata commit)

## Files Created/Modified

- `src/pages/Sales.tsx` - NFCe + DANFE import, clientFor helper, fiscal action buttons in list row and detail dialog; existing non-fiscal buttons untouched

## Decisions Made

- Async generators called via `void fn(...)` consistent with existing printReceipt/downloadReceipt being called without await in onClick handlers (fire-and-forget)
- Receipt lucide icon for NFCe cupom; FileText lucide icon for DANFE — visually distinct from the Printer/Download used by the non-fiscal cupom
- Detail dialog fiscal rows placed immediately after the non-fiscal cupom row to group all document actions together before return/refund actions
- `clientFor` defined at component scope (not inline in JSX) so it is shared cleanly between list-row and dialog buttons

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced by this plan. The underlying generators (generateNFCe.ts, generateDANFE.ts) carry the intentional fiscal placeholder stubs documented in 06-01-SUMMARY.md and 06-02-SUMMARY.md.

## Threat Surface

- T-06-06 mitigated: Buttons labeled "Gerar NFCe (cupom)" and "Gerar DANFE (NFe)" are visually and textually distinct from "Imprimir" (non-fiscal cupom). Documents themselves carry verbatim SEM VALOR FISCAL disclaimers (FISC-03).
- T-06-07 mitigated: Acceptance criterion and post-build grep confirmed `printReceipt` still present in Sales.tsx after all changes.

## Self-Check: PASSED

- `src/pages/Sales.tsx` modified and staged ✓
- Commit `e991dce` exists in git log ✓
- `npm run build` exits 0 ✓
- `grep -q "from '@/lib/generateNFCe'" src/pages/Sales.tsx` → OK ✓
- `grep -q "from '@/lib/generateDANFE'" src/pages/Sales.tsx` → OK ✓
- `grep -q 'printNFCe(' src/pages/Sales.tsx` → OK ✓
- `grep -q 'printDANFE(' src/pages/Sales.tsx` → OK ✓
- `grep -q 'printReceipt' src/pages/Sales.tsx` → OK (existing non-fiscal cupom retained) ✓

---
*Phase: 06-layout-fiscal*
*Completed: 2026-06-20*
