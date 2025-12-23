/**
 * Input Validation Utilities
 * Provides validation schemas and functions for all entities
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ValidationSchema {
  [key: string]: {
    required?: boolean;
    type?: 'string' | 'number' | 'email' | 'phone' | 'date' | 'url' | 'array';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  };
}

/**
 * Validate a single field
 */
function validateField(
  fieldName: string,
  value: any,
  rules: ValidationSchema[string]
): string | null {
  // Required check
  if (rules.required && (value === undefined || value === null || value === '')) {
    return `${fieldName} is required`;
  }

  // Skip other validations if value is empty and not required
  if (!rules.required && (value === undefined || value === null || value === '')) {
    return null;
  }

  // Type check
  if (rules.type) {
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${fieldName} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${fieldName} must be a number`;
        }
        break;
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return `${fieldName} must be a valid email address`;
        }
        break;
      case 'phone':
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!phoneRegex.test(value)) {
          return `${fieldName} must be a valid phone number`;
        }
        break;
      case 'date':
        if (isNaN(Date.parse(value))) {
          return `${fieldName} must be a valid date`;
        }
        break;
      case 'url':
        try {
          new URL(value);
        } catch {
          return `${fieldName} must be a valid URL`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `${fieldName} must be an array`;
        }
        break;
    }
  }

  // String length checks
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `${fieldName} must be at least ${rules.minLength} characters`;
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return `${fieldName} must be no more than ${rules.maxLength} characters`;
    }
  }

  // Number range checks
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return `${fieldName} must be at least ${rules.min}`;
    }
    if (rules.max !== undefined && value > rules.max) {
      return `${fieldName} must be no more than ${rules.max}`;
    }
  }

  // Pattern check
  if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
    return `${fieldName} format is invalid`;
  }

  // Custom validation
  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Validate an object against a schema
 */
export function validate(data: any, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];

  for (const [fieldName, rules] of Object.entries(schema)) {
    const error = validateField(fieldName, data[fieldName], rules);
    if (error) {
      errors.push(error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validation Schemas for all entities
 */
export const validationSchemas = {
  user: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' },
    phone: { type: 'phone' },
    role: { required: true, type: 'string' },
    storeName: { type: 'string', maxLength: 200 },
  } as ValidationSchema,

  product: {
    name: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    price: { required: true, type: 'number', min: 0 },
    stock: { required: true, type: 'number', min: 0 },
    buyingPrice: { type: 'number', min: 0 },
    description: { type: 'string', maxLength: 1000 },
    barcode: { type: 'string', maxLength: 50 },
    category: { type: 'string', maxLength: 100 },
  } as ValidationSchema,

  customer: {
    fullName: { required: true, type: 'string', minLength: 2, maxLength: 100 },
    email: { type: 'email' },
    phone: { required: true, type: 'phone' },
    type: { required: true, type: 'string' },
    openingBalance: { type: 'number' },
  } as ValidationSchema,

  order: {
    customerName: { required: true, type: 'string', minLength: 2 },
    total: { required: true, type: 'number', min: 0 },
    items: { required: true, type: 'array', custom: (value: any) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Order must have at least one item';
      }
      return null;
    }},
    date: { required: true, type: 'date' },
  } as ValidationSchema,

  expense: {
    amount: { required: true, type: 'number', min: 0 },
    categoryId: { required: true, type: 'string' },
    description: { required: true, type: 'string', minLength: 3, maxLength: 500 },
    date: { required: true, type: 'date' },
    paymentMethod: { required: true, type: 'string' },
  } as ValidationSchema,

  invoice: {
    customerId: { required: true, type: 'string' },
    customerName: { required: true, type: 'string', minLength: 2 },
    invoiceNumber: { required: true, type: 'string' },
    items: { required: true, type: 'array', custom: (value: any) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Invoice must have at least one item';
      }
      return null;
    }},
    issueDate: { required: true, type: 'date' },
    dueDate: { required: true, type: 'date' },
    totalAmount: { required: true, type: 'number', min: 0 },
  } as ValidationSchema,

  bill: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 200 },
    amount: { required: true, type: 'number', min: 0 },
    dueDate: { required: true, type: 'date' },
    category: { required: true, type: 'string' },
  } as ValidationSchema,

  supplier: {
    name: { required: true, type: 'string', minLength: 2, maxLength: 200 },
    contactPerson: { required: true, type: 'string', minLength: 2 },
    phone: { required: true, type: 'phone' },
    email: { type: 'email' },
  } as ValidationSchema,

  purchaseOrder: {
    supplierId: { required: true, type: 'string' },
    items: { required: true, type: 'array', custom: (value: any) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Purchase order must have at least one item';
      }
      return null;
    }},
    totalCost: { required: true, type: 'number', min: 0 },
    dateIssued: { required: true, type: 'date' },
  } as ValidationSchema,
};

/**
 * Sanitize string input (prevent XSS)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim();
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(input: any): number {
  const num = parseFloat(input);
  return isNaN(num) ? 0 : num;
}

/**
 * Format phone number
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 9) {
    return `+255${digits}`;
  } else if (digits.length === 12 && digits.startsWith('255')) {
    return `+${digits}`;
  } else if (digits.length === 13 && digits.startsWith('255')) {
    return `+${digits}`;
  }
  
  return phone; // Return original if format is unclear
}

/**
 * Validate and sanitize form data
 */
export function validateAndSanitize<T>(
  data: any,
  schema: ValidationSchema
): { isValid: boolean; errors: string[]; sanitized: Partial<T> } {
  const validation = validate(data, schema);
  
  const sanitized: any = {};
  for (const key in data) {
    if (typeof data[key] === 'string') {
      sanitized[key] = sanitizeString(data[key]);
    } else if (typeof data[key] === 'number') {
      sanitized[key] = sanitizeNumber(data[key]);
    } else {
      sanitized[key] = data[key];
    }
  }
  
  return {
    isValid: validation.isValid,
    errors: validation.errors,
    sanitized: sanitized as Partial<T>
  };
}

