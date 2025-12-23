/**
 * Order Management Workspace
 * For Pharmacy/Vendor to verify pending payments and accept orders
 */

import React, { useState, useEffect } from 'react';
import { Package, CheckCircle, XCircle, Clock, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { Order, PaymentStatus, UserRole, VendorOrder, Transaction } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, updateDoc, doc, getDocs, addDoc } from 'firebase/firestore';

export const OrderManagement: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [pendingVendorOrders, setPendingVendorOrders] = useState<VendorOrder[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | VendorOrder | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('single');

  // Fetch single-vendor orders with PENDING_VERIFICATION status
  useEffect(() => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    const targetUid = user.uid; // Vendor/pharmacy UID
    
    const q = query(
      collection(db, 'orders'),
      where('sellerId', '==', targetUid),
      where('paymentStatus', '==', 'PENDING_VERIFICATION')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Order));
        setPendingOrders(orders);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching pending orders:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch multi-vendor vendor orders (sub-orders) with PENDING_VERIFICATION status
  useEffect(() => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    const targetUid = user.uid; // Vendor/pharmacy UID
    
    const q = query(
      collection(db, 'vendor_orders'),
      where('vendorId', '==', targetUid),
      where('paymentStatus', '==', 'PENDING_VERIFICATION')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const vendorOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as VendorOrder));
        setPendingVendorOrders(vendorOrders);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching pending vendor orders:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch transactions with PENDING_VERIFICATION status for this vendor
  useEffect(() => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    const targetUid = user.uid;
    
    const q = query(
      collection(db, 'transactions'),
      where('vendorId', '==', targetUid),
      where('status', '==', 'PENDING_VERIFICATION')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const transactions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Transaction));
        setPendingTransactions(transactions);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching pending transactions:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Handler for vendor orders (multi-vendor sub-orders)
  const handleVerifyVendorOrder = async (vendorOrder: VendorOrder) => {
    if (!isFirebaseEnabled || !db) return;

    setIsProcessing(true);
    try {
      // Update vendor order status to PAID and PROCESSING
      await updateDoc(doc(db, 'vendor_orders', vendorOrder.id), {
        paymentStatus: 'PAID' as PaymentStatus,
        status: 'Processing',
        updatedAt: new Date().toISOString()
      });

      // Update transaction status
      if (vendorOrder.transactionRef) {
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('vendorOrderId', '==', vendorOrder.id),
          where('referenceId', '==', vendorOrder.transactionRef)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        if (!transactionsSnapshot.empty) {
          const transactionDoc = transactionsSnapshot.docs[0];
          await updateDoc(doc(db, 'transactions', transactionDoc.id), {
            status: 'COMPLETED',
            completedAt: new Date().toISOString()
          });
        }
      }

      showNotification('Payment verified and order accepted!', 'success');
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Error verifying vendor order:', error);
      showNotification('Failed to verify payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyAndAccept = async (order: Order | VendorOrder) => {
    // Check if it's a vendor order
    if ('vendorId' in order && 'vendorName' in order) {
      await handleVerifyVendorOrder(order as VendorOrder);
      return;
    }

    // Handle regular order
    const regularOrder = order as Order;
    if (!isFirebaseEnabled || !db) return;

    setIsProcessing(true);
    try {
      // Update order status to PAID and PROCESSING
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: 'PAID' as PaymentStatus,
        status: 'Processing',
        updatedAt: new Date().toISOString()
      });

      // Update transaction status
      if (order.transactionRef) {
        // Find and update the transaction
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('referenceId', '==', order.transactionRef)
        );
        
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        if (!transactionsSnapshot.empty) {
          const transactionDoc = transactionsSnapshot.docs[0];
          await updateDoc(doc(db, 'transactions', transactionDoc.id), {
            status: 'COMPLETED',
            completedAt: new Date().toISOString()
          });
        }
      }

      // Auto-dispatch: Create delivery task if delivery was requested
      if (order.deliveryRequested && order.deliveryType === 'home-delivery') {
        try {
          const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) 
            ? user.uid 
            : user.employerId;

          if (targetUid) {
            // Check if delivery task already exists
            const deliveryQuery = query(
              collection(db, 'deliveries'),
              where('orderId', '==', order.id),
              where('uid', '==', targetUid)
            );
            const existingDeliveries = await getDocs(deliveryQuery);

            if (existingDeliveries.empty) {
              // Create new delivery task
              const deliveryData: any = {
                uid: targetUid,
                orderId: order.id,
                customer: order.customerName,
                address: order.deliveryAddress || 'Address not provided',
                status: 'Unassigned', // Available for couriers to accept
                createdAt: new Date().toISOString()
              };
              
              await addDoc(collection(db, 'deliveries'), deliveryData);
              showNotification('Payment verified! Delivery task created and available for couriers.', 'success');
            } else {
              showNotification('Payment verified and order accepted!', 'success');
            }
          } else {
            showNotification('Payment verified and order accepted!', 'success');
          }
        } catch (deliveryError: any) {
          console.error('Error creating delivery task:', deliveryError);
          // Continue - order is still verified
          showNotification('Payment verified! (Note: Delivery task creation had an issue)', 'success');
        }
      } else {
        showNotification('Payment verified and order accepted!', 'success');
      }
      
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      showNotification('Failed to verify payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectPayment = async (order: Order) => {
    if (!rejectionReason.trim()) {
      showNotification('Please provide a reason for rejection', 'error');
      return;
    }

    if (!isFirebaseEnabled || !db) return;

    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: 'FAILED' as PaymentStatus,
        status: 'PAYMENT_FAILED',
        paymentRejectionReason: rejectionReason,
        updatedAt: new Date().toISOString()
      });

      showNotification('Payment rejected. Customer will be notified.', 'success');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedOrder(null);
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      showNotification('Failed to reject payment. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING_VERIFICATION':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'PAID':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-400';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Payment Verification</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Verify pending payments and accept orders
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
          <Package className="w-5 h-5 text-orange-600" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">
            {pendingOrders.length} Pending
          </span>
        </div>
      </div>

      {/* Pending Orders List */}
      {pendingOrders.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            No Pending Verifications
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400">
            All payments have been verified. New orders will appear here when customers submit payments.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="p-4">Order ID</th>
                  <th className="p-4">Customer</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Transaction Ref</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {(viewMode === 'single' ? pendingOrders : pendingVendorOrders).map((order) => {
                  const isVendorOrder = 'vendorId' in order && 'vendorName' in order;
                  const orderId = order.id;
                  const customerName = order.customerName;
                  const total = order.total;
                  const transactionRef = 'transactionRef' in order ? order.transactionRef : undefined;
                  const paymentStatus = 'paymentStatus' in order ? order.paymentStatus : undefined;
                  
                  return (
                  <tr key={orderId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                      {orderId.slice(-8)}
                      {isVendorOrder && (
                        <span className="ml-2 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">
                          Multi
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-neutral-900 dark:text-white">
                      {customerName}
                      {isVendorOrder && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          From: {(order as VendorOrder).vendorName}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-neutral-900 dark:text-white font-semibold">
                      TZS {total.toLocaleString()}
                    </td>
                    <td className="p-4">
                      <code className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-xs font-mono">
                        {transactionRef || 'N/A'}
                      </code>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(paymentStatus || 'PENDING_VERIFICATION')}`}>
                        <Clock className="w-3 h-3" />
                        {paymentStatus || 'PENDING_VERIFICATION'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleVerifyAndAccept(order)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3 h-3" />
                          )}
                          Verify & Accept
                        </button>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
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
                );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && !showRejectModal && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl modal-content">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Order Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Order ID</p>
                  <p className="font-mono text-sm text-neutral-900 dark:text-white">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Customer</p>
                  <p className="text-sm text-neutral-900 dark:text-white">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Amount</p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">
                    TZS {selectedOrder.total.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">Transaction Ref</p>
                  <code className="text-sm font-mono text-neutral-900 dark:text-white">
                    {selectedOrder.transactionRef || 'N/A'}
                  </code>
                </div>
                {selectedOrder.deliveryType && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Delivery Type</p>
                    <p className="text-sm text-neutral-900 dark:text-white">
                      {selectedOrder.deliveryType === 'self-pickup' ? 'Self-Pickup' : 'Home Delivery'}
                      {selectedOrder.deliveryFee && selectedOrder.deliveryFee > 0 && (
                        <span className="text-neutral-500"> (TZS {selectedOrder.deliveryFee.toLocaleString()})</span>
                      )}
                    </p>
                  </div>
                )}
                {selectedOrder.deliveryAddress && (
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Delivery Address</p>
                    <p className="text-sm text-neutral-900 dark:text-white">{selectedOrder.deliveryAddress}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                      <span className="text-sm text-neutral-900 dark:text-white">{item.name}</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {item.quantity} × TZS {item.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Close
              </button>
              <button
                onClick={() => handleVerifyAndAccept(selectedOrder)}
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
                    Verify & Accept
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && selectedOrder && (
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
                      Please provide a reason for rejecting this payment. The customer will be notified.
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
                onClick={() => handleRejectPayment(selectedOrder)}
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

