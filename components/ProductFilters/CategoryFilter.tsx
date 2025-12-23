/**
 * CategoryFilter - Filter products by category
 */

import React from 'react';
import { Product } from '../../types';
import { X } from 'lucide-react';

interface CategoryFilterProps {
  products: Product[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  className?: string;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  products,
  selectedCategory,
  onCategoryChange,
  className = ''
}) => {
  // Extract unique categories from products
  const categories = React.useMemo(() => {
    const cats = products
      .map(p => p.category)
      .filter((cat): cat is string => Boolean(cat))
      .filter((cat, index, self) => self.indexOf(cat) === index)
      .sort();
    
    return cats;
  }, [products]);

  if (categories.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button
        onClick={() => onCategoryChange(null)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          selectedCategory === null
            ? 'bg-orange-600 text-white'
            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
        }`}
      >
        All
      </button>
      {categories.map(category => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedCategory === category
              ? 'bg-orange-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          {category}
        </button>
      ))}
      {selectedCategory && (
        <button
          onClick={() => onCategoryChange(null)}
          className="px-3 py-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          title="Clear filter"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

