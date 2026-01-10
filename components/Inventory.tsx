
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, InventoryAdjustment, ItemGroup, ItemCategory, ItemUnit, UnitConversion, User, UserRole, Branch } from '../types';
import { Plus, Search, AlertTriangle, Filter, Save, X, Trash2, Edit2, Layers, Grid, Scale, RefreshCw, ChevronDown, Check, ArrowRightLeft, ScanBarcode, Camera, CameraOff, Upload, Store, MapPin } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled, storage } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, getDocs, getDoc } from 'firebase/firestore';
import { BulkImportModal } from './BulkImportModal';
import { useDebounce } from '../hooks/useDebounce';

export const Inventory: React.FC = () => {
  const { user, showNotification, allUsers, branches } = useAppContext();
  const [activeTab, setActiveTab] = useState<'items' | 'adjustments' | 'groups' | 'categories' | 'units' | 'conversions'>('items');
  
  // Data State
  const [items, setItems] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [units, setUnits] = useState<ItemUnit[]>([]);
  const [storeNames, setStoreNames] = useState<{ [uid: string]: string }>({});
  const [storeLocations, setStoreLocations] = useState<{ [uid: string]: string }>({});
  const [branchNames, setBranchNames] = useState<{ [branchId: string]: string }>({});
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form State
  const [editingItem, setEditingItem] = useState<Partial<Product>>({});
  const [adjustmentForm, setAdjustmentForm] = useState<Partial<InventoryAdjustment>>({ type: 'add', date: new Date().toISOString().split('T')[0] });
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  
  // Generic Form State
  const [genericForm, setGenericForm] = useState<any>({});
  const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Load branch names
  useEffect(() => {
    if (branches.length > 0) {
      const names: { [branchId: string]: string } = {};
      branches.forEach(branch => {
        names[branch.id] = branch.name;
      });
      setBranchNames(names);
    }
  }, [branches]);

  // Load store names and locations for products
  useEffect(() => {
    if (isFirebaseEnabled && db && items.length > 0) {
      const loadStoreInfo = async () => {
        const uniqueUids = [...new Set(items.map(item => item.uid))];
        const names: { [uid: string]: string } = {};
        const locations: { [uid: string]: string } = {};
        
        for (const uid of uniqueUids) {
          if (!storeNames[uid]) {
            try {
              // First try from allUsers context
              const userFromContext = allUsers.find(u => u.uid === uid);
              if (userFromContext) {
                names[uid] = userFromContext.storeName || userFromContext.name || 'Unknown Store';
                locations[uid] = userFromContext.location || '';
              } else {
                // Get user document directly by document ID (uid is the document ID in users collection)
                const userDocRef = doc(db, 'users', uid);
                const userDocSnap = await getDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                  const userData = userDocSnap.data() as User;
                  names[uid] = userData.storeName || userData.name || 'Unknown Store';
                  locations[uid] = userData.location || '';
                } else {
                  names[uid] = 'Unknown Store';
                  locations[uid] = '';
                }
              }
            } catch (error) {
              console.error('Error loading store info for uid:', uid, error);
              names[uid] = 'Unknown Store';
              locations[uid] = '';
            }
          } else {
            names[uid] = storeNames[uid];
            locations[uid] = storeLocations[uid] || '';
          }
        }
        
        if (Object.keys(names).length > 0) {
          setStoreNames(prev => ({ ...prev, ...names }));
          setStoreLocations(prev => ({ ...prev, ...locations }));
        }
      };
      
      loadStoreInfo();
    }
  }, [items.length, storeNames, allUsers]);

  // Sync Data - Show all products for admins, filtered for vendors/pharmacies
  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
        const targetUid = user.employerId || user.uid;
        const isAdmin = user.role === UserRole.ADMIN;
        
        const handleError = (error: any) => {
            if (error.code !== 'permission-denied') {
                console.error("Inventory listener error:", error);
            }
        };

        const unsubs = [
            // Load all products for admin, filtered products for vendors/pharmacies
            onSnapshot(
              isAdmin 
                ? query(collection(db, 'products')) // Admin sees all products
                : query(collection(db, 'products'), where('uid', '==', targetUid)), // Vendors see only their products
              s => {
                const products = s.docs.map(d => ({...d.data(), id: d.id} as Product));
                // For non-admin, filter to only show products from stores
                const storeProducts = isAdmin 
                  ? products.filter(p => {
                      // For admin, only show products from vendors/pharmacies
                      const productOwner = allUsers.find(u => u.uid === p.uid);
                      return productOwner && (productOwner.role === UserRole.VENDOR || productOwner.role === UserRole.PHARMACY);
                    })
                  : products.filter(p => p.uid === targetUid);
                setItems(storeProducts);
              }, 
              handleError
            ),
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
      if (!isScannerOpen || !videoRef.current) return;

      let cleanup: (() => void) | null = null;

      import('../utils/barcodeScanner').then(({ startBarcodeScanning }) => {
          startBarcodeScanning(videoRef.current!, {
              onScan: (result) => {
                  // Find item by barcode
                  const found = items.find(i => i.barcode === result.code);
                  if (found) {
                      setSearchTerm(found.name);
                      showNotification(`Scanned: ${found.name}`, 'success');
                      setIsScannerOpen(false);
                  } else {
                      showNotification(`Barcode ${result.code} not found. Add it as a new product?`, 'info');
                      setSearchTerm(result.code);
                      setIsScannerOpen(false);
                      // Optionally open add product modal with barcode pre-filled
                      setEditingItem({ barcode: result.code, status: 'Active', trackInventory: true });
                      setIsModalOpen(true);
                  }
              },
              onError: (error) => {
                  console.error("Barcode scan error:", error);
                  showNotification("Failed to scan barcode. Please try again.", "error");
              },
              continuous: false
          }).then((cleanupFn) => {
              cleanup = cleanupFn;
          });
      }).catch((error) => {
          console.error("Failed to load barcode scanner:", error);
          showNotification("Barcode scanning not available in this browser.", "error");
                  setIsScannerOpen(false);
              });

      return () => {
          if (cleanup) cleanup();
      };
  }, [isScannerOpen, items, showNotification]);

  // Simulate barcode scan for demo
  const handleScanSimulate = () => {
    // Find an item with a barcode, or use a test barcode
    const itemWithBarcode = items.find(i => i.barcode);
    const testBarcode = itemWithBarcode?.barcode || 'TEST123456';
    
    // Simulate the scan result
    const found = items.find(i => i.barcode === testBarcode);
    if (found) {
      setSearchTerm(found.name);
      showNotification(`Scanned: ${found.name}`, 'success');
      setIsScannerOpen(false);
    } else {
      showNotification(`Barcode ${testBarcode} not found. Add it as a new product?`, 'info');
      setSearchTerm(testBarcode);
      setIsScannerOpen(false);
      // Open add product modal with barcode pre-filled
      setEditingItem({ barcode: testBarcode, status: 'Active', trackInventory: true });
      setIsModalOpen(true);
    }
  };

  // Filtered items with debounced search
  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm) return items;
    const term = debouncedSearchTerm.toLowerCase();
    return items.filter(i => 
      i.name.toLowerCase().includes(term) || 
      i.barcode?.toLowerCase().includes(term)
    );
  }, [items, debouncedSearchTerm]);

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
          discountPrice: editingItem.discountPrice ? Number(editingItem.discountPrice) : undefined,
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
      if(!adjustmentForm.productId || !adjustmentForm.quantity) return;
      
      const targetUid = user?.employerId || user?.uid;
      const item = items.find(i => i.id === adjustmentForm.productId);
      const qty = Number(adjustmentForm.quantity);
      
      try {
          // 1. Record Adjustment
          await addDoc(collection(db, 'inventory_adjustments'), {
              ...adjustmentForm,
              productName: item?.name || '',
              uid: targetUid,
              quantity: qty,
              productId: adjustmentForm.productId
          });

          // 2. Update Stock
          if (item) {
             const newStock = adjustmentForm.type === 'add' ? item.stock + qty : adjustmentForm.type === 'remove' ? item.stock - qty : qty;
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
            <p className="text-sm text-neutral-500">
              {user?.role === UserRole.ADMIN 
                ? 'View all products from all vendors and pharmacies with complete details.'
                : 'Track stock, manage groups, and adjustments.'}
            </p>
        </div>
        {activeTab === 'items' && (
            <div className="flex gap-2">
                <button onClick={() => setIsAdjustmentModalOpen(true)} className="px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    Adjust Stock
                </button>
                <button 
                    onClick={() => setIsBulkImportOpen(true)} 
                    className="flex items-center gap-2 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                    <Upload className="w-4 h-4" /> Bulk Import
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
                              <th className="p-4">Product Details</th>
                              <th className="p-4">Store Name</th>
                              <th className="p-4">Branch Name</th>
                              <th className="p-4">Location</th>
                              <th className="p-4">Barcode</th>
                              <th className="p-4">Category</th>
                              <th className="p-4">Unit</th>
                              <th className="p-4 text-right">Cost (Buying)</th>
                              <th className="p-4 text-right">Selling Price</th>
                              <th className="p-4 text-right">Discount Price</th>
                              <th className="p-4 text-center">Stock</th>
                              <th className="p-4">Status</th>
                              <th className="p-4 text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                          {filteredItems.map(item => {
                            const productBranch = item.branchId ? branches.find(b => b.id === item.branchId) : null;
                            return (
                              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                  <td className="p-4">
                                    <div className="flex items-start gap-3">
                                      {item.image && (
                                        <img 
                                          src={item.image} 
                                          alt={item.name}
                                          className="w-12 h-12 rounded-lg object-cover bg-neutral-100 dark:bg-neutral-800 flex-shrink-0"
                                          onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-neutral-900 dark:text-white mb-1">{item.name}</p>
                                        {item.description && (
                                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                                            {item.description}
                                          </p>
                                        )}
                                        {item.expiryDate && (
                                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                            Exp: {new Date(item.expiryDate).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <div className="flex items-center gap-2">
                                      <Store className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                                        {storeNames[item.uid] || 'Loading...'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    {productBranch ? (
                                      <span className="text-sm text-neutral-700 dark:text-neutral-300">
                                        {productBranch.name}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-neutral-400 dark:text-neutral-600">—</span>
                                    )}
                                  </td>
                                  <td className="p-4">
                                    {storeLocations[item.uid] ? (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                                        <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                          {storeLocations[item.uid]}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-neutral-400 dark:text-neutral-600">—</span>
                                    )}
                                  </td>
                                  <td className="p-4 font-mono text-xs text-neutral-500">{item.barcode || '-'}</td>
                                  <td className="p-4 text-xs text-neutral-500">
                                      {categories.find(c => c.id === item.categoryId)?.name || item.category || '-'}
                                  </td>
                                  <td className="p-4 text-xs text-neutral-500">
                                      {item.unit || '-'}
                                  </td>
                                  <td className="p-4 text-right">{item.buyingPrice?.toLocaleString() || 0}</td>
                                  <td className="p-4 text-right font-bold">
                                    {item.discountPrice ? `TZS ${item.price.toLocaleString()}` : `TZS ${item.price.toLocaleString()}`}
                                  </td>
                                  <td className="p-4 text-right">
                                    {item.discountPrice ? (
                                      <div className="flex flex-col items-end">
                                        <span className="text-xs line-through text-neutral-400">TZS {item.price.toLocaleString()}</span>
                                        <span className="text-orange-600 font-bold">TZS {item.discountPrice.toLocaleString()}</span>
                                      </div>
                                    ) : (
                                      <span className="text-neutral-500 dark:text-neutral-400">—</span>
                                    )}
                                  </td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${item.stock < 10 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{item.stock}</span>
                                  </td>
                                  <td className="p-4"><span className="text-xs bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">{item.status}</span></td>
                                  <td className="p-4 text-right">
                                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-blue-500"><Edit2 className="w-4 h-4"/></button>
                                      <button onClick={() => deleteRecord('products', item.id)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded text-red-500"><Trash2 className="w-4 h-4"/></button>
                                  </td>
                              </tr>
                            );
                          })}
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
                               <td className="p-4 font-medium">{adj.productName}</td>
                               <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${adj.type === 'add' ? 'bg-green-100 text-green-600' : adj.type === 'remove' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>{adj.type.charAt(0).toUpperCase() + adj.type.slice(1)}</span></td>
                               <td className="p-4 font-mono">{adj.quantity}</td>
                               <td className="p-4 text-neutral-500">{adj.reason || '-'}</td>
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
          <div className="fixed inset-0 bg-black/70  flex items-start justify-center p-4 pt-24 sm:pt-20 md:pt-12 lg:pt-8 z-[2147483000]">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-neutral-200 dark:border-neutral-800 overflow-hidden modal-content">
                  <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{editingItem.id ? 'Edit Item' : 'Add New Item'}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-neutral-400"/></button>
                  </div>
                  <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                          <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-orange-500">
                              {editingItem.image ? <img src={editingItem.image} className="w-full h-full object-cover rounded-lg" /> : <div className="text-center"><div className="text-xs text-neutral-500">{isUploadingImage ? 'Uploading...' : 'Upload'}</div></div>}
                              <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (!file.type.startsWith('image/')) {
                                    showNotification('Please select an image file.', 'error');
                                    return;
                                  }
                                  try {
                                    setIsUploadingImage(true);
                                    if (!storage || !user?.uid) {
                                      showNotification('Storage not available.', 'error');
                                      setIsUploadingImage(false);
                                      return;
                                    }
                                    
                                    // Validate file size (5MB limit)
                                    if (file.size > 5 * 1024 * 1024) {
                                      showNotification('Image size must be less than 5MB.', 'error');
                                      setIsUploadingImage(false);
                                      return;
                                    }
                                    
                                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                                    const targetUid = user.employerId || user.uid;
                                    // Sanitize filename and create path
                                    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                                    const path = `Items/${targetUid}/${Date.now()}_${sanitizedFileName}`;
                                    const storageRef = ref(storage, path);
                                    
                                    // Upload with metadata - ensure contentType is set
                                    const metadata = {
                                      contentType: file.type || 'image/jpeg',
                                      customMetadata: {
                                        uploadedBy: user.uid,
                                        uploadedAt: new Date().toISOString()
                                      }
                                    };
                                    
                                    await uploadBytes(storageRef, file, metadata);
                                    
                                    const url = await getDownloadURL(storageRef);
                                    setEditingItem({ ...editingItem, image: url });
                                    showNotification('Item image uploaded successfully.', 'success');
                                  } catch (err: any) {
                                    console.error('Item image upload error:', err);
                                    const errorMessage = err?.message || 'Unknown error';
                                    if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
                                      showNotification('Permission denied. Please check your storage rules.', 'error');
                                    } else if (errorMessage.includes('size') || errorMessage.includes('quota')) {
                                      showNotification('File too large. Maximum size is 5MB.', 'error');
                                    } else {
                                      showNotification(`Failed to upload image: ${errorMessage}`, 'error');
                                    }
                                  } finally {
                                    setIsUploadingImage(false);
                                  }
                                }}
                              />
                          </div>
                          <div className="flex-1 space-y-3">
                              <input type="text" placeholder="Item Name *" value={editingItem.name || ''} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                              <textarea placeholder="Description" value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white h-14 resize-none" />
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                               <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Group (Optional)</label>
                               <select value={(editingItem as any).groupId || ''} onChange={e => setEditingItem({...editingItem, [e.target.name || 'groupId']: e.target.value} as any)} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" name="groupId">
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
                              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Discount Price</label>
                              <input type="number" value={editingItem.discountPrice || ''} onChange={e => setEditingItem({...editingItem, discountPrice: Number(e.target.value) || undefined})} className="w-full p-2 border rounded dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                              <p className="text-[11px] text-neutral-500 mt-1">If set, the selling price will be shown struck-through and this value will be the final price.</p>
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
                                   <button onClick={() => setIsScannerOpen(true)} className="p-2 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200" title="Scan Barcode"><ScanBarcode className="w-4 h-4"/></button>
                                   {editingItem.barcode && (
                                     <button 
                                       onClick={async () => {
                                         try {
                                           const { generateProductBarcode, downloadBarcode } = await import('../utils/barcodeGenerator');
                                           const barcode = generateProductBarcode(editingItem.barcode!);
                                           downloadBarcode(editingItem.barcode!, `barcode-${editingItem.name || editingItem.barcode}.png`);
                                           showNotification('Barcode generated and downloaded', 'success');
                                         } catch (error: any) {
                                           showNotification('Failed to generate barcode', 'error');
                                         }
                                       }}
                                       className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded hover:bg-orange-200 dark:hover:bg-orange-900/30" 
                                       title="Generate & Download Barcode"
                                     >
                                       <Upload className="w-4 h-4 text-orange-600 dark:text-orange-400"/>
                                     </button>
                                   )}
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
          <div className="fixed inset-0 bg-black/70  flex items-start justify-center p-4 pt-24 sm:pt-20 md:pt-12 lg:pt-8 z-[2147483000]">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-xl p-6 border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-auto modal-content">
                  <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white">Inventory Adjustment</h3>
                  <div className="space-y-4">
                      <select value={adjustmentForm.productId || ''} onChange={e => setAdjustmentForm({...adjustmentForm, productId: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                          <option value="">Select Item</option>
                          {items.map(i => <option key={i.id} value={i.id}>{i.name} (Cur: {i.stock})</option>)}
                      </select>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2"><input type="radio" checked={adjustmentForm.type === 'add'} onChange={() => setAdjustmentForm({...adjustmentForm, type: 'add'})} /> Add</label>
                          <label className="flex items-center gap-2"><input type="radio" checked={adjustmentForm.type === 'remove'} onChange={() => setAdjustmentForm({...adjustmentForm, type: 'remove'})} /> Remove</label>
                          <label className="flex items-center gap-2"><input type="radio" checked={adjustmentForm.type === 'set'} onChange={() => setAdjustmentForm({...adjustmentForm, type: 'set'})} /> Set</label>
                      </div>
                      <input type="number" placeholder="Quantity" value={adjustmentForm.quantity || ''} onChange={e => setAdjustmentForm({...adjustmentForm, quantity: Number(e.target.value)})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                      <input type="date" value={adjustmentForm.date} onChange={e => setAdjustmentForm({...adjustmentForm, date: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" />
                      <textarea placeholder="Reason" value={adjustmentForm.reason || ''} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white h-20" />
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
          <div className="fixed inset-0 bg-black/70  flex items-start justify-center p-4 pt-24 sm:pt-20 md:pt-12 lg:pt-8 z-[2147483000]">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-sm rounded-2xl shadow-xl p-6 border border-neutral-200 dark:border-neutral-800 max-h-[90vh] overflow-auto modal-content">
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
          <div className="fixed inset-0 bg-black/80 z-[2147483000] flex flex-col">
              <div className="flex justify-between items-center p-4 text-white bg-black/70 absolute top-0 w-full z-10">
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

      {/* Bulk Import Modal */}
      {isBulkImportOpen && user && (
        <BulkImportModal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          uid={user.employerId || user.uid}
          onSuccess={() => {
            showNotification("Products imported successfully", "success");
            setIsBulkImportOpen(false);
          }}
        />
      )}
    </div>
  );
};
