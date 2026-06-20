# Coding Conventions

**Analysis Date:** 2026-06-20

## Naming Patterns

**Files:**
- Pages: PascalCase matching the route concept — `POS.tsx`, `CreditNotes.tsx`, `Products.tsx`
- Shared components: PascalCase — `ClientCombobox.tsx`, `PageHeader.tsx`, `EmptyState.tsx`, `StatsCard.tsx`
- UI primitives (shadcn): kebab-case — `alert-dialog.tsx`, `dropdown-menu.tsx`, `input-otp.tsx`
- Hooks: camelCase with `use` prefix — `useLocalStorage.ts`, `use-mobile.tsx`
- Lib utilities: camelCase — `formatters.ts`, `cardFees.ts`, `csvExport.ts`, `storeInfo.ts`
- Type files: lowercase — `src/types/index.ts`, `src/types/settings.ts`

**Functions and Variables:**
- Functions: camelCase — `formatCurrency`, `getCardFee`, `calculateFee`, `exportToCSV`, `validateDocument`
- Event handlers: `handle` prefix — `handleSave`, `handleEdit`, `handleDelete`, `handleExport`, `handleCloseDialog`
- Boolean state: descriptive — `dialogOpen`, `splitMode`, `isPercentage`, `isClientDelinquent`
- Derived state identifiers: descriptive noun phrases — `filteredProducts`, `recentClients`, `totalAllocated`
- Constants: SCREAMING_SNAKE_CASE for true constants — `CARD_FEE_TABLE`, `CARD_BRAND_LABELS`, `LOW_STOCK_THRESHOLD`

**Types/Interfaces:**
- Interfaces: PascalCase — `Product`, `Client`, `Sale`, `SaleItem`, `PaymentEntry`, `Installment`, `ReturnRecord`, `Quote`
- Exported types: PascalCase — `CardBrand`
- Prop interfaces: `[ComponentName]Props` — `LayoutProps`, `ClientComboboxProps`, `PageHeaderProps`, `StatsCardProps`
- `Omit<>` used for form data shapes: `Omit<Product, 'id' | 'createdAt' | 'updatedAt'>`

**React Components:**
- Page components: `export default function ComponentName()` — all pages use default export
- Shared components: named export function — `export function Layout(...)`, `export function ClientCombobox(...)`
- Some pages use arrow function with `const` — `const Settings = () => (...)`, `const Index = () => {...}`; no consistent rule between pages, but most pages use function declaration syntax

## Code Style

**Formatting:**
- No Prettier config detected — formatting is not enforced by tooling
- Indentation: 2-space indent throughout
- Trailing commas used in most places
- Single quotes for imports, double quotes in JSX attribute strings

**Linting:**
- ESLint 9 flat config — `eslint.config.js`
- Rules enabled: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-plugin-react-hooks` recommended
- `@typescript-eslint/no-unused-vars` is explicitly set to `"off"` — unused vars are not flagged
- `react-refresh/only-export-components` set to `"warn"` with `allowConstantExport: true`
- TypeScript: strict mode not enabled; `tsconfig.app.json` uses default Vite scaffold settings

## Import Organization

**Order (observed pattern, not enforced):**
1. React imports — `import { useState, useMemo } from 'react'`
2. Internal layout/shared components — `import { Layout } from '@/components/Layout'`
3. Custom hooks — `import { useLocalStorage } from '@/hooks/useLocalStorage'`
4. Domain types — `import { Product, Client, Sale } from '@/types'`
5. Icons (lucide-react) — `import { ShoppingCart, Plus, ... } from 'lucide-react'`
6. External lib imports — `import { addMonths } from 'date-fns'`
7. Internal lib utilities — `import { formatCurrency } from '@/lib/formatters'`
8. UI primitives (shadcn) — `import { Button } from '@/components/ui/button'`

**Path Aliases:**
- `@/` maps to `src/` — configured in `vite.config.ts` via `resolve.alias`
- All internal imports use `@/` — never use relative paths like `../../`

## Money and Decimal Value Handling

This is a POS system handling BRL currency and fractional quantities (hardware store units). The conventions are:

**Currency storage:**
- All monetary values stored as JavaScript `number` (IEEE 754 float) — `price: number`, `total: number`, `amount: number`
- No `Decimal` library used — floating-point arithmetic is used throughout

**Currency display:**
- Always use `formatCurrency(value: number)` from `src/lib/formatters.ts` for UI display
- `formatCurrency` wraps `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` — outputs `R$ 1.234,56` format
- In PDF/receipt generation, raw `.toFixed(2)` is used directly: `R$ ${value.toFixed(2)}`

**Rounding:**
- Fee calculations use `Math.round(x * 100) / 100` — see `calculateFee()` in `src/lib/cardFees.ts`
- Bulk price adjustments use `Math.round(p[bulkField] * factor * 100) / 100` — see `src/pages/Products.tsx:486`
- Discount and total calculations do NOT round — raw floats flow through: `subtotal - finalDiscountValue`
- Floating-point comparison tolerance: `0.01` used as epsilon — `Math.abs(totalAllocated - total) > 0.01` and `crediarioFinanced > clientCreditAvailable + 0.01`

**Fractional quantities (milheiro units):**
- Products with `unit === 'mil'` (milheiro = 1000 units) use a scaling pattern:
  - Stock stored per milheiro, converted to per-unit for display: `effectiveStock = product.stock * 1000`
  - Price stored per milheiro, converted to per-unit: `unitPrice = product.price / 1000`
  - Stock deducted in milheiro units: `deduction = cartItem.quantity / 1000`
- This pattern appears in `addToCart`, `updateQuantity`, `updateItemQuantity`, and `finalizeSale` in `src/pages/POS.tsx`
- Supported unit codes: `'un'`, `'kg'`, `'mt'`, `'cx'`, `'pc'`, `'lt'`, `'par'`, `'jg'`, `'rl'`, `'mil'` — defined in `src/pages/Products.tsx`

**Input parsing:**
- `parseFloat(e.target.value)` for monetary/decimal inputs; fallback `|| 0` or NaN guard used inconsistently
- `parseInt(e.target.value)` for integer quantities/installment counts
- `parseFloat(e.target.value) || 0` pattern in `src/pages/Products.tsx:304`
- `isNaN(val)` guard pattern in `src/pages/POS.tsx:733` and `src/pages/POS.tsx:843`

## State Management

**Global state: none** — the app uses no Redux, Zustand, Context, or other global state library.

**Persistence layer:**
- All domain data is persisted via `useLocalStorage<T>(key, defaultValue)` hook — `src/hooks/useLocalStorage.ts`
- In Electron (production), data stored via `electron-store` (IPC bridge through `window.electron.store`)
- In browser (dev), falls back to `localStorage`
- Storage keys (used across all pages — must remain consistent):
  - `'products'` — `Product[]`
  - `'clients'` — `Client[]`
  - `'sales'` — `Sale[]`
  - `'installments'` — `Installment[]`
  - `'credit_payments'` — `CreditPayment[]`
  - `'returns'` — `ReturnRecord[]`
  - `'store_settings'` — `StoreSettings`

**Page-level state:**
- Each page manages its own ephemeral UI state with `useState`
- Derived/computed values use `useMemo` — filtering, aggregating, report calculations
- No shared state between pages — each page loads its own `useLocalStorage` slice

**State update pattern:**
- Immutable updates: `setProducts(products.map(p => p.id === id ? { ...p, ...changes } : p))`
- Append: `setSales([...sales, newSale])`
- Remove: `setItems(items.filter(i => i.id !== deleteId))`

## Error Handling

**User-facing errors:**
- All validation errors shown via `toast.error('...')` from `sonner` — imported as `import { toast } from 'sonner'`
- No try/catch in page components — validation happens inline before state mutations
- `toast.success('...')` for confirmations; `toast.warning('...')` for soft alerts (e.g., low stock)
- Toast with custom duration: `toast.error('...', { duration: 8000 })` for critical alerts

**Storage errors:**
- `useLocalStorage` wraps reads/writes in try/catch — `console.error(...)` on failure, silent fallback to initial value

**Silent catch:**
- `getStoreSettings()` in `src/lib/storeInfo.ts` has empty catch block `catch {}` — returns `defaultSettings` on any error

**Validation before action:**
- Guard clauses pattern: early return with `toast.error` if invalid
- Example: `finalizeSale()` in `src/pages/POS.tsx` has ~10 sequential validation guards before the mutation

## Logging

- No structured logging framework
- `console.error(...)` used only in `useLocalStorage` for storage read/write failures
- No `console.log` debug statements in production code

## Comments

**JSDoc-style:**
- Used in `src/lib/cardFees.ts` for `getCardFee` and `calculateFee` functions — includes `@param` and `@returns`
- Not used elsewhere; most code is self-documenting through TypeScript types and descriptive names

**Inline comments:**
- Section headings in large files: `// Card fee calculations`, `// Split payment helpers`, `// Crediário amount`
- Data section labels in reports: `// ======= FECHAMENTO DE CAIXA =======`
- Suppressed lint: `// eslint-disable-line react-hooks/exhaustive-deps` appears in `src/pages/CreditNotes.tsx:74`

## Component Design

**Page components:**
- Large, self-contained — each page in `src/pages/` handles its own data loading, filtering, form state, and CRUD operations
- Pages render `<Layout>` as outermost wrapper, then `<PageHeader>` for title/actions
- No sub-component extraction — all JSX lives in the single page component function

**Shared components:**
- Located in `src/components/` — only layout/presentational pieces are extracted
- Props interfaces defined immediately above the component function
- `children: React.ReactNode` typed as `import React` is NOT imported separately (React 17+ JSX transform)

**shadcn/ui components:**
- All primitives in `src/components/ui/` — treated as unmodified library code
- Composed in pages/components via named imports: `import { Button } from '@/components/ui/button'`
- `cn()` utility from `src/lib/utils.ts` used for conditional class merging — wraps `clsx` + `tailwind-merge`

**Duplicate code observed:**
- `formatCurrency` is reimplemented locally in `src/pages/Returns.tsx` (not imported from `src/lib/formatters.ts`)
- `paymentLabels` map is duplicated in `src/pages/Index.tsx` (not imported from `src/lib/formatters.ts`)

## Module Design

**Exports:**
- Pages: `export default` — matching React Router convention
- Components: named exports — `export function ComponentName`
- Lib utilities: named exports — multiple functions per file
- Types: named exports from `src/types/index.ts` and `src/types/settings.ts`

**Barrel files:** Not used — each import references the specific file path directly.

---

*Convention analysis: 2026-06-20*
