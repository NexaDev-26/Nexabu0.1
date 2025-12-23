/**
 * Warehouse Transfers Component
 * Manages product transfers between stores/branches
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, Plus, CheckCircle, XCircle, Clock, Truck, 
  Package, Search, Filter, Eye, X, Loader2, AlertCircle 
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { Branch, Product, UserRole } from '../types';
import { 
  createTransferRequest, 
  approveTransfer, 
  completeTransfer, 
  cancelTransfer, 
  getTransferHistory,
  validateTransferRequest,
  WarehouseTransfer 
} from '../services/warehouseService';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ApiService } from '../services/apiService';
import { ErrorHandler } from '../utils/errorHandler';
import { useLoading } from '../hooks/useLoading';

export const WarehouseTransfers: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const { loading, startLoading, stopLoading } = useLoading();
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WarehouseTransfer['status']>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<WarehouseTransfer | null>(null);
  
  // Transfer form state
  const [formData, setFormData] = useState({
    fromBranchId: '',
    toBranchId: '',
    notes: '',
  });
  const [transferItems, setTransferItems] = useState<Array<{
    productId: string;
    productName: string;
    quantity: number;
    currentStock?: number;
  }>>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Load data
  useEffect(() => {
    if (!isFirebaseEnabled || !db || !user?.uid) return;

    const targetUid = user.employerId || user.uid;

    const handleError = (error: any) => {
      if (error.code !== 'permission-denied') {
        console.error('Error:', error);
      }
    };

    const unsubs = [
      // Load transfers
      onSnapshot(
        query(collection(db, 'warehouse_transfers'), where('uid', '==', targetUid)),
        async (snapshot) => {
          const data = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as WarehouseTransfer));
          data.sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime());
          setTransfers(data);
        },
        handleError
      ),
      // Load branches
      onSnapshot(
        query(collection(db, 'branches'), where('uid', '==', targetUid)),
        (snapshot) => setBranches(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Branch))),
        handleError
      ),
      // Load products
      onSnapshot(
        query(collection(db, 'products'), where('uid', '==', targetUid)),
        (snapshot) => setProducts(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Product))),
        handleError
      ),
    ];

    return () => unsubs.forEach(u => u());
  }, [user]);

  const getStatusIcon = (status: WarehouseTransfer['status']) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Cancelled': return <XCircle className="w-4 h-4" />;
      case 'In Transit': return <Truck className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: WarehouseTransfer['status']) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Approved': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'In Transit': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    }
  };

  const handleCreateTransfer = async () => {
    if (!user?.uid) return;

    if (!formData.fromBranchId || !formData.toBranchId) {
      showNotification('Please select source and destination branches', 'error');
      return;
    }

    if (transferItems.length === 0) {
      showNotification('Please add at least one item to transfer', 'error');
      return;
    }

    if (formData.fromBranchId === formData.toBranchId) {
      showNotification('Source and destination branches cannot be the same', 'error');
      return;
    }

    const fromBranch = branches.find(b => b.id === formData.fromBranchId);
    const toBranch = branches.find(b => b.id === formData.toBranchId);

    if (!fromBranch || !toBranch) {
      showNotification('Invalid branch selection', 'error');
      return;
    }

    // Validate transfer
    const validation = validateTransferRequest(
      {
        fromBranchId: formData.fromBranchId,
        toBranchId: formData.toBranchId,
        items: transferItems,
      },
      products
    );

    if (!validation.isValid) {
      showNotification(validation.errors.join(', '), 'error');
      return;
    }

    startLoading();
    try {
      const transferId = await createTransferRequest({
        uid: user.uid,
        fromBranchId: formData.fromBranchId,
        fromBranchName: fromBranch.name,
        toBranchId: formData.toBranchId,
        toBranchName: toBranch.name,
        items: transferItems,
        requestedBy: user.uid,
        requestedByName: user.name,
        notes: formData.notes,
      });

      if (transferId) {
        showNotification('Transfer request created successfully', 'success');
        setIsModalOpen(false);
        setFormData({ fromBranchId: '', toBranchId: '', notes: '' });
        setTransferItems([]);
      }
    } catch (error: any) {
      ErrorHandler.logError(error, 'Create Transfer');
      showNotification('Failed to create transfer request', 'error');
    } finally {
      stopLoading();
    }
  };

  const handleApproveTransfer = async (transfer: WarehouseTransfer) => {
    if (!user?.uid || !user.name) return;

    startLoading();
    try {
      const success = await approveTransfer(transfer.id, user.uid, user.name);
      if (success) {
        showNotification('Transfer approved successfully', 'success');
      } else {
        showNotification('Failed to approve transfer', 'error');
      }
    } catch (error: any) {
      ErrorHandler.logError(error, 'Approve Transfer');
      showNotification('Failed to approve transfer', 'error');
    } finally {
      stopLoading();
    }
  };

  const handleCompleteTransfer = async (transfer: WarehouseTransfer) => {
    if (!user?.uid) return;

    if (!confirm('Are you sure you want to complete this transfer? This will update inventory.')) {
      return;
    }

    startLoading();
    try {
      const success = await completeTransfer(transfer.id, transfer);
      if (success) {
        showNotification('Transfer completed successfully', 'success');
      } else {
        showNotification('Failed to complete transfer', 'error');
      }
    } catch (error: any) {
      ErrorHandler.logError(error, 'Complete Transfer');
      showNotification('Failed to complete transfer', 'error');
    } finally {
      stopLoading();
    }
  };

  const handleCancelTransfer = async (transferId: string) => {
    if (!confirm('Are you sure you want to cancel this transfer?')) {
      return;
    }

    startLoading();
    try {
      const success = await cancelTransfer(transferId);
      if (success) {
        showNotification('Transfer cancelled successfully', 'success');
      } else {
        showNotification('Failed to cancel transfer', 'error');
      }
    } catch (error: any) {
      ErrorHandler.logError(error, 'Cancel Transfer');
      showNotification('Failed to cancel transfer', 'error');
    } finally {
      stopLoading();
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId) {
      showNotification('Please select a product', 'error');
      return;
    }

    if (selectedQuantity <= 0) {
      showNotification('Quantity must be greater than 0', 'error');
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if item already added
    const existingIndex = transferItems.findIndex(item => item.productId === selectedProductId);
    if (existingIndex >= 0) {
      showNotification('Product already added. Update quantity instead.', 'error');
      return;
    }

    // Check stock availability
    if ((product.stock || 0) < selectedQuantity) {
      showNotification(`Insufficient stock. Available: ${product.stock}`, 'error');
      return;
    }

    setTransferItems([...transferItems, {
      productId: product.id,
      productName: product.name,
      quantity: selectedQuantity,
      currentStock: product.stock,
    }]);

    setSelectedProductId('');
    setSelectedQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setTransferItems(transferItems.filter((_, i) => i !== index));
  };

  const filteredTransfers = transfers.filter(t => {
    const matchesSearch = 
      t.fromBranchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.toBranchName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const availableProducts = products.filter(p => {
    // Only show products from source branch (simplified - in real app, products would be branch-specific)
    return (p.stock || 0) > 0;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Warehouse Transfers</h2>
          <p className="text-sm text-neutral-500 mt-1">Manage product transfers between branches</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-medium flex items-center gap-2"
        >
          <Plus size={20} />
          New Transfer
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search transfers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="In Transit">In Transit</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="p-4 font-medium text-neutral-500">ID</th>
              <th className="p-4 font-medium text-neutral-500">From</th>
              <th className="p-4 font-medium text-neutral-500">To</th>
              <th className="p-4 font-medium text-neutral-500">Items</th>
              <th className="p-4 font-medium text-neutral-500">Status</th>
              <th className="p-4 font-medium text-neutral-500">Date</th>
              <th className="p-4 font-medium text-neutral-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  No transfers found
                </td>
              </tr>
            ) : (
              filteredTransfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="p-4 font-mono text-xs text-neutral-500">{transfer.id?.slice(-8)}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">{transfer.fromBranchName}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">{transfer.toBranchName}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">
                    {transfer.items.length} item(s)
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transfer.status)}`}>
                      {getStatusIcon(transfer.status)}
                      {transfer.status}
                    </span>
                  </td>
                  <td className="p-4 text-neutral-500 text-xs">
                    {new Date(transfer.requestedDate).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedTransfer(transfer)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400"
                      >
                        <Eye size={16} />
                      </button>
                      {transfer.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleApproveTransfer(transfer)}
                            className="p-2 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg text-green-600"
                            disabled={loading}
                          >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                          </button>
                          <button
                            onClick={() => handleCancelTransfer(transfer.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-600"
                            disabled={loading}
                          >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                          </button>
                        </>
                      )}
                      {transfer.status === 'Approved' && (
                        <button
                          onClick={() => handleCompleteTransfer(transfer)}
                          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg text-blue-600"
                          disabled={loading}
                        >
                          {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Transfer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Create Transfer Request</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Branch Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    From Branch *
                  </label>
                  <select
                    value={formData.fromBranchId}
                    onChange={(e) => setFormData({ ...formData, fromBranchId: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select branch...</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    To Branch *
                  </label>
                  <select
                    value={formData.toBranchId}
                    onChange={(e) => setFormData({ ...formData, toBranchId: e.target.value })}
                    className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select branch...</option>
                    {branches.filter(b => b.id !== formData.fromBranchId).map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Items */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Items to Transfer *
                </label>
                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">Select product...</option>
                    {availableProducts.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} (Stock: {product.stock || 0})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={selectedQuantity}
                    onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                    className="w-24 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Qty"
                  />
                  <button
                    onClick={handleAddItem}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500"
                  >
                    Add
                  </button>
                </div>

                {/* Items List */}
                {transferItems.length > 0 && (
                  <div className="space-y-2">
                    {transferItems.map((item, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <div>
                          <p className="font-medium text-neutral-900 dark:text-white">{item.productName}</p>
                          <p className="text-xs text-neutral-500">Qty: {item.quantity} | Stock: {item.currentStock}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  rows={3}
                  placeholder="Add any notes about this transfer..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTransfer}
                disabled={loading || transferItems.length === 0}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Transfer Details</h3>
              <button onClick={() => setSelectedTransfer(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">From</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{selectedTransfer.fromBranchName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">To</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{selectedTransfer.toBranchName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedTransfer.status)}`}>
                    {getStatusIcon(selectedTransfer.status)}
                    {selectedTransfer.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Date</p>
                  <p className="font-medium text-neutral-900 dark:text-white">
                    {new Date(selectedTransfer.requestedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedTransfer.items.map((item, index) => (
                    <div key={index} className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                      <p className="font-medium text-neutral-900 dark:text-white">{item.productName}</p>
                      <p className="text-xs text-neutral-500">Quantity: {item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTransfer.notes && (
                <div>
                  <p className="text-xs text-neutral-500 mb-2">Notes</p>
                  <p className="text-sm text-neutral-900 dark:text-white">{selectedTransfer.notes}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="w-full px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

