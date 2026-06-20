import { Sale, Product, Client, ReturnRecord } from '@/types';
import { roundCurrency } from '@/lib/formatters';

/**
 * Input shape for a single item being returned.
 */
export interface ReturnItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
}

/**
 * Input shape for processReturn.
 *
 * @param sale            - The original sale being devolvido.
 * @param itemsToReturn   - The selected items and quantities the operator is returning.
 * @param products        - Current products array (for stock updates).
 * @param clients         - Current clients array (for store-credit updates).
 * @param clientId        - Resolved client ID, or undefined / empty string for "sem-cliente".
 * @param clientName      - Display name for the client (client.name || sale.clientName || fallback).
 * @param alreadyReturnedQtys - Map of productId → cumulative quantity already returned for this
 *                            sale (from prior non-reversed ReturnRecords). Used to determine
 *                            allItemsReturned. Caller provides this via getReturnedQuantities().
 */
export interface ProcessReturnInput {
  sale: Sale;
  itemsToReturn: ReturnItemInput[];
  products: Product[];
  clients: Client[];
  clientId: string | undefined;
  clientName: string;
  alreadyReturnedQtys: Record<string, number>;
}

/**
 * Output shape for processReturn — the mutations to apply via setX setters.
 * No storage side effects occur inside this function.
 */
export interface ProcessReturnResult {
  returnRecord: ReturnRecord;
  updatedProducts: Product[];
  updatedClients: Client[];
  /** True when this return brings every sale item to fully returned status. */
  allItemsReturned: boolean;
}

/**
 * Pure function — no React hooks, no storage writes, no window.electron.
 *
 * Encapsulates the shared devolução mutation logic extracted from:
 *   - Sales.tsx handleReturnFromSale (lines 244–305)
 *   - Returns.tsx handleReturn (lines 144–210)
 *
 * Behavioral parity with the existing code is MANDATORY for Phase 1.
 * Do NOT change haver rules, do NOT add haver-capping, do NOT cancel installments.
 * Those changes belong to Phase 3/4 and will be built on top of this module.
 *
 * creditGenerated rule: `hasClient ? totalRefunded : 0` — unchanged from current code.
 * Stock restock rule: `product.unit === 'mil' ? quantity / 1000 : quantity` — unchanged.
 * allItemsReturned: merges alreadyReturnedQtys with the items being returned now; the
 *   sale is fully returned when every sale item's cumulative returned qty >= its quantity.
 */
export function processReturn(input: ProcessReturnInput): ProcessReturnResult {
  const { sale, itemsToReturn, products, clients, clientId, clientName, alreadyReturnedQtys } = input;

  const hasClient = !!clientId;
  const now = new Date().toISOString();

  // Build the ReturnRecord items with per-term roundCurrency to avoid centavo drift
  const returnItems = itemsToReturn.map(ri => ({
    productId: ri.productId,
    productName: ri.productName,
    quantity: ri.quantity,
    unitPrice: ri.unitPrice,
    costPrice: ri.costPrice,
    total: roundCurrency(ri.quantity * ri.unitPrice),
  }));

  // totalRefunded: sum of per-item totals (each already rounded)
  const totalRefunded = roundCurrency(
    returnItems.reduce((sum, item) => sum + item.total, 0)
  );

  // creditGenerated: current rule — hasClient ? totalRefunded : 0
  // Do NOT cap or adjust for crediário payment status (Phase 3/4 concern)
  const creditGenerated = hasClient ? totalRefunded : 0;

  const returnRecord: ReturnRecord = {
    id: crypto.randomUUID(),
    originalSaleId: sale.id,
    clientId: clientId || 'sem-cliente',
    clientName,
    items: returnItems,
    totalRefunded,
    creditGenerated,
    createdAt: now,
    // cancelledInstallmentIds intentionally omitted (Phase 3/4 will populate this)
  };

  // Restore stock: for each returned item, add back the appropriate unit quantity
  const updatedProducts = products.map(product => {
    const returnItem = itemsToReturn.find(ri => ri.productId === product.id);
    if (!returnItem) return product;
    const restock = product.unit === 'mil'
      ? roundCurrency(returnItem.quantity / 1000)
      : returnItem.quantity;
    return { ...product, stock: product.stock + restock, updatedAt: now };
  });

  // Store credit: increment the client's storeCredit by totalRefunded (only when hasClient)
  const updatedClients = hasClient
    ? clients.map(c =>
        c.id === clientId
          ? { ...c, storeCredit: (c.storeCredit || 0) + totalRefunded, updatedAt: now }
          : c
      )
    : clients;

  // allItemsReturned: merge prior returned quantities with what is being returned now
  const mergedReturnedQtys: Record<string, number> = { ...alreadyReturnedQtys };
  for (const ri of itemsToReturn) {
    mergedReturnedQtys[ri.productId] = (mergedReturnedQtys[ri.productId] || 0) + ri.quantity;
  }
  const allItemsReturned = sale.items.every(
    item => (mergedReturnedQtys[item.productId] || 0) >= item.quantity
  );

  return { returnRecord, updatedProducts, updatedClients, allItemsReturned };
}
