# Brazilian Fiscal Document Layout Reference

**Scope:** Visual layout only — DANFE (NFe model 55, A4) and DANFE-NFCe (model 65, cupom 80mm)
**Goal:** Implement printable PDFs with jsPDF that look like official documents but carry no fiscal authority.
**Researched:** 2026-06-20
**Confidence:** MEDIUM — structure and mandatory labels confirmed via multiple official-adjacent sources (SEFAZ SP manual v4.1, NT 2026.003, MOC PR portal, ENCAT); exact pixel/mm coordinates are implementation choices within the spec, not dictated by it.

---

## Part 1: DANFE — Nota Fiscal Eletrônica (NFe model 55, A4)

### 1.1 Page Setup

| Property | Value |
|----------|-------|
| Paper | A4 portrait — 210 × 297 mm |
| Alternate max size | Oficio II — 230 × 330 mm (not recommended for this project) |
| Left/right margins | 5–10 mm (not strictly specified; 7 mm is conventional) |
| Top/bottom margins | 5–7 mm |
| Orientation | Portrait (retrato) — standard; landscape exists but uncommon for retail |
| Multi-page | Permitted; repeat access-key barcode on every page; number pages "Fl. X / Y" |
| Barcode type | CODE-128C (linear, 1D) encoding the 44-digit access key |
| Font guidance | Any legible font; Helvetica is the jsPDF built-in and is sufficient |

### 1.2 Mandatory "Sem Valor Fiscal" Disclaimer

Since this project **never transmits to SEFAZ**, every generated DANFE must carry a prominent disclaimer. Two canonical approaches are used by Brazilian ERP systems:

**Option A — Watermark (diagonal, large, across the page body):**
```
SEM VALOR FISCAL
```
Printed diagonally in large bold text (e.g., 40–60pt, 45-degree rotation, 50% opacity) centered over the document body.

**Option B — Header band (recommended for this project — simpler in jsPDF):**
Print a filled rectangle band (e.g., 5 mm tall) in dark color immediately below the main header, containing centered bold white text:
```
DOCUMENTO SEM VALOR FISCAL — NÃO AUTORIZADO NA SEFAZ
```
or the exact SEFAZ homologation wording:
```
NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
```
(This exact string is specified by SEFAZ for homologation environment use; using it for our non-transmitted documents is intentionally conservative and makes the non-fiscal nature unmistakable.)

**Recommendation for this project:** Use Option B as a visible band at the top of the first page, plus print "SEM VALOR FISCAL" lightly diagonally across the page. This prevents the document from being mistaken for an authorized fiscal document.

### 1.3 Section Order and Block Layout (top to bottom, portrait A4)

The DANFE A4 is divided into rectangular bordered quadros (frames). Below is the canonical order:

---

#### QUADRO 0 — Header Bar (full width, ~18 mm tall)

Split into three horizontal columns:

| Column | Content | Approx Width |
|--------|---------|-------------|
| Left (~45 mm) | Logo area (optional) + **"IDENTIFICAÇÃO DO EMITENTE"** label; below it: Razão Social, Endereço, Bairro/Distrito, CEP, Município, UF, Fone/Fax, CNPJ, IE (Insc. Estadual), IE do Sub. Trib. | ~45% of page |
| Center (~40 mm) | "DANFE" in large bold text (centered); below it: "DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"; "0 - ENTRADA" / "1 - SAÍDA" checkbox; NFe number (Nº) and Series (Série) | ~25% of page |
| Right (~45 mm) | Access key barcode (CODE-128C, 44 digits), printed vertically or horizontally; below it: "CHAVE DE ACESSO" label; the 44-digit key in 4-digit groups: `NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN`; "Consulte a autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal/consulta.aspx" (or state SEFAZ URL) | ~30% of page |

Sub-fields in the emitter column:
- Razão Social / Nome (bold)
- Endereço (Logradouro, Número, Complemento)
- Bairro / Distrito
- CEP
- Município
- UF
- Fone / Fax
- CNPJ: formatted as `NN.NNN.NNN/NNNN-NN`
- Inscrição Estadual (IE)
- Inscrição Estadual do Substituto Tributário (leave blank if not applicable)

---

#### QUADRO 1 — Natureza da Operação / Protocol / Fiscal Data (~12 mm tall)

Three adjacent sub-blocks in one row:

| Sub-block | Label | Content |
|-----------|-------|---------|
| Left | **NATUREZA DA OPERAÇÃO** | Free text, e.g., "VENDA DE MERCADORIAS" |
| Center | **PROTOCOLO DE AUTORIZAÇÃO DE USO** | Protocol number + date/time (placeholder: leave blank or "SEM PROTOCOLO") |
| Right | (empty in non-authorized doc) | |

Below that, a second row:

| Sub-block | Label | Content |
|-----------|-------|---------|
| Left | **INSCRIÇÃO ESTADUAL** | Store IE (or blank) |
| Center | **INS. EST. DO SUBST. TRIBUTÁRIO** | Blank |
| Right | **CNPJ** | Store CNPJ (formatted) |

---

#### QUADRO 2 — Destinatário / Remetente (~14 mm tall)

Header: **"DESTINATÁRIO / REMETENTE"**

First row of fields:

| Field | Label |
|-------|-------|
| Nome / Razão Social | **NOME / RAZÃO SOCIAL** |
| CNPJ / CPF | **CNPJ / CPF** |
| Data da Emissão | **DATA DA EMISSÃO** (dd/mm/aaaa) |

Second row:

| Field | Label |
|-------|-------|
| Endereço | **ENDEREÇO** |
| Bairro / Distrito | **BAIRRO / DISTRITO** |
| CEP | **CEP** |
| Data Entrada / Saída | **DATA DE ENTRADA / SAÍDA** |

Third row:

| Field | Label |
|-------|-------|
| Município | **MUNICÍPIO** |
| UF | **UF** |
| Fone / Fax | **FONE / FAX** |
| Inscrição Estadual | **INSCRIÇÃO ESTADUAL** |
| Hora Entrada / Saída | **HORA DE ENTRADA / SAÍDA** |

---

#### QUADRO 3 — Fatura (optional; omit if not applicable)

Header: **"FATURA"**

Contains installment/billing info (Número da Fatura, Vencimento, Valor). For retail cash sales this quadro is typically omitted or left blank. The project's crediário payments do not map to NF-e duplicatas — leave this block blank.

---

#### QUADRO 4 — Dados do Produto / Serviço (variable height — main table)

Header: **"DADOS DO PRODUTO / SERVIÇO"**

This is the items table. Columns (standard layout, portrait):

| # | Column Header | Abbrev. Used | Content | Approx Width |
|---|--------------|-------------|---------|-------------|
| 1 | CÓDIGO | CÓD. | Product code | 12% |
| 2 | DESCRIÇÃO DO PRODUTO / SERVIÇO | DESCRIÇÃO | Product name | 30% |
| 3 | NCM/SH | NCM | NCM code (8 digits) | 8% |
| 4 | CST | CST | ICMS CST code (3 digits) OR CSOSN (for Simples Nacional) | 5% |
| 5 | CFOP | CFOP | 4-digit CFOP code | 6% |
| 6 | UNID. | UN | Unit of measure | 5% |
| 7 | QUANT. | QTDE | Quantity | 7% |
| 8 | VALOR UNIT. | VL. UNIT. | Unit price | 10% |
| 9 | VALOR TOTAL | VL. TOTAL | Line total (qty × unit price) | 10% |
| 10 | B. CALC. ICMS | BC ICMS | ICMS calculation base | — |
| 11 | ALÍQ. ICMS | AL. ICMS | ICMS rate % | — |
| 12 | VL. ICMS | ICMS | ICMS value | — |
| 13 | VL. IPI | IPI | IPI value | — |
| 14 | ALÍQ. IPI | AL. IPI | IPI rate % | — |

**Note on columns:** The full set (columns 10–14) is often merged or split across two sub-rows per product when space is tight. For a minimally compliant-looking layout, the mandatory visible columns are 1–9 plus at minimum one tax column. Columns 10–14 can be present but zeroed. Omitting them entirely may make the document look incomplete — include them zeroed.

---

#### QUADRO 5 — Cálculo do Imposto (~14 mm tall)

Header: **"CÁLCULO DO IMPOSTO"**

Single row of labeled boxes, left to right:

| Label | Content |
|-------|---------|
| **BASE DE CÁLCULO DO ICMS** | Numeric — sum of ICMS bases |
| **VALOR DO ICMS** | Numeric — sum of ICMS values |
| **BASE DE CÁLCULO DO ICMS ST** | Numeric — ICMS substituição base |
| **VALOR DO ICMS ST** | Numeric — ICMS substituição value |
| **VALOR TOTAL DOS PRODUTOS** | Sum of all line totals (before other additions) |
| **VALOR DO FRETE** | Freight cost |
| **VALOR DO SEGURO** | Insurance |
| **DESCONTO** | Total discount applied |
| **OUTRAS DESPESAS ACESSÓRIAS** | Other accessory costs |
| **VALOR DO IPI** | IPI total |
| **VALOR TOTAL DA NF** | Grand total (bold, prominent) |

---

#### QUADRO 6 — Transportador / Volumes Transportados (~16 mm tall)

Header: **"TRANSPORTADOR / VOLUMES TRANSPORTADOS"**

Row 1:

| Label | Content |
|-------|---------|
| **RAZÃO SOCIAL** | Transporter name |
| **FRETE POR CONTA** | "0-EMITENTE" or "1-DESTINATÁRIO" or "9-SEM FRETE" |
| **CÓDIGO ANTT** | ANTT registration code |
| **PLACA DO VEÍCULO** | Vehicle plate |
| **UF** | State |
| **CNPJ / CPF** | Transporter CNPJ |

Row 2:

| Label | Content |
|-------|---------|
| **ENDEREÇO** | Transporter address |
| **MUNICÍPIO** | City |
| **UF** | State |
| **INSCRIÇÃO ESTADUAL** | IE |

Row 3 — Volumes:

| Label | Content |
|-------|---------|
| **QUANTIDADE** | Number of packages |
| **ESPÉCIE** | Package type (CAIXA, etc.) |
| **MARCA** | Brand mark |
| **NUMERAÇÃO** | Volume numbering |
| **PESO BRUTO** | Gross weight (kg) |
| **PESO LÍQUIDO** | Net weight (kg) |

For retail store-pickup sales (no transport), fill "FRETE POR CONTA" = "9-SEM FRETE" and leave remaining fields blank.

---

#### QUADRO 7 — Dados Adicionais (~20 mm tall or dynamic)

Header: **"DADOS ADICIONAIS"**

Two side-by-side sub-sections:

| Sub-section | Label | Content |
|-------------|-------|---------|
| Left (~60%) | **INFORMAÇÕES COMPLEMENTARES** | Free text: obs, tributos aproximados, crediário terms, "Documento emitido sem valor fiscal" note, etc. |
| Right (~40%) | **RESERVADO AO FISCO** | Blank (reserved for tax authority stamps/use) |

This is where the "SEM VALOR FISCAL" notice can be repeated in text form.

---

#### QUADRO 8 — Duplicatas / Cobranças (optional)

Only used for billing/installment invoices. Omit or leave blank for this project.

---

### 1.4 Access Key Structure (44 digits)

```
cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + série (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
```

For placeholder use: generate a dummy 44-digit sequence. Safe placeholder:
```
00 0000 00000000000000 55 001 000000001 1 00000000 0
```
Print it in 11 blocks of 4 digits each: `0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000`

The barcode (CODE-128C) encodes these 44 digits. jsPDF does not natively draw CODE-128C — use `JsBarcode` (renders to SVG/canvas then `doc.addImage()`) or `bwip-js` (pure JS barcode renderer). This is a rendering dependency to plan for.

### 1.5 DANFE A4 — jsPDF Coordinate Reference

Based on 210 × 297 mm, 7 mm margins, working width = 196 mm:

| Block | Y start (mm) | Approx height (mm) |
|-------|-------------|-------------------|
| Disclaimer band (SEM VALOR FISCAL) | 7 | 6 |
| Quadro 0 — Header (emitter + DANFE label + barcode) | 13 | 38 |
| Quadro 1 — Natureza / Protocol / CNPJ | 51 | 20 |
| Quadro 2 — Destinatário | 71 | 22 |
| Quadro 3 — Fatura (optional) | 93 | 10 |
| Quadro 4 — Dados do Produto (dynamic) | 103 | variable (min 40, expands with items) |
| Quadro 5 — Cálculo do Imposto | Y_after_products | 18 |
| Quadro 6 — Transportador | Y_after_calc | 22 |
| Quadro 7 — Dados Adicionais | Y_after_transp | 25 |

If products overflow the first page: carry overflow to page 2, repeat the barcode header on page 2, add page numbering "Folha 1/2" etc.

---

## Part 2: DANFE-NFCe — Nota Fiscal de Consumidor Eletrônica (model 65, cupom)

### 2.1 Page Setup

| Property | Value |
|----------|-------|
| Paper width | Minimum 56 mm; standard thermal printer = **80 mm** (use 80 mm for this project) |
| Paper height | Variable/continuous roll — jsPDF: use dynamic height, calculate at runtime |
| Left/right margins | Minimum 2 mm each side (use 3–4 mm for readability) |
| Working width | 80 mm − (2 × 4 mm margins) = 72 mm |
| Font | Helvetica, sizes 7–10pt |
| QR Code | Minimum 25 mm × 25 mm (22 mm content + 3 mm quiet zone); center on page or left-aligned |

### 2.2 Mandatory "Sem Valor Fiscal" Disclaimer for NFCe

Same principle as DANFE: since not transmitted to SEFAZ, the cupom must prominently say it has no fiscal value. Use:
```
DOCUMENTO SEM VALOR FISCAL
NÃO AUTORIZADO NA SEFAZ
```
Printed bold, centered, immediately after the emitter header.

For the official homologation-environment wording (also safe to use):
```
EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL
```

### 2.3 Division Order (top to bottom)

The official DANFE-NFCe specification (Manual de Padrões Técnicos v4.1 and v6.0) defines 9 divisions. This project maps them as follows:

---

#### Divisão I — Cabeçalho / Emitente

Centered, in order:
1. Store name (Razão Social) — bold, large (10–12pt)
2. CNPJ: `NN.NNN.NNN/NNNN-NN`
3. Inscrição Estadual (IE): `IE: XXXXXXXX` (or "ISENTO" if exempt)
4. Full address: logradouro, número
5. Bairro, Município – UF
6. CEP: `NN.NNN-NNN`
7. Fone: `(NN) NNNNN-NNNN`

---

#### Divisão II — Identificação do Documento

Separator line, then centered bold:
```
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
```
This exact label is **mandatory** (the official spec calls for this centered text in uppercase).

Below it (if "sem valor fiscal"):
```
DOCUMENTO SEM VALOR FISCAL — NÃO AUTORIZADO NA SEFAZ
```

---

#### Divisão III — Dados dos Produtos / Serviços

Header line: `ITEM    DESCRIÇÃO    QTDE    UN.    VL. UNIT.    VL. TOTAL`

Because the cupom is narrow, a two-line-per-item format is common:

**Line 1:** Item number + product name (full width)
**Line 2:** Qtde × VL. UNIT. = VL. TOTAL (right-aligned, or tabbed)

Example:
```
001 CIMENTO VOTORAN SC 50KG
    5,000 UN  R$ 38,90   R$ 194,50
```

The column set required per item:
- Número sequencial do item (001, 002, …)
- Descrição do produto (name)
- Quantidade (with decimal places as needed)
- Unidade de medida (UN, KG, MT, etc.)
- Valor unitário
- Valor total do item

NCM, CFOP, and CST are **not required to print on the NFCe cupom** (they are in the XML, not on the DANFE-NFCe). This significantly simplifies the item table for the thermal receipt.

---

#### Divisão III-A — Totalizadores

After all items, a horizontal separator, then:

| Label | Content |
|-------|---------|
| Qtde. total de itens | Item count |
| Subtotal | Sum before discount |
| Desconto | Discount amount (show as negative) |
| **VALOR TOTAL R$** | Grand total (bold) |

Then payment methods:

| Label | Content |
|-------|---------|
| Forma de Pagamento | Method name (DINHEIRO, CARTÃO CRÉDITO, PIX, CREDIÁRIO, etc.) |
| Valor | Amount per method |
| Troco | Change given (if cash) |

---

#### Divisão IV — Consulta via Chave de Acesso

Separator line, then:
```
Consulte pela Chave de Acesso em
[SEFAZ URL — e.g., www.sefaz.go.gov.br/consulta-nfce]
```
Then the 44-digit access key in 11 groups of 4:
```
NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN NNNN
```
For this project use the placeholder key: all zeros or a recognizable test pattern.

---

#### Divisão V — QR Code

The QR Code image, centered (or left-aligned with text to its right).
- Minimum printed size: 25 mm × 25 mm
- For a non-transmitted document: generate a QR code containing a placeholder URL or the text "SEM VALOR FISCAL" — do not generate a valid SEFAZ authentication URL.
- jsPDF approach: generate QR code as a data URL using `qrcode` npm package (or `qrcode.react` rendered to canvas), then `doc.addImage(dataUrl, 'PNG', x, y, 25, 25)`.

Placeholder QR content:
```
https://www.sefaz.go.gov.br/consulta-nfce?chave=00000000000000000000000000000000000000000000&sem_valor_fiscal=1
```

---

#### Divisão VI — Informações do Consumidor

```
CONSUMIDOR
Nome: [client name or "NÃO IDENTIFICADO"]
CPF/CNPJ: [document or "CONSUMIDOR NÃO IDENTIFICADO"]
```
This section is **optional for in-store sales to anonymous customers**. When a client is identified in the sale, print their name and CPF/CNPJ. When not identified, print "CONSUMIDOR NÃO IDENTIFICADO" or omit the section.

---

#### Divisão VII — Identificação da NFCe e Protocolo de Autorização

```
NFC-e nº XXXXXXXXX  Série NNN
Emissão: DD/MM/AAAA HH:MM:SS

PROTOCOLO DE AUTORIZAÇÃO: [blank or "NÃO AUTORIZADO"]
Data e Hora de Autorização: [blank]
```
For this project:
- NFC-e nº: use `sale.id.slice(0, 9)` or a sequential counter
- Série: "001" (placeholder)
- Emissão: `sale.createdAt` formatted
- Protocolo: leave blank or print "SEM PROTOCOLO — DOCUMENTO NÃO AUTORIZADO"

---

#### Divisão VIII — Área de Mensagem Fiscal

Reserved for SEFAZ-mandated fiscal messages (from XML field `infAdFisco`). For this project print:
```
DOCUMENTO EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
```
Centered, bold, in a distinct area.

---

#### Divisão IX — Mensagem de Interesse do Contribuinte

Optional free text from the store. Suggested content:
```
Obrigado pela preferência!
RC Ferragista — (62) 99275-1884
```
Also a good place to add the "Tributos Aproximados (Lei 12.741/2012): R$ 0,00" notice if desired.

---

### 2.4 NFCe Cupom — jsPDF Coordinate Reference (80 mm paper)

Working width = 80 mm, left margin = 4 mm, right margin = 4 mm, text start X = 4, right edge X = 76.

Height is dynamic. Approximate heights per block at common font sizes:

| Block | Approx height (mm) |
|-------|-------------------|
| Divisão I — Emitente (6–7 lines @ 4mm each) | 28 |
| Divisão II — Document title (2 lines) | 10 |
| Disclaimer band | 6 |
| Separador | 1 |
| Divisão III — Items (each item = 2 lines × 4 mm = ~8 mm/item) | 8 × n_items |
| Separador | 1 |
| Divisão III-A — Totais (5–7 lines) | 24 |
| Separador | 1 |
| Divisão IV — Chave (3 lines) | 14 |
| Divisão V — QR Code | 30 |
| Divisão VI — Consumidor (3 lines) | 12 |
| Divisão VII — NFCe ID / Protocolo (4 lines) | 16 |
| Divisão VIII — Mensagem Fiscal (2 lines) | 8 |
| Divisão IX — Mensagem contribuinte (2 lines) | 8 |
| Bottom margin | 5 |

**Estimated total height:** 28 + 10 + 6 + 1 + (8n) + 1 + 24 + 1 + 14 + 30 + 12 + 16 + 8 + 8 + 5 = **164 + 8n mm**

For 10 items: ~244 mm. For 20 items: ~324 mm. Use this formula to set `format: [80, calculatedHeight]` in jsPDF constructor.

---

## Part 3: Data Mapping — What We Have vs. Placeholder

### 3.1 DANFE (NFe A4)

| DANFE Field | Source in App | Status | Placeholder if missing |
|-------------|--------------|--------|----------------------|
| Razão Social (emitente) | `StoreSettings.storeName` | AVAILABLE | — |
| CNPJ (emitente) | `StoreSettings.cnpj` | AVAILABLE | — |
| IE (emitente) | Not in `StoreSettings` | MISSING | "ISENTO" or blank |
| Endereço (emitente) | `StoreSettings.address`, `.city`, `.cep` | AVAILABLE | — |
| Fone (emitente) | `StoreSettings.phone` | AVAILABLE | — |
| NFe Número | Not in `Sale` | MISSING | Use `sale.id.slice(0,9)` (not a real NF-e number) |
| Série | Not in `Sale` | MISSING | "001" |
| Data de Emissão | `sale.createdAt` | AVAILABLE | — |
| Hora de Emissão | `sale.createdAt` | AVAILABLE | — |
| Natureza da Operação | Not in `Sale` | MISSING | "VENDA DE MERCADORIAS A CONSUMIDOR" |
| Protocolo de Autorização | Not in `Sale` (no SEFAZ) | MISSING (by design) | Blank / "SEM PROTOCOLO" |
| Chave de Acesso (44 digits) | Not in `Sale` | MISSING (by design) | Generated placeholder (zeros) |
| Destinatário — Nome | `sale.clientName` or `Client.name` | AVAILABLE (optional) | "CONSUMIDOR" |
| Destinatário — CPF/CNPJ | `Client.document` | AVAILABLE (optional) | Blank |
| Destinatário — Endereço | `Client.address`, `.city` | AVAILABLE (optional) | Blank |
| Produto — Código | `SaleItem.productId` (truncated) | AVAILABLE | — |
| Produto — Descrição | `SaleItem.productName` | AVAILABLE | — |
| Produto — NCM | Not in `Product` | MISSING | "0000.00.00" |
| Produto — CST/CSOSN | Not in `Product` | MISSING | "400" (CSOSN Simples) or "00" |
| Produto — CFOP | Not in `Product` | MISSING | "5102" (venda mercadoria p/ consumidor) |
| Produto — Unidade | `Product.unit` | AVAILABLE | — |
| Produto — Quantidade | `SaleItem.quantity` | AVAILABLE | — |
| Produto — Valor Unit. | `SaleItem.unitPrice` | AVAILABLE | — |
| Produto — Valor Total | `SaleItem.total` | AVAILABLE | — |
| Produto — BC ICMS | Not computed | MISSING | "0,00" |
| Produto — Alíq. ICMS | Not computed | MISSING | "0,00" |
| Produto — Vlr ICMS | Not computed | MISSING | "0,00" |
| Produto — Vlr IPI | Not computed | MISSING | "0,00" |
| Cálculo — BC ICMS total | Not computed | MISSING | "0,00" |
| Cálculo — Vlr ICMS total | Not computed | MISSING | "0,00" |
| Cálculo — BC ICMS ST | Not computed | MISSING | "0,00" |
| Cálculo — Vlr ICMS ST | Not computed | MISSING | "0,00" |
| Cálculo — Vlr Total Produtos | Computable from items | AVAILABLE | sum of `SaleItem.total` |
| Cálculo — Frete | Not in `Sale` | MISSING | "0,00" |
| Cálculo — Seguro | Not in `Sale` | MISSING | "0,00" |
| Cálculo — Desconto | `sale.discount` | AVAILABLE | — |
| Cálculo — Outras Despesas | Not in `Sale` | MISSING | "0,00" |
| Cálculo — Vlr IPI | Not computed | MISSING | "0,00" |
| **Cálculo — Valor Total NF** | `sale.total` | AVAILABLE | — |
| Transporte — Razão Social | Not in `Sale` | MISSING | Blank (sem frete) |
| Transporte — Frete por conta | Not in `Sale` | MISSING | "9-SEM FRETE" |
| Informações Complementares | Not in `Sale` | MISSING | "Documento sem valor fiscal. Não autorizado na SEFAZ." |
| Tributos aprox. (Lei 12.741) | Not computed | MISSING | "R$ 0,00 (0%)" |

### 3.2 DANFE-NFCe (cupom 80mm)

| NFCe Field | Source in App | Status | Placeholder if missing |
|------------|--------------|--------|----------------------|
| Razão Social | `StoreSettings.storeName` | AVAILABLE | — |
| CNPJ | `StoreSettings.cnpj` | AVAILABLE | — |
| IE | Not in `StoreSettings` | MISSING | "ISENTO" |
| Endereço completo | `StoreSettings.address`, `.city`, `.cep` | AVAILABLE | — |
| Fone | `StoreSettings.phone` | AVAILABLE | — |
| NFCe Número | Not in `Sale` | MISSING | `sale.id.slice(0,9)` |
| Série | Not in `Sale` | MISSING | "001" |
| Data/Hora Emissão | `sale.createdAt` | AVAILABLE | — |
| Item nº | Position in `sale.items[]` | COMPUTABLE | — |
| Item Descrição | `SaleItem.productName` | AVAILABLE | — |
| Item Qtde | `SaleItem.quantity` | AVAILABLE | — |
| Item Unidade | `Product.unit` (via lookup or stored on SaleItem) | AVAILABLE | "UN" |
| Item Vlr Unit. | `SaleItem.unitPrice` | AVAILABLE | — |
| Item Vlr Total | `SaleItem.total` | AVAILABLE | — |
| Qtde total itens | `sale.items.length` | COMPUTABLE | — |
| Subtotal | `sale.subtotal` | AVAILABLE | — |
| Desconto | `sale.discount` | AVAILABLE | — |
| **Valor Total** | `sale.total` | AVAILABLE | — |
| Forma de Pagamento | `sale.paymentMethod` / `sale.paymentEntries[]` | AVAILABLE | — |
| Troco | Computable (cash paid − total) | COMPUTABLE | — |
| Consumidor Nome | `sale.clientName` | AVAILABLE (optional) | "NÃO IDENTIFICADO" |
| Consumidor CPF/CNPJ | `Client.document` (via lookup) | AVAILABLE (optional) | Blank |
| Chave de Acesso | Not in `Sale` | MISSING (by design) | 44-digit placeholder string |
| URL consulta SEFAZ | State-specific | MISSING | Generic SEFAZ URL |
| QR Code | Not generated | MISSING (by design) | Placeholder QR with disclaimer text |
| Protocolo autorização | Not in `Sale` | MISSING (by design) | "NÃO AUTORIZADO" |
| Data/Hora Autorização | Not in `Sale` | MISSING (by design) | Blank |

---

## Part 4: Mandatory Legal Wordings (complete list in Portuguese)

### On DANFE (NFe A4):

1. `"DANFE"` — large text in center column header (mandatory label)
2. `"DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"` — below DANFE label
3. `"IDENTIFICAÇÃO DO EMITENTE"` — left column header label
4. `"CHAVE DE ACESSO"` — label above the 44-digit key
5. `"Consulte a autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br"` — below barcode/key
6. `"DESTINATÁRIO / REMETENTE"` — section header
7. `"DADOS DO PRODUTO / SERVIÇO"` — section header
8. `"CÁLCULO DO IMPOSTO"` — section header
9. `"TRANSPORTADOR / VOLUMES TRANSPORTADOS"` — section header
10. `"DADOS ADICIONAIS"` — section header with subsections:
    - `"INFORMAÇÕES COMPLEMENTARES"`
    - `"RESERVADO AO FISCO"`
11. `"NATUREZA DA OPERAÇÃO"` — field label
12. `"PROTOCOLO DE AUTORIZAÇÃO DE USO"` — field label
13. Mandatory non-authorized disclaimer (this project):
    ```
    NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL
    ```

### On DANFE-NFCe (cupom 80mm):

1. `"DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA"` — mandatory centered title
2. `"Consulte pela Chave de Acesso em"` — before SEFAZ URL (required by spec, in lowercase exactly as shown)
3. `"CONSUMIDOR"` — consumer section label (when identified)
4. `"PROTOCOLO DE AUTORIZAÇÃO:"` — field label
5. `"EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL"` — mandatory when in test environment (with accented letters and en-dash as written)
6. For this project specifically, add:
    ```
    DOCUMENTO SEM VALOR FISCAL
    NÃO AUTORIZADO NA SEFAZ
    ```

---

## Part 5: Implementation Notes for jsPDF

### 5.1 Barcode (DANFE A4)

CODE-128C is not built into jsPDF. Recommended approach:
- Use `bwip-js` (MIT, no DOM dependency): `bwipjs.toBuffer({bcid:'code128', text:'[44-digit-key]', ...})` → base64 PNG → `doc.addImage()`.
- Alternative: `jsbarcode` with a canvas element rendered first, then captured as base64.
- The barcode must be placed in the upper-right area of Quadro 0 (header), rotated 90 degrees if space is tight in portrait mode, or horizontal if there is room. Typical size: 70 mm wide × 12 mm tall (horizontal), or 12 mm wide × 50 mm tall (vertical).

### 5.2 QR Code (DANFE-NFCe)

- Use `qrcode` npm package: `QRCode.toDataURL(text, {width: 94, margin: 1})` → base64 PNG → `doc.addImage(dataUrl, 'PNG', x, y, 25, 25)`.
- Content for placeholder QR: any URL or the access key string with "SEM VALOR FISCAL" appended.
- Position: centered below Divisão IV (access key text), or left-aligned with Divisões VI+VII text to the right.

### 5.3 jsPDF Page Setup Calls

**DANFE A4:**
```typescript
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
// format 'a4' = [210, 297]
```

**DANFE-NFCe cupom (dynamic height):**
```typescript
const itemCount = sale.items.length;
const estimatedHeight = 164 + (8 * itemCount); // mm
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, estimatedHeight] });
```

### 5.4 Drawing Bordered Quadros

jsPDF `doc.rect(x, y, width, height)` draws the border boxes. Use `doc.setDrawColor(0)` for black borders and `doc.setLineWidth(0.3)` for standard borders. Section header labels are positioned inside the box at the top-left, in small bold font (6–7pt), with the value below or beside it in normal weight.

### 5.5 File Structure Recommendation

Create `src/lib/generateDANFE.ts` (NFe A4) and `src/lib/generateDANFEnfce.ts` (NFCe cupom), following the existing pattern of `src/lib/generateReceipt.ts`. Each exports:
- `generateDANFE(sale: Sale, client?: Client): jsPDF`
- `printDANFE(sale: Sale, client?: Client): void`
- `downloadDANFE(sale: Sale, client?: Client): void`

Helper: `src/lib/fiscalPlaceholders.ts` — exports constants for placeholder values (NCM, CFOP, CST, access key template, etc.).

### 5.6 New npm Dependencies

| Package | Purpose | Size impact |
|---------|---------|------------|
| `qrcode` | QR code generation to data URL | ~50 kB |
| `bwip-js` | CODE-128C barcode to PNG | ~300 kB |

Both are pure JS with no DOM dependency, compatible with Electron renderer process.

---

## Part 6: Confidence and Source Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| DANFE A4 section order | MEDIUM-HIGH | Confirmed by 5+ sources (senior.com.br, nfe.io, clicknotas.com.br, qive.com.br, MOC PR portal references) |
| DANFE A4 quadro labels (Portuguese) | MEDIUM | Consistently named across multiple secondary sources; primary MOC PDF was binary-compressed and unreadable |
| NFCe Divisão order (I–IX) | MEDIUM-HIGH | NT 2026.003 article, SEFAZ SP v4.1 manual search results, betosouzace.github.io HTML version of manual |
| NFCe mandatory label "DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA" | HIGH | Stated identically in multiple official and semi-official sources |
| NFCe "Consulte pela Chave de Acesso em" | HIGH | Stated in multiple sources including SEFAZ portal FAQ text |
| Paper dimensions (A4, 80mm) | HIGH | Universally confirmed |
| QR code minimum size (25×25mm) | HIGH | Stated in official DANFE NFCe manual references |
| Barcode type CODE-128C | HIGH | Stated in DANFE/Código de Barras MOC reference |
| Disclaimer wording "SEM VALOR FISCAL" | HIGH | Confirmed by multiple sources including actual SEFAZ homologation rejection messages |
| Tax field names (BC ICMS, Vlr ICMS, etc.) | MEDIUM | Confirmed field names; exact label abbreviations vary slightly between implementations |
| Product table exact column widths | LOW | Not specified by regulation; implementation choice within the spec |

---

## Sources

- SEFAZ SP — Manual de Especificações Técnicas do DANFE NFC-e QR Code v4.1: https://portal.fazenda.sp.gov.br/servicos/nfce/Downloads/
- SEFAZ Nacional — DANFE NFCe Manual de Padrões v6.0 (March 2025): https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=k/IuuaW4YiY%3D
- NT 2026.003 — DANFE Simplificado Tipo 2: https://blog.tecnospeed.com.br/nota-tecnica-2026-003-danfe-simplificado-tipo-2/
- DANFE-COM Manual (structure analogous to NFe/NFCe): https://blog.tecnospeed.com.br/danfe-com-manual-de-especificacoes-tecnicas-da-nfcom/
- MOC SEFAZ PR — DANFE e Código de Barras: http://moc.sped.fazenda.pr.gov.br/DanfeCodigoBarras.html
- MOC SEFAZ PR — DANFE e QR Code NFCe: http://moc.sped.fazenda.pr.gov.br/DanfeQrCodeNFCe.html
- NFCe HTML manual (betosouzace GitHub mirror): https://betosouzace.github.io/nfe-documentacao/20250324-Manual_de_Especificacoes_Tecnicas_do_DANFE_NFC-e_QR_Code.html
- DANFE-NFCe blog (tecnospeed): https://blog.tecnospeed.com.br/danfe-nfc-e-o-que-e-e-como-gerar/
- NFCe Guia SEFAZ PE: https://www.sefaz.pe.gov.br/Servicos/Nota-Fiscal-de-Consumidor-Eletronica/
- Vinco — "SEM VALOR FISCAL" explanation: https://ajuda.vinco.com.br/faq/32-icont-nfe-cte-sped/utilizacao-creator/86-esta-sendo-impressa-a-expressao-sem-valor-fiscal-na-area-resevada-ao-fisco-do-danfe-o-que-esta-acontecendo
- Maxiprod — "Sem valor fiscal" trigger: https://maxiprod.com.br/ajuda/notas-fiscais/notas-fiscais-perguntas-frequentes/o-que-significa-a-marca-dagua-sem-valor-fiscal-na-impressao-da-nota/
- NF-e campo fields guide: https://qive.com.br/blog/campos-nota-fiscal
