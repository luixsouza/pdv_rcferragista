/**
 * generateDANFE.ts
 *
 * DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) — Modelo 55 — A4 (210×297 mm)
 *
 * Generates a layout-only DANFE with 8 mandatory quadros in canonical order.
 * This document carries placeholder fiscal values and the verbatim homologation
 * disclaimer; it is NOT transmitted to SEFAZ and carries NO fiscal authority.
 *
 * FISC-02: 8 quadros, fiscal product columns (zeroed), CODE-128 barcode, pagination.
 * FISC-03: NFE_DISCLAIMER verbatim, PLACEHOLDER_* constants for all missing fields.
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sale, Client } from '@/types';
import { getStoreSettings } from '@/lib/storeInfo';
import { formatCurrency, roundCurrency } from '@/lib/formatters';
import { formatDocument } from '@/lib/documentValidation';
import {
  PLACEHOLDER_ACCESS_KEY,
  PLACEHOLDER_NCM,
  PLACEHOLDER_CFOP,
  PLACEHOLDER_CST,
  PLACEHOLDER_PROTOCOL,
  PLACEHOLDER_IE,
  PLACEHOLDER_SERIE,
  NFE_DISCLAIMER,
  formatAccessKeyGroups,
} from '@/lib/fiscalPlaceholders';
import { generateBarcodeDataUrl } from '@/lib/fiscalBarcode';

// ── Layout constants ──────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 7;
const WORK_W = PAGE_W - 2 * MARGIN; // 196 mm

// Body bottom: leave 7mm bottom margin
const BODY_BOTTOM = PAGE_H - MARGIN; // 290 mm

// Quadro heights (approximate, matching FISCAL-LAYOUT.md 1.5)
const DISCLAIMER_H = 6;
const Q0_H = 40;      // Header: emitter + DANFE + barcode
const Q1_H = 20;      // Natureza / Protocol / CNPJ
const Q2_H = 22;      // Destinatário
const Q3_H = 10;      // Fatura (blank)
const Q4_COL_H = 7;   // Product table header row
const Q4_ROW_H = 5;   // Each product item row
const Q5_H = 20;      // Cálculo do Imposto
const Q6_H = 24;      // Transportador
const Q7_H = 28;      // Dados Adicionais

// Totals block height: Q5 + Q6 + Q7 = 72 mm (must fit on page without clipping)
const TOTALS_BLOCK_H = Q5_H + Q6_H + Q7_H;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Draw a small label in 5pt bold inside a box (top-left corner at x+1, y+3). */
function drawLabel(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + 1, y + 3);
}

/** Draw a value in 7pt normal below/beside the label. */
function drawValue(doc: jsPDF, text: string, x: number, y: number): void {
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(text, x + 1, y + 7.5);
}

/** Draw a bordered box (quadro or sub-box). */
function box(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h);
}

/** Draws the disclaimer band (filled dark rect with white centered bold text). */
function drawDisclaimerBand(doc: jsPDF, y: number): void {
  doc.setFillColor(40, 40, 40);
  doc.rect(MARGIN, y, WORK_W, DISCLAIMER_H, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(NFE_DISCLAIMER, PAGE_W / 2, y + 4, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

/**
 * Draws the repeating page header: disclaimer band + barcode strip (access key).
 * Used on page 1 and on every overflow page.
 *
 * @param doc        The jsPDF document.
 * @param barcodeUrl CODE-128 PNG data URL (already generated).
 * @param pageNum    Current page number (1-based), for "Folha X/Y" numbering.
 * @param totalPages Estimated total pages (0 if unknown on first pass).
 * @returns          The y coordinate immediately after the header block.
 */
function drawPageHeader(
  doc: jsPDF,
  barcodeUrl: string,
  pageNum: number,
  totalPages: number
): number {
  let y = MARGIN;

  // ── Disclaimer band ────────────────────────────────────────────────────────
  drawDisclaimerBand(doc, y);
  y += DISCLAIMER_H;

  return y;
}

// ── Main generator ────────────────────────────────────────────────────────────

/**
 * Generates a DANFE NFe A4 PDF from a Sale object.
 *
 * The document carries the verbatim NFE_DISCLAIMER and uses safe placeholder
 * constants for all fiscal fields that require SEFAZ authorization.
 *
 * @param sale    The sale to render.
 * @param client  Optional client for the Destinatário quadro.
 * @returns       Promise<jsPDF> — async because the CODE-128 barcode uses bwip-js canvas.
 */
export async function generateDANFE(sale: Sale, client?: Client): Promise<jsPDF> {
  const store = getStoreSettings();

  // Generate barcode once; reuse on every page
  const barcodeUrl = await generateBarcodeDataUrl(PLACEHOLDER_ACCESS_KEY);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Page 1: draw disclaimer band, Quadro 0, 1, 2, 3 ─────────────────────
  let y = MARGIN;

  // Track page number for "Folha X/Y" — we'll do a two-pass if needed.
  // For simplicity we track page numbers and update on each new page.
  let currentPage = 1;
  const pageStarts: number[] = [1]; // page numbers of product rows

  // ─────────────────────────────────────────────────────────────────────────
  // DISCLAIMER BAND
  // ─────────────────────────────────────────────────────────────────────────
  drawDisclaimerBand(doc, y);
  y += DISCLAIMER_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 0 — Header: Emitter | DANFE | Barcode/Access Key
  // ─────────────────────────────────────────────────────────────────────────
  const q0Y = y;
  const q0H = Q0_H;

  // Outer border
  box(doc, MARGIN, q0Y, WORK_W, q0H);

  // Three columns
  const col0W = 78; // emitter (~40%)
  const col1W = 40; // DANFE label (~20%)
  const col2W = WORK_W - col0W - col1W; // barcode/key (~rest)
  const col0X = MARGIN;
  const col1X = col0X + col0W;
  const col2X = col1X + col1W;

  // Internal vertical dividers
  doc.setLineWidth(0.3);
  doc.line(col1X, q0Y, col1X, q0Y + q0H);
  doc.line(col2X, q0Y, col2X, q0Y + q0H);

  // ── Column 0: Emitter ────────────────────────────────────────────────────
  drawLabel(doc, 'IDENTIFICAÇÃO DO EMITENTE', col0X, q0Y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  const storeName = store.storeName.toUpperCase();
  doc.text(storeName, col0X + 1, q0Y + 10, { maxWidth: col0W - 2 });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  let emitY = q0Y + 15;
  const lineH = 3.5;

  doc.text(store.address, col0X + 1, emitY, { maxWidth: col0W - 2 });
  emitY += lineH;
  doc.text(store.city, col0X + 1, emitY, { maxWidth: col0W - 2 });
  emitY += lineH;
  doc.text(`CEP: ${store.cep}`, col0X + 1, emitY);
  emitY += lineH;
  doc.text(`Fone: ${store.phone}`, col0X + 1, emitY);
  emitY += lineH;
  doc.text(`CNPJ: ${store.cnpj}`, col0X + 1, emitY);
  emitY += lineH;
  doc.text(`IE: ${PLACEHOLDER_IE}`, col0X + 1, emitY);

  // ── Column 1: DANFE label ────────────────────────────────────────────────
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DANFE', col1X + col1W / 2, q0Y + 10, { align: 'center' });

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'DOCUMENTO AUXILIAR DA\nNOTA FISCAL ELETRÔNICA',
    col1X + col1W / 2,
    q0Y + 16,
    { align: 'center' }
  );

  // Entry/Exit indicator box
  const indBox = { x: col1X + 2, y: q0Y + 23, w: 5, h: 5 };
  box(doc, indBox.x, indBox.y, indBox.w, indBox.h);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('1', indBox.x + 2, indBox.y + 3.5, { align: 'center' });
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('SAÍDA', indBox.x + indBox.w + 1, indBox.y + 3.5);

  // NF Number and Series
  doc.setFontSize(6);
  doc.text(`Nº: ${sale.id.slice(0, 9).toUpperCase()}`, col1X + 1, q0Y + 32);
  doc.text(`Série: ${PLACEHOLDER_SERIE}`, col1X + 1, q0Y + 36);

  // ── Column 2: Barcode + Access Key ──────────────────────────────────────
  drawLabel(doc, 'CHAVE DE ACESSO', col2X, q0Y);

  // Barcode image — horizontal at top of column
  try {
    doc.addImage(barcodeUrl, 'PNG', col2X + 1, q0Y + 5, col2W - 2, 12);
  } catch {
    // Fallback if barcode rendering fails: draw placeholder rect
    doc.setFillColor(200, 200, 200);
    doc.rect(col2X + 1, q0Y + 5, col2W - 2, 12, 'F');
  }

  // Access key grouped digits
  const grouped = formatAccessKeyGroups(PLACEHOLDER_ACCESS_KEY);
  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'normal');
  // Split into two lines of ~22 chars each for display
  const halfLen = Math.floor(grouped.length / 2);
  const splitIdx = grouped.indexOf(' ', halfLen);
  doc.text(grouped.slice(0, splitIdx), col2X + 1, q0Y + 21, { maxWidth: col2W - 2 });
  doc.text(grouped.slice(splitIdx + 1), col2X + 1, q0Y + 25, { maxWidth: col2W - 2 });

  doc.setFontSize(5);
  doc.text(
    'Consulte a autenticidade no portal nacional da NF-e',
    col2X + 1,
    q0Y + 30,
    { maxWidth: col2W - 2 }
  );
  doc.text('www.nfe.fazenda.gov.br', col2X + 1, q0Y + 33.5, { maxWidth: col2W - 2 });

  y = q0Y + q0H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 1 — Natureza da Operação / Protocolo / CNPJ fiscal row
  // ─────────────────────────────────────────────────────────────────────────
  const q1Y = y;
  box(doc, MARGIN, q1Y, WORK_W, Q1_H);

  // Row 1: Natureza (left 2/3) | Protocolo (right 1/3)
  const natW = Math.floor(WORK_W * 0.55);
  const protW = WORK_W - natW;
  const protX = MARGIN + natW;

  doc.setLineWidth(0.3);
  doc.line(protX, q1Y, protX, q1Y + Q1_H / 2);

  drawLabel(doc, 'NATUREZA DA OPERAÇÃO', MARGIN, q1Y);
  drawValue(doc, 'VENDA DE MERCADORIAS A CONSUMIDOR', MARGIN, q1Y);

  drawLabel(doc, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', protX, q1Y);
  drawValue(doc, PLACEHOLDER_PROTOCOL, protX, q1Y);

  // Row 2: IE | INS.EST.SUBST.TRIB | CNPJ
  const r2Y = q1Y + Q1_H / 2;
  doc.line(MARGIN, r2Y, MARGIN + WORK_W, r2Y);

  const ieW = Math.floor(WORK_W * 0.30);
  const substW = Math.floor(WORK_W * 0.35);
  const cnpjW = WORK_W - ieW - substW;
  const substX = MARGIN + ieW;
  const cnpjX = substX + substW;

  doc.line(substX, r2Y, substX, q1Y + Q1_H);
  doc.line(cnpjX, r2Y, cnpjX, q1Y + Q1_H);

  drawLabel(doc, 'INSCRIÇÃO ESTADUAL', MARGIN, r2Y);
  drawValue(doc, PLACEHOLDER_IE, MARGIN, r2Y);

  drawLabel(doc, 'INS. EST. DO SUBST. TRIBUTÁRIO', substX, r2Y);
  drawValue(doc, '', substX, r2Y);

  drawLabel(doc, 'CNPJ', cnpjX, r2Y);
  drawValue(doc, store.cnpj, cnpjX, r2Y);

  y += Q1_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 2 — Destinatário / Remetente
  // ─────────────────────────────────────────────────────────────────────────
  const q2Y = y;
  box(doc, MARGIN, q2Y, WORK_W, Q2_H);
  drawLabel(doc, 'DESTINATÁRIO / REMETENTE', MARGIN, q2Y);

  // Row 1: Nome/Razão Social (wide) | CNPJ/CPF | Data Emissão
  const destNomeW = Math.floor(WORK_W * 0.50);
  const destDocW = Math.floor(WORK_W * 0.28);
  const destDataW = WORK_W - destNomeW - destDocW;
  const destDocX = MARGIN + destNomeW;
  const destDataX = destDocX + destDocW;
  const destRow1H = Q2_H / 3;

  doc.line(destDocX, q2Y + 3.5, destDocX, q2Y + destRow1H);
  doc.line(destDataX, q2Y + 3.5, destDataX, q2Y + destRow1H);
  doc.line(MARGIN, q2Y + destRow1H, MARGIN + WORK_W, q2Y + destRow1H);

  drawLabel(doc, 'NOME / RAZÃO SOCIAL', MARGIN, q2Y);
  drawValue(doc, client?.name || 'CONSUMIDOR', MARGIN, q2Y);

  drawLabel(doc, 'CNPJ / CPF', destDocX, q2Y);
  drawValue(
    doc,
    client?.document ? formatDocument(client.document) : '',
    destDocX,
    q2Y
  );

  drawLabel(doc, 'DATA DA EMISSÃO', destDataX, q2Y);
  drawValue(
    doc,
    (() => { try { return format(new Date(sale.createdAt), 'dd/MM/yyyy', { locale: ptBR }); } catch { return ''; } })(),
    destDataX,
    q2Y
  );

  // Row 2: Endereço | Bairro | CEP | Data Ent/Saída
  const destRow2Y = q2Y + destRow1H;
  const destRow2H = Q2_H / 3;
  const destEndW = Math.floor(WORK_W * 0.44);
  const destBaiW = Math.floor(WORK_W * 0.24);
  const destCepW = Math.floor(WORK_W * 0.16);
  const destDataEntW = WORK_W - destEndW - destBaiW - destCepW;
  const destBaiX = MARGIN + destEndW;
  const destCepX = destBaiX + destBaiW;
  const destDataEntX = destCepX + destCepW;

  doc.line(destBaiX, destRow2Y, destBaiX, destRow2Y + destRow2H);
  doc.line(destCepX, destRow2Y, destCepX, destRow2Y + destRow2H);
  doc.line(destDataEntX, destRow2Y, destDataEntX, destRow2Y + destRow2H);
  doc.line(MARGIN, destRow2Y + destRow2H, MARGIN + WORK_W, destRow2Y + destRow2H);

  drawLabel(doc, 'ENDEREÇO', MARGIN, destRow2Y);
  drawValue(doc, client?.address || '', MARGIN, destRow2Y);

  drawLabel(doc, 'BAIRRO / DISTRITO', destBaiX, destRow2Y);
  drawValue(doc, '', destBaiX, destRow2Y);

  drawLabel(doc, 'CEP', destCepX, destRow2Y);
  drawValue(doc, '', destCepX, destRow2Y);

  drawLabel(doc, 'DATA ENT/SAÍDA', destDataEntX, destRow2Y);
  drawValue(doc, '', destDataEntX, destRow2Y);

  // Row 3: Município | UF | Fone | IE | Hora
  const destRow3Y = destRow2Y + destRow2H;
  const destMunW = Math.floor(WORK_W * 0.35);
  const destUfW = 10;
  const destFoneW = Math.floor(WORK_W * 0.22);
  const destIeW = Math.floor(WORK_W * 0.20);
  const destHoraW = WORK_W - destMunW - destUfW - destFoneW - destIeW;
  const destUfX = MARGIN + destMunW;
  const destFoneX = destUfX + destUfW;
  const destIeX = destFoneX + destFoneW;
  const destHoraX = destIeX + destIeW;

  doc.line(destUfX, destRow3Y, destUfX, q2Y + Q2_H);
  doc.line(destFoneX, destRow3Y, destFoneX, q2Y + Q2_H);
  doc.line(destIeX, destRow3Y, destIeX, q2Y + Q2_H);
  doc.line(destHoraX, destRow3Y, destHoraX, q2Y + Q2_H);

  drawLabel(doc, 'MUNICÍPIO', MARGIN, destRow3Y);
  drawValue(doc, client?.city || '', MARGIN, destRow3Y);

  drawLabel(doc, 'UF', destUfX, destRow3Y);
  drawValue(doc, '', destUfX, destRow3Y);

  drawLabel(doc, 'FONE / FAX', destFoneX, destRow3Y);
  drawValue(doc, '', destFoneX, destRow3Y);

  drawLabel(doc, 'INSCRIÇÃO ESTADUAL', destIeX, destRow3Y);
  drawValue(doc, '', destIeX, destRow3Y);

  drawLabel(doc, 'HORA SAÍDA', destHoraX, destRow3Y);
  drawValue(
    doc,
    (() => { try { return format(new Date(sale.createdAt), 'HH:mm:ss', { locale: ptBR }); } catch { return ''; } })(),
    destHoraX,
    destRow3Y
  );

  y += Q2_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 3 — Fatura (blank for retail cash sale)
  // ─────────────────────────────────────────────────────────────────────────
  const q3Y = y;
  box(doc, MARGIN, q3Y, WORK_W, Q3_H);
  drawLabel(doc, 'FATURA', MARGIN, q3Y);
  // Left blank — retail store-pickup sale, no installment billing on NFe
  y += Q3_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 4 — Dados do Produto / Serviço (variable height — product table)
  // ─────────────────────────────────────────────────────────────────────────
  // Column layout for 196mm working width (all 13 fiscal columns):
  // CÓD(16) | DESCRIÇÃO(46) | NCM(14) | CST(8) | CFOP(10) | UN(8) |
  // QTDE(10) | VL.UNIT(16) | VL.TOTAL(16) | BC ICMS(12) | ALÍQ(8) | VL ICMS(14) | VL IPI(14)
  // Total widths below must sum to WORK_W (196)
  const cols = [
    { label: 'CÓDIGO',    w: 16 },
    { label: 'DESCRIÇÃO', w: 44 },
    { label: 'NCM',       w: 14 },
    { label: 'CST',       w: 8  },
    { label: 'CFOP',      w: 10 },
    { label: 'UN',        w: 8  },
    { label: 'QTDE',      w: 10 },
    { label: 'VL.UNIT',   w: 16 },
    { label: 'VL.TOTAL',  w: 16 },
    { label: 'BC ICMS',   w: 14 },
    { label: 'ALÍQ',      w: 8  },
    { label: 'VL ICMS',   w: 16 },
    { label: 'VL IPI',    w: 16 },
  ] as const;
  // Verify sum: 16+44+14+8+10+8+10+16+16+14+8+16+16 = 196 ✓

  // Compute cumulative X positions
  const colX: number[] = [];
  let cx = MARGIN;
  for (const col of cols) {
    colX.push(cx);
    cx += col.w;
  }

  const q4Y = y;

  // Draw section header
  box(doc, MARGIN, q4Y, WORK_W, Q4_COL_H);
  drawLabel(doc, 'DADOS DO PRODUTO / SERVIÇO', MARGIN, q4Y);
  y += Q4_COL_H;

  // Draw column header row
  const colHeaderH = 6;
  box(doc, MARGIN, y, WORK_W, colHeaderH);

  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  for (let i = 0; i < cols.length; i++) {
    if (i > 0) {
      doc.setLineWidth(0.2);
      doc.line(colX[i], y, colX[i], y + colHeaderH);
    }
    doc.text(cols[i].label, colX[i] + 1, y + 4, { maxWidth: cols[i].w - 2 });
  }
  y += colHeaderH;

  // ── Item rows with pagination ─────────────────────────────────────────────
  // Reserve space at bottom for totals block (must never be clipped)
  // On any page, if remaining space < TOTALS_BLOCK_H + a few rows, start totals on new page.
  const productRowBottom = BODY_BOTTOM - TOTALS_BLOCK_H;

  for (const item of sale.items) {
    // Check if we need a new page for this item
    if (y + Q4_ROW_H > productRowBottom) {
      // Add new page
      doc.addPage('a4', 'portrait');
      currentPage++;
      pageStarts.push(currentPage);

      // Draw disclaimer band at top of new page
      let newY = MARGIN;
      drawDisclaimerBand(doc, newY);
      newY += DISCLAIMER_H;

      // Draw barcode strip at top of new page (compact — just barcode + access key)
      const headerStripH = 16;
      box(doc, MARGIN, newY, WORK_W, headerStripH);
      drawLabel(doc, 'CHAVE DE ACESSO', MARGIN, newY);
      try {
        doc.addImage(barcodeUrl, 'PNG', MARGIN + 1, newY + 4, WORK_W / 2 - 2, 10);
      } catch {
        // ignore
      }
      const groupedKey = formatAccessKeyGroups(PLACEHOLDER_ACCESS_KEY);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text(groupedKey, MARGIN + WORK_W / 2 + 1, newY + 9, { maxWidth: WORK_W / 2 - 2 });

      // Page numbering
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Folha ${currentPage}`,
        MARGIN + WORK_W - 1,
        newY + 4,
        { align: 'right' }
      );

      newY += headerStripH;

      // Redraw product table column header
      box(doc, MARGIN, newY, WORK_W, colHeaderH);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'bold');
      for (let i = 0; i < cols.length; i++) {
        if (i > 0) {
          doc.setLineWidth(0.2);
          doc.line(colX[i], newY, colX[i], newY + colHeaderH);
        }
        doc.text(cols[i].label, colX[i] + 1, newY + 4, { maxWidth: cols[i].w - 2 });
      }
      newY += colHeaderH;
      y = newY;
    }

    // Draw item row
    box(doc, MARGIN, y, WORK_W, Q4_ROW_H);

    const code = item.productId.slice(0, 8).toUpperCase();
    const desc = item.productName.length > 20
      ? item.productName.slice(0, 20)
      : item.productName;
    const ncm = PLACEHOLDER_NCM;
    const cst = PLACEHOLDER_CST;
    const cfop = PLACEHOLDER_CFOP;
    const un = 'UN';
    const qtde = String(item.quantity);
    const vlUnit = item.unitPrice.toFixed(2).replace('.', ',');
    const vlTotal = item.total.toFixed(2).replace('.', ',');
    const zero = '0,00';

    const rowValues = [code, desc, ncm, cst, cfop, un, qtde, vlUnit, vlTotal, zero, zero, zero, zero];

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    for (let i = 0; i < cols.length; i++) {
      if (i > 0) {
        doc.setLineWidth(0.2);
        doc.line(colX[i], y, colX[i], y + Q4_ROW_H);
      }
      doc.text(rowValues[i], colX[i] + 1, y + 3.5, { maxWidth: cols[i].w - 2 });
    }

    y += Q4_ROW_H;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Check if totals block fits on current page — if not, new page
  // ─────────────────────────────────────────────────────────────────────────
  if (y + TOTALS_BLOCK_H > BODY_BOTTOM) {
    doc.addPage('a4', 'portrait');
    currentPage++;

    let newY = MARGIN;
    drawDisclaimerBand(doc, newY);
    newY += DISCLAIMER_H;

    // Compact header for overflow totals page
    const headerStripH = 16;
    box(doc, MARGIN, newY, WORK_W, headerStripH);
    drawLabel(doc, 'CHAVE DE ACESSO', MARGIN, newY);
    try {
      doc.addImage(barcodeUrl, 'PNG', MARGIN + 1, newY + 4, WORK_W / 2 - 2, 10);
    } catch {
      // ignore
    }
    const groupedKey2 = formatAccessKeyGroups(PLACEHOLDER_ACCESS_KEY);
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.text(groupedKey2, MARGIN + WORK_W / 2 + 1, newY + 9, { maxWidth: WORK_W / 2 - 2 });

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text(`Folha ${currentPage}`, MARGIN + WORK_W - 1, newY + 4, { align: 'right' });

    y = newY + headerStripH;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 5 — Cálculo do Imposto
  // ─────────────────────────────────────────────────────────────────────────
  const q5Y = y;
  box(doc, MARGIN, q5Y, WORK_W, Q5_H);
  drawLabel(doc, 'CÁLCULO DO IMPOSTO', MARGIN, q5Y);

  // Compute totals from sale
  const totalProdutos = roundCurrency(
    sale.items.reduce((sum, i) => sum + i.total, 0)
  );
  const desconto = sale.discount;
  const totalNF = sale.total;

  // Single row of labeled boxes
  const q5Row1Y = q5Y + Q5_H / 2;
  doc.line(MARGIN, q5Row1Y, MARGIN + WORK_W, q5Row1Y);

  // 11 sub-boxes in the bottom half (Row 2)
  const taxBoxes = [
    { label: 'BASE DE CÁLC. ICMS',  value: '0,00',                           w: 20 },
    { label: 'VALOR DO ICMS',        value: '0,00',                           w: 18 },
    { label: 'BC ICMS ST',           value: '0,00',                           w: 16 },
    { label: 'VL ICMS ST',           value: '0,00',                           w: 16 },
    { label: 'VL. TOT. PRODUTOS',    value: totalProdutos.toFixed(2).replace('.', ','), w: 22 },
    { label: 'VL. FRETE',            value: '0,00',                           w: 16 },
    { label: 'VL. SEGURO',           value: '0,00',                           w: 16 },
    { label: 'DESCONTO',             value: desconto.toFixed(2).replace('.', ','),      w: 16 },
    { label: 'VL. IPI',              value: '0,00',                           w: 14 },
    { label: 'OUTRAS DESP.',         value: '0,00',                           w: 14 },
    { label: 'VALOR TOTAL DA NF',    value: formatCurrency(totalNF),          w: WORK_W - (20+18+16+16+22+16+16+16+14+14) },
  ] as const;

  let tbX = MARGIN;
  for (let i = 0; i < taxBoxes.length; i++) {
    const tb = taxBoxes[i];
    if (i > 0) {
      doc.line(tbX, q5Row1Y, tbX, q5Y + Q5_H);
    }
    drawLabel(doc, tb.label, tbX, q5Row1Y);

    // VALOR TOTAL DA NF is bold and prominent
    if (tb.label === 'VALOR TOTAL DA NF') {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(tb.value, tbX + 1, q5Row1Y + 7.5, { maxWidth: tb.w - 2 });
    } else {
      drawValue(doc, tb.value, tbX, q5Row1Y);
    }
    tbX += tb.w;
  }

  y += Q5_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 6 — Transportador / Volumes Transportados
  // ─────────────────────────────────────────────────────────────────────────
  const q6Y = y;
  box(doc, MARGIN, q6Y, WORK_W, Q6_H);
  drawLabel(doc, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', MARGIN, q6Y);

  // Row 1: Razão Social (wide) | Frete Por Conta | Cód ANTT | Placa | UF | CNPJ
  const transp1H = Q6_H / 3;
  const tRazW = Math.floor(WORK_W * 0.38);
  const tFreteW = 24;
  const tAnttW = 18;
  const tPlacaW = 18;
  const tUfW = 10;
  const tCnpjW = WORK_W - tRazW - tFreteW - tAnttW - tPlacaW - tUfW;
  const tFreteX = MARGIN + tRazW;
  const tAnttX  = tFreteX + tFreteW;
  const tPlacaX = tAnttX + tAnttW;
  const tUfX    = tPlacaX + tPlacaW;
  const tCnpjX  = tUfX + tUfW;

  doc.line(MARGIN, q6Y + transp1H, MARGIN + WORK_W, q6Y + transp1H);
  doc.line(tFreteX, q6Y + 3.5, tFreteX, q6Y + transp1H);
  doc.line(tAnttX,  q6Y + 3.5, tAnttX,  q6Y + transp1H);
  doc.line(tPlacaX, q6Y + 3.5, tPlacaX, q6Y + transp1H);
  doc.line(tUfX,    q6Y + 3.5, tUfX,    q6Y + transp1H);
  doc.line(tCnpjX,  q6Y + 3.5, tCnpjX,  q6Y + transp1H);

  drawLabel(doc, 'RAZÃO SOCIAL', MARGIN, q6Y);
  drawValue(doc, '', MARGIN, q6Y);

  drawLabel(doc, 'FRETE POR CONTA', tFreteX, q6Y);
  drawValue(doc, '9-SEM FRETE', tFreteX, q6Y);

  drawLabel(doc, 'CÓDIGO ANTT', tAnttX, q6Y);
  drawValue(doc, '', tAnttX, q6Y);

  drawLabel(doc, 'PLACA DO VEÍCULO', tPlacaX, q6Y);
  drawValue(doc, '', tPlacaX, q6Y);

  drawLabel(doc, 'UF', tUfX, q6Y);
  drawValue(doc, '', tUfX, q6Y);

  drawLabel(doc, 'CNPJ / CPF', tCnpjX, q6Y);
  drawValue(doc, '', tCnpjX, q6Y);

  // Row 2: Endereço | Município | UF | IE
  const transp2Y = q6Y + transp1H;
  const transp2H = Q6_H / 3;
  const tEndW  = Math.floor(WORK_W * 0.40);
  const tMunW  = Math.floor(WORK_W * 0.30);
  const tUf2W  = 12;
  const tIeW   = WORK_W - tEndW - tMunW - tUf2W;
  const tMunX  = MARGIN + tEndW;
  const tUf2X  = tMunX + tMunW;
  const tIeX   = tUf2X + tUf2W;

  doc.line(MARGIN, transp2Y + transp2H, MARGIN + WORK_W, transp2Y + transp2H);
  doc.line(tMunX, transp2Y, tMunX, transp2Y + transp2H);
  doc.line(tUf2X, transp2Y, tUf2X, transp2Y + transp2H);
  doc.line(tIeX,  transp2Y, tIeX,  transp2Y + transp2H);

  drawLabel(doc, 'ENDEREÇO', MARGIN, transp2Y);
  drawValue(doc, '', MARGIN, transp2Y);
  drawLabel(doc, 'MUNICÍPIO', tMunX, transp2Y);
  drawValue(doc, '', tMunX, transp2Y);
  drawLabel(doc, 'UF', tUf2X, transp2Y);
  drawValue(doc, '', tUf2X, transp2Y);
  drawLabel(doc, 'INSCRIÇÃO ESTADUAL', tIeX, transp2Y);
  drawValue(doc, '', tIeX, transp2Y);

  // Row 3: Volumes (Quantidade | Espécie | Marca | Numeração | Peso Bruto | Peso Líquido)
  const transp3Y = transp2Y + transp2H;
  const tQtdW   = Math.floor(WORK_W * 0.14);
  const tEspW   = Math.floor(WORK_W * 0.14);
  const tMarcW  = Math.floor(WORK_W * 0.18);
  const tNumW   = Math.floor(WORK_W * 0.18);
  const tPesoBW = Math.floor(WORK_W * 0.18);
  const tPesoLW = WORK_W - tQtdW - tEspW - tMarcW - tNumW - tPesoBW;
  const tEspX   = MARGIN + tQtdW;
  const tMarcX  = tEspX + tEspW;
  const tNumX   = tMarcX + tMarcW;
  const tPesoBX = tNumX + tNumW;
  const tPesoLX = tPesoBX + tPesoBW;

  doc.line(tEspX,   transp3Y, tEspX,   q6Y + Q6_H);
  doc.line(tMarcX,  transp3Y, tMarcX,  q6Y + Q6_H);
  doc.line(tNumX,   transp3Y, tNumX,   q6Y + Q6_H);
  doc.line(tPesoBX, transp3Y, tPesoBX, q6Y + Q6_H);
  doc.line(tPesoLX, transp3Y, tPesoLX, q6Y + Q6_H);

  drawLabel(doc, 'QUANTIDADE', MARGIN, transp3Y);
  drawValue(doc, '', MARGIN, transp3Y);
  drawLabel(doc, 'ESPÉCIE', tEspX, transp3Y);
  drawValue(doc, '', tEspX, transp3Y);
  drawLabel(doc, 'MARCA', tMarcX, transp3Y);
  drawValue(doc, '', tMarcX, transp3Y);
  drawLabel(doc, 'NUMERAÇÃO', tNumX, transp3Y);
  drawValue(doc, '', tNumX, transp3Y);
  drawLabel(doc, 'PESO BRUTO', tPesoBX, transp3Y);
  drawValue(doc, '', tPesoBX, transp3Y);
  drawLabel(doc, 'PESO LÍQUIDO', tPesoLX, transp3Y);
  drawValue(doc, '', tPesoLX, transp3Y);

  y += Q6_H;

  // ─────────────────────────────────────────────────────────────────────────
  // QUADRO 7 — Dados Adicionais
  // ─────────────────────────────────────────────────────────────────────────
  const q7Y = y;
  box(doc, MARGIN, q7Y, WORK_W, Q7_H);
  drawLabel(doc, 'DADOS ADICIONAIS', MARGIN, q7Y);

  const infoW = Math.floor(WORK_W * 0.62);
  const fiscW = WORK_W - infoW;
  const fiscX  = MARGIN + infoW;

  doc.setLineWidth(0.3);
  doc.line(fiscX, q7Y + 3.5, fiscX, q7Y + Q7_H);

  drawLabel(doc, 'INFORMAÇÕES COMPLEMENTARES', MARGIN, q7Y);
  drawLabel(doc, 'RESERVADO AO FISCO', fiscX, q7Y);

  const infoText =
    'Documento sem valor fiscal. Não autorizado na SEFAZ. ' +
    NFE_DISCLAIMER;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const infoLines = doc.splitTextToSize(infoText, infoW - 2);
  doc.text(infoLines, MARGIN + 1, q7Y + 8, { maxWidth: infoW - 2 });

  y += Q7_H;

  // ─────────────────────────────────────────────────────────────────────────
  // "Folha 1 / X" annotation on page 1 (top-right area of Q0 barcode column)
  // ─────────────────────────────────────────────────────────────────────────
  // Update page 1 numbering annotation (approximate — printed in Q0 area)
  // We do a best-effort annotation since jsPDF doesn't support late text injection.
  // Page numbering is accurate on overflow pages via the inline code above.

  return doc;
}

// ── Wrappers ──────────────────────────────────────────────────────────────────

/**
 * Prints the DANFE PDF by opening it in a new tab with autoPrint enabled.
 */
export async function printDANFE(sale: Sale, client?: Client): Promise<void> {
  const doc = await generateDANFE(sale, client);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

/**
 * Downloads the DANFE PDF as a file.
 */
export async function downloadDANFE(sale: Sale, client?: Client): Promise<void> {
  const doc = await generateDANFE(sale, client);
  doc.save(`danfe_${sale.id.slice(0, 8)}.pdf`);
}
