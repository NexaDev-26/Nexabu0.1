/**
 * Subscription Payment Modal Component
 * Payment selection for package subscriptions with multiple payment methods
 */

import React, { useState } from 'react';
import { CreditCard, Smartphone, Building2, Shield, Heart, Loader2, X, AlertCircle, CheckCircle } from 'lucide-react';
import { PaymentProvider, PaymentConfig } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { getAvailablePaymentMethods, getPaymentFeatures } from '../utils/paymentGating';

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
  amount: number;
  userTier: 'Starter' | 'Premium' | 'Enterprise';
  adminPaymentConfig?: PaymentConfig | null;
  onPaymentSubmitted: (transactionRef: string, paymentMethod: PaymentProvider) => void;
}

export const SubscriptionPaymentModal: React.FC<SubscriptionPaymentModalProps> = ({
  isOpen,
  onClose,
  packageId,
  packageName,
  amount,
  userTier,
  adminPaymentConfig,
  onPaymentSubmitted
}) => {
  const { user, showNotification } = useAppContext();
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [transactionRef, setTransactionRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [stkPushSent, setStkPushSent] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<'STK_PUSH' | 'MANUAL_MOBILE' | null>(null);

  // Get available payment methods based on tier
  const availableMethods = getAvailablePaymentMethods(userTier);
  const paymentFeatures = getPaymentFeatures(userTier);

  // Group payment methods by category
  const mobileMoneyMethods: PaymentProvider[] = ['MPESA', 'TIGO_PESA', 'AIRTEL_MONEY', 'HALO_PESA'];
  const financialMethods: PaymentProvider[] = ['BANK_TRANSFER', 'ESCROW_WALLET'];
  const insuranceMethods: PaymentProvider[] = ['NHIF', 'PRIVATE_INSURANCE'];
  const otherMethods: PaymentProvider[] = ['CREDIT_CARD', 'CASH'];

  const getMethodIcon = (provider: PaymentProvider) => {
    if (mobileMoneyMethods.includes(provider)) return <Smartphone className="w-5 h-5" />;
    if (financialMethods.includes(provider)) return <Building2 className="w-5 h-5" />;
    if (insuranceMethods.includes(provider)) return <Heart className="w-5 h-5" />;
    return <CreditCard className="w-5 h-5" />;
  };

  const getMethodName = (provider: PaymentProvider) => {
    const names: Record<PaymentProvider, string> = {
      'MPESA': 'M-Pesa',
      'TIGO_PESA': 'Tigo Pesa',
      'AIRTEL_MONEY': 'Airtel Money',
      'HALO_PESA': 'Halo Pesa',
      'BANK_TRANSFER': 'Bank Transfer',
      'ESCROW_WALLET': 'Escrow Wallet',
      'NHIF': 'NHIF Insurance',
      'PRIVATE_INSURANCE': 'Private Insurance',
      'CREDIT_CARD': 'Credit Card',
      'CASH': 'Cash'
    };
    return names[provider] || provider;
  };

  const handleProviderSelect = (provider: PaymentProvider) => {
    setSelectedProvider(provider);
    setShowManualEntry(false);
    setStkPushSent(false);
    setPaymentMethodType(null);
    
    // For mobile money, show option to choose STK Push or Manual Entry
    // For other methods, show manual entry immediately
    if (!mobileMoneyMethods.includes(provider)) {
      setShowManualEntry(true);
    }
  };

  const handleMobilePaymentTypeSelect = async (type: 'STK_PUSH' | 'MANUAL_MOBILE') => {
    if (!selectedProvider) return;
    
    setPaymentMethodType(type);
    
    if (type === 'STK_PUSH') {
      setIsProcessing(true);
      try {
        // TODO: Call backend API to initiate STK Push
        await new Promise(resolve => setTimeout(resolve, 1500));
        setStkPushSent(true);
        showNotification(`STK Push sent to your ${getMethodName(selectedProvider)} number`, 'success');
      } catch (error) {
        showNotification('Failed to send STK Push. Please use manual entry.', 'error');
        setPaymentMethodType('MANUAL_MOBILE');
        setShowManualEntry(true);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Manual entry - show input immediately
      setShowManualEntry(true);
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

    // For mobile money, require transaction reference and payment method type
    if (mobileMoneyMethods.includes(selectedProvider)) {
      if (!paymentMethodType) {
        showNotification('Please select a payment method type (STK Push or Manual Entry)', 'error');
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
    } else {
      // For non-mobile money methods, also require transaction reference
      if (!transactionRef.trim()) {
        showNotification('Please enter your payment reference/confirmation code', 'error');
        return;
      }
      if (transactionRef.length < 6) {
        showNotification('Payment reference code must be at least 6 characters', 'error');
        return;
      }
    }

    setIsProcessing(true);
    try {
      if (isFirebaseEnabled && db && user?.uid) {
        // Create payment confirmation record
        const paymentConfirmation = {
          userId: user.uid,
          userName: user.name,
          userEmail: user.email,
          packageId,
          packageName,
          paymentCode: transactionRef.trim().toUpperCase() || `PAY-${Date.now()}`,
          amount,
          paymentMethod: selectedProvider,
          paymentMethodType: mobileMoneyMethods.includes(selectedProvider) ? paymentMethodType : null,
          status: 'pending' as const,
          createdAt: new Date().toISOString()
        };

        const confirmationRef = await addDoc(collection(db, 'payment_confirmations'), paymentConfirmation);

        // Create transaction record
        await addDoc(collection(db, 'transactions'), {
          uid: user.uid, // Required for Firestore permission check
          userId: user.uid,
          orderId: confirmationRef.id, // Link to payment confirmation
          amount,
          currency: 'TZS',
          provider: selectedProvider,
          status: 'PENDING_VERIFICATION',
          referenceId: transactionRef.trim().toUpperCase() || confirmationRef.id,
          createdAt: new Date().toISOString()
        });

        // Update user subscription status to pending
        await updateDoc(doc(db, 'users', user.uid), {
          packageId,
          subscriptionPlan: packageName,
          status: 'Pending Payment Verification',
          updatedAt: new Date().toISOString()
        });

        onPaymentSubmitted(transactionRef.trim().toUpperCase() || confirmationRef.id, selectedProvider);
        showNotification('Payment submitted! Admin will verify your payment to activate your subscription.', 'success');
        onClose();
      } else {
        showNotification('Unable to submit payment. Database or user not available. Please refresh and try again.', 'error');
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error('Payment submission error:', error);
      const errorMessage = error?.message || 'Unknown error';
      showNotification(`Failed to submit payment: ${errorMessage}. Please check your connection and try again.`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <CreditCard className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Subscribe to {packageName}</h2>
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
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Payment Method Selection */}
          {!selectedProvider && (
            <div className="space-y-4">
              <h3 className="font-semibold text-neutral-900 dark:text-white">Select Payment Method</h3>
              
              {/* Mobile Money */}
              {availableMethods.some(m => mobileMoneyMethods.includes(m)) && (
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Mobile Money</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMethods
                      .filter(m => mobileMoneyMethods.includes(m))
                      .map((provider) => (
                        <button
                          key={provider}
                          onClick={() => handleProviderSelect(provider)}
                          className="p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all flex items-center gap-3"
                        >
                          {getMethodIcon(provider)}
                          <span className="font-medium text-neutral-900 dark:text-white text-sm">
                            {getMethodName(provider)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Financial Services */}
              {availableMethods.some(m => financialMethods.includes(m)) && (
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Financial Services</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMethods
                      .filter(m => financialMethods.includes(m))
                      .map((provider) => (
                        <button
                          key={provider}
                          onClick={() => handleProviderSelect(provider)}
                          className="p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all flex items-center gap-3"
                        >
                          {getMethodIcon(provider)}
                          <span className="font-medium text-neutral-900 dark:text-white text-sm">
                            {getMethodName(provider)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Insurance */}
              {availableMethods.some(m => insuranceMethods.includes(m)) && (
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Insurance</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMethods
                      .filter(m => insuranceMethods.includes(m))
                      .map((provider) => (
                        <button
                          key={provider}
                          onClick={() => handleProviderSelect(provider)}
                          className="p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all flex items-center gap-3"
                        >
                          {getMethodIcon(provider)}
                          <span className="font-medium text-neutral-900 dark:text-white text-sm">
                            {getMethodName(provider)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Other Methods */}
              {availableMethods.some(m => otherMethods.includes(m)) && (
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Other</p>
                  <div className="grid grid-cols-2 gap-3">
                    {availableMethods
                      .filter(m => otherMethods.includes(m))
                      .map((provider) => (
                        <button
                          key={provider}
                          onClick={() => handleProviderSelect(provider)}
                          className="p-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-orange-500 transition-all flex items-center gap-3"
                        >
                          {getMethodIcon(provider)}
                          <span className="font-medium text-neutral-900 dark:text-white text-sm">
                            {getMethodName(provider)}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Instructions */}
          {selectedProvider && adminPaymentConfig && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    Payment Instructions
                  </p>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    {selectedProvider === 'MPESA' && adminPaymentConfig.mpesa?.enabled && (
                      <>
                        <p><strong>Network:</strong> M-PESA</p>
                        <p><strong>Phone:</strong> {adminPaymentConfig.mpesa.merchantNumber}</p>
                        <p><strong>Account Name:</strong> {adminPaymentConfig.mpesa.accountName}</p>
                      </>
                    )}
                    {selectedProvider === 'TIGO_PESA' && adminPaymentConfig.tigoPesa?.enabled && (
                      <>
                        <p><strong>Network:</strong> Tigo Pesa</p>
                        <p><strong>Phone:</strong> {adminPaymentConfig.tigoPesa.merchantNumber}</p>
                        <p><strong>Account Name:</strong> {adminPaymentConfig.tigoPesa.accountName}</p>
                      </>
                    )}
                    {selectedProvider === 'AIRTEL_MONEY' && adminPaymentConfig.airtelMoney?.enabled && (
                      <>
                        <p><strong>Network:</strong> Airtel Money</p>
                        <p><strong>Phone:</strong> {adminPaymentConfig.airtelMoney.merchantNumber}</p>
                        <p><strong>Account Name:</strong> {adminPaymentConfig.airtelMoney.accountName}</p>
                      </>
                    )}
                    {selectedProvider === 'BANK_TRANSFER' && adminPaymentConfig.bankTransfer?.enabled && (
                      <>
                        <p><strong>Bank:</strong> {adminPaymentConfig.bankTransfer.bankName}</p>
                        <p><strong>Account Number:</strong> {adminPaymentConfig.bankTransfer.accountNumber}</p>
                        <p><strong>Account Name:</strong> {adminPaymentConfig.bankTransfer.accountName}</p>
                        {adminPaymentConfig.bankTransfer.branchName && (
                          <p><strong>Branch:</strong> {adminPaymentConfig.bankTransfer.branchName}</p>
                        )}
                      </>
                    )}
                    <p className="mt-2">Send TZS {amount.toLocaleString()} to the above details.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STK Push Instructions */}
          {selectedProvider && stkPushSent && !showManualEntry && mobileMoneyMethods.includes(selectedProvider) && paymentMethodType === 'STK_PUSH' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-900 dark:text-green-200 mb-2">
                    STK Push Sent!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Check your phone and enter your PIN to complete the payment. 
                    Once completed, enter your transaction reference code below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual Entry */}
          {(showManualEntry || (selectedProvider && !mobileMoneyMethods.includes(selectedProvider)) || (selectedProvider && mobileMoneyMethods.includes(selectedProvider) && paymentMethodType === 'MANUAL_MOBILE')) && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  {mobileMoneyMethods.includes(selectedProvider!) 
                    ? 'Transaction Reference Code' 
                    : 'Payment Reference / Confirmation Code'}
                </label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value.toUpperCase())}
                  placeholder={mobileMoneyMethods.includes(selectedProvider!) 
                    ? "e.g., QWF82937JK" 
                    : "Enter payment confirmation code"}
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none font-mono text-sm"
                  maxLength={20}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  {mobileMoneyMethods.includes(selectedProvider!) 
                    ? 'Enter the reference code from your payment confirmation message'
                    : 'Enter the confirmation code or reference number from your payment'}
                </p>
              </div>

              {selectedProvider && mobileMoneyMethods.includes(selectedProvider) && paymentMethodType === 'STK_PUSH' && stkPushSent && (
                <button
                  onClick={() => {
                    setPaymentMethodType('MANUAL_MOBILE');
                    setShowManualEntry(true);
                    setStkPushSent(false);
                  }}
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Switch to Manual Entry
                </button>
              )}
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
            disabled={
              isProcessing || 
              !selectedProvider || 
              (mobileMoneyMethods.includes(selectedProvider) && !paymentMethodType) ||
              (mobileMoneyMethods.includes(selectedProvider) && (!transactionRef.trim() || transactionRef.length < 6))
            }
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
                Submit Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

