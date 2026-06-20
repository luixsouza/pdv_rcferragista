# Codebase Structure

**Analysis Date:** 2026-06-20

## Directory Layout

```
pdv_rcferragista/
├── electron/               # Electron main process (Node.js, CommonJS)
│   ├── main.cjs            # App window, IPC handlers for store-get/set/delete
│   └── preload.cjs         # contextBridge: exposes window.electron to renderer
├── src/                    # React application (TypeScript, ESM)
│   ├── main.tsx            # React DOM entry point
│   ├── App.tsx             # Router setup (HashRouter) + global providers
│   ├── index.css           # Global CSS (Tailwind base imports)
│   ├── pages/              # Route-level page components (one file per route)
│   │   ├── Index.tsx       # /           Dashboard
│   │   ├── Products.tsx    # /products   Product management
│   │   ├── Clients.tsx     # /clients    Client management
│   │   ├── POS.tsx         # /pos        Point-of-Sale / venda
│   │   ├── Quotes.tsx      # /quotes     Orçamentos
│   │   ├── Sales.tsx       # /sales      Sales history, estorno, devolução
│   │   ├── CreditNotes.tsx # /credit-notes  Crediário + parcelas
│   │   ├── Returns.tsx     # /returns    Standalone devolução flow
│   │   ├── Reports.tsx     # /reports    Cash close + monthly reports
│   │   ├── Settings.tsx    # /settings   Store config
│   │   └── NotFound.tsx    # *           404
│   ├── components/         # Shared React components
│   │   ├── Layout.tsx      # Sidebar + responsive nav wrapper
│   │   ├── ClientCombobox.tsx  # Searchable client selector (used in POS, CreditNotes, Returns, Quotes)
│   │   ├── PageHeader.tsx  # Standard page title + optional action slot
│   │   ├── EmptyState.tsx  # Empty list placeholder with icon
│   │   ├── StatsCard.tsx   # Dashboard KPI card
│   │   ├── NavLink.tsx     # (unused — navigation is inline in Layout.tsx)
│   │   └── ui/             # shadcn/ui primitives (DO NOT EDIT)
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── badge.tsx
│   │       ├── tabs.tsx
│   │       ├── checkbox.tsx
│   │       └── ... (40+ components)
│   ├── lib/                # Pure utility functions, no React
│   │   ├── utils.ts        # cn() Tailwind class merge helper
│   │   ├── formatters.ts   # formatCurrency(), paymentLabels map
│   │   ├── cardFees.ts     # CARD_FEE_TABLE, getCardFee(), calculateFee(), hasDebit()
│   │   ├── storeInfo.ts    # getStoreSettings() — reads StoreSettings from storage
│   │   ├── generateReceipt.ts       # jsPDF: sale receipt + return receipt
│   │   ├── generateQuote.ts         # jsPDF: orçamento PDF
│   │   ├── generateCrediarioReceipt.ts  # jsPDF: crediário statement
│   │   ├── generateProductCode.ts   # Auto-generate product codes by category prefix
│   │   ├── csvExport.ts    # exportToCSV() — UTF-8 BOM semicolon-delimited
│   │   └── documentValidation.ts   # CPF/CNPJ format + validation
│   ├── hooks/              # Custom React hooks
│   │   ├── useLocalStorage.ts  # Primary data hook: electron-store IPC or localStorage fallback
│   │   ├── use-toast.ts    # shadcn toast hook
│   │   └── use-mobile.tsx  # Viewport width breakpoint detection
│   └── types/              # TypeScript type definitions
│       ├── index.ts        # All domain types: Product, Client, Sale, SaleItem,
│       │                   # PaymentEntry, Installment, CreditPayment, ReturnRecord, Quote
│       └── settings.ts     # StoreSettings interface + defaultSettings
├── public/                 # Static assets served by Vite
│   └── logo.png            # App logo (used in sidebar header)
├── docs/                   # Project documentation
│   └── superpowers/plans/  # Feature planning docs
├── .planning/              # GSD planning artifacts
│   └── codebase/           # This directory
├── index.html              # Vite HTML entry
├── vite.config.ts          # Vite: base='./', port 8080, @/ alias
├── tailwind.config.ts      # Tailwind config
├── tsconfig.json           # TypeScript project references root
├── tsconfig.app.json       # App source TypeScript config
├── tsconfig.node.json      # Node/Vite config TypeScript config
├── components.json         # shadcn/ui component config
├── package.json            # NPM scripts + dependencies
└── eslint.config.js        # ESLint flat config
```

## Directory Purposes

**`src/pages/`:**
- Purpose: One file per route. Each page is a self-contained feature module containing all business logic, state, and UI for that screen.
- Contains: React functional components. No sub-components — everything is inline or imported from `components/` or `components/ui/`.
- Key files: `POS.tsx` (sales entry), `CreditNotes.tsx` (crediário management), `Sales.tsx` (history + estorno), `Returns.tsx` (devolução)

**`src/components/`:**
- Purpose: Shared non-primitive components used across multiple pages.
- Key files: `Layout.tsx` (nav wrapper — all pages must use this), `ClientCombobox.tsx` (reused in POS, Quotes, CreditNotes, Returns, Clients)

**`src/components/ui/`:**
- Purpose: shadcn/ui generated components. Install new components with `npx shadcn-ui@latest add <component>`.
- Contains: 40+ components including Button, Card, Dialog, Select, Tabs, Badge, Checkbox, Switch, Popover, Command
- Generated: Yes. Do not hand-edit these files.

**`src/lib/`:**
- Purpose: Zero-React utility functions. Safe to unit test in isolation.
- Key files: `cardFees.ts` (fee table lookup), `generateReceipt.ts` (jsPDF), `storeInfo.ts` (settings reader)

**`src/hooks/`:**
- Purpose: Custom hooks. `useLocalStorage` is the only data-access hook and is used by every page.

**`src/types/`:**
- Purpose: Single source of truth for all domain types. All types are exported from `index.ts`.

**`electron/`:**
- Purpose: Electron main process code. Node.js environment, CommonJS (`.cjs` extension required).
- Storage: `electron-store` JSON file at `app.getPath('userData')` — accessible via "Open Data Folder" in Settings.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: React DOM mount
- `src/App.tsx`: Router + QueryClient + Toaster providers
- `electron/main.cjs`: Electron window creation and IPC setup
- `index.html`: HTML shell

**Domain Types:**
- `src/types/index.ts`: `Product`, `Client`, `Sale`, `SaleItem`, `PaymentEntry`, `Installment`, `CreditPayment`, `ReturnRecord`, `Quote`
- `src/types/settings.ts`: `StoreSettings`, `defaultSettings`

**Data Persistence Hook:**
- `src/hooks/useLocalStorage.ts`: The only way pages read/write data

**Core Business Logic:**
- `src/pages/POS.tsx` — `finalizeSale()`: sale creation, stock deduction, installment generation
- `src/pages/Sales.tsx` — `handleRefund()`: full estorno logic; `handleReturnFromSale()`: devolução from sales view
- `src/pages/CreditNotes.tsx` — `handlePayment()`: installment payment; `handleApplyDiscount()`: installment discount
- `src/pages/Returns.tsx` — `handleReturn()`: devolução; `handleReverseReturn()`: reverse a prior devolução

**PDF Generators:**
- `src/lib/generateReceipt.ts`: `generateReceipt()`, `generateRefundReceipt()`, `printReceipt()`, `downloadReceipt()`, `printRefundReceipt()`, `downloadRefundReceipt()`
- `src/lib/generateQuote.ts`: `generateQuotePDF()`, `printQuote()`, `downloadQuote()`
- `src/lib/generateCrediarioReceipt.ts`: `generateCrediarioStatement()`, `printCrediarioStatement()`, `downloadCrediarioStatement()`

**Card Fee Table:**
- `src/lib/cardFees.ts`: `CARD_FEE_TABLE` with per-brand, per-installment credit rates and debit rates (machine NNPAYTIME04D17299)

**Configuration:**
- `src/types/settings.ts`: `defaultSettings` with store name, CNPJ, address, interest rate defaults
- `src/lib/storeInfo.ts`: `getStoreSettings()` — synchronous read of settings from electron-store or localStorage

## Naming Conventions

**Files:**
- Pages: PascalCase matching route concept, e.g., `POS.tsx`, `CreditNotes.tsx`, `Returns.tsx`
- Components: PascalCase, e.g., `ClientCombobox.tsx`, `PageHeader.tsx`
- Hooks: camelCase with `use` prefix, e.g., `useLocalStorage.ts`, `use-mobile.tsx`
- Lib utilities: camelCase noun, e.g., `cardFees.ts`, `formatters.ts`, `generateReceipt.ts`
- Electron files: camelCase + `.cjs` extension, e.g., `main.cjs`, `preload.cjs`

**Functions:**
- Handlers: `handle*` prefix, e.g., `handleRefund`, `handlePayment`, `handleReturn`
- Actions: verb prefix, e.g., `finalizeSale`, `addToCart`, `initiateReturn`
- Generators: `generate*` prefix, e.g., `generateReceipt`, `generateCrediarioStatement`
- Print/Download pairs: `print*` / `download*`, e.g., `printReceipt` / `downloadReceipt`

**Storage keys:** lowercase with underscores, e.g., `'products'`, `'credit_payments'`, `'store_settings'`

**Types:** PascalCase interfaces, e.g., `Sale`, `SaleItem`, `PaymentEntry`, `ReturnRecord`

## Where to Add New Code

**New page/route:**
- Implementation: `src/pages/NewPage.tsx`
- Register route: `src/App.tsx` (add `<Route>`)
- Add nav link: `src/components/Layout.tsx` (add entry to `navItems` array)
- All three files must be touched

**New domain entity:**
- Add interface to `src/types/index.ts`
- Add storage key to the page(s) that own it via `useLocalStorage<NewType[]>('new_key', [])`

**New PDF document:**
- Add to existing file if related (e.g., another sale-related doc → `src/lib/generateReceipt.ts`)
- Or create `src/lib/generateNewDoc.ts` following the `generate* / print* / download*` pattern
- Always call `getStoreSettings()` for store header data
- Use 80mm width thermal format for receipts; A4 for larger documents

**New utility/helper:**
- Pure function with no React → `src/lib/newHelper.ts`
- React hook → `src/hooks/useNewHook.ts`

**New shared component (non-shadcn):**
- `src/components/NewComponent.tsx`
- Accept props interface, do not use `useLocalStorage` inside shared components — pass data as props

**New shadcn/ui primitive:**
- Run `npx shadcn-ui@latest add <component>` → generates into `src/components/ui/`
- Do not create manually

**New configuration setting:**
- Add field to `StoreSettings` interface in `src/types/settings.ts`
- Add default to `defaultSettings` in same file
- Add UI control in `src/pages/Settings.tsx`
- Access at runtime via `getStoreSettings()` from `src/lib/storeInfo.ts`

## Special Directories

**`electron/`:**
- Purpose: Node.js main process. Must use CommonJS (`require`, `.cjs`).
- Generated: No.
- Committed: Yes.

**`src/components/ui/`:**
- Purpose: shadcn/ui component files.
- Generated: Yes (via shadcn-ui CLI).
- Committed: Yes (modified after generation).

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, codebase maps).
- Generated: Yes (by GSD tooling).
- Committed: Yes.

**`public/`:**
- Purpose: Static assets copied verbatim to build output.
- Key file: `public/logo.png` — referenced in `Layout.tsx` sidebar header.

---

*Structure analysis: 2026-06-20*
