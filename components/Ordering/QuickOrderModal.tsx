/**
 * QuickOrderModal - POS-style product selection and ordering for existing customers
 * Inspired by Daily Sales App - fast order creation workflow
 */

import React, { useState, useMemo } from 'react';
import { Customer, Product, Order, UserRole } from '../../types';
import { X, ShoppingCart, Check, Search, Grid, List as ListIcon, Minus, Plus } from 'lucide-react';
import { useAppContext } from '../../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { isOnline, queueOrder } from '../../services/offlineService';
import { calculateOrderCommission, formatCommission } from '../../utils/commissionUtils';
import { ProductGrid } from '../ProductDisplay/ProductGrid';
import { ProductList } from '../ProductDisplay/ProductList';
import { SearchBar } from '../ProductFilters/SearchBar';
import { CategoryFilter } from '../ProductFilters/CategoryFilter';

interface QuickOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  products: Product[];
  userRole: UserRole;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export const QuickOrderModal: React.FC<QuickOrderModalProps> = ({
  isOpen,
  onClose,
  customer,
  products,
  userRole
}) => {
  const { user, showNotification, allUsers } = useAppContext();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSalesRepId, setSelectedSalesRepId] = useState<string | null>(null);
  
  // Get sales reps for this vendor
  const salesReps = allUsers.filter(u => 
    u.role === UserRole.SALES_REP && 
    u.employerId === (userRole === UserRole.VENDOR || userRole === UserRole.PHARMACY ? user?.uid : user?.employerId)
  );

  // Filter products based on user role
  const availableProducts = useMemo(() => {
    if (!user) return [];
    
    const targetUid = (userRole === UserRole.VENDOR || userRole === UserRole.PHARMACY) 
      ? user.uid 
      : user.employerId;
    
    return products.filter(p => p.uid === targetUid && (p.status === 'Active' || !p.status));
  }, [products, user, userRole]);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    let filtered = availableProducts.filter(p => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBarcode = p.barcode?.toLowerCase().includes(query);
        if (!matchesName && !matchesBarcode) return false;
      }
      
      // Category filter
      if (selectedCategory && p.category !== selectedCategory) return false;
      
      return true;
    });
    
    return filtered;
  }, [availableProducts, searchQuery, selectedCategory]);

  const addToCart = (product: Product, quantity: number = 1) => {
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
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
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

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      showNotification('Cart is empty', 'error');
      return;
    }

    if (!user) {
      showNotification('User session not found', 'error');
      return;
    }

    setIsProcessing(true);

    const sellerId = (userRole === UserRole.VENDOR || userRole === UserRole.PHARMACY) 
      ? user.uid 
      : user.employerId;

    // Get sales rep if selected
    const salesRep = selectedSalesRepId ? salesReps.find(r => r.uid === selectedSalesRepId) : null;
    const commission = salesRep ? calculateOrderCommission({ total: subtotal } as Order, salesRep) : undefined;

    // Construct Order Data (only include defined values - Firestore doesn't allow undefined)
    const orderData: any = {
      sellerId: sellerId || '',
      customerId: customer.id,
      customerName: customer.fullName,
      customerPhone: customer.phone,
      date: new Date().toISOString(),
      status: 'Pending',
      total: subtotal,
      items: cart.map(i => ({
        productId: i.product.id,
        name: i.product.name,
        price: i.product.price,
        quantity: i.quantity
      })),
      createdAt: new Date().toISOString()
    };

    // Only add optional fields if they have values
    if (customer.residentAddress || customer.address) {
      orderData.deliveryAddress = customer.residentAddress || customer.address || '';
    }
    if (salesRep?.uid) {
      orderData.salesRepId = salesRep.uid;
    }
    if (salesRep?.name) {
      orderData.salesRepName = salesRep.name;
    }
    if (commission && commission > 0) {
      orderData.commission = commission;
    }

    try {
      const online = isOnline();
      
      if (online && isFirebaseEnabled && db) {
        // Online: Save directly to Firestore
        await addDoc(collection(db, 'orders'), orderData);
        showNotification(`Order placed successfully for ${customer.fullName}!`, 'success');
        setCart([]);
        onClose();
      } else if (!online) {
        // Offline: Queue order for sync
        const orderWithId: Order = {
          ...orderData,
          id: `offline_${Date.now()}`,
        } as Order;
        
        await queueOrder(orderWithId);
        showNotification(`Order queued for ${customer.fullName}. Will sync when online.`, 'info');
        setCart([]);
        onClose();
      } else {
        showNotification('Database connection unavailable', 'error');
      }
    } catch (error: any) {
      console.error('Error placing order:', error);
      showNotification(`Failed to place order: ${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
          <div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Quick Order</h3>
            <p className="text-sm text-neutral-500">
              {customer.fullName} • {customer.phone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Product Selection Area */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-neutral-200 dark:border-neutral-800">
            {/* Search and Filters */}
            <div className="p-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950">
              <SearchBar
                onSearch={setSearchQuery}
                placeholder="Search products by name or barcode..."
                enableBarcode={true}
                onBarcodeScan={(barcode) => {
                  const product = availableProducts.find(p => p.barcode === barcode);
                  if (product) {
                    addToCart(product, 1);
                  } else {
                    showNotification('Product not found', 'error');
                  }
                }}
              />

              {/* Display Mode Switcher */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDisplayMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      displayMode === 'grid'
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDisplayMode('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      displayMode === 'list'
                        ? 'bg-orange-600 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-700'
                    }`}
                    title="List View"
                  >
                    <ListIcon className="w-4 h-4" />
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
                  products={availableProducts}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
              )}
            </div>

            {/* Product List/Grid */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {displayMode === 'grid' ? (
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
                  cartItems={cart.map(i => ({ product: i.product, quantity: i.quantity }))}
                  showStock={true}
                />
              ) : (
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
                  cartItems={cart.map(i => ({ product: i.product, quantity: i.quantity }))}
                  showStock={true}
                />
              )}

              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-neutral-500">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No products found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="w-96 bg-neutral-50 dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-orange-600" />
                Cart ({cart.length})
              </h4>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
                  <ShoppingCart className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3 mb-2">
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
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
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
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">
                        TZS {(item.product.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Order Summary & Actions */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Subtotal</span>
                  <span className="font-medium text-neutral-900 dark:text-white">
                    TZS {subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-lg text-neutral-900 dark:text-white pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <span>Total</span>
                  <span>TZS {subtotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={cart.length === 0 || isProcessing}
                className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Place Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

