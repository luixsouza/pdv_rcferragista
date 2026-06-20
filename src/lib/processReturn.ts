import { Sale, Product, Client, ReturnRecord, Installment, CreditPayment } from '@/types';
import { roundCurrency } from '@/lib/formatters';
import { getEffectiveStatus } from '@/lib/installmentStatus';

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
 * @param installments    - All installments in the system (optional — existing callers that omit
 *                          this are treated as if no installments exist, yielding crediarioPaid = 0
 *                          and no cancelledInstallmentIds). Wave-2 callers MUST pass this for
 *                          correct haver capping and installment cancellation.
 */
export interface ProcessReturnInput {
  sale: Sale;
  itemsToReturn: ReturnItemInput[];
  products: Product[];
  clients: Client[];
  clientId: string | undefined;
  clientName: string;
  alreadyReturnedQtys: Record<string, number>;
  installments?: Installment[];
}

/**
 * Output shape for processReturn — the mutations to apply via setX setters.
 * No storage side effects occur inside this function.
 *
 * @param cancelledInstallmentIds - Ids of open/overdue installments to flip to 'cancelled'.
 *                                  Populated only when allItemsReturned === true AND the sale is
 *                                  a crediário sale. Empty array otherwise (partial return, or
 *                                  non-crediário sale). Callers must apply setInstallments().
 */
export interface ProcessReturnResult {
  returnRecord: ReturnRecord;
  updatedProducts: Product[];
  updatedClients: Client[];
  /** True when this return brings every sale item to fully returned status. */
  allItemsReturned: boolean;
  /** Ids of open/overdue installments cancelled by this full crediário return. */
  cancelledInstallmentIds: string[];
}

/**
 * Pure function — no React hooks, no storage writes, no window.electron.
 *
 * Encapsulates the shared devolução mutation logic extracted from:
 *   - Sales.tsx handleReturnFromSale
 *   - Returns.tsx handleReturn
 *
 * Haver-capping rule (DEV-04, T-04-01):
 *   - Cash/card/pix sale → creditGenerated = totalRefunded (existing correct behavior).
 *   - Crediário sale → creditGenerated = min(totalRefunded, totalRefunded × paidProportion)
 *     where paidProportion = sum(installment.amountPaid for this sale) / sale.total.
 *     Ground-truth: uses installment.amountPaid sum, NOT stale sale.crediarioPaid field
 *     (mirrors processRefund.ts pattern from Phase 3).
 *   - Zero-paid crediário sale → paidProportion = 0 → creditGenerated = 0 (BUG-1 fix).
 *   - No client (clientId falsy) → creditGenerated = 0 (stock-only return).
 *
 * Installment cancellation (BUG-2 foundation):
 *   - When allItemsReturned AND isCrediarioSale: result.cancelledInstallmentIds contains
 *     only open/overdue installments (preserves 'paid' history; idempotent).
 *   - Partial return → cancelledInstallmentIds = [] (client still owes remainder).
 *
 * Stock restock rule: `product.unit === 'mil' ? quantity / 1000 : quantity` — unchanged.
 */
export function processReturn(input: ProcessReturnInput): ProcessReturnResult {
  const {
    sale,
    itemsToReturn,
    products,
    clients,
    clientId,
    clientName,
    alreadyReturnedQtys,
    installments = [],
  } = input;

  const hasClient = !!clientId;
  const now = new Date().toISOString();

  // -- isCrediarioSale ---------------------------------------------------------
  // True when the sale has any crediário payment component (mirrors processRefund.ts pattern).
  const isCrediarioSale =
    sale.paymentMethod === 'crediario' ||
    sale.paymentEntries?.some(e => e.method === 'crediario') === true ||
    sale.status === 'crediario_pending' ||
    sale.status === 'crediario_paid';

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

  // -- haver capping (DEV-04, T-04-01) -----------------------------------------
  // For crediário sales: cap creditGenerated by the proportion of the sale actually paid.
  // For cash/card/pix sales: preserve existing behavior (creditGenerated = totalRefunded).
  // For no-client returns: creditGenerated = 0 (stock-only; no haver regardless).
  let creditGenerated: number;
  if (!hasClient) {
    creditGenerated = 0;
  } else if (isCrediarioSale) {
    // CR-02 fix: split-payment sales must count the non-crediário (cash/card/pix/store_credit)
    // portion as already paid — it was settled at point-of-sale.
    // Ground-truth: sum installment.amountPaid for this sale (never stale sale.crediarioPaid).
    const saleInstallments = installments.filter(i => i.saleId === sale.id);

    // Non-crediário portion: sum of payment entries that are NOT crediário (all paid at sale time).
    // store_credit is also treated as "fully paid" — it was real value exchanged.
    const cashPortion = roundCurrency(
      (sale.paymentEntries ?? [])
        .filter(e => e.method !== 'crediario')
        .reduce((s, e) => s + e.amount, 0)
    );
    const crediarioPortion = roundCurrency(Math.max(0, sale.total - cashPortion));
    const crediarioPaidSoFar = roundCurrency(
      saleInstallments.reduce((sum, i) => sum + i.amountPaid, 0)
    );
    // paidProportion for the crediário slice only (0..1)
    const crediarioProportion = crediarioPortion > 0 ? Math.min(1, crediarioPaidSoFar / crediarioPortion) : 0;

    // Return value attributed to each payment slice (proportional to original split)
    const crediarioShare = sale.total > 0
      ? roundCurrency((crediarioPortion / sale.total) * totalRefunded)
      : 0;
    const cashShare = roundCurrency(totalRefunded - crediarioShare);

    // Cash share is always fully credited (paid at sale time).
    // Crediário share is capped by the proportion actually paid.
    // DEV-04: zero-paid crediário → crediarioShare contribution = 0.
    creditGenerated = roundCurrency(cashShare + crediarioShare * crediarioProportion);
  } else {
    // Cash/card/pix sale with client: generate haver = totalRefunded.
    creditGenerated = totalRefunded;
  }

  // -- allItemsReturned --------------------------------------------------------
  const mergedReturnedQtys: Record<string, number> = { ...alreadyReturnedQtys };
  for (const ri of itemsToReturn) {
    mergedReturnedQtys[ri.productId] = (mergedReturnedQtys[ri.productId] || 0) + ri.quantity;
  }
  const allItemsReturned = sale.items.every(
    item => (mergedReturnedQtys[item.productId] || 0) >= item.quantity
  );

  // -- cancelledInstallmentIds (BUG-2 foundation) ------------------------------
  // Only when full return AND crediário sale: collect open/overdue installments to cancel.
  // Preserves 'paid' history; idempotent (already-cancelled excluded by getEffectiveStatus).
  let cancelledInstallmentIds: string[] = [];
  if (allItemsReturned && isCrediarioSale) {
    const saleInstallments = installments.filter(i => i.saleId === sale.id);
    cancelledInstallmentIds = saleInstallments
      .filter(i => {
        const effective = getEffectiveStatus(i);
        return effective === 'open' || effective === 'overdue';
      })
      .map(i => i.id);
  }

  const returnRecord: ReturnRecord = {
    id: crypto.randomUUID(),
    originalSaleId: sale.id,
    clientId: clientId || 'sem-cliente',
    clientName,
    items: returnItems,
    totalRefunded,
    creditGenerated,
    createdAt: now,
    cancelledInstallmentIds: cancelledInstallmentIds.length > 0 ? cancelledInstallmentIds : undefined,
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

  // Store credit: increment the client's storeCredit by creditGenerated (NOT totalRefunded)
  // so the client-credit mutation matches the capped haver (DEV-04, T-04-01).
  const updatedClients = hasClient
    ? clients.map(c =>
        c.id === clientId
          ? { ...c, storeCredit: (c.storeCredit || 0) + creditGenerated, updatedAt: now }
          : c
      )
    : clients;

  return { returnRecord, updatedProducts, updatedClients, allItemsReturned, cancelledInstallmentIds };
}

// ============================================================================
// processAbatement — Debt-Abatement Modality (DEV-05, T-04-02, T-04-03)
// ============================================================================

/**
 * Input shape for processAbatement.
 *
 * @param sale                    - The original sale being partially credited via abatement.
 * @param returnValue             - Total value to abate (from returned goods).
 * @param selectedInstallmentIds  - Operator-chosen installment ids to reduce. Only open/overdue
 *                                  installments in this set are processed; paid/cancelled are skipped.
 * @param installments            - All installments in the system (filtered internally by saleId
 *                                  and selectedInstallmentIds).
 * @param clientId                - Client id (required — abatement only available with a client).
 * @param clientName              - Client display name for CreditPayment audit records.
 */
export interface ProcessAbatementInput {
  sale: Sale;
  returnValue: number;
  selectedInstallmentIds: string[];
  installments: Installment[];
  clientId: string;
  clientName: string;
}

/**
 * Output shape for processAbatement.
 *
 * @param updatedInstallments - Full installments array with abatement applied to selected entries.
 * @param creditPayments      - Auditable CreditPayment records with type 'abatimento' (one per
 *                              installment touched). To be appended to the creditPayments store.
 * @param abatedTotal         - Total amount actually abated (sum of creditPayments amounts).
 * @param residual            - Amount left over after exhausting chosen installments. The excess
 *                              is NEVER silently converted to haver — caller decides what to do.
 * @param abatedMap           - Reversal key: installmentId → amount abated. Shape matches
 *                              ReturnRecord.abatedInstallments for DEV-07 (Wave 2).
 */
export interface ProcessAbatementResult {
  updatedInstallments: Installment[];
  creditPayments: CreditPayment[];
  abatedTotal: number;
  residual: number;
  abatedMap: { installmentId: string; amount: number }[];
}

/**
 * Pure function — no React hooks, no storage writes, no window.electron.
 *
 * Implements the "abatimento de débito" modality of devolução (DEV-05):
 *   - Reduces open/overdue installments chosen by the operator.
 *   - Uses discountApplied (not amountPaid) to record the abatement.
 *   - Marks installment 'paid' when amountPaid + discountApplied >= amount.
 *   - Records an auditable CreditPayment with type 'abatimento' per installment touched.
 *   - Returns explicit residual for any returnValue that exceeds chosen installments.
 *   - NEVER generates haver (storeCredit); creditGenerated = 0 on the ReturnRecord (caller sets it).
 *   - Excess NEVER spills to unselected installments (T-04-03).
 *
 * Sort order: overdue-first, then earliest dueDate (favours settling oldest debt first).
 *
 * DEV-05 reference: D-05.
 */
export function processAbatement(input: ProcessAbatementInput): ProcessAbatementResult {
  const { returnValue, selectedInstallmentIds, installments, clientId, clientName } = input;

  const now = new Date();
  const nowISO = now.toISOString();

  // -- Filter to operator-chosen, active installments -------------------------
  const eligibleInstallments = installments
    .filter(i => selectedInstallmentIds.includes(i.id))
    .filter(i => {
      const effective = getEffectiveStatus(i, now);
      return effective === 'open' || effective === 'overdue';
    });

  // -- Sort: overdue first, then earliest dueDate (T-04-03 invariant) ----------
  const sorted = [...eligibleInstallments].sort((a, b) => {
    const aOverdue = getEffectiveStatus(a, now) === 'overdue' ? 0 : 1;
    const bOverdue = getEffectiveStatus(b, now) === 'overdue' ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  // -- Apply abatement loop ---------------------------------------------------
  let remainingReturnValue = roundCurrency(returnValue);
  const creditPayments: CreditPayment[] = [];
  const abatedMap: { installmentId: string; amount: number }[] = [];

  // Build a mutable map of id → installment so we can update them
  const installmentById = new Map<string, Installment>(installments.map(i => [i.id, { ...i }]));

  for (const inst of sorted) {
    if (remainingReturnValue <= 0) break;

    const current = installmentById.get(inst.id)!;
    const already = roundCurrency(current.discountApplied || 0);
    const remaining = roundCurrency(current.amount - current.amountPaid - already);

    if (remaining <= 0) continue;

    const abatement = roundCurrency(Math.min(remaining, remainingReturnValue));
    if (abatement <= 0) continue;

    // Apply discountApplied (DEV-05: abatement uses discountApplied, not amountPaid)
    const newDiscount = roundCurrency(already + abatement);
    const newStatus: Installment['status'] =
      roundCurrency(current.amountPaid + newDiscount) >= current.amount ? 'paid' : current.status;
    const newPaidAt = newStatus === 'paid' ? nowISO : current.paidAt;

    installmentById.set(inst.id, {
      ...current,
      discountApplied: newDiscount,
      status: newStatus,
      paidAt: newPaidAt,
    });

    // Audit CreditPayment (T-04-02: type 'abatimento' + installmentId + amount + createdAt)
    creditPayments.push({
      id: crypto.randomUUID(),
      saleId: inst.saleId,
      installmentId: inst.id,
      clientId,
      clientName,
      amount: abatement,
      paymentMethod: 'cash',
      type: 'abatimento',
      createdAt: nowISO,
    });

    abatedMap.push({ installmentId: inst.id, amount: abatement });

    remainingReturnValue = roundCurrency(remainingReturnValue - abatement);
  }

  // -- Residual: excess not absorbed by chosen installments (T-04-03) ---------
  // NEVER becomes haver — returned to caller to decide.
  const residual = roundCurrency(remainingReturnValue);

  const abatedTotal = roundCurrency(
    creditPayments.reduce((sum, cp) => sum + cp.amount, 0)
  );

  // Rebuild full installments array with mutations applied
  const updatedInstallments = installments.map(i =>
    installmentById.has(i.id) ? installmentById.get(i.id)! : i
  );

  return { updatedInstallments, creditPayments, abatedTotal, residual, abatedMap };
}
