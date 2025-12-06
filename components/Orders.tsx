import React, { useState } from 'react';
import { Order, Product } from '../types';
import { Eye, Truck, CheckCircle, XCircle, Clock, Package, FileText, X } from 'lucide-react';
import { Receipt } from './Receipt';
import { useAppContext } from '../hooks/useAppContext';

export const Orders: React.FC = () => {
  const { orders } = useAppContext();
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusColor = (status: string) => ({'Delivered': 'bg-green-100 text-green-800', 'Processing': 'bg-blue-100 text-blue-800', 'Cancelled': 'bg-red-100 text-red-800', 'Pending': 'bg-yellow-100 text-yellow-800'}[status] || 'bg-gray-100');
  const getStatusIcon = (status: string) => ({'Delivered': <CheckCircle size={12} />, 'Processing': <Truck size={12} />, 'Cancelled': <XCircle size={12} />, 'Pending': <Clock size={12} />}[status] || null);

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };
  
  const handleViewReceipt = (order: Order) => {
    setSelectedOrder({ ...order, receiptNumber: `TRA-${order.id.slice(-4)}`, tax: order.total * 0.18 });
    setIsReceiptModalOpen(true);
  };

  return (
    <>
      {isReceiptModalOpen && selectedOrder && <Receipt order={selectedOrder} onClose={() => setIsReceiptModalOpen(false)} />}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Order Details (#{selectedOrder.id})</h3>
                <button onClick={() => setIsDetailsModalOpen(false)} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full text-neutral-500 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="p-6 space-y-3">
              {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item: any, index) => (
                <div key={index} className="flex justify-between items-center bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg border border-neutral-100 dark:border-neutral-700">
                  <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-neutral-500">{item.quantity} x TZS {item.price.toLocaleString()}</p>
                  </div>
                  <p className="font-mono text-neutral-900 dark:text-white">TZS {(item.price * item.quantity).toLocaleString()}</p>
                </div>
              ))}
              <div className="flex justify-between font-bold text-lg pt-4 border-t border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white">
                  <span>Total</span>
                  <span>TZS {selectedOrder.total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Orders</h2>
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"><tr><th className="p-4">Order ID</th><th className="p-4">Customer</th><th className="p-4">Total</th><th className="p-4">Status</th><th className="p-4"></th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="p-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">{order.id}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">{order.customerName}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">TZS {order.total.toLocaleString()}</td>
                  <td className="p-4"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>{getStatusIcon(order.status)}{order.status}</span></td>
                  <td className="p-4 text-right">
                    {order.status === 'Delivered' ? <button onClick={() => handleViewReceipt(order)} className="text-green-600 dark:text-green-400 text-xs font-medium flex items-center gap-1 hover:underline"><FileText size={16} />Receipt</button> : <button onClick={() => handleViewDetails(order)} className="text-orange-600 dark:text-orange-400 text-xs font-medium flex items-center gap-1 hover:underline"><Eye size={16} />View</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};