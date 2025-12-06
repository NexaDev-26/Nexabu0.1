import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Plus, Minus, CreditCard, Package, CheckCircle, Wallet, FileText, Clock, AlertTriangle, Loader2, Database } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { WholesaleOrder, CreditApplication, WholesaleItem, UserRole } from '../types';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, increment, writeBatch } from 'firebase/firestore';

const MOCK_WHOLESALE_ITEMS: WholesaleItem[] = [
    { id: 'w1', name: 'Azam Cola 500ml', supplier: 'Bakhresa Group', price: 12000, moq: 5, unit: 'Crate (24 btls)', category: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=300&q=80', discount: 10 },
    { id: 'w2', name: 'Mo Sabuni (Soap)', supplier: 'MeTL Group', price: 25000, moq: 1, unit: 'Carton (50 pcs)', category: 'Personal Care', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?auto=format&fit=crop&w=300&q=80' },
    { id: 'w3', name: 'Azania Sembe', supplier: 'Azania', price: 18000, moq: 2, unit: 'Bale (10kg x 10)', category: 'Food & Grains', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=300&q=80' },
    { id: 'w4', name: 'Kilimanjaro Water', supplier: 'Bonite Bottlers', price: 8000, moq: 10, unit: 'Crate (12 btls)', category: 'Beverages', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=300&q=80' },
    { id: 'w5', name: 'Panadol Extra', supplier: 'Shelys Pharma', price: 45000, moq: 1, unit: 'Box (100 strips)', category: 'Medicine', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80' },
];

export const GhalaRestock: React.FC = () => {
    const { user, setUser, showNotification } = useAppContext();
    const [activeTab, setActiveTab] = useState<'catalog' | 'credit' | 'orders'>('catalog');
    
    // Catalog State
    const [wholesaleItems, setWholesaleItems] = useState<WholesaleItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState<{ item: WholesaleItem; quantity: number }[]>([]);
    const [isSeeding, setIsSeeding] = useState(false);
    
    // User specific State
    const [creditLimit, setCreditLimit] = useState(user?.creditLimit || 0); 
    const [creditScore, setCreditScore] = useState(user?.creditScore || 0); 
    
    // Data State
    const [orders, setOrders] = useState<WholesaleOrder[]>([]);
    const [creditApps, setCreditApps] = useState<CreditApplication[]>([]);
    
    // Credit App Form
    const [creditForm, setCreditForm] = useState({ businessName: user?.storeName || '', tinNumber: '', monthlyRevenue: '', requestedLimit: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (user) {
            setCreditLimit(user.creditLimit || 0);
            setCreditScore(user.creditScore || 0);
        }
    }, [user]);

    useEffect(() => {
        if (isFirebaseEnabled && db) {
            const handleError = (e: any) => { if(e.code !== 'permission-denied') console.warn("Ghala sync error:", e.code); };

            // 1. Fetch Products
            const qProducts = collection(db, 'wholesale_products');
            const unsubProducts = onSnapshot(
                qProducts, 
                (snapshot) => {
                    if (!snapshot.empty) {
                        setWholesaleItems(snapshot.docs.map(d => ({...d.data(), id: d.id} as WholesaleItem)));
                    } else {
                        setWholesaleItems([]); // Empty state triggers seeding option
                    }
                },
                handleError
            );

            let unsubOrders = () => {};
            let unsubCredit = () => {};

            if (user?.uid) {
                const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;

                // 2. Listen to Wholesale Orders
                const qOrders = query(collection(db, 'wholesale_orders'), where('uid', '==', targetUid), orderBy('date', 'desc'));
                unsubOrders = onSnapshot(
                    qOrders, 
                    (snapshot) => setOrders(snapshot.docs.map(d => ({...d.data(), id: d.id} as WholesaleOrder))),
                    handleError
                );

                // 3. Listen to Credit Apps
                const qCredit = query(collection(db, 'credit_applications'), where('uid', '==', targetUid));
                unsubCredit = onSnapshot(
                    qCredit, 
                    (snapshot) => setCreditApps(snapshot.docs.map(d => ({...d.data(), id: d.id} as CreditApplication))),
                    handleError
                );
            }
            return () => { unsubProducts(); unsubOrders(); unsubCredit(); };
        }
    }, [user, isFirebaseEnabled]);

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

    const addToCart = (item: WholesaleItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.item.id === item.id);
            if (existing) {
                return prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { item, quantity: item.moq }];
        });
        showNotification(`Added ${item.name}`, 'success');
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.item.id === id) {
                const newQty = Math.max(i.item.moq, i.quantity + delta);
                return { ...i, quantity: newQty };
            }
            return i;
        }));
    };

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(i => i.item.id !== id));
    };

    const cartTotal = cart.reduce((sum, i) => sum + (i.item.price * i.quantity), 0);
    const categories = ['All', ...Array.from(new Set(wholesaleItems.map(i => i.category)))];
    const filteredItems = wholesaleItems.filter(i => 
        (selectedCategory === 'All' || i.category === selectedCategory) &&
        (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.supplier.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!user?.uid) return;
        
        const canUseCredit = cartTotal <= creditLimit;
        
        if (confirm(`Confirm wholesale order of TZS ${cartTotal.toLocaleString()}? \n\n${canUseCredit && creditLimit > 0 ? 'Using Credit Facility.' : 'Cash / Mobile Money payment required.'}`)) {
            
            const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;

            const newOrder: any = {
                uid: targetUid,
                supplier: cart[0].item.supplier, // Simplified
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
                        // Deduct Credit Limit
                        await updateDoc(doc(db, 'users', targetUid), {
                            creditLimit: increment(-cartTotal)
                        });
                        // Optimistic update if user is viewing their own data
                        if (user.uid === targetUid) {
                            setUser({ ...user, creditLimit: (user.creditLimit || 0) - cartTotal });
                        }
                    }
                } catch (e) {
                    console.error("Error placing wholesale order", e);
                    showNotification("Failed to place order.", "error");
                    return;
                }
            } else {
                showNotification("Order failed. System unavailable.", "error");
                return;
            }
            
            showNotification("Order placed successfully! Suppliers notified.", 'success');
            setCart([]);
            setActiveTab('orders');
        }
    };

    const submitCreditApp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const targetUid = (user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) ? user?.uid : user?.employerId;

        const appData = {
            uid: targetUid || 'guest',
            ...creditForm,
            monthlyRevenue: Number(creditForm.monthlyRevenue),
            requestedLimit: Number(creditForm.requestedLimit),
            status: 'Pending',
            date: new Date().toISOString()
        };

        if (isFirebaseEnabled && db) {
            try {
                await addDoc(collection(db, 'credit_applications'), appData);
                showNotification("Application submitted for review!", "success");
                setCreditForm({ businessName: '', tinNumber: '', monthlyRevenue: '', requestedLimit: '' });
            } catch(e) { console.error(e); }
        } else {
            showNotification("Submission service unavailable.", "error");
        }
        setIsSubmitting(false);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-green-600" />
                        Ghala Restock
                    </h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm">Direct wholesale ordering & financing.</p>
                </div>
                
                {/* Credit Widget */}
                <div className="bg-gradient-to-r from-green-800 to-green-600 text-white p-4 rounded-xl shadow-lg flex items-center gap-4">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Wallet className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-xs font-medium opacity-80">Credit Limit</div>
                        <div className="text-xl font-bold">TZS {creditLimit?.toLocaleString() || '0'}</div>
                    </div>
                    <div className="h-8 w-[1px] bg-white/30 mx-2"></div>
                    <div>
                        <div className="text-xs font-medium opacity-80">Score</div>
                        <div className="text-sm font-bold flex items-center gap-1">
                            {creditScore > 0 ? creditScore : '--'}/100 
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800">
                <button onClick={() => setActiveTab('catalog')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'catalog' ? 'border-green-600 text-green-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>Catalog</button>
                <button onClick={() => setActiveTab('orders')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'orders' ? 'border-green-600 text-green-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>My Orders</button>
                <button onClick={() => setActiveTab('credit')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'credit' ? 'border-green-600 text-green-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}>Credit & Financing</button>
            </div>

            {/* CONTENT: CATALOG */}
            {activeTab === 'catalog' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Search & Filter */}
                        <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="Search products or suppliers..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 p-2.5 bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none text-neutral-900 dark:text-white" 
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                                {categories.map(cat => (
                                    <button 
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                            selectedCategory === cat 
                                            ? 'bg-green-600 text-white' 
                                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Products Grid */}
                        {wholesaleItems.length === 0 && isFirebaseEnabled ? (
                            <div className="text-center py-10 bg-neutral-100 dark:bg-neutral-900 rounded-xl border-dashed border-2 border-neutral-300 dark:border-neutral-800">
                                <Database className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
                                <h3 className="text-neutral-600 dark:text-neutral-300 font-bold">No Products Found</h3>
                                <p className="text-xs text-neutral-500 mb-4">The wholesale database is empty.</p>
                                <button onClick={seedWholesaleProducts} disabled={isSeeding} className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 flex items-center gap-2 mx-auto">
                                    {isSeeding ? <Loader2 className="w-4 h-4 animate-spin"/> : <Database className="w-4 h-4"/>} Seed Default Products
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {filteredItems.map(item => (
                                    <div key={item.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
                                        <div className="flex h-32">
                                            <div className="w-1/3 bg-neutral-100 dark:bg-neutral-800 relative">
                                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                                {item.discount && (
                                                    <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                                                        -{item.discount}%
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-2/3 p-4 flex flex-col justify-between">
                                                <div>
                                                    <div className="text-xs text-neutral-500 mb-1">{item.supplier}</div>
                                                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm line-clamp-1">{item.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">
                                                            TZS {item.price.toLocaleString()}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-400">/ {item.unit}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between mt-2">
                                                    <div className="text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                                                        MOQ: {item.moq}
                                                    </div>
                                                    <button 
                                                        onClick={() => addToCart(item)}
                                                        className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 p-2 rounded-full hover:scale-105 transition-transform"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart Section */}
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm h-fit sticky top-6">
                        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-green-600" /> Cart
                            </h3>
                            <span className="text-xs font-medium text-neutral-500">{cart.length} Items</span>
                        </div>
                        <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar space-y-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-8 text-neutral-400">
                                    <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm">Wholesale cart is empty</p>
                                </div>
                            ) : (
                                cart.map(({ item, quantity }) => (
                                    <div key={item.id} className="flex gap-3 items-start">
                                        <img src={item.image} className="w-10 h-10 rounded bg-neutral-100 object-cover" />
                                        <div className="flex-1">
                                            <div className="text-sm font-medium line-clamp-1">{item.name}</div>
                                            <div className="text-xs text-neutral-500">TZS {item.price.toLocaleString()} x {quantity}</div>
                                            <div className="flex items-center gap-3 mt-2">
                                                <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"><Minus className="w-3 h-3" /></button>
                                                <span className="text-xs font-bold w-4 text-center">{quantity}</span>
                                                <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"><Plus className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{(item.price * quantity).toLocaleString()}</div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-[10px] text-red-500 hover:underline mt-1">Remove</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 rounded-b-xl">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">Total Estimate</span>
                                <span className="text-xl font-bold text-neutral-900 dark:text-white">TZS {cartTotal.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={handleCheckout}
                                disabled={cart.length === 0}
                                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-900/20"
                            >
                                Place Order
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENT: CREDIT APPLICATION */}
            {activeTab === 'credit' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm mb-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-green-600" /> Credit Application (BNPL)
                            </h3>
                            <p className="text-sm text-neutral-500 mb-6">Apply for inventory credit to stock up now and pay later. Approval usually takes 24 hours.</p>
                            
                            <form onSubmit={submitCreditApp} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-neutral-500 mb-1">Registered Business Name</label>
                                    <input type="text" required value={creditForm.businessName} onChange={e => setCreditForm({...creditForm, businessName: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-500 mb-1">TIN Number</label>
                                    <input type="text" required placeholder="000-000-000" value={creditForm.tinNumber} onChange={e => setCreditForm({...creditForm, tinNumber: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-500 mb-1">Avg. Monthly Revenue (TZS)</label>
                                    <input type="number" required placeholder="e.g. 5000000" value={creditForm.monthlyRevenue} onChange={e => setCreditForm({...creditForm, monthlyRevenue: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-neutral-500 mb-1">Requested Limit (TZS)</label>
                                    <input type="number" required placeholder="e.g. 1000000" value={creditForm.requestedLimit} onChange={e => setCreditForm({...creditForm, requestedLimit: e.target.value})} className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                                <button disabled={isSubmitting} className="w-full bg-green-700 hover:bg-green-600 text-white py-3 rounded-lg font-bold transition-colors flex justify-center items-center gap-2">
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Application'}
                                </button>
                            </form>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-bold text-neutral-700 dark:text-neutral-300 mb-4">Application History</h4>
                        {creditApps.length > 0 ? (
                            <div className="space-y-3">
                                {creditApps.map(app => (
                                    <div key={app.id} className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex justify-between items-center">
                                        <div>
                                            <div className="font-bold text-sm">Limit Request: {Number(app.requestedLimit).toLocaleString()}</div>
                                            <div className="text-xs text-neutral-500">{new Date(app.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                            app.status === 'Approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            app.status === 'Rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}>
                                            {app.status}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-neutral-400 bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-800">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No previous applications</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* CONTENT: ORDERS */}
            {activeTab === 'orders' && (
                <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
                                <tr>
                                    <th className="p-4">Order ID</th>
                                    <th className="p-4">Supplier</th>
                                    <th className="p-4">Items</th>
                                    <th className="p-4">Total</th>
                                    <th className="p-4">Payment</th>
                                    <th className="p-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                                {orders.length > 0 ? orders.map(order => (
                                    <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                                        <td className="p-4 font-mono text-xs">{order.id}</td>
                                        <td className="p-4 font-medium">{order.supplier || 'Multiple'}</td>
                                        <td className="p-4 text-xs text-neutral-500">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</td>
                                        <td className="p-4 font-bold">TZS {order.total.toLocaleString()}</td>
                                        <td className="p-4">
                                            <span className={`text-[10px] px-2 py-0.5 rounded border ${order.paymentMethod === 'Credit' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
                                                {order.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`flex items-center gap-1 text-xs font-bold ${
                                                order.status === 'Delivered' ? 'text-green-600' : 
                                                order.status === 'Shipped' ? 'text-blue-600' : 'text-yellow-600'
                                            }`}>
                                                {order.status === 'Pending' && <Clock className="w-3 h-3"/>}
                                                {order.status}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-neutral-400">No recent orders found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};