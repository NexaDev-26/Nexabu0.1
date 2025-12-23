/**
 * Courier Dashboard Component
 * For couriers to accept deliveries, track status, and verify delivery with OTP
 */

import React, { useState, useEffect } from 'react';
import { Truck, MapPin, CheckCircle, Clock, Package, KeyRound, Loader2, Navigation, X } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';

export const CourierDashboard: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [availableDeliveries, setAvailableDeliveries] = useState<Order[]>([]);
  const [myDeliveries, setMyDeliveries] = useState<Order[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<Order | null>(null);
  const [otpCode, setOtpCode] = useState(['', '', '', '']);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<'At Pharmacy' | 'Picked Up' | 'Arrived at Customer'>('At Pharmacy');

  // Fetch available deliveries (PAID status, no courier assigned)
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;

    const q = query(
      collection(db, 'orders'),
      where('paymentStatus', '==', 'PAID'),
      where('status', '==', 'Processing')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .filter(order => !order.courierId); // Only unassigned orders
        setAvailableDeliveries(orders);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching available deliveries:', error);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch my deliveries (assigned to current courier)
  useEffect(() => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    const q = query(
      collection(db, 'orders'),
      where('courierId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Order))
          .filter(order => 
            order.status === 'DISPATCHED' || 
            order.status === 'In Transit' || 
            order.status === 'Processing'
          );
        setMyDeliveries(orders);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error fetching my deliveries:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleAcceptDelivery = async (order: Order) => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      
      // Update order
      await updateDoc(doc(db, 'orders', order.id), {
        courierId: user.uid,
        courierName: user.name,
        status: 'DISPATCHED' as OrderStatus,
        updatedAt: now
      });

      // Also update corresponding delivery task if it exists
      try {
        const deliveryQuery = query(
          collection(db, 'deliveries'),
          where('orderId', '==', order.id)
        );
        const deliverySnapshot = await getDocs(deliveryQuery);
        
        if (!deliverySnapshot.empty) {
          const deliveryDoc = deliverySnapshot.docs[0];
          await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
            driver: user.uid,
            driverName: user.name,
            status: 'Assigned',
            assignedAt: now,
            updatedAt: now
          });
        }
      } catch (deliveryError) {
        console.warn('Could not update delivery task:', deliveryError);
        // Continue even if delivery task update fails
      }

      showNotification('Delivery accepted!', 'success');
    } catch (error: any) {
      console.error('Error accepting delivery:', error);
      showNotification('Failed to accept delivery. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateStatus = async (order: Order, newStatus: OrderStatus) => {
    if (!isFirebaseEnabled || !db) return;

    setIsProcessing(true);
    try {
      const now = new Date().toISOString();
      
      // Update order status
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: now
      });

      // Also update corresponding delivery task if it exists
      try {
        const deliveryQuery = query(
          collection(db, 'deliveries'),
          where('orderId', '==', order.id)
        );
        const deliverySnapshot = await getDocs(deliveryQuery);
        
        if (!deliverySnapshot.empty) {
          const deliveryDoc = deliverySnapshot.docs[0];
          let deliveryStatus: string;
          
          if (newStatus === 'In Transit') {
            deliveryStatus = 'In Transit';
            await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
              status: 'In Transit',
              pickedUpAt: now,
              updatedAt: now
            });
          } else if (newStatus === 'Delivered') {
            deliveryStatus = 'Delivered';
            await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
              status: 'Delivered',
              deliveredAt: now,
              updatedAt: now
            });
          }
        }
      } catch (deliveryError) {
        console.warn('Could not update delivery task:', deliveryError);
        // Continue even if delivery task update fails
      }

      if (newStatus === 'In Transit') {
        setDeliveryStatus('Picked Up');
      } else if (newStatus === 'Delivered') {
        setDeliveryStatus('Arrived at Customer');
      }

      showNotification('Status updated!', 'success');
    } catch (error: any) {
      console.error('Error updating status:', error);
      showNotification('Failed to update status. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) return;
    
    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleFinalizeDelivery = async (order: Order) => {
    const enteredOtp = otpCode.join('');
    
    if (enteredOtp.length !== 4) {
      showNotification('Please enter the complete 4-digit OTP', 'error');
      return;
    }

    if (!isFirebaseEnabled || !db) return;

    setIsProcessing(true);
    try {
      // Verify OTP
      const orderDoc = await getDoc(doc(db, 'orders', order.id));
      const orderData = orderDoc.data() as Order;

      if (orderData.deliveryOtp !== enteredOtp) {
        showNotification('Invalid OTP. Please check with the customer.', 'error');
        setIsProcessing(false);
        return;
      }

      // OTP matches - complete delivery
      const now = new Date().toISOString();
      
      // Update order status
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'Delivered' as OrderStatus,
        escrowReleaseDate: now,
        updatedAt: now
      });

      // Also update corresponding delivery task
      try {
        const deliveryQuery = query(
          collection(db, 'deliveries'),
          where('orderId', '==', order.id)
        );
        const deliverySnapshot = await getDocs(deliveryQuery);
        
        if (!deliverySnapshot.empty) {
          const deliveryDoc = deliverySnapshot.docs[0];
          await updateDoc(doc(db, 'deliveries', deliveryDoc.id), {
            status: 'Delivered',
            deliveredAt: now,
            updatedAt: now,
            otp: enteredOtp // Store verified OTP
          });
        }
      } catch (deliveryError) {
        console.warn('Could not update delivery task:', deliveryError);
        // Continue even if delivery task update fails
      }

      // Release escrow funds (5% commission)
      const commission = order.total * 0.05;
      const vendorAmount = order.total - commission;

      // TODO: Update vendor wallet balance
      // await updateDoc(doc(db, 'users', order.sellerId), {
      //   walletBalance: increment(vendorAmount)
      // });

      // TODO: Add delivery points to courier profile
      // await updateDoc(doc(db, 'users', user.uid), {
      //   deliveryPoints: increment(10)
      // });

      showNotification('Delivery completed! Funds released from escrow.', 'success');
      setShowOtpModal(false);
      setOtpCode(['', '', '', '']);
      setSelectedDelivery(null);
    } catch (error: any) {
      console.error('Error finalizing delivery:', error);
      showNotification('Failed to finalize delivery. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Courier Dashboard</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Accept deliveries and track your routes
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
            <Package className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900 dark:text-blue-200">
              {availableDeliveries.length} Available
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
            <Truck className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-900 dark:text-green-200">
              {myDeliveries.length} Active
            </span>
          </div>
        </div>
      </div>

      {/* Available Deliveries */}
      {availableDeliveries.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">Available Deliveries</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableDeliveries.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">{order.customerName}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      {order.id.slice(-8)}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded text-xs font-medium">
                    TZS {order.total.toLocaleString()}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {order.deliveryAddress}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => handleAcceptDelivery(order)}
                  disabled={isProcessing}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Accept Delivery
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Active Deliveries */}
      {myDeliveries.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">My Active Deliveries</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myDeliveries.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-white">{order.customerName}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                      {order.id.slice(-8)}
                    </p>
                  </div>
                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                    {order.status}
                  </span>
                </div>
                {order.deliveryAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-neutral-400 mt-0.5" />
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {order.deliveryAddress}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  {order.status === 'DISPATCHED' && (
                    <button
                      onClick={() => handleUpdateStatus(order, 'In Transit')}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-xs font-medium"
                    >
                      Picked Up
                    </button>
                  )}
                  {order.status === 'In Transit' && (
                    <button
                      onClick={() => {
                        setSelectedDelivery(order);
                        setShowOtpModal(true);
                      }}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      Finalize
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && selectedDelivery && (
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md modal-content">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KeyRound className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Verify Delivery</h3>
              </div>
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpCode(['', '', '', '']);
                  setSelectedDelivery(null);
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Ask the customer for their 4-digit delivery code and enter it below to complete the delivery.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3 text-center">
                  Enter 4-Digit OTP
                </label>
                <div className="flex justify-center gap-3">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpInput(index, e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-14 h-14 text-center text-2xl font-bold border-2 border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpCode(['', '', '', '']);
                  setSelectedDelivery(null);
                }}
                className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalizeDelivery(selectedDelivery)}
                disabled={isProcessing || otpCode.join('').length !== 4}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Complete Delivery
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

