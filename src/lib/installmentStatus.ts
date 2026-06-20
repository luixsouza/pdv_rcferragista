import { isBefore, startOfDay } from 'date-fns';
import { Installment } from '@/types';

/**
 * Single source of truth for overdue detection.
 * Replaces reliance on the mount-only useEffect in CreditNotes.tsx (CONCERNS.md).
 *
 * Returns true when the installment is 'open' and its dueDate has passed today.
 * Returns false for 'paid', 'cancelled', or already-'overdue' (handled by getEffectiveStatus).
 */
export const isInstallmentOverdue = (inst: Installment, now: Date = new Date()): boolean => {
  if (inst.status !== 'open') return false;
  return isBefore(new Date(inst.dueDate), startOfDay(now));
};

/**
 * Single source of truth for computing the effective display status of an installment.
 * Replaces reliance on the mount-only useEffect in CreditNotes.tsx (CONCERNS.md).
 *
 * Returns 'overdue' when the persisted status is 'open' but the due date has passed,
 * OR when the persisted status is already 'overdue'.
 * Returns 'cancelled' unchanged (never reclassified as overdue).
 * Returns 'paid' unchanged.
 * Returns 'open' when the due date has not yet passed.
 */
export const getEffectiveStatus = (inst: Installment, now: Date = new Date()): Installment['status'] => {
  if (inst.status === 'cancelled') return 'cancelled';
  if (inst.status === 'paid') return 'paid';
  if (inst.status === 'overdue') return 'overdue';
  // status === 'open': derive on-the-fly
  if (isBefore(new Date(inst.dueDate), startOfDay(now))) return 'overdue';
  return 'open';
};
