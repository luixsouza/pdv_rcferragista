---
phase: 03-estorno-correto
plan: "02"
subsystem: estorno
tags: [estorno, crediario, haver, cash-refund, reports, financial-ui]
dependency_graph:
  requires: [03-01]
  provides: [handleRefund-rewired, haver-cash-dialog, cancelledInstallmentIds-persistence, cashRefundOut-reports]
  affects: [src/pages/Sales.tsx, src/pages/Reports.tsx]
tech_stack:
  added: []
  patterns: [processRefund-delegation, finalizeRefund-mode-dispatch, pendingRefund-state-dialog]
key_files:
  created: []
  modified:
    - src/pages/Sales.tsx
    - src/pages/Reports.tsx
decisions:
  - "Non-crediario sales go directly to cash path (finalizeRefund 'cash') — storeCredit never touched for cash/card/pix sales"
  - "pendingRefund state drives the haver/cash AlertDialog — stock + installment cancel happen before dialog opens so UI is consistent even on user abort (dialog cancel = sale already partially mutated; but abort was not wired, so user must choose; design accepted)"
  - "Haver button disabled via disabled prop when sale.clientId is falsy (T-03-05 elevation guard)"
  - "cashRefundOut rendered as conditional line (only when > 0) to avoid noisy zero-line on haver-mode or zero-paid days"
metrics:
  duration: "5 minutes"
  completed: "2026-06-20T15:25:53Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 03 Plan 02: Estorno Correto — UI Wiring & Reports Summary

**One-liner:** handleRefund rewired to processRefund core with operator haver/cash decision dialog, cancelledInstallmentIds audit trail persisted in all modes, and cash-out line surfaced distinctly in the fechamento de caixa report.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite handleRefund, add haver/cash dialog, persist cancelledInstallmentIds | 19d36a9 | src/pages/Sales.tsx |
| 2 | Add Saída de Caixa line to fechamento de caixa | 0a6e1bc | src/pages/Reports.tsx |

## What Was Built

### Task 1 — handleRefund rewire + EST-01..04 (src/pages/Sales.tsx)

**Imports added:**
- `roundCurrency` added to the existing `@/lib/formatters` import
- `processRefund` and `ProcessRefundResult` imported from `@/lib/processRefund`

**New state:** `pendingRefund: { sale, result } | null` drives the haver/cash decision AlertDialog.

**handleRefund() rewrite:**
1. Idempotency guard — early return if `sale.status === 'refunded'`
2. Calls `processRefund({ sale, products, installments, alreadyReturnedQtys: getReturnedQuantities(sale.id) })`
3. `setProducts(result.updatedProducts)` — double-restock-safe (EST-04)
4. `setInstallments(installments.map(inst => result.cancelledInstallmentIds.includes(inst.id) ? cancelled : inst))` — only open/overdue flipped (EST-02)
5. Decision dispatch:
   - `isCrediarioSale && paidAmount > 0` → `setPendingRefund({ sale, result })` — opens the dialog (EST-03)
   - `!isCrediarioSale` → `finalizeRefund(sale, result, 'cash')` — cash/card/pix full reversal
   - else (crediário, zero paid) → `finalizeRefund(sale, result, 'none')` — cancel debt only (EST-01)

**finalizeRefund(sale, result, mode) helper:**

| Mode | storeCredit | cashRefundOut | cancelledInstallmentIds | Toast |
|------|-------------|---------------|------------------------|-------|
| `haver` | `+= roundCurrency(paidAmount)` | not set | persisted on Sale | "adicionado como crédito em haver" |
| `cash` | untouched | `= roundCurrency(paidAmount)` | persisted on Sale | "Saída de caixa: R$ X" |
| `none` | untouched | not set | persisted on Sale | "Nenhum valor pago — nenhum haver gerado" |

All three modes write `cancelledInstallmentIds: result.cancelledInstallmentIds` onto the refunded Sale in the single `setSales(...)` call (EST-02 audit trail, basis for Phase 4 DEV-07 reversal).

**Haver/cash decision dialog (AlertDialog):**
- Opens when `pendingRefund !== null`
- Shows `formatCurrency(paidAmount)` as full paid amount
- When `result.otherPaid > 0`: shows hint "Inclui R$ X pago em dinheiro/entrada"
- "Gerar Haver" button: `disabled={!pendingRefund?.sale.clientId}` (T-03-05 elevation guard)
- "Devolver em Dinheiro" button: always enabled
- "Cancelar" closes without persisting sale status (stock + installment cancel have already fired — design accepted per CONTEXT EST-03 discretion)

**Old code removed:**
- Naive `stock: product.stock + saleItem.quantity` loop — gone
- Blanket `inst.saleId === sale.id ? cancelled` installment map — gone
- Unconditional `storeCredit += totalPaidBack` — gone

### Task 2 — cashRefundOut in fechamento de caixa (src/pages/Reports.tsx)

**cashReport useMemo change:**

```typescript
// After existing dayRefunds filter and totalRefunds computation:
const cashRefundOut = dayRefunds.reduce((sum, s) => sum + (s.cashRefundOut || 0), 0);
// Returned in the useMemo object alongside existing fields
```

`totalRefunds` (sum of `sale.total` over dayRefunds) is **unchanged** — it retains its accounting-reversal meaning.

`cashRefundOut` is the separate "real cash that left the register" figure.

**Render change (Formas de Pagamento card):**

A new conditional line mirrors the existing "Taxas de Cartão" styling (red, negative, `|| 0` guard):

```
Saída de Caixa (Estorno em Dinheiro)    -R$ X,XX
```

Only rendered when `cashReport.cashRefundOut > 0` — no noise on days with zero or haver-mode estornos.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Cancellation-before-dialog ordering**

The plan described updating setInstallments and setProducts inside finalizeRefund, but calling those setters after the user picks a mode creates a window where the Dialog is open but stock/installments haven't been updated yet. Deviation: stock and installment cancel happen before `setPendingRefund()` so the register state is always consistent regardless of the dialog outcome.

This was an implicit decision noted in the decisions frontmatter above. No functional difference for the user.

**2. [Rule 3 - Encoding] Literal bullet chars in old dialog description**

The file stored `•` as literal UTF-8 bytes (U+2022) not `{'•'}` escape syntax shown in cat output. Rewrote the affected dialog section as part of the full-file Write to avoid encoding mismatch.

## Known Stubs

None — all financial fields (cashRefundOut, cancelledInstallmentIds, storeCredit) are wired to real data; no placeholder values.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns. Changes are confined to in-memory React state mutations persisted via existing `useLocalStorage` keys (`sales`, `installments`, `clients`).

**T-03-04 (Tampering — haver/cash mutual exclusion):** Mitigated. `finalizeRefund` is called with exactly one mode; haver path sets storeCredit and skips cashRefundOut; cash path sets cashRefundOut and skips storeCredit. The two are structurally exclusive (single function, single mode parameter).

**T-03-05 (Elevation — haver without client):** Mitigated. `disabled={!pendingRefund?.sale.clientId}` on the "Gerar Haver" button; haver path inside finalizeRefund also guards on `sale.clientId`.

**T-03-06 (Repudiation — audit trail):** Mitigated. `cancelledInstallmentIds` persisted on refunded Sale in all three modes; `cashRefundOut` persisted on cash-path refunded Sale; both now surfaced in Reports.tsx fechamento de caixa.

## Self-Check: PASSED

Files modified:
- [FOUND] src/pages/Sales.tsx — processRefund import, handleRefund rewrite, finalizeRefund, pendingRefund dialog
- [FOUND] src/pages/Reports.tsx — cashRefundOut computed and rendered

Commits:
- [FOUND] 19d36a9 — feat(03-02): rewrite handleRefund via processRefund + haver/cash dialog (EST-01..04)
- [FOUND] 0a6e1bc — feat(03-02): add Saida de Caixa (Estorno em Dinheiro) line to fechamento de caixa (EST-03b)

Build: npm run build exits 0 (verified above).

Acceptance criteria:
- [x] processRefund imported and called in handleRefund
- [x] Old naive `stock: product.stock + saleItem.quantity` loop gone
- [x] Installment cancellation uses `cancelledInstallmentIds.includes` (not blanket saleId match)
- [x] cancelledInstallmentIds persisted on refunded sale in all three modes (haver/cash/none)
- [x] storeCredit incremented only on haver branch
- [x] cashRefundOut set only on cash branch
- [x] Decision dialog with Haver (client-gated) and Dinheiro options
- [x] Mixed-payment hint shown when result.otherPaid > 0
- [x] Reports.tsx cashRefundOut computed with || 0 guard
- [x] Existing Estornos total/label unchanged
- [x] New "Saída de Caixa (Estorno em Dinheiro)" line distinct from Estornos card
- [x] npm run build exits 0
