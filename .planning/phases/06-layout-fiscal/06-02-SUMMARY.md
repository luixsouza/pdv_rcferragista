---
phase: 06-layout-fiscal
plan: "02"
subsystem: fiscal
tags: [jspdf, danfe, nfe, a4, code128, bwip-js, barcode, fiscal, pdf]

requires:
  - phase: 06-01
    provides: fiscalPlaceholders.ts (NFE_DISCLAIMER, PLACEHOLDER_*), fiscalBarcode.ts (generateBarcodeDataUrl)

provides:
  - generateDANFE.ts: async DANFE NFe A4 generator with 8 quadros in canonical order
  - printDANFE / downloadDANFE async wrappers

affects:
  - 06-03 (UI integration in Sales.tsx): imports printDANFE/downloadDANFE

tech-stack:
  added: []
  patterns:
    - Async A4 PDF generator (returns Promise<jsPDF>) awaiting generateBarcodeDataUrl (bwip-js canvas)
    - 8 mandatory quadros drawn with doc.rect borders + 5pt bold labels + 7pt normal values
    - Pagination via doc.addPage when product rows overflow; totals block (Q5+Q6+Q7 = 72mm) reserved and forced to new page if needed
    - NFE_DISCLAIMER dark filled band on every page (disclaimer band helper)

key-files:
  created:
    - src/lib/generateDANFE.ts
  modified: []

key-decisions:
  - "generateDANFE is async (Promise<jsPDF>) because generateBarcodeDataUrl (bwip-js toCanvas) is async — mirrors NFCe pattern from 06-01"
  - "Both tasks committed together per plan-checker W-2 (partial file would not compile TypeScript)"
  - "Column widths sum to exactly 196mm (WORK_W): COD16+DESC44+NCM14+CST8+CFOP10+UN8+QTDE10+VLUNIT16+VLTOTAL16+BCICMS14+ALIQ8+VLICMS16+VLIPI16=196"
  - "Totals block height (Q5+Q6+Q7 = 72mm) is pre-computed; addPage triggered if y + 72 > 290 after last item"
  - "try/catch around doc.addImage for barcode prevents crash if bwip-js canvas fails (fallback gray rect)"

metrics:
  duration: 22min
  completed: 2026-06-20
  tasks: 2
  files_modified: 1
---

# Phase 06 Plan 02: Layout Fiscal — DANFE NFe A4 Generator Summary

**A4 DANFE with 8 quadros in canonical order: emitter header + CODE-128 barcode (bwip-js), Natureza/Protocolo, Destinatario, Fatura, product table with 13 fiscal columns zeroed via PLACEHOLDER_*, Calculo do Imposto, Transportador, Dados Adicionais; pagination via addPage preserving totals block; verbatim NFE_DISCLAIMER dark band on every page**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-20T18:00:00Z
- **Completed:** 2026-06-20T18:22:00Z
- **Tasks:** 2 (committed together)
- **Files modified:** 1 (created)

## Accomplishments

- Created `src/lib/generateDANFE.ts` (809 lines) with `async function generateDANFE(sale, client?)` returning `Promise<jsPDF>`
- Quadro 0 (header): 3-column layout — emitter block (IDENTIFICACAO DO EMITENTE, razao social, address from getStoreSettings), DANFE label (14pt bold) + SAIDA indicator, CODE-128 barcode via `await generateBarcodeDataUrl(PLACEHOLDER_ACCESS_KEY)` + access key in 11 groups of 4 via `formatAccessKeyGroups`
- Quadros 1-3: Natureza (VENDA DE MERCADORIAS A CONSUMIDOR), Protocolo (PLACEHOLDER_PROTOCOL), Destinatario/Remetente with client fields or CONSUMIDOR fallback, Fatura (blank per retail spec)
- Quadro 4: 13-column fiscal product table (COD/DESCRICAO/NCM/CST/CFOP/UN/QTDE/VL.UNIT/VL.TOTAL/BC ICMS/ALIQ/VL ICMS/VL IPI) — widths sum to 196mm; per-item: PLACEHOLDER_NCM/CFOP/CST, zeroed tax fields ("0,00"); small 5.5pt font for column density
- Pagination: before each item row checks `y + rowH > BODY_BOTTOM - TOTALS_BLOCK_H`; calls `doc.addPage`, redraws disclaimer band + compact barcode header strip + column header row; if totals block itself doesn't fit after last item, forces another new page
- Quadro 5: CALCULO DO IMPOSTO — 11 labeled sub-boxes: zeroed ICMS/ST bases, total products from item sum, desconto from sale.discount, VALOR TOTAL DA NF from sale.total (bold)
- Quadro 6: TRANSPORTADOR/VOLUMES — 3 rows, FRETE POR CONTA = "9-SEM FRETE", all other fields blank
- Quadro 7: DADOS ADICIONAIS — INFORMACOES COMPLEMENTARES: "Documento sem valor fiscal. Nao autorizado na SEFAZ." + NFE_DISCLAIMER; RESERVADO AO FISCO: blank
- NFE_DISCLAIMER dark band (drawDisclaimerBand) rendered on every page (top of each page)
- Exported `printDANFE` and `downloadDANFE` async wrappers mirroring generateReceipt.ts pattern
- `npm run build` exits 0

## Task Commits

1. **Tasks 1+2 combined: DANFE A4 generator — all 8 quadros, fiscal columns, barcode, pagination, wrappers** — `a0de242` (feat)

## Files Created/Modified

- `src/lib/generateDANFE.ts` — DANFE NFe A4 generator: 8 quadros, CODE-128 barcode, 13 fiscal columns zeroed, pagination, NFE_DISCLAIMER band, print/download wrappers

## Decisions Made

- `generateDANFE` is async (returns `Promise<jsPDF>`) because `generateBarcodeDataUrl` (bwip-js `toCanvas`) is inherently async — mirrors the `generateNFCe` pattern established in plan 06-01
- Tasks 1 and 2 committed together (single `feat` commit) per the W-2 sequential_execution instruction: a partial file with only Quadros 0-3 would not compile due to unused imports and missing function bodies
- Column widths for the 13-column fiscal table sum exactly to 196mm (working width); 5.5pt font fits all columns without overlap
- Totals block height (Q5=20 + Q6=24 + Q7=28 = 72mm) is pre-computed as `TOTALS_BLOCK_H`; pagination logic reserves this space before starting any new item row
- `try/catch` around `doc.addImage` for both the primary barcode and the overflow-page barcode — prevents hard crash if bwip-js canvas rendering fails in any environment edge case

## Deviations from Plan

None — plan executed exactly as written. Both tasks written before `npm run build` per W-2 instruction.

## Known Stubs

The following placeholder constants are intentional stubs by design (FISC-03), not defects:

| Stub | File | Reason |
|------|------|--------|
| PLACEHOLDER_ACCESS_KEY (44 zeros) in barcode | generateDANFE.ts | No SEFAZ transmission — safe placeholder for layout |
| PLACEHOLDER_PROTOCOL = 'SEM PROTOCOLO' in Quadro 1 | generateDANFE.ts | No SEFAZ authorization |
| PLACEHOLDER_NCM/CFOP/CST per item row | generateDANFE.ts | No fiscal product data in StoreItem |
| Zeroed BC ICMS/ALIQ/VL ICMS/VL IPI per item and in Quadro 5 | generateDANFE.ts | No tax computation in scope (v2, FISC2-01) |

These are permanent for Phase 6 (layout-only). Real values require SEFAZ transmission (deferred to v2).

## Threat Surface

- T-06-04 mitigated: NFE_DISCLAIMER band printed on every page (drawDisclaimerBand); INFORMACOES COMPLEMENTARES contains "Documento sem valor fiscal. Nao autorizado na SEFAZ." + NFE_DISCLAIMER text; PLACEHOLDER_PROTOCOL = "SEM PROTOCOLO"; all-zero access key. Document cannot be mistaken for an authorized NF-e.
- T-06-05 mitigated: Pagination via `doc.addPage` with repeated header; TOTALS_BLOCK_H (72mm) reserved — totals block is never clipped.

## Self-Check: PASSED

- `src/lib/generateDANFE.ts` exists (809 lines, 1 file created) ✓
- Commit `a0de242` exists in git log ✓
- `npm run build` exits 0 ✓
- NFE_DISCLAIMER imported and used (5 occurrences) ✓
- IDENTIFICACAO DO EMITENTE, DESTINATARIO/REMETENTE, DADOS DO PRODUTO/SERVICO, CALCULO DO IMPOSTO, TRANSPORTADOR/VOLUMES TRANSPORTADOS, DADOS ADICIONAIS all present ✓
- generateBarcodeDataUrl used (2 occurrences), addPage used (2 occurrences) ✓
- PLACEHOLDER_NCM/CFOP/CST all used (6 occurrences combined) ✓
- downloadDANFE exported ✓

---
*Phase: 06-layout-fiscal*
*Completed: 2026-06-20*
