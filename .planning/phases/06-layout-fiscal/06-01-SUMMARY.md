---
phase: 06-layout-fiscal
plan: "01"
subsystem: fiscal
tags: [jspdf, bwip-js, qrcode, nfce, danfe, pdf, barcode, qr-code, fiscal]

requires:
  - phase: 01-funda-o-e-pdf
    provides: jsPDF 80mm pattern with dynamic height + print/download wrappers

provides:
  - bwip-js (CODE-128 barcode) and qrcode (QR) installed as production dependencies
  - fiscalPlaceholders.ts: safe placeholder constants (44-zero access key, NFE_DISCLAIMER,
    NFCE_DISCLAIMER with verbatim en-dash, formatAccessKeyGroups, NFCE_QR_PLACEHOLDER)
  - fiscalBarcode.ts: async generateQrDataUrl and generateBarcodeDataUrl (no network calls)
  - generateNFCe.ts: async generateNFCe / printNFCe / downloadNFCe for 80mm DANFE-NFCe cupom

affects:
  - 06-02 (DANFE A4): reuses fiscalPlaceholders.ts and fiscalBarcode.ts
  - 06-03 (UI integration in Sales.tsx): imports printNFCe/downloadNFCe

tech-stack:
  added:
    - bwip-js (CODE-128 barcode renderer, pure JS, offline)
    - qrcode (QR data URL generator, pure JS, offline)
    - "@types/qrcode" (TypeScript types, devDependency)
  patterns:
    - Async PDF generator (returns Promise<jsPDF>) because QR URL generation is async
    - Dynamic height via Math.max(250, 164 + n*8) — same base/perItem pattern as generateReceipt.ts
    - Shared fiscal helpers (fiscalPlaceholders, fiscalBarcode) decoupled from document generators

key-files:
  created:
    - src/lib/fiscalPlaceholders.ts
    - src/lib/fiscalBarcode.ts
    - src/lib/generateNFCe.ts
  modified:
    - package.json (bwip-js, qrcode added to dependencies; @types/qrcode to devDependencies)
    - package-lock.json

key-decisions:
  - "generateNFCe returns Promise<jsPDF> because generateQrDataUrl (qrcode.toDataURL) is async; printNFCe/downloadNFCe are also async and await it"
  - "NFCE_DISCLAIMER constant uses verbatim en-dash (U+2013) as specified in FISCAL-LAYOUT.md Part 4 — not normalized to hyphen"
  - "QR image rendered at 28x28mm (exceeds 25mm minimum from FISC-01); placeholder URL includes sem_valor_fiscal=1"
  - "fiscalPlaceholders.ts and fiscalBarcode.ts kept separate from generateNFCe.ts for reuse by DANFE plan (06-02)"
  - "bwip-js toCanvas used with offscreen document.createElement canvas in browser/Electron renderer"

patterns-established:
  - "Async PDF generator pattern: async function generate*(sale, client?) -> Promise<jsPDF>; wrappers await it"
  - "Shared fiscal constants in fiscalPlaceholders.ts with SCREAMING_SNAKE_CASE naming"
  - "Disclaimer band: filled gray rect behind bold centered text, rendered twice (Div II + Div VIII)"

requirements-completed: [FISC-01, FISC-03]

duration: 18min
completed: 2026-06-20
---

# Phase 06 Plan 01: Layout Fiscal — NFCe + Fiscal Helpers Summary

**bwip-js + qrcode installed; fiscalPlaceholders/fiscalBarcode helpers created; NFCe 80mm cupom generator with Divisoes I-IX, verbatim title, 44-digit placeholder key, QR >=25mm, dynamic height, and en-dash homologacao disclaimer**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-20T17:15:00Z
- **Completed:** 2026-06-20T17:33:00Z
- **Tasks:** 2
- **Files modified:** 5 (3 created + package.json + package-lock.json)

## Accomplishments

- Installed bwip-js and qrcode as production dependencies (pure JS, offline-capable in Electron renderer); @types/qrcode as devDependency
- Created fiscalPlaceholders.ts with all FISC-03 safe placeholder constants (PLACEHOLDER_ACCESS_KEY = 44 zeros, PLACEHOLDER_NCM/CFOP/CST/PROTOCOL/IE/SERIE, NFE_DISCLAIMER, NFCE_DISCLAIMER with verbatim en-dash, NFCE_QR_PLACEHOLDER, formatAccessKeyGroups helper)
- Created fiscalBarcode.ts with async generateQrDataUrl (qrcode toDataURL) and generateBarcodeDataUrl (bwip-js toCanvas CODE-128) — no network calls, shared with DANFE plan
- Implemented generateNFCe.ts: 80mm cupom with all 9 Divisoes in spec order, mandatory title verbatim, items table, totals, payment methods, "Consulte pela Chave de Acesso em" + 44-digit grouped key, QR 28x28mm (await generateQrDataUrl), consumer line or "CONSUMIDOR NAO IDENTIFICADO", NFCE_DISCLAIMER band twice, dynamic height `Math.max(250, 164 + n*8)`, printNFCe/downloadNFCe async wrappers
- npm run build exits 0

## Task Commits

1. **Task 1: Install bwip-js + qrcode; add fiscalPlaceholders and fiscalBarcode helpers** - `667d819` (feat)
2. **Task 2: Implement generateNFCe 80mm cupom with QR, dynamic height, disclaimer** - `2e65a35` (feat)

**Plan metadata:** (committed in final metadata commit)

## Files Created/Modified

- `src/lib/fiscalPlaceholders.ts` - FISC-03 placeholder constants and formatAccessKeyGroups helper
- `src/lib/fiscalBarcode.ts` - Async generateQrDataUrl and generateBarcodeDataUrl (no network)
- `src/lib/generateNFCe.ts` - NFCe 80mm cupom generator: Divisoes I-IX, QR, dynamic height, disclaimer
- `package.json` - bwip-js and qrcode added to dependencies; @types/qrcode to devDependencies
- `package-lock.json` - Updated lock file

## Decisions Made

- generateNFCe returns Promise<jsPDF> because the QR data URL generation (qrcode.toDataURL) is inherently async; printNFCe and downloadNFCe are also async and await it
- NFCE_DISCLAIMER constant preserves the verbatim en-dash (U+2013: –) as required by FISCAL-LAYOUT.md Part 4; NFE_DISCLAIMER uses a hyphen as the SEFAZ homologation convention specifies
- QR rendered at 28x28mm (slightly above the 25mm FISC-01 minimum) to ensure readability
- fiscalPlaceholders.ts and fiscalBarcode.ts are stand-alone modules (not inlined into generateNFCe.ts) so they can be reused by the DANFE A4 generator in plan 06-02
- bwip-js browser entry toCanvas used with document.createElement('canvas') — matches the Electron renderer context; no Node.js toBuffer path needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

The following placeholder constants are intentional stubs by design (FISC-03), not defects:

| Stub | File | Line | Reason |
|------|------|------|--------|
| PLACEHOLDER_ACCESS_KEY = 44 zeros | fiscalPlaceholders.ts | 17 | No SEFAZ transmission — safe placeholder for layout |
| PLACEHOLDER_PROTOCOL = 'SEM PROTOCOLO' | fiscalPlaceholders.ts | 28 | No SEFAZ authorization — placeholder for layout |
| NFCE_QR_PLACEHOLDER (zero access key + sem_valor_fiscal=1) | fiscalPlaceholders.ts | 45 | Static non-fiscal QR payload |
| PLACEHOLDER_IE = 'ISENTO' | fiscalPlaceholders.ts | 31 | StoreSettings has no IE field |

These stubs are permanent for Phase 6 (layout-only). Real values require SEFAZ transmission (deferred to v2, FISC2-01/FISC2-02).

## Threat Surface

T-06-01 mitigated: NFCE_DISCLAIMER band printed twice (Divisao II and Divisao VIII); PLACEHOLDER_PROTOCOL = "SEM PROTOCOLO"; all-zero access key. Document cannot be mistaken for an authorized fiscal document.

T-06-03 accepted: QR payload is static placeholder URL with zero access key and sem_valor_fiscal=1; no PII in the QR.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-02 (DANFE A4) can import fiscalPlaceholders.ts and fiscalBarcode.ts directly
- Plan 06-03 (UI integration) can import printNFCe/downloadNFCe from generateNFCe.ts
- No blockers

---
*Phase: 06-layout-fiscal*
*Completed: 2026-06-20*
