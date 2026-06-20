---
phase: 02-credi-rio
plan: "01"
subsystem: crediario
tags: [overdue-detection, shared-helper, type-extension, delinquency, pos]
dependency_graph:
  requires: []
  provides: [installmentStatus-helper, interestAmount-field]
  affects: [CreditNotes, POS]
tech_stack:
  added: []
  patterns: [named-const-arrow-exports, optional-additive-field, on-the-fly-derivation]
key_files:
  created:
    - src/lib/installmentStatus.ts
  modified:
    - src/types/index.ts
    - src/pages/POS.tsx
decisions:
  - "isInstallmentOverdue returns false for already-'overdue' persisted status — getEffectiveStatus handles the 'overdue' → 'overdue' pass-through; avoids double-classifying"
  - "getEffectiveStatus mirrors CreditNotes.tsx line 65 exactly (isBefore + startOfDay) so display parity is guaranteed"
  - "interestAmount placed after type? field on CreditPayment, optional, no migration needed — same retrocompat pattern as cancelledInstallmentIds in ReturnRecord"
  - "clientCreditUsed in POS left unchanged — counts open+overdue obligations correctly; only the delinquency block (clientOverdueInstallments) was wired to the helper"
metrics:
  duration: "~8 min"
  completed: "2026-06-20T14:39:02Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 2
---

# Phase 02 Plan 01: Overdue Foundation — SUMMARY

**One-liner:** Shared on-the-fly overdue helper (`isInstallmentOverdue` / `getEffectiveStatus`) replaces mount-only useEffect reliance; POS delinquency wired to it; `CreditPayment.interestAmount?` added for CRED-03 audit trail.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create shared installmentStatus helper | fa29216 | src/lib/installmentStatus.ts (new) |
| 2 | Add interestAmount audit field to CreditPayment | 0c1f4af | src/types/index.ts |
| 3 | Wire POS delinquency check to shared helper | 441c6b1 | src/pages/POS.tsx |

## What Was Built

### src/lib/installmentStatus.ts (new)
Single source of truth for overdue detection. Two named exports:
- `isInstallmentOverdue(inst, now?)` — returns `true` when `status === 'open'` AND `dueDate < startOfDay(now)`. Returns `false` for 'paid', 'cancelled', and already-'overdue'.
- `getEffectiveStatus(inst, now?)` — derives effective display status: promotes 'open'-past-due to 'overdue', passes through 'overdue', 'paid', 'cancelled' unchanged.
Uses the exact same `isBefore(new Date(inst.dueDate), startOfDay(now))` comparison as the legacy `CreditNotes.tsx` mount useEffect — display parity guaranteed.

### src/types/index.ts
`CreditPayment` interface extended with `interestAmount?: number` — optional additive field recording the interest portion included within `amount`. Existing electron-store records deserialize unchanged (no migration). Same retrocompatibility approach as `cancelledInstallmentIds` on `ReturnRecord` (FND-03 precedent).

### src/pages/POS.tsx
`clientOverdueInstallments` derivation rewired from `i.status === 'overdue'` (stale persisted value) to `isInstallmentOverdue(i)` (on-the-fly date comparison). Delinquency detection now reacts to installments that pass their due date while the app stays open — no CreditNotes mount required (CRED-02).

## Verification

- `src/lib/installmentStatus.ts` exports `isInstallmentOverdue` and `getEffectiveStatus` — confirmed
- `src/pages/POS.tsx` imports and uses `isInstallmentOverdue` — confirmed (import + usage = 2 occurrences)
- `clientOverdueInstallments` no longer references literal `'overdue'` for status comparison — confirmed
- `src/types/index.ts` CreditPayment contains `interestAmount?` — confirmed
- `npx tsc --noEmit -p tsconfig.app.json` — no new errors (pre-existing CreditNotes.tsx TS2367 warnings are out of scope)
- `npm run build` exits 0 — confirmed

## Deviations from Plan

None — plan executed exactly as written. Pre-existing TypeScript warnings in `CreditNotes.tsx` (TS2367: redundant `i.status !== 'cancelled'` after `open|overdue` union filter at lines 94, 140) were observed but are out of scope (pre-existing, unrelated to this plan's files).

## Known Stubs

None — no stubs introduced in this plan.

## Threat Flags

None — no new network/IO surface. The helper is a pure date comparison on locally-loaded data. `interestAmount` is an optional type field with no runtime evaluation. Threat register items T-02-01 and T-02-02 accepted as documented in PLAN.md.

## Self-Check: PASSED

- [x] src/lib/installmentStatus.ts exists
- [x] src/types/index.ts contains `interestAmount?`
- [x] src/pages/POS.tsx imports `isInstallmentOverdue`
- [x] Commits fa29216, 0c1f4af, 441c6b1 exist in git log
- [x] npm run build exits 0
