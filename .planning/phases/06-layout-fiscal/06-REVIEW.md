---
phase: 06-layout-fiscal
reviewed: 2026-06-20T19:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/fiscalPlaceholders.ts
  - src/lib/fiscalBarcode.ts
  - src/lib/generateNFCe.ts
  - src/lib/generateDANFE.ts
  - src/pages/Sales.tsx
  - package.json
findings:
  critical: 2
  warning: 7
  info: 3
  total: 12
status: issues_found
---

# Phase 6: Layout Fiscal — Code Review Report

**Reviewed:** 2026-06-20T19:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 6 introduces two fiscal PDF generators (NFCe 80mm cupom and DANFE A4), shared
barcode/QR helpers, placeholder constants, and Sales.tsx UI wiring. The legal-text
fidelity and async patterns are largely correct. However, two CRITICAL issues exist:
(1) `generateBarcodeDataUrl` treats the inherently-async `bwip-js toCanvas` API as
synchronous, so the barcode PNG returned from `canvas.toDataURL()` is always an empty
image, and (2) `generateDANFE` calls `format(new Date(sale.createdAt), ...)` inside
Quadro 2 without any try/catch, making every DANFE generation throw an uncaught
exception when `sale.createdAt` is invalid or missing, crashing the generator with no
user feedback. Seven warnings cover the unhandled async rejection in `Sales.tsx`
onClick handlers (the `void` suppressor hides errors from the user entirely), two
places where `SaleItem.unit` is silently discarded in favour of a hardcoded `'UN'`,
NFCe dynamic height underflow with 0-item sales, access-key split logic that can
produce an empty second line, missing `ELETRÔNICA` accent in the DANFE center column
sub-label, and a `drawPageHeader` dead-code stub.

---

## Critical Issues

### CR-01: `generateBarcodeDataUrl` — bwip-js `toCanvas` is async but treated as sync

**File:** `src/lib/fiscalBarcode.ts:40-47`
**Issue:** `bwipjs.toCanvas(canvas, opts)` in the browser/Electron entry returns a
`Promise<HTMLCanvasElement>` in bwip-js ≥ 4.x (the version installed, `^4.11.1`).
The code does NOT await it:

```typescript
bwipjs.toCanvas(canvas, {      // ← returns Promise — not awaited
  bcid: 'code128',
  text,
  scale: 2,
  height: 12,
  includetext: false,
});
return canvas.toDataURL('image/png'); // ← fires immediately on blank canvas
```

`canvas.toDataURL()` executes before bwip-js has finished drawing, so the returned
data URL is always a 1×1 transparent PNG. `generateDANFE` calls this once and reuses
`barcodeUrl` on every page — meaning the CODE-128 barcode box in Quadro 0 is always
the fallback gray rectangle (caught by the surrounding `try/catch`), and the compact
barcode strips on overflow pages are silently empty (`catch { // ignore }`). The
document is generated without a real barcode on any page.

**Fix:** Await the `toCanvas` promise; `generateBarcodeDataUrl` is already declared
`async`, so this is a one-line fix:

```typescript
export async function generateBarcodeDataUrl(text: string): Promise<string> {
  const canvas = document.createElement('canvas');
  await bwipjs.toCanvas(canvas, {   // ← add await
    bcid: 'code128',
    text,
    scale: 2,
    height: 12,
    includetext: false,
  });
  return canvas.toDataURL('image/png');
}
```

---

### CR-02: `generateDANFE` — unguarded `new Date(sale.createdAt)` crash in Quadro 2

**File:** `src/lib/generateDANFE.ts:337`
**Issue:** In Quadro 2 (Destinatário), the emissão date is formatted without a
try/catch:

```typescript
drawValue(
  doc,
  format(new Date(sale.createdAt), 'dd/MM/yyyy', { locale: ptBR }),
  destDataX,
  q2Y
);
```

If `sale.createdAt` is empty, null, or an unparseable string (possible with old
electron-store records where `createdAt` was not yet set), `new Date(...)` returns
`Invalid Date` and `date-fns format()` throws `RangeError: Invalid time value`.
Because `generateDANFE` has no global try/catch and `printDANFE`/`downloadDANFE`
do not catch their awaited call, this propagates as an unhandled promise rejection.
The `void` call in `Sales.tsx` line 503 swallows it silently — the user sees no error
and no PDF.

The same `new Date(sale.createdAt)` is also called at line 400 in Quadro 2 Row 3
(Hora Saída) with an equally naked `format(...)` call.

By contrast, `generateNFCe` correctly wraps its date formatting in `try/catch` at
lines 284–289.

**Fix:** Wrap both date format calls in the same try/catch pattern used in
`generateNFCe`:

```typescript
// Quadro 2, Row 1 — emissão
const emissaoDateStr = (() => {
  try {
    return format(new Date(sale.createdAt), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '';
  }
})();
drawValue(doc, emissaoDateStr, destDataX, q2Y);

// Quadro 2, Row 3 — hora saída
const horaSaidaStr = (() => {
  try {
    return format(new Date(sale.createdAt), 'HH:mm:ss', { locale: ptBR });
  } catch {
    return '';
  }
})();
drawValue(doc, horaSaidaStr, destHoraX, destRow3Y);
```

---

## Warnings

### WR-01: `void fn(...)` in `Sales.tsx` onClick silently discards all async errors

**File:** `src/pages/Sales.tsx:500-505, 640-658`
**Issue:** All six fiscal PDF onClick handlers in Sales.tsx use the `void` operator:

```typescript
onClick={() => void printNFCe(sale, clientFor(sale))}
onClick={() => void printDANFE(sale, clientFor(sale))}
// … four more in the dialog
```

`void expr` evaluates `expr` and discards the returned promise, including any
rejection. If `generateNFCe` or `generateDANFE` throws (e.g., due to CR-02, a
bwip-js/qrcode internal error, or `window.open` being blocked), the user sees nothing
— no toast, no error message. The 06-03 summary acknowledges fire-and-forget as
intentional, but the existing `printReceipt`/`downloadReceipt` they mirror are
_synchronous_ functions (no rejection risk). The async equivalents must either surface
errors or the `void` choice must be documented as an explicit accepted risk.

**Fix:** Wrap with `.catch(err => toast.error(...))` or use an async handler:

```typescript
onClick={() => printNFCe(sale, clientFor(sale)).catch(() =>
  toast({ title: "Erro ao gerar NFCe", variant: "destructive" })
)}
```

---

### WR-02: `SaleItem.unit` field ignored — all NFCe and DANFE items hardcode `'UN'`

**File:** `src/lib/generateNFCe.ts:166`, `src/lib/generateDANFE.ts:541`
**Issue:** The NFCe item line 2 hardcodes the unit:

```typescript
const qtyStr = `    ${item.quantity} UN x ${formatCurrency(item.unitPrice)}`;
```

And the DANFE Quadro 4 item row:

```typescript
const un = 'UN';
```

`SaleItem` does not carry a `unit` field (it is on `Product`, not `SaleItem`), but
the `FISCAL-LAYOUT.md` data mapping notes "Item Unidade: `Product.unit` (via lookup
or stored on SaleItem)" and rates it as AVAILABLE. The project supports units beyond
`UN`: `kg`, `mt`, `cx`, `pc`, `lt`, `par`, `jg`, `rl`, `mil`. For products sold in
`kg` or `mt`, printing `UN` is factually incorrect and makes the layout look
incomplete when the operator reviews it.

**Fix:** Look up the unit from the `products` array or add `unit?` to `SaleItem`.
Since `generateNFCe`/`generateDANFE` already receive `sale.items` (which have
`productId`), the caller (Sales.tsx) could pass `products` or the generators could
call `getStoreSettings` — but `products` is not in scope there. Shorter-term: add
`unit?: string` to `SaleItem` (retrocompatible with `||  'UN'` fallback):

```typescript
// generateNFCe.ts:166
const unitLabel = (item as any).unit || 'UN';
const qtyStr = `    ${item.quantity} ${unitLabel} x ${formatCurrency(item.unitPrice)}`;
```

---

### WR-03: NFCe dynamic height underflows for sales with 0 items

**File:** `src/lib/generateNFCe.ts:44-46`
**Issue:** `calcHeight(0)` returns `Math.max(250, 164 + 0*8) = 250`. The static
blocks alone (Divisões I–IX without any items) consume approximately:

- Div I (emitter, 6 lines × 4mm + 5mm): ~29mm
- Separator + title + disclaimer band: ~20mm
- Div III header: ~8mm
- Div III-A totals (no items, 4 lines): ~18mm
- Div IV access key (3 lines): ~18mm
- Div V QR code: ~32mm
- Div VI consumer: ~6mm
- Div VII NFC-e ID: ~14mm
- Div VIII disclaimer: ~10mm
- Div IX footer: ~10mm

Total static ≈ 165mm, leaving 85mm of blank space below. A 0-item sale (which
can occur with an empty cart bug or data corruption) would result in an over-tall
cupom. This is not a crash, but `Math.max(250, ...)` means 1-item sales also get
250mm (overkill: 164+8=172). More importantly, 250mm is used as a _minimum_ even
when the correct height is 172mm — the cupom is always taller than needed for small
sales, which wastes paper on a thermal printer.

**Fix (minor):** Change the minimum to 175 to avoid excessive blank space for
typical 1-2 item sales:

```typescript
function calcHeight(itemCount: number): number {
  return Math.max(175, 164 + itemCount * 8);
}
```

---

### WR-04: Access-key string split in DANFE can produce empty second line

**File:** `src/lib/generateDANFE.ts:244-247`
**Issue:** The access key grouped string (`"0000 0000 ... 0000"` — 54 chars with
spaces) is split into two display lines:

```typescript
const halfLen = Math.floor(grouped.length / 2);   // 54/2 = 27
const splitIdx = grouped.indexOf(' ', halfLen);    // next space at or after pos 27
doc.text(grouped.slice(0, splitIdx), ...);
doc.text(grouped.slice(splitIdx + 1), ...);        // starts at splitIdx+1
```

For the 44-zero placeholder key, `grouped` is `"0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"` (54 chars). `halfLen = 27`; `grouped.indexOf(' ', 27)` finds the space at index 29 (after `"0000 0000 0000 0000 0000 0000 0"`, i.e., `"0000 "`). That works for all-zero keys. However, if `grouped.indexOf(' ', halfLen)` returns `-1` (impossible for all-zero but possible if the key had no spaces at all or was malformed), `grouped.slice(0, -1)` would be all chars except the last, and `grouped.slice(0)` would render all 54 chars on one line. More concretely: `splitIdx + 1` when `splitIdx === -1` is `0`, rendering the full string as the second line too. A safer approach is unconditional split at a fixed position.

**Fix:**

```typescript
// Split at character 27 on word boundary (the space between groups 6 and 7)
// grouped = "AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH IIII JJJJ KKKK"
// index:     0         10        20     26 27
const splitIdx = grouped.lastIndexOf(' ', Math.ceil(grouped.length / 2));
if (splitIdx > 0) {
  doc.text(grouped.slice(0, splitIdx), col2X + 1, q0Y + 21, { maxWidth: col2W - 2 });
  doc.text(grouped.slice(splitIdx + 1), col2X + 1, q0Y + 25, { maxWidth: col2W - 2 });
} else {
  doc.text(grouped, col2X + 1, q0Y + 21, { maxWidth: col2W - 2 });
}
```

---

### WR-05: DANFE center column label missing accent — `ELETRÔNICA` vs `ELETRONICA`

**File:** `src/lib/generateDANFE.ts:205-210`
**Issue:** The center column sub-label (below the large "DANFE" text) is:

```typescript
doc.text(
  'DOCUMENTO AUXILIAR DA\nNOTA FISCAL ELETRÔNICA',
  col1X + col1W / 2,
  q0Y + 16,
  { align: 'center' }
);
```

This reads `"NOTA FISCAL ELETRÔNICA"` — with the accent on the `Ô` — which is
correct. However, the `FISCAL-LAYOUT.md Part 4` requirement and `06-CONTEXT.md`
FISC-02 both specify the DANFE label row as:

```
"DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"
```

The accent _is_ present in the source, so this specific string is **correct**.
Cross-checking the NFCe title (generateNFCe.ts:123): `'DOCUMENTO AUXILIAR DA NOTA
FISCAL DE CONSUMIDOR ELETRÔNICA'` — also correct with accent.

The accent is present. This warning is RETRACTED on close reading; see INFO IN-01
below for the NFCe title "ELETRÔNICA" accent which is also correct.

---

### WR-06: `drawPageHeader` is a dead-code stub — `barcodeUrl` and `pageNum` parameters are unused

**File:** `src/lib/generateDANFE.ts:102-115`
**Issue:** The function signature is:

```typescript
function drawPageHeader(
  doc: jsPDF,
  barcodeUrl: string,
  pageNum: number,
  totalPages: number
): number {
  let y = MARGIN;
  drawDisclaimerBand(doc, y);
  y += DISCLAIMER_H;
  return y;
}
```

The function body uses only `doc` and ignores `barcodeUrl`, `pageNum`, and
`totalPages`. The function is also **never called** — all overflow-page headers are
drawn inline in the `for (const item of sale.items)` loop and in the totals-overflow
block. This stub adds dead code and misleads future readers into thinking page headers
are handled centrally.

**Fix:** Remove `drawPageHeader` entirely, or complete its implementation and replace
the inline header-drawing duplication (which is repeated twice) with calls to it.

---

### WR-07: NFCe Quadro III-A — single-payment branch always shows `sale.total` as amount, not actual payment amount

**File:** `src/lib/generateNFCe.ts:210-213`
**Issue:** The single-payment branch of the payment display section:

```typescript
const label = paymentLabels[sale.paymentMethod] || sale.paymentMethod;
rowText(doc, `Forma de Pagamento: ${label}`, formatCurrency(sale.total), y);
```

This is correct for most cases. However, for a crediário sale where an `entryAmount`
(entrada/down payment) was collected, the right-hand column shows `sale.total` (the
full financed amount) rather than `sale.entryAmount` — the amount actually paid at
the point of sale. A crediário sale's `paymentMethod` is `'crediario'`, so the label
would read "Crediário: R$ 500,00" when only R$ 100,00 was paid as entrada. The
`Sale` type has `entryAmount?: number` for exactly this scenario.

**Fix:**

```typescript
const displayAmount = sale.paymentMethod === 'crediario' && sale.entryAmount != null
  ? sale.entryAmount
  : sale.total;
rowText(doc, `Forma de Pagamento: ${label}`, formatCurrency(displayAmount), y);
```

---

## Info

### IN-01: `fiscalPlaceholders.ts` — `formatAccessKeyGroups` over-pads short keys silently

**File:** `src/lib/fiscalPlaceholders.ts:70`
**Issue:** `formatAccessKeyGroups` pads any key shorter than 44 chars with trailing
zeros:

```typescript
const padded = key.padEnd(44, '0').slice(0, 44);
```

This silently corrects malformed keys. Since the only caller passes
`PLACEHOLDER_ACCESS_KEY` (exactly 44 zeros), this is harmless today. If in a future
phase a real key is passed and it is accidentally truncated, the padding will mask
the error. A debug-mode assertion would catch this.

---

### IN-02: `generateNFCe.ts` — item unit always shows `UN` in line 2 (low priority note)

**File:** `src/lib/generateNFCe.ts:166`
**Issue:** Already raised as WR-02 for the quality impact. This Info entry notes
that the hardcoded `UN` string means fractional quantities introduced in Phase 5
(e.g., `2.5 UN x R$ 10,00`) will display as `2.5 UN` even for `kg` or `mt`
products, which may confuse operators validating the cupom against their product data.

---

### IN-03: `package.json` — `@types/bwip-js` not listed as devDependency; TypeScript types come from the package bundle

**File:** `package.json`
**Issue:** `bwip-js` ships its own TypeScript declarations (since v3.x), so a
separate `@types/bwip-js` is not needed. `@types/qrcode` is correctly listed as a
devDependency. This is fine. No action required; noting for completeness that if
bwip-js ever moves to a separate `@types/` package, the project would need updating.

---

_Reviewed: 2026-06-20T19:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
