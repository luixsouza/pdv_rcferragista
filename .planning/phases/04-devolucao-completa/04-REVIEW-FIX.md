---
phase: 04-devolucao-completa
fixed_at: 2026-06-20T12:30:00Z
review_path: .planning/phases/04-devolucao-completa/04-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-06-20
**Source review:** `.planning/phases/04-devolucao-completa/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, CR-02, CR-03, CR-04, WR-02, WR-04)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-02: haver-capping formula misses split-payment cash portion

**Files modified:** `src/lib/processReturn.ts`
**Commit:** `e3e9503`
**Applied fix:** Replaced the single `paidProportion = crediarioPaidSoFar / sale.total` formula
with a two-slice approach. The return value is split into a `cashShare` (proportional to the
non-crediário payment entries) and a `crediarioShare`. The cash share is always fully credited
(paid at point-of-sale); the crediário share is capped by `crediarioPaidSoFar / crediarioPortion`.
Pure-cash and pure-crediário sales degenerate to the previous behavior. Also simplified the dead
`hasClient ? totalRefunded : 0` ternary in the else branch to just `totalRefunded` (WR-01 dead code).

**Verification example:** R$100 cash + R$200 crediário sale, R$50 crediário paid, full return
(totalRefunded=300): cashShare=100, crediarioShare=200, crediarioProportion=50/200=0.25,
creditGenerated = 100 + 200×0.25 = R$150. Correct (was R$50 before fix).

---

### WR-02: selectSaleFromSearch leaves stale selectedClient for no-client sales

**Files modified:** `src/pages/Returns.tsx`
**Commit:** `f3e096a`
**Applied fix:** Replaced the conditional `if (sale.clientId) { setSelectedClient(sale.clientId); }`
with an unconditional `setSelectedClient(sale.clientId || '')`, which clears any previously-selected
client when the search result has no clientId. This prevents haver being attributed to a stale
combobox client.

---

### CR-03: abatimento full-return merge cancels installments already paid by abatement

**Files modified:** `src/pages/Returns.tsx`
**Commit:** `dc85119`
**Applied fix:** Before the cancellation pass, collected the set of installment ids that
`processAbatement` just moved to `'paid'` status (`abatedAndPaidIds`). The cancel map then
skips any id in that set, so abatement-paid installments stay `'paid'` rather than being
overwritten to `'cancelled'`. This preserves audit consistency between CreditPayment records
(type 'abatimento') and the installment's final status.

---

### CR-01 + CR-04: wrong restoredStatus discriminant + cancelledInstallmentIds not cleared on reversal

**Files modified:** `src/pages/Returns.tsx`
**Commit:** `87b8d08`
**Applied fix (CR-01):** The old discriminant `originalSale.crediarioPaid !== undefined` is always
true for crediário sales (field initialized to 0), causing every crediário reversal to restore
status as `'crediario_paid'`. New logic: after reversal, check whether any sale installments will
be open (either currently open/overdue, or being restored from 'cancelled' by this reversal). If
open installments exist → `'crediario_pending'`; if no open installments and sale had crediario_paid
history → `'crediario_paid'`; otherwise → `'completed'`.

**Applied fix (CR-04):** `handleReverseReturn` never cleared `Sale.cancelledInstallmentIds`, which
caused `canRefund()` in Sales.tsx to permanently block estorno on that sale (it guards on
`cancelledInstallmentIds.length > 0`). Fix: both the refunded-sale path and the partial-return path
now set `cancelledInstallmentIds: undefined` on the restored sale.

**Commit status:** fixed: requires human verification — the `restoredStatus` logic involves
installment state that depends on runtime data; please verify the computed status is correct
after a full return reversal on a crediário_pending sale.

---

### WR-04: abatimento history badge misidentifies zero-abatement entries as haver

**Files modified:** `src/pages/Returns.tsx`
**Commit:** `2f4008e`
**Applied fix:** Changed `const isAbatimento = ret.abatedInstallments && ret.abatedInstallments.length > 0`
to `const isAbatimento = ret.abatedInstallments !== undefined`. The abatimento branch in `handleReturn`
always sets `returnRecord.abatedInstallments = abResult.abatedMap` (even when map is `[]`); the haver
branch never sets this field. Field presence is therefore the reliable discriminant. Legacy haver
records (abatedInstallments: undefined) continue to render correctly.

---

## Build Result

`npm run build` — exit 0. 2966 modules transformed, no TypeScript or lint errors.
Only pre-existing chunk-size warning (>500KB) unrelated to these fixes.

---

_Fixed: 2026-06-20_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
