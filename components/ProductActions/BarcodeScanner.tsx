/**
 * Barcode Scanner Component
 * Supports camera-based scanning and hardware scanner input
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Product } from '../../types';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  products: Product[];
  onProductFound?: (product: Product) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onScan,
  products,
  onProductFound
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize scanner
  useEffect(() => {
    if (isOpen && !codeReaderRef.current) {
      codeReaderRef.current = new BrowserMultiFormatReader();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    if (!videoRef.current || !codeReaderRef.current) return;

    setIsScanning(true);
    setError(null);

    try {
      // Get available video devices
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setError('No camera found. Please connect a camera device.');
        setIsScanning(false);
        return;
      }

      // Use the first available camera (or rear camera if available)
      const selectedDevice = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      ) || videoInputDevices[0];

      // Start scanning
      const result = await codeReaderRef.current.decodeOnceFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current
      );

      if (result) {
        const barcode = result.getText();
        handleBarcodeScanned(barcode);
      }
    } catch (err: any) {
      console.error('Barcode scan error:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Please connect a camera device.');
      } else {
        setError('Failed to start camera. Please try again.');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }

    setIsScanning(false);
  };

  const handleBarcodeScanned = React.useCallback((barcode: string) => {
    if (lastScanned === barcode) {
      // Prevent duplicate scans within 2 seconds
      return;
    }

    setLastScanned(barcode);
    
    // Find product by barcode
    const product = products.find(p => p.barcode === barcode);
    
    if (product) {
      if (onProductFound) {
        onProductFound(product);
      }
      onScan(barcode);
      showSuccess();
    } else {
      setError(`Product not found for barcode: ${barcode}`);
      onScan(barcode); // Still call onScan so parent can handle
    }

    // Reset error after 3 seconds
    setTimeout(() => {
      setError(null);
      setLastScanned(null);
    }, 3000);

    // Continue scanning after a brief pause
    if (isScanning) {
      scanTimeoutRef.current = setTimeout(() => {
        if (isOpen && videoRef.current) {
          startScanning();
        }
      }, 1000);
    }
  }, [lastScanned, products, onProductFound, onScan, isScanning, isOpen]);

  const showSuccess = () => {
    // Visual feedback for successful scan
    setTimeout(() => {
      setError(null);
    }, 2000);
  };

  const handleClose = () => {
    stopScanning();
    setError(null);
    setLastScanned(null);
    onClose();
  };

  // Handle hardware scanner input (keyboard events)
  useEffect(() => {
    if (!isOpen) return;

    let barcodeBuffer = '';
    let barcodeTimeout: NodeJS.Timeout;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Hardware scanners typically send characters very quickly
      // If Enter is pressed, it's likely a barcode scan
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault();
        handleBarcodeScanned(barcodeBuffer.trim());
        barcodeBuffer = '';
        return;
      }

      // Accumulate characters (barcode scanners type very fast)
      if (e.key.length === 1) {
        barcodeBuffer += e.key;
        
        // Clear buffer if no input for 100ms (normal typing)
        clearTimeout(barcodeTimeout);
        barcodeTimeout = setTimeout(() => {
          barcodeBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearTimeout(barcodeTimeout);
    };
  }, [isOpen, products, onProductFound, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[230] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden modal-content">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Scan Barcode</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Point camera at barcode or use hardware scanner
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-6">
          <div className="relative bg-neutral-900 rounded-xl overflow-hidden aspect-video flex items-center justify-center">
            {!isScanning ? (
              <div className="text-center text-white">
                <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm opacity-75">Click Start to begin scanning</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
            )}

            {/* Scanning Overlay */}
            {isScanning && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-orange-500 rounded-lg" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-16 text-center">
                  <p className="text-white text-sm font-medium bg-orange-500 px-3 py-1 rounded">
                    Position barcode here
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {lastScanned && !error && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Scanned: {lastScanned}</span>
            </div>
          )}

          {/* Controls */}
          <div className="mt-6 flex gap-3">
            {!isScanning ? (
              <button
                onClick={startScanning}
                className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-500 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Start Scanning
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-500 flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Stop Scanning
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-6 py-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Close
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <strong>Tip:</strong> Hardware barcode scanners work automatically. Just scan the barcode and it will be detected.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

