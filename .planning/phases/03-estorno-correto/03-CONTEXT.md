# Phase 3: Estorno Correto - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisions locked in PROJECT.md + FINANCIAL-PITFALLS research

<domain>
## Phase Boundary

Corrigir o efeito financeiro do estorno (refund) de venda no crediário, em `src/pages/Sales.tsx` (`handleRefund`) e reusando o módulo `src/lib/processReturn.ts` quando fizer sentido:
- EST-01: estorno de crediário sem nenhum pagamento NÃO gera haver — apenas cancela a dívida.
- EST-02: ao estornar (ou devolver totalmente) uma venda de crediário, cancelar automaticamente todas as parcelas em aberto/vencidas vinculadas à venda.
- EST-03: ao estornar venda de crediário com valor já pago (entrada e/ou parcelas), perguntar ao operador: gerar haver pelo valor pago OU devolver em dinheiro (saída de caixa).
- EST-04: estorno não restaura estoque em dobro quando a venda já teve devolução parcial anterior.

Fora de escopo: a devolução pelo PDV e as modalidades de devolução (Fase 4), fração (Fase 5), fiscal (Fase 6).

</domain>

<decisions>
## Implementation Decisions

### EST-01 — Haver apenas sobre valor pago
- Calcular o valor efetivamente pago da venda de crediário a partir de `sum(installments.amountPaid)` (entrada `number:0` inclusa) e/ou `sale.crediarioPaid`. Se for 0 → haver = 0; apenas cancela a dívida e marca a venda como `refunded`.
- Para vendas NÃO crediário (dinheiro/cartão/pix), o comportamento de estorno permanece como hoje (o valor pago = total da venda).

### EST-02 — Cancelamento automático de parcelas
- No estorno, cancelar todas as parcelas da venda com status `open` ou `overdue` (status → `cancelled`). NUNCA alterar parcelas `paid` (preserva histórico de pagamentos) nem recancelar `cancelled`.
- Registrar os ids das parcelas canceladas para auditoria/reversibilidade (campo `cancelledInstallmentIds` já existe em `ReturnRecord` desde a Fase 1; para o estorno, registrar de forma equivalente onde fizer sentido — ver Claude's Discretion).
- A entrada (`number: 0`, sempre `paid`) não é cancelada; seu valor pago entra no cálculo do haver/dinheiro (EST-03).

### EST-03 — Perguntar haver vs dinheiro quando houver valor pago
- Quando o valor efetivamente pago (> 0) for estornado, abrir um diálogo perguntando ao operador: (a) gerar haver (crédito) pelo valor pago, ou (b) devolver em dinheiro (registrar saída de caixa).
- Opção (a): incrementa `client.storeCredit` em `roundCurrency(valorPago)`.
- Opção (b): NÃO incrementa `storeCredit`; registra uma saída de caixa de `roundCurrency(valorPago)` de forma que o relatório de fechamento de caixa (`Reports.tsx`) possa refletir (ver Claude's Discretion sobre como registrar a saída — reaproveitar estruturas existentes, ex.: um registro de movimento/`CreditPayment` negativo ou um campo no `Sale`/novo registro mínimo, sem quebrar dados).
- Exige cliente quando gera haver (haver pertence a um cliente). Se a venda não tem cliente, a opção haver não se aplica — só dinheiro.

### EST-04 — Sem restauração de estoque em dobro
- Antes de restaurar o estoque no estorno, subtrair as quantidades já devolvidas via registros de `returns` ativos (não revertidos) para a venda, usando o helper `getReturnedQuantities()` (`src/pages/Sales.tsx:200`) ou equivalente.
- Respeitar a regra de unidade `mil` (dividir por 1000) na restauração, consistente com `processReturn`/POS.

### Claude's Discretion
- Como exatamente registrar a "saída de caixa" do EST-03(b) reaproveitando estruturas existentes, desde que: não gere haver, seja auditável, e o fechamento de caixa consiga distinguir. Preferir o mínimo de mudança de tipos (campos opcionais retrocompatíveis).
- Onde persistir os ids de parcelas canceladas no estorno (no `Sale`, em um `ReturnRecord` sintético, ou campo novo opcional), mantendo retrocompatibilidade.
- Texto e componente do diálogo (reusar AlertDialog/Dialog já usados em Sales.tsx).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/Sales.tsx` — `handleRefund` (~114-163): restaura estoque, cancela parcelas (crediário), adiciona haver quando havia pagamento. `getReturnedQuantities()` (~200). `canRefund()`/`canReturn()` (~309-315). Diálogo de estorno (~626-682).
- `src/lib/processReturn.ts` — módulo puro de devolução (Fase 1). Pode ser estendido/espelhado para a lógica de parcelas/haver capping, mas o ESTORNO é caminho próprio (full reversal) — manter coeso.
- `src/lib/formatters.ts` — `roundCurrency`, `formatCurrency`.
- `src/lib/installmentStatus.ts` — `getEffectiveStatus` (Fase 2) para identificar open/overdue.
- `src/types/index.ts` — `Sale` (status completed|refunded|crediario_pending|crediario_paid), `Installment` (status, amountPaid, number), `ReturnRecord.cancelledInstallmentIds?`, `CreditPayment`, `Client.storeCredit`.
- `src/pages/Reports.tsx` — fechamento de caixa (consome pagamentos por método) — alvo para refletir a saída de caixa do EST-03(b).

### Established Patterns
- Mutações como substituição completa de arrays via `useLocalStorage`; `toast` (sonner); diálogos shadcn (AlertDialog/Dialog).
- Datas ISO; `roundCurrency` para moeda.

### Integration Points
- `Sales.tsx` (handleRefund + diálogo), `src/types/index.ts` (campos opcionais novos se necessário), possivelmente `Reports.tsx` (refletir saída de caixa).

</code_context>

<specifics>
## Specific Ideas

- Pedido do cliente (verbatim): "ao estornar uma venda, o sistema gera crédito (haver) para o cliente, mesmo quando ele ainda não efetuou nenhum pagamento. Nesses casos, o sistema não deveria gerar crédito, apenas cancelar a dívida." → EST-01.
- "as parcelas continuam pendentes para pagamento. Corrigir para que as parcelas vinculadas à venda sejam canceladas automaticamente no estorno." → EST-02.
- CR-02 do review da Fase 1 (double restock no estorno após devolução parcial) é exatamente o EST-04 — corrigir aqui.

</specifics>

<deferred>
## Deferred Ideas

- Devolução pelo PDV + modalidades haver/abatimento — Fase 4.
- Reversão de estorno (re-criar parcelas) — não solicitado; manter estorno como ação final (mas registrar ids para auditoria).

</deferred>
