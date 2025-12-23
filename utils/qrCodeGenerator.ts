/**
 * QR Code Generation Utility
 * Generates QR codes for shop links, product links, etc.
 */

/**
 * Generate QR code using external service or library
 * Note: For production, consider using a library like 'qrcode' or 'qrcode.react'
 */

/**
 * Generate QR code data URL using QR Server API (free service)
 * Alternative: Use qrcode library: npm install qrcode
 */
export async function generateQRCodeDataURL(
  data: string,
  options?: {
    size?: number;
    margin?: number;
  }
): Promise<string> {
  try {
    const size = options?.size || 200;
    const margin = options?.margin || 1;
    
    // Using QR Server API (free, no API key required)
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=${margin}&data=${encodeURIComponent(data)}`;
    
    // Fetch QR code image
    const response = await fetch(url);
    const blob = await response.blob();
    
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code for shop page
 */
export async function generateShopQRCode(shopUrl: string): Promise<string> {
  return generateQRCodeDataURL(shopUrl, { size: 300, margin: 2 });
}

/**
 * Generate QR code for product
 */
export async function generateProductQRCode(productUrl: string): Promise<string> {
  return generateQRCodeDataURL(productUrl, { size: 200, margin: 1 });
}

/**
 * Download QR code as image
 */
export async function downloadQRCode(
  data: string,
  filename?: string,
  options?: {
    size?: number;
    margin?: number;
  }
): Promise<void> {
  try {
    const dataURL = await generateQRCodeDataURL(data, options);
    
    // Create download link
    const link = document.createElement('a');
    link.download = filename || `qrcode-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  } catch (error) {
    console.error('Error downloading QR code:', error);
    throw new Error('Failed to download QR code');
  }
}

