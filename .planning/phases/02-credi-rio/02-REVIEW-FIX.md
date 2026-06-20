---
phase: 02-credi-rio
fixed_at: 2026-06-20T18:30:00Z
review_path: .planning/phases/02-credi-rio/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 02 (Crediário): Code Review Fix Report

**Fixed at:** 2026-06-20T18:30:00Z
**Source review:** .planning/phases/02-credi-rio/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, CR-03, CR-04, WR-01)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: POS delinquency check misses already-persisted `'overdue'` installments

**Files modified:** `src/pages/POS.tsx`
**Commit:** da03e14
**Applied fix:** Added `getEffectiveStatus` to the import from `@/lib/installmentStatus`. Replaced `isInstallmentOverdue(i)` with `getEffectiveStatus(i) === 'overdue'` in the `clientOverdueInstallments` filter so both freshly-lapsed open installments and already-persisted `'overdue'` ones are caught, making POS consistent with CreditNotes.

---

### CR-02: `sale.crediarioPaid` loses interest from prior payments on each subsequent payment

**Files modified:** `src/pages/CreditNotes.tsx`
**Commit:** 28029f9
**Applied fix:** Added `pastInterest` computation before `updatedSales` in `handlePayment`. Reads the stale closure of `creditPayments` (before `setCreditPayments` flush) to sum `interestAmount` across all prior payment records for the same sale, then uses `totalPrincipalOnSale + entryPaid + pastInterest + chargedInterest` for `crediarioPaid` so historical interest is preserved across payments.

---

### CR-03: `allPaid` never becomes `true` when sale has cancelled installments

**Files modified:** `src/pages/CreditNotes.tsx`
**Commit:** ee614e1
**Applied fix:** Added `&& i.status !== 'cancelled'` to the `saleInstallments` filter in BOTH `handlePayment` (line ~249) and `handleApplyDiscount` (line ~355). Cancelled installments are now excluded from the all-settled determination, allowing sales with partially-returned installments to reach `crediario_paid` status once all active installments are paid.

---

### CR-04: `totalPago` double-counts `discountApplied` — `saldo` is understated

**Files modified:** `src/pages/CreditNotes.tsx`
**Commit:** a025ae7
**Applied fix:** Removed `+ (i.discountApplied || 0)` from both `totalPago` and `salePago` reducers (per-client totals block and per-sale breakdown block). `totalPago`/`salePago` now sums only `amountPaid` (cash actually received); `totalDevido`/`saleDevido` continues to subtract `discountApplied`. Mental-math verified: amount=100, discountApplied=10, amountPaid=50 → totalDevido=90, totalPago=50, saldo=40 (correct).

---

### WR-01: Histórico tab search input shares state with Parcelas client-filter (and never filters)

**Files modified:** `src/pages/CreditNotes.tsx`
**Commit:** 771d679
**Applied fix:** Added `const [historySearch, setHistorySearch] = useState('');` state variable. Bound the Histórico tab `<Input>` to `historySearch`/`setHistorySearch` instead of `selectedClientFilter`/`setSelectedClientFilter`. Applied `historySearch` as a `.filter()` on `creditPayments` before `.sort()`, matching `p.clientName.toLowerCase()` and `p.createdAt` against the search term. `selectedClientFilter` is now untouched by Histórico interactions.

---

## Build Verification

`npm run build` completed successfully (exit 0) after all fixes. Output: 2965 modules transformed, no TypeScript or bundler errors. Pre-existing chunk size warning (1,011 kB bundle) is unrelated to these changes.

---

_Fixed: 2026-06-20T18:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
