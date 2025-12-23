/**
 * ProductCard - Unified product card component
 * Supports multiple display modes: grid, list, catalog
 */

import React from 'react';
import { Product, User } from '../../types';
import { Plus, Minus, AlertTriangle, Store, MapPin } from 'lucide-react';

export type ProductCardMode = 'grid' | 'list' | 'catalog';

interface ProductCardProps {
  product: Product;
  mode: ProductCardMode;
  onAddToCart: (product: Product, quantity: number) => void;
  onQuantityChange?: (productId: string, quantity: number) => void;
  currentQuantity?: number;
  showQuantityControls?: boolean;
  showStock?: boolean;
  showStoreInfo?: boolean;
  vendor?: User;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  mode,
  onAddToCart,
  onQuantityChange,
  currentQuantity = 0,
  showQuantityControls = false,
  showStock = true,
  showStoreInfo = false,
  vendor,
  className = ''
}) => {
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice < product.price;
  const displayPrice = hasDiscount ? product.discountPrice! : product.price;
  const discountPercent = hasDiscount && product.price
    ? Math.round(((product.price - (product.discountPrice || product.price)) / product.price) * 100)
    : 0;

  const getVendorInitials = (name?: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  };
  
  const isOutOfStock = showStock && product.trackInventory && (product.stock || 0) <= 0;
  const isLowStock = showStock && product.trackInventory && product.minStockLevel 
    ? (product.stock || 0) <= product.minStockLevel && (product.stock || 0) > 0
    : false;

  const handleAddClick = () => {
    if (!isOutOfStock) {
      onAddToCart(product, 1);
    }
  };

  const handleQuantityChange = (delta: number) => {
    if (onQuantityChange && !isOutOfStock) {
      const newQuantity = Math.max(0, currentQuantity + delta);
      onQuantityChange(product.id, newQuantity);
    }
  };

  // Grid Mode (Daily Sales style - compact, visual)
  if (mode === 'grid') {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden group hover:shadow-md transition-all ${isOutOfStock ? 'opacity-60' : ''} ${className}`}>
        <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
          {product.image ? (
            <img 
              src={product.image} 
              className="w-full h-full object-cover" 
              alt={product.name}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-400">
              <Store className="w-12 h-12" />
            </div>
          )}
          {hasDiscount && discountPercent > 0 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-md">
              -{discountPercent}%
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-bold">Out of Stock</span>
            </div>
          )}
          {isLowStock && (
            <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Low Stock
            </div>
          )}
          {!isOutOfStock && (
            <button
              onClick={handleAddClick}
              className="absolute bottom-2 right-2 bg-white dark:bg-neutral-900 p-2 rounded-full shadow-lg text-orange-600 hover:scale-110 transition-transform"
              title="Add to cart"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-medium text-neutral-900 dark:text-white text-sm line-clamp-1 mb-1">{product.name}</h3>
          {showStoreInfo && vendor && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex items-center justify-center text-[10px] font-bold text-neutral-700 dark:text-neutral-200">
                {vendor.storeLogo ? (
                  <img
                    src={vendor.storeLogo}
                    className="w-full h-full object-cover"
                    alt={vendor.storeName || vendor.name || 'Store'}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : vendor.photoURL ? (
                  <img
                    src={vendor.photoURL}
                    className="w-full h-full object-cover"
                    alt={vendor.storeName || vendor.name || 'Store'}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span>{getVendorInitials(vendor.storeName || vendor.name)}</span>
                )}
              </div>
              <span className="text-xs text-neutral-500 line-clamp-1">{vendor.storeName || vendor.name || 'Store'}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {hasDiscount ? (
              <>
                <p className="text-orange-600 dark:text-orange-400 font-bold text-sm">TZS {displayPrice.toLocaleString()}</p>
                <p className="text-neutral-400 dark:text-neutral-500 text-xs line-through">TZS {product.price.toLocaleString()}</p>
              </>
            ) : (
              <p className="text-orange-600 dark:text-orange-400 font-bold text-sm">TZS {displayPrice.toLocaleString()}</p>
            )}
          </div>
          {showStock && product.trackInventory && (
            <p className="text-xs text-neutral-500">
              {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock || 0} ${product.unit || 'pcs'}`}
            </p>
          )}
          {showQuantityControls && currentQuantity > 0 && (
            <div className="flex items-center gap-2 mt-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
              <button
                onClick={() => handleQuantityChange(-1)}
                className="p-1 hover:text-orange-600"
                disabled={currentQuantity <= 0}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs font-medium w-6 text-center">{currentQuantity}</span>
              <button
                onClick={() => handleQuantityChange(1)}
                className="p-1 hover:text-orange-600"
                disabled={isOutOfStock}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // List Mode (Ghala.tz style - compact, text-heavy)
  if (mode === 'list') {
    return (
      <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${isOutOfStock ? 'opacity-60' : ''} ${className}`}>
        <div className="flex items-center gap-3">
          {product.image && (
            <img 
              src={product.image} 
              className="w-16 h-16 rounded-lg object-cover bg-neutral-100 flex-shrink-0" 
              alt={product.name}
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-neutral-900 dark:text-white text-sm line-clamp-1">{product.name}</h3>
                {(product as any).sku && (
                  <p className="text-xs text-neutral-500 mt-0.5">SKU: {(product as any).sku}</p>
                )}
                {showStoreInfo && vendor && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden flex items-center justify-center text-[10px] font-bold text-neutral-700 dark:text-neutral-200">
                      {vendor.storeLogo ? (
                        <img
                          src={vendor.storeLogo}
                          className="w-full h-full object-cover"
                          alt={vendor.storeName || vendor.name || 'Store'}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : vendor.photoURL ? (
                        <img
                          src={vendor.photoURL}
                          className="w-full h-full object-cover"
                          alt={vendor.storeName || vendor.name || 'Store'}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span>{getVendorInitials(vendor.storeName || vendor.name)}</span>
                      )}
                    </div>
                    <span className="text-xs text-neutral-500 line-clamp-1">{vendor.storeName || vendor.name || 'Store'}</span>
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {hasDiscount ? (
                  <div className="flex flex-col items-end">
                    <p className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                      TZS {displayPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-neutral-400 line-through">
                      TZS {product.price.toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="font-bold text-orange-600 dark:text-orange-400 text-sm">
                    TZS {displayPrice.toLocaleString()}
                  </p>
                )}
                {showStock && product.trackInventory && (
                  <p className={`text-xs mt-0.5 ${
                    isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : 'text-neutral-500'
                  }`}>
                    {isOutOfStock ? 'Out' : `${product.stock || 0} ${product.unit || 'pcs'}`}
                  </p>
                )}
              </div>
            </div>
          </div>
          {!isOutOfStock && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {showQuantityControls && currentQuantity > 0 ? (
                <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    className="p-1 hover:text-orange-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-medium w-6 text-center">{currentQuantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    className="p-1 hover:text-orange-600"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleAddClick}
                  className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-500 transition-colors"
                  title="Add to cart"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Catalog Mode (TakeApp style - customer-facing, beautiful)
  return (
    <div className={`bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden group hover:shadow-lg transition-all ${isOutOfStock ? 'opacity-60' : ''} ${className}`}>
      <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
        {product.image ? (
          <img 
            src={product.image} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            alt={product.name}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400">
            <Store className="w-16 h-16" />
          </div>
        )}
        {hasDiscount && discountPercent > 0 && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg">
            -{discountPercent}% OFF
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Out of Stock</span>
          </div>
        )}
        {!isOutOfStock && (
          <button
            onClick={handleAddClick}
            className="absolute bottom-3 right-3 bg-white dark:bg-neutral-900 p-3 rounded-full shadow-xl text-orange-600 hover:scale-110 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
            title="Add to cart"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-white text-base mb-2 line-clamp-2">{product.name}</h3>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            {hasDiscount && product.price ? (
              <>
                <p className="text-orange-600 dark:text-orange-400 font-bold text-lg">TZS {displayPrice.toLocaleString()}</p>
                <p className="text-neutral-400 dark:text-neutral-500 text-sm line-through">TZS {product.price.toLocaleString()}</p>
              </>
            ) : (
              <p className="text-orange-600 dark:text-orange-400 font-bold text-lg">TZS {displayPrice.toLocaleString()}</p>
            )}
          </div>
        </div>
        {showStoreInfo && vendor && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {vendor.storeLogo || vendor.photoURL ? (
                  <img 
                    src={vendor.storeLogo || vendor.photoURL} 
                    alt={vendor.storeName || 'Store'} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="w-3 h-3 text-neutral-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 line-clamp-1">
                  {vendor.storeName}
                </p>
                {vendor.location && (
                  <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="line-clamp-1">{vendor.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {showStock && product.trackInventory && !isOutOfStock && (
          <p className="text-xs text-neutral-500 mt-2">
            {product.stock || 0} {product.unit || 'pcs'} available
          </p>
        )}
      </div>
    </div>
  );
};

