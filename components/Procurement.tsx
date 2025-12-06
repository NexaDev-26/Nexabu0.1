import React, { useState, useEffect, useRef } from 'react';
import { WholesaleOrder, CreditApplication, WholesaleItem, PurchaseOrder, Supplier, UserRole, Product } from '../types';
import { Plus, Search, FileText, CheckCircle, XCircle, Truck, User, Calendar, DollarSign, BrainCircuit, Loader2, Package, Wallet, Upload, Download, Database, ShoppingCart, CreditCard, X } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, writeBatch, orderBy } from 'firebase/firestore';
import { chatWithGemini } from '../services/geminiService';

const MOCK_WHOLESALE_ITEMS: WholesaleItem[] = [
    { id: 'w1', name: 'Azam Cola 500ml', supplier: 'Bakhresa Group', price: 12000, moq: 5, unit: 'Crate (24 btls)', category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80', discount: 10 },
    { id: 'w2', name: 'Mo Sabuni (Soap)', supplier: 'MeTL Group', price: 25000, moq: 1, unit: 'Carton (50 pcs)', category: 'Personal Care', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=300&q=80' },
    { id: 'w3', name: 'Azania Sembe', supplier: 'Azania', price: 18000, moq: 2, unit: 'Bale (10kg x 10)', category: 'Food & Grains', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=300&q=80' },
    { id: 'w4', name: 'Kilimanjaro Water', supplier: 'Bonite Bottlers', price: 8000, moq: 10, unit: 'Crate (12 btls)', category: 'Beverages', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=300&q=80' },
    { id: 'w5', name: 'Panadol Extra', supplier: 'Shelys Pharma', price: 45000, moq: 1, unit: 'Box (100 strips)', category: 'Medicine', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80' },
];

export const Procurement: React.FC = () => {
    const { user, setUser, showNotification, products } = useAppContext();
    const [activeTab, setActiveTab] = useState<'ghala' | 'suppliers' | 'upload'>('ghala');
    
    // Ghala State
    const [wholesaleItems, setWholesaleItems] = useState<WholesaleItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState<{ item: WholesaleItem; quantity: number }[]>([]);
    const [isSeeding, setIsSeeding] = useState(false);
    const [creditLimit, setCreditLimit] = useState(user?.creditLimit || 0);
    const [creditScore, setCreditScore] = useState(user?.creditScore || 0);
    const [orders, setOrders] = useState<WholesaleOrder[]>([]);
    const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
    const [creditForm, setCreditForm] = useState({ businessName: user?.storeName || '', tinNumber: '', monthlyRevenue: '', requestedLimit: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Suppliers & PO State
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [view, setView] = useState<'list' | 'create'>('list');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [newPO, setNewPO] = useState<Partial<PurchaseOrder>>({ items: [], status: 'Draft', totalCost: 0 });
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    
    // Upload State
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (user) {
            setCreditLimit(user.creditLimit || 0);
            setCreditScore(user.creditScore || 0);
        }
    }, [user]);

    // Fetch all data
    useEffect(() => {
        if (isFirebaseEnabled && db && user?.uid) {
            const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
            const handleError = (e: any) => { if(e.code !== 'permission-denied') console.warn("Procurement sync error:", e.code); };

            // Wholesale Products
            const unsubProducts = onSnapshot(collection(db, 'wholesale_products'), 
                (snapshot) => setWholesaleItems(snapshot.docs.map(d => ({...d.data(), id: d.id} as WholesaleItem))),
                handleError
            );

            // Wholesale Orders
            const unsubWholesaleOrders = onSnapshot(
                query(collection(db, 'wholesale_orders'), where('uid', '==', targetUid), orderBy('date', 'desc')),
                (snapshot) => setOrders(snapshot.docs.map(d => ({...d.data(), id: d.id} as WholesaleOrder))),
                handleError
            );

            // Credit Apps
            const unsubCredit = onSnapshot(
                query(collection(db, 'credit_applications'), where('uid', '==', targetUid)),
                (snapshot) => setCreditApps(snapshot.docs.map(d => ({...d.data(), id: d.id} as CreditApplication))),
                handleError
            );

            // Purchase Orders
            const unsubPOs = onSnapshot(
                query(collection(db, 'purchase_orders'), where('uid', '==', targetUid)),
                (snapshot) => setPurchaseOrders(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as PurchaseOrder))),
                handleError
            );

            // Suppliers
            const unsubSuppliers = onSnapshot(
                query(collection(db, 'suppliers'), where('uid', '==', targetUid)),
                (snapshot) => setSuppliers(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Supplier))),
                handleError
            );

            return () => { unsubProducts(); unsubWholesaleOrders(); unsubCredit(); unsubPOs(); unsubSuppliers(); };
        }
    }, [user, isFirebaseEnabled]);

    // Ghala Functions
    const seedWholesaleProducts = async () => {
        if (!isFirebaseEnabled || !db) return;
        setIsSeeding(true);
        try {
            const batch = writeBatch(db);
            MOCK_WHOLESALE_ITEMS.forEach(item => {
                const ref = doc(collection(db, 'wholesale_products'));
                batch.set(ref, item);
            });
            await batch.commit();
            showNotification("Wholesale products seeded successfully!", "success");
        } catch (e) {
            console.error(e);
            showNotification("Failed to seed products.", "error");
        } finally {
            setIsSeeding(false);
        }
    };

    const handleGhalaCheckout = async () => {
        if (cart.length === 0 || !user?.uid) return;
        const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
        const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
        const canUseCredit = cartTotal <= creditLimit;

        if (confirm(`Confirm wholesale order of TZS ${cartTotal.toLocaleString()}? \n\n${canUseCredit && creditLimit > 0 ? 'Using Credit Facility.' : 'Cash / Mobile Money payment required.'}`)) {
            const newOrder: any = {
                uid: targetUid,
                supplier: cart[0].item.supplier,
                items: cart.map(c => ({ name: c.item.name, quantity: c.quantity, price: c.item.price })),
                total: cartTotal,
                status: 'Pending',
                paymentMethod: canUseCredit && creditLimit > 0 ? 'Credit' : 'Cash',
                date: new Date().toISOString()
            };

            if (isFirebaseEnabled && db) {
                try {
                    await addDoc(collection(db, 'wholesale_orders'), newOrder);
                    if (canUseCredit && creditLimit > 0 && newOrder.paymentMethod === 'Credit') {
                        await updateDoc(doc(db, 'users', targetUid), { creditLimit: increment(-cartTotal) });
                        if (user.uid === targetUid) {
                            setUser({ ...user, creditLimit: (user.creditLimit || 0) - cartTotal });
                        }
                    }
                    showNotification("Order placed successfully!", 'success');
                    setCart([]);
                    setActiveTab('ghala');
                } catch (e) {
                    console.error("Error placing wholesale order", e);
                    showNotification("Failed to place order.", "error");
                }
            }
        }
    };

    // PO Functions
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
                    await updateDoc(doc(db, 'purchase_orders', po.id), { status: 'Received' });
                    for (const item of po.items) {
                        const product = products.find(p => p.name === item.name);
                        if (product) {
                            await updateDoc(doc(db, 'products', product.id), { stock: increment(item.quantity) });
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
            const result = await chatWithGemini(prompt, [], true);
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

    // Upload Functions
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
                showNotification("Please upload a CSV file", "error");
                return;
            }
            setUploadFile(file);
        }
    };

    const handleBulkUpload = async () => {
        if (!uploadFile || !isFirebaseEnabled || !db || !user?.uid) return;
        
        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            const text = await uploadFile.text();
            const lines = text.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            // Expected headers: name, price, stock, buyingPrice, category, unit, barcode (optional)
            const nameIdx = headers.indexOf('name');
            const priceIdx = headers.indexOf('price');
            const stockIdx = headers.indexOf('stock');
            const buyingPriceIdx = headers.indexOf('buyingprice') || headers.indexOf('buying price');
            const categoryIdx = headers.indexOf('category');
            const unitIdx = headers.indexOf('unit');
            const barcodeIdx = headers.indexOf('barcode');
            
            if (nameIdx === -1 || priceIdx === -1) {
                showNotification("CSV must have 'name' and 'price' columns", "error");
                setIsUploading(false);
                return;
            }
            
            const targetUid = user.employerId || user.uid;
            const batch = writeBatch(db);
            let successCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const name = values[nameIdx];
                const price = parseFloat(values[priceIdx]) || 0;
                
                if (!name || price <= 0) continue;
                
                const productData: Partial<Product> = {
                    uid: targetUid,
                    name,
                    price,
                    stock: parseInt(values[stockIdx]) || 0,
                    buyingPrice: parseFloat(values[buyingPriceIdx]) || 0,
                    category: values[categoryIdx] || '',
                    unit: values[unitIdx] || '',
                    barcode: values[barcodeIdx] || '',
                    status: 'Active',
                    trackInventory: true,
                    createdAt: new Date().toISOString(),
                    image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=300&q=80' // Default image
                };
                
                const ref = doc(collection(db, 'products'));
                batch.set(ref, productData);
                successCount++;
                setUploadProgress(Math.round((i / (lines.length - 1)) * 100));
            }
            
            await batch.commit();
            showNotification(`Successfully uploaded ${successCount} items to inventory!`, "success");
            setUploadFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error: any) {
            console.error("Upload error:", error);
            showNotification("Failed to upload items: " + error.message, "error");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const downloadTemplate = () => {
        const csv = 'name,price,stock,buyingPrice,category,unit,barcode\nSample Product,10000,50,8000,Electronics,Piece,123456789';
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'inventory_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const categories = ['All', ...Array.from(new Set(wholesaleItems.map(i => i.category)))];
    const filteredItems = wholesaleItems.filter(i => 
        (selectedCategory === 'All' || i.category === selectedCategory) &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Procurement & Restock</h2>
                    <p className="text-sm text-neutral-500">Manage suppliers, purchase orders, and bulk inventory uploads.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                <button onClick={() => setActiveTab('ghala')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ghala' ? 'border-green-600 text-green-600' : 'border-transparent text-neutral-500'}`}>
                    <Package className="w-4 h-4 inline mr-2" />Ghala Restock
                </button>
                <button onClick={() => setActiveTab('suppliers')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'suppliers' ? 'border-orange-600 text-orange-600' : 'border-transparent text-neutral-500'}`}>
                    <FileText className="w-4 h-4 inline mr-2" />Suppliers & POs
                </button>
                <button onClick={() => setActiveTab('upload')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500'}`}>
                    <Upload className="w-4 h-4 inline mr-2" />Bulk Upload
                </button>
            </div>

            {/* GHALA TAB */}
            {activeTab === 'ghala' && (
                <div className="space-y-6">
                    {/* Credit Widget */}
                    <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4">
                        <div className="bg-white/20 p-2 rounded-lg"><Wallet className="w-6 h-6" /></div>
                        <div><div className="text-xs font-medium opacity-80">Credit Limit</div><div className="text-xl font-bold">TZS {creditLimit?.toLocaleString() || '0'}</div></div>
                        <div className="h-8 w-[1px] bg-white/30 mx-2"></div>
                        <div><div className="text-xs font-medium opacity-80">Score</div><div className="text-sm font-bold">{creditScore > 0 ? creditScore : '--'}/100</div></div>
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                                    <input type="text" placeholder="Search products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-2.5 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none dark:text-white" />
                                </div>
                                <div className="flex gap-2 overflow-x-auto">
                                    {categories.map(cat => (
                                        <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedCategory === cat ? 'bg-green-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {wholesaleItems.length === 0 ? (
                                <div className="text-center py-10 bg-neutral-100 dark:bg-neutral-900 rounded-xl border-dashed border-2">
                                    <Database className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
                                    <button onClick={seedWholesaleProducts} disabled={isSeeding} className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 flex items-center gap-2 mx-auto">
                                        {isSeeding ? <Loader2 className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4"/>} Seed Products
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {filteredItems.map(item => (
                                        <div key={item.id} className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                                            <img src={item.image} className="w-full h-32 object-cover rounded-lg mb-3" alt={item.name} />
                                            <h4 className="font-bold text-neutral-900 dark:text-white mb-1">{item.name}</h4>
                                            <p className="text-xs text-neutral-500 mb-2">{item.supplier}</p>
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-green-600 dark:text-green-400 font-bold">TZS {item.price.toLocaleString()}</span>
                                                <span className="text-xs text-neutral-500">MOQ: {item.moq}</span>
                                            </div>
                                            <button onClick={() => setCart(prev => [...prev, { item, quantity: item.moq }])} className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-500">
                                                Add to Cart
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Cart */}
                        <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                            <h3 className="font-bold mb-4 flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Cart</h3>
                            {cart.length === 0 ? (
                                <p className="text-sm text-neutral-500 text-center py-8">Cart is empty</p>
                            ) : (
                                <>
                                    <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                                        {cart.map((c, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-neutral-50 dark:bg-neutral-800 rounded">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-neutral-900 dark:text-white">{c.item.name}</p>
                                                    <p className="text-xs text-neutral-500">Qty: {c.quantity}</p>
                                                </div>
                                                <button onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))} className="text-red-500"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
                                        <div className="flex justify-between font-bold mb-4">
                                            <span>Total</span>
                                            <span>TZS {cartTotal.toLocaleString()}</span>
                                        </div>
                                        <button onClick={handleGhalaCheckout} className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-500">
                                            Checkout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SUPPLIERS TAB */}
            {activeTab === 'suppliers' && (
                <div className="space-y-6">
                    {view === 'create' ? (
                        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border max-w-3xl mx-auto">
                            <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-white">New Purchase Order</h3>
                            
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
                                    <select className="w-full p-2.5 border rounded-lg bg-neutral-50 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white" value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}>
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Items</label>
                                    <div className="space-y-2">
                                        {newPO.items?.map((item, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input type="text" value={item.name} readOnly className="flex-1 p-2 bg-neutral-100 dark:bg-neutral-800 rounded border-none text-sm dark:text-white" />
                                                <input type="number" value={item.quantity} onChange={e => {
                                                    const items = [...(newPO.items || [])];
                                                    items[idx].quantity = parseInt(e.target.value) || 0;
                                                    setNewPO({...newPO, items});
                                                }} className="w-20 p-2 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded text-sm dark:text-white" />
                                                <input type="number" value={item.cost} onChange={e => {
                                                    const items = [...(newPO.items || [])];
                                                    items[idx].cost = parseFloat(e.target.value) || 0;
                                                    setNewPO({...newPO, items});
                                                }} className="w-24 p-2 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded text-sm dark:text-white" />
                                                <button onClick={() => setNewPO({...newPO, items: newPO.items?.filter((_, i) => i !== idx)})} className="text-red-500 hover:bg-red-50 p-2 rounded"><XCircle className="w-4 h-4"/></button>
                                            </div>
                                        ))}
                                        <button onClick={() => setNewPO({...newPO, items: [...(newPO.items || []), { name: '', quantity: 1, cost: 0 }]})} className="text-xs text-orange-600 font-bold hover:underline">
                                            + Add Line Item
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
                        <>
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Purchase Orders</h3>
                                <button onClick={() => setView('create')} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-500">
                                    <Plus className="w-4 h-4" /> Create PO
                                </button>
                            </div>
                            <div className="grid gap-4">
                                {purchaseOrders.length === 0 ? (
                                    <div className="text-center py-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-dashed text-neutral-400">
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
                                                    <button onClick={() => handleReceivePO(po)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-500 flex items-center gap-2">
                                                        <Truck className="w-4 h-4" /> Receive
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* UPLOAD TAB */}
            {activeTab === 'upload' && (
                <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 max-w-2xl mx-auto">
                    <h3 className="text-lg font-bold mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                        <Upload className="w-5 h-5" /> Bulk Upload Inventory Items
                    </h3>
                    
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" /> CSV Format Required
                            </h4>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                Your CSV file should have the following columns:
                            </p>
                            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                                <li><strong>name</strong> (required) - Product name</li>
                                <li><strong>price</strong> (required) - Selling price</li>
                                <li><strong>stock</strong> - Initial stock quantity</li>
                                <li><strong>buyingPrice</strong> - Cost price</li>
                                <li><strong>category</strong> - Product category</li>
                                <li><strong>unit</strong> - Unit of measurement</li>
                                <li><strong>barcode</strong> - Product barcode (optional)</li>
                            </ul>
                            <button onClick={downloadTemplate} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 flex items-center gap-2">
                                <Download className="w-4 h-4" /> Download Template
                            </button>
                        </div>

                        <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-8 text-center">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                            {!uploadFile ? (
                                <>
                                    <Upload className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
                                    <p className="text-sm text-neutral-500 mb-4">Select a CSV file to upload</p>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-500"
                                    >
                                        Choose File
                                    </button>
                                </>
                            ) : (
                                <>
                                    <FileText className="w-12 h-12 text-green-500 mx-auto mb-4" />
                                    <p className="text-sm font-medium text-neutral-900 dark:text-white mb-2">{uploadFile.name}</p>
                                    <p className="text-xs text-neutral-500 mb-4">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                                    <div className="flex gap-3 justify-center">
                                        <button
                                            onClick={() => {
                                                setUploadFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                        >
                                            Change File
                                        </button>
                                        <button
                                            onClick={handleBulkUpload}
                                            disabled={isUploading}
                                            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-500 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isUploading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Uploading... {uploadProgress}%
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4" />
                                                    Upload Items
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {isUploading && (
                                        <div className="mt-4">
                                            <div className="w-full bg-neutral-200 dark:bg-neutral-800 rounded-full h-2">
                                                <div className="bg-green-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

