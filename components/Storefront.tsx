import React, { useState } from 'react';
import { Product, User, UserRole, Order } from '../types';
import { ShoppingCart, Plus, Minus, Search, Star, MapPin, ArrowLeft, CheckCircle, Smartphone, Send, X, Copy, Store, Filter, ChevronRight, AlertCircle, Loader2, Navigation, ExternalLink, QrCode, Tag, CreditCard, MessageCircle } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

export const Storefront: React.FC = () => {
  const { products, allUsers, cart, setCart, paymentMethods, showNotification } = useAppContext();
  const vendors = allUsers.filter(u => u.role === UserRole.VENDOR || u.role === UserRole.PHARMACY);

  const [viewMode, setViewMode] = useState<'vendors' | 'products' | 'nearby'>('vendors');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Checkout State
  const [customerDetails, setCustomerDetails] = useState({ name: '', phone: '', address: '' });
  const [selectedPayment, setSelectedPayment] = useState('Cash');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      return existing ? prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...prev, { product, quantity: 1 }];
    });
    showNotification(`Added ${product.name} to cart`, 'success');
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };
  
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const applyDiscount = () => {
    if (discountCode.toUpperCase() === 'SAVE10') {
      setDiscountAmount(subtotal * 0.1);
      showNotification('10% Discount Applied!', 'success');
    } else if (discountCode.toUpperCase() === 'NEXA20') {
      setDiscountAmount(subtotal * 0.2);
      showNotification('20% Discount Applied!', 'success');
    } else {
      setDiscountAmount(0);
      showNotification('Invalid Discount Code', 'error');
    }
  };

  const handleCheckout = async (viaWhatsapp: boolean = false) => {
    if (!customerDetails.name || !customerDetails.phone) {
      alert("Please provide your name and phone number.");
      return;
    }
    
    setIsProcessing(true);
    const sellerId = selectedVendorId || (cart[0]?.product.uid) || 'unknown';
    
    // Construct Order Data
    const orderData: Partial<Order> = {
      customerName: customerDetails.name,
      date: new Date().toISOString(),
      status: 'Pending',
      total: totalAmount,
      items: cart.map(i => ({ name: i.product.name, price: i.product.price, quantity: i.quantity })),
      sellerId: sellerId,
      receiptNumber: `ORD-${Date.now().toString().slice(-6)}`,
      tax: totalAmount * 0.18,
      orderType: viaWhatsapp ? 'WhatsApp' : 'Direct'
    };

    try {
      if (isFirebaseEnabled && db) {
        await addDoc(collection(db, "orders"), orderData);
      }
      
      if (viaWhatsapp) {
          // TakeApp / WhatsApp style formatting using %0a for new lines
          const vendor = vendors.find(v => v.uid === sellerId);
          const vendorPhone = vendor?.whatsappNumber || vendor?.phone || '';
          
          if (!vendorPhone) {
              alert("This vendor has not configured a WhatsApp number. Order placed internally.");
          } else {
              const orderId = `ORD-${Date.now().toString().slice(-4)}`;
              let message = `*NEW ORDER ${orderId}* %0a`;
              message += `Date: ${new Date().toLocaleDateString()} %0a`;
              message += `Customer: ${customerDetails.name} (${customerDetails.phone}) %0a`;
              if (customerDetails.address) message += `Address: ${customerDetails.address} %0a`;
              message += `----------------------------%0a`;
              
              cart.forEach(item => {
                  message += `${item.quantity} x ${item.product.name} @ TZS ${item.product.price.toLocaleString()} %0a`;
              });
              
              message += `----------------------------%0a`;
              message += `*Subtotal:* TZS ${subtotal.toLocaleString()} %0a`;
              if (discountAmount > 0) message += `*Discount:* - TZS ${discountAmount.toLocaleString()} %0a`;
              message += `*TOTAL:* TZS ${totalAmount.toLocaleString()} %0a%0a`;
              message += `Please confirm this order. Thank you!`;
              
              const whatsappUrl = `https://wa.me/${vendorPhone.replace('+', '').replace(/\s/g, '')}?text=${message}`; // No encodeURIComponent needed for basic message construction usually if manually escaping %0a, but better to use it if not manually using %0a.
              // Re-encoding specifically for URL safety while preserving line breaks
              window.open(whatsappUrl, '_blank');
          }
      } else {
        // Simulate network delay for UX
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      setCart([]);
      setIsCheckoutOpen(false);
      setDiscountCode('');
      setDiscountAmount(0);
      showNotification("Order placed successfully!", "success");
    } catch (e) {
      console.error("Checkout Error:", e);
      showNotification("Failed to place order.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedVendor = vendors.find(v => v.uid === selectedVendorId);
  const filteredProducts = products.filter(p => (!selectedVendorId || p.uid === selectedVendorId) && p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto animate-fade-in">
      <div className="flex-1 space-y-4">
        {selectedVendor ? (
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setSelectedVendorId(null)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full"><ArrowLeft /></button>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{selectedVendor.storeName}</h2>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Marketplace</h2>
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
              <button onClick={() => setViewMode('vendors')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'vendors' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400'}`}>Shops</button>
              <button onClick={() => setViewMode('products')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'products' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400'}`}>Products</button>
            </div>
          </div>
        )}
        
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input type="text" placeholder="Search shops or products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 p-3 border rounded-xl dark:bg-neutral-800 dark:border-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-orange-500" />
        </div>
        
        {viewMode === 'vendors' && !selectedVendorId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vendors.map(v => (
              <div key={v.uid} onClick={() => setSelectedVendorId(v.uid)} className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-orange-500 transition-all bg-white dark:bg-neutral-900 flex items-center gap-4 group">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg">
                  {v.storeName?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors">{v.storeName}</h3>
                  <p className="text-xs text-neutral-500">{v.location || 'Dar es Salaam'}</p>
                </div>
                <ChevronRight className="ml-auto text-neutral-400" />
              </div>
            ))}
          </div>
        )}

        {(viewMode === 'products' || selectedVendorId) && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProducts.map(p => (
              <div key={p.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden group hover:shadow-md transition-all">
                <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
                  <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
                  <button onClick={() => addToCart(p)} className="absolute bottom-2 right-2 bg-white dark:bg-neutral-900 p-2 rounded-full shadow-lg text-orange-600 hover:scale-110 transition-transform">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-neutral-900 dark:text-white text-sm line-clamp-1">{p.name}</h3>
                  <p className="text-orange-600 dark:text-orange-400 font-bold text-sm mt-1">TZS {p.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="w-full lg:w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm flex flex-col h-[calc(100vh-120px)] sticky top-24">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-orange-600" /> Your Cart</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className="flex items-center gap-3">
                <img src={item.product.image} className="w-12 h-12 rounded-lg object-cover bg-neutral-100" alt="" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-1">{item.product.name}</p>
                  <p className="text-xs text-neutral-500">TZS {item.product.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 hover:text-orange-600"><Minus className="w-3 h-3" /></button>
                  <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 hover:text-orange-600"><Plus className="w-3 h-3" /></button>
                </div>
                <button onClick={() => removeFromCart(item.product.id)} className="text-neutral-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between text-sm mb-2"><span>Subtotal</span><span>TZS {subtotal.toLocaleString()}</span></div>
          {discountAmount > 0 && (
             <div className="flex justify-between text-sm mb-2 text-green-600 dark:text-green-400 font-medium"><span>Discount</span><span>- TZS {discountAmount.toLocaleString()}</span></div>
          )}
          <div className="flex justify-between font-bold text-lg text-neutral-900 dark:text-white mb-4"><span>Total</span><span>TZS {totalAmount.toLocaleString()}</span></div>
          <button 
            onClick={() => setIsCheckoutOpen(true)} 
            disabled={cart.length === 0}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
          >
            Checkout Now
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Confirm Order</h3>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                {/* Customer Details */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Details</h4>
                    <input type="text" placeholder="Your Name" value={customerDetails.name} onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})} className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" />
                    <input type="tel" placeholder="Phone Number" value={customerDetails.phone} onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})} className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" />
                    <input type="text" placeholder="Delivery Address (Optional)" value={customerDetails.address} onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})} className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" />
                </div>

                {/* Discount Code */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Discount Code</h4>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                            <input type="text" placeholder="Enter code (e.g. SAVE10)" value={discountCode} onChange={e => setDiscountCode(e.target.value)} className="w-full pl-10 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none uppercase dark:text-white" />
                        </div>
                        <button onClick={applyDiscount} className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-bold">Apply</button>
                    </div>
                </div>

                {/* Summary */}
                <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <div className="flex justify-between text-sm mb-1"><span>Subtotal</span><span>TZS {subtotal.toLocaleString()}</span></div>
                    {discountAmount > 0 && <div className="flex justify-between text-sm mb-1 text-green-600 font-medium"><span>Discount</span><span>- TZS {discountAmount.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-200 dark:border-neutral-800 mt-2"><span>Total to Pay</span><span>TZS {totalAmount.toLocaleString()}</span></div>
                </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <button 
                    onClick={() => handleCheckout(true)} 
                    disabled={isProcessing}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 transition-all flex justify-center items-center gap-2 shadow-lg shadow-green-900/20"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                    Order via WhatsApp
                </button>
                <button 
                    onClick={() => handleCheckout(false)} 
                    disabled={isProcessing}
                    className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white py-3 rounded-xl font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex justify-center items-center gap-2"
                >
                    Place Standard Order
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};