<!-- GSD:project-start source:PROJECT.md -->
## Project

**PDV RC Ferragista — Melhorias e Adaptações**

Sistema de PDV (ponto de venda) desktop para a loja de materiais de construção/ferragens **RC Ferragista**. É um app Electron + React (TypeScript) totalmente offline, com persistência local via `electron-store`, que cobre vendas, orçamentos, crediário (parcelas/haver), devoluções, controle de estoque e relatórios. Este milestone corrige bugs do crediário/devolução, adiciona venda fracionada e devolução pelo PDV, e introduz o layout visual de documentos fiscais brasileiros (NFe/NFCe) sem transmissão ao governo.

**Core Value:** O lojista consegue registrar vendas e gerir o crediário/devoluções com valores financeiros **corretos** — sem gerar haver indevido nem deixar parcelas fantasmas — e imprimir documentos completos e legíveis.

### Constraints

- **Tech stack**: Electron 39 + React 18 + TypeScript + Vite + shadcn/ui + Tailwind; persistência `electron-store`; PDFs com jsPDF — manter o stack existente.
- **Offline-first**: nenhuma dependência de rede em runtime; tudo local.
- **Moeda/decimais**: usar `formatCurrency` (pt-BR) de `src/lib/formatters.ts`; quantidades fracionadas exigem cuidado com precisão (evitar erros de ponto flutuante em totais).
- **Sem strict TypeScript** (`strict: false`) — seguir convenções existentes do projeto.
- **Compatibilidade de dados**: alterações em tipos (`src/types/index.ts`) devem ser retrocompatíveis com dados já gravados no `electron-store`.
- **Fiscal apenas visual**: documentos NFe/NFCe não podem se passar por documento autorizado; deixar claro o caráter não-transmitido.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - All application source code under `src/`
- JavaScript (CJS) - Electron main process (`electron/main.cjs`, `electron/preload.cjs`)
- CSS (via Tailwind utility classes) - Styling throughout `src/`
## Runtime
- Node.js 24.16.0 (development toolchain and Electron host)
- Chromium (Electron renderer process — the actual React app runs here)
- npm 11.13.0
- Lockfile: `package-lock.json` present (lockfileVersion 3)
## Frameworks
- React 18.3.1 - UI component model, used exclusively as SPA inside Electron renderer
- React Router DOM 6.30.1 - Client-side routing (`src/pages/`)
- Electron 39.2.7 - Desktop shell; wraps the Vite-built React SPA as a native Windows app
- shadcn/ui (config at `components.json`) - Component generation scaffolding; style: "default", baseColor: slate, cssVariables: true
- Radix UI primitives (full suite, ~24 packages) - Headless accessible primitives used by shadcn components in `src/components/ui/`
- Tailwind CSS 3.4.17 - Utility-first CSS framework; config at `tailwind.config.ts`
- tailwindcss-animate 1.0.7 - Animation utilities (accordion open/close)
- `@tailwindcss/typography` 0.5.16 - Prose styling (devDependency)
- react-hook-form 7.61.1 - Form state management
- `@hookform/resolvers` 3.10.0 - Adapter layer (Zod integration)
- Zod 3.25.76 - Schema validation and type inference
- `@tanstack/react-query` 5.83.0 - Server/async state management (installed; usage limited to infrastructure, all primary data is local-storage-based)
- Recharts 2.15.4 - Chart library used in `src/pages/Reports.tsx`
- date-fns 3.6.0 with `ptBR` locale - All date formatting and arithmetic throughout `src/lib/` and pages
- sonner 1.7.4 - Toast notifications via `toast()` calls across all pages
- Vite 5.4.19 - Dev server (port 8080) and production bundler; config at `vite.config.ts`
- `@vitejs/plugin-react-swc` 3.11.0 - SWC-powered React transform (replaces Babel)
- lovable-tagger 1.1.13 - Development-only component tagging plugin (active in `development` mode only)
- concurrently 9.2.1 - Runs Vite dev server and Electron process in parallel
- wait-on 9.0.3 - Waits for Vite TCP port before launching Electron in dev mode
- cross-env 10.1.0 - Sets `NODE_ENV=development` for Electron dev launch
- ESLint 9.32.0 - Configured at `eslint.config.js` (flat config format)
- typescript-eslint 8.38.0 - TypeScript-aware lint rules
- eslint-plugin-react-hooks 5.2.0 - Enforces Rules of Hooks
- eslint-plugin-react-refresh 0.4.20 - Guards against non-component exports during HMR
## Key Dependencies
- `electron-store` 11.0.2 - Persistent JSON key-value store written to the OS user-data directory; the sole persistence layer for all application data (products, clients, sales, installments, settings). IPC handlers exposed at `electron/main.cjs` lines 16-28; renderer accesses via `window.electron.store` bridged in `electron/preload.cjs`.
- `jspdf` 4.0.0 - In-browser PDF generation. Used by `src/lib/generateReceipt.ts`, `src/lib/generateQuote.ts`, `src/lib/generateCrediarioReceipt.ts`. No server required; PDFs are opened in new tab (autoPrint) or downloaded via blob URL.
- `react-router-dom` 6.30.1 - SPA routing between pages (Dashboard, POS, Products, Clients, Sales, Quotes, Returns, Reports, Settings, CreditNotes).
- `lucide-react` 0.462.0 - Icon library used pervasively across all pages and components
- `date-fns` 3.6.0 - Date formatting with Brazilian locale (`ptBR`) throughout receipts and reports
- `class-variance-authority` 0.7.1 - Variant-based className builder used in shadcn button/badge components
- `clsx` + `tailwind-merge` - Combined in `src/lib/utils.ts` as the `cn()` helper; used in every component
- `embla-carousel-react` 8.6.0 - Carousel primitive (shadcn dependency, not directly referenced in business logic)
- `react-day-picker` 8.10.1 - Calendar widget used in shadcn `calendar.tsx`
- `cmdk` 1.1.1 - Command palette primitive backing shadcn `command.tsx`; used in POS product search
- `vaul` 0.9.9 - Drawer primitive (shadcn `drawer.tsx`)
- `next-themes` 0.3.0 - Theme provider (dark mode toggle infrastructure)
- `input-otp` 1.4.2 - OTP input primitive (shadcn component, not used in business logic)
- `react-resizable-panels` 2.1.9 - Resizable layout panels (shadcn `resizable.tsx`)
## Configuration
- `tsconfig.json` - Root config; references `tsconfig.app.json` and `tsconfig.node.json`. Strict mode is OFF (`strict: false`, `noImplicitAny: false`, `strictNullChecks: false`).
- `tsconfig.app.json` - App source config; target ES2020, bundler module resolution, path alias `@/*` → `./src/*`, `noEmit: true`.
- `@/*` maps to `src/*` — configured in both `tsconfig.json` and `vite.config.ts`
- Vite builds to `dist/` (web bundle)
- Electron builder packages to `dist-electron/`
- Electron builder config in `package.json` `"build"` key: appId `com.pdv.rccasaconstrucao`, Windows NSIS installer, icon at `build/icon.ico`
- Host: `::` (all interfaces), Port: `8080`
- Base: `./` (relative paths, required for Electron file:// loading)
## Platform Requirements
- Node.js 24.x
- npm 11.x
- Windows (primary target; Electron builder targets win32 NSIS)
- Run `npm run electron:dev` to launch Vite + Electron concurrently
- Windows desktop application distributed as NSIS installer
- No server required — fully offline, all data stored locally via electron-store
- No environment variables needed (no external API keys)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Pages: PascalCase matching the route concept — `POS.tsx`, `CreditNotes.tsx`, `Products.tsx`
- Shared components: PascalCase — `ClientCombobox.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `StatsCard.tsx`
- UI primitives (shadcn): kebab-case — `alert-dialog.tsx`, `dropdown-menu.tsx`, `input-otp.tsx`
- Hooks: camelCase with `use` prefix — `useLocalStorage.ts`, `use-mobile.tsx`
- Lib utilities: camelCase — `formatters.ts`, `cardFees.ts`, `csvExport.ts`, `storeInfo.ts`
- Type files: lowercase — `src/types/index.ts`, `src/types/settings.ts`
- Functions: camelCase — `formatCurrency`, `getCardFee`, `calculateFee`, `exportToCSV`, `validateDocument`
- Event handlers: `handle` prefix — `handleSave`, `handleEdit`, `handleDelete`, `handleExport`, `handleCloseDialog`
- Boolean state: descriptive — `dialogOpen`, `splitMode`, `isPercentage`, `isClientDelinquent`
- Derived state identifiers: descriptive noun phrases — `filteredProducts`, `recentClients`, `totalAllocated`
- Constants: SCREAMING_SNAKE_CASE for true constants — `CARD_FEE_TABLE`, `CARD_BRAND_LABELS`, `LOW_STOCK_THRESHOLD`
- Interfaces: PascalCase — `Product`, `Client`, `Sale`, `SaleItem`, `PaymentEntry`, `Installment`, `ReturnRecord`, `Quote`
- Exported types: PascalCase — `CardBrand`
- Prop interfaces: `[ComponentName]Props` — `LayoutProps`, `ClientComboboxProps`, `PageHeaderProps`, `StatsCardProps`
- `Omit<>` used for form data shapes: `Omit<Product, 'id' | 'createdAt' | 'updatedAt'>`
- Page components: `export default function ComponentName()` — all pages use default export
- Shared components: named export function — `export function Layout(...)`, `export function ClientCombobox(...)`
- Some pages use arrow function with `const` — `const Settings = () => (...)`, `const Index = () => {...}`; no consistent rule between pages, but most pages use function declaration syntax
## Code Style
- No Prettier config detected — formatting is not enforced by tooling
- Indentation: 2-space indent throughout
- Trailing commas used in most places
- Single quotes for imports, double quotes in JSX attribute strings
- ESLint 9 flat config — `eslint.config.js`
- Rules enabled: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` recommended
- `@typescript-eslint/no-unused-vars` is explicitly set to `"off"` — unused vars are not flagged
- `react-refresh/only-export-components` set to `"warn"` with `allowConstantExport: true`
- TypeScript: strict mode not enabled; `tsconfig.app.json` uses default Vite scaffold settings
## Import Organization
- `@/` maps to `src/` — configured in `vite.config.ts` via `resolve.alias`
- All internal imports use `@/` — never use relative paths like `../../`
## Money and Decimal Value Handling
- All monetary values stored as JavaScript `number` (IEEE 754 float) — `price: number`, `total: number`, `amount: number`
- No `Decimal` library used — floating-point arithmetic is used throughout
- Always use `formatCurrency(value: number)` from `src/lib/formatters.ts` for UI display
- `formatCurrency` wraps `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` — outputs `R$ 1.234,56` format
- In PDF/receipt generation, raw `.toFixed(2)` is used directly: `R$ ${value.toFixed(2)}`
- Fee calculations use `Math.round(x * 100) / 100` — see `calculateFee()` in `src/lib/cardFees.ts`
- Bulk price adjustments use `Math.round(p[bulkField] * factor * 100) / 100` — see `src/pages/Products.tsx:486`
- Discount and total calculations do NOT round — raw floats flow through: `subtotal - finalDiscountValue`
- Floating-point comparison tolerance: `0.01` used as epsilon — `Math.abs(totalAllocated - total) > 0.01` and `crediarioFinanced > clientCreditAvailable + 0.01`
- Products with `unit === 'mil'` (milheiro = 1000 units) use a scaling pattern:
- This pattern appears in `addToCart`, `updateQuantity`, `updateItemQuantity`, and `finalizeSale` in `src/pages/POS.tsx`
- Supported unit codes: `'un'`, `'kg'`, `'mt'`, `'cx'`, `'pc'`, `'lt'`, `'par'`, `'jg'`, `'rl'`, `'mil'` — defined in `src/pages/Products.tsx`
- `parseFloat(e.target.value)` for monetary/decimal inputs; fallback `|| 0` or NaN guard used inconsistently
- `parseInt(e.target.value)` for integer quantities/installment counts
- `parseFloat(e.target.value) || 0` pattern in `src/pages/Products.tsx:304`
- `isNaN(val)` guard pattern in `src/pages/POS.tsx:733` and `src/pages/POS.tsx:843`
## State Management
- All domain data is persisted via `useLocalStorage<T>(key, defaultValue)` hook — `src/hooks/useLocalStorage.ts`
- In Electron (production), data stored via `electron-store` (IPC bridge through `window.electron.store`)
- In browser (dev), falls back to `localStorage`
- Storage keys (used across all pages — must remain consistent):
- Each page manages its own ephemeral UI state with `useState`
- Derived/computed values use `useMemo` — filtering, aggregating, report calculations
- No shared state between pages — each page loads its own `useLocalStorage` slice
- Immutable updates: `setProducts(products.map(p => p.id === id ? { ...p, ...changes } : p))`
- Append: `setSales([...sales, newSale])`
- Remove: `setItems(items.filter(i => i.id !== deleteId))`
## Error Handling
- All validation errors shown via `toast.error('...')` from `sonner` — imported as `import { toast } from 'sonner'`
- No try/catch in page components — validation happens inline before state mutations
- `toast.success('...')` for confirmations; `toast.warning('...')` for soft alerts (e.g., low stock)
- Toast with custom duration: `toast.error('...', { duration: 8000 })` for critical alerts
- `useLocalStorage` wraps reads/writes in try/catch — `console.error(...)` on failure, silent fallback to initial value
- `getStoreSettings()` in `src/lib/storeInfo.ts` has empty catch block `catch {}` — returns `defaultSettings` on any error
- Guard clauses pattern: early return with `toast.error` if invalid
- Example: `finalizeSale()` in `src/pages/POS.tsx` has ~10 sequential validation guards before the mutation
## Logging
- No structured logging framework
- `console.error(...)` used only in `useLocalStorage` for storage read/write failures
- No `console.log` debug statements in production code
## Comments
- Used in `src/lib/cardFees.ts` for `getCardFee` and `calculateFee` functions — includes `@param` and `@returns`
- Not used elsewhere; most code is self-documenting through TypeScript types and descriptive names
- Section headings in large files: `// Card fee calculations`, `// Split payment helpers`, `// Crediário amount`
- Data section labels in reports: `// ======= FECHAMENTO DE CAIXA =======`
- Suppressed lint: `// eslint-disable-line react-hooks/exhaustive-deps` appears in `src/pages/CreditNotes.tsx:74`
## Component Design
- Large, self-contained — each page in `src/pages/` handles its own data loading, filtering, form state, and CRUD operations
- Pages render `<Layout>` as outermost wrapper, then `<PageHeader>` for title/actions
- No sub-component extraction — all JSX lives in the single page component function
- Located in `src/components/` — only layout/presentational pieces are extracted
- Props interfaces defined immediately above the component function
- `children: React.ReactNode` typed as `import React` is NOT imported separately (React 17+ JSX transform)
- All primitives in `src/components/ui/` — treated as unmodified library code
- Composed in pages/components via named imports: `import { Button } from '@/components/ui/button'`
- `cn()` utility from `src/lib/utils.ts` used for conditional class merging — wraps `clsx` + `tailwind-merge`
- `formatCurrency` is reimplemented locally in `src/pages/Returns.tsx` (not imported from `src/lib/formatters.ts`)
- `paymentLabels` map is duplicated in `src/pages/Index.tsx` (not imported from `src/lib/formatters.ts`)
## Module Design
- Pages: `export default` — matching React Router convention
- Components: named exports — `export function ComponentName`
- Lib utilities: named exports — multiple functions per file
- Types: named exports from `src/types/index.ts` and `src/types/settings.ts`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
```
## Component Responsibilities
| Component | Responsibility | File |
|-----------|----------------|------|
| `Index` | Dashboard KPIs, low stock alerts, top products | `src/pages/Index.tsx` |
| `POS` | Cart management, payment, crediário generation, stock deduction | `src/pages/POS.tsx` |
| `Sales` | Sales history, full estorno (refund), partial devolução | `src/pages/Sales.tsx` |
| `CreditNotes` | Installment list, payment registration, discount, overdue tracking | `src/pages/CreditNotes.tsx` |
| `Returns` | Standalone devolução flow (by client or sale code) | `src/pages/Returns.tsx` |
| `Quotes` | Orçamento builder + PDF generation | `src/pages/Quotes.tsx` |
| `Clients` | Client CRUD + tags + creditLimit + storeCredit display | `src/pages/Clients.tsx` |
| `Products` | Product CRUD + bulk price adjustment by category | `src/pages/Products.tsx` |
| `Reports` | Fechamento de caixa (daily) + monthly + receivables | `src/pages/Reports.tsx` |
| `Settings` | Store metadata, crediário interest rate, discount presets | `src/pages/Settings.tsx` |
| `Layout` | Sidebar nav wrapper (responsive) | `src/components/Layout.tsx` |
| `useLocalStorage` | Async IPC bridge to electron-store (or localStorage fallback) | `src/hooks/useLocalStorage.ts` |
## Pattern Overview
- Each page owns its own data loading via `useLocalStorage` calls at the top
- No global state manager (no Redux, no Zustand, no Context) — each page re-reads from storage independently
- All mutations are full array replacements (e.g., `setSales([...sales, newSale])`)
- No optimistic updates or rollback — each write is immediate and final
- Business logic is collocated with UI in page files; lib/ files contain only pure computation helpers and PDF generation
## Layers
- Purpose: Route-level screens; own all state, validation, and mutations for their domain
- Location: `src/pages/`
- Contains: React components with full business logic inline
- Depends on: `useLocalStorage`, `src/lib/`, `src/components/`, `src/types/`
- Used by: Router in `src/App.tsx`
- Purpose: Layout shell and reusable UI pieces (not shadcn primitives)
- Location: `src/components/`
- Key files: `Layout.tsx`, `ClientCombobox.tsx`, `PageHeader.tsx`, `StatsCard.tsx`, `EmptyState.tsx`
- Purpose: shadcn/ui component library (do not modify)
- Location: `src/components/ui/`
- Contains: Button, Input, Card, Dialog, Select, Badge, Tabs, etc.
- Purpose: Pure functions — PDF generation, card fee calculations, formatting, CSV export
- Location: `src/lib/`
- Contains: `generateReceipt.ts`, `generateQuote.ts`, `generateCrediarioReceipt.ts`, `cardFees.ts`, `formatters.ts`, `csvExport.ts`, `storeInfo.ts`, `utils.ts`
- Depends on: `jsPDF`, `src/types/`, `src/lib/storeInfo.ts`
- Purpose: Shared TypeScript interfaces
- Location: `src/types/index.ts`, `src/types/settings.ts`
- Purpose: Abstract electron-store vs localStorage depending on environment
- Location: `src/hooks/useLocalStorage.ts`
- Purpose: Desktop wrapper — window creation, IPC handlers for data persistence
- Location: `electron/main.cjs`, `electron/preload.cjs`
- Storage: `electron-store` (JSON file at OS userData path, e.g., `%APPDATA%/rc-ferragista/`)
## Data Flow
### Sale (Venda) Flow — Primary Path
### Crediário Installment Payment Flow
### Discount on Installment Flow
### Sale Estorno (Full Reversal) Flow
### Devolução (Partial Return) Flow — Two Entry Points
### Quote (Orçamento) Flow
## Key Abstractions
- Purpose: Central record for a completed transaction (or pending crediário)
- File: `src/types/index.ts` (line 49)
- Key fields: `status` (enum: `completed | refunded | crediario_pending | crediario_paid`), `paymentEntries` (optional split payments), `crediarioPaid` (running total of payments received)
- Purpose: Individual monthly payment obligation in a crediário sale
- File: `src/types/index.ts` (line 83)
- Key fields: `number` (0 = entrada/down payment, 1..N = monthly), `amount`, `amountPaid`, `discountApplied`, `dueDate`, `status` (`open | paid | overdue | cancelled`)
- The `number: 0` installment is always `status: 'paid'` (created at time of sale as the down payment receipt)
- Purpose: Audit record for partial or full devolução
- File: `src/types/index.ts` (line 100)
- Key fields: `originalSaleId`, `items` (returned subset), `totalRefunded`, `creditGenerated`, `reversedAt` (populated when the return itself is reversed)
- Purpose: Audit log for each payment or discount event on a crediário installment
- File: `src/types/index.ts` (line 71)
- Key fields: `installmentId`, `type` (`payment | discount`), `amount`, `paymentMethod`
- A simple numeric field on `Client` (`src/types/index.ts` line 16)
- Increased by: devolução with client, estorno of paid crediário amounts
- Decreased by: POS checkout using `store_credit` payment method
- Not tracked as a separate ledger; the single field is mutated directly
- Purpose: Runtime configuration that controls system behavior
- File: `src/types/settings.ts`
- Key fields: `crediarioInterestRate` (monthly %, display-only), `discountPresets`, `lowStockThreshold`
## Entry Points
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: Electron `BrowserWindow.loadFile()` (prod) or `loadURL('http://localhost:8080')` (dev)
- Location: `electron/main.cjs`
- Exposes IPC: `store-get`, `store-set`, `store-delete`, `open-data-folder`
- Location: `electron/preload.cjs`
- Exposes `window.electron.store.{get,set,delete}` and `window.electron.openDataFolder` via `contextBridge`
- Location: `src/App.tsx`
- Uses `HashRouter` (required for Electron file:// protocol)
- All 10 routes are flat, no nested routes
## Architectural Constraints
- **Threading:** Single-threaded React UI. Electron main process and renderer process communicate via IPC. There are no web workers.
- **Global state:** None. Each page independently calls `useLocalStorage` for every key it needs. Two pages loading the same key will each have their own React state copy — changes in one page are NOT visible to another until navigation causes a remount and re-read.
- **Storage writes are synchronous from the UI perspective but asynchronous to electron-store:** `setValue` in `useLocalStorage.ts` calls `window.electron.store.set(key, valueToStore)` without awaiting — the IPC call is fire-and-forget. If the app crashes immediately after, data may not be written.
- **No referential integrity:** When a client is deleted, their `clientId` in `Sale` and `Installment` records remains stale. No cascade delete logic exists.
- **Milheiro (mil) unit:** Products with `unit === 'mil'` have their `price` stored per 1000 units. The POS divides price and cost by 1000 for `unitPrice`, and divides stock deduction by 1000. This must be accounted for in any new feature touching stock or pricing.
## Anti-Patterns
### Interest Rate is Display-Only
### No Cross-Page State Consistency
### Installment Overdue Status is Only Updated on CreditNotes Mount
## Error Handling
- Validation guards at the top of action handlers with early returns on failure
- `toast.error()` for user-facing errors
- `console.error()` in `useLocalStorage.ts` for storage failures (not surfaced to user)
- No error boundary components
## PDF Generation
| Document | Function | File |
|----------|----------|------|
| Sale receipt (cupom) | `generateReceipt(sale)` | `src/lib/generateReceipt.ts` |
| Return receipt (devolução) | `generateRefundReceipt(returnRecord, sale?)` | `src/lib/generateReceipt.ts` |
| Crediário statement | `generateCrediarioStatement(client, installments, sales)` | `src/lib/generateCrediarioReceipt.ts` |
| Quote (orçamento) | `generateQuotePDF(quote)` | `src/lib/generateQuote.ts` |
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
