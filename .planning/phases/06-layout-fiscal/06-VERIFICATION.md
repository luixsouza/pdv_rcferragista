---
phase: 06-layout-fiscal
verified: 2026-06-20T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Abrir uma venda em Sales.tsx e clicar em 'Gerar NFCe (cupom)' — verificar que o PDF 80mm abre com título em destaque, disclaimer cinza em duas posições (Divisão II e VIII) e QR Code visível"
    expected: "PDF 80mm exibe: título 'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA' centralizado em negrito; disclaimer 'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL' em banda cinza duas vezes; QR Code de 28x28mm; chave de acesso em 11 grupos de 4; protocolo 'SEM PROTOCOLO'"
    why_human: "jsPDF renderiza no browser; impossível verificar layout visual e legibilidade por grep"
  - test: "Clicar em 'Gerar DANFE (NFe)' para uma venda e verificar o PDF A4 gerado"
    expected: "PDF A4 com 8 quadros visíveis na ordem canônica (Emitente+Barcode, Natureza/Protocolo, Destinatário, Fatura, Produtos, Cálculo Imposto, Transportador, Dados Adicionais); tabela de produtos com colunas NCM/CST/CFOP/BC ICMS/ALÍQ presentes e zeradas; barcode CODE-128 no Quadro 0; banda preta com texto branco 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL' no topo"
    why_human: "Layout A4 com 8 quadros, alinhamento de colunas e legibilidade do barcode requerem inspeção visual"
  - test: "Para uma venda com muitos itens (10+), gerar DANFE e verificar paginação"
    expected: "Totais (Quadro 5+6+7) nunca são cortados; nova página começa com disclaimer band + barcode strip + cabeçalho de colunas; os totais aparecem completos na última página"
    why_human: "Comportamento de addPage e reserva de TOTALS_BLOCK_H só pode ser confirmado visualmente com PDF multi-página"
  - test: "Verificar que o cupom não fiscal original (Imprimir / Baixar PDF) continua funcionando após as mudanças"
    expected: "Botões 'Imprimir' e 'Baixar PDF' existentes ainda geram o cupom não fiscal (generateReceipt) sem interferência"
    why_human: "Regressão de comportamento de UI requer execução manual"
---

# Phase 06: Layout Fiscal — Verification Report

**Phase Goal:** A partir de qualquer venda, o operador consegue gerar e imprimir os documentos com layout oficial de NFCe (80mm) e DANFE NFe (A4), com todos os campos obrigatórios preenchidos ou com placeholder claro, e com aviso destacado de que o documento não tem valor fiscal
**Verified:** 2026-06-20
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | generateNFCe produz cupom 80mm com título oficial verbatim, "Consulte pela Chave de Acesso em", chave 44 dígitos, QR ≥25mm via addImage, altura dinâmica, emitente de getStoreSettings | ✓ VERIFIED | `generateNFCe.ts:123` título verbatim; `:223` frase obrigatória; `:241` qrSize=28mm; `:243` addImage; `:44-46` calcHeight; `:85` getStoreSettings() |
| 2 | generateDANFE produz A4 com 8 quadros na ordem, colunas fiscais presentes e zeradas, CODE-128 via addImage, paginação que não corta totais | ✓ VERIFIED | Quadros 0-7 em `generateDANFE.ts:152-759`; 13 colunas fiscais somando 196mm `:425-439`; addImage barcode `:232`; TOTALS_BLOCK_H=72mm reservado `:475,565` |
| 3 | Ambos exibem disclaimer verbatim: NFe com hífen, NFCe com en-dash (U+2013) | ✓ VERIFIED | `fiscalPlaceholders.ts:41` NFE_DISCLAIMER com hífen; `:49` NFCE_DISCLAIMER com en-dash (–); usados em `generateNFCe.ts:136,305` e `generateDANFE.ts:88,773` |
| 4 | Campos fiscais indisponíveis usam placeholders seguros; UI em Sales.tsx expõe NFCe + DANFE preservando cupom não fiscal | ✓ VERIFIED | PLACEHOLDER_ACCESS_KEY=44 zeros, PLACEHOLDER_PROTOCOL='SEM PROTOCOLO', PLACEHOLDER_NCM/CFOP/CST em fiscalPlaceholders.ts; `Sales.tsx:42-43` imports; `:500-504` botões lista; `:640-655` botões dialog; `:494-497` printReceipt preservado |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/fiscalPlaceholders.ts` | Constantes placeholder FISC-03 | ✓ VERIFIED | 77 linhas; NFE_DISCLAIMER, NFCE_DISCLAIMER (en-dash), PLACEHOLDER_ACCESS_KEY 44 zeros, PLACEHOLDER_NCM/CFOP/CST/PROTOCOL/IE/SERIE, formatAccessKeyGroups |
| `src/lib/fiscalBarcode.ts` | Geradores async QR e CODE-128 | ✓ VERIFIED | 49 linhas; generateQrDataUrl (qrcode.toDataURL) e generateBarcodeDataUrl (bwip-js toCanvas); sem chamadas de rede |
| `src/lib/generateNFCe.ts` | Cupom 80mm com Divisões I-IX | ✓ VERIFIED | 339 linhas; async, retorna Promise<jsPDF>; 9 divisões; QR 28x28mm; disclaimer duas vezes; printNFCe/downloadNFCe exportados |
| `src/lib/generateDANFE.ts` | DANFE A4 com 8 quadros e paginação | ✓ VERIFIED | 810 linhas; async, retorna Promise<jsPDF>; 8 quadros (Q0-Q7); 13 colunas fiscais; paginação com addPage; printDANFE/downloadDANFE exportados |
| `src/pages/Sales.tsx` (modificado) | Botões NFCe + DANFE + cupom não fiscal preservado | ✓ VERIFIED | imports nas linhas 42-43; clientFor helper :412; botões ghost na lista :500-504; botões outline no dialog :640-655; printReceipt preservado :494 |
| `package.json` | bwip-js e qrcode como dependências de produção | ✓ VERIFIED | bwip-js@^4.11.1 :46; qrcode@^1.5.4 :57; @types/qrcode@^1.5.6 em devDependencies :75 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Sales.tsx` | `generateNFCe.ts` | `import { printNFCe, downloadNFCe }` | ✓ WIRED | Linha 42; void printNFCe() chamado em :500,640 |
| `Sales.tsx` | `generateDANFE.ts` | `import { printDANFE, downloadDANFE }` | ✓ WIRED | Linha 43; void printDANFE() chamado em :503,651 |
| `generateNFCe.ts` | `fiscalPlaceholders.ts` | import NFCE_DISCLAIMER, PLACEHOLDER_ACCESS_KEY, etc. | ✓ WIRED | Linhas 26-33; usados em :136,233,294,305 |
| `generateNFCe.ts` | `fiscalBarcode.ts` | `import { generateQrDataUrl }` | ✓ WIRED | Linha 34; await generateQrDataUrl(NFCE_QR_PLACEHOLDER) em :240 |
| `generateDANFE.ts` | `fiscalPlaceholders.ts` | import NFE_DISCLAIMER, PLACEHOLDER_*, etc. | ✓ WIRED | Linhas 22-31; usados em :88,240,278,538-540,773 |
| `generateDANFE.ts` | `fiscalBarcode.ts` | `import { generateBarcodeDataUrl }` | ✓ WIRED | Linha 32; await generateBarcodeDataUrl(PLACEHOLDER_ACCESS_KEY) em :133 |
| `generateNFCe.ts` | `storeInfo.getStoreSettings` | `import { getStoreSettings }` | ✓ WIRED | Linha 23; store = getStoreSettings() em :85; store.storeName/cnpj/address/city/cep/phone usados |
| `generateDANFE.ts` | `storeInfo.getStoreSettings` | `import { getStoreSettings }` | ✓ WIRED | Linha 18; store = getStoreSettings() em :130 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `generateNFCe.ts` | `store` (emitter) | `getStoreSettings()` | Yes — lê configurações da loja | ✓ FLOWING |
| `generateNFCe.ts` | `sale.items`, `sale.total`, `sale.discount` | Sale object passado como parâmetro | Yes — dados reais da venda | ✓ FLOWING |
| `generateDANFE.ts` | `store` (emitter) | `getStoreSettings()` | Yes | ✓ FLOWING |
| `generateDANFE.ts` | `sale.items`, `totalProdutos`, `totalNF` | Sale object + roundCurrency cálculo | Yes — dados reais da venda | ✓ FLOWING |
| `Sales.tsx` | `clientFor(sale)` | `clients.find(c => c.id === sale.clientId)` | Yes — busca no array de clientes carregado | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm run build exits 0 | `npm run build` | "built in 14.37s" — 3048 modules, zero errors | ✓ PASS |
| generateNFCe.ts exports async function | arquivo analisado | `export async function generateNFCe(...)` retorna `Promise<jsPDF>` | ✓ PASS |
| generateDANFE.ts exports async function | arquivo analisado | `export async function generateDANFE(...)` retorna `Promise<jsPDF>` | ✓ PASS |
| 44-zero key exatamente 44 dígitos | node -e check | length: 44 | ✓ PASS |
| 13 colunas fiscais somam 196mm | node -e check | 196mm total | ✓ PASS |
| Commits de fase existem | git log | 667d819, 2e65a35, a0de242, e991dce presentes | ✓ PASS |

### Probe Execution

Nenhum probe script declarado nesta fase. Step 7c: SKIPPED (sem probe-*.sh).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FISC-01 | 06-01-PLAN, 06-03-PLAN | NFCe 80mm com título oficial, chave de acesso, QR ≥25mm, altura dinâmica | ✓ SATISFIED | generateNFCe.ts completo; botões em Sales.tsx |
| FISC-02 | 06-02-PLAN, 06-03-PLAN | DANFE A4 com 8 quadros, colunas fiscais zeradas, CODE-128, paginação | ✓ SATISFIED | generateDANFE.ts completo; botões em Sales.tsx |
| FISC-03 | 06-01-PLAN | Disclaimers verbatim (NFe hifén, NFCe en-dash); placeholders seguros | ✓ SATISFIED | fiscalPlaceholders.ts; usados em ambos os geradores |

### Anti-Patterns Found

Nenhum. Varredura em todos os arquivos criados/modificados pela fase:

| File | Pattern Scanned | Result |
|------|----------------|--------|
| `fiscalPlaceholders.ts` | TODO/FIXME/TBD/XXX, return null/[] | Nenhum encontrado |
| `fiscalBarcode.ts` | TODO/FIXME/TBD/XXX, return null/[] | Nenhum encontrado |
| `generateNFCe.ts` | TODO/FIXME/TBD/XXX, return null/[] | Nenhum encontrado |
| `generateDANFE.ts` | TODO/FIXME/TBD/XXX, return null/[] | Nenhum encontrado |
| `Sales.tsx` | TODO/FIXME/TBD/XXX | Nenhum encontrado |

Os stubs intencionais (PLACEHOLDER_ACCESS_KEY, PLACEHOLDER_PROTOCOL, etc.) são por design FISC-03, documentados nos SUMMARYs, e nunca deixam campos em branco — são valores ficticios explícitos que tornam o documento não fiscal.

### Human Verification Required

#### 1. Renderização visual do cupom NFCe 80mm

**Test:** Em um ambiente com a aplicação rodando, abrir uma venda finalizada em Sales.tsx e clicar no botão Receipt ("Gerar NFCe (cupom)"). Verificar o PDF gerado no browser.
**Expected:** PDF 80mm com: (1) título "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA" em negrito centralizado; (2) banda cinza com "EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL" logo abaixo do título; (3) lista de itens com qtd × preço; (4) totais; (5) seção "Consulte pela Chave de Acesso em" + URL SEFAZ + chave em grupos; (6) QR Code quadrado; (7) dados do consumidor ou "CONSUMIDOR NÃO IDENTIFICADO"; (8) banda cinza com disclaimer repetida na seção VIII
**Why human:** jsPDF renderiza no browser/Electron; layout, fontes e posicionamento dos elementos só podem ser confirmados visualmente

#### 2. Renderização visual do DANFE A4

**Test:** Clicar em FileText ("Gerar DANFE (NFe)") para uma venda. Verificar o PDF A4 gerado.
**Expected:** PDF A4 com: (1) banda preta topo com texto branco NFE_DISCLAIMER; (2) Quadro 0: emitente à esquerda, "DANFE" grande ao centro, barcode CODE-128 + chave agrupada à direita; (3) Quadros 1-7 visíveis com bordas rect; (4) tabela de produtos com colunas NCM/CST/CFOP/BC ICMS/ALÍQ visíveis e valores zerados; (5) Quadro 5 com VALOR TOTAL DA NF em negrito mostrando valor real da venda
**Why human:** Layout A4 multi-quadro com divisores internos e alinhamento de colunas de 5pt requer inspeção visual

#### 3. Paginação do DANFE com muitos itens

**Test:** Gerar DANFE para uma venda com 15+ itens.
**Expected:** PDF multi-página onde: cada nova página começa com disclaimer band + barcode strip + cabeçalho de colunas; os Quadros 5, 6 e 7 aparecem completos (não cortados) na última página
**Why human:** Comportamento de paginação (addPage + TOTALS_BLOCK_H=72mm reservado) requer verificação com PDF real de múltiplas páginas

#### 4. Não-regressão do cupom não fiscal

**Test:** Clicar em "Imprimir" (ícone Printer) e "Baixar PDF" (ícone Download) — os botões originais — para uma venda.
**Expected:** Gera o cupom não fiscal via generateReceipt.ts, sem interferência das novas funcionalidades. Ambos continuam funcionando normalmente.
**Why human:** Regressão de comportamento de UI requer execução manual

---

### Gaps Summary

Nenhum gap encontrado. Todos os 4 must-haves verificados com evidência direta no código.

Os itens de verificação humana (acima) são necessários para confirmar comportamento visual e de renderização — não são gaps de implementação. O código está completo e wired.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
