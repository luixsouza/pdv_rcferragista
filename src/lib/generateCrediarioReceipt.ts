import jsPDF from 'jspdf';
import { Client, Installment, Sale } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoreSettings } from '@/lib/storeInfo';

const statusLabels: Record<string, string> = {
  open: 'Aberta',
  paid: 'Paga',
  overdue: 'Vencida',
  cancelled: 'Cancelada',
};

export function generateCrediarioStatement(
  client: Client,
  installments: Installment[],
  sales: Sale[]
) {
  // Calculate dynamic page height based on content
  const baseHeight = 120;
  const perInstallment = 12;
  const perSale = 20;
  const uniqueSales = [...new Set(installments.map(i => i.saleId))];
  const estimatedHeight = baseHeight + (installments.length * perInstallment) + (uniqueSales.length * perSale) + 40;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, Math.max(200, estimatedHeight)]
  });

  const pageWidth = 80;
  const margin = 4;
  const contentWidth = pageWidth - margin * 2;
  let y = 8;

  const drawLine = () => {
    doc.setDrawColor(180);
    doc.setLineWidth(0.1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;
  };

  const drawDashedLine = () => {
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    const step = 1.5;
    for (let x = margin; x < pageWidth - margin; x += step * 2) {
      doc.line(x, y, Math.min(x + step, pageWidth - margin), y);
    }
    y += 3;
  };

  const store = getStoreSettings();

  // ===== HEADER =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(store.storeName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`CNPJ: ${store.cnpj}`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(`${store.address} - ${store.city}`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(`CEP: ${store.cep}`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text(`Tel: ${store.phone}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  drawLine();

  // ===== TITLE =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('EXTRATO DO CREDIARIO', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}`, pageWidth / 2, y, { align: 'center' });
  y += 4;

  drawLine();

  // ===== CLIENT INFO =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Nome: ${client.name}`, margin, y);
  y += 3;
  if (client.document) {
    doc.text(`CPF/CNPJ: ${client.document}`, margin, y);
    y += 3;
  }
  if (client.phone) {
    doc.text(`Tel: ${client.phone}`, margin, y);
    y += 3;
  }
  if (client.address) {
    doc.text(`End: ${client.address}`, margin, y);
    y += 3;
  }
  y += 1;

  drawLine();

  // ===== CREDIT SUMMARY =====
  const creditLimit = client.creditLimit || 0;
  const totalPending = installments
    .filter(i => i.status === 'open' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amount - i.amountPaid - (i.discountApplied || 0)), 0);
  const totalDiscount = installments.reduce((sum, i) => sum + (i.discountApplied || 0), 0);
  const totalPaid = installments.reduce((sum, i) => sum + i.amountPaid, 0);
  const totalOriginal = installments.reduce((sum, i) => sum + i.amount, 0);
  const creditAvailable = Math.max(0, creditLimit - totalPending);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO FINANCEIRO', margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');

  const drawRow = (label: string, value: string, bold = false) => {
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    if (bold) doc.setFont('helvetica', 'normal');
    y += 3.5;
  };

  drawRow('Total em compras:', `R$ ${totalOriginal.toFixed(2)}`);
  if (totalDiscount > 0) {
    drawRow('Descontos:', `-R$ ${totalDiscount.toFixed(2)}`);
  }
  drawRow('Total pago:', `R$ ${totalPaid.toFixed(2)}`);

  drawDashedLine();

  doc.setFontSize(8);
  drawRow('SALDO DEVEDOR:', `R$ ${totalPending.toFixed(2)}`, true);
  doc.setFontSize(7);

  if (creditLimit > 0) {
    drawRow('Limite de credito:', `R$ ${creditLimit.toFixed(2)}`);
    drawRow('Limite disponivel:', `R$ ${creditAvailable.toFixed(2)}`);
  }

  y += 1;
  drawLine();

  // ===== INSTALLMENTS BY SALE =====
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PARCELAS', margin, y);
  y += 4;

  // Group installments by sale
  uniqueSales.forEach(saleId => {
    const sale = sales.find(s => s.id === saleId);
    const saleInstallments = installments
      .filter(i => i.saleId === saleId)
      .sort((a, b) => a.number - b.number);

    // Sale header
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    const saleDate = sale ? format(new Date(sale.createdAt), 'dd/MM/yyyy') : '';
    doc.text(`Venda #${saleId.slice(0, 8).toUpperCase()} - ${saleDate}`, margin, y);
    y += 3;

    if (sale) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      const itemNames = sale.items.map(item => `${item.quantity}x ${item.productName}`).join(', ');
      const truncated = itemNames.length > 60 ? itemNames.substring(0, 57) + '...' : itemNames;
      doc.text(truncated, margin, y);
      y += 3;
    }

    // Installment rows header
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.text('Parc.', margin, y);
    doc.text('Vencimento', margin + 10, y);
    doc.text('Valor', margin + 32, y);
    doc.text('Status', pageWidth - margin, y, { align: 'right' });
    y += 3;

    doc.setFont('helvetica', 'normal');

    saleInstallments.forEach(inst => {
      const discount = inst.discountApplied || 0;
      const remaining = inst.amount - inst.amountPaid - discount;
      const dueStr = format(new Date(inst.dueDate), 'dd/MM/yyyy');

      doc.text(`${inst.number}/${inst.totalInstallments}`, margin, y);
      doc.text(dueStr, margin + 10, y);

      if (discount > 0 && inst.status !== 'paid') {
        doc.text(`R$ ${remaining.toFixed(2)}`, margin + 32, y);
      } else {
        doc.text(`R$ ${inst.amount.toFixed(2)}`, margin + 32, y);
      }

      const statusText = statusLabels[inst.status] || inst.status;
      doc.text(statusText, pageWidth - margin, y, { align: 'right' });
      y += 3;

      // Show discount detail if exists
      if (discount > 0) {
        doc.setFontSize(5.5);
        doc.text(`  Desc: -R$ ${discount.toFixed(2)}`, margin + 10, y);
        y += 2.5;
        doc.setFontSize(6);
      }
    });

    y += 2;
    drawDashedLine();
  });

  // ===== FOOTER =====
  y += 2;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SALDO DEVEDOR TOTAL:', margin, y);
  doc.text(`R$ ${totalPending.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Este documento nao tem valor fiscal.', pageWidth / 2, y, { align: 'center' });
  y += 3;
  doc.text('Obrigado pela preferencia!', pageWidth / 2, y, { align: 'center' });

  return doc;
}

export function printCrediarioStatement(
  client: Client,
  installments: Installment[],
  sales: Sale[]
) {
  const doc = generateCrediarioStatement(client, installments, sales);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

export function downloadCrediarioStatement(
  client: Client,
  installments: Installment[],
  sales: Sale[]
) {
  const doc = generateCrediarioStatement(client, installments, sales);
  const fileName = `crediario_${client.name.replace(/\s+/g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`;
  doc.save(fileName);
}
