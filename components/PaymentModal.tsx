/**
 * Payment Modal Component
 * Patient payment selection with STK Push and manual transaction reference entry
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, Smartphone, CheckCircle, Loader2, X, AlertCircle, Copy, Check, Building2 } from 'lucide-react';
import { PaymentProvider, PaymentConfig, User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData?: any; // Order data to create order after payment confirmation
  orderId?: string; // Optional: if order already exists
  amount: number;
  sellerId?: string; // Vendor/Pharmacy ID to fetch payment config
  onPaymentSubmitted: (transactionRef: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  orderData,
  orderId,
  amount,
  sellerId,
  onPaymentSubmitted
}) => {
  const { user, showNotification, allUsers } = useAppContext();
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [stkPushSent, setStkPushSent] = useState(false);
  const [vendorPaymentConfig, setVendorPaymentConfig] = useState<PaymentConfig | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [vendor, setVendor] = useState<User | null>(null);

  // Fetch vendor payment config
  useEffect(() => {
    if (isOpen && sellerId) {
      const fetchVendorConfig = async () => {
        try {
          // Reset state first
          setVendorPaymentConfig(null);
          setVendor(null);
          
          // First try to get from allUsers context (faster, but may be stale)
          const vendorFromContext = allUsers.find(u => u.uid === sellerId);
          if (vendorFromContext) {
            setVendor(vendorFromContext);
            if (vendorFromContext.paymentConfig) {
              setVendorPaymentConfig(vendorFromContext.paymentConfig);
            }
          }

          // Always fetch from Firestore to get latest payment config
          if (isFirebaseEnabled && db) {
            const vendorDoc = await getDoc(doc(db, 'users', sellerId));
            if (vendorDoc.exists()) {
              const vendorData = vendorDoc.data() as User;
              setVendor(vendorData);
              setVendorPaymentConfig(vendorData.paymentConfig || null);
            } else {
              // Vendor not found
              setVendorPaymentConfig(null);
              setVendor(null);
            }
          }
        } catch (error) {
          console.error('Error fetching vendor payment config:', error);
          showNotification('Failed to load vendor payment methods. Please try again.', 'error');
        }
      };
      fetchVendorConfig();
    } else {
      // Reset when modal closes
      setVendorPaymentConfig(null);
      setVendor(null);
      setSelectedProvider(null);
      setTransactionRef('');
      setStkPushSent(false);
      setShowManualEntry(false);
    }
  }, [isOpen, sellerId, allUsers, isFirebaseEnabled, db, showNotification]);

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

  const getVendorPaymentNumber = (provider: PaymentProvider): string | null => {
    if (!vendorPaymentConfig) return null;
    
    switch (provider) {
      case 'MPESA':
        return vendorPaymentConfig.mpesa?.enabled ? vendorPaymentConfig.mpesa.merchantNumber : null;
      case 'TIGO_PESA':
        return vendorPaymentConfig.tigoPesa?.enabled ? vendorPaymentConfig.tigoPesa.merchantNumber : null;
      case 'AIRTEL_MONEY':
        return vendorPaymentConfig.airtelMoney?.enabled ? vendorPaymentConfig.airtelMoney.merchantNumber : null;
      case 'BANK_TRANSFER':
        return vendorPaymentConfig.bankTransfer?.enabled ? vendorPaymentConfig.bankTransfer.accountNumber : null;
      default:
        return null;
    }
  };

  const getVendorAccountName = (provider: PaymentProvider): string | null => {
    if (!vendorPaymentConfig) return null;
    
    switch (provider) {
      case 'MPESA':
        return vendorPaymentConfig.mpesa?.accountName || null;
      case 'TIGO_PESA':
        return vendorPaymentConfig.tigoPesa?.accountName || null;
      case 'AIRTEL_MONEY':
        return vendorPaymentConfig.airtelMoney?.accountName || null;
      case 'BANK_TRANSFER':
        return vendorPaymentConfig.bankTransfer?.accountName || null;
      default:
        return null;
    }
  };

  const getAvailablePaymentProviders = (): PaymentProvider[] => {
    if (!vendorPaymentConfig) return [];
    
    const available: PaymentProvider[] = [];
    // Only include providers that are enabled AND have merchant/account numbers
    if (vendorPaymentConfig.mpesa?.enabled && vendorPaymentConfig.mpesa.merchantNumber) {
      available.push('MPESA');
    }
    if (vendorPaymentConfig.tigoPesa?.enabled && vendorPaymentConfig.tigoPesa.merchantNumber) {
      available.push('TIGO_PESA');
    }
    if (vendorPaymentConfig.airtelMoney?.enabled && vendorPaymentConfig.airtelMoney.merchantNumber) {
      available.push('AIRTEL_MONEY');
    }
    if (vendorPaymentConfig.bankTransfer?.enabled && vendorPaymentConfig.bankTransfer.accountNumber) {
      available.push('BANK_TRANSFER');
    }
    
    return available; // Return only actually configured providers
  };

  const mobileMoneyProviders = getAvailablePaymentProviders();

  const handleProviderSelect = async (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setShowManualEntry(false);
    setStkPushSent(false);
    
    // Simulate STK Push initiation
    setIsProcessing(true);
    try {
      // TODO: Call backend API to initiate STK Push
      // await fetch('/api/payments/initiate', { ... });
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStkPushSent(true);
      showNotification(`STK Push sent to your ${provider.replace('_', ' ')} number`, 'success');
    } catch (error) {
      showNotification('Failed to send STK Push. Please use manual entry.', 'error');
      setShowManualEntry(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualEntry = () => {
    setShowManualEntry(true);
    setStkPushSent(false);
  };

  const handleSubmitPayment = async () => {
    if (!selectedProvider) {
      showNotification('Please select a payment method', 'error');
      return;
    }

    if (!transactionRef.trim()) {
      showNotification('Please enter your transaction reference code', 'error');
      return;
    }

    if (transactionRef.length < 6) {
      showNotification('Transaction reference code must be at least 6 characters', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      if (isFirebaseEnabled && db && user?.uid) {
        let finalOrderId = orderId;

        // Create order if it doesn't exist yet (orderData provided)
        if (orderData && !orderId) {
          // Add transaction reference and payment method to order data
          const orderToCreate = {
            ...orderData,
            transactionRef: transactionRef.toUpperCase(),
            paymentMethod: selectedProvider,
            paymentStatus: 'PENDING_VERIFICATION',
            updatedAt: new Date().toISOString()
          };

          // Create the order
          const orderRef = await addDoc(collection(db, 'orders'), orderToCreate);
          finalOrderId = orderRef.id;

          // Add customer to vendor's customer list if customer details provided
          if (orderData.customerDetails && orderData.sellerId) {
            try {
              const customerQuery = query(
                collection(db, 'customers'),
                where('uid', '==', orderData.sellerId),
                where('phone', '==', orderData.customerDetails.phone)
              );
              const existingCustomers = await getDocs(customerQuery);
              
              if (existingCustomers.empty && orderData.customerDetails.phone) {
                const customerData: Partial<Customer> = {
                  uid: orderData.sellerId,
                  fullName: orderData.customerDetails.name,
                  phone: orderData.customerDetails.phone,
                  email: '',
                  type: 'Customer',
                  status: 'Active',
                  openingBalance: 0,
                  dateAdded: new Date().toISOString(),
                  residentAddress: orderData.customerDetails.address || ''
                };
                await addDoc(collection(db, 'customers'), customerData);
              }
            } catch (customerError) {
              console.error("Error adding customer to vendor list:", customerError);
              // Continue - customer creation is not critical
            }
          }
        } else if (orderId) {
          // Order already exists - update it with payment info
          await updateDoc(doc(db, 'orders', orderId), {
            transactionRef: transactionRef.toUpperCase(),
            paymentMethod: selectedProvider,
            paymentStatus: 'PENDING_VERIFICATION',
            updatedAt: new Date().toISOString()
          });
        }

        // Create transaction record with PENDING_VERIFICATION status
        // Use sellerId as uid for transaction (vendor owns the transaction)
        const transactionUid = orderData?.sellerId || sellerId || user.uid;
        await addDoc(collection(db, 'transactions'), {
          uid: transactionUid, // Required for Firestore permission check - vendor owns the transaction
          userId: user.uid, // Customer who made the payment
          vendorId: orderData?.sellerId || sellerId, // Vendor receiving the payment
          orderId: finalOrderId,
          amount,
          currency: 'TZS',
          provider: selectedProvider,
          status: 'PENDING_VERIFICATION',
          referenceId: transactionRef.toUpperCase(),
          createdAt: new Date().toISOString()
        });

        // Send WhatsApp notification if configured
        try {
          const { sendOrderConfirmation } = await import('../services/whatsappService');
          
          // Get order details
          const orderDocRef = doc(db, 'orders', finalOrderId);
          const orderDoc = await getDoc(orderDocRef);
          
          if (orderDoc.exists()) {
            const orderData = { id: finalOrderId, ...orderDoc.data() } as Order;
            
            // Get vendor phone
            let vendorPhone = null;
            if (sellerId) {
              const vendorDocRef = doc(db, 'users', sellerId);
              const vendorDoc = await getDoc(vendorDocRef);
              if (vendorDoc.exists()) {
                vendorPhone = vendorDoc.data().phone;
              }
            }
            
            // Get customer phone if available
            let customerPhone = '';
            if (orderData.customerId) {
              try {
                const customerDocRef = doc(db, 'users', orderData.customerId);
                const customerDoc = await getDoc(customerDocRef);
                if (customerDoc.exists()) {
                  customerPhone = customerDoc.data().phone || '';
                }
              } catch {
                // Ignore error
              }
            }
            
            // Create customer object
            const customer = {
              fullName: orderData.customerName,
              phone: customerPhone
            };
            
            // Send WhatsApp to vendor
            if (vendorPhone) {
              await sendOrderConfirmation(orderData, customer, vendorPhone);
            }
          }
        } catch (whatsappError) {
          console.warn('WhatsApp notification failed:', whatsappError);
          // Don't fail the order if WhatsApp fails
        }

        onPaymentSubmitted(transactionRef.toUpperCase());
        showNotification('Order placed! Payment submitted for vendor verification.', 'success');
        onClose();
      }
    } catch (error: any) {
      console.error('Payment submission error:', error);
      showNotification(`Failed to place order: ${error.message || 'Please try again.'}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Complete Payment</h2>
              <p className="text-sm text-neutral-500">Amount: TZS {amount.toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Payment Provider Selection */}
          {!selectedProvider && (
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white mb-4">Select Payment Method</h3>
              
              {/* No Payment Methods Configured */}
              {mobileMoneyProviders.length === 0 ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-red-900 dark:text-red-200 mb-1">
                        No Payment Methods Available
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        This vendor has not configured any payment methods yet. Please contact them directly or choose a different vendor.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {mobileMoneyProviders.map((provider) => {
                    const isBank = provider === 'BANK_TRANSFER';
                    const paymentNumber = getVendorPaymentNumber(provider);
                    const accountName = getVendorAccountName(provider);
                    const isAvailable = paymentNumber !== null;
                    
                    return (
                      <button
                        key={provider}
                        onClick={() => isAvailable && handleProviderSelect(provider)}
                        disabled={!isAvailable}
                        className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                          isAvailable
                            ? 'border-orange-200 dark:border-orange-800 hover:border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                            : 'border-neutral-100 dark:border-neutral-800 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {isBank ? (
                          <Building2 className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Smartphone className="w-5 h-5 text-orange-600" />
                        )}
                        <div className="flex-1 text-left">
                          <span className="font-medium text-neutral-900 dark:text-white block">
                            {provider.replace('_', ' ')}
                          </span>
                          {accountName && (
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 block mt-1">
                              {accountName}
                            </span>
                          )}
                          {paymentNumber && (
                            <span className="text-xs text-neutral-600 dark:text-neutral-400 block mt-1 font-mono">
                              {paymentNumber}
                            </span>
                          )}
                        </div>
                        {isAvailable && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Vendor Payment Number Display */}
          {selectedProvider && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-2">
                Pay to: {vendor?.storeName || 'Vendor'}
              </p>
              {(() => {
                const paymentNumber = getVendorPaymentNumber(selectedProvider);
                const accountName = getVendorAccountName(selectedProvider);
                const fieldId = `${selectedProvider.toLowerCase()}-number`;
                
                if (!paymentNumber) {
                  return (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Payment method not configured by vendor. Please contact them.
                    </p>
                  );
                }
                
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white dark:bg-neutral-900 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                      <div className="flex-1">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                          {selectedProvider === 'BANK_TRANSFER' ? 'Account Number' : 'Pay-in Number'}
                        </p>
                        <p className="font-mono font-bold text-lg text-neutral-900 dark:text-white">
                          {paymentNumber}
                        </p>
                        {accountName && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                            Account: {accountName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleCopyToClipboard(paymentNumber, fieldId)}
                        className="ml-3 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors flex items-center gap-2"
                        title="Copy to clipboard"
                      >
                        {copiedField === fieldId ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {selectedProvider === 'BANK_TRANSFER' && vendorPaymentConfig?.bankTransfer && (
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-orange-200 dark:border-orange-700">
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">Bank Details</p>
                        <p className="text-sm text-neutral-900 dark:text-white">
                          {vendorPaymentConfig.bankTransfer.bankName}
                          {vendorPaymentConfig.bankTransfer.branchName && ` - ${vendorPaymentConfig.bankTransfer.branchName}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STK Push Instructions */}
          {selectedProvider && stkPushSent && !showManualEntry && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    STK Push Sent!
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Check your phone and enter your PIN to complete the payment. 
                    Once completed, enter your transaction reference code below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Entry */}
          {(showManualEntry || stkPushSent) && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Transaction Reference Code
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value.toUpperCase())}
                  placeholder="e.g., QWF82937JK"
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
                  maxLength={20}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Enter the reference code from your payment confirmation message
                </p>
              </div>

              {!stkPushSent && (
                <button
                  onClick={handleManualEntry}
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  I'll enter the code manually
                </button>
              )}
            </div>
          )}

          {/* Error Message */}
          {!selectedProvider && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    If STK Push doesn't arrive, you can enter your transaction reference code manually.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitPayment}
            disabled={isProcessing || !selectedProvider || !transactionRef.trim() || transactionRef.length < 6}
            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                I Have Paid
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

