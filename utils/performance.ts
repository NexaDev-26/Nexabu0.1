/**
 * Performance Utilities
 * Helper functions for performance monitoring and optimization
 */

/**
 * Measure function execution time
 */
export function measurePerformance<T>(
  fn: () => T,
  label?: string
): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  const duration = end - start;

  if (label) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  return result;
}

/**
 * Measure async function execution time
 */
export async function measureAsyncPerformance<T>(
  fn: () => Promise<T>,
  label?: string
): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  const duration = end - start;

  if (label) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
  }

  return result;
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Batch function calls
 */
export function batch<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void> | void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let index = 0;

    function processBatch() {
      const batch = items.slice(index, index + batchSize);
      if (batch.length === 0) {
        resolve();
        return;
      }

      try {
        const result = processor(batch);
        if (result instanceof Promise) {
          result
            .then(() => {
              index += batchSize;
              processBatch();
            })
            .catch(reject);
        } else {
          index += batchSize;
          processBatch();
        }
      } catch (error) {
        reject(error);
      }
    }

    processBatch();
  });
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator
      ? keyGenerator(...args)
      : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Lazy load image
 */
export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  placeholder?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (placeholder) {
      img.src = placeholder;
    }

    const imageLoader = new Image();
    imageLoader.onload = () => {
      img.src = src;
      resolve();
    };
    imageLoader.onerror = reject;
    imageLoader.src = src;
  });
}

/**
 * Get memory usage (if available)
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
    };
  }
  return null;
}

/**
 * Request animation frame wrapper
 */
export function raf(callback: () => void): number {
  return requestAnimationFrame(callback);
}

/**
 * Cancel animation frame wrapper
 */
export function cancelRaf(id: number): void {
  cancelAnimationFrame(id);
}

/**
 * Idle callback wrapper
 */
export function idle(callback: () => void, options?: { timeout?: number }): number | null {
  if ('requestIdleCallback' in window) {
    return (window as any).requestIdleCallback(callback, options);
  }
  // Fallback to setTimeout if requestIdleCallback is not available
  return setTimeout(callback, options?.timeout || 0) as any;
}

/**
 * Cancel idle callback wrapper
 */
export function cancelIdle(id: number): void {
  if ('cancelIdleCallback' in window) {
    (window as any).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

