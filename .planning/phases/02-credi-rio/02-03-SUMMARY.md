---
phase: 02-credi-rio
plan: "03"
subsystem: crediario
tags: [interest-charging, opt-in-interest, audit-trail, payment-dialog, overdue]
dependency_graph:
  requires: [installmentStatus-helper, interestAmount-field, effective-status-display]
  provides: [explicit-interest-charge-action, interest-audit-record]
  affects: [CreditNotes]
tech_stack:
  added: []
  patterns: [opt-in-state-reset, principal-portion-separation, conditional-spread-field]
key_files:
  created: []
  modified:
    - src/pages/CreditNotes.tsx
decisions:
  - "chargedInterest state defaults 0 and is reset in openPaymentDialog and on dialog close — guarantees interest is never auto-applied (CRED-03 hard rule)"
  - "principalPortion = Math.min(paymentAmount, remaining) keeps installment.amountPaid bounded by installment.amount; interest income reflected in sale.crediarioPaid only"
  - "Over-payment guard relaxed to remaining + chargedInterest + 0.01 only when interest was explicitly charged; cap stays remaining + 0.01 otherwise (T-02-05)"
  - "CreditPayment.interestAmount populated via conditional spread so records without interest deserialize unchanged (retrocompat — same pattern as interestAmount field added in Plan 01)"
  - "sale.crediarioPaid += principalOnSale + entryPaid + chargedInterest so the sale total reflects full collected amount (principal + interest)"
  - "Interest display guard updated to use getEffectiveStatus (not raw persisted status) so freshly-lapsed installments show interest before mount effect fires"
metrics:
  duration: "~15 min"
  completed: "2026-06-20T15:30:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 1
---

# Phase 02 Plan 03: Explicit Interest Charging Action — SUMMARY

**One-liner:** Payment dialog gains an opt-in "Cobrar juros" button that pre-fills saldo + juros via `roundCurrency`; interest is recorded as `CreditPayment.interestAmount`; `principalPortion` prevents amountPaid from exceeding installment.amount.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add explicit "Cobrar juros" action to the payment dialog | d439be1 | src/pages/CreditNotes.tsx |
| 2 | Record the interest component auditably in handlePayment | d439be1 | src/pages/CreditNotes.tsx |

## What Was Built

### Task 1 — Explicit "Cobrar juros" action (CRED-03)

Added `chargedInterest: number` state (default `0`) to track operator opt-in interest.

Three resets of `chargedInterest` to `0`:
1. `openPaymentDialog` — guarantees every dialog open starts without interest (CRED-03 hard rule).
2. `onOpenChange` handler of the Payment Dialog — covers the Cancel/close path.
3. After `setSales` in `handlePayment` — clears after a successful payment.

Interest display guard updated from `selectedInstallment.status === 'overdue'` to `getEffectiveStatus(selectedInstallment) === 'overdue'` so freshly-lapsed installments (not yet persisted as overdue) also show the interest row.

New "Cobrar juros" panel rendered when `getEffectiveStatus === 'overdue'` and `calculateInterest > 0`:
- Shows calculated interest amount with `formatCurrency`.
- Button labeled "Cobrar juros" sets `paymentAmount = roundCurrency(remaining + interest)` and `chargedInterest = interest`.
- Button toggles visual state (filled red) when interest has been opted into.
- When `chargedInterest > 0`, a hint below the payment amount input reads "Inclui {amount} de juros (saldo + juros)".

`openPaymentDialog` continues to set `paymentAmount = remaining` (not + interest). Interest is opt-in only.

### Task 2 — Auditable interest record in handlePayment (CRED-03 + T-02-05/06)

Over-payment guard updated: cap = `remaining + chargedInterest + 0.01`. When `chargedInterest === 0` the cap equals the old `remaining + 0.01` — no behavior change for non-interest payments.

Principal / interest split:
```typescript
const principalPortion = Math.min(paymentAmount, remaining);
const newAmountPaid = selectedInstallment.amountPaid + principalPortion;
```
`isFullyPaid` uses `newAmountPaid >= effectiveAmount - 0.01` — correctly marks paid when principal is covered even if operator also paid interest.

`installment.amountPaid` grows only by `principalPortion` — never exceeds `installment.amount` (interest not capitalized, deferred per CONTEXT "Juros compostos fora de escopo").

`CreditPayment` construction:
```typescript
...(chargedInterest > 0 ? { interestAmount: chargedInterest } : {})
```
Records zero-footprint on non-interest payments; provides audit trail when interest is charged (T-02-06).

`sale.crediarioPaid` receives the full collected amount:
```typescript
crediarioPaid: totalPrincipalOnSale + entryPaid + chargedInterest
```

Toast appends "incl. {amount} de juros" when `chargedInterest > 0` (captured before state reset).

## Verification

- `grep -c "Cobrar juros" src/pages/CreditNotes.tsx` → 3 (button text + hint text occurrences)
- `grep -c "interestAmount" src/pages/CreditNotes.tsx` → 1 (CreditPayment construction)
- `grep -c "chargedInterest" src/pages/CreditNotes.tsx` → 14 (state, resets, guard, button handler, crediarioPaid, toast)
- `calculateInterest` guards on `getEffectiveStatus(inst) !== 'overdue'` at line 94 — confirmed
- `openPaymentDialog` sets `paymentAmount = remaining` (no interest added) — confirmed
- `openPaymentDialog` calls `setChargedInterest(0)` — confirmed
- Over-payment cap = `remaining + chargedInterest + 0.01` — confirmed
- `principalPortion = Math.min(paymentAmount, remaining)` at line 215 — confirmed
- `installment.amount` not mutated anywhere in the handler — confirmed
- `npm run build` exits 0 — confirmed

## Deviations from Plan

**1. Tasks 1 and 2 committed in a single commit**
- Both tasks edit the same file; Task 2 uses `chargedInterest` state introduced in Task 1. Applied all edits in a single pass before committing. Both tasks are fully implemented and documented separately above.

**2. [Rule 2 - Missing critical feature] Interest display guard updated to use getEffectiveStatus**
- **Found during:** Task 1 — the existing interest display at the bottom of the payment dialog summary (lines 1053-1061 pre-edit) checked `selectedInstallment.status === 'overdue'` (raw persisted value), inconsistent with Plan 02's decision to use effective status everywhere.
- **Fix:** Changed guard to `getEffectiveStatus(selectedInstallment) === 'overdue'` for both the existing display and the new "Cobrar juros" panel. This is consistent with `calculateInterest` which already uses `getEffectiveStatus`.
- **Files modified:** src/pages/CreditNotes.tsx
- **Commit:** d439be1

## Known Stubs

None — all values are derived from real installment data and operator input. `chargedInterest` starts at 0 and is only set by explicit operator action.

## Threat Flags

None — no new network/IO surface. Changes are confined to local state management and electron-store writes already present. Threat register items T-02-05, T-02-06, T-02-07 fully mitigated as documented in PLAN.md.

## Self-Check: PASSED

- [x] src/pages/CreditNotes.tsx modified with "Cobrar juros" button, chargedInterest state, interestAmount on CreditPayment, principalPortion logic
- [x] Commit d439be1 exists in git log
- [x] npm run build exits 0
- [x] Interest is opt-in only (openPaymentDialog never pre-applies it)
- [x] installment.amount not mutated (interest not capitalized)
- [x] amountPaid uses principalPortion = Math.min(paymentAmount, remaining)
