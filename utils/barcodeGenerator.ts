/**
 * Barcode Generation Utility
 * Generates barcodes for products using jsbarcode library
 */

import JsBarcode from 'jsbarcode';

/**
 * Generate barcode as data URL (base64 image)
 */
export function generateBarcodeDataURL(
  value: string,
  options?: {
    format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39';
    width?: number;
    height?: number;
    displayValue?: boolean;
  }
): string {
  try {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    
    // Generate barcode
    JsBarcode(canvas, value, {
      format: options?.format || 'CODE128',
      width: options?.width || 2,
      height: options?.height || 100,
      displayValue: options?.displayValue !== false,
      margin: 10,
      background: '#ffffff',
      lineColor: '#000000',
      font: 'monospace',
      fontSize: 20,
      textMargin: 5,
    });

    // Convert to data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error generating barcode:', error);
    throw new Error('Failed to generate barcode');
  }
}

/**
 * Generate barcode and return as blob
 */
export function generateBarcodeBlob(
  value: string,
  options?: {
    format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39';
    width?: number;
    height?: number;
    displayValue?: boolean;
  }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const dataURL = generateBarcodeDataURL(value, options);
      
      // Convert data URL to blob
      fetch(dataURL)
        .then(res => res.blob())
        .then(blob => resolve(blob))
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate barcode and download as image
 */
export function downloadBarcode(
  value: string,
  filename?: string,
  options?: {
    format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39';
    width?: number;
    height?: number;
    displayValue?: boolean;
  }
): void {
  try {
    const dataURL = generateBarcodeDataURL(value, options);
    
    // Create download link
    const link = document.createElement('a');
    link.download = filename || `barcode-${value}.png`;
    link.href = dataURL;
    link.click();
  } catch (error) {
    console.error('Error downloading barcode:', error);
    throw new Error('Failed to download barcode');
  }
}

/**
 * Generate barcode for product
 */
export function generateProductBarcode(productCode: string, productName?: string): string {
  try {
    return generateBarcodeDataURL(productCode, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
    });
  } catch (error) {
    console.error('Error generating product barcode:', error);
    throw error;
  }
}

