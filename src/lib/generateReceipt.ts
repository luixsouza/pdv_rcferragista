import jsPDF from 'jspdf';
import { Sale } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  pix: 'PIX'
};

export function generateReceipt(sale: Sale) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200] // Altura pode precisar aumentar dependendo da quantidade de itens
  });

  const pageWidth = 80;
  const margin = 5;
  // const contentWidth = pageWidth - margin * 2; // Variável não utilizada diretamente, mas útil para referência
  let y = 10;
  
  // Nome da Empresa
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RC CASA&CONSTRUÇÃO', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  doc.text('CNPJ: 46.483.338/0001-42', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.text('Rua Vicente Bueno, Nº 160', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('Setor Paraíso - Inhumas, GO', pageWidth / 2, y, { align: 'center' });
  y += 4;
  doc.text('CEP: 75400-896', pageWidth / 2, y, { align: 'center' });
  y += 4;

  doc.text('Tel: (62) 99275-1884', pageWidth / 2, y, { align: 'center' });
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

  // Payment method
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Pagamento: ${paymentLabels[sale.paymentMethod]}`, margin, y);
  y += 8;

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