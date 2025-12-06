
import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { Plus, Search, Trash2, Edit2, Upload, FileText, Share2, Printer, RefreshCw, Filter, User, MapPin, Phone, Mail, Camera, Save, X } from 'lucide-react';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot } from 'firebase/firestore';

export const Customers: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
        const targetUid = user.employerId || user.uid;
        const q = query(collection(db, 'customers'), where('uid', '==', targetUid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCustomers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Customer)));
        }, (error) => {
            // Suppress permission-denied errors which happen when auth state is in flux
            if (error.code !== 'permission-denied') {
                console.error("Customers sync error:", error);
            }
        });
        return () => unsubscribe();
    }
  }, [user]);

  const handleSave = async () => {
    if (!formData.fullName || !formData.phone) {
        alert("Name and Phone are required.");
        return;
    }
    
    const targetUid = user?.employerId || user?.uid;
    const customerData = {
        ...formData,
        uid: targetUid,
        dateAdded: formData.dateAdded || new Date().toISOString(),
        status: formData.status || 'Active',
        openingBalance: Number(formData.openingBalance) || 0,
        type: formData.type || 'Customer'
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, 'customers', editingId), customerData);
            showNotification("Customer updated successfully", "success");
        } else {
            await addDoc(collection(db, 'customers'), customerData);
            showNotification("Customer added successfully", "success");
        }
        setView('list');
        setFormData({});
        setEditingId(null);
    } catch (e) {
        console.error(e);
        showNotification("Failed to save customer", "error");
    }
  };

  const handleDelete = async (id: string) => {
      if (confirm("Delete this customer?")) {
          try {
              await deleteDoc(doc(db, 'customers', id));
              showNotification("Customer deleted", "success");
          } catch (e) { console.error(e); }
      }
  };

  const openAdd = () => {
      setEditingId(null);
      setFormData({ type: 'Customer', status: 'Active', openingBalance: 0 });
      setView('form');
  };

  const openEdit = (c: Customer) => {
      setEditingId(c.id);
      setFormData(c);
      setView('form');
  };

  const filteredCustomers = customers.filter(c => 
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
        {view === 'list' ? (
            <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Customer Management</h2>
                        <p className="text-sm text-neutral-500">Manage relationships, suppliers, and guarantors.</p>
                    </div>
                    <div className="flex gap-2">
                         <button className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
                         <button className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700" title="Print"><Printer className="w-4 h-4" /></button>
                         <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-bold shadow-lg shadow-orange-900/20">
                            <Plus className="w-4 h-4" /> Add Customer
                         </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="Search by name or phone..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                            />
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">
                            <Filter className="w-4 h-4" /> Filter
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                                <tr>
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Contact</th>
                                    <th className="p-4">Location</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4 text-right">Balance</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {filteredCustomers.map(c => (
                                    <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                                                    {c.photo ? <img src={c.photo} className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-neutral-400" />}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-neutral-900 dark:text-white">{c.fullName}</div>
                                                    <div className="text-xs text-neutral-500">{c.occupation || 'N/A'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs">
                                            <div className="flex items-center gap-1 mb-1"><Phone className="w-3 h-3 text-neutral-400"/> {c.phone}</div>
                                            <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-neutral-400"/> {c.email || '-'}</div>
                                        </td>
                                        <td className="p-4 text-xs text-neutral-500">
                                            {c.city}, {c.district}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                                c.type === 'Supplier' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                            }`}>
                                                {c.type}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right font-mono font-medium text-neutral-900 dark:text-white">
                                            {c.openingBalance?.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => openEdit(c)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500"><Edit2 className="w-4 h-4"/></button>
                                                <button onClick={() => handleDelete(c.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>
        ) : (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6 max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6 border-b border-neutral-100 dark:border-neutral-800 pb-4">
                    <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
                    <button onClick={() => setView('list')} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Left Col: Photo & Basics */}
                    <div className="space-y-6">
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-4 border-4 border-white dark:border-neutral-700 shadow-lg relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                {formData.photo ? <img src={formData.photo} className="w-full h-full object-cover" /> : <User className="w-12 h-12 text-neutral-300 m-auto mt-8" />}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                const file = e.target.files?.[0];
                                if(file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setFormData({...formData, photo: reader.result as string});
                                    reader.readAsDataURL(file);
                                }
                            }} />
                            <div className="text-center">
                                <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Status</label>
                                <select 
                                    value={formData.status} 
                                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                                    className="p-2 border rounded-lg bg-neutral-50 dark:bg-neutral-800 text-sm dark:text-white"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Middle & Right Col: Details */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Full Name *</label>
                                <input type="text" value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Type *</label>
                                <select value={formData.type || 'Customer'} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white">
                                    <option value="Customer">Customer</option>
                                    <option value="Supplier">Supplier</option>
                                    <option value="Guarantor">Guarantor</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Phone Number *</label>
                                <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Email Address</label>
                                <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" />
                            </div>
                        </div>

                        <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                            <h4 className="text-sm font-bold mb-3 text-neutral-700 dark:text-neutral-300 flex items-center gap-2"><MapPin className="w-4 h-4"/> Location Details</h4>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <input type="text" placeholder="City / Region" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" />
                                <input type="text" placeholder="District" value={formData.district || ''} onChange={e => setFormData({...formData, district: e.target.value})} className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" />
                                <input type="text" placeholder="Ward" value={formData.ward || ''} onChange={e => setFormData({...formData, ward: e.target.value})} className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" />
                                <input type="text" placeholder="Street / Village" value={formData.street || ''} onChange={e => setFormData({...formData, street: e.target.value})} className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" />
                            </div>
                            <input type="text" placeholder="Full Residential Address / Landmarks" value={formData.residentAddress || ''} onChange={e => setFormData({...formData, residentAddress: e.target.value})} className="w-full p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Occupation</label>
                                <input type="text" value={formData.occupation || ''} onChange={e => setFormData({...formData, occupation: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-neutral-500 mb-1">Opening Balance (TZS)</label>
                                <input type="number" value={formData.openingBalance || 0} onChange={e => setFormData({...formData, openingBalance: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" />
                            </div>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <button onClick={() => setView('list')} className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">Cancel</button>
                            <button onClick={handleSave} className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> Save Customer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
