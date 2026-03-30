import jsPDF from 'jspdf';
import { Sale, ReturnRecord } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { paymentLabels } from '@/lib/formatters';
import { getStoreSettings } from '@/lib/storeInfo';

export function generateReceipt(sale: Sale) {
  const store = getStoreSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 250]
  });

  const pageWidth = 80;
  const margin = 5;
  let y = 10;

  // Nome da Empresa
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(store.storeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.text(`CNPJ: ${store.cnpj}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.text(store.address, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(store.city, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`CEP: ${store.cep}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.text(`Tel: ${store.phone}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CUPOM NÃO FISCAL', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Separator
  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Date and ID
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${format(new Date(sale.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  y += 4;
  doc.text(`Venda: #${sale.id.slice(0, 8).toUpperCase()}`, margin, y);
  y += 6;

  // Client
  if (sale.clientName) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(sale.clientName, margin, y);
    y += 6;
  }

  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Items header
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  // Items
  sale.items.forEach((item) => {
    const itemName = item.productName.length > 25
      ? item.productName.substring(0, 25) + '...'
      : item.productName;

    doc.text(itemName, margin, y);
    y += 3;

    const qty = `${item.quantity}x R$ ${item.unitPrice.toFixed(2)}`;
    const total = `R$ ${item.total.toFixed(2)}`;
    doc.text(qty, margin, y);
    doc.text(total, pageWidth - margin, y, { align: 'right' });
    y += 5;
  });

  // Separator
  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Totals
  doc.setFontSize(8);
  doc.text('Subtotal:', margin, y);
  doc.text(`R$ ${sale.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (sale.discount > 0) {
    doc.text('Desconto:', margin, y);
    doc.text(`-R$ ${sale.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', margin, y);
  doc.text(`R$ ${sale.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  // Payment method(s)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  if (sale.paymentEntries && sale.paymentEntries.length > 1) {
    doc.text('Formas de Pagamento:', margin, y);
    y += 4;
    sale.paymentEntries.forEach(entry => {
      const label = paymentLabels[entry.method] || entry.method;
      doc.text(`  ${label}: R$ ${entry.amount.toFixed(2)}`, margin, y);
      y += 3;
    });
    y += 1;
  } else {
    doc.text(`Pagamento: ${paymentLabels[sale.paymentMethod] || sale.paymentMethod}`, margin, y);
    y += 4;
  }

  // Card fee info
  if (sale.cardFeePercent != null && sale.cardFeeAmount != null) {
    doc.text(`Taxa maquininha: ${sale.cardFeePercent}%`, margin, y);
    doc.text(`-R$ ${sale.cardFeeAmount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Valor líquido:', margin, y);
    doc.text(`R$ ${(sale.total - sale.cardFeeAmount).toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.setFont('helvetica', 'normal');
  }

  // Crediario note
  if (sale.status === 'crediario_pending') {
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('** VENDA NO CREDIÁRIO **', pageWidth / 2, y, { align: 'center' });
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Pagamento pendente', pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  y += 4;

  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Footer
  doc.setFontSize(7);
  doc.text('Obrigado pela preferência!', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('Volte sempre!', pageWidth / 2, y, { align: 'center' });

  return doc;
}

export function printReceipt(sale: Sale) {
  const doc = generateReceipt(sale);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export function downloadReceipt(sale: Sale) {
  const doc = generateReceipt(sale);
  const fileName = `recibo_${sale.id.slice(0, 8)}_${format(new Date(sale.createdAt), 'ddMMyyyy')}.pdf`;
  doc.save(fileName);
}

export function generateRefundReceipt(returnRecord: ReturnRecord, originalSale?: Sale) {
  const store = getStoreSettings();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200]
  });

  const pageWidth = 80;
  const margin = 5;
  let y = 10;

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(store.storeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNPJ: ${store.cnpj}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROVANTE DE DEVOLUÇÃO', pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Date and reference
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${format(new Date(returnRecord.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  y += 4;
  doc.text(`Devolução: #${returnRecord.id.slice(0, 8).toUpperCase()}`, margin, y);
  y += 4;
  if (originalSale) {
    doc.text(`Venda ref.: #${originalSale.id.slice(0, 8).toUpperCase()} (${format(new Date(originalSale.createdAt), 'dd/MM/yyyy')})`, margin, y);
    y += 4;
  }
  y += 2;

  // Client
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', margin, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.text(returnRecord.clientName, margin, y);
  y += 6;

  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Items
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS DEVOLVIDOS', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  returnRecord.items.forEach((item) => {
    const itemName = item.productName.length > 25
      ? item.productName.substring(0, 25) + '...'
      : item.productName;

    doc.text(itemName, margin, y);
    y += 3;
    const qty = `${item.quantity}x R$ ${item.unitPrice.toFixed(2)}`;
    const total = `R$ ${item.total.toFixed(2)}`;
    doc.text(qty, margin, y);
    doc.text(total, pageWidth - margin, y, { align: 'right' });
    y += 5;
  });

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Totals
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Total devolvido:', margin, y);
  doc.text(`R$ ${returnRecord.totalRefunded.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (returnRecord.creditGenerated > 0) {
    doc.text('Crédito em haver:', margin, y);
    doc.text(`R$ ${returnRecord.creditGenerated.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Este comprovante não tem valor fiscal.', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('Obrigado pela preferência!', pageWidth / 2, y, { align: 'center' });

  return doc;
}

export function printRefundReceipt(returnRecord: ReturnRecord, originalSale?: Sale) {
  const doc = generateRefundReceipt(returnRecord, originalSale);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export function downloadRefundReceipt(returnRecord: ReturnRecord, originalSale?: Sale) {
  const doc = generateRefundReceipt(returnRecord, originalSale);
  const fileName = `devolucao_${returnRecord.id.slice(0, 8)}_${format(new Date(returnRecord.createdAt), 'ddMMyyyy')}.pdf`;
  doc.save(fileName);
}
