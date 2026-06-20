# Phase 1: Fundação e PDF - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisions pre-locked by research; no open product grey areas

<domain>
## Phase Boundary

Entregar os blocos de construção compartilhados que destravam as fases seguintes e corrigir os PDFs existentes para não cortar conteúdo:
- Helper de arredondamento de moeda reutilizável (FND-01)
- Módulo único de devolução `src/lib/processReturn.ts` consolidando a lógica hoje duplicada em `Sales.tsx` e `Returns.tsx` (FND-02)
- Ajustes de tipos para suportar parcelas canceladas e quantidade fracionada, de forma retrocompatível (FND-03)
- PDFs de venda e orçamento com altura dinâmica (PDF-01, PDF-02)

Fora do escopo desta fase: a correção da lógica financeira do estorno/devolução em si (Fase 3/4), a UI de fração (Fase 5) e o layout fiscal (Fase 6). Esta fase apenas cria as fundações e corrige os PDFs.

</domain>

<decisions>
## Implementation Decisions

### Arredondamento de moeda (FND-01)
- Adicionar `roundCurrency(v: number): number => Math.round(v * 100) / 100` em `src/lib/formatters.ts` (mesmo padrão já usado em `cardFees.ts:62`).
- Não introduzir dependências (sem Decimal.js).
- Aplicar `roundCurrency` nos limites de cálculo já existentes que produzem valores monetários (geração de parcelas, totais de item/carrinho) sem alterar o comportamento visível além de corrigir centavos.
- Para divisão de parcelas, a última parcela absorve o resíduo para que a soma feche exatamente com o total financiado.

### Extração da lógica de devolução (FND-02)
- Criar `src/lib/processReturn.ts` como função pura que recebe os dados necessários (venda, itens devolvidos, registros existentes, modo) e retorna as mutações a aplicar (novo `ReturnRecord`, atualizações de estoque, parcelas a cancelar, haver a gerar) — sem efeitos colaterais de storage.
- Esta fase apenas EXTRAI e unifica o comportamento atual sem mudar regras financeiras (paridade comportamental). Fases 3 e 4 ajustam as regras (haver capping, cancelamento de parcelas, modalidades) sobre essa base.
- `Sales.tsx` e `Returns.tsx` passam a consumir `processReturn.ts`. O PDV passará a consumir na Fase 4.

### Mudanças de tipos (FND-03)
- `ReturnRecord`: adicionar `cancelledInstallmentIds?: string[]` (opcional, retrocompatível).
- `SaleItem`/quantidade: garantir que `quantity` seja `number` decimal (já é `number`); nenhuma migração de dados necessária. A UI de fração vem na Fase 5.
- Qualquer campo novo é opcional para não quebrar dados já gravados no `electron-store`.

### Correção dos PDFs (PDF-01, PDF-02)
- Pré-calcular a altura da página antes de instanciar o jsPDF, espelhando o padrão já correto de `generateCrediarioStatement` (`src/lib/generateCrediarioReceipt.ts:20-29`).
- `generateReceipt` (`src/lib/generateReceipt.ts`): altura ≈ base + 8mm por item (substituir `format: [80, 250]` fixo).
- `generateQuotePDF` (`src/lib/generateQuote.ts`): altura ≈ base + 8mm por item (substituir `format: [80, 200]` fixo).
- Garantir que bloco de totais, descontos e forma de pagamento sempre caibam após o loop de itens.

### Claude's Discretion
- Assinatura exata e shape de retorno de `processReturn.ts`, contanto que seja função pura e cubra os dois call sites atuais com paridade comportamental.
- Constantes exatas de base/by-item das alturas de PDF, desde que validadas com casos de muitos itens (30 itens venda, 25 itens orçamento).
- Onde aplicar `roundCurrency` além dos pontos citados, sem mudar comportamento visível.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/formatters.ts` — `formatCurrency` (pt-BR BRL); destino do `roundCurrency`.
- `src/lib/cardFees.ts:62` — já usa `Math.round(v*100)/100`; padrão a reaproveitar.
- `src/lib/generateCrediarioReceipt.ts:20-29` — padrão correto de altura dinâmica para PDFs.
- `src/pages/Sales.tsx` `handleReturnFromSale` (233-306) e `src/pages/Returns.tsx` `handleReturn` (122-210) — lógica de devolução duplicada a unificar.
- `src/pages/Sales.tsx:200` `getReturnedQuantities()` — helper de quantidades já devolvidas (relevante para Fase 3).

### Established Patterns
- Lógica de negócio inline nas páginas; `src/lib/` contém funções puras e geração de PDF.
- Persistência via `useLocalStorage` (IPC electron-store), escritas como substituição completa do array.
- Tipos compartilhados em `src/types/index.ts`.

### Integration Points
- `src/types/index.ts` — `ReturnRecord`, `SaleItem`.
- Geradores de PDF em `src/lib/generateReceipt.ts`, `src/lib/generateQuote.ts`.

</code_context>

<specifics>
## Specific Ideas

- Validar a correção do PDF com volume real: cupom de venda com ~30 itens e orçamento com ~25 itens devem exibir total/desconto/pagamento sem corte.
- Manter paridade comportamental ao extrair `processReturn.ts` — esta fase não deve alterar valores de haver nem cancelar parcelas (isso é Fase 3/4).

</specifics>

<deferred>
## Deferred Ideas

- Escritas transacionais/atômicas no electron-store (v2 — OPS2-02).
- Testes automatizados da lógica financeira (v2 — OPS2-04).

</deferred>
