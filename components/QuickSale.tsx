/**
 * Quick Sale Component
 * Ultra-fast checkout for immediate sales without customer details
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Product, Order, UserRole } from '../types';
import { X, ShoppingCart, Zap, DollarSign, Keyboard } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { isOnline, queueOrder } from '../services/offlineService';
import { findProductByBarcode } from '../utils/barcodeUtils';
import { calculateOrderCommission, getCommissionRate } from '../utils/commissionUtils';

interface QuickSaleProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickSale: React.FC<QuickSaleProps> = ({ isOpen, onClose }) => {
  const { products, user, showNotification, cart, setCart } = useAppContext();
  const [quickCart, setQuickCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Memoize handleCompleteSale to prevent recreation
  const handleCompleteSaleMemo = useCallback(async () => {
    if (quickCart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    if (!user) {
      showNotification('User session not found', 'error');
      return;
    }

    setIsProcessing(true);

    const sellerId = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
    const subtotal = quickCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    const taxRate = 0.18; // 18% VAT
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;
    const isSalesRep = user.role === UserRole.SALES_REP;
    const commissionRate = getCommissionRate(user);
    const commissionAmount = isSalesRep ? calculateOrderCommission({ total } as Order, user) : 0;

    // Construct Order Data (only include defined values - Firestore doesn't allow undefined)
    const orderData: any = {
      sellerId: sellerId || '',
      customerName: 'Walk-in Customer',
      date: new Date().toISOString(),
      status: 'Completed',
      total,
      items: quickCart.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      createdAt: new Date().toISOString(),
      paymentMethod: 'Cash',
      // Tax, Discount, Refund fields
      tax: taxAmount,
      discount: 0, // Quick sale typically no discount
      refund: 0, // Default to 0
      // Branch and Channel fields
      channel: 'POS' // Quick sale is always POS/in-store
    };

    // Only add optional fields if they have values
    if (isSalesRep && user.uid) {
      orderData.salesRepId = user.uid;
    }
    if (isSalesRep && user.name) {
      orderData.salesRepName = user.name;
    }
    if (commissionAmount > 0) {
      orderData.commission = commissionAmount;
    }

    try {
      const online = isOnline();

      if (online && isFirebaseEnabled && db) {
        await addDoc(collection(db, 'orders'), orderData);
        showNotification('Sale completed successfully!', 'success');
        setQuickCart([]);
        onClose();
      } else if (!online) {
        const orderWithId: Order = {
          ...orderData,
          id: `offline_${Date.now()}`,
        } as Order;
        await queueOrder(orderWithId);
        showNotification('Sale queued. Will sync when online.', 'info');
        setQuickCart([]);
        onClose();
      } else {
        showNotification('Database connection unavailable', 'error');
      }
    } catch (error: any) {
      console.error('Error completing sale:', error);
      showNotification(`Failed to complete sale: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [quickCart, user, showNotification, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter: Complete sale
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleCompleteSaleMemo();
      }
      
      // Escape: Close modal
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Focus barcode input on any alphanumeric key (if not already focused)
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, handleCompleteSaleMemo, onClose]);

  // Focus barcode input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } else {
      setQuickCart([]);
    }
  }, [isOpen]);

  const addProduct = (product: Product, quantity: number = 1) => {
    setQuickCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    showNotification(`Added ${product.name}`, 'success');
  };

  const removeProduct = (productId: string) => {
    setQuickCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuickCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQuantity = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQuantity };
        }
        return item;
      })
    );
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const barcode = e.target.value.trim();
    
    // Auto-detect when barcode is complete (typically 8-13 digits)
    if (barcode.length >= 8 && /^\d+$/.test(barcode)) {
      const product = findProductByBarcode(products, barcode);
      if (product) {
        addProduct(product, 1);
        e.target.value = '';
      } else {
        showNotification(`Product not found: ${barcode}`, 'error');
        e.target.value = '';
      }
    }
  };


  const total = quickCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800 modal-content">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-gradient-to-r from-orange-600 to-orange-500 text-white">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Quick Sale</h3>
              <p className="text-xs opacity-90">Instant checkout • Press Ctrl+Enter to complete</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Product Selection */}
          <div className="flex-1 p-4 overflow-y-auto">
            {/* Barcode Input */}
            <div className="mb-4">
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Scan barcode or type product name..."
                onInput={handleBarcodeInput}
                className="w-full p-3 border-2 border-orange-500 rounded-xl text-lg font-mono focus:ring-2 focus:ring-orange-500 outline-none dark:bg-neutral-800 dark:text-white dark:border-orange-600"
                autoFocus
              />
              <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                <Keyboard className="w-3 h-3" />
                Keyboard shortcuts: Ctrl+Enter to complete, Esc to close
              </p>
            </div>

            {/* Quick Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {products.slice(0, 20).map(product => (
                <button
                  key={product.id}
                  onClick={() => addProduct(product, 1)}
                  className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all text-left"
                >
                  <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1 truncate">
                    {product.name}
                  </div>
                  <div className="text-xs font-bold text-orange-600 dark:text-orange-400">
                    TZS {product.price.toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-96 border-l border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50 dark:bg-neutral-950">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({quickCart.length})
              </h4>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {quickCart.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                quickCart.map(item => (
                  <div
                    key={item.product.id}
                    className="bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm text-neutral-900 dark:text-white">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-neutral-500">
                          TZS {item.product.price.toLocaleString()} each
                        </div>
                      </div>
                      <button
                        onClick={() => removeProduct(item.product.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600"
                        >
                          -
                        </button>
                        <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="w-6 h-6 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-sm font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600"
                        >
                          +
                        </button>
                      </div>
                      <div className="font-bold text-neutral-900 dark:text-white">
                        TZS {(item.product.price * item.quantity).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total & Complete Button */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-bold text-neutral-900 dark:text-white">Total</span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  TZS {total.toLocaleString()}
                </span>
              </div>
              <button
                onClick={handleCompleteSaleMemo}
                disabled={quickCart.length === 0 || isProcessing}
                className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DollarSign className="w-5 h-5" />
                    Complete Sale (Ctrl+Enter)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

