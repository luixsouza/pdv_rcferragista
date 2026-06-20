export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Round a monetary value to 2 decimal places (centavos).
 * Uses "round half up" via Math.round to match BRL currency convention.
 * Avoids the 0.1+0.2 floating-point trap.
 * Mirrors the pattern in cardFees.ts: Math.round(x * 100) / 100.
 */
export const roundCurrency = (value: number): number =>
  Math.round(value * 100) / 100;

export const paymentLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  pix: 'PIX',
  crediario: 'Crediário',
  store_credit: 'Crédito em Haver',
};
