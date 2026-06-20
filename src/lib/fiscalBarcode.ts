/**
 * fiscalBarcode.ts
 *
 * Async barcode and QR code data-URL generators for fiscal documents.
 * Wraps bwip-js (CODE-128 barcode) and qrcode (QR code) — both operate
 * entirely client-side with no network access at runtime.
 *
 * Shared between the NFCe cupom (plan 06-01) and the DANFE A4 (plan 06-02).
 */

import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

/**
 * Generates a QR Code PNG data URL for the given text.
 *
 * Uses the `qrcode` npm package (toDataURL) with a 94 px canvas and a
 * 1-module quiet zone — produces a ~25 mm QR when rendered at 96 dpi.
 * No network calls are made.
 *
 * @param text  The content to encode (e.g., the NFC-e placeholder URL).
 * @returns     A "data:image/png;base64,..." string ready for jsPDF addImage.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { width: 94, margin: 1, type: 'image/png' });
}

/**
 * Generates a CODE-128 barcode PNG data URL for the given text.
 *
 * Uses bwip-js to render to an off-screen <canvas> in the browser/Electron
 * renderer, then converts to a PNG data URL via canvas.toDataURL().
 * No network calls are made.
 *
 * @param text  The content to encode (e.g., the 44-digit access key placeholder).
 * @returns     A "data:image/png;base64,..." string ready for jsPDF addImage.
 */
export async function generateBarcodeDataUrl(text: string): Promise<string> {
  const canvas = document.createElement('canvas');
  bwipjs.toCanvas(canvas, {
    bcid: 'code128',
    text,
    scale: 2,
    height: 12,
    includetext: false,
  });
  return canvas.toDataURL('image/png');
}
