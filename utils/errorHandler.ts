/**
 * Error Handling Utility
 * Standardizes error handling across the application
 */

export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export class ErrorHandler {
  /**
   * Handle Firebase errors
   */
  static handleFirebaseError(error: any): AppError {
    const errorCode = error.code || 'unknown';
    const errorMessage = this.getFirebaseErrorMessage(errorCode, error.message);
    
    return {
      code: errorCode,
      message: errorMessage,
      details: error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get user-friendly error messages for Firebase error codes
   */
  private static getFirebaseErrorMessage(code: string, defaultMessage?: string): string {
    const errorMessages: { [key: string]: string } = {
      // Auth errors
      'auth/user-not-found': 'No account found with this email address.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/weak-password': 'Password is too weak. Please use a stronger password.',
      'auth/invalid-email': 'Invalid email address format.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/operation-not-allowed': 'This operation is not allowed.',
      'auth/requires-recent-login': 'Please log out and log back in to complete this action.',
      
      // Firestore errors
      'permission-denied': 'You do not have permission to perform this action.',
      'unauthenticated': 'Please log in to continue.',
      'not-found': 'The requested resource was not found.',
      'already-exists': 'This resource already exists.',
      'failed-precondition': 'Database index required. Please contact support.',
      'aborted': 'Operation was cancelled. Please try again.',
      'out-of-range': 'The operation is out of valid range.',
      'unimplemented': 'This feature is not yet implemented.',
      'internal': 'An internal error occurred. Please try again.',
      'unavailable': 'Service is temporarily unavailable. Please check your connection and try again.',
      'data-loss': 'Data corruption detected. Please contact support.',
      'deadline-exceeded': 'Operation timed out. Please try again.',
      
      // Generic
      'unknown': defaultMessage || 'An unexpected error occurred. Please try again.',
    };

    return errorMessages[code] || defaultMessage || 'An error occurred. Please try again.';
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(errors: string[]): AppError {
    return {
      code: 'validation-error',
      message: errors.join(', '),
      details: { errors },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle API errors
   */
  static handleApiError(error: any): AppError {
    if (error.code && error.message) {
      return this.handleFirebaseError(error);
    }

    return {
      code: 'api-error',
      message: error.message || 'An API error occurred',
      details: error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log error (can be extended to send to error tracking service)
   */
  static logError(error: AppError, context?: string): void {
    const logMessage = `[${error.timestamp}] ${context || 'Error'}: ${error.code} - ${error.message}`;
    
    console.error(logMessage, error.details);
    
    // Integrate with Sentry if configured
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      try {
        (window as any).Sentry.captureException(error, {
          tags: { source: context },
          extra: { errorDetails: error.details },
        });
      } catch (sentryError) {
        console.warn('Failed to send error to Sentry:', sentryError);
      }
    }
    // if (window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }

  /**
   * Format error for user display
   */
  static formatForUser(error: AppError): string {
    return error.message;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: AppError): boolean {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'aborted',
      'internal',
      'too-many-requests'
    ];
    
    return retryableCodes.includes(error.code);
  }

  /**
   * Get retry delay in milliseconds
   */
  static getRetryDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    return Math.min(1000 * Math.pow(2, attempt), 30000);
  }
}

/**
 * Global error handler for unhandled errors
 */
export function setupGlobalErrorHandler(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = ErrorHandler.handleApiError(event.reason);
    ErrorHandler.logError(error, 'Unhandled Promise Rejection');
    event.preventDefault();
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    const error: AppError = {
      code: 'uncaught-error',
      message: event.message || 'An unexpected error occurred',
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error
      },
      timestamp: new Date().toISOString()
    };
    
    ErrorHandler.logError(error, 'Uncaught Error');
  });
}

/**
 * Retry function with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  onRetry?: (attempt: number, error: AppError) => void
): Promise<T> {
  let lastError: AppError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = ErrorHandler.handleApiError(error);
      
      if (attempt < maxRetries && ErrorHandler.isRetryable(lastError)) {
        const delay = ErrorHandler.getRetryDelay(attempt);
        onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw lastError;
    }
  }

  throw lastError || ErrorHandler.handleApiError(new Error('Operation failed'));
}

