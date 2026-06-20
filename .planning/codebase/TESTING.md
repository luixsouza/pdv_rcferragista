# Testing Patterns

**Analysis Date:** 2026-06-20

## Test Framework

**Runner:** None installed.

No test runner (Vitest, Jest, or any other) is configured in this project. There is no `vitest.config.*`, `jest.config.*`, or any test configuration file present.

No test-related packages appear in `package.json` — neither in `dependencies` nor `devDependencies`.

**Run Commands:**
```bash
# No test scripts exist in package.json
# Available scripts are: dev, build, build:dev, lint, preview, electron:dev, electron:build
```

## Test Files

**Count:** Zero.

A search for `*.test.*` and `*.spec.*` files across the entire repository returned no results. There are no test files of any kind in this project.

## Current State

This codebase has **no automated tests whatsoever**. There is:

- No unit test coverage
- No integration test coverage
- No end-to-end test framework (no Playwright, Cypress, or Puppeteer)
- No snapshot tests
- No test utilities, fixtures, or factories
- No coverage configuration or coverage thresholds

## Code Testability Assessment

Several patterns in the codebase make future testing harder to retrofit:

**Tightly coupled business logic:**
- All business logic lives inside React component functions — validation, calculations, and mutations are interleaved with JSX in page files like `src/pages/POS.tsx` and `src/pages/CreditNotes.tsx`
- There is no service layer or separate business logic module that could be unit-tested in isolation

**Storage abstraction (partial):**
- `src/hooks/useLocalStorage.ts` bridges Electron IPC (`window.electron.store`) and `localStorage`; this hook would require mocking `window.electron` in any test environment
- `src/lib/storeInfo.ts` reads settings synchronously from `window.electron.store` or `localStorage` — same coupling issue

**Pure utility functions (testable as-is):**
These functions have no side effects and no DOM/Electron dependencies — they are the most natural starting point for adding tests:
- `src/lib/cardFees.ts` — `getCardFee()`, `calculateFee()`, `hasDebit()`
- `src/lib/documentValidation.ts` — `validateCPF()`, `validateCNPJ()`, `validateDocument()`, `formatCPF()`, `formatCNPJ()`
- `src/lib/formatters.ts` — `formatCurrency()`
- `src/lib/generateProductCode.ts` — `generateProductCode()` (has randomness; would need seeding)
- `src/lib/csvExport.ts` — `exportToCSV()` (depends on `document.createElement` and `URL.createObjectURL`)

## Recommended Setup (if adding tests)

Given the stack (Vite + React + TypeScript), Vitest is the natural fit:

```bash
bun add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Minimal `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

The `@` alias must be duplicated in the Vitest config because Vitest does not inherit from `vite.config.ts` automatically.

## Highest Priority Tests to Add

Given business criticality, these areas should be tested first:

**1. Financial calculations** — incorrect math causes real monetary loss:
- `src/lib/cardFees.ts`: `calculateFee()` with various fee percentages and amounts; rounding behavior
- `src/pages/POS.tsx` `finalizeSale()` logic: crediário installment generation, store credit deduction, `Math.abs(totalAllocated - total) > 0.01` tolerance
- Milheiro (unit `'mil'`) quantity/price scaling: `effectiveStock = product.stock * 1000`, `unitPrice = product.price / 1000`, stock deduction `quantity / 1000`

**2. Document validation** — directly user-facing:
- `src/lib/documentValidation.ts`: CPF and CNPJ validation algorithms with known valid/invalid values

**3. Credit limit enforcement:**
- Client delinquency check (`isClientDelinquent`) and credit available calculation in `src/pages/POS.tsx`

---

*Testing analysis: 2026-06-20*
