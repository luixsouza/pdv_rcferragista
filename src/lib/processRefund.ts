import { Sale, Product, Installment } from '@/types';
import { roundCurrency } from '@/lib/formatters';
import { getEffectiveStatus } from '@/lib/installmentStatus';

/**
 * Input shape for processRefund.
 *
 * @param sale                - The original sale being estornado (fully reversed).
 * @param products            - Current products array (for stock updates).
 * @param installments        - All installments in the system (filtered internally by saleId).
 * @param alreadyReturnedQtys - Map of productId → cumulative quantity already returned for this
 *                              sale via prior non-reversed devolução records. Used to prevent
 *                              double restocking (EST-04). Caller provides via getReturnedQuantities().
 */
export interface ProcessRefundInput {
  sale: Sale;
  products: Product[];
  installments: Installment[];
  alreadyReturnedQtys: Record<string, number>;
}

/**
 * Output shape for processRefund — the computed values for the caller (Sales.tsx Plan 02)
 * to apply via setX setters. No storage side effects occur inside this function.
 *
 * @param updatedProducts         - Products array with stock restored (double-restock-safe).
 * @param cancelledInstallmentIds - Ids of open/overdue installments to flip to 'cancelled' (EST-02).
 * @param paidAmount              - Total amount the client actually paid (crediarioPaid + otherPaid
 *                                  for crediário sales; sale.total for non-crediário). The operator
 *                                  decides haver vs. cash-out for this amount (Plan 02, EST-03).
 * @param crediarioPaid           - Ground-truth sum of installment.amountPaid for this sale
 *                                  (includes entrada number:0). Never uses stale sale.crediarioPaid.
 * @param otherPaid               - Sum of non-crediário paymentEntries (cash/card/pix up-front).
 * @param isCrediarioSale         - Whether the sale has a crediário payment component.
 */
export interface ProcessRefundResult {
  updatedProducts: Product[];
  cancelledInstallmentIds: string[];
  paidAmount: number;
  crediarioPaid: number;
  otherPaid: number;
  isCrediarioSale: boolean;
}

/**
 * Pure function — no React hooks, no storage writes, no window.electron.
 *
 * Encapsulates the correct estorno (full refund) computation logic for Sales.tsx (Plan 02).
 * Mirrors the side-effect-free, mutation-return pattern of processReturn.ts (FND-02).
 *
 * Rules encoded:
 *   EST-01: Zero-paid crediário → paidAmount = 0 (no haver minted, just cancel debt).
 *   EST-02: cancelledInstallmentIds includes only open/overdue (preserves payment history; idempotent).
 *   EST-04: updatedProducts subtracts alreadyReturnedQtys before restocking (no double restock).
 *           Respects 'mil' unit /1000 scaling rule.
 *   Mixed: paidAmount = crediarioPaid + otherPaid (no silent under-refund for split sales).
 */
export function processRefund(input: ProcessRefundInput): ProcessRefundResult {
  const { sale, products, installments, alreadyReturnedQtys } = input;

  // -- isCrediarioSale ---------------------------------------------------------
  // True when the sale has any crediário payment component (method, entry, or status).
  const isCrediarioSale =
    sale.paymentMethod === 'crediario' ||
    sale.paymentEntries?.some(e => e.method === 'crediario') === true ||
    sale.status === 'crediario_pending' ||
    sale.status === 'crediario_paid';

  // -- crediarioPaid (ground truth) -------------------------------------------
  // Sum installment.amountPaid for all installments of this sale.
  // Includes the entrada (number: 0, always 'paid') — its amountPaid is part of the
  // crediário money the client actually transferred.
  // Uses installment data, NOT sale.crediarioPaid (which can be stale — FINANCIAL-PITFALLS §1).
  const saleInstallments = installments.filter(i => i.saleId === sale.id);
  const crediarioPaid = roundCurrency(
    saleInstallments.reduce((sum, i) => sum + i.amountPaid, 0)
  );

  // -- otherPaid ---------------------------------------------------------------
  // Non-crediário portion paid up front (cash/card/pix paymentEntries).
  // For a pure crediário sale with no such entries this is 0.
  // For a split sale (e.g. R$100 cash entry + R$300 crediário) this captures the cash half.
  const otherPaid = roundCurrency(
    (sale.paymentEntries ?? [])
      .filter(e => e.method !== 'crediario')
      .reduce((sum, e) => sum + e.amount, 0)
  );

  // -- paidAmount --------------------------------------------------------------
  // For crediário sales: full amount actually paid (crediário + other) so Plan 02 can
  // correctly inform the operator about the full refund due (no silent under-refund).
  // For non-crediário sales: sale.total (cash/card/pix — full reversal, existing behaviour).
  const paidAmount = isCrediarioSale
    ? roundCurrency(crediarioPaid + otherPaid)
    : roundCurrency(sale.total);

  // -- cancelledInstallmentIds (EST-02) ----------------------------------------
  // Only open/overdue installments are cancelled — preserves 'paid' history and is
  // idempotent (already-cancelled installments are excluded, re-running is a no-op).
  const cancelledInstallmentIds = saleInstallments
    .filter(i => {
      const effective = getEffectiveStatus(i);
      return effective === 'open' || effective === 'overdue';
    })
    .map(i => i.id);

  // -- updatedProducts (EST-04: double-restock-safe) ---------------------------
  // For each sale item: subtract already-returned quantities before restocking.
  // Applies 'mil' /1000 scaling rule consistent with processReturn.ts and POS.tsx.
  const updatedProducts = products.map(product => {
    const saleItem = sale.items.find(item => item.productId === product.id);
    if (!saleItem) return product;

    const alreadyReturned = alreadyReturnedQtys[saleItem.productId] || 0;
    const qtyToRestore = saleItem.quantity - alreadyReturned;
    if (qtyToRestore <= 0) return product; // already fully restocked via prior devolução

    const restock = product.unit === 'mil' ? qtyToRestore / 1000 : qtyToRestore;
    return { ...product, stock: product.stock + restock };
  });

  return {
    updatedProducts,
    cancelledInstallmentIds,
    paidAmount,
    crediarioPaid,
    otherPaid,
    isCrediarioSale,
  };
}
