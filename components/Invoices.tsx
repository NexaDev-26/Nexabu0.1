
import React, { useState, useEffect } from 'react';
import { Invoice, Customer, Order, UserRole } from '../types';
import { Plus, Search, FileText, Send, CheckCircle, Clock, XCircle, Eye, X, Download, Mail, MessageCircle, Calendar, DollarSign, ChevronDown, Trash2, Edit2 } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { exportToPDF, exportToExcel, exportToCSV, exportToText } from '../utils/exportUtils';
import { InvoiceTemplateSelector } from './InvoiceTemplateSelector';

export const Invoices: React.FC = () => {
  const { user, showNotification, orders: allOrders, allUsers } = useAppContext();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isTemplateSelectorOpen, setIsTemplateSelectorOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [invoiceForm, setInvoiceForm] = useState<Partial<Invoice>>({
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    paymentTerms: 'Net 30',
    status: 'Draft',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
      
      const handleError = (error: any) => {
        if (error.code !== 'permission-denied') {
          console.error("Invoices listener error:", error);
        }
      };

      // Load invoices (sort client-side to avoid index errors)
      const unsubInvoices = onSnapshot(
        query(collection(db, 'invoices'), where('uid', '==', targetUid)),
        (snapshot) => {
          const invs = snapshot.docs.map(d => ({...d.data(), id: d.id} as Invoice));
          // Sort by issueDate descending
          invs.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
          // Update status to Overdue if past due date (only if not already Overdue)
          const now = new Date();
          invs.forEach(inv => {
            if (inv.status !== 'Paid' && inv.status !== 'Cancelled' && inv.status !== 'Overdue' && new Date(inv.dueDate) < now) {
              // Update asynchronously to avoid blocking
              updateDoc(doc(db, 'invoices', inv.id), { status: 'Overdue' }).catch(err => {
                if (err.code !== 'permission-denied') console.error("Failed to update invoice status:", err);
              });
            }
          });
          setInvoices(invs);
        },
        handleError
      );

      // Load customers
      const unsubCustomers = onSnapshot(
        query(collection(db, 'customers'), where('uid', '==', targetUid)),
        (snapshot) => setCustomers(snapshot.docs.map(d => ({...d.data(), id: d.id} as Customer))),
        handleError
      );

      return () => {
        unsubInvoices();
        unsubCustomers();
      };
    }
  }, [user]);

  const generateInvoiceNumber = () => {
    const prefix = 'INV';
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${year}-${random}`;
  };

  const handleSaveInvoice = async () => {
    if (!invoiceForm.customerId || !invoiceForm.items || invoiceForm.items.length === 0) {
      showNotification("Please select a customer and add items", "error");
      return;
    }

    const targetUid = (user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) ? user.uid : user?.employerId;
    if (!targetUid || !db) return;

    const customer = customers.find(c => c.id === invoiceForm.customerId);
    const invoiceData: Partial<Invoice> = {
      ...invoiceForm,
      uid: targetUid,
      invoiceNumber: invoiceForm.invoiceNumber || generateInvoiceNumber(),
      customerName: customer?.fullName || '',
      customerEmail: customer?.email || '',
      customerPhone: customer?.phone || '',
      items: invoiceForm.items.map(item => ({
        ...item,
        total: item.quantity * item.price
      })),
      subtotal: invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
      total: (invoiceForm.items.reduce((sum, item) => sum + (item.quantity * item.price), 0) * (1 + (invoiceForm.tax || 0) / 100)) - (invoiceForm.discount || 0),
      createdAt: invoiceForm.id ? undefined : new Date().toISOString()
    };

    try {
      if (invoiceForm.id) {
        await updateDoc(doc(db, 'invoices', invoiceForm.id), invoiceData);
        showNotification("Invoice updated successfully", "success");
      } else {
        await addDoc(collection(db, 'invoices'), invoiceData);
        showNotification("Invoice created successfully", "success");
      }
      setIsModalOpen(false);
      setInvoiceForm({
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        paymentTerms: 'Net 30',
        status: 'Draft',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    } catch (e) {
      console.error(e);
      showNotification("Failed to save invoice", "error");
    }
  };

  const handleAddItem = () => {
    setInvoiceForm({
      ...invoiceForm,
      items: [...(invoiceForm.items || []), { name: '', quantity: 1, price: 0, total: 0 }]
    });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const items = [...(invoiceForm.items || [])];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'price') {
      items[index].total = items[index].quantity * items[index].price;
    }
    setInvoiceForm({ ...invoiceForm, items });
  };

  const handleRemoveItem = (index: number) => {
    const items = invoiceForm.items?.filter((_, i) => i !== index) || [];
    setInvoiceForm({ ...invoiceForm, items });
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), {
        status: 'Paid',
        paymentDate: new Date().toISOString()
      });
      showNotification("Invoice marked as paid", "success");
    } catch (e) {
      console.error(e);
      showNotification("Failed to update invoice", "error");
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'invoices', invoice.id), { status: 'Sent' });
      
      // In a real app, you would send email/SMS/WhatsApp here
      const message = `Invoice ${invoice.invoiceNumber} sent to ${invoice.customerName}`;
      showNotification(message, "success");
    } catch (e) {
      console.error(e);
      showNotification("Failed to send invoice", "error");
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("Delete this invoice? This action cannot be undone.")) return;
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'invoices', id));
      showNotification("Invoice deleted successfully", "success");
    } catch (e) {
      console.error(e);
      showNotification("Failed to delete invoice", "error");
    }
  };

  const openAddInvoice = () => {
    setInvoiceForm({
      items: [],
      subtotal: 0,
      tax: 18, // Default 18% VAT
      discount: 0,
      total: 0,
      paymentTerms: 'Net 30',
      status: 'Draft',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const openEditInvoice = (invoice: Invoice) => {
    setInvoiceForm(invoice);
    setIsModalOpen(true);
  };

  const openViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
  };

  const exportInvoice = (invoice: Invoice, format: 'pdf' | 'excel' | 'csv' | 'text') => {
    const data = invoice.items.map(item => ({
      Item: item.name,
      Quantity: item.quantity,
      Price: item.price,
      Total: item.total
    }));

    const columns = [
      { key: 'Item', label: 'Item', width: 80 },
      { key: 'Quantity', label: 'Qty', width: 30 },
      { key: 'Price', label: 'Price', width: 40 },
      { key: 'Total', label: 'Total', width: 40 }
    ];

    const filename = `invoice_${invoice.invoiceNumber}`;
    const title = `Invoice ${invoice.invoiceNumber}`;

    switch (format) {
      case 'pdf':
        exportToPDF(data, title, filename, columns);
        showNotification('Invoice exported as PDF', 'success');
        break;
      case 'excel':
        exportToExcel(data, title, filename, columns);
        showNotification('Invoice exported as Excel', 'success');
        break;
      case 'csv':
        exportToCSV(data, title, filename, columns);
        showNotification('Invoice exported as CSV', 'success');
        break;
      case 'text':
        exportToText(data, title, filename, columns);
        showNotification('Invoice exported as Text', 'success');
        break;
      default:
        break;
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totalOutstanding = invoices
    .filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled')
    .reduce((sum, inv) => sum + inv.total, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'Overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Paid': return <CheckCircle className="w-4 h-4" />;
      case 'Sent': return <Send className="w-4 h-4" />;
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Overdue': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in px-4 sm:px-6 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Invoices</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage and track customer invoices</p>
        </div>
        <button onClick={openAddInvoice} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Invoice
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Invoices</p>
          <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{invoices.length}</h3>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Outstanding</p>
          <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">TZS {totalOutstanding.toLocaleString()}</h3>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Paid</p>
          <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {invoices.filter(i => i.status === 'Paid').length}
          </h3>
        </div>
        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Overdue</p>
          <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {invoices.filter(i => i.status === 'Overdue').length}
          </h3>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
        >
          <option value="all">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Paid">Paid</option>
          <option value="Overdue">Overdue</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[720px]">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="p-4">Invoice #</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Issue Date</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="p-4 font-mono text-xs text-neutral-900 dark:text-white break-all">{invoice.invoiceNumber}</td>
                  <td className="p-4 text-neutral-900 dark:text-white">{invoice.customerName}</td>
                  <td className="p-4 text-neutral-600 dark:text-neutral-400">{new Date(invoice.issueDate).toLocaleDateString()}</td>
                  <td className="p-4 text-neutral-600 dark:text-neutral-400">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                  <td className="p-4 font-bold text-neutral-900 dark:text-white">TZS {invoice.total.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      {invoice.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openViewInvoice(invoice)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
                        <>
                          <button onClick={() => handleSendInvoice(invoice)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-green-500" title="Send">
                            <Send className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleMarkAsPaid(invoice)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-purple-500" title="Mark as Paid">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <div className="relative group">
                        <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-orange-500 flex items-center gap-1" title="Export">
                          <Download className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <div className="hidden group-hover:flex flex-col absolute right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-lg z-10 min-w-[140px]">
                          <button onClick={() => exportInvoice(invoice, 'pdf')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">PDF</button>
                          <button onClick={() => exportInvoice(invoice, 'excel')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Excel</button>
                          <button onClick={() => exportInvoice(invoice, 'csv')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">CSV</button>
                          <button onClick={() => exportInvoice(invoice, 'text')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Text</button>
                        </div>
                      </div>
                      {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
                        <button onClick={() => openEditInvoice(invoice)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-indigo-500" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteInvoice(invoice.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInvoices.length === 0 && (
          <div className="p-12 text-center text-neutral-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No invoices found</p>
          </div>
        )}
      </div>

      {/* Invoice Modal - Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-3xl shadow-2xl my-8 max-h-[90vh] overflow-hidden modal-content">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900 z-10">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {invoiceForm.id ? 'Edit Invoice' : 'Create Invoice'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Customer *</label>
                  <select
                    value={invoiceForm.customerId || ''}
                    onChange={(e) => setInvoiceForm({...invoiceForm, customerId: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="">Select customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>{customer.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={invoiceForm.invoiceNumber || generateInvoiceNumber()}
                    onChange={(e) => setInvoiceForm({...invoiceForm, invoiceNumber: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={invoiceForm.issueDate || ''}
                    onChange={(e) => setInvoiceForm({...invoiceForm, issueDate: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate || ''}
                    onChange={(e) => setInvoiceForm({...invoiceForm, dueDate: e.target.value})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Payment Terms</label>
                  <select
                    value={invoiceForm.paymentTerms || 'Net 30'}
                    onChange={(e) => setInvoiceForm({...invoiceForm, paymentTerms: e.target.value as any})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
                  <select
                    value={invoiceForm.status || 'Draft'}
                    onChange={(e) => setInvoiceForm({...invoiceForm, status: e.target.value as any})}
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Items *</label>
                  <button onClick={handleAddItem} className="px-3 py-1 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-500">
                    + Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {invoiceForm.items?.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(index, 'name', e.target.value)}
                        className="flex-1 p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))}
                        className="w-20 p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={item.price}
                        onChange={(e) => handleUpdateItem(index, 'price', Number(e.target.value))}
                        className="w-32 p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                      />
                      <span className="w-24 text-right font-mono text-neutral-900 dark:text-white">
                        TZS {item.total.toLocaleString()}
                      </span>
                      <button onClick={() => handleRemoveItem(index)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
                  <span className="font-mono text-neutral-900 dark:text-white">
                    TZS {invoiceForm.items?.reduce((sum, item) => sum + item.total, 0).toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-neutral-600 dark:text-neutral-400">Tax (%)</label>
                  <input
                    type="number"
                    value={invoiceForm.tax || 0}
                    onChange={(e) => {
                      const tax = Number(e.target.value);
                      const subtotal = invoiceForm.items?.reduce((sum, item) => sum + item.total, 0) || 0;
                      setInvoiceForm({...invoiceForm, tax, total: subtotal * (1 + tax / 100) - (invoiceForm.discount || 0)});
                    }}
                    className="w-24 p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-right"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-neutral-600 dark:text-neutral-400">Discount (TZS)</label>
                  <input
                    type="number"
                    value={invoiceForm.discount || 0}
                    onChange={(e) => {
                      const discount = Number(e.target.value);
                      const subtotal = invoiceForm.items?.reduce((sum, item) => sum + item.total, 0) || 0;
                      setInvoiceForm({...invoiceForm, discount, total: subtotal * (1 + (invoiceForm.tax || 0) / 100) - discount});
                    }}
                    className="w-32 p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-right"
                  />
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span className="text-neutral-900 dark:text-white">Total</span>
                  <span className="font-mono text-neutral-900 dark:text-white">
                    TZS {invoiceForm.total.toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Notes</label>
                <textarea
                  value={invoiceForm.notes || ''}
                  onChange={(e) => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                  className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInvoice}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold"
                >
                  Save Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-2xl shadow-2xl">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Invoice {selectedInvoice.invoiceNumber}</h3>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Customer</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Due Date</p>
                  <p className="font-medium text-neutral-900 dark:text-white">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                {selectedInvoice.items.map((item, index) => (
                  <div key={index} className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">{item.name}</p>
                      <p className="text-sm text-neutral-500">{item.quantity} x TZS {item.price.toLocaleString()}</p>
                    </div>
                    <p className="font-mono text-neutral-900 dark:text-white">TZS {item.total.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
                  <span className="font-mono text-neutral-900 dark:text-white">TZS {selectedInvoice.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600 dark:text-neutral-400">Tax</span>
                  <span className="font-mono text-neutral-900 dark:text-white">{selectedInvoice.tax}%</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span className="text-neutral-900 dark:text-white">Total</span>
                  <span className="font-mono text-neutral-900 dark:text-white">TZS {selectedInvoice.total.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Template Selector */}
      {selectedInvoice && (
        <InvoiceTemplateSelector
          invoice={selectedInvoice}
          isOpen={isTemplateSelectorOpen}
          onClose={() => setIsTemplateSelectorOpen(false)}
          storeInfo={{
            name: user?.storeName,
            address: user?.storeAddress,
            phone: user?.phone,
            email: user?.email,
            logo: user?.storeLogo,
            tin: user?.tin
          }}
        />
      )}
    </div>
  );
};
