
import React, { useState, useEffect, useRef } from 'react';
import { Product, InventoryAdjustment, ItemGroup, ItemCategory, ItemUnit, UnitConversion } from '../types';
import { Plus, Search, AlertTriangle, Filter, Save, X, Trash2, Edit2, Layers, Grid, Scale, RefreshCw, ChevronDown, Check, ArrowRightLeft, ScanBarcode, Camera, CameraOff } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';

export const Inventory: React.FC = () => {
  const { user, showNotification } = useAppContext();
  const [activeTab, setActiveTab] = useState<'items' | 'adjustments' | 'groups' | 'categories' | 'units' | 'conversions'>('items');
  
  // Data State
  const [items, setItems] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [units, setUnits] = useState<ItemUnit[]>([]);
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form State
  const [editingItem, setEditingItem] = useState<Partial<Product>>({});
  const [adjustmentForm, setAdjustmentForm] = useState<Partial<InventoryAdjustment>>({ type: 'Add', date: new Date().toISOString().split('T')[0] });
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  
  // Generic Form State
  const [genericForm, setGenericForm] = useState<any>({});
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync Data
  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
        const targetUid = user.employerId || user.uid;
        
        const handleError = (error: any) => {
            if (error.code !== 'permission-denied') {
                console.error("Inventory listener error:", error);
            }
        };

        const unsubs = [
            onSnapshot(query(collection(db, 'products'), where('uid', '==', targetUid)), s => setItems(s.docs.map(d => ({...d.data(), id: d.id} as Product))), handleError),
            // FIX: Removed orderBy('date', 'desc') to avoid missing index error. Sorting client-side instead.
            onSnapshot(query(collection(db, 'inventory_adjustments'), where('uid', '==', targetUid)), s => {
                const data = s.docs.map(d => ({...d.data(), id: d.id} as InventoryAdjustment));
                data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                setAdjustments(data);
            }, handleError),
            onSnapshot(query(collection(db, 'item_groups'), where('uid', '==', targetUid)), s => setGroups(s.docs.map(d => ({...d.data(), id: d.id} as ItemGroup))), handleError),
            onSnapshot(query(collection(db, 'item_categories'), where('uid', '==', targetUid)), s => setCategories(s.docs.map(d => ({...d.data(), id: d.id} as ItemCategory))), handleError),
            onSnapshot(query(collection(db, 'item_units'), where('uid', '==', targetUid)), s => setUnits(s.docs.map(d => ({...d.data(), id: d.id} as ItemUnit))), handleError),
        ];
        return () => unsubs.forEach(u => u());
    }
  }, [user]);

  // --- Scanner Logic ---
  useEffect(() => {
      let stream: MediaStream | null = null;
      if (isScannerOpen) {
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
              .then(s => {
                  stream = s;
                  if (videoRef.current) {
                      videoRef.current.srcObject = stream;
                      videoRef.current.play();
                  }
              })
              .catch(err => {
                  console.error("Camera error:", err);
                  alert("Cannot access camera for scanning.");
                  setIsScannerOpen(false);
              });
      }
      return () => {
          if (stream) stream.getTracks().forEach(t => t.stop());
      };
  }, [isScannerOpen]);

  const handleScanSimulate = () => {
      // In a real app, a barcode detection library (like QuaggaJS) would go here.
      // For this full-stack demo, we simulate a scan after 2 seconds of "camera" view.
      setTimeout(() => {
          const mockBarcode = "123456789"; 
          // Find item or set term
          const found = items.find(i => i.barcode === mockBarcode);
          if (found) {
              setSearchTerm(found.name);
              showNotification(`Scanned: ${found.name}`, 'success');
          } else {
              showNotification(`Barcode ${mockBarcode} not found`, 'info');
              setSearchTerm(mockBarcode); // Pre-fill search/add
          }
          setIsScannerOpen(false);
      }, 2000);
  };

  // --- Handlers ---

  const handleSaveItem = async () => {
      if(!editingItem.name || !editingItem.price) return alert("Name and Selling Price required");
      
      const targetUid = user?.employerId || user?.uid;
      
      // Resolve Category Name: Prefer linked category name, fallback to string, empty if neither
      const selectedCat = categories.find(c => c.id === editingItem.categoryId);
      const categoryName = selectedCat ? selectedCat.name : (editingItem.category || '');

      const data = { 
          ...editingItem, 
          uid: targetUid, 
          status: editingItem.status || 'Active',
          stock: Number(editingItem.stock) || 0,
          price: Number(editingItem.price) || 0,
          buyingPrice: Number(editingItem.buyingPrice) || 0,
          trackInventory: editingItem.trackInventory ?? true,
          category: categoryName,
          unit: editingItem.unit || ''
      };

      try {
          if (editingItem.id) {
              await updateDoc(doc(db, 'products', editingItem.id), data);
              showNotification("Item updated", "success");
          } else {
              await addDoc(collection(db, 'products'), { ...data, createdAt: new Date().toISOString() });
              showNotification("Item added", "success");
          }
          setIsModalOpen(false);
      } catch (e) { console.error(e); }
  };

  const handleSaveAdjustment = async () => {
      if(!adjustmentForm.itemId || !adjustmentForm.quantity) return;
      
      const targetUid = user?.employerId || user?.uid;
      const item = items.find(i => i.id === adjustmentForm.itemId);
      const qty = Number(adjustmentForm.quantity);
      
      try {
          // 1. Record Adjustment
          await addDoc(collection(db, 'inventory_adjustments'), {
              ...adjustmentForm,
              itemName: item?.name,
              uid: targetUid,
              quantity: qty
          });

          // 2. Update Stock
          if (item) {
             const newStock = adjustmentForm.type === 'Add' ? item.stock + qty : item.stock - qty;
             await updateDoc(doc(db, 'products', item.id), { stock: Math.max(0, newStock) });
          }
          
          showNotification("Adjustment recorded", "success");
          setIsAdjustmentModalOpen(false);
      } catch (e) { console.error(e); }
  };

  const handleGenericSave = async (collectionName: string) => {
      if (!genericForm.name) return;
      const targetUid = user?.employerId || user?.uid;
      try {
          if (genericForm.id) {
              await updateDoc(doc(db, collectionName, genericForm.id), genericForm);
          } else {
              await addDoc(collection(db, collectionName), { ...genericForm, uid: targetUid, status: 'Active' });
          }
          setIsGenericModalOpen(false);
          showNotification("Saved successfully", "success");
      } catch (e) { console.error(e); }
  };

  const deleteRecord = async (collectionName: string, id: string) => {
      if(confirm("Delete this record?")) {
          await deleteDoc(doc(db, collectionName, id));
          showNotification("Deleted", "info");
      }
  };

  // --- Render Helpers ---

  const renderTabs = () => (
      <div className="flex overflow-x-auto border-b border-neutral-200 dark:border-neutral-800 mb-6 gap-6">
          {[
              { id: 'items', label: 'Items', icon: <Layers className="w-4 h-4"/> },
              { id: 'adjustments', label: 'Adjustments', icon: <ArrowRightLeft className="w-4 h-4"/> },
              { id: 'groups', label: 'Groups', icon: <Grid className="w-4 h-4"/> },
              { id: 'categories', label: 'Categories', icon: <Filter className="w-4 h-4"/> },
              { id: 'units', label: 'Units', icon: <Scale className="w-4 h-4"/> },
          ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}
              >
                  {tab.icon} {tab.label}
              </button>
          ))}
      </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Inventory Management</h2>
            <p className="text-sm text-neutral-500">Track stock, manage groups, and adjustments.</p>
        </div>
        {activeTab === 'items' && (
            <div className="flex gap-2">
                <button onClick={() => setIsAdjustmentModalOpen(true)} className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    Adjust Stock
                </button>
                <button onClick={() => { setEditingItem({ status: 'Active', trackInventory: true }); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-bold shadow-lg shadow-orange-900/20">
                    <Plus className="w-4 h-4" /> Add Item
                </button>
            </div>
        )}
        {['groups', 'categories', 'units'].includes(activeTab) && (
            <button onClick={() => { setGenericForm({}); setIsGenericModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-bold">
                <Plus className="w-4 h-4" /> Add New
            </button>
        )}
      </div>

      {renderTabs()}

      {/* ITEMS TAB */}
      {activeTab === 'items' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex gap-4">
                  <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                      <input type="text" placeholder="Search items or scan barcode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2 border rounded-lg bg-neutral-50 dark:bg-neutral-950 text-sm outline-none dark:border-neutral-700 dark:text-white" />
                  </div>
                  <button onClick={() => setIsScannerOpen(true)} className="px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300" title="Scan Barcode">
                      <ScanBarcode className="w-5 h-5" />
                  </button>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                          <tr>
                              <th className="p-4">Item Name</th>
                              <th className="p-4">Barcode</th>
                              <th className="p-4">Category</th>
                              <th className="p-4">Unit</th>
                              <th className="p-4 text-right">Cost</th>
                              <th className="p-4 text-right">Selling Price</th>
                              <th className="p-4 text-center">Stock</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.barcode?.includes(searchTerm)).map(item => (
                              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                  <td className="p-4 font-medium text-neutral-900 dark:text-white">{item.name}</td>
                                  <td className="p-4 font-mono text-xs text-neutral-500">{item.barcode || '-'}</td>
                                  <td className="p-4 text-xs text-neutral-500">
                                      {categories.find(c => c.id === item.categoryId)?.name || item.category || '-'}
                                  </td>
                                  <td className="p-4 text-xs text-neutral-500">
                                      {item.unit || '-'}
                                  </td>
                                  <td className="p-4 text-right">{item.buyingPrice?.toLocaleString() || 0}</td>
                                  <td className="p-4 text-right font-bold">{item.price.toLocaleString()}</td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{item.stock}</span>
                                  </td>
                                  <td className="p-4"><span className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">{item.status}</span></td>
                                  <td className="p-4 text-right">
                                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500"><Edit2 className="w-4 h-4"/></button>
                                      <button onClick={() => deleteRecord('products', item.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500"><Trash2 className="w-4 h-4"/></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ADJUSTMENTS TAB */}
      {activeTab === 'adjustments' && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
               <table className="w-full text-left text-sm">
                   <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                       <tr><th className="p-4">Date</th><th className="p-4">Item</th><th className="p-4">Type</th><th className="p-4">Quantity</th><th className="p-4">Description</th></tr>
                   </thead>
                   <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                       {adjustments.map(adj => (
                           <tr key={adj.id}>
                               <td className="p-4">{adj.date}</td>
                               <td className="p-4 font-medium">{adj.itemName}</td>
                               <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${adj.type === 'Add' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{adj.type}</span></td>
                               <td className="p-4 font-mono">{adj.quantity}</td>
                               <td className="p-4 text-neutral-500">{adj.description}</td>
                           </tr>
                       ))}
                   </tbody>
               </table>
          </div>
      )}

      {/* GENERIC TABS (Groups, Categories, Units) */}
      {['groups', 'categories', 'units'].includes(activeTab) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(activeTab === 'groups' ? groups : activeTab === 'categories' ? categories : units).map((item: any) => (
                  <div key={item.id} className="bg-white dark:bg-neutral-900 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm flex justify-between items-center">
                      <div>
                          <h4 className="font-bold text-neutral-900 dark:text-white">{item.name}</h4>
                          <p className="text-xs text-neutral-500">{item.description}</p>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => { setGenericForm(item); setIsGenericModalOpen(true); }} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => deleteRecord(`item_${activeTab}`, item.id)} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500"><Trash2 className="w-4 h-4"/></button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* ADD ITEM MODAL */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 dark:border-neutral-800">
                  <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{editingItem.id ? 'Edit Item' : 'Add New Item'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-neutral-400"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                      <div className="flex gap-4">
                          <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-orange-500">
                              {editingItem.image ? <img src={editingItem.image} className="w-full h-full object-cover rounded-lg" /> : <div className="text-center"><div className="text-xs text-neutral-500">Upload</div></div>}
                              <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if(file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => setEditingItem({...editingItem, image: reader.result as string});
                                      reader.readAsDataURL(file);
                                  }
                              }} />
                          </div>
                          <div className="flex-1 space-y-3">
                              <input type="text" placeholder="Item Name *" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                              <textarea placeholder="Description" value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white h-14 resize-none" />
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Group</label>
                               <select value={editingItem.groupId || ''} onChange={e => setEditingItem({...editingItem, groupId: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                                   <option value="">Select Group</option>
                                   {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Category</label>
                               <select value={editingItem.categoryId || ''} onChange={e => setEditingItem({...editingItem, categoryId: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                                   <option value="">Select Category</option>
                                   {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Selling Price *</label>
                               <input type="number" value={editingItem.price || ''} onChange={e => setEditingItem({...editingItem, price: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Buying Price</label>
                               <input type="number" value={editingItem.buyingPrice || ''} onChange={e => setEditingItem({...editingItem, buyingPrice: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Opening Stock</label>
                               <input type="number" value={editingItem.stock || ''} onChange={e => setEditingItem({...editingItem, stock: Number(e.target.value)})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Unit</label>
                               <select value={editingItem.unit || ''} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                                   <option value="">Select Unit</option>
                                   {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Barcode</label>
                               <div className="flex gap-2">
                                   <input type="text" placeholder="Scan or Type" value={editingItem.barcode || ''} onChange={e => setEditingItem({...editingItem, barcode: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                                   <button onClick={() => setIsScannerOpen(true)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200"><ScanBarcode className="w-4 h-4"/></button>
                               </div>
                           </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <input type="checkbox" checked={editingItem.trackInventory ?? true} onChange={e => setEditingItem({...editingItem, trackInventory: e.target.checked})} className="w-4 h-4" />
                          <span className="text-sm dark:text-white">Track Inventory for this item</span>
                      </div>
                  </div>
                  <div className="p-5 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-3">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800">Cancel</button>
                      <button onClick={handleSaveItem} className="px-4 py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-500">Save Item</button>
                  </div>
              </div>
          </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-xl p-6 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white">Inventory Adjustment</h3>
                  <div className="space-y-4">
                      <select value={adjustmentForm.itemId || ''} onChange={e => setAdjustmentForm({...adjustmentForm, itemId: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                          <option value="">Select Item</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name} (Cur: {i.stock})</option>)}
                      </select>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2"><input type="radio" checked={adjustmentForm.type === 'Add'} onChange={() => setAdjustmentForm({...adjustmentForm, type: 'Add'})} /> Add</label>
                          <label className="flex items-center gap-2"><input type="radio" checked={adjustmentForm.type === 'Remove'} onChange={() => setAdjustmentForm({...adjustmentForm, type: 'Remove'})} /> Remove</label>
                      </div>
                      <input type="number" placeholder="Quantity" value={adjustmentForm.quantity || ''} onChange={e => setAdjustmentForm({...adjustmentForm, quantity: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                      <input type="date" value={adjustmentForm.date} onChange={e => setAdjustmentForm({...adjustmentForm, date: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                      <textarea placeholder="Reason" value={adjustmentForm.description || ''} onChange={e => setAdjustmentForm({...adjustmentForm, description: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white h-20" />
                      <div className="flex gap-3">
                          <button onClick={() => setIsAdjustmentModalOpen(false)} className="flex-1 py-2 border rounded-lg dark:border-neutral-700">Cancel</button>
                          <button onClick={handleSaveAdjustment} className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-bold">Save</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* GENERIC MODAL (Group/Cat/Unit) */}
      {isGenericModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-xl p-6 border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-bold text-lg mb-4 capitalize text-neutral-900 dark:text-white">Add/Edit {activeTab.slice(0, -1)}</h3>
                  <div className="space-y-4">
                      <input type="text" placeholder="Name" value={genericForm.name || ''} onChange={e => setGenericForm({...genericForm, name: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                      <textarea placeholder="Description" value={genericForm.description || ''} onChange={e => setGenericForm({...genericForm, description: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white h-20" />
                      <div className="flex gap-3">
                          <button onClick={() => setIsGenericModalOpen(false)} className="flex-1 py-2 border rounded-lg dark:border-neutral-700">Cancel</button>
                          <button onClick={() => handleGenericSave(`item_${activeTab}`)} className="flex-1 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-bold">Save</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SCANNER OVERLAY */}
      {isScannerOpen && (
          <div className="fixed inset-0 bg-black z-[100] flex flex-col">
              <div className="flex justify-between items-center p-4 text-white bg-black/50 absolute top-0 w-full z-10">
                  <h3 className="font-bold flex items-center gap-2"><ScanBarcode /> Scanner</h3>
                  <button onClick={() => setIsScannerOpen(false)}><X className="w-6 h-6"/></button>
              </div>
              <div className="flex-1 relative flex items-center justify-center bg-black">
                  <video ref={videoRef} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 border-[50px] border-black/50 flex items-center justify-center">
                      <div className="w-64 h-40 border-2 border-red-500 relative">
                          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-red-500 -mt-1 -ml-1"></div>
                          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-red-500 -mt-1 -mr-1"></div>
                          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-red-500 -mb-1 -ml-1"></div>
                          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-red-500 -mb-1 -mr-1"></div>
                      </div>
                  </div>
                  {/* Simulate Scan Button for Demo */}
                  <button onClick={handleScanSimulate} className="absolute bottom-20 px-6 py-3 bg-red-600 text-white rounded-full font-bold shadow-lg animate-bounce">
                      Simulate Capture
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
