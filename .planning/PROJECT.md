# PDV RC Ferragista — Melhorias e Adaptações

## What This Is

Sistema de PDV (ponto de venda) desktop para a loja de materiais de construção/ferragens **RC Ferragista**. É um app Electron + React (TypeScript) totalmente offline, com persistência local via `electron-store`, que cobre vendas, orçamentos, crediário (parcelas/haver), devoluções, controle de estoque e relatórios. Este milestone corrige bugs do crediário/devolução, adiciona venda fracionada e devolução pelo PDV, e introduz o layout visual de documentos fiscais brasileiros (NFe/NFCe) sem transmissão ao governo.

## Core Value

O lojista consegue registrar vendas e gerir o crediário/devoluções com valores financeiros **corretos** — sem gerar haver indevido nem deixar parcelas fantasmas — e imprimir documentos completos e legíveis.

## Requirements

### Validated

<!-- Inferido do código existente (ver .planning/codebase/). Já em produção. -->

- ✓ Venda no PDV com carrinho, múltiplos pagamentos (dinheiro, crédito, débito, pix, crediário, haver) e baixa de estoque — existente (`src/pages/POS.tsx`)
- ✓ Crediário com geração de parcelas, entrada, pagamentos e controle de vencidas — existente (`src/pages/CreditNotes.tsx`)
- ✓ Estorno (refund) de venda com restauração de estoque — existente (`src/pages/Sales.tsx`)
- ✓ Devolução parcial/total a partir do histórico de vendas e página dedicada — existente (`src/pages/Sales.tsx`, `src/pages/Returns.tsx`)
- ✓ Orçamentos com PDF — existente (`src/pages/Quotes.tsx`, `src/lib/generateQuote.ts`)
- ✓ Geração de cupom não fiscal (80mm) para venda, devolução e extrato de crediário — existente (`src/lib/generateReceipt.ts`, `src/lib/generateCrediarioReceipt.ts`)
- ✓ Cadastro de produtos (com unidades, inclusive `mil`/milheiro) e clientes (limite de crédito, haver, tags) — existente (`src/pages/Products.tsx`, `src/pages/Clients.tsx`)
- ✓ Relatórios: fechamento de caixa, mensal e recebíveis — existente (`src/pages/Reports.tsx`)

### Active

<!-- Escopo deste milestone. -->

- [ ] Melhorar funcionalidades e visibilidade das informações do crediário para o usuário
- [ ] Corrigir estorno de venda no crediário: não gerar haver quando o cliente não pagou nada; apenas cancelar a dívida
- [ ] Quando houver valor pago no estorno do crediário, **perguntar** ao operador: gerar haver pelo valor pago OU devolver em dinheiro (saída de caixa)
- [ ] Cancelar automaticamente as parcelas vinculadas à venda ao estornar/devolver totalmente (estorno e devolução)
- [ ] Criar devolução diretamente pelo PDV, inclusive de vendas sem cliente cadastrado, com opção de cadastrar o cliente durante a devolução
- [ ] Corrigir geração de PDF de venda e orçamento: altura dinâmica para que valores, descontos e total apareçam mesmo com muitos itens
- [ ] Modalidade de devolução A — com geração de haver (comportamento atual, corrigido)
- [ ] Modalidade de devolução B — para abatimento de débito do crediário, sem gerar haver (operador escolhe a parcela a abater)
- [ ] Venda por quantidade fracionada (decimais) conforme a unidade do produto (mt, kg, lt, m²), com cálculo automático do total
- [ ] Layout visual de NFe (DANFE A4) e NFCe (cupom 80mm) com campos fiscais preenchidos, **sem** transmissão ao SEFAZ (apenas o layout)

### Out of Scope

- Transmissão fiscal real ao SEFAZ (autorização de NFe/NFCe, chave de acesso, protocolo, certificado digital, SAT) — pedido explicitamente para depois; agora é só o layout
- Cálculo tributário real (ICMS/PIS/COFINS por NCM/CFOP/CST) — fora do escopo deste milestone; campos fiscais serão preenchidos com valores informados/zerados conforme layout
- Backend/servidor, multiusuário e autenticação — app permanece local/offline single-user
- Integração com gateway de pagamento ou leitor de código de barras — não solicitado neste milestone

## Context

- **Brownfield:** base de código já existe e foi mapeada em `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS).
- **Bugs já localizados** (ver `.planning/codebase/CONCERNS.md`):
  - BUG-1: devolução/estorno gera haver mesmo sem pagamento (crediário) — `src/pages/Sales.tsx`, `src/pages/Returns.tsx`
  - BUG-2: parcelas ficam pendentes após devolução total — `src/pages/Returns.tsx`, `src/pages/Sales.tsx`
  - BUG-3: PDF de venda/orçamento corta o total com muitos itens (altura fixa) — `src/lib/generateReceipt.ts`, `src/lib/generateQuote.ts`
  - BUG-4: devolução restrita não cobre `crediario_pending` na página Returns — `src/pages/Returns.tsx`
  - BUG-5: sem suporte a quantidade fracionada (`parseInt`) — `src/pages/POS.tsx`, `src/pages/Quotes.tsx`, `src/pages/Products.tsx`
- **Lógica de devolução duplicada** em `Sales.tsx` e `Returns.tsx` — candidata a extração para `src/lib/processReturn.ts`.
- **Persistência:** múltiplas escritas não-transacionais via `useLocalStorage`; sem testes automatizados.
- **PDFs:** padrão jsPDF 80mm; o gerador de extrato de crediário já usa altura dinâmica (modelo para a correção do BUG-3).

## Constraints

- **Tech stack**: Electron 39 + React 18 + TypeScript + Vite + shadcn/ui + Tailwind; persistência `electron-store`; PDFs com jsPDF — manter o stack existente.
- **Offline-first**: nenhuma dependência de rede em runtime; tudo local.
- **Moeda/decimais**: usar `formatCurrency` (pt-BR) de `src/lib/formatters.ts`; quantidades fracionadas exigem cuidado com precisão (evitar erros de ponto flutuante em totais).
- **Sem strict TypeScript** (`strict: false`) — seguir convenções existentes do projeto.
- **Compatibilidade de dados**: alterações em tipos (`src/types/index.ts`) devem ser retrocompatíveis com dados já gravados no `electron-store`.
- **Fiscal apenas visual**: documentos NFe/NFCe não podem se passar por documento autorizado; deixar claro o caráter não-transmitido.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Estorno de crediário com valor pago: perguntar ao operador (haver ou dinheiro) | Dá flexibilidade ao caixa em vez de impor uma regra única | — Pending |
| Devolução para abatimento: operador escolhe a parcela a abater | Controle manual sobre qual débito quitar | — Pending |
| Quantidade fracionada conforme a unidade do produto (mt/kg/lt/m²) | Evita decimais indevidos em itens vendidos por unidade/caixa | — Pending |
| NFe/NFCe: gerar PDF DANFE (A4) + cupom NFCe (80mm), só layout | Atende ao pedido sem custo/risco de integração fiscal agora | — Pending |
| Manter stack atual (Electron/React/jsPDF/electron-store) | Brownfield; reduzir risco e retrabalho | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-20 after initialization*
