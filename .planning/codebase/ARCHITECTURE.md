<!-- refreshed: 2026-06-20 -->
# Architecture

**Analysis Date:** 2026-06-20

## System Overview

```text
┌────────────────────────────────────────────────────────────────┐
│                     Electron Shell                             │
│  electron/main.cjs  ←→  electron/preload.cjs                  │
│  (BrowserWindow + IPC handlers for store-get/store-set)        │
└───────────────────────────┬────────────────────────────────────┘
                            │  window.electron.store (IPC bridge)
                            ▼
┌────────────────────────────────────────────────────────────────┐
│                  React SPA (Vite + React 18)                   │
│  src/main.tsx → src/App.tsx  (HashRouter)                      │
│                                                                │
│  Pages (route-level components):                               │
│  /           Index.tsx        Dashboard                        │
│  /products   Products.tsx     Product CRUD + bulk price adj.   │
│  /clients    Clients.tsx      Client CRUD                      │
│  /pos        POS.tsx          Point-of-Sale (venda)            │
│  /quotes     Quotes.tsx       Orçamentos                       │
│  /sales      Sales.tsx        Sales history + estorno/devolução│
│  /credit-notes CreditNotes.tsx Crediário (parcelas/pagamentos) │
│  /returns    Returns.tsx      Standalone devolução flow        │
│  /reports    Reports.tsx      Fechamento de caixa, mensal      │
│  /settings   Settings.tsx     Store config + crediário config  │
└────────────┬───────────────────────────────────────────────────┘
             │  useLocalStorage hook (reads/writes via IPC or localStorage)
             ▼
┌────────────────────────────────────────────────────────────────┐
│              Persistence Layer                                 │
│  Production: electron-store (JSON on disk, userData dir)       │
│  Development: browser localStorage (fallback)                  │
│                                                                │
│  Storage keys:                                                 │
│    'products'        → Product[]                               │
│    'clients'         → Client[]                                │
│    'sales'           → Sale[]                                  │
│    'installments'    → Installment[]                           │
│    'credit_payments' → CreditPayment[]                         │
│    'returns'         → ReturnRecord[]                          │
│    'quotes'          → Quote[]                                 │
│    'store_settings'  → StoreSettings                           │
└────────────────────────────────────────────────────────────────┘
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

**Overall:** Monolithic single-page React application with flat, page-centric architecture. No service layer, no server. All business logic lives inline inside page components. Persistence is managed entirely through the `useLocalStorage` hook which bridges to `electron-store` via Electron's contextBridge IPC.

**Key Characteristics:**
- Each page owns its own data loading via `useLocalStorage` calls at the top
- No global state manager (no Redux, no Zustand, no Context) — each page re-reads from storage independently
- All mutations are full array replacements (e.g., `setSales([...sales, newSale])`)
- No optimistic updates or rollback — each write is immediate and final
- Business logic is collocated with UI in page files; lib/ files contain only pure computation helpers and PDF generation

## Layers

**Pages Layer:**
- Purpose: Route-level screens; own all state, validation, and mutations for their domain
- Location: `src/pages/`
- Contains: React components with full business logic inline
- Depends on: `useLocalStorage`, `src/lib/`, `src/components/`, `src/types/`
- Used by: Router in `src/App.tsx`

**Shared Components:**
- Purpose: Layout shell and reusable UI pieces (not shadcn primitives)
- Location: `src/components/`
- Key files: `Layout.tsx`, `ClientCombobox.tsx`, `PageHeader.tsx`, `StatsCard.tsx`, `EmptyState.tsx`

**UI Primitives:**
- Purpose: shadcn/ui component library (do not modify)
- Location: `src/components/ui/`
- Contains: Button, Input, Card, Dialog, Select, Badge, Tabs, etc.

**Library (lib/) Layer:**
- Purpose: Pure functions — PDF generation, card fee calculations, formatting, CSV export
- Location: `src/lib/`
- Contains: `generateReceipt.ts`, `generateQuote.ts`, `generateCrediarioReceipt.ts`, `cardFees.ts`, `formatters.ts`, `csvExport.ts`, `storeInfo.ts`, `utils.ts`
- Depends on: `jsPDF`, `src/types/`, `src/lib/storeInfo.ts`

**Types:**
- Purpose: Shared TypeScript interfaces
- Location: `src/types/index.ts`, `src/types/settings.ts`

**Persistence Bridge:**
- Purpose: Abstract electron-store vs localStorage depending on environment
- Location: `src/hooks/useLocalStorage.ts`

**Electron Layer:**
- Purpose: Desktop wrapper — window creation, IPC handlers for data persistence
- Location: `electron/main.cjs`, `electron/preload.cjs`
- Storage: `electron-store` (JSON file at OS userData path, e.g., `%APPDATA%/rc-ferragista/`)

## Data Flow

### Sale (Venda) Flow — Primary Path

1. User searches product in combobox (`POS.tsx` `filteredProducts`) and calls `addToCart(product)`
2. Cart accumulates `SaleItem[]` with `productId`, `productName`, `quantity`, `unitPrice`, `costPrice`, `total`
3. User selects client (optional for most payments; **required** for crediário and store_credit)
4. User chooses payment method (single or split via `splitMode` toggle)
5. For card payments: user selects `CardBrand` + installments → `getCardFee()` from `src/lib/cardFees.ts` calculates fee
6. For crediário: user sets `installmentCount` (1–12) and optional `entryAmount`
7. `finalizeSale()` runs all validations, then:
   - Constructs `Sale` object with `crypto.randomUUID()` as id
   - Sets `status: 'crediario_pending'` if crediário, otherwise `'completed'`
   - Deducts stock from `products` (handles `unit === 'mil'` divisor)
   - Saves `Sale` to `sales` array in storage
   - If crediário: generates `Installment[]` records (one optional `number: 0` entry record, then `number: 1..N` monthly records via `addMonths`)
   - If `store_credit` used: deducts from `client.storeCredit`
   - Emits low-stock and zero-stock toast warnings
8. Cart resets to empty state

### Crediário Installment Payment Flow

1. User opens `CreditNotes.tsx` (`/credit-notes`)
2. On mount, `useEffect` scans all `installments` where `status === 'open'` and `dueDate` is before today → updates them to `status: 'overdue'` in storage
3. User selects installment and clicks "Pagar" → `openPaymentDialog(inst)` pre-fills `paymentAmount` with remaining balance
4. `handlePayment()`:
   - Creates `CreditPayment` record (stored in `credit_payments`)
   - Updates `Installment.amountPaid` and marks `status: 'paid'` if fully paid
   - Recalculates `Sale.crediarioPaid` and flips `Sale.status` to `'crediario_paid'` when all installments of that sale are paid
5. Interest is computed **display-only** from `StoreSettings.crediarioInterestRate` (monthly %) × months overdue × remaining — it is NOT automatically added to `amountPaid` or installment amounts

### Discount on Installment Flow

1. User clicks "Desconto" on an installment in `CreditNotes.tsx`
2. `handleApplyDiscount()`:
   - Adds to `Installment.discountApplied` (cumulative)
   - If `amountPaid >= (amount - newDiscount)`, marks installment as `'paid'`
   - Records a `CreditPayment` entry with `type: 'discount'` for audit history
   - Checks if all installments of that sale are now paid → flips sale status

### Sale Estorno (Full Reversal) Flow

1. User opens a sale in `Sales.tsx` detail dialog and clicks "Estornar Venda"
2. `handleRefund(sale)` in `Sales.tsx`:
   - Restores stock for all items in `sale.items` (reverse of deduction)
   - If sale is crediário: cancels all related `Installment` records (`status: 'cancelled'`)
   - If any crediário installments were already paid (`amountPaid > 0`): adds that total back to `client.storeCredit` as compensation
   - Marks `Sale.status = 'refunded'`
3. Estorno is available for sales with status `completed`, `crediario_pending`, `crediario_paid`, or undefined (legacy)

### Devolução (Partial Return) Flow — Two Entry Points

**Entry Point A: From Sales history (`Sales.tsx`)**
1. Click RotateCcw icon on a sale → `initiateReturn(sale)` → shows item checklist
2. Items pre-loaded with remaining returnable quantities (tracks prior returns via `returns` array, excluding reversed ones)
3. `handleReturnFromSale()` creates `ReturnRecord`, restores stock, adds `returnTotal` to `client.storeCredit`, marks sale as `'refunded'` if all items returned

**Entry Point B: Standalone Returns page (`Returns.tsx`)**
1. Find sale by client combobox or by sale code search
2. Same item selection UI; same `handleReturn()` logic
3. Additionally supports reversing a previous `ReturnRecord` (`handleReverseReturn`): deducts stock back, removes credit from client, marks `ReturnRecord.reversedAt`
4. Returns history shows all `ReturnRecord[]`

**Credit Generation Rule:** Devolução generates `storeCredit` only when a `clientId` is linked to the original sale. Anonymous sales restore stock only.

### Quote (Orçamento) Flow

1. User builds cart in `Quotes.tsx` (same product search as POS, but no stock deduction)
2. Applies optional discount
3. Saves `Quote` with `status: 'pending'` and optional `expirationDate`
4. Can print or download PDF via `printQuote(quote)` / `downloadQuote(quote)` from `src/lib/generateQuote.ts`
5. Quotes can be manually marked accepted/rejected/expired; they do NOT auto-convert to sales

## Key Abstractions

**Sale:**
- Purpose: Central record for a completed transaction (or pending crediário)
- File: `src/types/index.ts` (line 49)
- Key fields: `status` (enum: `completed | refunded | crediario_pending | crediario_paid`), `paymentEntries` (optional split payments), `crediarioPaid` (running total of payments received)

**Installment (Parcela):**
- Purpose: Individual monthly payment obligation in a crediário sale
- File: `src/types/index.ts` (line 83)
- Key fields: `number` (0 = entrada/down payment, 1..N = monthly), `amount`, `amountPaid`, `discountApplied`, `dueDate`, `status` (`open | paid | overdue | cancelled`)
- The `number: 0` installment is always `status: 'paid'` (created at time of sale as the down payment receipt)

**ReturnRecord:**
- Purpose: Audit record for partial or full devolução
- File: `src/types/index.ts` (line 100)
- Key fields: `originalSaleId`, `items` (returned subset), `totalRefunded`, `creditGenerated`, `reversedAt` (populated when the return itself is reversed)

**CreditPayment:**
- Purpose: Audit log for each payment or discount event on a crediário installment
- File: `src/types/index.ts` (line 71)
- Key fields: `installmentId`, `type` (`payment | discount`), `amount`, `paymentMethod`

**Client.storeCredit (Crédito em Haver):**
- A simple numeric field on `Client` (`src/types/index.ts` line 16)
- Increased by: devolução with client, estorno of paid crediário amounts
- Decreased by: POS checkout using `store_credit` payment method
- Not tracked as a separate ledger; the single field is mutated directly

**StoreSettings:**
- Purpose: Runtime configuration that controls system behavior
- File: `src/types/settings.ts`
- Key fields: `crediarioInterestRate` (monthly %, display-only), `discountPresets`, `lowStockThreshold`

## Entry Points

**Application Bootstrap:**
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: Electron `BrowserWindow.loadFile()` (prod) or `loadURL('http://localhost:8080')` (dev)

**Electron Main:**
- Location: `electron/main.cjs`
- Exposes IPC: `store-get`, `store-set`, `store-delete`, `open-data-folder`

**Preload Bridge:**
- Location: `electron/preload.cjs`
- Exposes `window.electron.store.{get,set,delete}` and `window.electron.openDataFolder` via `contextBridge`

**Router:**
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

**What happens:** `calculateInterest(inst)` in `CreditNotes.tsx` (line 79) computes accrued interest from `crediarioInterestRate` and shows it next to the installment, but the returned value is never added to `paymentAmount` automatically and never written to `Installment.amount`.

**Why it's wrong:** The user sees an interest amount but has to manually type a higher payment value to collect it. There is no enforcement or auto-inclusion.

**Do this instead:** If interest collection must be automated, add it to the installment's effective amount at payment time (in `handlePayment`), or surface a clear "pay with interest" button that pre-fills `paymentAmount` with `remaining + interest`.

### No Cross-Page State Consistency

**What happens:** Two pages that both read `useLocalStorage<Sale[]>('sales', [])` each get their own independent React state. If the user opens a sale in the Sales page and simultaneously the CreditNotes page is mounted, the CreditNotes page will not reflect Sales page mutations until navigation.

**Why it's wrong:** In normal use (single page active at a time) this is harmless, but if any background processing or multi-tab usage is ever added, data divergence will occur.

**Do this instead:** Introduce a shared state layer (React Context or Zustand) if cross-page reactivity is ever needed.

### Installment Overdue Status is Only Updated on CreditNotes Mount

**What happens:** The `useEffect` in `CreditNotes.tsx` (line 61) updates `open` → `overdue` only when the CreditNotes page is visited.

**Why it's wrong:** The dashboard (`Index.tsx`) reads installment statuses directly but those records may still have `status: 'open'` even though the due date has passed, until the user navigates to `/credit-notes`.

**Do this instead:** Move the overdue update to a shared utility called on app init (`src/App.tsx`) so it runs on every session start regardless of which page the user lands on.

## Error Handling

**Strategy:** All validation is inline in action handlers (e.g., `finalizeSale`, `handlePayment`). Errors are surfaced via `toast.error()` (Sonner). There is no try/catch around storage writes beyond the `useLocalStorage` hook's own console.error logging.

**Patterns:**
- Validation guards at the top of action handlers with early returns on failure
- `toast.error()` for user-facing errors
- `console.error()` in `useLocalStorage.ts` for storage failures (not surfaced to user)
- No error boundary components

## PDF Generation

All PDF documents use `jsPDF` with 80mm thermal-receipt-style layout (80×variable mm):

| Document | Function | File |
|----------|----------|------|
| Sale receipt (cupom) | `generateReceipt(sale)` | `src/lib/generateReceipt.ts` |
| Return receipt (devolução) | `generateRefundReceipt(returnRecord, sale?)` | `src/lib/generateReceipt.ts` |
| Crediário statement | `generateCrediarioStatement(client, installments, sales)` | `src/lib/generateCrediarioReceipt.ts` |
| Quote (orçamento) | `generateQuotePDF(quote)` | `src/lib/generateQuote.ts` |

**Pattern:** Each generator function returns a `jsPDF` doc instance. Separate `print*` and `download*` wrappers call `doc.autoPrint()` + `window.open(bloburl)` or `doc.save(filename)`. Store metadata (name, CNPJ, address, phone) is pulled from `getStoreSettings()` at generation time.

## Cross-Cutting Concerns

**Formatting:** `src/lib/formatters.ts` — `formatCurrency()` (Intl.NumberFormat pt-BR BRL) and `paymentLabels` mapping. Import from here, never inline.

**Validation:** Document validation (CPF/CNPJ) in `src/lib/documentValidation.ts`. Card fee lookup in `src/lib/cardFees.ts`.

**Date handling:** All dates stored as ISO strings. Display formatting uses `date-fns` with `ptBR` locale. Crediário due dates generated with `addMonths(now, i)`.

**Authentication:** None. The application is a local desktop app with no user accounts.

---

*Architecture analysis: 2026-06-20*
