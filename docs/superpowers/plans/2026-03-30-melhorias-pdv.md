# Melhorias PDV RC Ferragista - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 13 improvements to the PDV system covering settings, exports, reports, validation, UX shortcuts, client management, and crediario interest.

**Architecture:** All features use existing React + localStorage pattern. New pages get routes in App.tsx and nav items in Layout.tsx. Shared utilities extracted to src/lib/. New types added to src/types/index.ts. No new dependencies needed (date-fns, jsPDF, Zod already available).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui, Zod, date-fns, jsPDF, Electron Store

---

## Task 1: Extract Shared Utilities (formatCurrency, paymentLabels)

**Files:**
- Create: `src/lib/formatters.ts`
- Modify: `src/pages/Index.tsx` (remove local formatCurrency)
- Modify: `src/pages/POS.tsx` (remove local formatCurrency)
- Modify: `src/pages/Sales.tsx` (remove local formatCurrency, paymentLabels)
- Modify: `src/pages/CreditNotes.tsx` (remove local formatCurrency, paymentLabels)
- Modify: `src/pages/Products.tsx` (remove local formatCurrency)
- Modify: `src/pages/Quotes.tsx` (remove local formatCurrency)
- Modify: `src/lib/generateReceipt.ts` (remove local paymentLabels)

- [ ] **Step 1: Create `src/lib/formatters.ts`**

```ts
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartao de Credito',
  debit: 'Cartao de Debito',
  pix: 'PIX',
  crediario: 'Crediario',
  store_credit: 'Cred. Haver',
};
```

- [ ] **Step 2: Replace in all pages**

In each file listed above, replace the local `formatCurrency` function and `paymentLabels` constant with:
```ts
import { formatCurrency, paymentLabels } from '@/lib/formatters';
```
Remove the local definitions. For pages that use a shorter payment labels map (e.g., `credit: 'Credito'` instead of `credit: 'Cartao de Credito'`), keep a local override or add both forms to the shared map.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/formatters.ts src/pages/*.tsx src/lib/generateReceipt.ts
git commit -m "refactor: extract shared formatCurrency and paymentLabels utilities"
```

---

## Task 2: Store Settings Page

**Files:**
- Create: `src/types/settings.ts`
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/Layout.tsx` (add nav item)
- Modify: `src/lib/generateReceipt.ts` (use dynamic store info)
- Modify: `src/lib/generateCrediarioReceipt.ts` (use dynamic store info)
- Modify: `src/lib/generateQuote.ts` (use dynamic store info)

- [ ] **Step 1: Create `src/types/settings.ts`**

```ts
export interface StoreSettings {
  storeName: string;
  cnpj: string;
  address: string;
  city: string;
  cep: string;
  phone: string;
  lowStockThreshold: number;
  crediarioInterestRate: number; // % monthly, 0 = no interest
  discountPresets: { label: string; percent: number }[];
}

export const defaultSettings: StoreSettings = {
  storeName: 'RC Casa & Construcao',
  cnpj: '46.483.338/0001-42',
  address: 'Rua Vicente Bueno, 160',
  city: 'Setor Paraiso - Inhumas, GO',
  cep: '75400-896',
  phone: '(62) 99275-1884',
  lowStockThreshold: 10,
  crediarioInterestRate: 0,
  discountPresets: [
    { label: '5%', percent: 5 },
    { label: '10%', percent: 10 },
    { label: '15%', percent: 15 },
  ],
};
```

- [ ] **Step 2: Create `src/pages/Settings.tsx`**

Full settings page with tabs: "Loja" (store info), "Crediario" (interest rate), "Descontos" (discount presets). Uses `useLocalStorage<StoreSettings>('store_settings', defaultSettings)`. Each section has save button. Layout follows existing pattern with `<Layout>`, `<PageHeader>`, `<Card>`. Fields: storeName, cnpj, address, city, cep, phone, lowStockThreshold, crediarioInterestRate, discountPresets (add/remove list).

- [ ] **Step 3: Add route to `src/App.tsx`**

```tsx
import Settings from "./pages/Settings";
// Add inside <Routes>:
<Route path="/settings" element={<Settings />} />
```

- [ ] **Step 4: Add nav item to `src/components/Layout.tsx`**

```tsx
import { Settings as SettingsIcon } from 'lucide-react';
// Add to navItems array:
{ path: '/settings', label: 'Configuracoes', icon: SettingsIcon },
```

- [ ] **Step 5: Update receipt generators to use dynamic store info**

Create a helper `src/lib/storeInfo.ts`:
```ts
import { StoreSettings, defaultSettings } from '@/types/settings';

export function getStoreSettings(): StoreSettings {
  try {
    if (window.electron?.store) {
      const stored = window.electron.store.get('store_settings');
      if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
    } else {
      const stored = localStorage.getItem('store_settings');
      if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {}
  return defaultSettings;
}
```

Then in `generateReceipt.ts`, `generateCrediarioReceipt.ts`, `generateQuote.ts`, replace hardcoded store name/CNPJ/address/phone with:
```ts
import { getStoreSettings } from '@/lib/storeInfo';
const store = getStoreSettings();
// Use store.storeName, store.cnpj, store.address, etc.
```

- [ ] **Step 6: Update Layout.tsx header to use dynamic store name**

```tsx
import { getStoreSettings } from '@/lib/storeInfo';
// In component:
const store = getStoreSettings();
// Replace hardcoded "RC Casa & Construcao" with store.storeName
```

- [ ] **Step 7: Update `src/pages/Index.tsx` low stock to use settings threshold**

Replace `p.stock <= 10` with dynamic threshold from settings.

- [ ] **Step 8: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add -A && git commit -m "feat: add settings page with dynamic store info, interest rate, discount presets"
```

---

## Task 3: CPF/CNPJ Validation

**Files:**
- Create: `src/lib/documentValidation.ts`
- Modify: `src/pages/Clients.tsx` (add validation + input mask)

- [ ] **Step 1: Create `src/lib/documentValidation.ts`**

```ts
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function formatDocument(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) return formatCPF(value);
  return formatCNPJ(value);
}

export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(digits[12]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(digits[13]) === d2;
}

export function validateDocument(doc: string): { valid: boolean; type: 'cpf' | 'cnpj' | 'empty' } {
  const digits = doc.replace(/\D/g, '');
  if (digits.length === 0) return { valid: true, type: 'empty' };
  if (digits.length <= 11) return { valid: validateCPF(doc), type: 'cpf' };
  return { valid: validateCNPJ(doc), type: 'cnpj' };
}
```

- [ ] **Step 2: Update Clients.tsx document input**

Replace the document `<Input>` with auto-formatting:
```tsx
import { formatDocument, validateDocument } from '@/lib/documentValidation';

// In the document input onChange:
onChange={e => setFormData({ ...formData, document: formatDocument(e.target.value) })}

// In handleSave, before saving, validate:
if (formData.document) {
  const docResult = validateDocument(formData.document);
  if (!docResult.valid) {
    toast.error(docResult.type === 'cpf' ? 'CPF invalido' : 'CNPJ invalido');
    return;
  }
}
```

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/lib/documentValidation.ts src/pages/Clients.tsx
git commit -m "feat: add CPF/CNPJ validation and auto-formatting on client registration"
```

---

## Task 4: Barcode Field on Product

**Files:**
- Modify: `src/types/index.ts` (add barcode to Product)
- Modify: `src/pages/Products.tsx` (add barcode field to form, show in list)
- Modify: `src/pages/POS.tsx` (search by barcode too)

- [ ] **Step 1: Add `barcode` field to Product interface**

In `src/types/index.ts`:
```ts
export interface Product {
  // ... existing fields
  barcode?: string; // Add after 'code'
}
```

- [ ] **Step 2: Add barcode input to Products.tsx form**

Add after the code/unit row in the product dialog:
```tsx
<div className="space-y-2">
  <Label htmlFor="barcode">Codigo de Barras</Label>
  <Input
    id="barcode"
    value={formData.barcode || ''}
    onChange={e => setFormData({ ...formData, barcode: e.target.value })}
    placeholder="7891234567890"
  />
</div>
```

Update `emptyProduct` to include `barcode: ''`.
Update `handleEdit` to include `barcode: product.barcode || ''`.
Show barcode in product card if present: `{product.barcode && <span>EAN: {product.barcode}</span>}`

- [ ] **Step 3: Update POS.tsx search to include barcode**

In the `filteredProducts` filter, add:
```ts
p.barcode?.toLowerCase().includes(searchValue.toLowerCase()) ||
```

- [ ] **Step 4: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/types/index.ts src/pages/Products.tsx src/pages/POS.tsx
git commit -m "feat: add barcode field to products, searchable in POS"
```

---

## Task 5: CSV Export Utility

**Files:**
- Create: `src/lib/csvExport.ts`
- Modify: `src/pages/Products.tsx` (add export button)
- Modify: `src/pages/Clients.tsx` (add export button)
- Modify: `src/pages/Sales.tsx` (add export button)
- Modify: `src/pages/CreditNotes.tsx` (add export button)

- [ ] **Step 1: Create `src/lib/csvExport.ts`**

```ts
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const csvContent = BOM + [
    headers.join(';'),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
```

- [ ] **Step 2: Add export to Products.tsx**

Add a button next to "Novo Produto" in the PageHeader action:
```tsx
import { FileDown } from 'lucide-react';
import { exportToCSV } from '@/lib/csvExport';

// Export function:
const handleExport = () => {
  exportToCSV('produtos',
    ['Codigo', 'Cod.Barras', 'Nome', 'Categoria', 'Preco Custo', 'Preco Venda', 'Estoque', 'Unidade'],
    products.map(p => [p.code, p.barcode || '', p.name, p.category, p.costPrice.toFixed(2), p.price.toFixed(2), String(p.stock), p.unit])
  );
};

// Button in PageHeader action area:
<Button variant="outline" onClick={handleExport}><FileDown className="h-4 w-4 mr-2" />Exportar</Button>
```

- [ ] **Step 3: Add export to Clients.tsx**

```ts
const handleExport = () => {
  exportToCSV('clientes',
    ['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Endereco', 'Cidade', 'Limite Credito', 'Credito Haver'],
    clients.map(c => [c.name, c.document, c.phone, c.email, c.address, c.city, String(c.creditLimit || 0), String(c.storeCredit || 0)])
  );
};
```

- [ ] **Step 4: Add export to Sales.tsx**

Export filtered sales:
```ts
const handleExport = () => {
  exportToCSV('vendas',
    ['Data', 'Cliente', 'Itens', 'Subtotal', 'Desconto', 'Total', 'Pagamento', 'Status'],
    filteredSales.map(s => [
      format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm'),
      s.clientName || 'Sem cliente',
      s.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
      s.subtotal.toFixed(2), s.discount.toFixed(2), s.total.toFixed(2),
      paymentLabels[s.paymentMethod] || s.paymentMethod,
      s.status || 'completed'
    ])
  );
};
```

- [ ] **Step 5: Add export to CreditNotes.tsx**

Export installments:
```ts
const handleExport = () => {
  exportToCSV('crediario',
    ['Cliente', 'Venda', 'Parcela', 'Valor', 'Desconto', 'Pago', 'Restante', 'Vencimento', 'Status'],
    installments.filter(i => i.number > 0 && i.status !== 'cancelled').map(i => {
      const disc = i.discountApplied || 0;
      const remaining = i.amount - i.amountPaid - disc;
      return [
        i.clientName, i.saleId.slice(0,8).toUpperCase(),
        `${i.number}/${i.totalInstallments}`,
        i.amount.toFixed(2), disc.toFixed(2), i.amountPaid.toFixed(2), remaining.toFixed(2),
        format(new Date(i.dueDate), 'dd/MM/yyyy'),
        i.status
      ];
    })
  );
};
```

- [ ] **Step 6: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/lib/csvExport.ts src/pages/Products.tsx src/pages/Clients.tsx src/pages/Sales.tsx src/pages/CreditNotes.tsx
git commit -m "feat: add CSV export for products, clients, sales, and crediario"
```

---

## Task 6: Custom Date Range Filter

**Files:**
- Modify: `src/pages/Index.tsx` (add custom date range to dashboard)
- Modify: `src/pages/Sales.tsx` (add custom date range to sales)

- [ ] **Step 1: Add date range state to Sales.tsx**

Add state:
```tsx
const [dateFrom, setDateFrom] = useState('');
const [dateTo, setDateTo] = useState('');
```

Add a "custom" option to the period Select:
```tsx
<SelectItem value="custom">Personalizado</SelectItem>
```

When "custom" is selected, show two date inputs:
```tsx
{period === 'custom' && (
  <div className="flex gap-2">
    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
  </div>
)}
```

Update the filter logic:
```ts
case 'custom': {
  if (!dateFrom && !dateTo) return true;
  const d = new Date(s.createdAt);
  if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
  if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
  return true;
}
```

- [ ] **Step 2: Same pattern for Index.tsx**

Add the same custom date range logic to the Dashboard period filter. Apply to `periodSales` filter.

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/Sales.tsx src/pages/Index.tsx
git commit -m "feat: add custom date range filter to dashboard and sales"
```

---

## Task 7: Top Selling Products on Dashboard

**Files:**
- Modify: `src/pages/Index.tsx` (add top products section)

- [ ] **Step 1: Calculate top products from periodSales**

```tsx
const topProducts = useMemo(() => {
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  periodSales.forEach(sale => {
    sale.items.forEach(item => {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.qty += item.quantity;
        existing.revenue += item.total;
      } else {
        productMap.set(item.productId, { name: item.productName, qty: item.quantity, revenue: item.total });
      }
    });
  });
  return Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}, [periodSales]);
```

- [ ] **Step 2: Add Top Products card to dashboard grid**

Add below the existing two-column grid (`lg:grid-cols-2`), or replace one section. Create a Card with title "Mais Vendidos" that lists the top 10 products with rank, name, qty sold, and revenue. Use `Trophy` icon from lucide-react.

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Trophy className="h-5 w-5 text-amber-500" />
      Mais Vendidos ({getPeriodLabel()})
    </CardTitle>
  </CardHeader>
  <CardContent>
    {topProducts.length === 0 ? (
      <p className="text-muted-foreground text-center py-4">Nenhuma venda no periodo</p>
    ) : (
      <div className="space-y-2">
        {topProducts.map((p, idx) => (
          <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-3">
              <span className={cn("text-sm font-bold w-6 text-center",
                idx === 0 ? "text-amber-500" : idx === 1 ? "text-gray-400" : idx === 2 ? "text-amber-700" : "text-muted-foreground"
              )}>{idx + 1}</span>
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.qty} vendido(s)</p>
              </div>
            </div>
            <span className="font-bold text-sm">{formatCurrency(p.revenue)}</span>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>
```

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/Index.tsx
git commit -m "feat: add top selling products report to dashboard"
```

---

## Task 8: Recent/Favorite Clients on POS

**Files:**
- Modify: `src/pages/POS.tsx` (add recent clients quick-select)

- [ ] **Step 1: Calculate recent clients from sales**

After the existing state declarations in POS.tsx, add:
```tsx
const recentClientIds = useMemo(() => {
  const seen = new Map<string, number>();
  [...sales].reverse().forEach(s => {
    if (s.clientId && !seen.has(s.clientId)) {
      seen.set(s.clientId, seen.size);
    }
  });
  return Array.from(seen.entries())
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([id]) => id);
}, [sales]);

const recentClients = recentClientIds
  .map(id => clients.find(c => c.id === id))
  .filter(Boolean) as Client[];
```

- [ ] **Step 2: Add quick-select buttons below ClientCombobox**

Below the `<ClientCombobox>` in POS.tsx, add:
```tsx
{recentClients.length > 0 && !selectedClient && (
  <div className="flex flex-wrap gap-1 mt-1">
    {recentClients.map(c => (
      <Button
        key={c.id}
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-2"
        onClick={() => setSelectedClient(c.id)}
      >
        {c.name.split(' ')[0]}
      </Button>
    ))}
  </div>
)}
```

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/POS.tsx
git commit -m "feat: add recent clients quick-select on POS"
```

---

## Task 9: Discount Presets on POS

**Files:**
- Modify: `src/pages/POS.tsx` (add preset buttons above discount inputs)

- [ ] **Step 1: Load discount presets from settings**

In POS.tsx:
```tsx
import { getStoreSettings } from '@/lib/storeInfo';

// Inside component:
const storeSettings = getStoreSettings();
```

- [ ] **Step 2: Add preset buttons above discount inputs**

Replace the current discount grid with:
```tsx
{/* Discount Presets */}
{storeSettings.discountPresets.length > 0 && (
  <div className="flex flex-wrap gap-1 mb-2">
    {storeSettings.discountPresets.map((preset, idx) => (
      <Button
        key={idx}
        variant={isPercentage && discountValue === preset.percent ? "default" : "outline"}
        size="sm"
        className="h-7 text-xs px-2"
        onClick={() => { setIsPercentage(true); setDiscountValue(preset.percent); }}
      >
        {preset.label}
      </Button>
    ))}
    {discountValue > 0 && (
      <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
        onClick={() => { setDiscountValue(0); }}>
        Limpar
      </Button>
    )}
  </div>
)}
{/* Keep existing Desc. (%) and Desc. (R$) inputs below */}
```

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/POS.tsx
git commit -m "feat: add configurable discount presets to POS checkout"
```

---

## Task 10: Client Tags/Segmentation

**Files:**
- Modify: `src/types/index.ts` (add tags to Client)
- Modify: `src/pages/Clients.tsx` (add tags input + filter)

- [ ] **Step 1: Add `tags` to Client interface**

In `src/types/index.ts`:
```ts
export interface Client {
  // ... existing fields
  tags?: string[]; // Add after 'city'
}
```

- [ ] **Step 2: Add predefined tags and tag input to Clients.tsx**

```tsx
const clientTags = ['Empreiteiro', 'Varejo', 'Cooperado', 'Profissional', 'Atacado', 'VIP'];
```

Add in the client form dialog, after the city input:
```tsx
<div className="space-y-2">
  <Label>Tags</Label>
  <div className="flex flex-wrap gap-1">
    {clientTags.map(tag => {
      const selected = (formData.tags || []).includes(tag);
      return (
        <Button key={tag} variant={selected ? "default" : "outline"} size="sm" className="h-7 text-xs"
          onClick={() => {
            const current = formData.tags || [];
            setFormData({
              ...formData,
              tags: selected ? current.filter(t => t !== tag) : [...current, tag]
            });
          }}
        >
          {tag}
        </Button>
      );
    })}
  </div>
</div>
```

Update `emptyClient` to include `tags: []`.
Update `handleEdit` to include `tags: client.tags || []`.

- [ ] **Step 3: Show tags as badges in client list**

In the client card, after the name:
```tsx
{(client.tags || []).map(tag => (
  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
))}
```

- [ ] **Step 4: Add tag filter**

Add a Select filter above the client list:
```tsx
const [tagFilter, setTagFilter] = useState('');

// Update filteredClients:
const filteredClients = clients.filter(c => {
  const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || ...;
  const matchesTag = !tagFilter || (c.tags || []).includes(tagFilter);
  return matchesSearch && matchesTag;
});
```

- [ ] **Step 5: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/types/index.ts src/pages/Clients.tsx
git commit -m "feat: add client tags/segmentation with predefined categories"
```

---

## Task 11: Purchase History on Client Page

**Files:**
- Modify: `src/pages/Clients.tsx` (add expandable purchase history)

- [ ] **Step 1: Add client detail dialog state**

```tsx
const [detailClient, setDetailClient] = useState<Client | null>(null);
```

- [ ] **Step 2: Create client detail dialog with purchase history**

```tsx
<Dialog open={!!detailClient} onOpenChange={() => setDetailClient(null)}>
  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>{detailClient?.name}</DialogTitle>
    </DialogHeader>
    {detailClient && (() => {
      const clientSales = sales
        .filter(s => s.clientId === detailClient.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const totalSpent = clientSales.filter(s => s.status !== 'refunded').reduce((sum, s) => sum + s.total, 0);
      const saleCount = clientSales.filter(s => s.status !== 'refunded').length;

      return (
        <div className="space-y-4 mt-4">
          {/* Client summary stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{saleCount}</p>
              <p className="text-xs text-muted-foreground">Compras</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Total Gasto</p>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{saleCount > 0 ? formatCurrency(totalSpent / saleCount) : 'R$ 0'}</p>
              <p className="text-xs text-muted-foreground">Ticket Medio</p>
            </div>
          </div>

          {/* Recent purchases list */}
          <div className="space-y-2">
            <p className="font-medium text-sm">Ultimas Compras</p>
            {clientSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma compra registrada</p>
            ) : (
              clientSales.slice(0, 20).map(sale => (
                <div key={sale.id} className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">{format(new Date(sale.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                      <p className="text-sm">{sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                    </div>
                    <span className="font-bold text-sm">{formatCurrency(sale.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    })()}
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Add "Ver" button to client cards**

Add an Eye icon button:
```tsx
import { Eye } from 'lucide-react';
// In client card actions:
<Button variant="ghost" size="icon" onClick={() => setDetailClient(client)}>
  <Eye className="h-4 w-4" />
</Button>
```

- [ ] **Step 4: Add imports for format, date-fns**

```tsx
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';
```

- [ ] **Step 5: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/Clients.tsx
git commit -m "feat: add purchase history dialog on client page"
```

---

## Task 12: Crediario Interest on Overdue Installments

**Files:**
- Modify: `src/pages/CreditNotes.tsx` (calculate and display interest)

- [ ] **Step 1: Add interest calculation logic**

In CreditNotes.tsx, after overdue auto-update useEffect, add interest calculation:

```tsx
import { getStoreSettings } from '@/lib/storeInfo';
import { differenceInDays } from 'date-fns';

const storeSettings = getStoreSettings();
const interestRate = storeSettings.crediarioInterestRate; // % per month

// Helper to calculate interest on an installment
const calculateInterest = (inst: Installment): number => {
  if (interestRate <= 0) return 0;
  if (inst.status !== 'overdue') return 0;
  const daysOverdue = differenceInDays(new Date(), new Date(inst.dueDate));
  if (daysOverdue <= 0) return 0;
  const monthsOverdue = daysOverdue / 30;
  const remaining = inst.amount - inst.amountPaid - (inst.discountApplied || 0);
  return remaining * (interestRate / 100) * monthsOverdue;
};
```

- [ ] **Step 2: Display interest in parcelas tab**

In the installment card, after the remaining amount, show interest if > 0:
```tsx
{(() => {
  const interest = calculateInterest(inst);
  return interest > 0 ? (
    <p className="text-xs text-red-500">Juros: +{formatCurrency(interest)}</p>
  ) : null;
})()}
```

- [ ] **Step 3: Show total with interest in payment dialog**

In the payment dialog, show interest-adjusted total:
```tsx
const interest = calculateInterest(selectedInstallment);
// Show: "Juros acumulados: R$ X.XX" if interest > 0
// Update remaining display: remaining + interest
```

Note: Interest is informational display only - it does not change stored amounts. The store owner decides whether to charge it when receiving payment.

- [ ] **Step 4: Show interest rate info in the settings page tab**

Already covered by Task 2 (Settings page has crediarioInterestRate field).

- [ ] **Step 5: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/CreditNotes.tsx
git commit -m "feat: add interest calculation display for overdue crediario installments"
```

---

## Task 13: Bulk Price Update by Category

**Files:**
- Modify: `src/pages/Products.tsx` (add bulk update dialog)

- [ ] **Step 1: Add bulk update state**

```tsx
const [bulkOpen, setBulkOpen] = useState(false);
const [bulkCategory, setBulkCategory] = useState('');
const [bulkPercent, setBulkPercent] = useState(0);
const [bulkField, setBulkField] = useState<'price' | 'costPrice'>('price');
```

- [ ] **Step 2: Add bulk update dialog**

```tsx
<Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
  <DialogContent className="max-w-sm">
    <DialogHeader>
      <DialogTitle>Ajuste de Precos em Massa</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={bulkCategory} onValueChange={setBulkCategory}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Campo</Label>
        <Select value={bulkField} onValueChange={v => setBulkField(v as 'price' | 'costPrice')}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="price">Preco de Venda</SelectItem>
            <SelectItem value="costPrice">Preco de Custo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Percentual de ajuste (%)</Label>
        <Input type="number" step="0.1" value={bulkPercent}
          onChange={e => setBulkPercent(parseFloat(e.target.value) || 0)}
          onFocus={e => e.target.select()}
          placeholder="Ex: 10 para +10%, -5 para -5%"
        />
        <p className="text-xs text-muted-foreground">
          Positivo = aumento, Negativo = reducao
        </p>
      </div>

      {bulkCategory && bulkPercent !== 0 && (() => {
        const affected = products.filter(p => p.category === bulkCategory);
        return (
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p><strong>{affected.length}</strong> produto(s) serao afetados</p>
            <p className="text-muted-foreground">
              {bulkPercent > 0 ? 'Aumento' : 'Reducao'} de {Math.abs(bulkPercent)}% no {bulkField === 'price' ? 'preco de venda' : 'preco de custo'}
            </p>
          </div>
        );
      })()}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancelar</Button>
        <Button className="flex-1" disabled={!bulkCategory || bulkPercent === 0}
          onClick={() => {
            const factor = 1 + (bulkPercent / 100);
            const now = new Date().toISOString();
            let count = 0;
            setProducts(products.map(p => {
              if (p.category !== bulkCategory) return p;
              count++;
              const newValue = Math.round(p[bulkField] * factor * 100) / 100;
              return { ...p, [bulkField]: Math.max(0, newValue), updatedAt: now };
            }));
            toast.success(`${count} produto(s) atualizados com ${bulkPercent > 0 ? '+' : ''}${bulkPercent}%`);
            setBulkOpen(false);
            setBulkPercent(0);
            setBulkCategory('');
          }}
        >
          Aplicar
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Add trigger button in PageHeader**

Add next to "Novo Produto" and "Exportar":
```tsx
<Button variant="outline" onClick={() => setBulkOpen(true)}>
  <Percent className="h-4 w-4 mr-2" />
  Ajuste em Massa
</Button>
```

- [ ] **Step 4: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/Products.tsx
git commit -m "feat: add bulk price update by category"
```

---

## Task 14: Financial Report - Daily Cash Register

**Files:**
- Create: `src/pages/Reports.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/Layout.tsx` (add nav item)

- [ ] **Step 1: Create `src/pages/Reports.tsx`**

Page with tabs: "Fechamento de Caixa", "Relatorio Mensal", "Recebiveis".

**Fechamento de Caixa tab:**
- Date picker (defaults to today)
- Shows: total sales, total by payment method, total refunds, net total
- Card fee deductions
- Crediario entries received
- Cash register summary (opening balance + cash in - cash out)

**Relatorio Mensal tab:**
- Month/year picker
- Revenue, COGS (sum of costPrice * qty), Gross Profit, Margin %
- Sales count, average ticket
- Top 5 products
- Top 5 clients

**Recebiveis tab:**
- Aging buckets: 0-30 dias, 31-60 dias, 61-90 dias, 90+ dias
- Group overdue installments by client
- Total pending per bucket
- Color-coded severity

All data computed from sales[], installments[], creditPayments[] via useLocalStorage.

- [ ] **Step 2: Add route and nav item**

```tsx
// App.tsx
import Reports from "./pages/Reports";
<Route path="/reports" element={<Reports />} />

// Layout.tsx - add to navItems:
import { BarChart3 } from 'lucide-react';
{ path: '/reports', label: 'Relatorios', icon: BarChart3 },
```

- [ ] **Step 3: Verify build and commit**

```bash
npx tsc --noEmit && npx vite build
git add src/pages/Reports.tsx src/App.tsx src/components/Layout.tsx
git commit -m "feat: add financial reports page with daily cash register, monthly report, and receivables aging"
```

---

## Execution Order Summary

| Task | Feature | Dependencies |
|------|---------|-------------|
| 1 | Extract shared utilities | None |
| 2 | Settings page | Task 1 |
| 3 | CPF/CNPJ validation | None |
| 4 | Barcode field | None |
| 5 | CSV export | Task 1 |
| 6 | Custom date range | None |
| 7 | Top selling products | Task 1, 6 |
| 8 | Recent clients on POS | None |
| 9 | Discount presets on POS | Task 2 |
| 10 | Client tags | None |
| 11 | Purchase history on client | Task 1 |
| 12 | Crediario interest | Task 2 |
| 13 | Bulk price update | None |
| 14 | Financial reports | Task 1, 2 |

**Recommended execution order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
