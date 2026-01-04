/**
 * Skeleton Loading Components
 * Provides contextual loading states for better UX
 */

import React from 'react';

/**
 * Base Skeleton Component
 */
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-neutral-200 dark:bg-neutral-800 rounded';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer', // You'll need to add this animation to your CSS
    none: ''
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : variant === 'circular' ? width : '1rem')
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-label="Loading..."
    />
  );
};

/**
 * Product Card Skeleton
 */
export const ProductCardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 animate-pulse">
          <Skeleton variant="rectangular" height="200px" className="mb-4" />
          <Skeleton variant="text" width="80%" className="mb-2" />
          <Skeleton variant="text" width="60%" className="mb-4" />
          <div className="flex justify-between items-center">
            <Skeleton variant="text" width="100px" />
            <Skeleton variant="rectangular" width="80px" height="32px" />
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * Table Row Skeleton
 */
export const TableRowSkeleton: React.FC<{ columns: number; rows?: number }> = ({ columns, rows = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="p-4">
              <Skeleton variant="text" width={colIndex === 0 ? '60%' : '80%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/**
 * Dashboard Stats Skeleton
 */
export const DashboardStatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 animate-pulse">
          <Skeleton variant="text" width="40%" className="mb-4" />
          <Skeleton variant="text" width="60%" height="2rem" className="mb-2" />
          <Skeleton variant="text" width="50%" />
        </div>
      ))}
    </div>
  );
};

/**
 * List Item Skeleton
 */
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border-b border-neutral-200 dark:border-neutral-800 animate-pulse">
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" width="48px" height="48px" />
            <div className="flex-1">
              <Skeleton variant="text" width="60%" className="mb-2" />
              <Skeleton variant="text" width="40%" />
            </div>
            <Skeleton variant="rectangular" width="80px" height="32px" />
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * Form Skeleton
 */
export const FormSkeleton: React.FC<{ fields?: number }> = ({ fields = 5 }) => {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton variant="text" width="30%" className="mb-2" />
          <Skeleton variant="rectangular" height="40px" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton variant="rectangular" width="100px" height="40px" />
        <Skeleton variant="rectangular" width="100px" height="40px" />
      </div>
    </div>
  );
};
