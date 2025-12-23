/**
 * QuantitySelector - Reusable +/- quantity controls
 */

import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onIncrease,
  onDecrease,
  min = 0,
  max,
  disabled = false,
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'p-0.5 w-6 h-6',
    md: 'p-1 w-8 h-8',
    lg: 'p-1.5 w-10 h-10'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const canDecrease = !disabled && quantity > min;
  const canIncrease = !disabled && (max === undefined || quantity < max);

  return (
    <div className={`inline-flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg ${className}`}>
      <button
        onClick={onDecrease}
        disabled={!canDecrease}
        className={`${sizeClasses[size]} flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${
          canDecrease ? 'text-neutral-700 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400' : 'text-neutral-400 cursor-not-allowed'
        }`}
        aria-label="Decrease quantity"
      >
        <Minus className={iconSizes[size]} />
      </button>
      <span className={`${textSizes[size]} font-medium w-6 text-center text-neutral-900 dark:text-white`}>
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        disabled={!canIncrease}
        className={`${sizeClasses[size]} flex items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors ${
          canIncrease ? 'text-neutral-700 dark:text-neutral-300 hover:text-orange-600 dark:hover:text-orange-400' : 'text-neutral-400 cursor-not-allowed'
        }`}
        aria-label="Increase quantity"
      >
        <Plus className={iconSizes[size]} />
      </button>
    </div>
  );
};

