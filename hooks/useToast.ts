/**
 * Toast notification hook
 * Manages toast notifications with stacking support
 */

import { useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = 5000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      id,
      message,
      type,
      duration,
      action
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, duration?: number, action?: { label: string; onClick: () => void }) => {
    return showToast(message, 'success', duration, action);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number, action?: { label: string; onClick: () => void }) => {
    return showToast(message, 'error', duration, action);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number, action?: { label: string; onClick: () => void }) => {
    return showToast(message, 'warning', duration, action);
  }, [showToast]);

  const info = useCallback((message: string, duration?: number, action?: { label: string; onClick: () => void }) => {
    return showToast(message, 'info', duration, action);
  }, [showToast]);

  return {
    toasts,
    showToast,
    dismissToast,
    dismissAll,
    success,
    error,
    warning,
    info
  };
}
