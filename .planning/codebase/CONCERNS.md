# Codebase Concerns

**Analysis Date:** 2026-06-20

---

## Known Bugs (Priority Issues)

### BUG-1: Crediário Estorno — Haver Generated Even When Nothing Was Paid

**What happens:** In `src/pages/Sales.tsx` at `handleRefund()` (line 114), when estorning a crediário sale, the code only skips the `storeCredit` update when `totalPaidBack === 0`. However, `totalPaidBack` is calculated as the sum of `amountPaid` across all installments. If no installment has ever been paid, this correctly skips the credit update. The bug surfaces when a sale is in `crediario_pending` status and has an entry installment (`number === 0`) with `amountPaid === entryAmount`. In that case, `totalPaidBack > 0` (the entry was paid) and the code DOES generate haver — which is correct. The real concern is the opposite edge case: the `Returns.tsx` dedicated devolução flow (`handleReturn()` at line 122) and the inline return in `Sales.tsx` (`handleReturnFromSale()` at line 233) ALWAYS generate haver equal to `totalRefund` whenever a `clientId` exists, regardless of whether the original payment method was crediário or cash. If a crediário sale with zero payments is "returned" (not estorned) via the devolução flow, store credit is generated for an amount the client never actually paid.

- **Files:** `src/pages/Sales.tsx` lines 114–163, `src/pages/Returns.tsx` lines 122–210, `src/pages/Sales.tsx` lines 233–306
- **Impact:** Client gains `storeCredit` (haver) for money they never paid. Inventory correctness is unaffected; only financials are wrong.
- **Fix approach:** In the return/devolução flows, check the original sale's payment method. If `paymentMethod === 'crediario'` (or a split with crediário), only generate haver equal to the portion that was actually paid in cash/card/pix — not the full `returnTotal`. The `sale.crediarioPaid` field tracks total already paid on the crediário and can be used to cap the haver amount.

---

### BUG-2: Installments Stay Pending After Sale Estorno

**What happens:** `handleRefund()` in `src/pages/Sales.tsx` (lines 128–149) correctly calls `setInstallments(installments.map(inst => inst.saleId === sale.id ? { ...inst, status: 'cancelled' } : inst))`. So the estorno path does cancel installments.

However, the **item-by-item devolução** path — `handleReturnFromSale()` in `src/pages/Sales.tsx` (lines 233–306) and `handleReturn()` in `src/pages/Returns.tsx` (lines 122–210) — **never touches installments at all**. When a crediário sale has all items returned via the devolução flow (marking the sale `refunded`), its installments are left in `open` or `overdue` status. They continue to appear in `CreditNotes.tsx` as pending obligations and contribute to `totalPendingInstallments` and `clientCreditUsed` calculations.

- **Files:** `src/pages/Returns.tsx` `handleReturn()` (lines 122–210), `src/pages/Sales.tsx` `handleReturnFromSale()` (lines 233–306)
- **Impact:** Ghost installments inflate the client's crediário balance; operator has to manually cancel them in the Crediário page. Client may be incorrectly blocked from new crediário purchases due to inflated `clientCreditUsed`.
- **Fix approach:** After setting the sale status to `refunded` in both return flows, also cancel all installments for that `saleId` that are still `open` or `overdue`. Mirror the pattern from `handleRefund()` in `Sales.tsx` lines 136–140. Only cancel installments if `allItemsReturned` (full return), not on partial returns.

---

### BUG-3: PDF Generation Cuts Off When There Are Many Items

**What happens:** Both `generateReceipt()` in `src/lib/generateReceipt.ts` and `generateQuotePDF()` in `src/lib/generateQuote.ts` use a fixed page height defined at instantiation time:

- `generateReceipt`: `format: [80, 250]` — hardcoded 250mm (line 13)
- `generateQuotePDF`: `format: [80, 200]` — hardcoded 200mm (line 12)

The item loop increments `y` by ~8mm per item (3mm name + 5mm qty/total). With more than ~25 items (receipt) or ~20 items (quote), `y` exceeds the page height and jsPDF silently clips content. The TOTAL line and payment information are printed after the items loop, so they overflow off the bottom of the page.

By contrast, `generateCrediarioStatement()` in `src/lib/generateCrediarioReceipt.ts` correctly uses dynamic height calculation (lines 20–29) based on `installments.length`. The receipt and quote generators do not apply this pattern.

- **Files:** `src/lib/generateReceipt.ts` line 13, `src/lib/generateQuote.ts` line 12
- **Impact:** Printed/downloaded PDFs for large orders are missing totals and payment information. The document looks complete visually until printed.
- **Fix approach:** Pre-calculate page height before creating the `jsPDF` instance. Pattern from `generateCrediarioStatement.ts` lines 20–29: compute `baseHeight + (items.length * perItemHeight)` and pass that as the `format` height. For `generateReceipt`: base ~140mm + 8mm per item. For `generateQuotePDF`: base ~100mm + 8mm per item.

---

### BUG-4: Returns Flow Restricted — Crediário Pending Sales Ineligible

**What happens:** In `src/pages/Returns.tsx`, `eligibleSales` (line 59) filters to only `status === 'completed' || status === 'crediario_paid'`. Sales in `crediario_pending` status are excluded.

In `src/pages/Sales.tsx`, `canReturn()` (line 312) also excludes `refunded` but allows all other statuses including `crediario_pending`. So the Sales page allows returning items from a pending crediário sale, but the dedicated Returns page (/returns) does not.

This inconsistency means the devolução workflow at `/returns` cannot process returns for the most common crediário case (partially paid or unpaid). Operators must use the less discoverable button inside the Sales history detail dialog.

- **Files:** `src/pages/Returns.tsx` line 59–61, `src/pages/Sales.tsx` line 312–315
- **Impact:** Operators cannot use the Returns page for crediário sales that haven't been fully paid. Inconsistent UX.
- **Fix approach:** Align `eligibleSales` in `Returns.tsx` to include `crediario_pending` status — same logic as `canReturn()` in `Sales.tsx`. When returning items from a crediário sale, apply the installment cancellation logic from BUG-2 fix.

---

### BUG-5: No Fractional/Decimal Quantity Support for Measured Products

**What happens:** The cart quantity input in `src/pages/POS.tsx` (line 656) uses `parseInt(e.target.value)` — this truncates decimal input. The `updateItemQuantity()` function (line 222) also uses `parseInt`. The `updateQuantity()` function (line 194) uses integer delta (+1/-1). For products sold by meter (`mt`), liter (`lt`), or kilogram (`kg`), quantities must be integers, making it impossible to sell 2.5mt of pipe or 0.75kg of a product.

The `Product.stock` field is typed as `number` and the `mil` unit is handled with `/1000` math (e.g., `POS.tsx` lines 160–163), showing the codebase can handle fractional stock, but the POS cart input forcibly converts to integers.

- **Files:** `src/pages/POS.tsx` lines 656–659, `src/pages/POS.tsx` lines 222–244, `src/pages/POS.tsx` lines 194–220, `src/types/index.ts` `SaleItem.quantity` (line 33 — typed `number`)
- **Impact:** Store cannot sell partial quantities of measured products. Significant operational gap for a hardware store selling pipe, wire, rope, etc. by the meter or kilogram.
- **Fix approach:** Change `parseInt` to `parseFloat` in the cart quantity input onChange handlers. Update the `+`/`-` delta buttons to use configurable steps (e.g., 0.1 or 0.5 for `mt`/`kg` units, 1 for `un`/`cx`). Add a `step` attribute to the quantity `<Input>` derived from the product's unit type. Update stock deduction in `finalizeSale()` (line 404–413) — the `mil` logic already handles fractions, but `mt`/`kg`/`lt` deductions should pass through as floats. Apply the same fix to `src/pages/Quotes.tsx` lines 310–313.

---

## Tech Debt

### Data Persistence — No Transactional Writes

**Area:** All pages that mutate multiple storage keys

The application makes multiple sequential `useLocalStorage` setter calls where all must succeed atomically (e.g., `setProducts`, `setSales`, `setInstallments`, `setClients` in `finalizeSale()`). If the app crashes or the Electron IPC call to `window.electron.store.set()` fails mid-sequence, data is left in a partially updated state (e.g., stock deducted but sale not recorded).

- **Files:** `src/pages/POS.tsx` `finalizeSale()` lines 404–513, `src/pages/Sales.tsx` `handleRefund()` lines 114–163, `src/pages/Returns.tsx` `handleReturn()` lines 122–210
- **Impact:** Data corruption risk on crash during a sale. Low probability in practice (Electron IPC is fast), but non-zero.
- **Fix approach:** Either: (a) perform all mutations in a single batch write to a top-level store object, or (b) create a `commitTransaction(updates: Record<string, unknown>)` helper that writes all keys atomically via Electron's `store.set`.

---

### Duplicate Return Logic in Two Places

**Area:** Devolução (item return) implementation

The item-return flow is implemented independently in both `src/pages/Sales.tsx` (`handleReturnFromSale`, lines 233–306) and `src/pages/Returns.tsx` (`handleReturn`, lines 122–210). These two functions share the same logic but drift independently: `Returns.tsx` properly validates quantities against already-returned items before saving (lines 133–141), while `Sales.tsx` does not perform this validation before the confirmation dialog.

- **Files:** `src/pages/Sales.tsx` lines 233–306, `src/pages/Returns.tsx` lines 122–210
- **Impact:** Logic drift means bugs fixed in one place may not be fixed in the other. The missing installment cancellation (BUG-2) is present in both.
- **Fix approach:** Extract return logic into a shared `lib/processReturn.ts` function called by both pages.

---

### `useLocalStorage` Initial State Race

**Area:** `src/hooks/useLocalStorage.ts`

The hook initializes state to `initialValue` synchronously (line 5), then loads the real data asynchronously via `useEffect` (lines 8–28). During the async load window, any component that reads the hook value sees stale empty arrays. In `finalizeSale()`, if the user clicks "Finalizar Venda" before the async Electron store load completes, the sale is written against an empty `products` array, resulting in no stock deduction.

- **Files:** `src/hooks/useLocalStorage.ts` lines 1–49
- **Impact:** Narrow race condition on app startup. Mitigated in practice because Electron IPC is fast, but not protected architecturally.
- **Fix approach:** Add a `loaded` flag to the hook, expose it, and disable the POS "Finalizar Venda" button until all required stores have loaded.

---

### `getStoreSettings()` Is Synchronous but Electron Store Is Async

**Area:** `src/lib/storeInfo.ts`

`getStoreSettings()` (line 3) calls `window.electron.store.get('store_settings')` synchronously (line 6), but `useLocalStorage.ts` shows that Electron store reads are async. In a web context this falls back to synchronous `localStorage`. In Electron, `w.electron.store.get()` appears synchronous based on the implementation, suggesting the Electron preload bridge returns values synchronously. If the bridge is ever refactored to be properly async, this will silently return `defaultSettings` for every call.

- **Files:** `src/lib/storeInfo.ts`, `src/hooks/useLocalStorage.ts`
- **Impact:** Low risk currently. Creates architectural inconsistency between how settings are read vs. how all other data is read.
- **Fix approach:** Make `getStoreSettings()` async and await it in callers, or use a dedicated React context for store settings.

---

### Products Page: `parseInt` for Stock Field Loses Decimal Stock Values

**Area:** `src/pages/Products.tsx`

The product edit form uses `parseInt(e.target.value) || 0` for the stock field (line 324). Products with fractional stock (e.g., after selling 1.5mt from a 10mt roll, stock = 8.5) will be rounded to an integer if the user opens and saves the product in the edit dialog.

- **Files:** `src/pages/Products.tsx` line 324
- **Impact:** Manual edits to stock overwrite fractional values with integers. Related to BUG-5.
- **Fix approach:** Change to `parseFloat(e.target.value) || 0`.

---

### `filteredProducts` in POS Caps at 10 Results

**Area:** `src/pages/POS.tsx` line 577, `src/pages/Quotes.tsx` line 241

The product search result dropdown renders `filteredProducts.slice(0, 10)`. For stores with many products sharing similar names or codes, this means relevant results may not appear. There is no "show more" affordance.

- **Files:** `src/pages/POS.tsx` line 577, `src/pages/Quotes.tsx` line 241
- **Impact:** Operator cannot find product if it falls outside the top-10 filtered results. Workaround: type more specific search terms.
- **Fix approach:** Increase to 20 or add pagination/virtualization. For now, improving sort relevance (exact code match first) would help more than raising the cap.

---

### `useEffect` Overdue Detection Runs Once on Mount Only

**Area:** `src/pages/CreditNotes.tsx`

The `useEffect` that updates installments from `open` to `overdue` (lines 61–74) has an empty dependency array (`[]`) and runs only once on mount. If the app is left open across midnight (common for a running Electron app at a store), installments that become overdue during the day won't be updated until the Crediário page is reloaded. Overdue status is critical for the delinquency check in `POS.tsx` (which blocks new crediário sales).

- **Files:** `src/pages/CreditNotes.tsx` lines 61–74, `src/pages/POS.tsx` lines 137–140
- **Impact:** An operator who leaves the app open overnight will see incorrect (non-overdue) status for installments that became overdue. New crediário sales could be wrongly allowed for delinquent clients.
- **Fix approach:** Move overdue detection to the `useLocalStorage` hook or a shared context that re-evaluates on a timer, or simply recalculate overdue status on-the-fly wherever `installments` are rendered (no write needed for display).

---

### `eslint-disable-line react-hooks/exhaustive-deps` in CreditNotes

**Area:** `src/pages/CreditNotes.tsx` line 74

The `useEffect` intentionally suppresses the exhaustive-deps warning to avoid re-running on every render. This is a code smell that signals the effect should be redesigned.

- **Files:** `src/pages/CreditNotes.tsx` line 74

---

## Security Considerations

### Store Settings Contain Production CNPJ and Address in Source

**Area:** `src/types/settings.ts`

`defaultSettings` (lines 13–27) hardcodes the real store's CNPJ (`46.483.338/0001-42`), address, phone, and CEP as the application default. This data ships in the compiled bundle. For an Electron app distributed as a binary, this is low risk. If ever built as a web app or open-sourced, this would expose PII.

- **Files:** `src/types/settings.ts` lines 13–27
- **Impact:** Low for current Electron distribution. Noteworthy if deployment model changes.
- **Fix approach:** Move defaults to a separate config file excluded from version control, or make defaults blank strings that require first-run setup.

### No Input Sanitization on Free-Text Fields

**Area:** Client and product forms

Fields like `client.name`, `client.address`, `product.name` are stored and later rendered directly in JSX. Because React auto-escapes JSX expressions, XSS is not a concern in the UI. However, these values are also passed directly into `jsPDF`'s `doc.text()` calls. jsPDF does not execute scripts, so injection risk in PDFs is negligible.

- **Files:** `src/pages/Clients.tsx`, `src/pages/Products.tsx`, `src/lib/generateReceipt.ts`
- **Impact:** Negligible for current Electron + jsPDF usage.

---

## Performance Bottlenecks

### All Data Loaded Into Memory from localStorage/Electron Store

**Area:** Every page uses `useLocalStorage` for `sales`, `products`, `clients`, `installments`

All records are loaded into React state on page mount. With hundreds of sales and thousands of installments accumulated over months, the `installments` array scan performed on every render in `POS.tsx` (lines 132–135 — `clientCreditUsed`) and `CreditNotes.tsx` (lines 105–120 — `filteredInstallments`) becomes O(n) on potentially large arrays.

- **Files:** `src/pages/POS.tsx` lines 132–135, `src/pages/CreditNotes.tsx` lines 105–120, `src/pages/Reports.tsx` (all `useMemo` blocks)
- **Impact:** Likely fine for 1–2 years of data. Could cause noticeable render lag beyond ~10,000 installments.
- **Fix approach:** No immediate action needed. If performance degrades, index installments by `clientId` using a `useMemo` Map once at top level rather than scanning the full array in multiple places.

### `sortedSales` Clones and Sorts Entire Sales Array on Every Render

**Area:** `src/pages/Sales.tsx` line 76

`[...sales].sort(...)` runs on every render of the Sales page. With many sales this is fast but unnecessary — it should be in a `useMemo`.

- **Files:** `src/pages/Sales.tsx` lines 76–105
- **Impact:** Negligible currently. Trivial fix.
- **Fix approach:** Wrap in `useMemo([sales])`.

---

## Fragile Areas

### `handleRefund()` in Sales.tsx Restores Stock Using Original Item Quantities, Not Returned Quantities

**Area:** `src/pages/Sales.tsx` lines 115–126

When estorning a sale, `handleRefund()` restores the full original quantity for every item (`saleItem.quantity`), regardless of whether some items were already partially returned via the devolução flow. If an operator does a partial devolução (returning 2 of 5 items), then later estorns the whole sale, the stock for the returned items is added back twice.

- **Files:** `src/pages/Sales.tsx` lines 115–126, `src/pages/Returns.tsx`
- **Impact:** Stock count inflated by double-restocking on estorno after partial devolução.
- **Fix approach:** Before restoring stock in `handleRefund()`, subtract quantities already returned via `returns` records for that sale (use the same `getReturnedQuantities()` helper pattern from `Sales.tsx` line 200).

---

### `canRefund()` Allows Estorno of `crediario_pending` Sales

**Area:** `src/pages/Sales.tsx` line 309

`canRefund()` returns `true` for `crediario_pending` sales. This is intentional but fragile: if the operator estorns a crediário_pending sale that has had no payments but has already been partially devolvido (items returned), the stock restoration double-counts as described above. The UI does not warn about existing return records before showing the estorno button.

- **Files:** `src/pages/Sales.tsx` lines 308–310, lines 626–682
- **Fix approach:** In the estorno confirmation dialog, check for existing active return records for that sale and display a warning if any exist.

### `ReturnRecord` Has No Installment Reference

**Area:** `src/types/index.ts` `ReturnRecord` interface (lines 100–110)

`ReturnRecord` tracks `originalSaleId`, items, credit, and amounts, but has no reference to which installments were cancelled (or should be). This makes it impossible to undo installment cancellation if a return is reversed (`handleReverseReturn()` in `Returns.tsx` does not restore installments — lines 213–263).

- **Files:** `src/types/index.ts` lines 100–110, `src/pages/Returns.tsx` lines 213–263
- **Impact:** Reversing a devolução restores stock and removes haver but leaves installments in `cancelled` state (when BUG-2 fix is applied). Crediário account appears closed even though the return was reversed.
- **Fix approach:** Add `cancelledInstallmentIds?: string[]` to `ReturnRecord`. Populate it in the return flow when installments are cancelled. Restore them in `handleReverseReturn()`.

---

## Missing Critical Features

### No Cash Management / Sangria Feature

- **Problem:** There is no way to record cash withdrawals (sangria) or opening float (fundo de caixa). The fechamento de caixa report (`src/pages/Reports.tsx`) shows revenue by payment method but cannot reconcile physical cash.
- **Blocks:** Accurate cash register reconciliation at end of day.

### Interest Calculation Is Display-Only — Not Persisted to Installment

**Area:** `src/pages/CreditNotes.tsx` `calculateInterest()` (lines 79–87)

Juros (interest) is calculated on-the-fly for display in the payment dialog. When an operator accepts payment, the payment amount can include juros but the `handlePayment()` function (line 176) does not add juros to the installment's `amount` field or create a separate interest record. The interest shown is informational only — the operator must manually add it to `paymentAmount`.

- **Files:** `src/pages/CreditNotes.tsx` lines 79–87, lines 176–258
- **Impact:** Interest can be easily forgotten. No audit trail of interest charged. `crediarioPaid` on the sale won't include interest amounts.

### No Barcode Scanner Integration in POS

The POS product search (`src/pages/POS.tsx` lines 543–611) requires typing. The `Product` type has a `barcode` field (line 6 in `types/index.ts`) and barcode search is supported in the filter (line 110), but there is no keyboard-shortcut handler or input focus management that would allow a USB barcode scanner to work without clicking the search field first.

---

## Test Coverage Gaps

### No Tests Exist

- **What's not tested:** All business logic — sale finalization, installment generation, estorno, return flows, PDF generation, interest calculation, credit limit enforcement.
- **Files:** All `src/` files
- **Risk:** Regressions in crediário math, stock calculations, or PDF output go undetected until reported by operators.
- **Priority:** High for `src/pages/POS.tsx` `finalizeSale()`, `src/pages/Sales.tsx` `handleRefund()`, and `src/pages/CreditNotes.tsx` `handlePayment()`.

---

*Concerns audit: 2026-06-20*
