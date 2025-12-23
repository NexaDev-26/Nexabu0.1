import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Edit2, Loader2, AlertTriangle, Save, X, CreditCard, CheckCircle, Package, Calendar } from 'lucide-react';
import { User, UserRole, PaymentConfirmation, SubscriptionPackage } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { deleteUserAccount, getUserDataCount } from '../services/userDeletionService';
import { ErrorHandler } from '../utils/errorHandler';
import { db, isFirebaseEnabled, auth } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const DEFAULT_PACKAGES: SubscriptionPackage[] = [
  { id: 'p1', name: 'Starter', price: 0, period: 'Monthly', services: [], color: 'bg-neutral-800' },
  { id: 'p2', name: 'Premium', price: 25000, period: 'Monthly', services: [], color: 'bg-orange-600', isPopular: true },
  { id: 'p3', name: 'Enterprise', price: 150000, period: 'Monthly', services: [], color: 'bg-purple-600' },
];

export const AdminUsers: React.FC = () => {
  const { allUsers, showNotification, setAllUsers } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [paymentConfirmations, setPaymentConfirmations] = useState<PaymentConfirmation[]>([]);
  const [packages, setPackages] = useState<SubscriptionPackage[]>(DEFAULT_PACKAGES);

  // Form states
  const [userForm, setUserForm] = useState<Partial<User>>({
    name: '',
    email: '',
    role: UserRole.VENDOR,
    phone: '',
    storeName: '',
    status: 'Active'
  });
  const [paymentCode, setPaymentCode] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');

  // Load payment confirmations
  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const unsub = onSnapshot(
        query(collection(db, 'payment_confirmations'), where('status', '==', 'pending')),
        (snapshot) => {
          setPaymentConfirmations(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PaymentConfirmation)));
        },
        (error) => {
          if (error.code !== 'permission-denied') {
            console.error('Payment confirmations listener error:', error);
          }
        }
      );
      return () => unsub();
    }
  }, []);

  const handleDelete = async (user: User) => {
    if (!window.confirm(`⚠️ WARNING: This will permanently delete ALL data associated with ${user.name || user.email}.\n\nThis includes:\n- All products\n- All orders\n- All customers\n- All invoices and bills\n- All expenses\n- All inventory data\n- All staff accounts\n\nThis action CANNOT be undone!\n\nAre you sure you want to proceed?`)) {
      return;
    }

    try {
      const counts = await getUserDataCount(user.uid);
      const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      if (totalItems > 0) {
        const confirmMessage = `This account has ${totalItems} data entries across multiple collections.\n\nAre you absolutely sure you want to delete everything?`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
    } catch (error) {
      console.error('Error getting data count:', error);
    }

    setDeletingUserId(user.uid);
    try {
      const result = await deleteUserAccount(user.uid);
      
      if (result.success) {
        showNotification(`Successfully deleted account and ${result.deletedCount} related data entries.`, 'success');
      } else {
        const errorMsg = result.errors.length > 0 
          ? `Deleted ${result.deletedCount} items, but some errors occurred: ${result.errors.slice(0, 3).join(', ')}`
          : 'Failed to delete account completely.';
        showNotification(errorMsg, 'error');
        console.error('Deletion errors:', result.errors);
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      showNotification(`Error deleting account: ${appError.message}`, 'error');
      ErrorHandler.logError(appError, 'Delete User Account');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email) {
      showNotification('Name and email are required', 'error');
      return;
    }

    if (!auth) {
      showNotification('Authentication not available', 'error');
      return;
    }

    try {
      // Create auth user
      const password = `TempPass${Math.random().toString(36).slice(-8)}!`;
      const userCredential = await createUserWithEmailAndPassword(auth, userForm.email!, password);
      
      // Update auth profile
      await updateProfile(userCredential.user, { displayName: userForm.name });

      // Create Firestore user document
      const userData: Partial<User> = {
        uid: userCredential.user.uid,
        name: userForm.name,
        email: userForm.email!,
        role: userForm.role || UserRole.VENDOR,
        phone: userForm.phone || '',
        storeName: userForm.storeName || userForm.name,
        status: userForm.status || 'Active',
        createdAt: new Date().toISOString(),
        subscriptionPlan: 'Starter',
        activationDate: new Date().toISOString(),
      };

      if (db) {
        await addDoc(collection(db, 'users'), userData);
        showNotification(`User created successfully. Temporary password: ${password}`, 'success');
        setIsCreateModalOpen(false);
        setUserForm({ name: '', email: '', role: UserRole.VENDOR, phone: '', storeName: '', status: 'Active' });
      }
    } catch (error: any) {
      console.error('Create user error:', error);
      showNotification(`Failed to create user: ${error.message}`, 'error');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !db) return;

    try {
      const updates: Partial<User> = {
        name: userForm.name || selectedUser.name,
        email: userForm.email || selectedUser.email,
        role: userForm.role || selectedUser.role,
        phone: userForm.phone || selectedUser.phone,
        storeName: userForm.storeName || selectedUser.storeName,
        status: userForm.status || selectedUser.status,
      };

      await updateDoc(doc(db, 'users', selectedUser.uid), updates);
      showNotification('User updated successfully', 'success');
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Update user error:', error);
      showNotification(`Failed to update user: ${error.message}`, 'error');
    }
  };

  const handleConfirmPayment = async (confirmation: PaymentConfirmation) => {
    if (!db || !auth?.currentUser) return;

    const selectedPkg = packages.find(p => p.id === confirmation.packageId);
    if (!selectedPkg) {
      showNotification('Package not found', 'error');
      return;
    }

    try {
      // Update payment confirmation status
      await updateDoc(doc(db, 'payment_confirmations', confirmation.id), {
        status: 'confirmed',
        confirmedBy: auth.currentUser.uid,
        confirmedAt: new Date().toISOString(),
      });

      // Calculate expiry date (30 days from now for monthly)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      // Update user with package access
      await updateDoc(doc(db, 'users', confirmation.userId), {
        subscriptionPlan: selectedPkg.name,
        packageId: confirmation.packageId,
        subscriptionExpiry: expiryDate.toISOString(),
        status: 'Active',
        activationDate: new Date().toISOString(),
      });

      showNotification(`Package "${selectedPkg.name}" assigned to ${confirmation.userName}`, 'success');
      setIsPaymentModalOpen(false);
    } catch (error: any) {
      console.error('Confirm payment error:', error);
      showNotification(`Failed to confirm payment: ${error.message}`, 'error');
    }
  };

  const handleRejectPayment = async (confirmation: PaymentConfirmation) => {
    if (!db || !auth?.currentUser) return;

    try {
      await updateDoc(doc(db, 'payment_confirmations', confirmation.id), {
        status: 'rejected',
        confirmedBy: auth.currentUser.uid,
        confirmedAt: new Date().toISOString(),
      });
      showNotification('Payment confirmation rejected', 'success');
    } catch (error: any) {
      console.error('Reject payment error:', error);
      showNotification(`Failed to reject payment: ${error.message}`, 'error');
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      storeName: user.storeName || '',
      status: user.status || 'Active',
    });
    setIsEditModalOpen(true);
  };

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingPayments = paymentConfirmations.filter(p => p.status === 'pending');

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">User Management</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage users and assign packages</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" 
          />
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>
      </div>

      {/* Pending Payment Confirmations */}
      {pendingPayments.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-orange-900 dark:text-orange-300 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Pending Payment Confirmations ({pendingPayments.length})
            </h3>
          </div>
          <div className="space-y-2">
            {pendingPayments.slice(0, 3).map(payment => (
              <div key={payment.id} className="bg-white dark:bg-neutral-900 p-3 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">{payment.userName}</p>
                  <p className="text-xs text-neutral-500">Package: {payment.packageName} • Code: {payment.paymentCode}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleConfirmPayment(payment)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-500 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" /> Confirm
                  </button>
                  <button
                    onClick={() => handleRejectPayment(payment)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            {pendingPayments.length > 3 && (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
              >
                View all {pendingPayments.length} pending payments
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Package</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredUsers.map(user => (
                <tr key={user.uid} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="p-4 font-medium text-neutral-900 dark:text-white">{user.name}</td>
                  <td className="p-4 text-neutral-600 dark:text-neutral-400">{user.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                      {user.subscriptionPlan || 'Starter'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.status === 'Active' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}>
                      {user.status || 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openEditModal(user)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-blue-500"
                        title="Edit user"
                      >
                        <Edit2 size={16}/>
                      </button>
                      <button 
                        onClick={() => handleDelete(user)} 
                        disabled={deletingUserId === user.uid}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete user"
                      >
                        {deletingUserId === user.uid ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16}/>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Create New User</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={userForm.name || ''}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={userForm.email || ''}
                  onChange={e => setUserForm({...userForm, email: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Role</label>
                <select
                  value={userForm.role || UserRole.VENDOR}
                  onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                >
                  <option value={UserRole.VENDOR}>Vendor</option>
                  <option value={UserRole.PHARMACY}>Pharmacy</option>
                  <option value={UserRole.CUSTOMER}>Customer</option>
                  <option value={UserRole.MANAGER}>Manager</option>
                  <option value={UserRole.SELLER}>Seller</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={userForm.phone || ''}
                  onChange={e => setUserForm({...userForm, phone: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Store Name</label>
                <input
                  type="text"
                  value={userForm.storeName || ''}
                  onChange={e => setUserForm({...userForm, storeName: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
              <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 border rounded-lg text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                Cancel
              </button>
              <button onClick={handleCreateUser} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2">
                <Save className="w-4 h-4" /> Create User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Edit User</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={userForm.name || ''}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={userForm.email || ''}
                  onChange={e => setUserForm({...userForm, email: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Role</label>
                <select
                  value={userForm.role || UserRole.VENDOR}
                  onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                >
                  <option value={UserRole.VENDOR}>Vendor</option>
                  <option value={UserRole.PHARMACY}>Pharmacy</option>
                  <option value={UserRole.CUSTOMER}>Customer</option>
                  <option value={UserRole.MANAGER}>Manager</option>
                  <option value={UserRole.SELLER}>Seller</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Phone</label>
                <input
                  type="tel"
                  value={userForm.phone || ''}
                  onChange={e => setUserForm({...userForm, phone: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Store Name</label>
                <input
                  type="text"
                  value={userForm.storeName || ''}
                  onChange={e => setUserForm({...userForm, storeName: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
                <select
                  value={userForm.status || 'Active'}
                  onChange={e => setUserForm({...userForm, status: e.target.value})}
                  className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border rounded-lg text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">
                Cancel
              </button>
              <button onClick={handleUpdateUser} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2">
                <Save className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Confirmations Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Payment Confirmations
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {pendingPayments.length === 0 ? (
                <div className="text-center py-8 text-neutral-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No pending payment confirmations</p>
                </div>
              ) : (
                pendingPayments.map(payment => (
                  <div key={payment.id} className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-neutral-900 dark:text-white">{payment.userName}</p>
                        <p className="text-sm text-neutral-500">{payment.userEmail}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                        {payment.packageName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-neutral-500">Payment Code:</span>
                        <span className="font-mono font-bold ml-2 text-neutral-900 dark:text-white">{payment.paymentCode}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Amount:</span>
                        <span className="font-bold ml-2 text-neutral-900 dark:text-white">TZS {payment.amount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Method:</span>
                        <span className="ml-2 text-neutral-900 dark:text-white">{payment.paymentMethod}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500">Date:</span>
                        <span className="ml-2 text-neutral-900 dark:text-white">{new Date(payment.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirmPayment(payment)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirm & Assign Package
                      </button>
                      <button
                        onClick={() => handleRejectPayment(payment)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
