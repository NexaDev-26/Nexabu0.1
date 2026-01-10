/**
 * Enhanced Storefront Component
 * Unified product display with multiple modes: Grid (POS), List (Inventory), Catalog (Customer)
 * Merges best UX from Ghala.tz, Daily Sales App, and TakeApp
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Product, User, UserRole, Order, Customer } from '../types';
import { ShoppingCart, Search, MapPin, ArrowLeft, X, Loader2, MessageCircle, Grid, List as ListIcon, LayoutGrid, Plus, Minus, Zap, Package, Truck } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { isOnline, queueOrder, cacheProducts, getCachedProducts, saveCart, getCart } from '../services/offlineService';
import { ProductGrid } from './ProductDisplay/ProductGrid';
import { ProductList } from './ProductDisplay/ProductList';
import { ProductCatalog } from './ProductDisplay/ProductCatalog';
import { SearchBar } from './ProductFilters/SearchBar';
import { CategoryFilter } from './ProductFilters/CategoryFilter';
import { BarcodeScanner } from './ProductActions/BarcodeScanner';
import { QuickSale } from './QuickSale';
import { PaymentModal } from './PaymentModal';
import { MultiVendorCheckout } from './MultiVendorCheckout';
import { findProductByBarcode } from '../utils/barcodeUtils';
import { calculateOrderCommission, formatCommission } from '../utils/commissionUtils';
import { generateDeliveryOtp } from '../utils/deliveryUtils';
import { calculateDeliveryFee } from '../utils/deliveryFeeCalculator';

export const Storefront: React.FC = () => {
  const { products, allUsers, cart, setCart, paymentMethods, showNotification, user, role, branches } = useAppContext();
  const vendors = allUsers.filter(u => u.role === UserRole.VENDOR || u.role === UserRole.PHARMACY);
  
  // Get branches for current user (vendor/pharmacy) - TODO: Load from Firestore
  const userBranches = useMemo(() => {
    if (!user) return [];
    // Branches would come from a branches collection
    // For now, return empty array - can be populated from ManageProfile branches
    return [];
  }, [user]);

  const [viewMode, setViewMode] = useState<'vendors' | 'products' | 'nearby'>('vendors');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Enhanced state for new features
  const [displayMode, setDisplayMode] = useState<'grid' | 'list' | 'catalog'>(
    role === UserRole.CUSTOMER ? 'catalog' : 
    role === UserRole.VENDOR || role === UserRole.PHARMACY ? 'grid' : 
    'grid'
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string | null>(null);
  
  // Checkout State
  const [customerDetails, setCustomerDetails] = useState({ name: '', phone: '', address: '' });
  const [selectedPayment, setSelectedPayment] = useState('Cash');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isMultiVendorCheckoutOpen, setIsMultiVendorCheckoutOpen] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any | null>(null);
  const [pendingOrderAmount, setPendingOrderAmount] = useState(0);
  const [deliveryType, setDeliveryType] = useState<'self-pickup' | 'home-delivery'>('self-pickup');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('POS');

  // Sales reps for the current vendor/pharmacy/manager
  const salesReps = useMemo(
    () => {
      if (!user) return [] as User[];
      const ownerId =
        user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY
          ? user.uid
          : user.employerId;
      if (!ownerId) return [] as User[];
      return allUsers.filter(
        u => u.role === UserRole.SALES_REP && u.employerId === ownerId
      );
    },
    [allUsers, user]
  );

  // Load cached products and cart when offline
  useEffect(() => {
    const loadOfflineData = async () => {
      // Load cart from offline storage on mount
      if (cart.length === 0) {
        const savedCart = await getCart();
        if (savedCart.length > 0) {
          setCart(savedCart);
        }
      }
    };
    
    loadOfflineData();
  }, []);

  // Save cart to offline storage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      saveCart(cart).catch(console.error);
    } else {
      getCart().then(savedCart => {
        if (savedCart.length === 0) {
          saveCart([]).catch(console.error);
        }
      });
    }
  }, [cart]);

  // Cache products when online
  useEffect(() => {
    if (isOnline() && products.length > 0) {
      cacheProducts(products.slice(0, 100)).catch(console.error); // Cache last 100 products
    }
  }, [products]);

  const addToCart = async (product: Product, quantity: number = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    showNotification(`Added ${product.name} to cart`, 'success');

    // Save to abandoned cart for recovery (only for customers)
    if (role === UserRole.CUSTOMER && user) {
      try {
        const { saveAbandonedCart } = await import('../services/cartRecoveryService');
        const sellerId = selectedVendorId || product.uid;
        if (sellerId) {
          const currentCart = [...cart];
          const existingItem = currentCart.find(i => i.product.id === product.id);
          if (existingItem) {
            existingItem.quantity += quantity;
          } else {
            currentCart.push({ product, quantity });
          }
          
          const cartItems = currentCart.map(item => ({
            productId: item.product.id,
            productName: item.product.name,
            quantity: item.quantity,
            price: item.product.price,
            image: item.product.image
          }));
          const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          await saveAbandonedCart({
            uid: sellerId,
            customerId: user.uid,
            customerName: user.name,
            customerPhone: user.phone,
            customerEmail: user.email,
            items: cartItems,
            subtotal,
            total: subtotal,
            currency: 'TZS'
          });
        }
      } catch (error) {
        console.error('Failed to save abandoned cart:', error);
      }
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
    showNotification('Item removed from cart', 'success');
  };
  
  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  // Handle barcode scan
  const handleBarcodeScan = (barcode: string) => {
    const product = findProductByBarcode(products, barcode);
    if (product) {
      addToCart(product, 1);
      setIsScannerOpen(false);
      showNotification(`Found: ${product.name}`, 'success');
    } else {
      showNotification(`Product not found for barcode: ${barcode}`, 'error');
    }
  };

  const handleBarcodeInput = (barcode: string) => {
    // Auto-search when barcode is detected in search input
    const product = findProductByBarcode(products, barcode);
    if (product) {
      addToCart(product, 1);
      setSearchQuery('');
      showNotification(`Added: ${product.name}`, 'success');
    }
  };

  // Enhanced product filtering with search, category, and vendor filters
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => {
      // If user is a vendor/pharmacy, show only their products (unless they selected another vendor)
      const targetUid = (role === UserRole.VENDOR || role === UserRole.PHARMACY) ? user?.uid : null;
      
      // Vendor filter: If selectedVendorId is set, filter to that vendor
      // Otherwise, if user is vendor/pharmacy, filter to their products only
      if (selectedVendorId) {
        if (p.uid !== selectedVendorId) return false;
      } else if (targetUid) {
        // Vendor/pharmacy viewing their own storefront - only show their products
        if (p.uid !== targetUid) return false;
      }
      // If customer or no targetUid, show all products (marketplace view)
      
      // Search filter (name, SKU, barcode)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBarcode = p.barcode?.toLowerCase().includes(query);
        // Note: SKU field not in Product type currently, can be added later if needed
        if (!matchesName && !matchesBarcode) return false;
      }
      
      // Category filter
      if (selectedCategory && p.category !== selectedCategory) return false;
      
      return true;
    });
    
    return filtered;
  }, [products, selectedVendorId, searchQuery, selectedCategory, role, user?.uid]);

  // Calculate subtotal using discount price if available
  const subtotal = cart.reduce((sum, item) => {
    const itemPrice = (item.product.discountPrice && item.product.discountPrice > 0 && item.product.discountPrice < item.product.price) 
      ? item.product.discountPrice 
      : item.product.price;
    return sum + (itemPrice * item.quantity);
  }, 0);
  
  // Calculate delivery fee when delivery type changes
  useEffect(() => {
    const fee = calculateDeliveryFee(deliveryType);
    setDeliveryFee(fee);
  }, [deliveryType]);
  
  // Check if cart has items from multiple vendors
  const uniqueVendors = useMemo(() => {
    const vendorIds = new Set(cart.map(item => item.product.uid));
    return Array.from(vendorIds);
  }, [cart]);

  const isMultiVendorCart = uniqueVendors.length > 1;

  // Calculate tax (18% VAT in Tanzania)
  const taxRate = 0.18; // 18% VAT
  const taxAmount = (subtotal - discountAmount) * taxRate;
  const totalAmount = Math.max(0, subtotal - discountAmount + deliveryFee + taxAmount);

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
    // Validate cart
    if (cart.length === 0) {
      showNotification("Your cart is empty. Please add items before checkout.", "error");
      return;
    }

    // Validate customer details
    if (!customerDetails.name || !customerDetails.phone) {
      showNotification("Please provide your name and phone number.", "error");
      return;
    }

    // If multi-vendor cart, open multi-vendor checkout
    if (isMultiVendorCart) {
      setIsMultiVendorCheckoutOpen(true);
      return;
    }

    // Single vendor checkout (existing flow)

    // Validate total amount
    if (totalAmount <= 0) {
      showNotification("Invalid order total. Please check your cart.", "error");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Determine seller ID
      const sellerId = selectedVendorId || cart[0]?.product.uid;
      if (!sellerId || sellerId === 'unknown') {
        throw new Error("Unable to determine seller. Please select a vendor or ensure products are available.");
      }

      // Validate seller exists
      const sellerExists = vendors.some(v => v.uid === sellerId);
      if (!sellerExists && role !== UserRole.VENDOR && role !== UserRole.PHARMACY) {
        throw new Error("Selected vendor not found. Please try again.");
      }

      const selectedRep = selectedSalesRepId
        ? salesReps.find(r => r.uid === selectedSalesRepId) || null
        : null;
      const commissionAmount = selectedRep
        ? calculateOrderCommission({ total: totalAmount } as Order, selectedRep)
        : 0;
      
      // Generate delivery OTP for delivery orders
      const deliveryOtp = generateDeliveryOtp();
      
      // Validate cart items and use discount price if available
      const orderItems = cart.map(i => {
        if (!i.product.id || !i.product.name || !i.quantity) {
          throw new Error(`Invalid product data: ${i.product.name || 'Unknown product'}`);
        }
        
        // Use discount price if available, otherwise use regular price
        const itemPrice = (i.product.discountPrice && i.product.discountPrice > 0 && i.product.discountPrice < i.product.price) 
          ? i.product.discountPrice 
          : i.product.price;
        
        if (!itemPrice || itemPrice <= 0) {
          throw new Error(`Invalid price for product: ${i.product.name}`);
        }
        
        return {
        productId: i.product.id,
        name: i.product.name, 
          price: itemPrice,
        quantity: i.quantity 
        };
      });

      // Construct Order Data (only include defined values - Firestore doesn't allow undefined)
      const orderData: any = {
        customerName: customerDetails.name.trim(),
        date: new Date().toISOString(),
        status: 'Pending',
        paymentStatus: 'PENDING_VERIFICATION', // Set payment status for verification flow
        total: totalAmount,
        items: orderItems,
        sellerId: sellerId,
        deliveryOtp: deliveryOtp, // Add delivery OTP for secure delivery verification
        deliveryType: deliveryType,
        deliveryRequested: deliveryType === 'home-delivery',
        createdAt: new Date().toISOString(),
        // Tax, Discount, Refund fields
        tax: taxAmount,
        discount: discountAmount,
        refund: 0, // Default to 0, can be updated later if refunded
        // Branch and Channel fields
        channel: selectedChannel || 'POS'
      };

      // Only add optional fields if they have values
      if (deliveryType === 'home-delivery' && deliveryFee > 0) {
        orderData.deliveryFee = deliveryFee;
      }
      if (customerDetails.address?.trim()) {
        orderData.deliveryAddress = customerDetails.address.trim();
      }
      if (user?.uid) {
        orderData.customerId = user.uid;
      }
      if (selectedRep?.uid) {
        orderData.salesRepId = selectedRep.uid;
      }
      if (selectedRep?.name) {
        orderData.salesRepName = selectedRep.name;
      }
      if (commissionAmount > 0) {
        orderData.commission = commissionAmount;
      }
      // Add branchId if selected (not 'all')
      if (selectedBranchId && selectedBranchId !== 'all') {
        orderData.branchId = selectedBranchId;
      }

      const online = isOnline();
      
      if (online && isFirebaseEnabled && db) {
        // Don't create order yet - wait for payment confirmation
        // Prepare order data and open payment modal
        // Order will be created when customer confirms payment
        
        // Show payment modal - order will be created after payment confirmation
        setPendingOrderData({
          ...orderData,
          sellerId, // Include sellerId for customer creation
          customerDetails, // Include customer details for customer creation
          viaWhatsapp: viaWhatsapp // Track if this is a WhatsApp order
        });
        setPendingOrderAmount(totalAmount);
        setIsPaymentModalOpen(true);
        setIsCheckoutOpen(false);
        setIsProcessing(false);
        
        showNotification("Please complete payment to place your order.", "info");
        return; // Exit early - payment modal will handle order creation
      } else if (!online) {
        // Offline: Queue order for sync
        const orderWithId: Order = {
          ...orderData,
          id: `offline_${Date.now()}`,
        } as Order;
        
        await queueOrder(orderWithId);
        showNotification("Order queued for sync. Will be sent when online.", "info");
        // Clear cart for offline orders
        setCart([]);
        await saveCart([]);
        setIsCheckoutOpen(false);
        setIsProcessing(false);
        return;
      } else {
        showNotification("Database connection unavailable", "error");
        setIsProcessing(false);
        return;
      }
    } catch (e: any) {
      console.error("Checkout Error:", e);
      const errorMessage = e?.message || e?.toString() || "Unknown error occurred";
      
      // Provide specific error messages
      if (errorMessage.includes("permission-denied") || errorMessage.includes("Permission denied")) {
        showNotification("Permission denied. Please check your account permissions.", "error");
      } else if (errorMessage.includes("network") || errorMessage.includes("Network")) {
        showNotification("Network error. Please check your internet connection and try again.", "error");
      } else if (errorMessage.includes("seller") || errorMessage.includes("vendor")) {
        showNotification(errorMessage, "error");
      } else if (errorMessage.includes("product")) {
        showNotification(errorMessage, "error");
        } else {
        showNotification(`Failed to place order: ${errorMessage}`, "error");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedVendor = vendors.find(v => v.uid === selectedVendorId);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-auto animate-fade-in px-4 sm:px-6">
      <div className="flex-1 space-y-4">
        {/* Header Section */}
        {selectedVendor ? (
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => {
                setSelectedVendorId(null);
                setSelectedCategory(null);
                setSearchQuery('');
              }} 
              className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg overflow-hidden flex-shrink-0">
                {selectedVendor.storeLogo || selectedVendor.photoURL ? (
                  <img 
                    src={selectedVendor.storeLogo || selectedVendor.photoURL} 
                    alt={selectedVendor.storeName || 'Store'} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      if (target.parentElement) {
                        target.parentElement.textContent = selectedVendor.storeName?.charAt(0) || 'S';
                      }
                    }}
                  />
                ) : (
                  selectedVendor.storeName?.charAt(0) || 'S'
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{selectedVendor.storeName}</h2>
                {selectedVendor.location && (
                  <div className="flex items-center gap-1 text-sm text-neutral-500 mt-0.5">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedVendor.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Marketplace</h2>
            <div className="flex items-center gap-3">
              <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('vendors')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'vendors' 
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' 
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Shops
                </button>
                <button 
                  onClick={() => setViewMode('products')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'products' 
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' 
                      : 'text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  Products
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vendor List View */}
        {viewMode === 'vendors' && !selectedVendorId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {vendors.map(v => (
              <div 
                key={v.uid} 
                onClick={() => setSelectedVendorId(v.uid)} 
                className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl cursor-pointer hover:border-orange-500 transition-all bg-white dark:bg-neutral-900 flex items-center gap-4 group"
              >
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg flex-shrink-0 overflow-hidden">
                  {v.storeLogo || v.photoURL ? (
                    <img 
                      src={v.storeLogo || v.photoURL} 
                      alt={v.storeName || 'Store'} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.textContent = v.storeName?.charAt(0) || 'S';
                        }
                      }}
                    />
                  ) : (
                    v.storeName?.charAt(0) || 'S'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-orange-600 transition-colors line-clamp-1">
                    {v.storeName}
                  </h3>
                  {v.location && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                      <p className="text-xs text-neutral-500 line-clamp-1">{v.location}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product Display Section */}
        {(viewMode === 'products' || selectedVendorId) && (
          <>
            {/* Quick Sale Button (for POS mode) */}
            {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.SELLER || role === UserRole.MANAGER) && (
              <div className="mb-4">
                <button
                  onClick={() => setIsQuickSaleOpen(true)}
                  className="w-full bg-gradient-to-r from-orange-600 to-orange-500 text-white py-3 rounded-xl font-bold hover:from-orange-500 hover:to-orange-400 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Quick Sale (Instant Checkout)
                </button>
              </div>
            )}

            {/* Enhanced Search Bar */}
            <SearchBar
              onSearch={setSearchQuery}
              placeholder="Search products by name, SKU, or barcode..."
              enableBarcode={true}
              onBarcodeScan={handleBarcodeInput}
              onOpenScanner={() => setIsScannerOpen(true)}
            />

            {/* Display Mode Switcher */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${
                    displayMode === 'grid'
                      ? 'bg-orange-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                  title="Grid View (POS Style)"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    displayMode === 'list'
                      ? 'bg-orange-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                  title="List View (Inventory Style)"
                >
                  <ListIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDisplayMode('catalog')}
                  className={`p-2 rounded-lg transition-colors ${
                    displayMode === 'catalog'
                      ? 'bg-orange-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                  title="Catalog View (Customer Style)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
              {filteredProducts.length > 0 && (
                <span className="text-sm text-neutral-500">
                  {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Category Filter */}
            {filteredProducts.length > 0 && (
              <CategoryFilter
                products={products}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
              />
            )}

            {/* Product Display - Grid Mode */}
            {displayMode === 'grid' && (
              <ProductGrid
                products={filteredProducts}
                onAddToCart={addToCart}
                onQuantityChange={(productId, quantity) => {
                  if (quantity === 0) {
                    removeFromCart(productId);
                  } else {
                    const item = cart.find(i => i.product.id === productId);
                    if (item) {
                      updateQuantity(productId, quantity - item.quantity);
                    }
                  }
                }}
                cartItems={cart}
                showStock={true}
                showStoreInfo={viewMode === 'products'}
                vendors={vendors}
                branches={branches}
              />
            )}

            {/* Product Display - List Mode */}
            {displayMode === 'list' && (
              <ProductList
                products={filteredProducts}
                onAddToCart={addToCart}
                onQuantityChange={(productId, quantity) => {
                  if (quantity === 0) {
                    removeFromCart(productId);
                  } else {
                    const item = cart.find(i => i.product.id === productId);
                    if (item) {
                      updateQuantity(productId, quantity - item.quantity);
                    }
                  }
                }}
                cartItems={cart}
                showStock={true}
              />
            )}

            {/* Product Display - Catalog Mode */}
            {displayMode === 'catalog' && (
              <ProductCatalog
                products={filteredProducts}
                onAddToCart={addToCart}
                cartItems={cart}
                showStoreInfo={true}
                vendors={vendors}
                branches={branches}
              />
            )}

            {/* Empty State */}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No products found</p>
                <p className="text-sm">Try adjusting your search or filters</p>
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                    }}
                    className="mt-4 text-orange-600 hover:text-orange-500 text-sm font-medium"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm flex flex-col h-auto lg:h-[calc(100vh-120px)] lg:sticky lg:top-24" data-cart-section>
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-600" /> 
            Your Cart 
            {cart.length > 0 && (
              <span className="ml-auto text-sm font-normal text-neutral-500">
                {cart.length} item{cart.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
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
                {item.product.image ? (
                  <img 
                    src={item.product.image} 
                    className="w-12 h-12 rounded-lg object-cover bg-neutral-100" 
                    alt={item.product.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                    <span className="text-xs text-neutral-400">{item.product.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-1">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-neutral-500">TZS {item.product.price.toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button 
                    onClick={() => updateQuantity(item.product.id, -1)} 
                    className="p-1 hover:text-orange-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.product.id, 1)} 
                    className="p-1 hover:text-orange-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <button 
                  onClick={() => removeFromCart(item.product.id)} 
                  className="text-neutral-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
            <span className="font-medium text-neutral-900 dark:text-white">TZS {subtotal.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm mb-2 text-green-600 dark:text-green-400 font-medium">
              <span>Discount</span>
              <span>- TZS {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-neutral-900 dark:text-white mb-4 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <span>Total</span>
            <span>TZS {totalAmount.toLocaleString()}</span>
          </div>
          <button 
            onClick={() => setIsCheckoutOpen(true)} 
            disabled={cart.length === 0}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20"
          >
            Checkout Now
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Confirm Order</h3>
              <button 
                onClick={() => setIsCheckoutOpen(false)} 
                className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Customer Details */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact Details</h4>
                <input 
                  type="text" 
                  placeholder="Your Name *" 
                  value={customerDetails.name} 
                  onChange={e => setCustomerDetails({...customerDetails, name: e.target.value})} 
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" 
                />
                <input 
                  type="tel" 
                  placeholder="Phone Number *" 
                  value={customerDetails.phone} 
                  onChange={e => setCustomerDetails({...customerDetails, phone: e.target.value})} 
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" 
                />
                <input 
                  type="text" 
                  placeholder="Delivery Address (Optional)" 
                  value={customerDetails.address} 
                  onChange={e => setCustomerDetails({...customerDetails, address: e.target.value})} 
                  className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" 
                />
              </div>

              {/* Sales Rep Selection (for vendors/pharmacies) */}
              {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && salesReps.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Sales Representative (Optional)</h4>
                  <select
                    value={selectedSalesRepId || ''}
                    onChange={e => setSelectedSalesRepId(e.target.value || null)}
                    className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  >
                    <option value="">None (Direct Sale)</option>
                    {salesReps.map(rep => (
                      <option key={rep.uid} value={rep.uid}>
                        {rep.name} {rep.commissionRate ? `(${rep.commissionRate}% commission)` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedSalesRepId && (() => {
                    const rep = salesReps.find(r => r.uid === selectedSalesRepId);
                    const commission = rep ? calculateOrderCommission({ total: totalAmount } as Order, rep) : 0;
                    return commission > 0 ? (
                      <p className="text-xs text-neutral-500">
                        Commission: {formatCommission(commission)}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Branch and Channel Selection */}
              {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Branch</h4>
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    >
                      <option value="all">All Branches / Main</option>
                      {userBranches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Channel</h4>
                    <select
                      value={selectedChannel}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    >
                      <option value="POS">POS / In-Store</option>
                      <option value="Online">Online</option>
                      <option value="Field">Field Sales</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Phone">Phone Order</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Delivery Type Selection */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Delivery Option</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDeliveryType('self-pickup')}
                    className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                      deliveryType === 'self-pickup'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300'
                    }`}
                  >
                    <Package className="w-5 h-5 text-orange-600" />
                    <div className="text-left">
                      <p className="font-medium text-neutral-900 dark:text-white text-sm">Self-Pickup</p>
                      <p className="text-xs text-neutral-500">Free</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setDeliveryType('home-delivery')}
                    className={`p-4 border-2 rounded-lg transition-all flex items-center gap-3 ${
                      deliveryType === 'home-delivery'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-orange-600" />
                    <div className="text-left">
                      <p className="font-medium text-neutral-900 dark:text-white text-sm">Home Delivery</p>
                      <p className="text-xs text-neutral-500">TZS {deliveryFee.toLocaleString()}</p>
                    </div>
                  </button>
                </div>
                {deliveryType === 'home-delivery' && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      Please provide your delivery address above. Delivery fee: <strong>TZS {deliveryFee.toLocaleString()}</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Discount Code */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Discount Code</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter code (e.g. SAVE10)" 
                    value={discountCode} 
                    onChange={e => setDiscountCode(e.target.value.toUpperCase())} 
                    className="flex-1 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none uppercase dark:text-white" 
                  />
                  <button 
                    onClick={applyDiscount} 
                    className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
                  <span className="font-medium text-neutral-900 dark:text-white">TZS {subtotal.toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm mb-1 text-green-600 dark:text-green-400 font-medium">
                    <span>Discount</span>
                    <span>- TZS {discountAmount.toLocaleString()}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600 dark:text-neutral-400">Tax (18% VAT)</span>
                    <span className="font-medium text-neutral-900 dark:text-white">TZS {taxAmount.toLocaleString()}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-neutral-600 dark:text-neutral-400">Delivery Fee</span>
                    <span className="font-medium text-neutral-900 dark:text-white">TZS {deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-neutral-200 dark:border-neutral-800 mt-2">
                  <span>Total to Pay</span>
                  <span>TZS {totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
              <button 
                onClick={() => handleCheckout(true)} 
                disabled={isProcessing}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 transition-all flex justify-center items-center gap-2 shadow-lg shadow-green-900/20 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}
                Order via WhatsApp
              </button>
              <button 
                onClick={() => handleCheckout(false)} 
                disabled={isProcessing}
                className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white py-3 rounded-xl font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
              >
                Place Standard Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Vendor Checkout */}
      {isMultiVendorCheckoutOpen && (
        <MultiVendorCheckout
          isOpen={isMultiVendorCheckoutOpen}
          onClose={() => setIsMultiVendorCheckoutOpen(false)}
          cart={cart}
          customerDetails={customerDetails}
          deliveryType={deliveryType}
          deliveryFee={deliveryFee}
          onOrderCreated={(orderId) => {
            setCart([]);
            saveCart([]).catch(console.error);
            setIsMultiVendorCheckoutOpen(false);
            setIsCheckoutOpen(false);
            showNotification("Multi-vendor order created! Vendors will verify your payments.", "success");
          }}
        />
      )}

      {/* Payment Modal (Single Vendor) */}
      {isPaymentModalOpen && pendingOrderData && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPendingOrderData(null);
            setPendingOrderAmount(0);
          }}
          orderData={pendingOrderData}
          amount={pendingOrderAmount}
          sellerId={selectedVendorId || cart[0]?.product.uid}
          onPaymentSubmitted={async (transactionRef: string, viaWhatsapp?: boolean) => {
            // Payment submitted - clear cart and close modals
            // WhatsApp redirect is handled in PaymentModal
            setCart([]);
            await saveCart([]);
            setIsPaymentModalOpen(false);
            setPendingOrderData(null);
            setPendingOrderAmount(0);
            // Notification is shown in PaymentModal
          }}
        />
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScan}
        products={products}
        onProductFound={(product) => {
          addToCart(product, 1);
          setIsScannerOpen(false);
        }}
      />
    </div>
  );
};
