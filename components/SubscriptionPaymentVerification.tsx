/**
 * Subscription Payment Verification Component
 * For Admin to verify subscription payments and activate user access
 */

import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, XCircle, Clock, Eye, AlertCircle, Loader2, User, Mail, CreditCard } from 'lucide-react';
import { PaymentConfirmation } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';

export const SubscriptionPaymentVerification: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [pendingPayments, setPendingPayments] = useState<PaymentConfirmation[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentConfirmation | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch pending payment confirmations
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;

    const q = query(
      collection(db, 'payment_confirmations'),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as PaymentConfirmation));
        setPendingPayments(payments);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching pending payments:', error);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  const handleVerifyAndActivate = async (payment: PaymentConfirmation) => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    setIsProcessing(true);
    try {
      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 month subscription

      // Update payment confirmation
      await updateDoc(doc(db, 'payment_confirmations', payment.id), {
        status: 'confirmed',
        confirmedBy: user.uid,
        confirmedAt: now.toISOString()
      });

      // Update user subscription
      await updateDoc(doc(db, 'users', payment.userId), {
        subscriptionPlan: payment.packageName,
        packageId: payment.packageId,
        status: 'Active',
        activationDate: now.toISOString(),
        subscriptionExpiry: expiryDate.toISOString(),
        updatedAt: now.toISOString()
      });

      // Update transaction status
      if (payment.paymentCode) {
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('referenceId', '==', payment.paymentCode)
        );
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        if (!transactionsSnapshot.empty) {
          const transactionDoc = transactionsSnapshot.docs[0];
          await updateDoc(doc(db, 'transactions', transactionDoc.id), {
            status: 'COMPLETED',
            completedAt: now.toISOString()
          });
        }
      }

      showNotification('Payment verified and subscription activated!', 'success');
      setSelectedPayment(null);
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      showNotification('Failed to verify payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async (payment: PaymentConfirmation) => {
    if (!rejectionReason.trim()) {
      showNotification('Please provide a reason for rejection', 'error');
      return;
    }

    if (!isFirebaseEnabled || !db || !user?.uid) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'payment_confirmations', payment.id), {
        status: 'rejected',
        confirmedBy: user.uid,
        confirmedAt: new Date().toISOString()
      });

      // Update user status
      await updateDoc(doc(db, 'users', payment.userId), {
        status: 'Payment Rejected',
        updatedAt: new Date().toISOString()
      });

      showNotification('Payment rejected. User will be notified.', 'success');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedPayment(null);
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      showNotification('Failed to reject payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'confirmed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Subscription Payment Verification</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Verify subscription payments and activate user access
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
          <Package className="w-5 h-5 text-orange-600" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">
            {pendingPayments.length} Pending
          </span>
        </div>
      </div>

      {/* Pending Payments List */}
      {pendingPayments.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            No Pending Verifications
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            All subscription payments have been verified. New payments will appear here when users submit them.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Package</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Reference Code</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {pendingPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-white">{payment.userName}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{payment.userEmail}</p>
                      </div>
                    </td>
                    <td className="p-4 text-neutral-900 dark:text-white font-semibold">
                      {payment.packageName}
                    </td>
                    <td className="p-4 text-neutral-900 dark:text-white font-semibold">
                      TZS {payment.amount.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">
                        {payment.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4">
                      <code className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">
                        {payment.paymentCode || 'N/A'}
                      </code>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        <Clock className="w-3 h-3" />
                        {payment.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerifyAndActivate(payment)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Verify & Activate
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowRejectModal(true);
                          }}
                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-500 flex items-center gap-1 text-xs font-medium"
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPayment && !showRejectModal && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl modal-content">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Payment Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">User Name</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{selectedPayment.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Email</p>
                  <p className="text-sm text-neutral-900 dark:text-white">{selectedPayment.userEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Package</p>
                  <p className="font-semibold text-neutral-900 dark:text-white">{selectedPayment.packageName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Amount</p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    TZS {selectedPayment.amount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Payment Method</p>
                  <p className="text-sm text-neutral-900 dark:text-white">{selectedPayment.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Reference Code</p>
                  <code className="text-sm font-mono text-neutral-900 dark:text-white">
                    {selectedPayment.paymentCode || 'N/A'}
                  </code>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Submitted</p>
                  <p className="text-sm text-neutral-900 dark:text-white">
                    {new Date(selectedPayment.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
              <button
                onClick={() => setSelectedPayment(null)}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Close
              </button>
              <button
                onClick={() => handleVerifyAndActivate(selectedPayment)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Verify & Activate Subscription
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedPayment && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md modal-content">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Reject Payment</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Please provide a reason for rejecting this payment. The user will be notified.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Rejection Reason
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="">Select a reason...</option>
                  <option value="Code not found">Code not found</option>
                  <option value="Insufficient amount">Insufficient amount</option>
                  <option value="Wrong reference code">Wrong reference code</option>
                  <option value="Payment not received">Payment not received</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {rejectionReason === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Specify Reason
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                    rows={3}
                    placeholder="Enter rejection reason..."
                  />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectPayment(selectedPayment)}
                disabled={isProcessing || !rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Reject Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

