# Phase 6: Layout Fiscal - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — decisão tomada (DANFE A4 + cupom NFCe, só layout); detalhes em FISCAL-LAYOUT.md

<domain>
## Phase Boundary

Gerar, a partir de uma venda, documentos com o LAYOUT OFICIAL (apenas visual, sem transmissão ao SEFAZ) de:
- FISC-01: cupom NFCe (DANFE-NFCe, 80mm) — título oficial, área de chave de acesso, QR Code, altura dinâmica.
- FISC-02: DANFE da NFe (A4) — 8 quadros obrigatórios, tabela de produtos com colunas fiscais, código de barras CODE-128.
- FISC-03: ambos exibem destacado o aviso "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL" e usam placeholders seguros para campos não computados (NCM, CFOP, CST, chave, protocolo).

Gerados com jsPDF, a partir de uma venda existente, como documentos adicionais (acessíveis no histórico de vendas/Sales.tsx, ao lado do cupom não fiscal atual). NÃO substituem o cupom não fiscal existente.

Fora de escopo: cálculo tributário real (ICMS/PIS/COFINS), transmissão/autorização SEFAZ, chave/protocolo reais, certificado — explicitamente v2.

</domain>

<decisions>
## Implementation Decisions

### Bibliotecas novas
- Código de barras CODE-128 do DANFE: usar `bwip-js` (jsPDF não gera nativamente). Gerar a imagem do código (chave de 44 dígitos placeholder) e inserir no PDF via `addImage`.
- QR Code da NFCe: usar uma lib de QR (ex.: `qrcode`) para gerar a imagem do payload placeholder e inserir via `addImage`.
- Instalar via npm; manter offline em runtime (libs client-side, sem rede).

### FISC-01 — Cupom NFCe (80mm)
- Seguir FISCAL-LAYOUT.md: título exato "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA" (centralizado), bloco de itens (Código, Descrição, Qtd, Un, Vl Unit, Vl Total), totais, forma de pagamento, frase exata "Consulte pela Chave de Acesso em" seguida da chave (placeholder 44 dígitos), QR Code (mín. 25×25mm), dados do consumidor (ou "CONSUMIDOR NÃO IDENTIFICADO"). NCM/CFOP/CST NÃO precisam no cupom.
- Altura dinâmica: `~164 + 8×n_itens` mm (mesmo padrão de altura dinâmica usado nos PDFs da Fase 1).
- Dados do emitente de `StoreSettings` (nome, CNPJ, IE se houver, endereço).

### FISC-02 — DANFE NFe (A4)
- Seguir FISCAL-LAYOUT.md: 8 quadros em ordem — Cabeçalho (emitente + "DANFE" + código de barras CODE-128 + nº/série), Natureza da operação/Protocolo, Destinatário/Remetente, Fatura/Duplicatas (opcional), Dados dos Produtos/Serviços (tabela: Código, Descrição, NCM, CST, CFOP, Un, Qtd, Vl Unit, Vl Total, BC ICMS, Alíq ICMS, Vl ICMS, Vl IPI — colunas fiscais presentes mas zeradas), Cálculo do Imposto (totais, bases zeradas), Transportador/Volumes, Dados Adicionais.
- A4 = 210×297mm; paginar a tabela de produtos se exceder uma página (muitos itens) — não cortar totais.
- Código de barras = chave de acesso placeholder (44 dígitos) via bwip-js.

### FISC-03 — Disclaimer + placeholders
- Aviso destacado (banda em negrito e/ou marca d'água) com o texto verbatim: NFe → "NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL"; NFCe → "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL".
- Placeholders seguros: chave de acesso 44 dígitos fictícia/zerada; protocolo "SEM PROTOCOLO"; NCM/CFOP/CST zerados ou em branco; bases e valores de imposto zerados; QR payload estático/placeholder. Deixar claro que não tem valor fiscal.

### Acesso na UI
- Adicionar no histórico de vendas (`Sales.tsx`, ou onde o cupom atual é impresso) ações para "Gerar NFCe (cupom)" e "Gerar DANFE (NFe)" de uma venda, reaproveitando o padrão print/download existente (jsPDF doc → autoPrint/blob ou save).

### Claude's Discretion
- Estrutura/arquivos dos geradores (ex.: `src/lib/generateNFCe.ts`, `src/lib/generateDANFE.ts`) e helpers de campo fiscal/placeholder.
- Coordenadas exatas/itens por página no DANFE; como desenhar a marca d'água/banda.
- Geração da chave de acesso placeholder (ex.: 44 zeros ou um padrão fictício claramente inválido) e do payload do QR.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/generateReceipt.ts`, `src/lib/generateQuote.ts`, `src/lib/generateCrediarioReceipt.ts` — padrões jsPDF existentes (80mm, altura dinâmica na Fase 1, print/download wrappers).
- `src/lib/storeInfo.ts` / `getStoreSettings()` — dados do emitente (nome, CNPJ, endereço, telefone).
- `src/lib/formatters.ts` — `formatCurrency`, `roundCurrency`.
- `src/lib/documentValidation.ts` — formatação de CPF/CNPJ.
- `src/types/index.ts` — `Sale`, `SaleItem`, `Client`; `src/types/settings.ts` — `StoreSettings`.
- `src/pages/Sales.tsx` — onde ficam as ações de impressão de cupom (ponto de integração das novas ações).

### Established Patterns
- Cada gerador retorna um `jsPDF` doc; wrappers `print*`/`download*` chamam `autoPrint()` + `window.open(bloburl)` ou `doc.save(filename)`.
- Dados do emitente via `getStoreSettings()` no momento da geração.
- Todos os PDFs atuais marcam "CUPOM NÃO FISCAL".

### Integration Points
- Novos `src/lib/generateNFCe.ts` e `src/lib/generateDANFE.ts`; integração em `Sales.tsx`; novas deps `bwip-js` e `qrcode` (+ `@types/qrcode` se necessário).

### Research
- `.planning/research/FISCAL-LAYOUT.md` (706 linhas) — enumeração completa de quadros, colunas, textos legais verbatim, dimensões e mapeamento "dados que temos vs placeholder". Consultar como fonte primária.

</code_context>

<specifics>
## Specific Ideas

- Pedido (verbatim): "pegar o modelo oficial da nota fiscal brasileira tanto NFe quanto NFCe para emitir os cuponzinhos, mas por hora não precisa ser 100%, não precisa mandar pro governo ainda. É só o layout."
- Validar com muitos itens: o DANFE deve paginar e o NFCe usar altura dinâmica — nada de total cortado (consistente com a correção da Fase 1).
- Textos legais e o disclaimer de homologação devem ser verbatim (FISCAL-LAYOUT.md) para parecer o layout oficial sem se passar por documento autorizado.

</specifics>

<deferred>
## Deferred Ideas

- Cálculo tributário real (ICMS/PIS/COFINS por NCM/CFOP/CST) — v2 (FISC2-01).
- Transmissão/autorização SEFAZ, chave/protocolo reais, certificado digital — v2 (FISC2-02).
