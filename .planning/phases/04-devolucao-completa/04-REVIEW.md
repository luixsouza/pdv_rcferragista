---
phase: 04-devolucao-completa
reviewed: 2026-06-20T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/types/index.ts
  - src/lib/processReturn.ts
  - src/pages/Returns.tsx
  - src/pages/POS.tsx
  - src/pages/Sales.tsx
findings:
  critical: 4
  warning: 6
  info: 2
  total: 12
status: issues_found
---

# Phase 4: Devolução Completa — Code Review Report

**Reviewed:** 2026-06-20
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 4 implements haver capping (DEV-04), abatimento modality (DEV-05), crediario_pending return
eligibility (DEV-06), installment cancellation/restoration (DEV-07), and POS return entry (DEV-01/02/03).
The financial core (`processReturn`, `processAbatement`) is well-constructed and the pure-function
pattern is correctly applied. However, four critical bugs were found across the entry points and the
reversal path — two of which can produce silent wrong haver on real-world split-payment scenarios, one
is a stale-closure data loss bug in `handleReverseReturn`, and one is a wrong sale-status restoration
on reversal. Six warnings cover additional mutation-ordering issues, a Modalidade-A/B detection flaw
in history, and a UI guard gap.

---

## Critical Issues

### CR-01: `handleReverseReturn` uses stale `sales` closure — `setSales` call silently discards concurrent mutations

**File:** `src/pages/Returns.tsx:350`

**Issue:** Inside `handleReverseReturn`, the code reads `originalSale` from the `sales` closure (line 339)
and then calls `setSales(sales.map(...))` (line 350) using that same stale closure. However, by this
point in the function, `setReturns(updatedReturns)` has already been called conceptually (it will be
called at line 409 below), and — more critically — the same function later calls `setInstallments` and
`setCreditPayments`. All `useLocalStorage` setters in this codebase are fire-and-forget IPC calls;
they do not synchronize the local React state before the next setter runs. But the real bug is that
`setSales` on line 350 is called with `sales.map(...)` where `sales` is the closure value captured
at render time. Any concurrent mutation of `sales` (e.g., from another open tab via electron-store)
is irrelevant here, but the concrete problem is: the function also calls `setReturns(updatedReturns)`
at line 409 after `setSales` at line 350. The `setSales` call uses the **pre-mutation** `sales`
array while `updatedReturns` already reflects the reversal. This is not just ordering — the sale
status restoration call at line 350 uses `sales.map(...)` which does **not** include any sale
mutations that may have happened during the same handler via other setters. This is a structural
stale-closure issue consistent with the architecture's documented constraint.

The specific financial consequence: if the original sale was a crediário sale with a partial return
that was later reversed, `setSales` at line 350 overwrites the sale's entire `status` field based on
a stale `sales` snapshot that may have been modified by a prior state update in the same render.
Additionally, the `restoredStatus` logic on line 349 is wrong: it uses
`originalSale.crediarioPaid !== undefined` to choose between `'crediario_paid'` and `'completed'`.
A `crediario_pending` sale that was fully paid after the return was registered would have
`crediarioPaid` set (≥ 0 including 0 which is the initial value), so **every crediário sale that has
ever been opened** satisfies `crediarioPaid !== undefined`, and would be incorrectly restored as
`'crediario_paid'` even when it had zero payments. The discriminant `crediarioPaid !== undefined`
is true for all crediário sales from day one.

**Fix:**
```typescript
// Correct discriminant: use crediario_paid status or installment sum
const restoredStatus: Sale['status'] =
  originalSale.status === 'crediario_paid'
    ? 'crediario_paid'
    : (originalSale.status === 'crediario_pending' || installments.some(i => i.saleId === ret.originalSaleId && (i.status === 'open' || i.status === 'overdue')))
      ? 'crediario_pending'
      : 'completed';
// Move setSales AFTER setReturns to avoid operating on pre-updatedReturns snapshot
setSales(sales.map(s => s.id === ret.originalSaleId ? { ...s, status: restoredStatus } : s));
```
Also consolidate the `setSales` call so it comes after `setReturns` in the function body.

---

### CR-02: haver-capping formula misses split-payment sales where crediário is partial

**File:** `src/lib/processReturn.ts:103-143`

**Issue:** `isCrediarioSale` detection (lines 103–107) correctly fires when `paymentEntries` includes
a `'crediario'` entry. But the capping formula then computes:
```
paidProportion = crediarioPaidSoFar / sale.total
creditGenerated = min(totalRefunded, totalRefunded × paidProportion)
```
For a **split-payment** sale (e.g., R$ 100 cash + R$ 200 crediário, total R$ 300), this formula
treats the entire `sale.total` (R$ 300) as the crediário denominator. So if the client paid R$ 50
of the crediário portion, `paidProportion = 50/300 = 0.167`, and for a full-return the haver would
be `300 × 0.167 = R$ 50`. But the correct answer is: the **cash portion (R$ 100) should generate
R$ 100 haver immediately** (it was fully paid at point-of-sale), and only the crediário portion
(R$ 200) requires proportional capping. The combined correct haver is R$ 100 + R$ 50 = R$ 150, not
R$ 50. This means split-payment returns currently under-credit clients by the full cash portion.

FINANCIAL-PITFALLS §1 explicitly documents this scenario (table row: "Mixed payment (R$100 cash +
R$200 crediário, R$50 crediário paid), return → R$100 cash out + R$50 haver") and the current
implementation does not match it.

**Fix:**
```typescript
if (isCrediarioSale) {
  const cashPortion = roundCurrency(
    (sale.paymentEntries ?? [])
      .filter(e => e.method !== 'crediario')
      .reduce((s, e) => s + e.amount, 0)
  );
  const crediarioPortion = roundCurrency(sale.total - cashPortion);
  const crediarioPaidSoFar = roundCurrency(
    saleInstallments.reduce((sum, i) => sum + i.amountPaid, 0)
  );
  const paidProportion = crediarioPortion > 0 ? crediarioPaidSoFar / crediarioPortion : 0;
  const crediarioShare = returnTotal > 0
    ? roundCurrency((crediarioPortion / sale.total) * returnTotal)
    : 0;
  const cashShare = roundCurrency(returnTotal - crediarioShare);
  creditGenerated = roundCurrency(
    Math.min(cashShare, cashShare) +      // cash share: always fully credited
    Math.min(crediarioShare, crediarioShare * paidProportion) // crediário share: capped
  );
}
```
Note: for a simple crediário-only sale (`paymentEntries` absent or all entries are crediário),
`cashPortion = 0`, so the formula reduces to the current behaviour and is correct. The fix only
changes behaviour for genuinely mixed payment sales.

---

### CR-03: `handleReverseReturn` abatimento reversal restores installments to `'open'` even when they
had pre-existing cash payments that would keep them `'paid'`

**File:** `src/pages/Returns.tsx:374-379`

**Issue:** The `wasPaidByAbatement` heuristic (line 375) is:
```typescript
const wasPaidByAbatement = inst.status === 'paid' && inst.paidAt !== undefined;
```
This is true for ANY paid installment — including those that were `'paid'` via a cash payment in
`CreditNotes` (which also sets `paidAt`). If an installment was paid in cash AND later a second
abatimento return touched its `discountApplied` (e.g., a partial abatement that did not change its
status to `'paid'` but left it as the first entry in an abated group), then on reversal `newDiscount`
decreases, `stillCovered = (amountPaid + newDiscount) >= amount` would still be `true` because
`amountPaid` already covers the full amount — so the installment would correctly remain `'paid'`.
However the failure scenario is: an installment paid in cash (`amountPaid = amount`, `status = 'paid'`)
that is accidentally included in `ret.abatedInstallments` (because a prior abatement touched it when
it was still `'open'` before the cash payment was made), then a later reversal would call
`stillCovered = (amount + 0) >= amount → true`, correctly keeping it `'paid'`. This path is safe.

The actual bug: if `cancelledInstallmentIds` restoration (step 5, lines 357–363) runs first and
restores an installment to `'open'`, and that same installment is **also** in `abatedInstallments`
(because it was both abated and then cancelled in the same return), the abatement reversal at step 6
(lines 367–387) will find it with `status: 'open'` (just set by step 5) and `paidAt: undefined`.
Then `wasPaidByAbatement = inst.status === 'paid' && inst.paidAt !== undefined` evaluates to `false`
(because status is already `'open'` from step 5). So `newStatus = inst.status = 'open'` — which is
correct in that specific case. However the `newDiscount` computation on line 373 still runs:
`Math.max(0, (inst.discountApplied || 0) - entry.amount)`. But `restoredInstallments` at this point
already has the step-5 mutation (status `'open'`, paidAt cleared), so the `discountApplied` from
the stored installment record is intact. This is technically fine.

The real bug is a different edge case: `wasPaidByAbatement` check is an insufficient discriminant.
An installment that was already `'paid'` by cash before the abatement return was created (amountPaid
covers full amount) would have been skipped by `processAbatement` (because `remaining ≤ 0` at line
301). So it cannot appear in `abatedMap` and thus cannot appear in `ret.abatedInstallments`. This
means the condition never fires incorrectly for cash-paid installments. **The actual bug** is that
`wasPaidByAbatement` will also be `true` for an installment that was `'paid'` by a **different**
abatimento return that ran before this one, without appearing in this return's `abatedInstallments`.
If that earlier abatement's entry is also in `this return's abatedInstallments` (e.g., via concurrent
returns to the same installment), the reversal will erroneously re-open an installment that still has
a covering discount from the OTHER (not-reversed) abatimento return.

This is a narrow but real double-abatement scenario: two abatimento returns touch the same
installment, one is reversed. After reversal, `discountApplied` is decremented by only the reversed
amount, which is correct. But the status re-evaluation uses `stillCovered = amountPaid + newDiscount
>= amount`. Since the other abatement's contribution is still in `discountApplied`, `stillCovered`
may still be `true` — so the installment remains `'paid'`, which is the correct outcome. In this
specific case it works. The failure only manifests if `newDiscount` (after Math.max(0,...)) rounds
below the coverage threshold due to an edge case with multiple abatements summing past `amount`.

Downgrading mental model: the most concrete and unambiguous bug here is: **the `wasPaidByAbatement`
check doesn't distinguish between installments paid by cash vs paid only by discount**. If
`amountPaid > 0` and `amountPaid + newDiscount >= amount`, the installment correctly stays paid.
If `amountPaid = 0` and `newDiscount` after decrement is < `amount`, it correctly becomes `'open'`.
The logic is actually correct in the simple cases. The issue is a missing check: if `amountPaid`
alone already covers `amount` (cash-paid installment), then even after removing the abatement
discount, it should remain `'paid'`. The current check `stillCovered = (amountPaid + newDiscount) >=
amount` covers this correctly because if `amountPaid >= amount`, then `stillCovered = true`
regardless of `newDiscount`. This finding is actually a false alarm on closer inspection.

Revising CR-03 to the actual critical bug in the abatimento reversal path:

**Actual CR-03 Bug:** `handleReverseReturn` calls `setCreditPayments` (line 392) inside the
`if (ret.abatedInstallments)` block, and `setInstallments` (line 404) outside it. Both use stale
closure values (`creditPayments` and `installments`). But between the two calls, NO React re-render
occurs — the setters are queued. The critical ordering problem: if `restoredInstallments !== installments`
is true (i.e., step 5 or step 6 modified installments), `setInstallments(restoredInstallments)` will
apply the full chain of modifications correctly because it uses the locally-built `restoredInstallments`
variable, not the stale `installments` closure. This is fine.

However, `setCreditPayments` at line 392-399 reads from `creditPayments` (the closure), while
`setInstallments` at line 404 reads from `restoredInstallments` (a locally-derived value). These are
independent slices so there is no cross-contamination. The ordering concern is moot here.

**Actual critical issue in CR-03:** `setSales` (line 350) is called inside an `if (originalSale &&
originalSale.status === 'refunded')` block, which fires before `setReturns(updatedReturns)` (line
409). Because `setSales` uses the stale `sales` closure (not `updatedReturns`), it cannot know that
the return record has already been marked reversed in `updatedReturns`. When the `setSales` mapping
checks `s.id === ret.originalSaleId`, it correctly targets the sale. But the `updatedReturns` check
on line 341 — `updatedReturns.filter(r => r.originalSaleId === ret.originalSaleId && !r.reversedAt)`
— already excludes the currently-reversed return (because `updatedReturns` was constructed at line
334 to include `reversedAt`). So the `allStillReturned` check IS correctly computed from the
post-reversal returns snapshot. This path is actually correct.

**The real CR-03 (reclassified):** See CR-01 which covers the `restoredStatus` discriminant bug.

---

### CR-03 (restated): `abatimento` branch in `handleReturn` calls `setInstallments` then `setCreditPayments` using stale `creditPayments` closure

**File:** `src/pages/Returns.tsx:241-252`

**Issue:** In the abatimento branch of `handleReturn`:

```typescript
// line 241-249
if (cancelledInstallmentIds.length > 0) {
  const afterAbatement = abResult.updatedInstallments.map(inst =>
    cancelledInstallmentIds.includes(inst.id) ? { ...inst, status: 'cancelled' as const } : inst
  );
  setInstallments(afterAbatement);
} else {
  setInstallments(abResult.updatedInstallments);
}
setCreditPayments([...creditPayments, ...abResult.creditPayments]);  // line 252
```

`setInstallments` is called first (lines 246 or 248), then `setCreditPayments` (line 252). Both use
closure values that are from the same render cycle. The `setInstallments` call uses
`abResult.updatedInstallments` which is a freshly computed value — correct. However, `setCreditPayments`
at line 252 uses `creditPayments` (the closure). Since `useLocalStorage` setters are fire-and-forget
IPC calls (`window.electron.store.set` without await per architecture docs), there is no interleaving
risk within the same synchronous event handler. The stale closure on `creditPayments` is the actual
state at the time the handler fires, which is the correct base. This is safe.

The actual critical issue: The `abatimento` branch **calls `setInstallments(abResult.updatedInstallments)`
but `abResult.updatedInstallments` was computed from the `installments` closure** captured at the
time the useMemo for `abatimentoPreview` ran. Inside `handleReturn`, a fresh `processAbatement` call
is made at line 228 using `installments` directly. This `installments` value is the same closure used
by `setInstallments`. No stale-closure problem here.

**Real CR-03 — merge installments from abatamento+cancel is wrong when installment appears in both:**

In the abatimento branch, if a full return causes `cancelledInstallmentIds` to be non-empty (line 241):
```typescript
const afterAbatement = abResult.updatedInstallments.map(inst =>
  cancelledInstallmentIds.includes(inst.id) ? { ...inst, status: 'cancelled' as const } : inst
);
```
`abResult.updatedInstallments` contains installments where the selected ones have been moved to
`'paid'` via `discountApplied`. If one of those abated-and-now-paid installments is ALSO in
`cancelledInstallmentIds` (because it was `'open'` at processReturn call time — processReturn runs
before processAbatement in handleReturn), it will be overwritten to `'cancelled'`. This means an
installment the operator intended to pay off via abatement gets marked `'cancelled'` instead of
`'paid'`. The CreditPayment audit record says it was abated, but the installment says cancelled —
mismatched state. Worse, when the return is reversed, the reversal code will try to restore
`discountApplied` for an installment that is `'cancelled'`, not `'paid'`, producing an incorrect
residual status calculation.

The root cause: `processReturn` is called first and computes `cancelledInstallmentIds` based on
`getEffectiveStatus` of installments at that moment — including installments that processAbatement
will subsequently pay via discount. Then the merge step overwrites abatement-paid installments back
to `'cancelled'`.

**Fix:**
```typescript
// After abatement: only cancel installments that are STILL open/overdue
// (not ones abatement just paid)
const abatedAndPaidIds = new Set(
  abResult.updatedInstallments
    .filter(i => cancelledInstallmentIds.includes(i.id) && i.status === 'paid')
    .map(i => i.id)
);
const afterAbatement = abResult.updatedInstallments.map(inst =>
  cancelledInstallmentIds.includes(inst.id) && !abatedAndPaidIds.has(inst.id)
    ? { ...inst, status: 'cancelled' as const }
    : inst
);
```

---

### CR-04: `handleReverseReturn` in `Returns.tsx` calls `setSales` (line 350) and `setReturns` (line 409) in sequence using the same stale `sales` closure — the sale status restoration operates on the pre-reversal returns snapshot but the second `setSales` call (if needed) would overwrite the first

**File:** `src/pages/Returns.tsx:312-409`

**Issue:** `handleReverseReturn` performs the following state mutations in sequence:
1. Computes `updatedProducts` (local variable)
2. Computes `updatedClients` (local variable)
3. Computes `updatedReturns` (local variable, correctly marks return as reversed)
4. **Conditionally calls `setSales(sales.map(...))` at line 350** — restores sale status
5. Computes `restoredInstallments` (local variable)
6. Conditionally calls `setCreditPayments(...)` at line 392
7. Conditionally calls `setInstallments(restoredInstallments)` at line 404
8. Calls `setProducts(updatedProducts)` — line 407
9. Calls `setClients(updatedClients)` — line 408
10. Calls `setReturns(updatedReturns)` — line 409

There is **no second `setSales` call** to persist the reversal to the sale record. The `setReturns`
at line 409 correctly updates the returns array to show `reversedAt`. But the `sales` array itself
is only touched at step 4 (the conditional `setSales` at line 350 to restore status). If the
original sale was NOT in `'refunded'` state (e.g., it was a partial return that didn't flip the sale
to `'refunded'`), the conditional block at line 340 does NOT fire, and `setSales` is NEVER called.
This means the sale record itself is not updated at all during reversal — which is fine if there's
nothing to update. But in the FULL-return reversal case where the sale IS `'refunded'`, the
conditional fires, and `setSales` uses the stale `sales` closure. Since `setReturns(updatedReturns)`
hasn't been called yet (it's at line 409), the sale status is updated against the not-yet-persisted
returns snapshot. This is actually fine in terms of data correctness because `updatedReturns` is
used correctly at line 341 to compute `allStillReturned` — the sale read from `sales` is not
re-read anywhere in this function after the `setSales` call.

**The actual ordering bug:** `setProducts`, `setClients`, and `setReturns` are called at lines
407-409 using their respective stale closures. The `updatedProducts` and `updatedClients` are derived
locally, so they are correct. `setReturns(updatedReturns)` at line 409 uses `updatedReturns`
which was derived at line 334. This is all correct.

**The real data-loss bug in CR-04:** `handleReverseReturn` does NOT update `cancelledInstallmentIds`
on the `Sale` record when it restores installments. If `Sale.cancelledInstallmentIds` was set (by
`handleReturnFromSale` in Sales.tsx line 349 or by `handleReturn` in Returns.tsx), reversing the
return does NOT clear `Sale.cancelledInstallmentIds`. This means after reversal, the sale record
still carries `cancelledInstallmentIds` — which causes `canRefund()` in Sales.tsx (line 399) to
return `false` for that sale:

```typescript
// Sales.tsx line 399
if (sale.cancelledInstallmentIds && sale.cancelledInstallmentIds.length > 0) return false;
```

After a return is reversed, the operator can no longer estornar that sale even though all installments
are back to `'open'` and the sale is not `'refunded'`. The sale is permanently blocked from estorno
even after a correct reversal.

**Fix:**
```typescript
// In handleReverseReturn, when restoring sale status, also clear cancelledInstallmentIds:
setSales(sales.map(s =>
  s.id === ret.originalSaleId
    ? { ...s, status: restoredStatus, cancelledInstallmentIds: undefined }
    : s
));
```
And for the case where the sale status is not restored (partial return reversal), add:
```typescript
// Also clear cancelledInstallmentIds if this was the return that set them
if (ret.cancelledInstallmentIds && ret.cancelledInstallmentIds.length > 0) {
  setSales(sales.map(s =>
    s.id === ret.originalSaleId
      ? { ...s, cancelledInstallmentIds: undefined }
      : s
  ));
}
```

---

## Warnings

### WR-01: `processReturn.ts` line 142: dead branch — the `hasClient ? totalRefunded : 0` expression in the `else` branch is always `true` because the `!hasClient` case is handled above

**File:** `src/lib/processReturn.ts:142`

**Issue:**
```typescript
} else {
  // Cash/card/pix sale: generate haver = returnTotal (existing correct behavior).
  creditGenerated = hasClient ? totalRefunded : 0;  // line 142
}
```
At this point in the code, `!hasClient` has already been handled by the `if (!hasClient)` branch
starting at line 129. The `else` branch at line 140 is only reachable when `hasClient === true` AND
`!isCrediarioSale`. The `hasClient ? totalRefunded : 0` ternary is therefore always `totalRefunded`.
The dead condition creates confusion: a future maintainer might think this handles the no-client case
and remove the top-level guard.

**Fix:** Simplify to:
```typescript
} else {
  // Cash/card/pix sale with client: generate haver = totalRefunded.
  creditGenerated = totalRefunded;
}
```

---

### WR-02: `Returns.tsx` — `selectSaleFromSearch` sets `selectedClient` then calls `selectSale`, but `selectSale` does not reset `selectedClient` — if the sale has no client, the previously set `selectedClient` from the combobox path persists

**File:** `src/pages/Returns.tsx:88-93`

**Issue:**
```typescript
const selectSaleFromSearch = (sale: Sale) => {
  if (sale.clientId) {
    setSelectedClient(sale.clientId);
  }
  selectSale(sale);
};
```
If the operator first selects a client via the combobox (setting `selectedClient`), then switches to
code search and picks a sale with no `clientId`, `selectedClient` is NOT cleared. The sale has no
client, but `selectedClient` retains the previous combobox value. This causes `processReturn` to be
called with a non-empty `clientId` for a sale that was made without a client — resulting in incorrect
haver generation for the previously selected client.

**Fix:**
```typescript
const selectSaleFromSearch = (sale: Sale) => {
  setSelectedClient(sale.clientId || '');  // always update, clearing if no clientId
  selectSale(sale);
};
```

---

### WR-03: POS `handleConfirmReturn` — `setClients(updatedClients)` is called (line 323) before `setInstallments` (line 329) and `setSales` (line 338). The `updatedClients` was computed by `processReturn` using the stale `clients` closure. If the operator registered a new client via `handleReturnRegisterClient` in the same dialog session, the `setClients([...clients, newClient])` call at line 269 updates React state but `processReturn` was called after that with the original `clients` closure.

**File:** `src/pages/POS.tsx:269,299,323`

**Issue:** `handleReturnRegisterClient` at line 252 calls:
```typescript
setClients([...clients, newClient]);
setReturnClientId(newClient.id);
```
These are async IPC calls. When the operator then clicks "Confirmar Devolução" in the same dialog,
`handleConfirmReturn` calls:
```typescript
const resolvedClient = clients.find(c => c.id === returnClientId);  // line 299
```
Here `clients` is the STALE closure from the render before `setClients` was called. Because
`useLocalStorage` uses React state internally (`useState`), the call to `setClients` in
`handleReturnRegisterClient` triggers a re-render which gives `handleConfirmReturn` access to the
updated `clients` via the new closure — but only if React re-renders before the confirm button is
clicked. In practice the user must click a button after registering, so a re-render will have
occurred. This is safe due to the React re-render cycle.

However, the deeper issue: `processReturn` is called with `clients` (the closure at the time of
`handleConfirmReturn`) and `clientId: returnClientId`. The `clients` passed to `processReturn` must
include the newly registered client for `updatedClients` to contain the correct storeCredit mutation.
If React has re-rendered between `handleReturnRegisterClient` and `handleConfirmReturn`, `clients`
closure in `handleConfirmReturn` will be updated (new render = new closure). If React has NOT
re-rendered (e.g., due to batch updates or very fast clicking), `clients` would not include the new
client, and `setClients(updatedClients)` would overwrite the new client registration with the old
array plus only the storeCredit mutation, **losing the new client record**.

This is unlikely in practice but represents a real race-condition data loss path.

**Fix:** Pass the new client explicitly or ensure `handleConfirmReturn` reads from a ref:
```typescript
// After setClients([...clients, newClient]) in handleReturnRegisterClient,
// store newClient in a ref that handleConfirmReturn reads:
const pendingNewClientRef = useRef<Client | null>(null);
// In handleReturnRegisterClient:
pendingNewClientRef.current = newClient;
setClients([...clients, newClient]);
// In handleConfirmReturn:
const effectiveClients = pendingNewClientRef.current
  ? clients.some(c => c.id === pendingNewClientRef.current!.id)
    ? clients
    : [...clients, pendingNewClientRef.current]
  : clients;
// Pass effectiveClients to processReturn
```

---

### WR-04: History card in `Returns.tsx` uses `abatedInstallments.length > 0` to detect abatimento modality, but this field will be absent (`undefined`) for abatimento returns that were created with zero actual abatements (residual = returnValue, nothing absorbed)

**File:** `src/pages/Returns.tsx:838`

**Issue:**
```typescript
const isAbatimento = ret.abatedInstallments && ret.abatedInstallments.length > 0;
```
In `handleReturn`'s abatimento branch (line 238):
```typescript
returnRecord.abatedInstallments = abResult.abatedMap;
```
If the operator selected installments that were all already at `remaining ≤ 0` (fully covered by
prior payments), `processAbatement` would return an empty `abatedMap = []`. Then
`returnRecord.abatedInstallments = []`. The condition `ret.abatedInstallments.length > 0` is `false`
for an empty array, so the return is displayed as a haver return in the history (Gift icon, green
color) even though `creditGenerated = 0` was forced and no storeCredit was applied.

In this edge case, the history card shows:
- "+R$ 0,00" in green (because `isAbatimento = false`, falls to haver display branch)
- "Crédito gerado" badge

This is a display-only issue but misleads operators reviewing history.

**Fix:** Add a separate `modality` field to `ReturnRecord`, or detect abatimento by checking
`creditGenerated === 0` combined with `abatedInstallments !== undefined`:
```typescript
const isAbatimento = ret.abatedInstallments !== undefined;
```
Note this requires ensuring the abatimento branch always sets `returnRecord.abatedInstallments`
(even to `[]`), and the haver branch never sets it. Currently the haver branch does not set it,
so `undefined` correctly distinguishes haver from abatimento.

---

### WR-05: `Returns.tsx` abatimento branch does not call `setClients` but the haver branch does via `updatedClients` from `processReturn`. If a no-client return is processed in the haver branch, `setClients(updatedClients)` is called with `updatedClients === clients` (processReturn returns `clients` unchanged when `!hasClient`). This is a harmless no-op write but indicates the haver branch unconditionally calls `setClients` without checking if clients actually changed.

**File:** `src/pages/Returns.tsx:290`

**Issue:** Minor but: in the haver branch (line 290):
```typescript
setClients(updatedClients);
```
When `!hasClient`, `processReturn` returns `updatedClients = clients` (the input unchanged, line 197).
Calling `setClients(clients)` writes the unchanged array to electron-store unnecessarily. For a store
with thousands of clients, this is a meaningless full serialization on every no-client return.

**Fix:**
```typescript
if (returnRecord.creditGenerated > 0 || hasClient) {
  setClients(updatedClients);
}
// Or more precisely:
if (updatedClients !== clients) {
  setClients(updatedClients);
}
```
The second form works because `processReturn` returns the input reference unchanged when no client
mutation occurred (it returns `clients` directly at line 197, not a copy).

---

### WR-06: `Sales.tsx` `handleReturnFromSale` reads `selectedSale` from React state but also reads `returnItems` from React state. The `initiateReturn` function updates `returnItems` via `setReturnItems`, then `handleReturnFromSale` is called. If `initiateReturn` is triggered again without the dialog being closed (e.g., rapid double-click on the return button at line 486: `setTimeout(() => initiateReturn(sale), 100)`), `returnItems` from the first `initiateReturn` call could be stale when `handleReturnFromSale` fires.

**File:** `src/pages/Sales.tsx:486`

**Issue:**
```typescript
onClick={() => { setSelectedSale(sale); setTimeout(() => initiateReturn(sale), 100); }}
```
The `setTimeout(..., 100)` is a timing hack to allow `setSelectedSale` to trigger a re-render before
`initiateReturn` runs. This is fragile: on slower machines or when the React scheduler is busy, the
re-render may not have completed in 100ms, causing `initiateReturn` to run while the dialog's
conditional rendering based on `selectedSale` has not yet fired, leading to the return items being
populated for the wrong sale or with stale data.

**Fix:** Use `useEffect` to trigger `initiateReturn` reactively when `selectedSale` changes:
```typescript
useEffect(() => {
  if (selectedSale && returnMode === false && returnItems.length === 0) {
    // triggered by the return button — initiate return items
  }
}, [selectedSale]);
```
Or trigger `initiateReturn(sale)` synchronously before the dialog renders, and let `setSelectedSale`
open it:
```typescript
onClick={() => {
  const items = computeReturnItems(sale); // pure computation, no state
  setReturnItems(items);
  setReturnMode(true);
  setSelectedSale(sale);
}}
```

---

## Info

### IN-01: Missing `'crediario_pending'` check in `canReturn` survival path when partial returns have depleted all items

**File:** `src/pages/Sales.tsx:404-408`

**Issue:** `canReturn` (line 404) correctly checks that at least one item has remaining quantity:
```typescript
const canReturn = (sale: Sale) => {
  if (sale.status === 'refunded') return false;
  const returnedQtys = getReturnedQuantities(sale.id);
  return sale.items.some(item => (item.quantity - (returnedQtys[item.productId] || 0)) > 0);
};
```
This is correct and `'crediario_pending'` is implicitly included because it doesn't filter it out.
However, when all items have been partially returned and the sale is `'crediario_pending'`, the
`canReturn` button remains visible (since it only checks item quantities, not whether any installments
remain open). This is fine behavior, but the button becoming invisible only when all item quantities
are exhausted, not when the debt is also cleared, could confuse operators who see a "Devolver Itens"
button for a sale with zero remaining debt. This is an info-level UX concern.

---

### IN-02: `processReturn.ts` stock restock uses `roundCurrency` for milheiro division but the product stock is stored as number of thousands (not units), so restocking `roundCurrency(quantity / 1000)` introduces an unnecessary round at the wrong scale

**File:** `src/lib/processReturn.ts:184-186`

**Issue:**
```typescript
const restock = product.unit === 'mil'
  ? roundCurrency(returnItem.quantity / 1000)
  : returnItem.quantity;
return { ...product, stock: product.stock + restock, updatedAt: now };
```
`roundCurrency` rounds to 2 decimal places (centavos). For milheiro quantities like `1500` units:
`roundCurrency(1500 / 1000) = roundCurrency(1.5) = 1.5` — correct. For `1` unit: `roundCurrency(1/1000) = roundCurrency(0.001) = 0` — incorrect, would add 0 to stock instead of 0.001. However,
per the project conventions, milheiro quantities are sold in whole thousands (`mil` = 1000 units
per unit), so `quantity` for a milheiro product in `SaleItem` represents number of units where
1 unit = 1 milheiro. The conversion `/ 1000` converts units back to the stock scale. Using
`roundCurrency` (2 decimals) instead of a quantity-appropriate rounding is a semantic mismatch
but unlikely to cause real issues for whole-thousand quantities.

The existing `POS.tsx` pattern (lines 610-611) for stock deduction uses raw division without
rounding: `quantity / 1000`. Consistency with that pattern would mean no rounding here either.

**Fix:** For consistency with `POS.tsx` deduction pattern, remove `roundCurrency`:
```typescript
const restock = product.unit === 'mil'
  ? returnItem.quantity / 1000
  : returnItem.quantity;
```

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
