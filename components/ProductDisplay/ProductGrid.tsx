/**
 * ProductGrid - Grid layout wrapper (Daily Sales style)
 */

import React from 'react';
import { Product, User, Branch } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
  onQuantityChange?: (productId: string, quantity: number) => void;
  cartItems?: Array<{ product: Product; quantity: number }>;
  showStock?: boolean;
  showStoreInfo?: boolean;
  vendors?: User[];
  branches?: Branch[];
  className?: string;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  onAddToCart,
  onQuantityChange,
  cartItems = [],
  showStock = true,
  showStoreInfo = false,
  vendors = [],
  branches = [],
  className = ''
}) => {
  const getCartQuantity = (productId: string) => {
    const item = cartItems.find(i => i.product.id === productId);
    return item?.quantity || 0;
  };

  const getVendor = (productUid: string) => {
    return vendors.find(v => v.uid === productUid);
  };

  const getBranch = (productUid: string) => {
    return branches.find(b => b.uid === productUid);
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          mode="grid"
          onAddToCart={onAddToCart}
          onQuantityChange={onQuantityChange}
          currentQuantity={getCartQuantity(product.id)}
          showQuantityControls={getCartQuantity(product.id) > 0}
          showStock={showStock}
          showStoreInfo={showStoreInfo}
          vendor={showStoreInfo ? getVendor(product.uid) : undefined}
          branch={showStoreInfo ? getBranch(product.uid) : undefined}
        />
      ))}
    </div>
  );
};

