# Research Summary — PDV RC Ferragista (Melhorias)

**Date:** 2026-06-20
**Scope:** Brownfield maintenance + new fiscal-layout feature. Codebase already mapped in `.planning/codebase/`. Research focused on the two external unknowns: (1) official Brazilian fiscal document layouts; (2) financial-correctness/decimal pitfalls for the bug fixes.

Sources:
- `.planning/research/FISCAL-LAYOUT.md` (706 lines) — DANFE (NFe A4) + DANFE-NFCe (cupom 80mm) layout
- `.planning/research/FINANCIAL-PITFALLS.md` (441 lines) — estorno/devolução/parcela/decimal correctness

## Key Findings

### Fiscal layout (NFe DANFE / NFCe cupom) — layout only, no SEFAZ
- **DANFE (A4):** 8 quadros obrigatórios em ordem fixa (Cabeçalho+código de barras, Natureza/Protocolo, Destinatário, Fatura opcional, Dados do Produto, Cálculo do Imposto, Transportador, Dados Adicionais). Tabela de produtos: Código, Descrição, NCM, CST, CFOP, Unidade, Qtd, Vlr Unit, Vlr Total, BC ICMS, Alíq ICMS, Vlr ICMS, Vlr IPI (os fiscais podem ir zerados, mas presentes).
- **DANFE-NFCe (80mm):** título exato "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA"; frase exata "Consulte pela Chave de Acesso em"; QR Code mín. 25×25mm; NCM/CFOP/CST **não** precisam aparecer no cupom. Altura dinâmica `164 + 8×n_itens` mm.
- **Disclaimer obrigatório (segurança):** usar verbatim `"NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"` (NFe) e `"EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL"` (NFCe), com banda em negrito e/ou marca d'água, para não parecer documento autorizado.
- **Dados:** ~60% dos campos já existem em `Sale`/`Client`/`StoreSettings`. Faltantes (NCM, CFOP, CST, chave de acesso, protocolo, payload do QR) são placeholderáveis (zeros / "SEM PROTOCOLO" / strings estáticas).
- **Dependência nova:** código de barras CODE-128C do DANFE exige `bwip-js` (jsPDF não gera nativamente). QR Code da NFCe também precisa de gerador (ex.: `qrcode`).

### Financial correctness (bug fixes)
- **Haver capping (BUG-1):** devolução/estorno só gera haver pelo valor efetivamente pago. Para crediário, detectar via `paymentMethod === 'crediario'`/`paymentEntries` e limitar haver a `sum(installments.amountPaid) × (returnTotal / sale.total)`. Crediário sem pagamento → haver = 0, apenas cancela dívida. No estorno, `totalPaidBack` já soma `amountPaid`; falta o diálogo do operador (haver vs dinheiro) quando > 0.
- **Cancelamento de parcelas (BUG-2):** cancelar só parcelas `open`/`overdue` (nunca `paid`), apenas quando `allItemsReturned === true`; gravar `cancelledInstallmentIds?: string[]` no `ReturnRecord` para reversibilidade (`handleReverseReturn` restaura).
- **Double restock (área frágil):** no `handleRefund` reusar `getReturnedQuantities()` (Sales.tsx:200) para subtrair quantidades já devolvidas antes de restaurar estoque.
- **Decimais/arredondamento:** não adicionar Decimal.js; estender `src/lib/formatters.ts` com `roundCurrency(v) = Math.round(v*100)/100` (padrão já usado em `cardFees.ts:62`) e aplicar em todos os limites de cálculo. Última parcela absorve o resíduo para somar exatamente o total.
- **Lógica duplicada:** extrair devolução para `src/lib/processReturn.ts`, consumido por `Sales.tsx`, `Returns.tsx` e (novo) PDV.

## Implications for the Roadmap
1. **Fundação compartilhada primeiro:** `roundCurrency` + extração de `processReturn.ts` + ajustes de tipos (`cancelledInstallmentIds`, suporte a fração) destravam várias melhorias com menos retrabalho.
2. **Correções financeiras** (estorno haver, cancelamento de parcelas, double restock, BUG-4) formam um bloco coeso de crediário/devolução.
3. **Devolução pelo PDV + modalidades (haver/abatimento)** dependem do `processReturn.ts` e do cadastro de cliente inline.
4. **Quantidade fracionada** toca POS, Quotes e Products (parseFloat + step por unidade) — bloco isolado.
5. **PDF dinâmico** (BUG-3) é correção isolada e de baixo risco; bom candidato a fase inicial rápida.
6. **Layout NFe/NFCe** é a maior feature nova; depende de novas libs (bwip-js/qrcode) e de um mapeamento de dados → campos fiscais.

## Watch Out For
- Floating point em totais e estoque fracionado — arredondar consistentemente.
- Retrocompatibilidade dos dados gravados no `electron-store` ao alterar tipos.
- Não deixar os documentos NFe/NFCe parecerem fiscais autorizados (disclaimers obrigatórios).
- Escritas não-transacionais: ao mexer em estorno/devolução, manter a ordem das mutações e evitar estados parciais.
