import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, CheckCircle, Clock, XCircle, Truck, MapPin, Package, DollarSign, Calendar, Search, Filter, Eye } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { Order, DeliveryTask, UserRole } from '../types';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{title}</p>
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color} text-white shadow-lg`}>
        {icon}
      </div>
    </div>
  </div>
);

export const CustomerDashboard: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryTask[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Processing' | 'Delivered' | 'Cancelled'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch customer orders from database
  useEffect(() => {
    if (isFirebaseEnabled && db && user) {
      // Query orders by customer name or phone (since customerId might not always be set)
      const customerIdentifier = user.phone || user.name;
      
      if (!customerIdentifier) {
        console.warn("Customer identifier not found");
        return;
      }

      const handleError = (e: any) => {
        if (e.code !== 'permission-denied') {
          console.warn("Orders sync error:", e.code);
        }
      };

      // Try to fetch by customerId first if available
      let ordersQuery;
      if (user.uid) {
        // Try customerId match
        ordersQuery = query(
          collection(db, 'orders'),
          where('customerId', '==', user.uid)
        );
      } else {
        // Fallback to customerName or phone
        ordersQuery = query(
          collection(db, 'orders'),
          where('customerName', '==', user.name)
        );
      }

      const unsubscribeOrders = onSnapshot(
        ordersQuery,
        (snapshot) => {
          const fetchedOrders = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Order));
          setOrders(fetchedOrders);
        },
        handleError
      );

      // Also try alternative query by customerName if first query doesn't work
      if (user.name) {
        const altQuery = query(
          collection(db, 'orders'),
          where('customerName', '==', user.name)
        );
        
        const unsubscribeAlt = onSnapshot(
          altQuery,
          (snapshot) => {
            const altOrders = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Order));
            // Merge with existing orders, avoiding duplicates
            setOrders(prev => {
              const existingIds = new Set(prev.map(o => o.id));
              const newOrders = altOrders.filter(o => !existingIds.has(o.id));
              return [...prev, ...newOrders];
            });
          },
          handleError
        );

        return () => {
          unsubscribeOrders();
          unsubscribeAlt();
        };
      }

      return () => unsubscribeOrders();
    }
  }, [isFirebaseEnabled, user]);

  // Fetch delivery tasks related to customer orders
  useEffect(() => {
    if (isFirebaseEnabled && db && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      const handleError = (e: any) => {
        if (e.code !== 'permission-denied') {
          console.warn("Deliveries sync error:", e.code);
        }
      };

      // Fetch deliveries for customer's orders
      const deliveriesQuery = collection(db, 'deliveries');
      const unsubscribeDeliveries = onSnapshot(
        deliveriesQuery,
        (snapshot) => {
          const allDeliveries = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as DeliveryTask));
          // Filter deliveries that match customer's orders
          const customerDeliveries = allDeliveries.filter(d => 
            orderIds.includes(d.orderId) || 
            d.customer?.toLowerCase().includes(user?.name?.toLowerCase() || '')
          );
          setDeliveries(customerDeliveries);
        },
        handleError
      );

      return () => unsubscribeDeliveries();
    }
  }, [isFirebaseEnabled, orders, user]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === 'Delivered').length;
    const unpaidOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
    const totalSpent = orders
      .filter(o => o.status === 'Delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0);
    const pendingAmount = orders
      .filter(o => o.status === 'Pending' || o.status === 'Processing')
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      totalOrders,
      paidOrders,
      unpaidOrders,
      cancelledOrders,
      totalSpent,
      pendingAmount
    };
  }, [orders]);

  // Filter orders based on search and status
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items?.some((item: any) => 
          (typeof item === 'object' ? item.name : item)?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [orders, searchTerm, statusFilter]);

  // Get delivery status for an order
  const getDeliveryStatus = (orderId: string) => {
    const delivery = deliveries.find(d => d.orderId === orderId);
    return delivery;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Processing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Pending': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'Cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">My Dashboard</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Welcome back, {user?.name || 'Customer'}</p>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-lg text-sm font-mono">
          {new Date().toDateString()}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon={<ShoppingBag className="w-6 h-6" />} 
          color="bg-blue-600" 
        />
        <StatCard 
          title="Paid Orders" 
          value={stats.paidOrders} 
          icon={<CheckCircle className="w-6 h-6" />} 
          color="bg-green-600" 
        />
        <StatCard 
          title="Unpaid Orders" 
          value={stats.unpaidOrders} 
          icon={<Clock className="w-6 h-6" />} 
          color="bg-orange-600" 
        />
        <StatCard 
          title="Total Spent" 
          value={`TZS ${stats.totalSpent.toLocaleString()}`} 
          icon={<DollarSign className="w-6 h-6" />} 
          color="bg-purple-600" 
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-neutral-500 text-sm">Pending Amount</p>
            <h3 className="text-xl font-bold text-orange-600 dark:text-orange-400">TZS {stats.pendingAmount.toLocaleString()}</h3>
          </div>
          <Clock className="text-orange-500 w-8 h-8" />
        </div>
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-neutral-500 text-sm">Active Deliveries</p>
            <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400">{deliveries.filter(d => d.status !== 'Delivered').length}</h3>
          </div>
          <Truck className="text-blue-500 w-8 h-8" />
        </div>
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-neutral-500 text-sm">Cancelled Orders</p>
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400">{stats.cancelledOrders}</h3>
          </div>
          <XCircle className="text-red-500 w-8 h-8" />
        </div>
      </div>

      {/* Orders Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" /> My Orders
          </h3>
        </div>

        {/* Search and Filter */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search orders by receipt number, items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Orders List */}
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-neutral-400 mx-auto mb-4 opacity-50" />
              <p className="text-neutral-500 dark:text-neutral-400">No orders found</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const delivery = getDeliveryStatus(order.id);
              return (
                <div
                  key={order.id}
                  className="p-6 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-neutral-900 dark:text-white">
                          Order #{order.receiptNumber || order.id.slice(-6)}
                        </h4>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                        {delivery && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Truck className="w-3 h-3" />
                            {delivery.status}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(order.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          TZS {order.total.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-4 h-4" />
                          {Array.isArray(order.items) ? order.items.length : 1} item(s)
                        </span>
                      </div>
                      {delivery && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                          <MapPin className="w-3 h-3" />
                          <span>{delivery.address}</span>
                          {delivery.driver && (
                            <>
                              <span>•</span>
                              <span>Driver: {delivery.driver}</span>
                            </>
                          )}
                          {delivery.eta && (
                            <>
                              <span>•</span>
                              <span>ETA: {delivery.eta}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 text-sm font-medium flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                Order Details - #{selectedOrder.receiptNumber || selectedOrder.id.slice(-6)}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full text-neutral-500"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Order Info */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Status</span>
                  <span className={`px-3 py-1 rounded text-sm font-bold ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Date</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {new Date(selectedOrder.date).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500">Receipt Number</span>
                  <span className="text-sm font-medium text-neutral-900 dark:text-white">
                    {selectedOrder.receiptNumber || 'N/A'}
                  </span>
                </div>
                {selectedOrder.orderType && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-neutral-500">Order Type</span>
                    <span className="text-sm font-medium text-neutral-900 dark:text-white">
                      {selectedOrder.orderType}
                    </span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-neutral-700 dark:text-neutral-300">Items</h4>
                <div className="space-y-2">
                  {Array.isArray(selectedOrder.items) ? (
                    selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">
                            {typeof item === 'object' ? item.name : item}
                          </p>
                          <p className="text-xs text-neutral-500">
                            Qty: {typeof item === 'object' ? item.quantity : 1} × TZS {typeof item === 'object' ? item.price.toLocaleString() : '0'}
                          </p>
                        </div>
                        <p className="font-bold text-neutral-900 dark:text-white">
                          TZS {typeof item === 'object' ? (item.price * item.quantity).toLocaleString() : '0'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500">No items details available</p>
                  )}
                </div>
              </div>

              {/* Delivery Info */}
              {getDeliveryStatus(selectedOrder.id) && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <h4 className="font-bold text-sm text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                    <Truck className="w-4 h-4" /> Delivery Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Status</span>
                      <span className="font-medium text-blue-900 dark:text-blue-200">
                        {getDeliveryStatus(selectedOrder.id)?.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Address</span>
                      <span className="font-medium text-blue-900 dark:text-blue-200">
                        {getDeliveryStatus(selectedOrder.id)?.address}
                      </span>
                    </div>
                    {getDeliveryStatus(selectedOrder.id)?.driver && (
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Driver</span>
                        <span className="font-medium text-blue-900 dark:text-blue-200">
                          {getDeliveryStatus(selectedOrder.id)?.driver}
                        </span>
                      </div>
                    )}
                    {getDeliveryStatus(selectedOrder.id)?.eta && (
                      <div className="flex justify-between">
                        <span className="text-blue-700 dark:text-blue-300">Estimated Arrival</span>
                        <span className="font-medium text-blue-900 dark:text-blue-200">
                          {getDeliveryStatus(selectedOrder.id)?.eta}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex justify-between text-sm mb-2">
                  <span>Subtotal</span>
                  <span>TZS {selectedOrder.total.toLocaleString()}</span>
                </div>
                {selectedOrder.tax && (
                  <div className="flex justify-between text-sm mb-2">
                    <span>Tax</span>
                    <span>TZS {selectedOrder.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-200 dark:border-neutral-800 mt-2">
                  <span>Total</span>
                  <span>TZS {selectedOrder.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

