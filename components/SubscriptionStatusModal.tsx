/**
 * Subscription Status Modal
 * Shows detailed subscription status, payment verification, and payment history
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Clock, XCircle, CreditCard, Calendar, Package, Copy, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { PaymentConfirmation, User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

interface SubscriptionStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionStatusModal: React.FC<SubscriptionStatusModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user, showNotification } = useAppContext();
  const [paymentHistory, setPaymentHistory] = useState<PaymentConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Fetch user's payment history
  useEffect(() => {
    if (!isOpen || !user?.uid || !isFirebaseEnabled || !db) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | null = null;

    // Try query with orderBy first, fallback to query without orderBy if index error
    try {
      // First try: Query with orderBy (requires composite index)
      const q = query(
        collection(db, 'payment_confirmations'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(10)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const payments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as PaymentConfirmation));
          setPaymentHistory(payments);
          setIsLoading(false);
        },
        (error) => {
          console.error('Error with ordered query:', error);
          
          // If it's an index error, try without orderBy
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            console.log('Composite index missing, trying query without orderBy...');
            
            // Fallback: Query without orderBy and sort client-side
            const fallbackQ = query(
              collection(db, 'payment_confirmations'),
              where('userId', '==', user.uid)
            );
            
            unsubscribe = onSnapshot(
              fallbackQ,
              (snapshot) => {
                const payments = snapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                } as PaymentConfirmation));
                
                // Sort client-side by createdAt
                payments.sort((a, b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return dateB - dateA; // Descending order
                });
                
                // Limit to 10 most recent
                setPaymentHistory(payments.slice(0, 10));
                setIsLoading(false);
              },
              (fallbackError) => {
                console.error('Error with fallback query:', fallbackError);
                setIsLoading(false);
                // Only show notification for non-permission errors
                if (fallbackError.code !== 'permission-denied' && fallbackError.code !== 'unavailable') {
                  console.warn('Could not load payment history:', fallbackError);
                }
              }
            );
          } else {
            // Other errors - handle gracefully
            setIsLoading(false);
            if (error.code === 'permission-denied') {
              // Silent fail for permission denied
              console.log('Permission denied for payment history');
            } else if (error.code === 'unavailable' || error.code === 'unauthenticated') {
              showNotification('Unable to connect. Please check your internet connection.', 'error');
            } else {
              // Other errors - log but don't spam user
              console.warn('Payment history load issue:', error);
            }
          }
        }
      );
    } catch (err: any) {
      console.error('Error setting up payment history query:', err);
      setIsLoading(false);
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isOpen, user?.uid, showNotification]);

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

  if (!isOpen || !user) return null;

  const isActive = user.status === 'Active';
  const isPending = user.status === 'Pending Payment Verification';
  const isRejected = user.status === 'Payment Rejected';
  const planName = user.subscriptionPlan || 'Starter';
  
  const daysLeft = user.subscriptionExpiry 
    ? Math.ceil((new Date(user.subscriptionExpiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
    : null;

  const pendingPayment = paymentHistory.find(p => p.status === 'pending');
  const latestPayment = paymentHistory[0];

  const getStatusConfig = () => {
    if (isActive) {
      return {
        icon: <CheckCircle className="w-6 h-6 text-green-600" />,
        title: 'Subscription Active',
        description: `Your ${planName} plan is active and you have full access to all features.`,
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
        textColor: 'text-green-800 dark:text-green-200'
      };
    }
    if (isPending) {
      return {
        icon: <Clock className="w-6 h-6 text-yellow-600" />,
        title: 'Payment Verification Pending',
        description: 'Your payment is being reviewed by our team. Access will be granted once verified (usually within 24 hours).',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800',
        textColor: 'text-yellow-800 dark:text-yellow-200'
      };
    }
    if (isRejected) {
      return {
        icon: <XCircle className="w-6 h-6 text-red-600" />,
        title: 'Payment Rejected',
        description: 'Your payment was not verified. Please check your payment details and try again, or contact support.',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-red-200 dark:border-red-800',
        textColor: 'text-red-800 dark:text-red-200'
      };
    }
    return {
      icon: <AlertCircle className="w-6 h-6 text-neutral-600" />,
      title: 'No Active Subscription',
      description: 'You don\'t have an active subscription. Please upgrade to access premium features.',
      bgColor: 'bg-neutral-50 dark:bg-neutral-900/20',
      borderColor: 'border-neutral-200 dark:border-neutral-800',
      textColor: 'text-neutral-800 dark:text-neutral-200'
    };
  };

  const statusConfig = getStatusConfig();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return `TZS ${amount.toLocaleString()}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Subscription Status</h2>
              <p className="text-sm text-neutral-500">View your subscription and payment details</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Status Card */}
          <div className={`${statusConfig.bgColor} border-l-4 ${statusConfig.borderColor} p-4 rounded-r-lg`}>
            <div className="flex items-start gap-3">
              {statusConfig.icon}
              <div className="flex-1">
                <h3 className={`font-semibold ${statusConfig.textColor} mb-1`}>
                  {statusConfig.title}
                </h3>
                <p className={`text-sm ${statusConfig.textColor} opacity-90`}>
                  {statusConfig.description}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Current Plan</span>
              </div>
              <p className="text-lg font-bold text-neutral-900 dark:text-white">{planName}</p>
            </div>

            {user.subscriptionExpiry && (
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {daysLeft !== null && daysLeft >= 0 ? 'Days Remaining' : 'Expired'}
                  </span>
                </div>
                <p className="text-lg font-bold text-neutral-900 dark:text-white">
                  {daysLeft !== null ? (daysLeft >= 0 ? `${daysLeft} days` : 'Expired') : 'N/A'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">{formatDate(user.subscriptionExpiry)}</p>
              </div>
            )}

            {user.activationDate && (
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Activation Date</span>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{formatDate(user.activationDate)}</p>
              </div>
            )}

            {user.supportForumCode && (
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Support ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-bold text-neutral-900 dark:text-white">{user.supportForumCode}</p>
                  <button
                    onClick={() => handleCopyToClipboard(user.supportForumCode!, 'support-id')}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded"
                    title="Copy support ID"
                  >
                    {copiedField === 'support-id' ? (
                      <Check className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-neutral-500" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pending Payment Info */}
          {pendingPayment && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    Payment Under Review
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <div className="flex justify-between">
                      <span>Package:</span>
                      <span className="font-medium">{pendingPayment.packageName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">{formatCurrency(pendingPayment.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method:</span>
                      <span className="font-medium">{pendingPayment.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Reference Code:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{pendingPayment.paymentCode}</span>
                        <button
                          onClick={() => handleCopyToClipboard(pendingPayment.paymentCode, `ref-${pendingPayment.id}`)}
                          className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                          title="Copy reference"
                        >
                          {copiedField === `ref-${pendingPayment.id}` ? (
                            <Check className="w-3 h-3 text-green-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-blue-600" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span>Submitted:</span>
                      <span className="font-medium">{formatDate(pendingPayment.createdAt)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
                    Our team is reviewing your payment. You will be notified once verification is complete.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment History */}
          <div>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment History
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-neutral-500">
                <Clock className="w-8 h-8 mx-auto mb-2 animate-spin" />
                <p>Loading payment history...</p>
              </div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 bg-neutral-50 dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No payment history found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-neutral-900 dark:text-white">{payment.packageName}</p>
                        <p className="text-sm text-neutral-500">{formatDate(payment.createdAt)}</p>
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Amount</span>
                        <p className="font-medium text-neutral-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Method</span>
                        <p className="font-medium text-neutral-900 dark:text-white">{payment.paymentMethod}</p>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Reference</span>
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs text-neutral-900 dark:text-white">{payment.paymentCode}</p>
                          <button
                            onClick={() => handleCopyToClipboard(payment.paymentCode, `history-ref-${payment.id}`)}
                            className="p-0.5 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded"
                            title="Copy reference"
                          >
                            {copiedField === `history-ref-${payment.id}` ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-neutral-400" />
                            )}
                          </button>
                        </div>
                      </div>
                      {payment.confirmedAt && (
                        <div>
                          <span className="text-neutral-500 dark:text-neutral-400">Verified</span>
                          <p className="font-medium text-neutral-900 dark:text-white text-xs">{formatDate(payment.confirmedAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {!isActive && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">
                    Need Help?
                  </h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200 mb-3">
                    {isPending
                      ? 'Your payment is being processed. If it\'s been more than 24 hours, please contact support with your payment reference code.'
                      : isRejected
                      ? 'Your payment was not verified. Please check your payment details or contact support for assistance.'
                      : 'Upgrade your plan to access premium features and unlock the full potential of Nexabu.'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (window.location.hash) {
                          window.location.hash = '#subscription';
                        } else {
                          window.location.href = '#subscription';
                        }
                        onClose();
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      {isPending || isRejected ? 'View Subscription Plans' : 'Upgrade Now'}
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
