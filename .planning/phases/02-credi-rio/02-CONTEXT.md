# Phase 2: Crediário - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — enhances existing CreditNotes.tsx; decisions derived from explicit requirements + research

<domain>
## Phase Boundary

Melhorar a visibilidade e a operação do crediário na tela existente (`src/pages/CreditNotes.tsx`), sem alterar a lógica de estorno/devolução (Fases 3/4):
- CRED-01: exibir, por cliente e por venda, total devido, total pago, saldo em aberto e situação de cada parcela (em aberto/vencida/paga/cancelada).
- CRED-02: identificar parcelas vencidas de forma confiável (não só ao montar a tela uma vez).
- CRED-03: permitir cobrar juros de parcelas vencidas de forma explícita ao registrar o pagamento.

Fora de escopo: mudanças nas regras de haver/estorno/devolução, layout fiscal, fração.

</domain>

<decisions>
## Implementation Decisions

### CRED-01 — Visibilidade de saldo e parcelas
- Agrupar a visão do crediário por cliente e, dentro do cliente, por venda, mostrando: total devido (soma das parcelas não canceladas), total pago (soma de amountPaid + descontos), saldo em aberto, e a contagem/situação por status (open/overdue/paid/cancelled).
- Refletir corretamente parcelas `cancelled` (não somar ao saldo nem ao devido).
- Seguir os componentes/estilo já usados em `CreditNotes.tsx` (cards, badges de status, `formatCurrency`). Não criar novo design system.

### CRED-02 — Detecção de vencidas confiável
- Calcular o status "vencida" de forma derivada na renderização (compara `dueDate` < hoje para parcelas `open`), em vez de depender apenas do `useEffect` de mount único.
- Manter a persistência de status existente, mas não confiar nela para exibição: a exibição usa cálculo on-the-fly para que parcelas que vencem com o app aberto apareçam como vencidas sem recarregar a página.
- Onde o status persistido for usado por outras telas (ex.: bloqueio de novas vendas no POS), garantir consistência via um helper compartilhado de cálculo de overdue (ex.: em `src/lib/` ou utilitário existente) reutilizável.

### CRED-03 — Cobrança explícita de juros
- No diálogo de pagamento de uma parcela vencida, exibir os juros calculados (a partir de `StoreSettings.crediarioInterestRate`, meses em atraso × saldo) e oferecer uma ação explícita "cobrar juros" que pré-preenche o valor do pagamento com `saldo + juros` (usando `roundCurrency`).
- Quando o operador cobrar juros, registrar isso no histórico (`CreditPayment`) de forma auditável — incluir o componente de juros (ex.: campo/observação ou um registro de tipo apropriado), sem quebrar dados existentes.
- Não tornar a cobrança de juros automática/silenciosa: é sempre uma escolha explícita do operador (conforme requisito).

### Claude's Discretion
- Forma exata de exibir o resumo (card por cliente, seção expansível por venda, tabela) desde que mostre devido/pago/saldo/status com clareza e siga o estilo atual.
- Como registrar o componente de juros no `CreditPayment` (campo opcional novo vs. observação no registro), mantendo retrocompatibilidade.
- Onde colocar o helper compartilhado de overdue.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/CreditNotes.tsx` — tela principal do crediário: lista de parcelas, `openPaymentDialog`, `handlePayment` (~176), `handleApplyDiscount`, `calculateInterest` (~79-87, display-only), `useEffect` de overdue (~61-74, mount único).
- `src/lib/formatters.ts` — `formatCurrency`, `roundCurrency` (novo na Fase 1).
- `src/types/index.ts` — `Installment` (status open|paid|overdue|cancelled), `CreditPayment` (type payment|discount), `Sale.crediarioPaid`.
- `src/types/settings.ts` — `crediarioInterestRate` (mensal, %).
- `src/pages/POS.tsx` (~132-140) — usa status de parcelas para bloquear novas vendas a inadimplentes (consumidor do cálculo de overdue).

### Established Patterns
- Lógica inline nas páginas; `useLocalStorage` para persistência; badges de status com shadcn; `toast` (sonner) para feedback.
- Datas em ISO; `date-fns` ptBR; `addMonths` para vencimentos.

### Integration Points
- `CreditNotes.tsx` (UI + handlers), `src/types/index.ts` (CreditPayment/Installment), possível novo helper em `src/lib/`.

</code_context>

<specifics>
## Specific Ideas

- A exibição de "vencida" deve ser correta mesmo com o app aberto por dias (loja deixa o PDV ligado) — daí o cálculo on-the-fly (CONCERNS.md: overdue só atualiza no mount).
- Juros nunca devem ser cobrados sem ação explícita do operador; o valor mostrado hoje é apenas informativo e o operador tinha que digitar manualmente — isso deve virar um botão que pré-preenche.

</specifics>

<deferred>
## Deferred Ideas

- Juros compostos / regras fiscais de juros — fora de escopo (mantém o cálculo simples atual).
- Mudanças em estorno/devolução do crediário — Fases 3 e 4.

</deferred>
