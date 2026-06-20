---
phase: 04-devolucao-completa
plan: "03"
subsystem: ui
tags: [devolucao, POS, processReturn, haver-capping, crediario, DEV-01, DEV-02, DEV-03, DEV-04, ReturnRecord, ClientCombobox, shadcn-dialog]

dependency_graph:
  requires:
    - phase: 04-01
      provides: processReturn with haver capping + cancelledInstallmentIds
  provides:
    - POS return entry point (Devolução button + Dialog)
    - No-client sale stock-only return (DEV-02)
    - Inline client registration/association during return (DEV-03)
    - Capped haver via processReturn in POS (DEV-04)
  affects: [src/pages/POS.tsx, returns localStorage key]

tech_stack:
  added: []
  patterns:
    - "Dialog (shadcn) used as return flow container inside POS — no page navigation required"
    - "processReturn consumed in POS for all financial mutation — creditGenerated never computed raw in UI (T-04-07)"
    - "getReturnedQuantities helper mirrors Returns.tsx pattern (T-04-08 double-return prevention)"
    - "Inline client creation uses Clients.tsx handleSave shape: crypto.randomUUID + now timestamps"
    - "cancelledInstallmentIds from processReturn applied via setInstallments (W-7 installments setter already present)"

key_files:
  created: []
  modified:
    - src/pages/POS.tsx

key_decisions:
  - "Tasks 1 and 2 implemented in a single commit — Dialog + checklist + confirm handler all required for build to pass cleanly together"
  - "POS return modal offers haver modality only; abatimento intentionally absent (lives on /returns per CONTEXT D-01 decision)"
  - "Devolução button placed in a new col-span-1 column in the top bar (grid changed from 1+3 to 1+1+2)"
  - "returnSaleSearch min 2 chars before showing results (lower friction than Returns.tsx's 3 chars)"
  - "No-client return shows amber note in dialog and shows 'Cadastrar novo cliente' affordance (DEV-02/03 combined UX)"

requirements-completed: [DEV-01, DEV-02, DEV-03, DEV-04]

duration: "~8 min"
completed: "2026-06-20"
---

# Phase 04 Plan 03: Devolução Completa — POS Return Entry Point Summary

**Devolução dialog inside POS: sale search, item checklist, inline client register/associate, capped haver via processReturn (DEV-01/02/03/04)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-20T00:00:00Z
- **Completed:** 2026-06-20T00:08:00Z
- **Tasks:** 2 (implemented together, single commit)
- **Files modified:** 1

## Accomplishments

- Operator can start and complete a return entirely from the POS screen (DEV-01)
- Returns on sales with no client restore stock only; operator can optionally register/associate a client inline during the return (DEV-02/DEV-03)
- Haver generated via `processReturn` capping — creditGenerated never computed from raw item totals in the UI (DEV-04, T-04-07)
- Full crediário return from POS cancels open/overdue installments via `setInstallments` (BUG-2 consistency, W-7)
- Double-return prevention via `getReturnedQuantities` + `alreadyReturnedQtys` input to processReturn (T-04-08)

## Task Commits

Tasks 1 and 2 implemented in a single edit pass and committed together (both target the same file; the Dialog content requires the confirm handler to be present for TypeScript to accept the `onClick` references):

1. **Task 1: Return-mode state, returns storage, sale-finding UI** — co-committed in `99f01b0` (feat)
2. **Task 2: Item checklist, client association/inline registration, confirm via processReturn** — co-committed in `99f01b0` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified

- `src/pages/POS.tsx` — Added: `ReturnRecord` + `processReturn` imports, `Dialog` + `Checkbox` imports, `RotateCcw` icon, `returns/setReturns` localStorage slice, 8 return-mode state vars, `getReturnedQuantities` helper, `returnEligibleSales`/`returnSearchedSales` computed, `handleReturnSelectSale`, `resetReturnDialog`, `handleReturnRegisterClient` (DEV-03 inline creation), `handleConfirmReturn` (DEV-01/02/03/04 core), Devolução trigger button in top bar, full return Dialog (search + checklist + client section + confirm)

## Decisions Made

- Tasks 1 and 2 implemented in a single commit — both target `src/pages/POS.tsx` and the Dialog JSX requires the handler to exist for build to pass. Mirrors 04-01 pattern (Tasks 1+2 co-committed with shared build dependency).
- POS return modal offers **haver modality only** — abatimento intentionally absent (lives on `/returns` per CONTEXT locked decision D-01; no `processAbatement` calls).
- Devolução button styled amber (`border-amber-300`) to visually distinguish it from the normal sale flow without adding a new design token.
- `returnSaleSearch` min 2 chars before showing results (lower friction than Returns.tsx's 3 chars for short sale codes).

## Deviations from Plan

None — plan executed exactly as written. Both tasks were implemented in a single commit because the Dialog UI references the confirm handler, making a two-commit split compile-unstable; this mirrors the 04-01 precedent.

## Known Stubs

None. All logic is wired: `processReturn` receives `installments` for capping, `getReturnedQuantities` feeds `alreadyReturnedQtys`, `setReturns`/`setProducts`/`setClients`/`setInstallments`/`setSales` all called in the confirm handler.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's `<threat_model>`:

- T-04-07 (Tampering — haver from POS return): **mitigated** — `creditGenerated` read from `returnRecord.creditGenerated` (processReturn output), never computed from raw item totals in POS.
- T-04-08 (Tampering — double return): **mitigated** — `getReturnedQuantities` passed as `alreadyReturnedQtys` to `processReturn`; qty inputs clamped to `maxReturnable`.
- T-04-09 (inline client creation): **accepted per plan** — minimal-field creation mirrors Clients.tsx handleSave (name required, document validation best-effort).
- T-04-SC (npm installs): **mitigated** — no new packages installed.

## Self-Check: PASSED

- `src/pages/POS.tsx`: EXISTS (modified — 1109 lines)
- Commit `99f01b0`: EXISTS (verified via git log)
- `npm run build`: PASSED (0 errors, built in 10.92s)
- All Task 1 acceptance criteria: PASS
- All Task 2 acceptance criteria: PASS
- `grep -c "processAbatement" src/pages/POS.tsx` = 0 (abatimento intentionally absent)
