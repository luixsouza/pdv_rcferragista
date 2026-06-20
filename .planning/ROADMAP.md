# Roadmap: PDV RC Ferragista — Melhorias e Adaptações

## Overview

Este milestone corrige bugs financeiros críticos do crediário (haver indevido, parcelas fantasmas, double restock), adiciona devolução pelo PDV e suporte a quantidade fracionada, e introduz o layout visual de documentos fiscais brasileiros (NFe/NFCe). A sequência começa pela fundação compartilhada (helpers, tipos, extração de lógica) que destravam todas as fases seguintes, entrega a correção de PDF logo no início como vitória rápida, e deixa o layout fiscal — a maior feature nova — por último, quando toda base está estável.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Fundação e PDF** - Helpers de arredondamento, extração de lógica de devolução, ajustes de tipos retrocompatíveis e correção de altura dinâmica dos PDFs existentes
- [ ] **Phase 2: Crediário** - Visibilidade aprimorada de parcelas, identificação correta de vencidas e cobrança explícita de juros
- [ ] **Phase 3: Estorno Correto** - Estorno de crediário sem haver indevido, cancelamento automático de parcelas e proteção contra double restock
- [ ] **Phase 4: Devolucao Completa** - Devolução pelo PDV, vendas sem cliente, cadastro inline, modalidades (haver / abatimento de débito) e reversão consistente
- [ ] **Phase 5: Venda Fracionada** - Quantidade decimal no PDV, orçamento e cadastro de produtos para unidades de medida (mt, kg, lt, m²)
- [ ] **Phase 6: Layout Fiscal** - PDFs com layout DANFE-NFCe (80mm) e DANFE-NFe (A4), completos e com disclaimer de não-autorização

## Phase Details

### Phase 1: Fundação e PDF
**Goal**: Os blocos de construção compartilhados existem e os PDFs existentes exibem valores corretamente mesmo com muitos itens
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, PDF-01, PDF-02
**Success Criteria** (what must be TRUE):
  1. Um cupom de venda com 30 itens exibe corretamente os totais, desconto e forma de pagamento sem cortar o conteúdo
  2. Um orçamento com 25 itens exibe corretamente os totais e informações de rodapé sem cortar o conteúdo
  3. Toda lógica de devolução (criar ReturnRecord, restaurar estoque, gerar/capear haver, cancelar parcelas) executa a partir de um único módulo `src/lib/processReturn.ts`
  4. Cálculos de parcela e total de devolução usam `roundCurrency()` e somam exatamente o valor correto (sem erro de ponto flutuante de R$0,01)
  5. O tipo `ReturnRecord` registra `cancelledInstallmentIds` e `SaleItem` aceita quantidade decimal, sem quebrar dados já gravados
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — roundCurrency helper (FND-01) + ReturnRecord/SaleItem type changes (FND-03) + arredondamento nas parcelas/carrinho do POS
- [ ] 01-02-PLAN.md — Altura dinâmica dos PDFs de cupom e orçamento (PDF-01, PDF-02)
- [ ] 01-03-PLAN.md — Extração de src/lib/processReturn.ts puro com paridade comportamental, consumido por Sales e Returns (FND-02)

### Phase 2: Crediário
**Goal**: O operador enxerga o estado real do crediário de cada cliente — saldo, situação das parcelas e juros — e consegue cobrar juros de forma explícita
**Depends on**: Phase 1
**Requirements**: CRED-01, CRED-02, CRED-03
**Success Criteria** (what must be TRUE):
  1. A tela de crediário exibe, por cliente e por venda, o total devido, total pago, saldo em aberto e status de cada parcela (em aberto / vencida / paga / cancelada)
  2. Parcelas que vencem enquanto o aplicativo está aberto (sem navegar para Crediário) aparecem como vencidas na próxima vez que o operador consulta qualquer tela que exiba parcelas
  3. Ao registrar pagamento de uma parcela vencida, o operador vê o valor dos juros calculados e pode confirmar a cobrança antes de concluir o pagamento
**Plans**: TBD
**UI hint**: yes

### Phase 3: Estorno Correto
**Goal**: Estornar uma venda de crediário produz exatamente o efeito financeiro correto — sem gerar haver por dinheiro não recebido, sem parcelas fantasmas e sem restaurar estoque que já foi devolvido
**Depends on**: Phase 1
**Requirements**: EST-01, EST-02, EST-03, EST-04
**Success Criteria** (what must be TRUE):
  1. Estornar uma venda de crediário em que o cliente não pagou nada cancela a dívida sem gerar nenhum haver para o cliente
  2. Ao estornar uma venda de crediário com parcelas já pagas, o sistema apresenta um diálogo perguntando ao operador se o valor pago deve virar haver ou ser devolvido em dinheiro (saída de caixa)
  3. Após o estorno de uma venda de crediário, todas as parcelas em aberto ou vencidas vinculadas àquela venda aparecem como canceladas na tela de crediário
  4. Estornar uma venda que já teve devolução parcial anterior restaura ao estoque apenas a quantidade que ainda não havia sido devolvida (sem double restock)
**Plans**: TBD

### Phase 4: Devolucao Completa
**Goal**: O operador consegue processar qualquer devolução — inclusive de vendas sem cliente cadastrado e pelo PDV — escolhendo a modalidade correta (gerar haver ou abater débito), e uma eventual reversão da devolução deixa o crediário em estado consistente
**Depends on**: Phase 3
**Requirements**: DEV-01, DEV-02, DEV-03, DEV-04, DEV-05, DEV-06, DEV-07
**Success Criteria** (what must be TRUE):
  1. O operador inicia uma devolução diretamente pela tela do PDV sem precisar navegar para Vendas ou Devoluções
  2. É possível devolver itens de uma venda feita sem cliente cadastrado; durante o processo o operador pode cadastrar ou associar um cliente se quiser gerar haver
  3. Uma devolução na modalidade "abatimento de débito" abate o valor em parcela(s) escolhida(s) pelo operador sem gerar haver, e as parcelas refletem o abatimento imediatamente na tela de crediário
  4. A página de Devoluções lista e processa devoluções de vendas com status `crediario_pending` da mesma forma que vendas pagas
  5. Reverter uma devolução que havia cancelado parcelas restaura essas parcelas como abertas/vencidas (conforme a data de vencimento), deixando o crediário no estado anterior à devolução
**Plans**: TBD
**UI hint**: yes

### Phase 5: Venda Fracionada
**Goal**: O operador consegue vender e orçar produtos por quantidade decimal (ex.: 1,5 mt de cano, 0,75 kg de parafuso) com cálculo automático de total e baixa de estoque decimal correta
**Depends on**: Phase 1
**Requirements**: FRAC-01, FRAC-02, FRAC-03, FRAC-04
**Success Criteria** (what must be TRUE):
  1. No PDV, ao adicionar um produto com unidade mt/kg/lt/m², o campo de quantidade aceita decimais e o botão +/- usa passo adequado à unidade (ex.: 0,5 para kg); para unidades un/cx o comportamento permanece inteiro
  2. O total do item e da venda é calculado automaticamente a partir da quantidade fracionada, e o valor final nunca exibe erro de centavo por ponto flutuante
  3. Após finalizar uma venda com 2,5 mt de cano, o estoque do produto é decrementado em 2,5 (e não arredondado para 2 ou 3)
  4. Abrir o produto no cadastro e salvar sem alterar o estoque preserva o valor decimal existente (sem truncamento por parseInt)
  5. O orçamento aceita e exibe quantidade fracionada para produtos de medida, com total correto
**Plans**: TBD

### Phase 6: Layout Fiscal
**Goal**: A partir de qualquer venda, o operador consegue gerar e imprimir os documentos com layout oficial de NFCe (80mm) e DANFE NFe (A4), com todos os campos obrigatórios preenchidos ou com placeholder claro, e com aviso destacado de que o documento não tem valor fiscal
**Depends on**: Phase 1
**Requirements**: FISC-01, FISC-02, FISC-03
**Success Criteria** (what must be TRUE):
  1. A partir da tela de Vendas, o operador abre uma venda e consegue gerar o cupom NFCe (80mm) com título oficial "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA", área de chave de acesso, QR Code e altura dinâmica proporcional aos itens
  2. A partir da tela de Vendas, o operador consegue gerar o DANFE A4 com os 8 quadros obrigatórios preenchidos, tabela de produtos com colunas fiscais (NCM, CST, CFOP, Qtd, Vlr Unit, Vlr Total, BC ICMS, Alíq ICMS) e código de barras CODE-128C
  3. Ambos os documentos exibem de forma destacada o aviso "NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL" (NFe) / "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL" (NFCe), tornando inequívoco que o documento não é autorizado
  4. Campos fiscais indisponíveis (NCM, CFOP, CST, chave de acesso, protocolo) são preenchidos com placeholders seguros ("00000000", "SEM PROTOCOLO", "0000000000000000000000000000000000000000000") em vez de ficarem em branco ou quebrarem o layout
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6
(Phases 2 and 5 depend only on Phase 1 and can be re-ordered relative to each other; Phase 3 must precede Phase 4)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fundação e PDF | 0/3 | Not started | - |
| 2. Crediário | 0/? | Not started | - |
| 3. Estorno Correto | 0/? | Not started | - |
| 4. Devolucao Completa | 0/? | Not started | - |
| 5. Venda Fracionada | 0/? | Not started | - |
| 6. Layout Fiscal | 0/? | Not started | - |
