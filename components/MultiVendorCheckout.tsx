/**
 * Multi-Vendor Checkout Component
 * Handles checkout for items from multiple vendors/pharmacies in a single transaction
 * Groups items by vendor and shows vendor-specific payment details
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Copy, CheckCircle, Loader2, Smartphone, Building2, CreditCard, AlertCircle, Check, Package, Truck } from 'lucide-react';
import { Product, User, PaymentProvider, PaymentConfig, MultiVendorOrder, VendorOrder } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { generateDeliveryOtp } from '../utils/deliveryUtils';
import { calculateDeliveryFee } from '../utils/deliveryFeeCalculator';

interface MultiVendorCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cart: { product: Product; quantity: number }[];
  customerDetails: { name: string; phone: string; address: string };
  deliveryType: 'self-pickup' | 'home-delivery';
  deliveryFee: number;
  onOrderCreated: (orderId: string) => void;
}

interface VendorGroup {
  vendorId: string;
  vendor: User | null;
  items: { product: Product; quantity: number }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentConfig: PaymentConfig | null;
}

interface VendorPaymentState {
  vendorId: string;
  paymentMethod: PaymentProvider | null;
  paymentMethodType: 'STK_PUSH' | 'MANUAL_MOBILE' | 'MANUAL_BANK' | null;
  transactionRef: string;
  isProcessing: boolean;
  stkPushSent: boolean;
}

export const MultiVendorCheckout: React.FC<MultiVendorCheckoutProps> = ({
  isOpen,
  onClose,
  cart,
  customerDetails,
  deliveryType,
  deliveryFee,
  onOrderCreated
}) => {
  const { user, allUsers, showNotification } = useAppContext();
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [vendorPayments, setVendorPayments] = useState<Record<string, VendorPaymentState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Group cart items by vendor
  useEffect(() => {
    if (!cart.length || !allUsers.length) return;

    const grouped = cart.reduce((acc, item) => {
      const vendorId = item.product.uid;
      if (!acc[vendorId]) {
        const vendor = allUsers.find(u => u.uid === vendorId);
        acc[vendorId] = {
          vendorId,
          vendor,
          items: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          paymentConfig: vendor?.paymentConfig || null
        };
      }
      acc[vendorId].items.push(item);
      return acc;
    }, {} as Record<string, VendorGroup>);

    // Calculate totals for each vendor group
    const groups = Object.values(grouped).map(group => {
      const subtotal = group.items.reduce((sum, item) => {
        const price = (item.product.discountPrice && item.product.discountPrice > 0 && item.product.discountPrice < item.product.price)
          ? item.product.discountPrice
          : item.product.price;
        return sum + (price * item.quantity);
      }, 0);
      
      const taxRate = 0.18; // 18% VAT
      const tax = subtotal * taxRate;
      const total = subtotal + tax;

      return {
        ...group,
        subtotal,
        tax,
        total
      };
    });

    setVendorGroups(groups);

    // Initialize payment states for each vendor
    const initialPayments: Record<string, VendorPaymentState> = {};
    groups.forEach(group => {
      initialPayments[group.vendorId] = {
        vendorId: group.vendorId,
        paymentMethod: null,
        paymentMethodType: null,
        transactionRef: '',
        isProcessing: false,
        stkPushSent: false
      };
    });
    setVendorPayments(initialPayments);
  }, [cart, allUsers]);

  // Fetch vendor payment configs
  useEffect(() => {
    if (!isOpen || !isFirebaseEnabled || !db) return;

    const fetchConfigs = async () => {
      for (const group of vendorGroups) {
        if (group.vendorId && !group.paymentConfig) {
          try {
            const vendorDoc = await getDoc(doc(db, 'users', group.vendorId));
            if (vendorDoc.exists()) {
              const vendorData = vendorDoc.data() as User;
              setVendorGroups(prev => prev.map(g => 
                g.vendorId === group.vendorId 
                  ? { ...g, paymentConfig: vendorData.paymentConfig || null, vendor: vendorData }
                  : g
              ));
            }
          } catch (error) {
            console.error(`Error fetching config for vendor ${group.vendorId}:`, error);
          }
        }
      }
    };

    fetchConfigs();
  }, [isOpen, vendorGroups, isFirebaseEnabled, db]);

  const handleCopyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      showNotification('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      showNotification('Failed to copy', 'error');
    }
  };

  const getVendorPaymentNumber = (vendorId: string, provider: PaymentProvider): string | null => {
    const group = vendorGroups.find(g => g.vendorId === vendorId);
    if (!group?.paymentConfig) return null;

    switch (provider) {
      case 'MPESA':
        return group.paymentConfig.mpesa?.enabled ? group.paymentConfig.mpesa.merchantNumber : null;
      case 'TIGO_PESA':
        return group.paymentConfig.tigoPesa?.enabled ? group.paymentConfig.tigoPesa.merchantNumber : null;
      case 'AIRTEL_MONEY':
        return group.paymentConfig.airtelMoney?.enabled ? group.paymentConfig.airtelMoney.merchantNumber : null;
      case 'BANK_TRANSFER':
        return group.paymentConfig.bankTransfer?.enabled ? group.paymentConfig.bankTransfer.accountNumber : null;
      default:
        return null;
    }
  };

  const getAvailableProviders = (vendorId: string): PaymentProvider[] => {
    const group = vendorGroups.find(g => g.vendorId === vendorId);
    if (!group?.paymentConfig) return [];

    const providers: PaymentProvider[] = [];
    if (group.paymentConfig.mpesa?.enabled) providers.push('MPESA');
    if (group.paymentConfig.tigoPesa?.enabled) providers.push('TIGO_PESA');
    if (group.paymentConfig.airtelMoney?.enabled) providers.push('AIRTEL_MONEY');
    if (group.paymentConfig.bankTransfer?.enabled) providers.push('BANK_TRANSFER');
    return providers;
  };

  const handlePaymentMethodSelect = async (vendorId: string, provider: PaymentProvider, methodType: 'STK_PUSH' | 'MANUAL_MOBILE' | 'MANUAL_BANK') => {
    setVendorPayments(prev => ({
      ...prev,
      [vendorId]: {
        ...prev[vendorId],
        paymentMethod: provider,
        paymentMethodType: methodType,
        transactionRef: '',
        stkPushSent: false
      }
    }));

    // If STK Push, initiate the push
    if (methodType === 'STK_PUSH') {
      setVendorPayments(prev => ({
        ...prev,
        [vendorId]: {
          ...prev[vendorId],
          isProcessing: true
        }
      }));

      try {
        // TODO: Call actual STK Push API
        // For now, simulate STK Push
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setVendorPayments(prev => ({
          ...prev,
          [vendorId]: {
            ...prev[vendorId],
            stkPushSent: true,
            isProcessing: false
          }
        }));
        
        showNotification(`STK Push sent to your ${provider.replace('_', ' ')} number`, 'success');
      } catch (error) {
        showNotification('Failed to send STK Push. Please use manual entry.', 'error');
        setVendorPayments(prev => ({
          ...prev,
          [vendorId]: {
            ...prev[vendorId],
            isProcessing: false
          }
        }));
      }
    }
  };

  const canSubmit = useMemo(() => {
    return vendorGroups.every(group => {
      const payment = vendorPayments[group.vendorId];
      if (!payment) return false;
      
      // Must have selected payment method
      if (!payment.paymentMethod || !payment.paymentMethodType) return false;
      
      // For manual methods, must have transaction reference
      if (payment.paymentMethodType !== 'STK_PUSH' && !payment.transactionRef.trim()) return false;
      
      // For STK Push, must have transaction reference (after payment)
      if (payment.paymentMethodType === 'STK_PUSH' && payment.stkPushSent && !payment.transactionRef.trim()) return false;
      
      return true;
    });
  }, [vendorGroups, vendorPayments]);

  const handleSubmitPayment = async () => {
    if (!canSubmit || !user) {
      showNotification('Please complete payment for all vendors', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isFirebaseEnabled || !db) {
        showNotification('Database connection unavailable', 'error');
        setIsSubmitting(false);
        return;
      }

      const deliveryOtp = generateDeliveryOtp();
      const now = new Date().toISOString();

      // Create vendor orders (sub-orders)
      const vendorOrders: VendorOrder[] = [];
      const transactions: any[] = [];

      for (const group of vendorGroups) {
        const payment = vendorPayments[group.vendorId];
        if (!payment.paymentMethod || !payment.paymentMethodType) continue;

        // Create vendor order
        const vendorOrder: VendorOrder = {
          id: '', // Will be set after creation
          vendorId: group.vendorId,
          vendorName: group.vendor?.name || group.vendor?.storeName || 'Vendor',
          customerId: user.uid,
          customerName: customerDetails.name.trim(),
          date: now,
          status: 'Pending',
          paymentStatus: 'PENDING_VERIFICATION',
          total: group.total,
          items: group.items.map(item => ({
            productId: item.product.id,
            name: item.product.name,
            price: (item.product.discountPrice && item.product.discountPrice > 0 && item.product.discountPrice < item.product.price)
              ? item.product.discountPrice
              : item.product.price,
            quantity: item.quantity
          })),
          transactionRef: payment.transactionRef.trim().toUpperCase(),
          paymentMethod: payment.paymentMethod,
          paymentMethodType: payment.paymentMethodType,
          createdAt: now,
          tax: group.tax,
          discount: 0,
          refund: 0
        };

        if (customerDetails.address?.trim()) {
          vendorOrder.deliveryAddress = customerDetails.address.trim();
        }

        // Save vendor order to Firestore
        const orderRef = await addDoc(collection(db, 'vendor_orders'), vendorOrder);
        vendorOrder.id = orderRef.id;
        vendorOrders.push(vendorOrder);

        // Create transaction record
        const transaction = {
          userId: user.uid,
          orderId: orderRef.id,
          vendorId: group.vendorId,
          amount: group.total,
          currency: 'TZS',
          provider: payment.paymentMethod,
          status: 'PENDING_VERIFICATION',
          referenceId: payment.transactionRef.trim().toUpperCase(),
          type: 'Payment',
          paymentMethod: payment.paymentMethodType,
          createdAt: now,
          description: `Payment for order from ${vendorOrder.vendorName}`
        };

        const transactionRef = await addDoc(collection(db, 'transactions'), transaction);
        transactions.push({ id: transactionRef.id, ...transaction });
      }

      // Create main multi-vendor order
      const totalAmount = vendorGroups.reduce((sum, g) => sum + g.total, 0) + deliveryFee;
      
      const multiVendorOrder: MultiVendorOrder = {
        id: '', // Will be set after creation
        customerId: user.uid,
        customerName: customerDetails.name.trim(),
        date: now,
        status: 'Pending',
        total: totalAmount,
        vendorOrders,
        createdAt: now,
        deliveryType,
        deliveryRequested: deliveryType === 'home-delivery',
        deliveryFee: deliveryType === 'home-delivery' ? deliveryFee : 0,
        deliveryOtp,
        tax: vendorGroups.reduce((sum, g) => sum + g.tax, 0),
        discount: 0,
        refund: 0,
        channel: 'Online'
      };

      if (customerDetails.address?.trim()) {
        multiVendorOrder.deliveryAddress = customerDetails.address.trim();
      }

      const mainOrderRef = await addDoc(collection(db, 'multi_vendor_orders'), multiVendorOrder);
      multiVendorOrder.id = mainOrderRef.id;

      // Update vendor orders with main order ID
      for (const vendorOrder of vendorOrders) {
        await updateDoc(doc(db, 'vendor_orders', vendorOrder.id), {
          mainOrderId: mainOrderRef.id
        });
      }

      showNotification('Orders created! Vendors will verify your payments.', 'success');
      onOrderCreated(mainOrderRef.id);
      onClose();
    } catch (error: any) {
      console.error('Multi-vendor checkout error:', error);
      showNotification(`Failed to create orders: ${error.message || 'An unknown error occurred.'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const grandTotal = vendorGroups.reduce((sum, g) => sum + g.total, 0) + deliveryFee;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl modal-content my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Multi-Vendor Checkout</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Complete payment for {vendorGroups.length} {vendorGroups.length === 1 ? 'vendor' : 'vendors'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {vendorGroups.map((group) => {
            const payment = vendorPayments[group.vendorId] || {
              vendorId: group.vendorId,
              paymentMethod: null,
              paymentMethodType: null,
              transactionRef: '',
              isProcessing: false,
              stkPushSent: false
            };

            const availableProviders = getAvailableProviders(group.vendorId);
            const hasConfig = group.paymentConfig && availableProviders.length > 0;

            return (
              <div
                key={group.vendorId}
                className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-6 border border-neutral-200 dark:border-neutral-700"
              >
                {/* Vendor Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {group.vendor?.storeName || group.vendor?.name || 'Vendor'}
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'} • TZS {group.total.toLocaleString()}
                    </p>
                  </div>
                  {payment.paymentMethod && payment.transactionRef && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Payment Ready</span>
                    </div>
                  )}
                </div>

                {/* Items List */}
                <div className="mb-4 space-y-2">
                  {group.items.map((item, idx) => {
                    const price = (item.product.discountPrice && item.product.discountPrice > 0 && item.product.discountPrice < item.product.price)
                      ? item.product.discountPrice
                      : item.product.price;
                    return (
                      <div key={idx} className="flex justify-between text-sm text-neutral-700 dark:text-neutral-300">
                        <span>{item.product.name} × {item.quantity}</span>
                        <span className="font-medium">TZS {(price * item.quantity).toLocaleString()}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
                    <span className="font-medium text-neutral-900 dark:text-white">TZS {group.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Tax (18% VAT)</span>
                    <span className="font-medium text-neutral-900 dark:text-white">TZS {group.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span>Total</span>
                    <span>TZS {group.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Method Selection */}
                {!hasConfig ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-yellow-900 dark:text-yellow-200">
                          Payment methods not configured
                        </p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          This vendor has not set up payment methods. Please contact them directly.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!payment.paymentMethod ? (
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                          Select Payment Method
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {availableProviders.map((provider) => {
                            const isMobile = ['MPESA', 'TIGO_PESA', 'AIRTEL_MONEY'].includes(provider);
                            return (
                              <div key={provider} className="space-y-2">
                                <button
                                  onClick={() => handlePaymentMethodSelect(group.vendorId, provider, isMobile ? 'STK_PUSH' : 'MANUAL_BANK')}
                                  className="w-full p-3 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {isMobile ? (
                                      <Smartphone className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Building2 className="w-4 h-4 text-blue-600" />
                                    )}
                                    <span className="font-medium text-sm">{provider.replace('_', ' ')}</span>
                                  </div>
                                  <span className="text-xs text-neutral-500">STK Push</span>
                                </button>
                                {isMobile && (
                                  <button
                                    onClick={() => handlePaymentMethodSelect(group.vendorId, provider, 'MANUAL_MOBILE')}
                                    className="w-full p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all text-xs text-neutral-600 dark:text-neutral-400"
                                  >
                                    Manual Entry
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Selected Payment Method */}
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {payment.paymentMethodType === 'STK_PUSH' ? (
                                <Smartphone className="w-5 h-5 text-green-600" />
                              ) : payment.paymentMethodType === 'MANUAL_BANK' ? (
                                <Building2 className="w-5 h-5 text-blue-600" />
                              ) : (
                                <CreditCard className="w-5 h-5 text-purple-600" />
                              )}
                              <span className="font-semibold text-blue-900 dark:text-blue-200">
                                {payment.paymentMethod.replace('_', ' ')}
                              </span>
                            </div>
                            <button
                              onClick={() => setVendorPayments(prev => ({
                                ...prev,
                                [group.vendorId]: {
                                  ...prev[group.vendorId],
                                  paymentMethod: null,
                                  paymentMethodType: null,
                                  transactionRef: '',
                                  stkPushSent: false
                                }
                              }))}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Change
                            </button>
                          </div>
                          
                          {/* Payment Number Display */}
                          {payment.paymentMethod && (
                            <div className="mt-3">
                              <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Send payment to:</p>
                              <div className="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-2">
                                <code className="flex-1 font-mono text-sm font-bold text-neutral-900 dark:text-white">
                                  {getVendorPaymentNumber(group.vendorId, payment.paymentMethod) || 'Not configured'}
                                </code>
                                {getVendorPaymentNumber(group.vendorId, payment.paymentMethod) && (
                                  <button
                                    onClick={() => handleCopyToClipboard(
                                      getVendorPaymentNumber(group.vendorId, payment.paymentMethod!) || '',
                                      `${group.vendorId}-${payment.paymentMethod}`
                                    )}
                                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                                  >
                                    {copiedField === `${group.vendorId}-${payment.paymentMethod}` ? (
                                      <Check className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <Copy className="w-4 h-4 text-neutral-600" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* STK Push Status */}
                          {payment.paymentMethodType === 'STK_PUSH' && payment.stkPushSent && (
                            <div className="mt-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                              <p className="text-sm text-green-700 dark:text-green-300">
                                ✓ STK Push sent! Check your phone and enter your PIN. Then enter the transaction reference below.
                              </p>
                            </div>
                          )}

                          {/* Transaction Reference Input */}
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                              Transaction Reference Code *
                            </label>
                            <input
                              type="text"
                              className="w-full p-3 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
                              placeholder="e.g., QWF82937JK"
                              value={payment.transactionRef}
                              onChange={(e) => setVendorPayments(prev => ({
                                ...prev,
                                [group.vendorId]: {
                                  ...prev[group.vendorId],
                                  transactionRef: e.target.value.toUpperCase()
                                }
                              }))}
                              disabled={isSubmitting}
                              maxLength={20}
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                              Enter the code from your SMS/bank confirmation
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Delivery Summary */}
          {deliveryFee > 0 && (
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-5 h-5 text-orange-600" />
                <span className="font-semibold text-neutral-900 dark:text-white">Delivery Fee</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {deliveryType === 'home-delivery' ? 'Home Delivery' : 'Self-Pickup'}
              </p>
              <p className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
                TZS {deliveryFee.toLocaleString()}
              </p>
            </div>
          )}

          {/* Grand Total */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border-2 border-orange-200 dark:border-orange-800">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold text-neutral-900 dark:text-white">Grand Total</span>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                TZS {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitPayment}
            disabled={!canSubmit || isSubmitting}
            className="px-6 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-500 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                I Have Paid
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

