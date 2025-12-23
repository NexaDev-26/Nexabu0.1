/**
 * ProductCatalog - Catalog layout wrapper (TakeApp style)
 */

import React from 'react';
import { Product, User } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductCatalogProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
  cartItems?: Array<{ product: Product; quantity: number }>;
  showStoreInfo?: boolean;
  vendors?: User[];
  className?: string;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  products,
  onAddToCart,
  cartItems = [],
  showStoreInfo = true,
  vendors = [],
  className = ''
}) => {
  const getVendor = (productUid: string) => {
    return vendors.find(v => v.uid === productUid);
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${className}`}>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          mode="catalog"
          onAddToCart={onAddToCart}
          showStoreInfo={showStoreInfo}
          vendor={showStoreInfo ? getVendor(product.uid) : undefined}
        />
      ))}
    </div>
  );
};

