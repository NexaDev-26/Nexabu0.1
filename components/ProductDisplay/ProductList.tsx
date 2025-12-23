/**
 * ProductList - List layout wrapper (Ghala.tz style)
 */

import React from 'react';
import { Product, User } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductListProps {
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
  onQuantityChange?: (productId: string, quantity: number) => void;
  cartItems?: Array<{ product: Product; quantity: number }>;
  showStock?: boolean;
  className?: string;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  onAddToCart,
  onQuantityChange,
  cartItems = [],
  showStock = true,
  className = ''
}) => {
  const getCartQuantity = (productId: string) => {
    const item = cartItems.find(i => i.product.id === productId);
    return item?.quantity || 0;
  };

  if (products.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p>No products found</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          mode="list"
          onAddToCart={onAddToCart}
          onQuantityChange={onQuantityChange}
          currentQuantity={getCartQuantity(product.id)}
          showQuantityControls={getCartQuantity(product.id) > 0}
          showStock={showStock}
        />
      ))}
    </div>
  );
};

