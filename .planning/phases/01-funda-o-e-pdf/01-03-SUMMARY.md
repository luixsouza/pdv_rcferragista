---
phase: 01-funda-o-e-pdf
plan: "03"
subsystem: return-processing
tags: [pure-function, refactor, behavioral-parity, devolucao, processReturn]
dependency_graph:
  requires: ["01-01"]
  provides: ["FND-02"]
  affects: ["src/pages/Sales.tsx", "src/pages/Returns.tsx"]
tech_stack:
  added: []
  patterns: ["pure-function-extraction", "mutation-return-pattern"]
key_files:
  created:
    - src/lib/processReturn.ts
  modified:
    - src/pages/Sales.tsx
    - src/pages/Returns.tsx
decisions:
  - "alreadyReturnedQtys passed as input parameter so processReturn is pure (no storage reads)"
  - "returnTotal kept as computed value in both pages for JSX rendering; toast uses it for display"
  - "selectedClient empty string converted to undefined before passing clientId to processReturn"
  - "roundCurrency applied per item total in processReturn (centavo correctness from 01-01)"
metrics:
  duration: "~8 min"
  completed: "2026-06-20"
  tasks_completed: 2
  files_changed: 3
---

# Phase 01 Plan 03: processReturn Extraction Summary

**One-liner:** Pure `processReturn.ts` unifies duplicated devolução mutation logic from Sales.tsx and Returns.tsx with full behavioral parity.

## What Was Built

Created `src/lib/processReturn.ts` — a pure TypeScript function with no React hooks, no storage writes, and no side effects. Both `handleReturnFromSale` (Sales.tsx) and `handleReturn` (Returns.tsx) now delegate the shared mutation logic to this single module.

### processReturn signature

```typescript
function processReturn(input: ProcessReturnInput): ProcessReturnResult
```

**Input:** `{ sale, itemsToReturn, products, clients, clientId, clientName, alreadyReturnedQtys }`
**Output:** `{ returnRecord, updatedProducts, updatedClients, allItemsReturned }`

### Behavioral invariants preserved

| Rule | Before | After |
|------|--------|-------|
| creditGenerated | `hasClient ? returnTotal : 0` | identical |
| Stock restock | `unit === 'mil' ? qty/1000 : qty` | identical |
| allItemsReturned | merge prior + current qtys vs sale items | identical |
| Toast messages | identical strings | identical |
| Pre-call validation | Returns.tsx validates max-returnable | preserved in page, not moved to lib |

### What was NOT changed (Phase 3/4)

- No haver-capping for crediário sales (BUG-1 deferred)
- No installment cancellation on full return (BUG-2 deferred)
- `cancelledInstallmentIds` field intentionally left unset

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create pure processReturn module | e29c4c4 |
| 2 | Refactor Sales.tsx and Returns.tsx | 9a70584 |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The function passes through all mutations to callers via returned values; no placeholder data.

## Threat Flags

None. No new network endpoints, auth paths, file access, or schema changes introduced. The trust boundary (operator return selection → financial mutations) is unchanged in structure; the code path now goes through one shared module instead of two independent implementations (T-01-RET-01 mitigated).

## Self-Check: PASSED

- `src/lib/processReturn.ts` exists and exports `processReturn` (pure function)
- `src/pages/Sales.tsx` imports and calls `processReturn` at commit 9a70584
- `src/pages/Returns.tsx` imports and calls `processReturn` at commit 9a70584
- `npm run build` exits 0 (2964 modules, verified after both tasks)
- No cancelledInstallmentIds, no installment cancellation, no haver-capping
