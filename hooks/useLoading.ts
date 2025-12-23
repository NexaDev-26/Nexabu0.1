/**
 * Loading State Management Hook
 * Provides consistent loading state management across components
 */

import { useState, useCallback } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  startLoading: () => void;
  stopLoading: () => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Hook for managing loading state
 */
export function useLoading(initialState: boolean = false): LoadingState {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState<string | null>(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setError,
    reset
  };
}

/**
 * Hook for managing async operations with loading state
 */
export function useAsyncOperation<T>() {
  const loading = useLoading();
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(async (
    operation: () => Promise<T>,
    onSuccess?: (data: T) => void,
    onError?: (error: string) => void
  ) => {
    loading.startLoading();
    try {
      const result = await operation();
      setData(result);
      loading.stopLoading();
      onSuccess?.(result);
      return result;
    } catch (error: any) {
      const errorMessage = error.message || 'An error occurred';
      loading.setError(errorMessage);
      loading.stopLoading();
      onError?.(errorMessage);
      throw error;
    }
  }, [loading]);

  return {
    ...loading,
    data,
    execute,
    setData
  };
}

/**
 * Hook for managing multiple loading states
 */
export function useMultipleLoading(keys: string[]) {
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>(
    keys.reduce((acc, key) => ({ ...acc, [key]: false }), {})
  );

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: isLoading }));
  }, []);

  const startLoading = useCallback((key: string) => {
    setLoading(key, true);
  }, [setLoading]);

  const stopLoading = useCallback((key: string) => {
    setLoading(key, false);
  }, [setLoading]);

  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  const isAnyLoading = Object.values(loadingStates).some(state => state === true);

  return {
    loadingStates,
    setLoading,
    startLoading,
    stopLoading,
    isLoading,
    isAnyLoading
  };
}

