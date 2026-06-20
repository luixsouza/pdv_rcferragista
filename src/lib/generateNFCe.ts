/**
 * generateNFCe.ts
 *
 * DANFE-NFCe 80mm cupom generator (NF-e model 65).
 *
 * This document is a VISUAL LAYOUT ONLY — it is NOT transmitted to SEFAZ
 * and carries NO fiscal authority. All fiscal fields use safe placeholders
 * (see fiscalPlaceholders.ts). The mandatory homologação disclaimer is
 * printed twice (Divisão II and Divisão VIII) to make the non-fiscal nature
 * unmistakable.
 *
 * References:
 *  - FISCAL-LAYOUT.md Part 2: Divisões I–IX order
 *  - FISCAL-LAYOUT.md Part 2.4: height formula 164 + 8×n_items
 *  - 06-CONTEXT.md: FISC-01, FISC-03
 */

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sale, Client, Product } from '@/types';
import { formatCurrency, paymentLabels } from '@/lib/formatters';
import { getStoreSettings } from '@/lib/storeInfo';
import { formatDocument } from '@/lib/documentValidation';
import {
  PLACEHOLDER_ACCESS_KEY,
  PLACEHOLDER_SERIE,
  PLACEHOLDER_PROTOCOL,
  PLACEHOLDER_IE,
  NFCE_DISCLAIMER,
  NFCE_QR_PLACEHOLDER,
  formatAccessKeyGroups,
} from '@/lib/fiscalPlaceholders';
import { generateQrDataUrl } from '@/lib/fiscalBarcode';

const PAGE_WIDTH = 80;
const MARGIN = 4;
const TEXT_RIGHT = PAGE_WIDTH - MARGIN;
const CENTER = PAGE_WIDTH / 2;

// ── Height formula (FISCAL-LAYOUT.md Part 2.4) ──────────────────────────────
// 164 mm base + 8 mm per item; Math.max(250, ...) ensures a sensible minimum
// for small sales so the cupom is never shorter than a standard receipt.
function calcHeight(itemCount: number): number {
  return Math.max(175, 164 + itemCount * 8);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function drawSeparator(doc: jsPDF, y: number): number {
  doc.setLineWidth(0.1);
  doc.line(MARGIN, y, TEXT_RIGHT, y);
  return y + 3;
}

function centerText(
  doc: jsPDF,
  text: string,
  y: number,
  opts?: { bold?: boolean; size?: number }
): number {
  if (opts?.bold) doc.setFont('helvetica', 'bold');
  else doc.setFont('helvetica', 'normal');
  if (opts?.size) doc.setFontSize(opts.size);
  doc.text(text, CENTER, y, { align: 'center' });
  return y;
}

function rowText(
  doc: jsPDF,
  left: string,
  right: string,
  y: number
): void {
  doc.text(left, MARGIN, y);
  doc.text(right, TEXT_RIGHT, y, { align: 'right' });
}

/**
 * Generates an 80mm NFCe cupom PDF (DANFE-NFCe model 65) from a Sale.
 *
 * Returns a Promise<jsPDF> because the QR code data URL is generated
 * asynchronously via the qrcode library.
 */
export async function generateNFCe(sale: Sale, client?: Client, products?: Product[]): Promise<jsPDF> {
  const store = getStoreSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [PAGE_WIDTH, calcHeight(sale.items.length)],
  });

  let y = 6;

  // ── Divisão I — Emitente (cabeçalho) ──────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(store.storeName.toUpperCase(), CENTER, y, { align: 'center' });
  y += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNPJ: ${store.cnpj}`, CENTER, y, { align: 'center' });
  y += 4;
  doc.text(`IE: ${PLACEHOLDER_IE}`, CENTER, y, { align: 'center' });
  y += 4;
  doc.text(store.address, CENTER, y, { align: 'center' });
  y += 4;
  doc.text(store.city, CENTER, y, { align: 'center' });
  y += 4;
  doc.text(`CEP: ${store.cep}`, CENTER, y, { align: 'center' });
  y += 4;
  doc.text(`Tel: ${store.phone}`, CENTER, y, { align: 'center' });
  y += 5;

  // ── Divisão II — Identificação do Documento ────────────────────────────────
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  // Mandatory title — verbatim per FISC-01 and FISCAL-LAYOUT.md Part 4
  const titleLines = doc.splitTextToSize(
    'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA',
    PAGE_WIDTH - MARGIN * 2
  );
  doc.text(titleLines, CENTER, y, { align: 'center' });
  y += titleLines.length * 4 + 2;

  // ── Disclaimer band (FISC-03) — repeat below title ─────────────────────────
  // Draw a filled band to make the disclaimer prominent
  doc.setFillColor(220, 220, 220);
  doc.rect(MARGIN, y - 1, PAGE_WIDTH - MARGIN * 2, 8, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  // NFCE_DISCLAIMER verbatim (with en-dash) — do not normalize
  const disclaimerLines = doc.splitTextToSize(NFCE_DISCLAIMER, PAGE_WIDTH - MARGIN * 2 - 2);
  doc.text(disclaimerLines, CENTER, y + 3, { align: 'center' });
  y += disclaimerLines.length * 4 + 5;

  // ── Divisão III — Dados dos Produtos / Serviços ────────────────────────────
  y = drawSeparator(doc, y);
  y += 1;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ITEM  DESCRIÇÃO                 UN  QTDE', MARGIN, y);
  y += 3;
  doc.text('      VL. UNIT.           VL. TOTAL', MARGIN, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  sale.items.forEach((item, idx) => {
    // Line 1: item number + product name (truncated to fit)
    const seqNo = String(idx + 1).padStart(3, '0');
    const maxNameLen = 30;
    const itemName =
      item.productName.length > maxNameLen
        ? item.productName.substring(0, maxNameLen) + '...'
        : item.productName;
    doc.text(`${seqNo} ${itemName}`, MARGIN, y);
    y += 3;

    // Line 2: qty × unit price = total (right-aligned values)
    const unitLabel = (products?.find(p => p.id === item.productId)?.unit ?? 'UN').toUpperCase();
    const qtyStr = `    ${item.quantity} ${unitLabel} x ${formatCurrency(item.unitPrice)}`;
    const totalStr = formatCurrency(item.total);
    doc.text(qtyStr, MARGIN, y);
    doc.text(totalStr, TEXT_RIGHT, y, { align: 'right' });
    y += 5;
  });

  // ── Divisão III-A — Totalizadores ─────────────────────────────────────────
  y += 1;
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  rowText(doc, `Qtde. total de itens: ${sale.items.length}`, '', y);
  y += 4;

  rowText(doc, 'Subtotal:', formatCurrency(sale.subtotal), y);
  y += 4;

  if (sale.discount > 0) {
    rowText(doc, 'Desconto:', `-${formatCurrency(sale.discount)}`, y);
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  rowText(doc, 'VALOR TOTAL R$', formatCurrency(sale.total), y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  // Payment method(s)
  if (sale.paymentEntries && sale.paymentEntries.length > 1) {
    doc.text('Formas de Pagamento:', MARGIN, y);
    y += 4;
    sale.paymentEntries.forEach((entry) => {
      const label = paymentLabels[entry.method] || entry.method;
      rowText(doc, `  ${label}:`, formatCurrency(entry.amount), y);
      y += 4;
    });
  } else {
    const label = paymentLabels[sale.paymentMethod] || sale.paymentMethod;
    const displayAmount = sale.paymentMethod === 'crediario' && sale.entryAmount != null
      ? sale.entryAmount
      : sale.total;
    rowText(doc, `Forma de Pagamento: ${label}`, formatCurrency(displayAmount), y);
    y += 4;
    if (sale.paymentMethod === 'crediario' && sale.entryAmount != null) {
      const financed = sale.total - sale.entryAmount;
      if (financed > 0) {
        rowText(doc, '  Financiado (crediário):', formatCurrency(financed), y);
        y += 4;
      }
    }
  }
  y += 1;

  // ── Divisão IV — Consulta via Chave de Acesso ─────────────────────────────
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  // Mandatory phrase — verbatim per FISC-01 and FISCAL-LAYOUT.md Part 4
  doc.text('Consulte pela Chave de Acesso em', CENTER, y, { align: 'center' });
  y += 4;

  // SEFAZ URL reference
  const sefazUrl = 'www.sefaz.go.gov.br/consulta-nfce';
  doc.text(sefazUrl, CENTER, y, { align: 'center' });
  y += 4;

  // 44-digit access key in 11 groups of 4
  doc.setFontSize(6.5);
  const keyFormatted = formatAccessKeyGroups(PLACEHOLDER_ACCESS_KEY);
  const keyLines = doc.splitTextToSize(keyFormatted, PAGE_WIDTH - MARGIN * 2);
  doc.text(keyLines, CENTER, y, { align: 'center' });
  y += keyLines.length * 3 + 4;

  // ── Divisão V — QR Code ───────────────────────────────────────────────────
  // await the QR data URL (async) — this is why generateNFCe must be async
  const qrDataUrl = await generateQrDataUrl(NFCE_QR_PLACEHOLDER);
  const qrSize = 28; // mm — exceeds the 25mm minimum from FISC-01
  const qrX = CENTER - qrSize / 2;
  doc.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);
  y += qrSize + 4;

  // ── Divisão VI — Informações do Consumidor ────────────────────────────────
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFontSize(7);
  if (client || sale.clientName) {
    const name = client?.name ?? sale.clientName ?? '';
    const docStr = client?.document ? formatDocument(client.document) : '';
    doc.setFont('helvetica', 'bold');
    doc.text('CONSUMIDOR', MARGIN, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${name}`, MARGIN, y);
    y += 4;
    if (docStr) {
      doc.text(`CPF/CNPJ: ${docStr}`, MARGIN, y);
      y += 4;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.text('CONSUMIDOR NÃO IDENTIFICADO', CENTER, y, { align: 'center' });
    y += 4;
  }
  y += 1;

  // ── Divisão VII — Identificação da NFCe e Protocolo ──────────────────────
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `NFC-e nº ${sale.id.slice(0, 9).toUpperCase()}  Série ${PLACEHOLDER_SERIE}`,
    MARGIN,
    y
  );
  y += 4;

  const emissaoStr = (() => {
    try {
      return format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch {
      return sale.createdAt;
    }
  })();
  doc.text(`Emissão: ${emissaoStr}`, MARGIN, y);
  y += 4;

  doc.text(`PROTOCOLO DE AUTORIZAÇÃO: ${PLACEHOLDER_PROTOCOL}`, MARGIN, y);
  y += 5;

  // ── Divisão VIII — Área de Mensagem Fiscal (repeat disclaimer) ────────────
  y = drawSeparator(doc, y);
  y += 2;

  doc.setFillColor(220, 220, 220);
  doc.rect(MARGIN, y - 1, PAGE_WIDTH - MARGIN * 2, 8, 'F');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  const disclaimerLines2 = doc.splitTextToSize(NFCE_DISCLAIMER, PAGE_WIDTH - MARGIN * 2 - 2);
  doc.text(disclaimerLines2, CENTER, y + 3, { align: 'center' });
  y += disclaimerLines2.length * 4 + 5;

  // ── Divisão IX — Mensagem de Interesse do Contribuinte ────────────────────
  y = drawSeparator(doc, y);
  y += 3;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Obrigado pela preferência!', CENTER, y, { align: 'center' });
  y += 4;
  doc.text('RC Ferragista', CENTER, y, { align: 'center' });
  y += 3;

  return doc;
}

/**
 * Opens the NFCe cupom in a new browser tab with auto-print dialog.
 */
export async function printNFCe(sale: Sale, client?: Client, products?: Product[]): Promise<void> {
  const doc = await generateNFCe(sale, client, products);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

/**
 * Downloads the NFCe cupom as a PDF file.
 */
export async function downloadNFCe(sale: Sale, client?: Client, products?: Product[]): Promise<void> {
  const doc = await generateNFCe(sale, client, products);
  doc.save(`nfce_${sale.id.slice(0, 8)}.pdf`);
}
