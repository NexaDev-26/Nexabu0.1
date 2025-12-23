/**
 * SearchBar - Enhanced search with SKU and barcode support
 */

import React, { useState, useEffect } from 'react';
import { Search, X, ScanLine, Camera } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  enableBarcode?: boolean;
  onBarcodeScan?: (barcode: string) => void;
  onOpenScanner?: () => void;
  className?: string;
  debounceMs?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search products...',
  enableBarcode = false,
  onBarcodeScan,
  onOpenScanner,
  className = '',
  debounceMs = 300
}) => {
  const [query, setQuery] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, onSearch, debounceMs]);

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Auto-detect barcode format (typically numeric, 8-13 digits)
    const isBarcode = /^\d{8,13}$/.test(value.trim());
    if (isBarcode && onBarcodeScan && value.length >= 8) {
      onBarcodeScan(value.trim());
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleBarcodeInput}
        className="w-full pl-10 pr-10 p-3 border rounded-xl dark:bg-neutral-800 dark:border-neutral-700 dark:text-white outline-none focus:ring-2 focus:ring-orange-500"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {enableBarcode && onOpenScanner && (
        <button
          onClick={onOpenScanner}
          className="absolute right-10 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 p-1"
          title="Open barcode scanner"
        >
          <Camera className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

