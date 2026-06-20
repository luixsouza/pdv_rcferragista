# External Integrations

**Analysis Date:** 2026-06-20

## APIs & External Services

**None.** This application is fully offline/local. There are no HTTP calls to external APIs, no cloud services, and no network dependencies at runtime. All data is persisted locally.

## Data Storage

**Primary Store — electron-store:**
- Provider: `electron-store` 11.0.2 (wraps Electron's `app.getPath('userData')` directory as a JSON file)
- Client: `window.electron.store` — IPC-bridged object exposed by `electron/preload.cjs`
- IPC handlers defined in `electron/main.cjs` (lines 16–28): `store-get`, `store-set`, `store-delete`
- Storage hook: `src/hooks/useLocalStorage.ts` — unified hook that uses `window.electron.store` when running in Electron, falls back to `window.localStorage` in browser dev mode
- Settings accessor: `src/lib/storeInfo.ts` — reads `store_settings` key; same dual Electron/localStorage pattern

**Data keys stored (all JSON-serialised arrays/objects):**
| Key | Type | Description |
|-----|------|-------------|
| `products` | `Product[]` | Product catalogue with stock levels |
| `clients` | `Client[]` | Customer registry with credit limits |
| `sales` | `Sale[]` | Completed sale transactions |
| `installments` | `Installment[]` | Crediário (store credit) instalment records |
| `credit_payments` | `CreditPayment[]` | Crediário payment history |
| `store_settings` | `StoreSettings` | Store name, CNPJ, address, fee config, presets |

**Web Fallback (development only):**
- `window.localStorage` — used when `window.electron` is not available (browser-only dev with `npm run dev`)
- Not suitable for production; data does not persist across Electron sessions in this mode

**File Storage:**
- Local filesystem only — PDFs are generated in-memory by jsPDF and either opened as blob URLs or downloaded via `<a>` element. No file is written to disk by the application itself (user may download via browser save dialog).

**Caching:**
- None — all reads go directly to electron-store / localStorage.

## Authentication & Identity

**Auth Provider:** None. There is no authentication layer. The application runs as a single-user desktop app with no login, session management, or user accounts.

## Payment Processing

**No payment gateway integration.** Payments are recorded in the local database only. The following methods are tracked as string enums in `src/types/index.ts`:
- `cash` — Dinheiro
- `credit` — Cartão de Crédito
- `debit` — Cartão de Débito
- `pix` — PIX (QR code shown/described manually)
- `crediario` — Store instalment credit
- `store_credit` — Store credit balance (credit notes / "crédito em haver")

**Card fee calculation** is done entirely locally via a hardcoded fee table in `src/lib/cardFees.ts`. The table is labelled as being from machine `NNPAYTIME04D17299` and covers Visa/Mastercard, Elo, Hipercard, Amex, and Outros brands with up to 18 credit instalments.

**PIX** is not integrated with any payment API — the cashier manually confirms receipt.

## PDF Generation

**Library:** jsPDF 4.0.0 (client-side, no server)

**Generated documents (all in `src/lib/`):**
| File | Function(s) | Format | Purpose |
|------|-------------|--------|---------|
| `src/lib/generateReceipt.ts` | `generateReceipt`, `generateRefundReceipt`, `printReceipt`, `downloadReceipt`, `printRefundReceipt`, `downloadRefundReceipt` | 80mm thermal receipt | Sale receipt and return receipt |
| `src/lib/generateQuote.ts` | `generateQuotePDF`, `printQuote`, `downloadQuote` | 80mm thermal | Customer quotation (Orçamento) |
| `src/lib/generateCrediarioReceipt.ts` | `generateCrediarioStatement`, `printCrediarioStatement`, `downloadCrediarioStatement` | 80mm thermal (dynamic height) | Crediário instalment statement |

All PDFs use the Helvetica font (built into jsPDF), 80mm page width (matching standard thermal receipt printers), and are labelled "CUPOM NÃO FISCAL" — explicitly not fiscal documents.

## CSV Export

**Library:** Native browser Blob API (no dependency)
- Implementation: `src/lib/csvExport.ts` — `exportToCSV(filename, headers, rows)`
- Encoding: UTF-8 with BOM (`﻿`) for Excel compatibility
- Delimiter: semicolon (`;`) — standard for Brazilian locale Excel
- Used in: `src/pages/Products.tsx` (product catalogue export)

## Fiscal / NFe Integration

**None.** The system explicitly generates "CUPOM NÃO FISCAL" (non-fiscal receipts). There is no integration with SEFAZ, NFe (Nota Fiscal Eletrônica), SAT (Sistema de Autenticação e Transmissão), or any Brazilian fiscal system. The store CNPJ (hardcoded default: `46.483.338/0001-42`) appears only on printed receipts for identification.

**Brazilian document utilities** are implemented locally in `src/lib/documentValidation.ts`:
- CPF formatting and validation (Luhn-style check digits)
- CNPJ formatting and validation
- `formatDocument` / `validateDocument` auto-detect CPF vs CNPJ by digit count

## Monitoring & Observability

**Error Tracking:** None. No Sentry, DataDog, or similar service.

**Logs:** `console.error` calls in `src/hooks/useLocalStorage.ts` for storage read/write failures only.

## CI/CD & Deployment

**Hosting:** Local desktop installation (Windows). No cloud hosting.

**CI Pipeline:** None detected. No GitHub Actions, CircleCI, or similar config files present.

**Build & Package:**
- `npm run build` → Vite builds web assets to `dist/`
- `npm run electron:build` → Vite build + `electron-builder` packages to `dist-electron/` as Windows NSIS installer
- Installer config in `package.json` `"build"` section: appId `com.pdv.rccasaconstrucao`, productName `PDV RC Casa & Construção`, icon `build/icon.ico`

## Environment Configuration

**Required env vars:** None. The application has no runtime environment variables. All configuration (store name, CNPJ, address, phone, fee settings) is stored in electron-store under the `store_settings` key and editable via `src/pages/Settings.tsx`.

**Secrets:** None. No API keys, tokens, or credentials of any kind.

**Data folder:** Accessible via Settings > "Abrir pasta de dados" button, which calls `window.electron.openDataFolder()` → `shell.openPath(app.getPath('userData'))` in `electron/main.cjs`.

## Webhooks & Callbacks

**Incoming:** None.

**Outgoing:** None.

---

*Integration audit: 2026-06-20*
