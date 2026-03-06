export type CardBrand = 'visa_master' | 'elo' | 'hipercard' | 'amex' | 'outros';

export const CARD_BRAND_LABELS: Record<CardBrand, string> = {
  visa_master: 'Visa/Mastercard',
  elo: 'Elo',
  hipercard: 'Hipercard',
  amex: 'Amex',
  outros: 'Outros',
};

// Fee table: percentage values from the NNPAYTIME04D17299 machine
// null = not available for that brand/type combination
const CARD_FEE_TABLE: Record<CardBrand, { debit: number | null; credit: number[] }> = {
  visa_master: {
    debit: 0.99,
    credit: [2.99, 4.41, 5.16, 5.91, 6.64, 7.38, 8.10, 8.81, 9.52, 10.22, 10.91, 11.60, 12.28, 12.95, 13.62, 14.27, 14.93, 15.57],
  },
  elo: {
    debit: 1.15,
    credit: [3.35, 4.41, 5.16, 5.91, 6.64, 7.38, 8.40, 9.11, 9.82, 10.52, 11.21, 11.90, 12.58, 13.25, 13.92, 14.57, 15.23, 15.87],
  },
  hipercard: {
    debit: null,
    credit: [3.79, 4.41, 5.16, 5.91, 6.64, 7.38, 8.40, 9.11, 9.82, 10.52, 11.21, 11.90, 12.58, 13.92, 13.92, 14.57, 15.23, 15.87],
  },
  amex: {
    debit: null,
    credit: [3.79, 4.41, 5.16, 5.91, 6.64, 7.38, 8.40, 9.11, 9.82, 10.52, 11.21, 11.90, 12.58, 13.25, 13.92, 14.57, 15.23, 15.87],
  },
  outros: {
    debit: 1.89,
    credit: [3.79, 4.41, 5.16, 5.91, 6.64, 7.38, 8.40, 9.11, 9.82, 10.52, 11.21, 11.90, 12.58, 13.25, 13.92, 14.57, 15.23, 15.87],
  },
};

/**
 * Get the fee percentage for a card transaction
 * @param brand Card brand
 * @param type 'debit' or 'credit'
 * @param installments Number of installments (1-18, only for credit)
 * @returns Fee percentage or null if not available
 */
export function getCardFee(brand: CardBrand, type: 'debit' | 'credit', installments: number = 1): number | null {
  const brandFees = CARD_FEE_TABLE[brand];
  if (!brandFees) return null;

  if (type === 'debit') {
    return brandFees.debit;
  }

  // credit: installments 1-18, array index 0-17
  const idx = Math.max(0, Math.min(17, installments - 1));
  return brandFees.credit[idx] ?? null;
}

/**
 * Calculate fee amount and net amount
 */
export function calculateFee(amount: number, feePercent: number): { feeAmount: number; netAmount: number } {
  const feeAmount = amount * (feePercent / 100);
  const netAmount = amount - feeAmount;
  return { feeAmount: Math.round(feeAmount * 100) / 100, netAmount: Math.round(netAmount * 100) / 100 };
}

/**
 * Check if debit is available for a brand
 */
export function hasDebit(brand: CardBrand): boolean {
  return CARD_FEE_TABLE[brand]?.debit !== null;
}
