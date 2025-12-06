import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Supplier, UserRole } from '../types';
import { Plus, Search, FileText, CheckCircle, XCircle, Truck, User, Calendar, DollarSign, BrainCircuit, Loader2 } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment } from 'firebase/firestore';
import { chatWithGemini } from '../services/geminiService';

export const PurchaseOrders: React.FC = () => {
  const { user, products, showNotification } = useAppContext();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // New PO State
  const [newPO, setNewPO] = useState<Partial<PurchaseOrder>>({
    items: [],
    status: 'Draft',
    totalCost: 0
  });
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  
  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
        const targetUid = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
        
        const handleError = (e: any) => {
             if (e.code !== 'permission-denied') {
                 console.error("PurchaseOrder sync error:", e);
             }
        };

        // Fetch POs
        const unsubPOs = onSnapshot(
            query(collection(db, 'purchase_orders'), where('uid', '==', targetUid)),
            (snapshot) => setPurchaseOrders(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PurchaseOrder))),
            handleError
        );

        // Fetch Suppliers
        const unsubSuppliers = onSnapshot(
            query(collection(db, 'suppliers'), where('uid', '==', targetUid)),
            (snapshot) => setSuppliers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Supplier))),
            handleError
        );

        return () => { unsubPOs(); unsubSuppliers(); };
    }
  }, [isFirebaseEnabled, user]);

  const handleCreatePO = async () => {
      if (!selectedSupplierId || !newPO.items?.length) return;
      
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      const targetUid = user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY ? user?.uid : user?.employerId;

      const poData = {
          ...newPO,
          uid: targetUid,
          supplierId: selectedSupplierId,
          supplierName: supplier?.name || 'Unknown Supplier',
          dateIssued: new Date().toISOString(),
          status: 'Ordered',
          totalCost: newPO.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0)
      };

      if (isFirebaseEnabled && db) {
          try {
              await addDoc(collection(db, 'purchase_orders'), poData);
              showNotification("Purchase Order Created", "success");
              setView('list');
              setNewPO({ items: [], status: 'Draft', totalCost: 0 });
          } catch (e) {
              console.error(e);
              showNotification("Failed to create PO", "error");
          }
      }
  };

  const handleReceivePO = async (po: PurchaseOrder) => {
      if (confirm("Mark items as received and update inventory?")) {
          if (isFirebaseEnabled && db) {
              try {
                  // 1. Update PO Status
                  await updateDoc(doc(db, 'purchase_orders', po.id), { status: 'Received' });
                  
                  // 2. Update Product Stock
                  for (const item of po.items) {
                      const product = products.find(p => p.name === item.name);
                      if (product) {
                          await updateDoc(doc(db, 'products', product.id), {
                              stock: increment(item.quantity)
                          });
                      }
                  }
                  showNotification("Inventory Updated!", "success");
              } catch(e) {
                  showNotification("Error updating inventory", "error");
              }
          }
      }
  };

  const generateAiSuggestion = async () => {
      setIsAiLoading(true);
      try {
          const lowStock = products.filter(p => p.stock < 10).map(p => `${p.name} (Current: ${p.stock})`).join(', ');
          const prompt = `Based on these low stock items: [${lowStock}], suggest a purchase order list. Return ONLY a JSON array like [{"name": "Item", "quantity": 50, "cost": 1000}]`;
          
          const result = await chatWithGemini(prompt, [], true); // Enable thinking mode
          const jsonStr = result.text?.replace(/```json/g, '').replace(/```/g, '').trim();
          if (jsonStr) {
              const items = JSON.parse(jsonStr);
              setNewPO({ ...newPO, items });
          }
      } catch (e) {
          console.error(e);
          showNotification("AI Generation Failed", "error");
      } finally {
          setIsAiLoading(false);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Procurement</h2>
            <p className="text-sm text-neutral-500">Manage suppliers and purchase orders.</p>
        </div>
        {view === 'list' && (
            <button onClick={() => setView('create')} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-500">
                <Plus className="w-4 h-4" /> Create PO
            </button>
        )}
      </div>

      {view === 'create' ? (
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 max-w-3xl mx-auto">
              <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-white">New Purchase Order</h3>
              
              {/* AI Assistant */}
              <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl mb-6 border border-purple-100 dark:border-purple-800">
                  <div className="flex justify-between items-center">
                      <div>
                          <h4 className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                              <BrainCircuit className="w-4 h-4" /> AI Auto-Draft
                          </h4>
                          <p className="text-xs text-purple-700 dark:text-purple-400">Auto-fill based on low stock alerts.</p>
                      </div>
                      <button onClick={generateAiSuggestion} disabled={isAiLoading} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-500 flex items-center gap-2">
                          {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <BrainCircuit className="w-3 h-3" />}
                          Generate
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                  <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Supplier</label>
                      <select 
                        className="w-full p-2.5 border rounded-lg bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                        value={selectedSupplierId}
                        onChange={e => setSelectedSupplierId(e.target.value)}
                      >
                          <option value="">Select Supplier</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          {/* Fallback for demo */}
                          <option value="sup_1">Global Pharma Distributors</option>
                          <option value="sup_2">Dar Tech Supplies</option>
                      </select>
                  </div>

                  <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Items</label>
                      <div className="space-y-2">
                          {newPO.items?.map((item, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                  <input type="text" value={item.name} readOnly className="flex-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded border-none text-sm dark:text-white" />
                                  <input type="number" value={item.quantity} className="w-20 p-2 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded text-sm dark:text-white" />
                                  <input type="number" value={item.cost} className="w-24 p-2 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded text-sm dark:text-white" />
                                  <button onClick={() => setNewPO({...newPO, items: newPO.items?.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded"><XCircle className="w-4 h-4"/></button>
                              </div>
                          ))}
                          <button 
                            onClick={() => setNewPO({...newPO, items: [...(newPO.items || []), { name: '', quantity: 1, cost: 0 }]})}
                            className="text-xs text-orange-600 font-bold hover:underline"
                          >
                              + Add Line Item manually
                          </button>
                      </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                      <button onClick={() => setView('list')} className="flex-1 py-3 border rounded-lg text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">Cancel</button>
                      <button onClick={handleCreatePO} className="flex-1 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-bold hover:opacity-90">Create Order</button>
                  </div>
              </div>
          </div>
      ) : (
          <div className="grid gap-4">
              {purchaseOrders.length === 0 ? (
                  <div className="text-center py-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-400">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No Purchase Orders found.</p>
                  </div>
              ) : (
                  purchaseOrders.map(po => (
                      <div key={po.id} className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-xs text-neutral-500">#{po.id.substring(0, 6)}</span>
                                  <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${
                                      po.status === 'Received' ? 'bg-green-100 text-green-700' : 
                                      po.status === 'Ordered' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'
                                  }`}>
                                      {po.status}
                                  </span>
                              </div>
                              <h4 className="font-bold text-neutral-900 dark:text-white">{po.supplierName}</h4>
                              <p className="text-xs text-neutral-500">{new Date(po.dateIssued).toLocaleDateString()} • {po.items.length} Items</p>
                          </div>
                          
                          <div className="flex items-center gap-6">
                              <div className="text-right">
                                  <span className="block text-xs text-neutral-500 uppercase">Total Cost</span>
                                  <span className="font-bold text-neutral-900 dark:text-white">TZS {po.totalCost.toLocaleString()}</span>
                              </div>
                              {po.status === 'Ordered' && (
                                  <button 
                                    onClick={() => handleReceivePO(po)}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500 flex items-center gap-2"
                                  >
                                      <Truck className="w-4 h-4" /> Receive
                                  </button>
                              )}
                          </div>
                      </div>
                  ))
              )}
          </div>
      )}
    </div>
  );
};