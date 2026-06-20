# Phase 5: Venda Fracionada - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisão "conforme a unidade" já tomada; correção majoritariamente mecânica

<domain>
## Phase Boundary

Permitir quantidade fracionada (decimal) na venda e no orçamento, conforme a unidade do produto, com cálculo automático de total e baixa de estoque decimal. Toca `src/pages/POS.tsx`, `src/pages/Quotes.tsx`, `src/pages/Products.tsx`.

- FRAC-01: no PDV é possível informar quantidade decimal (ex.: 1,5) para produtos de medida (mt, kg, lt, m²), com passo apropriado por unidade.
- FRAC-02: total do item e da venda calculado automaticamente a partir da quantidade fracionada e preço unitário, com arredondamento correto (roundCurrency).
- FRAC-03: baixa de estoque respeita a quantidade fracionada; cadastro de produto preserva estoque decimal (corrige `parseInt` em Products.tsx).
- FRAC-04: orçamento (Quotes.tsx) também aceita quantidade fracionada para produtos de medida.

Fora de escopo: fiscal (Fase 6); regras de devolução/crediário (já feitas).

</domain>

<decisions>
## Implementation Decisions

### Conforme a unidade (decisão do usuário)
- Unidades de medida que aceitam decimais: `mt` (metro), `kg`, `lt` (litro), `m2`/`m²`. Unidades discretas (`un`, `cx`, `pc`, etc.) permanecem inteiras.
- Determinar o conjunto de unidades fracionáveis a partir do campo `unit` do produto (ver as unidades realmente existentes no cadastro/`types`); centralizar essa lógica em um helper reutilizável (ex.: `isFractionalUnit(unit)` e `quantityStep(unit)` em `src/lib/`), consumido por POS, Quotes e Products, para evitar divergência.
- Passo (step) do input e dos botões +/-: fracionável → 0.1 (ou 0.5 conforme a unidade, Claude's Discretion); discreto → 1.

### Entrada e parsing
- Substituir `parseInt` por `parseFloat` nos handlers de quantidade do carrinho (`POS.tsx`: input onChange, `updateItemQuantity`, e botões +/- `updateQuantity`) e no orçamento (`Quotes.tsx`), e no campo de estoque do cadastro (`Products.tsx`: `parseInt(e.target.value) || 0` → `parseFloat(... ) || 0`).
- Inputs numéricos de quantidade/estoque recebem `step` derivado da unidade e `min` adequado; aceitar vírgula/ponto conforme o padrão já usado (normalizar se necessário).
- Para unidades discretas, manter comportamento inteiro (não permitir 1,5 un) — validar/arredondar conforme a unidade.

### Cálculo e estoque
- Total do item = `roundCurrency(quantity * unitPrice)`; total da venda recalculado com `roundCurrency` (reusar helper da Fase 1).
- Baixa de estoque em `finalizeSale` aplica a quantidade decimal; preservar a regra de unidade `mil` já existente (price/cost ÷ 1000) sem conflito com fração.
- Exibição de quantidade fracionada formatada de forma legível (ex.: "1,5 mt"); preço unitário continua via `formatCurrency`.

### Claude's Discretion
- Step exato por unidade (0.1 vs 0.5) e número de casas decimais exibidas, desde que o cálculo use precisão e `roundCurrency` no dinheiro.
- Local exato e assinatura dos helpers `isFractionalUnit`/`quantityStep`.
- Como tratar/normalizar vírgula decimal no input dado o locale pt-BR (sem quebrar o parsing).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/POS.tsx` — carrinho: `addToCart`, `updateQuantity` (+/-, ~194-220), `updateItemQuantity` (~222-244, `parseInt`), input de quantidade (~656-659, `parseInt`), `finalizeSale` baixa de estoque (~404-413, regra `mil`).
- `src/pages/Quotes.tsx` — quantidade (~310-313, `parseInt`), busca de produto (~241), total do item.
- `src/pages/Products.tsx` — campo de estoque (~324, `parseInt(e.target.value) || 0`).
- `src/lib/formatters.ts` — `formatCurrency`, `roundCurrency` (Fase 1) — usar para totais.
- `src/types/index.ts` — `Product.unit`, `Product.stock` (number), `SaleItem.quantity` (number).

### Established Patterns
- Mutações via `useLocalStorage`; inputs shadcn `<Input type="number">`; `toast`.
- Regra `unit === 'mil'`: price/cost ÷ 1000 e baixa de estoque ÷ 1000 (não confundir com fração — `mil` é venda por milheiro).

### Integration Points
- Novo helper em `src/lib/` (isFractionalUnit/quantityStep); `POS.tsx`, `Quotes.tsx`, `Products.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Pedido (verbatim): "vender 1,5 metro de areia, 2,5 metros de brita... O sistema deve calcular automaticamente o valor total com base na quantidade informada e no preço unitário do produto." → FRAC-01/02.
- CONCERNS.md BUG-5: `parseInt` no input do carrinho (POS.tsx 656), updateItemQuantity (222), updateQuantity (+1/-1, 194); e Products.tsx stock `parseInt` (324). Corrigir todos.
- Não permitir fração em `un`/`cx` (evitar 1,5 unidades).

</specifics>

<deferred>
## Deferred Ideas

- Layout fiscal — Fase 6.
- Configuração de fração por produto (flag individual) — não escolhida; a decisão é "conforme a unidade".

</deferred>
