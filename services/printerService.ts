/**
 * Printer Service (stub)
 * For direct ESC/POS or thermal printer support, integrate with a native bridge
 * or a backend print service. This stub intentionally throws to avoid silent failure.
 */

interface PrintJob {
  type: 'receipt' | 'invoice';
  html?: string;
  text?: string;
}

export async function printToHardwarePrinter(_job: PrintJob): Promise<void> {
  throw new Error('Hardware printer integration not configured. Please connect ESC/POS or print service.');
}

