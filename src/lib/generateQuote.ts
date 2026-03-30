import jsPDF from 'jspdf';
import { Quote } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoreSettings } from '@/lib/storeInfo';

export function generateQuotePDF(quote: Quote) {
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
  y += 4;
  doc.text(store.address, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(store.city, pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text(`Tel: ${store.phone}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', pageWidth / 2, y, { align: 'center' });
  y += 5;

  // Separator
  doc.setLineWidth(0.1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${format(new Date(quote.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, margin, y);
  y += 4;
  if (quote.expirationDate) {
    doc.text(`Validade: ${format(new Date(quote.expirationDate), "dd/MM/yyyy", { locale: ptBR })}`, margin, y);
    y += 4;
  }
  doc.text(`Nº: ${quote.id.slice(0, 8).toUpperCase()}`, margin, y);
  y += 6;

  // Client
  if (quote.clientName) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(quote.clientName, margin, y);
    y += 6;
  }

  // Separator
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Items
  doc.setFont('helvetica', 'bold');
  doc.text('ITENS', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  quote.items.forEach((item) => {
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

  // Totals
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;
  
  doc.setFontSize(8);
  doc.text('Subtotal:', margin, y);
  doc.text(`R$ ${quote.subtotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 4;

  if (quote.discount > 0) {
    doc.text('Desconto:', margin, y);
    doc.text(`-R$ ${quote.discount.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', margin, y);
  doc.text(`R$ ${quote.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // Footer
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text('Este documento não garante reserva de estoque.', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Preços sujeitos a alteração.', pageWidth / 2, y, { align: 'center' });

  return doc;
}

export function printQuote(quote: Quote) {
  const doc = generateQuotePDF(quote);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export function downloadQuote(quote: Quote) {
  const doc = generateQuotePDF(quote);
  doc.save(`orcamento-${quote.id.slice(0, 8)}.pdf`);
}
