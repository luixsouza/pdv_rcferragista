---
phase: 02-credi-rio
reviewed: 2026-06-20T18:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/installmentStatus.ts
  - src/types/index.ts
  - src/pages/POS.tsx
  - src/pages/CreditNotes.tsx
findings:
  critical: 4
  warning: 2
  info: 1
  total: 7
status: issues_found
---

# Phase 02 (Crediário): Code Review Report

**Reviewed:** 2026-06-20T18:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 2 introduced four changes: a shared overdue helper (`installmentStatus.ts`), an optional `interestAmount` field on `CreditPayment`, POS delinquency re-wiring, and a substantial rewrite of `CreditNotes.tsx` to add effective-status derivation, per-client/per-sale summaries, and explicit interest charging.

The core architecture is sound — the `getEffectiveStatus` single-source-of-truth pattern is correctly applied throughout display and aggregation paths inside `CreditNotes.tsx`. The interest opt-in flow respects CRED-03, `principalPortion` correctly prevents `amountPaid` from exceeding `installment.amount`, and cancelled installments are excluded from money sums.

However, four correctness bugs were found:

1. **POS delinquency check is blind to already-persisted `'overdue'` installments** (BLOCKER) — allows crediário sales to genuinely blocked clients.
2. **`sale.crediarioPaid` loses interest from all prior payments** (BLOCKER) — each call to `handlePayment` only adds the *current* payment's `chargedInterest`, overwriting the running total; interest from earlier installments silently disappears from the sale record.
3. **`allPaid` in `handlePayment` never resolves when any installment is `'cancelled'`** (BLOCKER) — the `crediario_paid` status is never written to partially-returned sales.
4. **`totalPago` in Resumo double-counts discount** (BLOCKER) — `discountApplied` is subtracted from `totalDevido` AND added to `totalPago`, making `saldo` understated by exactly `2 * discountApplied`.

Two additional warnings were found:

5. **Histórico search input shares state with Parcelas client-filter** (WARNING) — typing in Histórico corrupts the Parcelas tab filter; the search itself is also non-functional.
6. **`allPaid` in `handleApplyDiscount` also excludes cancelled installments** (WARNING) — same as CR-03 but in the discount handler.

---

## Critical Issues

### CR-01: POS delinquency check misses already-persisted `'overdue'` installments

**File:** `src/pages/POS.tsx:139`

**Issue:** `isInstallmentOverdue(i)` returns `false` when `i.status === 'overdue'` (line 12 of `installmentStatus.ts` guards `if (inst.status !== 'open') return false`). The design intent documented in the plan is that `isInstallmentOverdue` catches **only** open-past-due installments while `getEffectiveStatus` handles the `'overdue'` pass-through. POS uses `isInstallmentOverdue` alone — so any client whose overdue installments were persisted by the CreditNotes mount `useEffect` (status written as `'overdue'` to store) will not be detected as delinquent at POS checkout. The delinquency guard at `finalizeSale` line 304 will be bypassed, allowing a new crediário sale to a client who is overdue.

**Fix:** Replace `isInstallmentOverdue(i)` with `getEffectiveStatus(i) === 'overdue'` so both freshly-lapsed and already-persisted overdue installments are caught:

```typescript
// src/pages/POS.tsx line 138-140
const clientOverdueInstallments = selectedClient
  ? installments.filter(i => i.clientId === selectedClient && getEffectiveStatus(i) === 'overdue')
  : [];
```

Also add the import:
```typescript
import { isInstallmentOverdue, getEffectiveStatus } from '@/lib/installmentStatus';
```

---

### CR-02: `sale.crediarioPaid` loses interest from prior payments on each subsequent payment

**File:** `src/pages/CreditNotes.tsx:267`

**Issue:** `crediarioPaid` is set to `totalPrincipalOnSale + entryPaid + chargedInterest` on every call to `handlePayment`. `totalPrincipalOnSale` is correctly re-derived from installment `amountPaid` values (principal only, so it accumulates across payments). But `chargedInterest` carries only the **current** payment's interest — interest charged in previous payment calls is not included in `totalPrincipalOnSale` (by design, to prevent capitalization), nor in any other term. On the second interest-bearing payment, the `crediarioPaid` value replaces the old total rather than accumulating, silently dropping all prior interest from the sale record.

Concrete scenario: 3-installment crediário, all overdue; operator pays installment 1 with R$10 interest (`crediarioPaid = 310 + 0 + 10 = 320`), then pays installment 2 with R$8 interest (`crediarioPaid = 620 + 0 + 8 = 628`). The R$10 from installment 1 is erased. `crediarioPaid` is understated by all prior-payment interest.

**Fix:** Sum past interest from `creditPayments` records before computing the total, or keep a running `cumulativeInterest` in the sale record. The simplest correct approach is to sum `interestAmount` from all existing `creditPayments` for this sale, add the current payment's interest:

```typescript
// After line 254, before updatedSales:
const pastInterest = creditPayments
  .filter(p => p.saleId === selectedInstallment.saleId && p.type !== 'discount' && p.interestAmount)
  .reduce((sum, p) => sum + (p.interestAmount || 0), 0);

// Line 267 becomes:
crediarioPaid: totalPrincipalOnSale + entryPaid + pastInterest + chargedInterest,
```

Note: `creditPayments` here should reference the already-committed array (before `setCreditPayments` flush), so `pastInterest` captures all prior interest events. Since `setCreditPayments` is called at line 232 before `setSales`, and React state updates are batched, reading `creditPayments` (the stale closure value) excludes the current payment — add `chargedInterest` separately as shown.

---

### CR-03: `allPaid` never becomes `true` when sale has cancelled installments — sale never reaches `crediario_paid`

**File:** `src/pages/CreditNotes.tsx:249`

**Issue:** `saleInstallments` at line 248 includes **all** installments with `number > 0`, including `status === 'cancelled'`. The `.every()` predicate at line 249 is:
```
i.status === 'paid' || (i.id === selectedInstallment.id && isFullyPaid)
```
A cancelled installment satisfies neither condition, so `allPaid` stays `false` even after the operator has paid every active installment. The sale will remain stuck at `crediario_pending` forever when a return has cancelled some installments.

**Fix:** Exclude cancelled installments from the `saleInstallments` filter:

```typescript
// Line 248 — add && i.status !== 'cancelled'
const saleInstallments = updatedInstallments.filter(
  i => i.saleId === selectedInstallment.saleId && i.number > 0 && i.status !== 'cancelled'
);
```

The predicate at line 249 can then stay unchanged.

---

### CR-04: `totalPago` double-counts `discountApplied` — `saldo` is understated

**File:** `src/pages/CreditNotes.tsx:502-504`

**Issue:** The per-client summary computes:
```typescript
const totalDevido = roundCurrency(nonCancelled.reduce((sum, i) => sum + i.amount - (i.discountApplied || 0), 0));
const totalPago  = roundCurrency(nonCancelled.reduce((sum, i) => sum + i.amountPaid + (i.discountApplied || 0), 0));
const saldo      = roundCurrency(totalDevido - totalPago);
```

The discount is subtracted from `totalDevido` AND added to `totalPago`, so it is counted twice in the arithmetic: `saldo = sum(amount - disc) - sum(amountPaid + disc) = sum(amount - amountPaid) - 2 * sum(disc)`. The correct remaining balance per installment is `amount - amountPaid - disc`, not `amount - amountPaid - 2*disc`.

Concrete example: installment amount=100, amountPaid=50, discountApplied=10.
- Correct remaining: 100 - 50 - 10 = **40**
- `totalDevido` = 90, `totalPago` = 60, `saldo` = **30** (wrong — understated by 10)

The same double-counting bug also affects the per-sale breakdown at lines 600-602:
```typescript
const saleDevido = roundCurrency(saleNonCancelled.reduce((sum, i) => sum + i.amount - (i.discountApplied || 0), 0));
const salePago   = roundCurrency(saleNonCancelled.reduce((sum, i) => sum + i.amountPaid + (i.discountApplied || 0), 0));
const saleSaldo  = roundCurrency(saleDevido - salePago);
```

**Fix (per-client totals, lines 502-504):**

```typescript
const totalDevido = roundCurrency(nonCancelled.reduce((sum, i) => sum + i.amount - (i.discountApplied || 0), 0));
const totalPago   = roundCurrency(nonCancelled.reduce((sum, i) => sum + i.amountPaid, 0));
const saldo       = roundCurrency(totalDevido - totalPago);
```

Apply the same fix to lines 600-602 (per-sale breakdown).

The economic meaning: `totalDevido` = what the client contracted to pay after discounts; `totalPago` = cash actually received; `saldo` = remaining cash owed.

---

## Warnings

### WR-01: Histórico tab search input shares state with Parcelas client-filter (and never filters)

**File:** `src/pages/CreditNotes.tsx:842-850`

**Issue:** The Histórico tab's "Buscar por cliente ou data..." input is bound to `selectedClientFilter` (line 842), the same state variable used as the UUID-based client-ID filter in the Parcelas tab (line 121). Two side-effects:

1. Typing in the Histórico search field overwrites `selectedClientFilter` with a free-text string, corrupting the Parcelas client combobox filter on the next tab switch.
2. The `filteredHistory` computation (lines 849-850) never reads `selectedClientFilter` — it only sorts. The search input produces zero filtering effect.

**Fix:** Introduce a separate `historySearch` state variable and apply it to filter `creditPayments` by `clientName` or `createdAt`:

```typescript
const [historySearch, setHistorySearch] = useState('');

// In Histórico tab:
<Input
  placeholder="Buscar por cliente ou data..."
  value={historySearch}
  onChange={e => setHistorySearch(e.target.value)}
  className="pl-10"
/>

// In filteredHistory:
const filteredHistory = creditPayments
  .filter(p =>
    !historySearch ||
    p.clientName.toLowerCase().includes(historySearch.toLowerCase()) ||
    p.createdAt.includes(historySearch)
  )
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
```

---

### WR-02: `allPaid` in `handleApplyDiscount` also fails when sale has cancelled installments

**File:** `src/pages/CreditNotes.tsx:347-351`

**Issue:** Same logical gap as CR-03, but in the discount handler. `saleInstallments` at line 347 includes cancelled installments, and the `.every()` predicate at lines 348-350:
```typescript
i.status === 'paid' || i.amountPaid >= (i.amount - disc - 0.01)
```
does not pass for `status === 'cancelled'` (since `amountPaid` is typically 0 and `amount - disc` is positive). A sale with at least one cancelled and all other installments paid/discounted-to-zero will never be promoted to `crediario_paid`.

**Fix:** Mirror the fix from CR-03:

```typescript
// Line 347 — add && i.status !== 'cancelled'
const saleInstallments = updatedInstallments.filter(
  i => i.saleId === discountInstallment.saleId && i.number > 0 && i.status !== 'cancelled'
);
```

---

## Info

### IN-01: `isInstallmentOverdue` imported but unused in `CreditNotes.tsx`

**File:** `src/pages/CreditNotes.tsx:36`

**Issue:** `isInstallmentOverdue` is imported at line 36 but not called anywhere inside `CreditNotes.tsx`. All overdue checks within the file use `getEffectiveStatus`. The summary (02-02-SUMMARY.md line 86) notes "2 (import + unused-but-imported from lib)" — this was noted during implementation and accepted, but it remains dead import code.

**Fix:** Remove `isInstallmentOverdue` from the import statement:

```typescript
import { getEffectiveStatus } from '@/lib/installmentStatus';
```

---

_Reviewed: 2026-06-20T18:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
