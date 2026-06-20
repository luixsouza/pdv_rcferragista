/**
 * fiscalPlaceholders.ts
 *
 * Safe placeholder constants for fiscal documents that are NOT transmitted
 * to SEFAZ. All values are clearly fictitious so the documents cannot be
 * confused with authorized fiscal documents.
 *
 * FISC-03: every generated document must carry NFCE_DISCLAIMER or NFE_DISCLAIMER
 * and use these safe placeholders for fields that require SEFAZ authorization.
 */

// ── Access key (44-digit placeholder — all zeros) ──────────────────────────
/** 44-digit all-zero placeholder for the NF-e / NFC-e access key. */
export const PLACEHOLDER_ACCESS_KEY = '00000000000000000000000000000000000000000000';

// ── Product fiscal field placeholders ──────────────────────────────────────
/** NCM placeholder: 00000000 (all-zero, 8-digit code). */
export const PLACEHOLDER_NCM = '00000000';

/** CFOP placeholder: 5102 (standard retail sale to final consumer). */
export const PLACEHOLDER_CFOP = '5102';

/** CST/CSOSN placeholder: 400 (CSOSN - tributada pelo Simples Nacional). */
export const PLACEHOLDER_CST = '400';

/** Protocol number placeholder for documents not authorized by SEFAZ. */
export const PLACEHOLDER_PROTOCOL = 'SEM PROTOCOLO';

/** IE (Inscrição Estadual) placeholder when the store does not have one. */
export const PLACEHOLDER_IE = 'ISENTO';

/** NF-e / NFC-e série placeholder. */
export const PLACEHOLDER_SERIE = '001';

// ── Disclaimer strings (copy verbatim — do NOT alter dashes/accents) ───────
/**
 * Mandatory disclaimer for DANFE (NF-e model 55, A4).
 * Uses a regular hyphen as per SEFAZ homologation convention.
 */
export const NFE_DISCLAIMER =
  'NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL';

/**
 * Mandatory disclaimer for DANFE-NFCe (model 65, cupom 80mm).
 * Uses an EN-DASH (–) as specified in FISCAL-LAYOUT.md Part 4 — do NOT
 * replace with a hyphen (-) or em-dash (—).
 */
export const NFCE_DISCLAIMER =
  'EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL';

// ── QR Code placeholder URL ────────────────────────────────────────────────
/**
 * Static placeholder URL encoded in the NFC-e QR Code.
 * Contains the all-zero access key and sem_valor_fiscal=1 to make the
 * non-fiscal nature explicit even when the QR is scanned.
 */
export const NFCE_QR_PLACEHOLDER =
  `https://www.sefaz.go.gov.br/consulta-nfce?chave=${PLACEHOLDER_ACCESS_KEY}&sem_valor_fiscal=1`;

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Splits a 44-character access key string into 11 groups of 4 digits
 * separated by single spaces, as required for display on fiscal documents.
 *
 * Example:
 *   "00000000000000000000000000000000000000000000"
 *   → "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
 */
export function formatAccessKeyGroups(key: string): string {
  const padded = key.padEnd(44, '0').slice(0, 44);
  const groups: string[] = [];
  for (let i = 0; i < 44; i += 4) {
    groups.push(padded.slice(i, i + 4));
  }
  return groups.join(' ');
}
