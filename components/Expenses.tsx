
import React, { useState, useEffect, useRef } from 'react';
import { Expense, ExpenseCategory, UserRole } from '../types';
import { Plus, Search, DollarSign, Filter, Save, X, Trash2, Edit2, Calendar, Receipt, CreditCard, TrendingDown, FolderOpen, Upload, Download } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';

const DEFAULT_CATEGORIES = [
  { name: 'Rent', icon: '🏢', color: '#ef4444' },
  { name: 'Utilities', icon: '💡', color: '#f59e0b' },
  { name: 'Salaries', icon: '👥', color: '#3b82f6' },
  { name: 'Marketing', icon: '📢', color: '#8b5cf6' },
  { name: 'Supplies', icon: '📦', color: '#10b981' },
  { name: 'Transport', icon: '🚗', color: '#06b6d4' },
  { name: 'Insurance', icon: '🛡️', color: '#6366f1' },
  { name: 'Maintenance', icon: '🔧', color: '#ec4899' },
  { name: 'Bank Fees', icon: '🏦', color: '#64748b' },
  { name: 'Other', icon: '📋', color: '#94a3b8' },
];

export const Expenses: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [activeTab, setActiveTab] = useState<'expenses' | 'categories'>('expenses');
  
  // Data State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Form State
  const [editingExpense, setEditingExpense] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    isRecurring: false,
    status: 'Paid'
  });
  const [categoryForm, setCategoryForm] = useState<Partial<ExpenseCategory>>({ status: 'Active' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Data
  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
      
      const handleError = (error: any) => {
        if (error.code !== 'permission-denied') {
          console.error("Expenses listener error:", error);
        }
      };

      // Load Expenses (sort client-side to avoid index errors)
      const unsubExpenses = onSnapshot(
        query(collection(db, 'expenses'), where('uid', '==', targetUid)),
        (snapshot) => {
          const data = snapshot.docs.map(d => ({...d.data(), id: d.id} as Expense));
          data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setExpenses(data);
        },
        handleError
      );

      // Load Categories
      let categoriesInitialized = false;
      const unsubCategories = onSnapshot(
        query(collection(db, 'expense_categories'), where('uid', '==', targetUid)),
        (snapshot) => {
          const cats = snapshot.docs.map(d => ({...d.data(), id: d.id} as ExpenseCategory));
          if (cats.length === 0 && !categoriesInitialized) {
            categoriesInitialized = true;
            // Initialize default categories
            initializeDefaultCategories(targetUid);
          } else {
            setCategories(cats);
          }
        },
        handleError
      );

      return () => {
        unsubExpenses();
        unsubCategories();
      };
    }
  }, [user]);

  const initializeDefaultCategories = async (uid: string) => {
    if (!db) return;
    try {
      const batch = DEFAULT_CATEGORIES.map(cat => addDoc(collection(db, 'expense_categories'), {
        uid,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        status: 'Active' as const,
        createdAt: new Date().toISOString()
      }));
      await Promise.all(batch);
      showNotification("Default expense categories initialized", "success");
    } catch (e) {
      console.error("Failed to initialize categories:", e);
    }
  };

  const handleSaveExpense = async () => {
    if (!editingExpense.amount || !editingExpense.categoryId || !editingExpense.description) {
      showNotification("Please fill in all required fields", "error");
      return;
    }

    const targetUid = (user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) ? user.uid : user?.employerId;
    if (!targetUid || !db) return;

    const category = categories.find(c => c.id === editingExpense.categoryId);
    const expenseData = {
      ...editingExpense,
      uid: targetUid,
      categoryName: category?.name || 'Other',
      amount: Number(editingExpense.amount),
      createdAt: editingExpense.id ? undefined : new Date().toISOString()
    };

    try {
      if (editingExpense.id) {
        await updateDoc(doc(db, 'expenses', editingExpense.id), expenseData);
        showNotification("Expense updated successfully", "success");
      } else {
        await addDoc(collection(db, 'expenses'), expenseData);
        showNotification("Expense added successfully", "success");
      }
      setIsModalOpen(false);
      setEditingExpense({ date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash', isRecurring: false, status: 'Paid' });
    } catch (e) {
      console.error(e);
      showNotification("Failed to save expense", "error");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      if (db) {
        await deleteDoc(doc(db, 'expenses', id));
        showNotification("Expense deleted", "success");
      }
    } catch (e) {
      console.error(e);
      showNotification("Failed to delete expense", "error");
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) {
      showNotification("Category name is required", "error");
      return;
    }

    const targetUid = (user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) ? user.uid : user?.employerId;
    if (!targetUid || !db) return;

    const categoryData = {
      ...categoryForm,
      uid: targetUid,
      createdAt: categoryForm.id ? undefined : new Date().toISOString()
    };

    try {
      if (categoryForm.id) {
        await updateDoc(doc(db, 'expense_categories', categoryForm.id), categoryData);
        showNotification("Category updated", "success");
      } else {
        await addDoc(collection(db, 'expense_categories'), categoryData);
        showNotification("Category added", "success");
      }
      setIsCategoryModalOpen(false);
      setCategoryForm({ status: 'Active' });
    } catch (e) {
      console.error(e);
      showNotification("Failed to save category", "error");
    }
  };

  const openAddExpense = () => {
    setEditingExpense({ date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash', isRecurring: false, status: 'Paid' });
    setIsModalOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  // Filter expenses
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         e.categoryName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || e.categoryId === filterCategory;
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesDate = (!dateRange.start || e.date >= dateRange.start) && 
                       (!dateRange.end || e.date <= dateRange.end);
    return matchesSearch && matchesCategory && matchesStatus && matchesDate;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Expense Management</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Track and manage your business expenses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab(activeTab === 'expenses' ? 'categories' : 'expenses')}
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {activeTab === 'expenses' ? 'Categories' : 'Expenses'}
          </button>
          {activeTab === 'expenses' && (
            <button onClick={openAddExpense} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          )}
        </div>
      </div>

      {activeTab === 'expenses' ? (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
              />
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 rounded-xl text-white">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-red-100 text-sm">Total Expenses</p>
                <h3 className="text-3xl font-bold mt-1">TZS {totalExpenses.toLocaleString()}</h3>
                <p className="text-red-100 text-xs mt-1">{filteredExpenses.length} expense(s)</p>
              </div>
              <TrendingDown className="w-12 h-12 opacity-80" />
            </div>
          </div>

          {/* Expenses List */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredExpenses.map((expense) => {
                  const category = categories.find(c => c.id === expense.categoryId);
                  return (
                    <tr key={expense.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="p-4 text-neutral-600 dark:text-neutral-400">{new Date(expense.date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-2">
                          {category?.icon && <span>{category.icon}</span>}
                          <span className="font-medium text-neutral-900 dark:text-white">{expense.categoryName}</span>
                        </span>
                      </td>
                      <td className="p-4 text-neutral-900 dark:text-white">{expense.description}</td>
                      <td className="p-4 font-bold text-red-600 dark:text-red-400">TZS {expense.amount.toLocaleString()}</td>
                      <td className="p-4 text-neutral-600 dark:text-neutral-400">{expense.paymentMethod}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          expense.status === 'Paid' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                          expense.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}>
                          {expense.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openEditExpense(expense)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteExpense(expense.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredExpenses.length === 0 && (
              <div className="p-12 text-center text-neutral-500">
                <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No expenses found</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Expense Categories</h3>
            <button
              onClick={() => {
                setCategoryForm({ status: 'Active' });
                setIsCategoryModalOpen(true);
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Category
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => (
              <div
                key={cat.id}
                className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                style={{ borderColor: cat.color }}
                onClick={() => {
                  setCategoryForm(cat);
                  setIsCategoryModalOpen(true);
                }}
              >
                <div className="text-2xl mb-2">{cat.icon}</div>
                <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {expenses.filter(e => e.categoryId === cat.id).length} expense(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {editingExpense.id ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Category *</label>
                  <select
                    value={editingExpense.categoryId || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, categoryId: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="">Select category</option>
                    {categories.filter(c => c.status === 'Active').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Amount (TZS) *</label>
                  <input
                    type="number"
                    value={editingExpense.amount || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, amount: Number(e.target.value)})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Date *</label>
                  <input
                    type="date"
                    value={editingExpense.date || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, date: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Payment Method</label>
                  <select
                    value={editingExpense.paymentMethod || 'Cash'}
                    onChange={(e) => setEditingExpense({...editingExpense, paymentMethod: e.target.value as any})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="M-PESA">M-PESA</option>
                    <option value="TIGO PESA">TIGO PESA</option>
                    <option value="AIRTEL MONEY">AIRTEL MONEY</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description *</label>
                <textarea
                  value={editingExpense.description || ''}
                  onChange={(e) => setEditingExpense({...editingExpense, description: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
                  <select
                    value={editingExpense.status || 'Paid'}
                    onChange={(e) => setEditingExpense({...editingExpense, status: e.target.value as any})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Vendor/Supplier</label>
                  <input
                    type="text"
                    value={editingExpense.vendor || ''}
                    onChange={(e) => setEditingExpense({...editingExpense, vendor: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editingExpense.isRecurring || false}
                  onChange={(e) => setEditingExpense({...editingExpense, isRecurring: e.target.checked})}
                  className="w-4 h-4"
                />
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Recurring Expense</label>
              </div>
              {editingExpense.isRecurring && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Frequency</label>
                    <select
                      value={editingExpense.recurringFrequency || 'Monthly'}
                      onChange={(e) => setEditingExpense({...editingExpense, recurringFrequency: e.target.value as any})}
                      className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={editingExpense.nextDueDate || ''}
                      onChange={(e) => setEditingExpense({...editingExpense, nextDueDate: e.target.value})}
                      className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveExpense}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {categoryForm.id ? 'Edit Category' : 'Add Category'}
              </h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={categoryForm.name || ''}
                  onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Icon (Emoji)</label>
                <input
                  type="text"
                  value={categoryForm.icon || ''}
                  onChange={(e) => setCategoryForm({...categoryForm, icon: e.target.value})}
                  placeholder="🏢"
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Color</label>
                <input
                  type="color"
                  value={categoryForm.color || '#64748b'}
                  onChange={(e) => setCategoryForm({...categoryForm, color: e.target.value})}
                  className="w-full h-10 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Description</label>
                <textarea
                  value={categoryForm.description || ''}
                  onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
                <select
                  value={categoryForm.status || 'Active'}
                  onChange={(e) => setCategoryForm({...categoryForm, status: e.target.value as any})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" /> Save Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
