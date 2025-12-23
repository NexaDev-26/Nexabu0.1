
import React, { useState, useEffect } from 'react';
import { Bill, UserRole } from '../types';
import { Plus, Calendar, DollarSign, CheckCircle, Clock, AlertTriangle, X, Save, Trash2, Edit2, Bell } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const DEFAULT_CATEGORIES = ['Rent', 'Utilities', 'Internet', 'Phone', 'Insurance', 'Taxes', 'Loan', 'Other'];

export const Bills: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [bills, setBills] = useState<Bill[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [billForm, setBillForm] = useState<Partial<Bill>>({
    frequency: 'Monthly',
    autoPay: false,
    status: 'Pending',
    amount: 0
  });

  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
      
      const handleError = (error: any) => {
        if (error.code !== 'permission-denied') {
          console.error("Bills listener error:", error);
        }
      };

      const unsub = onSnapshot(
        query(collection(db, 'bills'), where('uid', '==', targetUid)),
        (snapshot) => {
          const billsData = snapshot.docs.map(d => ({...d.data(), id: d.id} as Bill));
          // Sort by dueDate ascending
          billsData.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
          // Update status to Overdue if past due date (only if not already Overdue)
          const now = new Date();
          billsData.forEach(bill => {
            if (bill.status !== 'Paid' && bill.status !== 'Overdue' && new Date(bill.dueDate) < now) {
              // Update asynchronously to avoid blocking
              updateDoc(doc(db, 'bills', bill.id), { status: 'Overdue' }).catch(err => {
                if (err.code !== 'permission-denied') console.error("Failed to update bill status:", err);
              });
            }
          });
          setBills(billsData);
        },
        handleError
      );

      return () => unsub();
    }
  }, [user]);

  const calculateNextDueDate = (dueDate: string, frequency: string): string => {
    const date = new Date(dueDate);
    switch (frequency) {
      case 'Daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'Weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'Monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'Yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  const handleSaveBill = async () => {
    if (!billForm.name || !billForm.amount || !billForm.dueDate) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    const targetUid = (user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) ? user.uid : user?.employerId;
    if (!targetUid || !db) return;

    const billData = {
      ...billForm,
      uid: targetUid,
      amount: Number(billForm.amount),
      nextDueDate: billForm.frequency === 'One-time' ? undefined : calculateNextDueDate(billForm.dueDate, billForm.frequency || 'Monthly'),
      createdAt: billForm.id ? undefined : new Date().toISOString()
    };

    try {
      if (billForm.id) {
        await updateDoc(doc(db, 'bills', billForm.id), billData);
        showNotification("Bill updated successfully", "success");
      } else {
        await addDoc(collection(db, 'bills'), billData);
        showNotification("Bill added successfully", "success");
      }
      setIsModalOpen(false);
      setBillForm({ frequency: 'Monthly', autoPay: false, status: 'Pending', amount: 0 });
    } catch (e) {
      console.error(e);
      showNotification("Failed to save bill", "error");
    }
  };

  const handleMarkAsPaid = async (bill: Bill) => {
    if (!db) return;
    try {
      const updates: any = { status: 'Paid' as const, lastPaid: new Date().toISOString() };
      
      // If recurring, set next due date
      if (bill.frequency !== 'One-time' && bill.nextDueDate) {
        updates.dueDate = bill.nextDueDate;
        updates.nextDueDate = calculateNextDueDate(bill.nextDueDate, bill.frequency);
        updates.status = 'Pending';
      }
      
      await updateDoc(doc(db, 'bills', bill.id), updates);
      showNotification("Bill marked as paid", "success");
    } catch (e) {
      console.error(e);
      showNotification("Failed to update bill", "error");
    }
  };

  const handleDeleteBill = async (id: string) => {
    if (!confirm("Delete this bill?")) return;
    try {
      if (db) {
        await deleteDoc(doc(db, 'bills', id));
        showNotification("Bill deleted", "success");
      }
    } catch (e) {
      console.error(e);
      showNotification("Failed to delete bill", "error");
    }
  };

  const openAddBill = () => {
    setBillForm({
      frequency: 'Monthly',
      autoPay: false,
      status: 'Pending',
      amount: 0,
      dueDate: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditBill = (bill: Bill) => {
    setBillForm(bill);
    setIsModalOpen(true);
  };

  const upcomingBills = bills.filter(b => b.status !== 'Paid' && new Date(b.dueDate) >= new Date()).slice(0, 5);
  const overdueBills = bills.filter(b => b.status === 'Overdue');
  const totalUpcoming = upcomingBills.reduce((sum, b) => sum + b.amount, 0);
  const totalOverdue = overdueBills.reduce((sum, b) => sum + b.amount, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Bill Tracker</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Track and manage recurring bills</p>
        </div>
        <button onClick={openAddBill} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Bills</p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{bills.length}</h3>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Upcoming</p>
          <h3 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">TZS {totalUpcoming.toLocaleString()}</h3>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Overdue</p>
          <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">TZS {totalOverdue.toLocaleString()}</h3>
        </div>
      </div>

      {/* Overdue Bills Alert */}
      {overdueBills.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-red-900 dark:text-red-100">You have {overdueBills.length} overdue bill(s)</p>
            <p className="text-sm text-red-700 dark:text-red-300">Total overdue: TZS {totalOverdue.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Bills List */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th className="p-4">Bill Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Due Date</th>
              <th className="p-4">Frequency</th>
              <th className="p-4">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <td className="p-4">
                  <div className="font-medium text-neutral-900 dark:text-white">{bill.name}</div>
                  {bill.description && <div className="text-xs text-neutral-500 mt-1">{bill.description}</div>}
                </td>
                <td className="p-4 text-neutral-600 dark:text-neutral-400">{bill.category}</td>
                <td className="p-4 font-bold text-neutral-900 dark:text-white">TZS {bill.amount.toLocaleString()}</td>
                <td className="p-4 text-neutral-600 dark:text-neutral-400">{new Date(bill.dueDate).toLocaleDateString()}</td>
                <td className="p-4 text-neutral-600 dark:text-neutral-400">{bill.frequency}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                    {bill.status === 'Paid' && <CheckCircle className="w-3 h-3" />}
                    {bill.status === 'Pending' && <Clock className="w-3 h-3" />}
                    {bill.status === 'Overdue' && <AlertTriangle className="w-3 h-3" />}
                    {bill.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    {bill.status !== 'Paid' && (
                      <button
                        onClick={() => handleMarkAsPaid(bill)}
                        className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-green-500"
                        title="Mark as Paid"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEditBill(bill)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteBill(bill.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bills.length === 0 && (
          <div className="p-12 text-center text-neutral-500">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No bills tracked</p>
          </div>
        )}
      </div>

      {/* Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {billForm.id ? 'Edit Bill' : 'Add Bill'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Bill Name *</label>
                <input
                  type="text"
                  value={billForm.name || ''}
                  onChange={(e) => setBillForm({...billForm, name: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  placeholder="e.g., Office Rent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Category</label>
                  <select
                    value={billForm.category || 'Other'}
                    onChange={(e) => setBillForm({...billForm, category: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Amount (TZS) *</label>
                  <input
                    type="number"
                    value={billForm.amount || 0}
                    onChange={(e) => setBillForm({...billForm, amount: Number(e.target.value)})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Due Date *</label>
                <input
                  type="date"
                  value={billForm.dueDate || ''}
                  onChange={(e) => setBillForm({...billForm, dueDate: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Frequency</label>
                <select
                  value={billForm.frequency || 'Monthly'}
                  onChange={(e) => setBillForm({...billForm, frequency: e.target.value as any})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                >
                  <option value="One-time">One-time</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Vendor/Provider</label>
                <input
                  type="text"
                  value={billForm.vendor || ''}
                  onChange={(e) => setBillForm({...billForm, vendor: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  placeholder="e.g., TANESCO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Account Number</label>
                <input
                  type="text"
                  value={billForm.accountNumber || ''}
                  onChange={(e) => setBillForm({...billForm, accountNumber: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description</label>
                <textarea
                  value={billForm.description || ''}
                  onChange={(e) => setBillForm({...billForm, description: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={billForm.autoPay || false}
                  onChange={(e) => setBillForm({...billForm, autoPay: e.target.checked})}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Auto-pay enabled</label>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBill}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
