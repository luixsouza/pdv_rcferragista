/**
 * Fractional-unit helpers for PDV RC Ferragista.
 *
 * Decision: FRAC-01 — "conforme a unidade". Whether a quantity can be fractional
 * (decimal) is derived from the product's `unit` string, not a per-product flag.
 * This module is the single source of truth for that decision, consumed by POS,
 * Quotes, and Products without duplication.
 *
 * Pure module: no React, no page imports, no storage access.
 */

/**
 * Unit codes that accept decimal quantities.
 * Uses lowercased strings so matching is case-insensitive.
 *
 * Included: mt (metro), kg, lt (litro), m2 and m² (metro quadrado).
 * m2/m² is included for forward-compatibility even though it is not yet in
 * the Products dropdown.
 *
 * NOT included:
 * - mil: this is a selling-unit (price per 1000 units / milheiro). Cart-level
 *   quantities for `mil` are always whole units; the ÷1000 conversion happens
 *   on price and stock deduction only, not on the quantity field.
 * - un, cx, pc, par, jg, rl: discrete units, must stay integer.
 */
export const FRACTIONAL_UNITS: ReadonlySet<string> = new Set(['mt', 'kg', 'lt', 'm2', 'm²']);

/**
 * Returns true when the unit accepts decimal quantities.
 * Safe for undefined/empty input — returns false for unknown or empty units.
 *
 * @param unit - The `unit` field from a `Product` (free-form string).
 * @returns true if the unit is in the fractional set; false otherwise.
 */
export function isFractionalUnit(unit: string): boolean {
  if (!unit) return false;
  return FRACTIONAL_UNITS.has(unit.toLowerCase().trim());
}

/**
 * Returns the quantity step to use for `<input type="number" step>` and +/- buttons.
 *
 * Fractional step choice: 0.5
 * Rationale: pipe, rope, and fabric at a hardware store are typically sold in
 * half-unit increments (0.5 m, 1.0 m, 1.5 m). A step of 0.5 lets the operator
 * use the +/- buttons comfortably without forcing keyboard entry for every value.
 * The operator can still type any value (e.g. 1.25 m) directly in the input field.
 *
 * @param unit - The `unit` field from a `Product`.
 * @returns 0.5 for fractional units, 1 for discrete units.
 */
export function quantityStep(unit: string): number {
  return isFractionalUnit(unit) ? 0.5 : 1;
}

/**
 * Parses a raw quantity string to a number, normalizing pt-BR decimal commas.
 *
 * A single decimal comma (vírgula) is replaced with a dot before `parseFloat`
 * so that the operator can type "1,5" and get the number 1.5 — matching the
 * pt-BR locale convention used throughout the application.
 *
 * Returns `NaN` for unparseable input. Callers should guard with `isNaN(result)`
 * before using the value, consistent with the existing `isNaN` guard pattern in
 * POS.tsx (lines 733, 843).
 *
 * @param raw - Raw string from an input field (e.g. "1,5", "2.5", "3").
 * @returns Parsed number, or NaN if the input is not a valid number.
 */
export function parseQuantity(raw: string): number {
  if (!raw) return NaN;
  // Normalize pt-BR decimal notation:
  // If the string contains a comma (decimal separator in BRL locale), strip all
  // thousands-separator dots first, then replace the decimal comma with a dot.
  // Examples: "1,5" → 1.5, "1.000,50" → 1000.5, "2.5" → 2.5, "1000" → 1000.
  const hasComma = raw.includes(',');
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;
  return parseFloat(normalized);
}

/**
 * Clamps a quantity to the valid range for a given unit.
 *
 * - Discrete units (un, cx, pc, etc.): floors to a whole number using
 *   `Math.floor` (never rounds up — typing "1.5 un" yields 1, not 2,
 *   so the operator is never over-charged). Minimum is 0.
 * - Fractional units (mt, kg, lt, m2, m²): quantity is returned unchanged;
 *   decimals are meaningful and must be preserved.
 *
 * @param quantity - The raw quantity value (may be fractional).
 * @param unit - The `unit` field from a `Product`.
 * @returns The clamped quantity appropriate for the unit.
 */
export function clampQuantityForUnit(quantity: number, unit: string): number {
  if (isFractionalUnit(unit)) {
    return quantity;
  }
  // Discrete unit: floor to integer, minimum 0.
  return Math.max(0, Math.floor(quantity));
}
