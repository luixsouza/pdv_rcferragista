---
phase: 03-estorno-correto
verified: 2026-06-20T18:30:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Estorno fluxo completo — diálogo haver/dinheiro"
    expected: "Ao estornar venda crediário com valor pago, o diálogo aparece com valor correto e ambos os botões funcionam; 'Gerar Haver' fica desabilitado quando a venda não tem cliente"
    why_human: "Comportamento de UI interativo (AlertDialog aberto/fechado, disabled prop) e mutação de estado em tela não verificáveis via grep estático"
  - test: "Cenário E4 — crediário totalmente pago (crediario_paid): paidAmount reflete soma de todas as parcelas"
    expected: "O diálogo exibe o total pago correto = soma de installment.amountPaid para todas as parcelas (incluindo entrada número:0)"
    why_human: "Requer dados de parcelas reais no electron-store e interação com o fluxo de UI"
  - test: "Cenário I3 — estorno após devolução parcial não restaura estoque em dobro"
    expected: "Após devolução parcial de itens seguida de estorno da venda, o estoque aumenta apenas pela quantidade não devolvida"
    why_human: "Requer estado persisitido no electron-store com ReturnRecord existente e verificação do estoque resultante"
---

# Phase 03: Estorno Correto — Verification Report

**Phase Goal:** Estornar uma venda de crediário produz exatamente o efeito financeiro correto — sem gerar haver por dinheiro não recebido, sem parcelas fantasmas e sem restaurar estoque já devolvido.
**Verified:** 2026-06-20T18:30:00Z
**Status:** passed (with human verification items)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | EST-01: zero-paid crediário estorno gera haver = 0, apenas cancela dívida | VERIFIED | `processRefund.ts` L75-95: `paidAmount = roundCurrency(crediarioPaid + otherPaid)` = 0 when both zero. `Sales.tsx` L149-152: zero-paid path calls `finalizeRefund(..., 'none')` — no storeCredit, no cashRefundOut set. |
| 2 | EST-02: estorno cancela apenas parcelas open/overdue via getEffectiveStatus; cancelledInstallmentIds persisted na Sale | VERIFIED | `processRefund.ts` L100-105: filtro usa `getEffectiveStatus(i) === 'open' \| 'overdue'`; importa de `@/lib/installmentStatus`. `Sales.tsx` L136-140: usa `cancelledInstallmentIds.includes(inst.id)` — nunca toca pagas. Persiste em todos os 3 modos de `finalizeRefund` (L175-178, L188-192, L208-211). |
| 3 | EST-03: paid>0 → diálogo; haver += roundCurrency(paidAmount) só com cliente; cash → cashRefundOut, sem storeCredit; paidAmount inclui crediarioPaid + otherPaid | VERIFIED | `Sales.tsx` L143-145: `setPendingRefund` quando `isCrediarioSale && paidAmount > 0`. L167-174: haver: `storeCredit += roundCurrency(paid)` com guard `sale.clientId`. L186-205: cash: `cashRefundOut = paid` sem tocar storeCredit. L758: `disabled={!pendingRefund?.sale.clientId}`. L732-735: hint mostra `otherPaid` quando `> 0`. |
| 4 | EST-04: stock restore subtrai quantidades já devolvidas (getReturnedQuantities) e respeita mil /1000 | VERIFIED | `processRefund.ts` L110-120: `alreadyReturned = alreadyReturnedQtys[id] \|\| 0`; `qtyToRestore = qty - alreadyReturned`; skip se `<= 0`; `restock = unit === 'mil' ? qty/1000 : qty`. `Sales.tsx` L129-130: passa `alreadyReturnedQtys: getReturnedQuantities(sale.id)`. L133: `setProducts(result.updatedProducts)`. |
| 5 | Reports.tsx exibe "Saída de Caixa (Estorno em Dinheiro)" (soma cashRefundOut) separado do total Estornos | VERIFIED | `Reports.tsx` L72: `cashRefundOut = dayRefunds.reduce((sum, s) => sum + (s.cashRefundOut \|\| 0), 0)`. L257-262: renderiza linha vermelha condicional "Saída de Caixa (Estorno em Dinheiro)" dentro do card Formas de Pagamento. L231-235: Estornos card usa `totalRefunds` (soma de `s.total`) — inalterado. Distinção clara entre valor contábil (Estornos) e cash real saído (Saída de Caixa). |
| 6 | `npm run build` exits 0 | VERIFIED | Build saiu limpo: "built in 11.39s". Único aviso é chunk size (>500kB) — warning não-fatal, não é erro TypeScript nem de compilação. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/processRefund.ts` | Pure refund-computation function (ProcessRefundInput/Result, exporta `processRefund`) | VERIFIED | 131 linhas; exporta `processRefund`, `ProcessRefundInput`, `ProcessRefundResult`; sem hooks/storage (useState, useLocalStorage, window.electron ausentes); importa `roundCurrency` e `getEffectiveStatus`. |
| `src/types/index.ts` | Sale.cashRefundOut? e Sale.cancelledInstallmentIds? opcionais | VERIFIED | L62-65: `cashRefundOut?: number` e `cancelledInstallmentIds?: string[]` na interface `Sale` após `crediarioPaid?`. Ambos opcionais e aditivos. `ReturnRecord.cancelledInstallmentIds?` preexistente em L116 inalterado. |
| `src/pages/Sales.tsx` | handleRefund delegando a processRefund; diálogo haver/cash; cancelledInstallmentIds persistido | VERIFIED | L44-45: importa `processRefund` e `ProcessRefundResult`. L120-153: `handleRefund` chama `processRefund`, aplica produtos/parcelas, decide fluxo. L164-220: `finalizeRefund` com 3 modos mutuamente exclusivos. L719-765: AlertDialog `pendingRefund` com botões Haver (client-gated) e Dinheiro. |
| `src/pages/Reports.tsx` | cashRefundOut computado e renderizado separado dos Estornos | VERIFIED | L72: reduce com `\|\| 0` guard. L257-262: linha condicional renderizada apenas quando `> 0`. L231-235: Estornos card com `totalRefunds` intacto. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/processRefund.ts` | `src/lib/formatters.ts` | `import roundCurrency` | WIRED | L2: `import { roundCurrency } from '@/lib/formatters'` — usado em L75, L83, L94. |
| `src/lib/processRefund.ts` | `src/lib/installmentStatus.ts` | `import getEffectiveStatus` | WIRED | L3: `import { getEffectiveStatus } from '@/lib/installmentStatus'` — usado em L102. |
| `src/pages/Sales.tsx` | `src/lib/processRefund.ts` | `import + call in handleRefund` | WIRED | L44: import. L125-130: chamada em `handleRefund`. |
| `src/pages/Sales.tsx` | `client.storeCredit` | `haver path increments storeCredit` | WIRED | L169-173: `{ ...c, storeCredit: roundCurrency((c.storeCredit \|\| 0) + paid) }` dentro do guard `mode === 'haver' && sale.clientId`. |
| `src/pages/Sales.tsx` | `Sale.cancelledInstallmentIds` | `finalizeRefund persists em todos os modos` | WIRED | L177, L191, L210: todos os 3 paths do `setSales` incluem `cancelledInstallmentIds: result.cancelledInstallmentIds`. |
| `src/pages/Reports.tsx` | `Sale.cashRefundOut` | `sum cashRefundOut across day refunded sales` | WIRED | L72: `dayRefunds.reduce((sum, s) => sum + (s.cashRefundOut \|\| 0), 0)`. Renderizado L259. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Sales.tsx` | `result.paidAmount` | `processRefund` → `installments.amountPaid` sum | Sim — soma de dados reais de parcelas | FLOWING |
| `Sales.tsx` | `result.cancelledInstallmentIds` | `processRefund` → `getEffectiveStatus` filter | Sim — derivado de estado real de parcelas | FLOWING |
| `Sales.tsx` | `client.storeCredit` | `setClients` update em tempo real | Sim — mutação do array de clientes via useLocalStorage | FLOWING |
| `Reports.tsx` | `cashReport.cashRefundOut` | `dayRefunds.reduce` → `s.cashRefundOut` | Sim — lê campo opcional gravado no Sale pelo finalizeRefund | FLOWING |
| `Reports.tsx` | `cashReport.totalRefunds` | `dayRefunds.reduce` → `s.total` | Sim — campo existente de Sale, nunca stale | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| processRefund purity — sem hooks/storage | `grep -c 'useLocalStorage\|window.electron\|useState' src/lib/processRefund.ts` | 0 matches | PASS |
| processRefund exporta função e interfaces | `grep -c 'export function processRefund\|ProcessRefundInput\|ProcessRefundResult' src/lib/processRefund.ts` | 3 matches | PASS |
| cancelledInstallmentIds usa includes (não blanket map) | `grep 'cancelledInstallmentIds.includes' src/pages/Sales.tsx` | 1 match (L137) | PASS |
| Haver nunca setado no path cash/none | `grep -A3 "mode === 'cash'" src/pages/Sales.tsx` — storeCredit ausente no bloco cash | storeCredit não aparece no bloco cash/none | PASS |
| cashRefundOut não setado no path haver | L175-178 do setSales no haver mode: apenas `status` e `cancelledInstallmentIds` | campo ausente | PASS |
| npm run build | `npm run build` | exit 0, "built in 11.39s" | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| EST-01 | 03-01, 03-02 | Zero-paid crediário estorno não gera haver | SATISFIED | `finalizeRefund(..., 'none')` path; `paidAmount = 0` quando crediarioPaid + otherPaid = 0 |
| EST-02 | 03-01, 03-02 | Só parcelas open/overdue canceladas; cancelledInstallmentIds na Sale | SATISFIED | `getEffectiveStatus` filter em `processRefund.ts`; persisted nos 3 modos de `finalizeRefund` |
| EST-03 | 03-02 | paid>0 → diálogo haver/cash; haver requer cliente; cash = cashRefundOut | SATISFIED | AlertDialog `pendingRefund`; haver `disabled={!clientId}`; mutually exclusive branches em `finalizeRefund` |
| EST-04 | 03-01, 03-02 | Sem double restock; mil /1000 | SATISFIED | `alreadyReturnedQtys` subtraction em `processRefund.ts`; `/ 1000` para unit === 'mil' |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/Sales.tsx` | 695 | Acento faltando: `'Esta acao nao pode ser desfeita.'` | Info | Cosmético — texto do diálogo de confirmação sem acentuação em português; não afeta lógica financeira. |
| `src/pages/Sales.tsx` | 688 | Acento faltando: `'ja pago'`, `'voce escolhera'` | Info | Cosmético — texto informativo no diálogo de confirmação. |

Sem BLOCKER nem WARNING. Os dois itens são puramente estéticos (encoding de texto em português no JSX) sem impacto na lógica financeira.

### Human Verification Required

#### 1. Fluxo completo — diálogo Haver vs Dinheiro

**Test:** Criar uma venda de crediário com parcelas parcialmente pagas; executar estorno; verificar que o AlertDialog de escolha aparece com o valor correto, que "Gerar Haver" aparece desabilitado quando a venda não tem cliente, e que cada escolha produz o efeito esperado (haver em storeCredit / cashRefundOut na venda).
**Expected:** O diálogo exibe `paidAmount` correto; botão Haver desabilitado sem cliente; ao escolher Haver o storeCredit do cliente sobe em `roundCurrency(paidAmount)`; ao escolher Dinheiro o campo `cashRefundOut` é gravado na Sale e aparece no fechamento de caixa do dia.
**Why human:** Comportamento interativo de AlertDialog, mutação de estado React/electron-store e verificação visual das telas Reports/Sales não verificáveis via análise estática.

#### 2. Cenário E4 — crediário totalmente pago

**Test:** Criar venda crediário com todas as parcelas pagas (status `crediario_paid`); estornar; verificar o paidAmount no diálogo.
**Expected:** `paidAmount` = soma de `installment.amountPaid` de todas as parcelas (incluindo entrada número:0) — nunca zero mesmo com status `crediario_paid`.
**Why human:** Requer dados reais no electron-store com parcelas marcadas `paid`; verificação numérica do valor exibido no diálogo.

#### 3. Cenário I3 — sem double restock após devolução parcial

**Test:** Criar venda com 10 unidades de um produto; executar devolução parcial de 4 unidades; estornar a venda; verificar o estoque resultante do produto.
**Expected:** Estoque sobe em 6 (não em 10) — apenas a quantidade não devolvida.
**Why human:** Requer estado persistido com ReturnRecord no electron-store; verificação do estoque resultante na tela de produtos.

### Gaps Summary

Nenhuma lacuna encontrada. Todos os 6 must-haves verificados contra o código real. A lógica financeira central (`processRefund.ts`) é pura, testável em isolamento e implementa corretamente todas as regras EST-01 a EST-04. A wiring em `Sales.tsx` e `Reports.tsx` conecta corretamente os artefatos com os efeitos financeiros esperados.

Os 3 itens de verificação humana são testes de integração/fluxo de UI que não podem ser confirmados via análise estática — não representam gaps de implementação, mas sim validação comportamental em runtime.

---

_Verified: 2026-06-20T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
