/**
 * Barcode Scanning Utilities
 * Handles barcode scanning using browser APIs and camera
 */

export interface ScanResult {
  code: string;
  format?: string;
  timestamp: number;
}

export interface ScannerOptions {
  onScan?: (result: ScanResult) => void;
  onError?: (error: Error) => void;
  formats?: string[];
  continuous?: boolean;
}

/**
 * Check if barcode scanning is supported
 */
export function isBarcodeScanningSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof BarcodeDetector !== 'undefined'
  );
}

/**
 * Initialize BarcodeDetector (if available)
 */
export async function initBarcodeDetector(): Promise<BarcodeDetector | null> {
  if (typeof BarcodeDetector === 'undefined') {
    return null;
  }

  try {
    const formats = await BarcodeDetector.getSupportedFormats();
    if (formats.length === 0) {
      console.warn('No barcode formats supported');
      return null;
    }

    return new BarcodeDetector({ formats });
  } catch (error) {
    console.error('Failed to initialize BarcodeDetector:', error);
    return null;
  }
}

/**
 * Start scanning from camera stream
 */
export async function startBarcodeScanning(
  videoElement: HTMLVideoElement,
  options: ScannerOptions = {}
): Promise<() => void> {
  const { onScan, onError, formats, continuous = true } = options;

  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Use back camera on mobile
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    videoElement.srcObject = stream;
    videoElement.play();

    let detector: BarcodeDetector | null = null;
    let animationFrameId: number | null = null;
    let isScanning = true;

    // Initialize BarcodeDetector if available
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        const supportedFormats = await BarcodeDetector.getSupportedFormats();
        const formatsToUse = formats || supportedFormats;
        detector = new BarcodeDetector({ formats: formatsToUse });
      } catch (error) {
        console.warn('BarcodeDetector not available, using fallback method');
      }
    }

    const scanFrame = async () => {
      if (!isScanning || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
        animationFrameId = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        if (detector) {
          // Use BarcodeDetector API (Chrome/Edge)
          const barcodes = await detector.detect(videoElement);
          
          if (barcodes.length > 0) {
            const barcode = barcodes[0];
            const result: ScanResult = {
              code: barcode.rawValue,
              format: barcode.format,
              timestamp: Date.now()
            };

            onScan?.(result);

            if (!continuous) {
              isScanning = false;
              stream.getTracks().forEach(track => track.stop());
              return;
            }
          }
        } else {
          // Fallback: Manual barcode detection (would require a library like QuaggaJS)
          // For now, we'll just log that manual detection is needed
          console.warn('BarcodeDetector API not available. Install QuaggaJS for full support.');
        }
      } catch (error: any) {
        console.error('Scan error:', error);
        onError?.(error);
      }

      if (isScanning) {
        animationFrameId = requestAnimationFrame(scanFrame);
      }
    };

    // Start scanning loop
    animationFrameId = requestAnimationFrame(scanFrame);

    // Cleanup function
    return () => {
      isScanning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    };

  } catch (error: any) {
    console.error('Failed to start camera:', error);
    onError?.(error);
    
    // Return empty cleanup function
    return () => {};
  }
}

/**
 * Scan barcode from image file
 */
export async function scanBarcodeFromImage(
  imageFile: File,
  options: ScannerOptions = {}
): Promise<ScanResult | null> {
  const { onError, formats } = options;

  try {
    if (typeof BarcodeDetector === 'undefined') {
      throw new Error('BarcodeDetector API not supported in this browser');
    }

    const image = await createImageBitmap(imageFile);
    const formatsToUse = formats || await BarcodeDetector.getSupportedFormats();
    const detector = new BarcodeDetector({ formats: formatsToUse });
    const barcodes = await detector.detect(image);

    if (barcodes.length > 0) {
      const barcode = barcodes[0];
      const result: ScanResult = {
        code: barcode.rawValue,
        format: barcode.format,
        timestamp: Date.now()
      };

      options.onScan?.(result);
      return result;
    }

    return null;
  } catch (error: any) {
    console.error('Failed to scan barcode from image:', error);
    onError?.(error);
    return null;
  }
}

/**
 * Generate barcode image (for display)
 * Note: This is a placeholder. In production, use a library like JsBarcode
 */
export function generateBarcodeSVG(code: string, format: string = 'CODE128'): string {
  // This is a placeholder. In production, use JsBarcode library:
  // import JsBarcode from 'jsbarcode';
  // const canvas = document.createElement('canvas');
  // JsBarcode(canvas, code, { format });
  // return canvas.toDataURL();

  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
      <rect width="200" height="100" fill="white"/>
      <text x="100" y="50" text-anchor="middle" font-family="monospace" font-size="16">${code}</text>
    </svg>
  `)}`;
}

/**
 * Validate barcode format
 */
export function validateBarcode(code: string, format?: string): boolean {
  if (!code || code.length === 0) {
    return false;
  }

  // Basic validation - only alphanumeric and common barcode characters
  const validPattern = /^[A-Za-z0-9\-_]+$/;
  if (!validPattern.test(code)) {
    return false;
  }

  // Format-specific validation
  if (format) {
    switch (format.toUpperCase()) {
      case 'EAN_13':
        return /^\d{13}$/.test(code);
      case 'EAN_8':
        return /^\d{8}$/.test(code);
      case 'CODE_128':
        return code.length >= 2 && code.length <= 80;
      case 'QR_CODE':
        return code.length > 0;
      default:
        return true;
    }
  }

  return true;
}

