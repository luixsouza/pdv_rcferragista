# Requirements: PDV RC Ferragista — Melhorias

**Defined:** 2026-06-20
**Core Value:** O lojista gere vendas, crediário e devoluções com valores financeiros corretos (sem haver indevido nem parcelas fantasmas) e imprime documentos completos e legíveis.

## v1 Requirements

### Fundação (Foundation)

- [x] **FND-01**: Existe um helper `roundCurrency()` (em `src/lib/formatters.ts`) usado em todos os cálculos de moeda (parcelas, totais de carrinho, totais de devolução) para evitar erros de ponto flutuante
- [x] **FND-02**: A lógica de devolução é centralizada em um módulo único (`src/lib/processReturn.ts`) e consumida por Vendas, Devoluções e PDV, eliminando a duplicação
- [x] **FND-03**: O tipo `ReturnRecord` registra as parcelas canceladas (`cancelledInstallmentIds`) e o tipo `SaleItem` suporta quantidade fracionada, mantendo retrocompatibilidade com dados já gravados

### PDF (Documentos não fiscais existentes)

- [ ] **PDF-01**: O PDF de venda (cupom) usa altura dinâmica e exibe corretamente valores, descontos e total mesmo com muitos itens (corrige BUG-3)
- [ ] **PDF-02**: O PDF de orçamento usa altura dinâmica e exibe corretamente valores, descontos e total mesmo com muitos itens (corrige BUG-3)

### Crediário

- [x] **CRED-01**: A tela de crediário exibe, por cliente e por venda, o total devido, o total pago, o saldo em aberto e a situação das parcelas (em aberto/vencida/paga/cancelada) de forma clara
- [x] **CRED-02**: As parcelas vencidas são identificadas corretamente sempre (não apenas ao abrir a tela de crediário uma vez)
- [x] **CRED-03**: O operador consegue visualizar os juros calculados de parcelas vencidas e cobrá-los de forma explícita ao registrar o pagamento

### Estorno de venda no crediário

- [x] **EST-01**: Ao estornar uma venda de crediário em que o cliente não pagou nada, o sistema NÃO gera haver — apenas cancela a dívida
- [x] **EST-02**: Ao estornar/devolver totalmente uma venda de crediário, todas as parcelas em aberto/vencidas vinculadas à venda são canceladas automaticamente
- [ ] **EST-03**: Ao estornar uma venda de crediário com valor já pago, o sistema pergunta ao operador se gera haver pelo valor pago ou devolve em dinheiro (saída de caixa)
- [x] **EST-04**: O estorno não restaura estoque em dobro quando a venda já teve devolução parcial anterior (corrige double restock)

### Devolução

- [ ] **DEV-01**: É possível iniciar uma devolução diretamente pela tela do PDV
- [ ] **DEV-02**: É possível devolver itens de vendas feitas sem cliente cadastrado
- [ ] **DEV-03**: Durante a devolução, o operador pode cadastrar/associar um cliente ao processo
- [ ] **DEV-04**: A devolução na modalidade "com haver" gera crédito para o cliente limitado ao valor efetivamente pago (corrige BUG-1)
- [ ] **DEV-05**: A devolução na modalidade "abatimento de débito" não gera haver e abate o valor em parcela(s) escolhida(s) pelo operador no crediário do cliente
- [ ] **DEV-06**: A devolução pela página dedicada cobre também vendas em `crediario_pending` (corrige BUG-4, consistente com a tela de Vendas)
- [ ] **DEV-07**: Reverter uma devolução que cancelou parcelas restaura essas parcelas (usando `cancelledInstallmentIds`)

### Venda por quantidade fracionada

- [ ] **FRAC-01**: No PDV é possível informar quantidade decimal (ex.: 1,5) para produtos com unidade de medida (mt, kg, lt, m²), com passo apropriado por unidade
- [ ] **FRAC-02**: O total do item e da venda é calculado automaticamente a partir da quantidade fracionada e do preço unitário, com arredondamento correto
- [ ] **FRAC-03**: A baixa de estoque respeita a quantidade fracionada e o cadastro de produto preserva estoque decimal (corrige `parseInt` em Products)
- [ ] **FRAC-04**: O orçamento também aceita quantidade fracionada para produtos de medida

### Layout fiscal (NFe / NFCe — apenas visual)

- [ ] **FISC-01**: A partir de uma venda, é possível gerar um PDF com o layout do cupom NFCe (DANFE-NFCe, 80mm), incluindo título oficial, área de chave de acesso, QR Code e altura dinâmica
- [ ] **FISC-02**: A partir de uma venda, é possível gerar um PDF com o layout do DANFE (NFe, A4), com os 8 quadros obrigatórios, tabela de produtos com colunas fiscais e código de barras
- [ ] **FISC-03**: Ambos os documentos exibem de forma destacada o aviso "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL" e usam placeholders seguros para campos não computados (NCM, CFOP, CST, chave, protocolo)

## v2 Requirements

### Fiscal real
- **FISC2-01**: Cálculo tributário real por NCM/CFOP/CST (ICMS/PIS/COFINS)
- **FISC2-02**: Transmissão e autorização junto ao SEFAZ (chave de acesso, protocolo, certificado digital)

### Operação
- **OPS2-01**: Sangria / fundo de caixa e reconciliação física no fechamento
- **OPS2-02**: Escritas transacionais/atômicas no `electron-store`
- **OPS2-03**: Integração com leitor de código de barras no PDV
- **OPS2-04**: Testes automatizados para a lógica financeira crítica

## Out of Scope

| Feature | Reason |
|---------|--------|
| Transmissão fiscal ao SEFAZ | Pedido explicitamente para depois; agora é só o layout |
| Cálculo tributário real (ICMS/PIS/COFINS) | Fora do escopo; campos fiscais ficam zerados/placeholder |
| Backend/servidor, multiusuário, autenticação | App permanece local/offline single-user |
| Gateway de pagamento | Não solicitado neste milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| PDF-01 | Phase 1 | Pending |
| PDF-02 | Phase 1 | Pending |
| CRED-01 | Phase 2 | Complete |
| CRED-02 | Phase 2 | Complete |
| CRED-03 | Phase 2 | Complete |
| EST-01 | Phase 3 | Complete |
| EST-02 | Phase 3 | Complete |
| EST-03 | Phase 3 | Pending |
| EST-04 | Phase 3 | Complete |
| DEV-01 | Phase 4 | Pending |
| DEV-02 | Phase 4 | Pending |
| DEV-03 | Phase 4 | Pending |
| DEV-04 | Phase 4 | Pending |
| DEV-05 | Phase 4 | Pending |
| DEV-06 | Phase 4 | Pending |
| DEV-07 | Phase 4 | Pending |
| FRAC-01 | Phase 5 | Pending |
| FRAC-02 | Phase 5 | Pending |
| FRAC-03 | Phase 5 | Pending |
| FRAC-04 | Phase 5 | Pending |
| FISC-01 | Phase 6 | Pending |
| FISC-02 | Phase 6 | Pending |
| FISC-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26 (100%)
- Unmapped: 0

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-06-20 after roadmap creation*
