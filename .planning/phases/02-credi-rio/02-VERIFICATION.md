---
phase: 02-credi-rio
verified: 2026-06-20T00:00:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
---

# Phase 2: Crediário Verification Report

**Phase Goal:** O operador enxerga o estado real do crediário de cada cliente — saldo, situação das parcelas e juros — e consegue cobrar juros de forma explícita.
**Verified:** 2026-06-20
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | An installment whose dueDate passed is reported as overdue at render time without any persisted write | ✓ VERIFIED | `effectiveInstallments` useMemo (line 86) maps every installment through `getEffectiveStatus(inst)` before any display/aggregation path reads it |
| 2  | POS delinquency check uses the same overdue logic as CreditNotes (single source of truth) | ✓ VERIFIED | POS.tsx line 14 imports `isInstallmentOverdue`; line 139 uses it: `installments.filter(i => i.clientId === selectedClient && isInstallmentOverdue(i))` — no raw `status === 'overdue'` string comparison remains for delinquency |
| 3  | CreditPayment can carry an auditable interest component without breaking existing stored records | ✓ VERIFIED | `CreditPayment.interestAmount?: number` added as optional field (src/types/index.ts line 81); older records without it deserialize unchanged |
| 4  | The Crediário screen shows, per client and per sale, total devido, total pago, saldo em aberto, and a status count of each installment | ✓ VERIFIED | Lines 502–524: per-client totalDevido/totalPago/saldo computed with roundCurrency and rendered. Lines 597–634: per-sale breakdown with devido/pago/saldo/status counts (open/overdue/paid/cancelled) per saleId |
| 5  | Cancelled installments are excluded from devido and saldo | ✓ VERIFIED | Line 499: `nonCancelled = allClientInst.filter(i => i.status !== 'cancelled')` — all money sums operate on this filtered array. Per-sale also uses `saleNonCancelled` (line 599) |
| 6  | An installment that became overdue while the app stayed open displays as Vencida without reloading the page | ✓ VERIFIED | All display paths (`filteredInstallments`, `overdueInstallments`, `resumoOverdue`, status counts) derive from `effectiveInstallments` useMemo which re-evaluates on every render via `getEffectiveStatus` |
| 7  | roundCurrency is used on all client/sale money sums | ✓ VERIFIED | Lines 502–504: `roundCurrency(...)` wraps totalDevido, totalPago, saldo. Lines 600–602: same for per-sale. Build passes confirming correct import |
| 8  | Payment dialog shows interest and explicit "Cobrar juros" button; interest never auto-applied | ✓ VERIFIED | Lines 1083–1117: "Cobrar juros" button visible for effectively-overdue installments with interest > 0. `openPaymentDialog` (line 185) sets `paymentAmount = remaining` without adding interest; `chargedInterest` reset to 0 (line 188) |
| 9  | Interest charged: installment.amountPaid increases by principal only; sale.crediarioPaid includes interest; CreditPayment.interestAmount records the charge; installment.amount not capitalized | ✓ VERIFIED | Line 215: `principalPortion = Math.min(paymentAmount, remaining)`. Line 216: `newAmountPaid = selectedInstallment.amountPaid + principalPortion`. Line 228: `interestAmount: chargedInterest` conditionally spread on CreditPayment. Line 267: `crediarioPaid = totalPrincipalOnSale + entryPaid + chargedInterest`. Installment `amount` field never written in handlePayment |
| 10 | `npm run build` exits 0 | ✓ VERIFIED | Build output: `✓ built in 11.15s` with no type errors or compilation failures |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/installmentStatus.ts` | Shared on-the-fly overdue computation; exports `isInstallmentOverdue` and `getEffectiveStatus` | ✓ VERIFIED | 33 lines; both exports confirmed; uses `isBefore`/`startOfDay` matching CreditNotes.tsx existing comparison; no default export |
| `src/types/index.ts` | Optional `interestAmount` field on CreditPayment | ✓ VERIFIED | Line 81: `interestAmount?: number` present with auditable comment |
| `src/pages/CreditNotes.tsx` | Per-client/per-sale summary using on-the-fly overdue via shared helper; `interestAmount` written on payment | ✓ VERIFIED | Imports `getEffectiveStatus` and `isInstallmentOverdue` (line 36); `effectiveInstallments` useMemo drives all display; "Cobrar juros" button exists; `interestAmount` conditionally set on CreditPayment |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/POS.tsx` | `src/lib/installmentStatus.ts` | `import { isInstallmentOverdue }` | ✓ WIRED | Line 14 import confirmed; line 139 usage confirmed (`clientOverdueInstallments` filter); no raw `status === 'overdue'` string for delinquency check |
| `src/pages/CreditNotes.tsx` | `src/lib/installmentStatus.ts` | `import { getEffectiveStatus, isInstallmentOverdue }` | ✓ WIRED | Line 36 import confirmed; `getEffectiveStatus` used in useMemo (line 87), `calculateInterest` (line 94), and payment dialog guard (line 1072, 1086) |
| `handlePayment` | `CreditPayment.interestAmount` | Payment record construction with conditional spread | ✓ WIRED | Line 228: `...(chargedInterest > 0 ? { interestAmount: chargedInterest } : {})` confirmed present |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CreditNotes.tsx` (Resumo tab) | `totalDevido`, `totalPago`, `saldo` | `effectiveInstallments` derived from `installments` (localStorage) | Yes — mapped from stored Installment records | ✓ FLOWING |
| `CreditNotes.tsx` (payment dialog) | `chargedInterest` | Operator action sets via `setChargedInterest(interest)` on button click | Yes — `calculateInterest` computes from real installment data | ✓ FLOWING |
| `POS.tsx` | `clientOverdueInstallments` | `installments` filtered by `isInstallmentOverdue(i)` (localStorage) | Yes — real-time computation on stored records | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `npm run build` exits 0 | `npm run build` | `✓ built in 11.15s`, exit 0 | ✓ PASS |
| `isInstallmentOverdue` and `getEffectiveStatus` both exported from helper | File exists with both named exports, min 20 lines | 33 lines, both exports confirmed | ✓ PASS |
| POS uses helper (not raw string) for delinquency | `grep "isInstallmentOverdue" src/pages/POS.tsx` | 2 matches (import + usage on line 139) | ✓ PASS |
| "Cobrar juros" button in payment dialog | `grep "Cobrar juros" src/pages/CreditNotes.tsx` | 1 match at line 1114 | ✓ PASS |
| `interestAmount` on CreditPayment type and written in handlePayment | grep in types + CreditNotes | types line 81 + handler line 228 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CRED-01 | 02-02-PLAN.md | Per-client/per-sale total devido, pago, saldo e situação das parcelas | ✓ SATISFIED | CreditNotes.tsx lines 494–640: per-client card with devido/pago/saldo; per-sale breakdown with status counts; cancelled excluded |
| CRED-02 | 02-01-PLAN.md, 02-02-PLAN.md | Parcelas vencidas identificadas corretamente sempre | ✓ SATISFIED | `effectiveInstallments` useMemo re-evaluates on-the-fly; POS also wired to `isInstallmentOverdue`; no stale persisted-status dependency for display |
| CRED-03 | 02-01-PLAN.md, 02-03-PLAN.md | Operador visualiza juros e cobra explicitamente; auditável em CreditPayment | ✓ SATISFIED | "Cobrar juros" button (line 1114), `interestAmount` field on type and written conditionally in `handlePayment`; `openPaymentDialog` never pre-applies interest |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TBD/FIXME/XXX/placeholder markers found in any phase-modified file | — | — |

Notable observation: `installments.filter(...)` on line 139 of CreditNotes uses raw `installments` for the CSV export. This is not a stub — it intentionally exports the persisted data, not the derived display state, which is appropriate for a raw data export.

### Human Verification Required

#### 1. Interest dialog interaction flow

**Test:** Open Crediário, find an installment with a past `dueDate`, open the payment dialog. Verify the interest amount is shown and the payment field starts at `saldo` (without interest). Click "Cobrar juros". Verify the payment amount jumps to `roundCurrency(saldo + juros)` and a hint appears confirming interest inclusion.
**Expected:** Interest is opt-in only; the button pre-fills the correct total; hint text shows "Inclui R$ X,XX de juros (saldo + juros)".
**Why human:** Dialog interaction sequence and visual state transitions cannot be verified programmatically.

#### 2. On-the-fly overdue detection across screens

**Test:** With the app open, manually set an installment's `dueDate` to yesterday in dev tools. Without navigating away or reloading, switch to the Crediário "Parcelas" tab.
**Expected:** The installment appears as "Vencida" (red badge) and is counted in the Resumo "Vencidas" column without any page reload.
**Why human:** Requires live runtime observation; cannot simulate time passage programmatically in a grep-based verification.

### Gaps Summary

No gaps found. All 10 observable truths are verified in the codebase with substantive implementations wired to real data sources. The build passes cleanly. No debt markers are present in any phase-modified file.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
