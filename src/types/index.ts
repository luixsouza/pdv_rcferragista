export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  tags?: string[];
  storeCredit?: number;
  creditLimit?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  total: number;
}

export interface PaymentEntry {
  method: 'cash' | 'credit' | 'debit' | 'pix' | 'crediario' | 'store_credit';
  amount: number;
  cardBrand?: string;
  cardInstallments?: number;
  cardFeePercent?: number;
  cardFeeAmount?: number;
}

export interface Sale {
  id: string;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'credit' | 'debit' | 'pix' | 'crediario' | 'store_credit';
  paymentEntries?: PaymentEntry[];
  status?: 'completed' | 'refunded' | 'crediario_pending' | 'crediario_paid';
  paidAt?: string;
  crediarioPaid?: number;
  // Cash refunded out of register at estorno (EST-03 option b); excludes haver, which goes to client.storeCredit
  cashRefundOut?: number;
  // Ids of installments cancelled by this sale's estorno (EST-02 audit trail; basis for Phase 4 DEV-07 reversal)
  cancelledInstallmentIds?: string[];
  installmentCount?: number;
  entryAmount?: number;
  cardBrand?: string;
  cardInstallments?: number;
  cardFeePercent?: number;
  cardFeeAmount?: number;
  createdAt: string;
}

export interface CreditPayment {
  id: string;
  saleId: string;
  installmentId?: string;
  clientId: string;
  clientName: string;
  amount: number;
  paymentMethod: 'cash' | 'credit' | 'debit' | 'pix';
  type?: 'payment' | 'discount';
  // Interest component included within amount — enables auditable interest charges (CRED-03)
  interestAmount?: number;
  createdAt: string;
}

export interface Installment {
  id: string;
  saleId: string;
  clientId: string;
  clientName: string;
  number: number;
  totalInstallments: number;
  amount: number;
  amountPaid: number;
  discountApplied?: number;
  dueDate: string;
  status: 'open' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
  paymentMethod?: 'cash' | 'credit' | 'debit' | 'pix';
  createdAt: string;
}

export interface ReturnRecord {
  id: string;
  originalSaleId: string;
  clientId: string;
  clientName: string;
  items: SaleItem[];
  totalRefunded: number;
  creditGenerated: number;
  createdAt: string;
  reversedAt?: string;
  cancelledInstallmentIds?: string[];
}

export interface Quote {
  id: string;
  clientId?: string;
  clientName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  expirationDate?: string;
}
