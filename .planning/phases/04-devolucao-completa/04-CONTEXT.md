# Phase 4: Devolução Completa - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisions locked in PROJECT.md + research; builds on Fases 1/3

<domain>
## Phase Boundary

Completar a devolução: torná-la acessível pelo PDV, suportar vendas sem cliente, permitir cadastrar cliente no ato, oferecer duas modalidades (haver vs abatimento de débito), cobrir `crediario_pending` na página dedicada, e deixar a reversão de devolução consistente. Toca `src/pages/POS.tsx`, `src/pages/Returns.tsx`, `src/pages/Sales.tsx` e o módulo `src/lib/processReturn.ts` (Fase 1).

- DEV-01: iniciar devolução diretamente pelo PDV.
- DEV-02: devolver itens de vendas feitas sem cliente cadastrado.
- DEV-03: cadastrar/associar cliente durante a devolução.
- DEV-04: modalidade "com haver" gera crédito limitado ao valor efetivamente pago (corrige BUG-1, haver capping).
- DEV-05: modalidade "abatimento de débito" — não gera haver; abate parcela(s) escolhida(s) pelo operador no crediário do cliente.
- DEV-06: página dedicada `/returns` cobre também vendas `crediario_pending` (corrige BUG-4, consistente com `Sales.tsx canReturn`).
- DEV-07: reverter uma devolução que cancelou parcelas restaura essas parcelas (usa `cancelledInstallmentIds`).

Fora de escopo: fração (Fase 5), fiscal (Fase 6), estorno (Fase 3, já feito).

</domain>

<decisions>
## Implementation Decisions

### DEV-04 — Haver capping (corrige BUG-1)
- A devolução "com haver" gera `storeCredit` limitado ao valor efetivamente pago da venda, não ao total devolvido. Para crediário: haver ≤ proporção paga. Algoritmo (FINANCIAL-PITFALLS §1): para venda crediário, haver = min(returnTotal, parcela paga atribuível) — capar pelo `sum(installments.amountPaid)`/`sale.crediarioPaid` e pela proporção `returnTotal/sale.total`. Para venda à vista (dinheiro/cartão/pix) já paga, haver = returnTotal (comportamento atual correto).
- `processReturn.ts` passa a aplicar o capping (hoje ele gera `hasClient ? totalRefunded : 0`). Esta é a correção de regra que a Fase 1 deliberadamente adiou.

### DEV-05 — Abatimento de débito (operador escolhe a parcela)
- Nova modalidade: não gera `storeCredit`. O valor da devolução abate parcela(s) em aberto/vencidas do crediário do cliente, escolhidas manualmente pelo operador.
- UI: após calcular o valor da devolução, o operador seleciona a(s) parcela(s) a abater; o sistema aplica o valor reduzindo `amount`/marcando `amountPaid`/quitando conforme o caso, registrando um `CreditPayment` (tipo apropriado, ex.: 'devolucao'/'abatimento') auditável. Usar `roundCurrency`. Se o valor exceder as parcelas escolhidas, o excedente NÃO vira haver automaticamente — o operador decide (pode escolher mais parcelas) ou o excedente é descartado/explicitado (ver Claude's Discretion).
- Requer cliente com crediário em aberto; indisponível para venda sem cliente.

### DEV-01/02/03 — Devolução pelo PDV, sem cliente, cadastro no ato
- Adicionar no PDV (`POS.tsx`) uma entrada para iniciar devolução (ex.: botão/modo "Devolução") que localiza a venda (por código/cliente) e reusa o fluxo de `processReturn`.
- Suportar venda sem `clientId`: a devolução restaura estoque; a modalidade haver só se aplica se houver cliente — para venda sem cliente, oferecer cadastrar/associar cliente no ato (DEV-03) ou seguir sem cliente (apenas restaura estoque, sem haver).
- DEV-03: durante a devolução, permitir selecionar um cliente existente ou cadastrar um novo (reusar `ClientCombobox` e o formulário/criação de cliente existente), associando-o ao processo (e opcionalmente à venda) para então permitir haver/abatimento.

### DEV-06 — Página dedicada cobre crediario_pending (corrige BUG-4)
- Alinhar `eligibleSales` em `Returns.tsx` à lógica de `canReturn()` de `Sales.tsx` (incluir `crediario_pending`). Ao devolver totalmente uma venda crediário, cancelar as parcelas em aberto/vencidas (consistente com Fase 3) e registrar `cancelledInstallmentIds` no `ReturnRecord`.

### DEV-07 — Reverter devolução restaura parcelas
- `handleReverseReturn` (`Returns.tsx`) passa a restaurar as parcelas listadas em `ReturnRecord.cancelledInstallmentIds` (status volta de `cancelled` para o anterior — `open`/`overdue` recalculado por `getEffectiveStatus`), além de já reverter estoque e remover o haver gerado. Para devoluções em modalidade abatimento, reverter também o abatimento (estornar o `CreditPayment` de abatimento).

### Consolidação
- Centralizar o cálculo/efeito de devolução em `processReturn.ts` (haver capping + cancelamento de parcelas + modalidade), consumido por `Sales.tsx`, `Returns.tsx` e o novo fluxo do PDV — evita a duplicação/derrapagem já apontada (CONCERNS) e mantém consistência com a Fase 3.

### Claude's Discretion
- UX exata da entrada de devolução no PDV (botão na barra, item de menu, ou modo) — reusar componentes existentes (Dialog, ClientCombobox, item checklist de Returns).
- Como tratar excedente no abatimento (bloquear, descartar com aviso, ou permitir escolher mais parcelas) — preferir avisar e deixar o operador escolher mais parcelas; nunca virar haver silenciosamente.
- Forma de registrar o abatimento no `CreditPayment` (novo `type` opcional) mantendo retrocompatibilidade.
- Shape exato dos parâmetros/result de `processReturn` ao adicionar modalidade — manter pura e retrocompatível com os call sites atuais.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/processReturn.ts` — módulo puro de devolução (Fase 1); ALVO da regra de capping (DEV-04) + modalidade (DEV-05) + cancelamento de parcelas.
- `src/pages/Returns.tsx` — `handleReturn` (~122-210), `handleReverseReturn` (~213-263), `eligibleSales` (~59), checklist de itens, busca por cliente/código.
- `src/pages/Sales.tsx` — `handleReturnFromSale`, `canReturn()` (~312), `getReturnedQuantities()` (~200).
- `src/pages/POS.tsx` — tela do PDV; `ClientCombobox`, busca de produto/venda; ponto de entrada da nova devolução.
- `src/components/ClientCombobox.tsx` — seleção de cliente reutilizável.
- `src/pages/Clients.tsx` — criação/edição de cliente (reaproveitar lógica/forma de cadastro no ato).
- `src/lib/installmentStatus.ts` — `getEffectiveStatus` (Fase 2).
- `src/lib/formatters.ts` — `roundCurrency`, `formatCurrency`.
- `src/types/index.ts` — `ReturnRecord` (com `cancelledInstallmentIds?`), `Installment`, `CreditPayment`, `Client.storeCredit`, `Sale`.

### Established Patterns
- Mutações via `useLocalStorage` (substituição de array completa); `toast` (sonner); diálogos shadcn; sem novo design system.
- `processReturn` puro + página aplica setters (padrão estabelecido nas Fases 1/3 com `processRefund`).

### Integration Points
- `processReturn.ts` (regras), `POS.tsx` (nova entrada), `Returns.tsx` (modalidade + reversão + crediario_pending), `Sales.tsx` (consistência), `types/index.ts` (campos opcionais), possivelmente `CreditNotes.tsx` (refletir abatimento).

</code_context>

<specifics>
## Specific Ideas

- Pedido (verbatim): "Permitir devoluções de vendas realizadas sem cadastro de cliente. Caso necessário, possibilitar o cadastro do cliente durante o processo de devolução." → DEV-02/03.
- Duas modalidades (verbatim): (a) com geração de crédito (haver), (b) para abatimento de débito — abate parcelas/saldo do crediário sem gerar crédito. → DEV-04/05.
- BUG-1 (haver sem pagamento) e BUG-2 (parcelas pendentes pós-devolução total) e BUG-4 (Returns não cobre crediario_pending) são corrigidos aqui para o caminho de devolução (o caminho de estorno foi na Fase 3).

</specifics>

<deferred>
## Deferred Ideas

- Fração (Fase 5), fiscal (Fase 6).
- Abatimento automático do excedente como haver — explicitamente evitado (operador decide).

</deferred>
