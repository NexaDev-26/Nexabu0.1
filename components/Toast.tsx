/**
 * Toast Notification Component
 * Enhanced notification system with animations, stacking, and auto-dismiss
 */

import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastComponent: React.FC<ToastProps> = ({ toast, onDismiss, position = 'top-right' }) => {
  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        onDismiss(toast.id);
      }, toast.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
        return <Info className="w-5 h-5" />;
    }
  };

  const getStyles = () => {
    const baseStyles = 'min-w-[300px] max-w-md p-4 rounded-xl shadow-2xl border flex items-start gap-3 animate-fade-in';
    const typeStyles = {
      success: 'bg-green-600 text-white border-green-700',
      error: 'bg-red-600 text-white border-red-700',
      warning: 'bg-yellow-600 text-white border-yellow-700',
      info: 'bg-blue-600 text-white border-blue-700'
    };
    return `${baseStyles} ${typeStyles[toast.type]}`;
  };

  const getPositionStyles = () => {
    const positions = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
      'top-center': 'top-4 left-1/2 -translate-x-1/2',
      'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
    };
    return `fixed ${positions[position]} z-[100]`;
  };

  return (
    <div className={`${getPositionStyles()} ${getStyles()}`}>
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 text-sm font-semibold underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/**
 * Toast Container - Manages multiple toasts
 */
interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: ToastProps['position'];
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss, position = 'top-right' }) => {
  return (
    <div className="fixed z-[100] pointer-events-none" style={{ [position.includes('top') ? 'top' : 'bottom']: '1rem', [position.includes('right') ? 'right' : position.includes('left') ? 'left' : 'left']: position.includes('center') ? '50%' : '1rem', transform: position.includes('center') ? 'translateX(-50%)' : 'none' }}>
      <div className="flex flex-col gap-2 pointer-events-auto" style={{ alignItems: position.includes('right') ? 'flex-end' : position.includes('left') ? 'flex-start' : 'center' }}>
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            style={{
              transform: `translateY(${index * 8}px)`,
              opacity: 1 - index * 0.1
            }}
            className="transition-all duration-300"
          >
            <ToastComponent toast={toast} onDismiss={onDismiss} position={position} />
          </div>
        ))}
      </div>
    </div>
  );
};
