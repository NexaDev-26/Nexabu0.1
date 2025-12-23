/**
 * Barcode Utilities
 * Helper functions for barcode operations
 */

import { Product } from '../types';

/**
 * Search products by barcode
 */
export function findProductByBarcode(products: Product[], barcode: string): Product | undefined {
  if (!barcode || !barcode.trim()) return undefined;
  
  return products.find(
    product => 
      product.barcode?.toLowerCase().trim() === barcode.toLowerCase().trim()
  );
}

/**
 * Validate barcode format
 */
export function isValidBarcode(barcode: string): boolean {
  if (!barcode || barcode.trim().length === 0) return false;
  
  // Common barcode formats:
  // EAN-13: 13 digits
  // EAN-8: 8 digits
  // UPC-A: 12 digits
  // Code-128: variable length alphanumeric
  // Code-39: variable length alphanumeric
  
  const trimmed = barcode.trim();
  
  // At least 4 characters (minimum practical barcode length)
  if (trimmed.length < 4) return false;
  
  // Max 50 characters (reasonable limit)
  if (trimmed.length > 50) return false;
  
  return true;
}

/**
 * Format barcode for display
 */
export function formatBarcode(barcode: string): string {
  if (!barcode) return '';
  
  // For numeric barcodes (EAN, UPC), add spacing for readability
  if (/^\d+$/.test(barcode)) {
    if (barcode.length === 13) {
      // EAN-13: 123 4567890123
      return `${barcode.slice(0, 3)} ${barcode.slice(3)}`;
    } else if (barcode.length === 12) {
      // UPC-A: 123456 789012
      return `${barcode.slice(0, 6)} ${barcode.slice(6)}`;
    } else if (barcode.length === 8) {
      // EAN-8: 1234 5678
      return `${barcode.slice(0, 4)} ${barcode.slice(4)}`;
    }
  }
  
  return barcode;
}

/**
 * Generate a unique barcode (for testing or new products)
 */
export function generateBarcode(prefix: string = 'NEX'): string {
  const timestamp = Date.now().toString().slice(-10);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
}

