/**
 * Bulk Import Utilities
 * Handles CSV/Excel file imports for products and other entities
 */

import * as XLSX from 'xlsx';
import { Product } from '../types';
import { validate, validationSchemas } from './validation';
import { ErrorHandler } from './errorHandler';

export interface ImportResult {
  success: boolean;
  totalRows: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; errors: string[] }>;
  data?: any[];
}

export interface ImportOptions {
  skipHeader?: boolean;
  validateData?: boolean;
  batchSize?: number;
}

/**
 * Parse CSV/Excel file
 */
export function parseFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        resolve(jsonData);
      } catch (error) {
        reject(new Error('Failed to parse file. Please ensure it is a valid CSV or Excel file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Map CSV/Excel columns to Product fields
 */
export function mapToProduct(row: any, columnMapping: { [key: string]: string }): Partial<Product> {
  const product: any = {};

  // Default mapping if not provided
  const defaultMapping: { [key: string]: string } = {
    'name': 'name',
    'Name': 'name',
    'Product Name': 'name',
    'price': 'price',
    'Price': 'price',
    'Selling Price': 'price',
    'stock': 'stock',
    'Stock': 'stock',
    'Quantity': 'stock',
    'buyingPrice': 'buyingPrice',
    'Buying Price': 'buyingPrice',
    'Cost Price': 'buyingPrice',
    'barcode': 'barcode',
    'Barcode': 'barcode',
    'SKU': 'barcode',
    'category': 'category',
    'Category': 'category',
    'description': 'description',
    'Description': 'description',
  };

  const mapping = { ...defaultMapping, ...columnMapping };

  for (const [csvColumn, productField] of Object.entries(mapping)) {
    if (row[csvColumn] !== undefined && row[csvColumn] !== null && row[csvColumn] !== '') {
      // Convert to appropriate type
      if (productField === 'price' || productField === 'buyingPrice' || productField === 'stock') {
        product[productField] = parseFloat(row[csvColumn]) || 0;
      } else {
        product[productField] = String(row[csvColumn]).trim();
      }
    }
  }

  return product;
}

/**
 * Validate product data
 */
export function validateProductData(product: Partial<Product>, rowNumber: number): string[] {
  const errors: string[] = [];

  // Required fields
  if (!product.name || product.name.trim() === '') {
    errors.push(`Row ${rowNumber}: Product name is required`);
  }

  if (product.price === undefined || product.price === null || isNaN(product.price)) {
    errors.push(`Row ${rowNumber}: Price is required and must be a number`);
  } else if (product.price < 0) {
    errors.push(`Row ${rowNumber}: Price cannot be negative`);
  }

  if (product.stock === undefined || product.stock === null || isNaN(product.stock)) {
    errors.push(`Row ${rowNumber}: Stock is required and must be a number`);
  } else if (product.stock < 0) {
    errors.push(`Row ${rowNumber}: Stock cannot be negative`);
  }

  // Optional validation
  if (product.buyingPrice !== undefined && product.buyingPrice < 0) {
    errors.push(`Row ${rowNumber}: Buying price cannot be negative`);
  }

  if (product.name && product.name.length > 200) {
    errors.push(`Row ${rowNumber}: Product name is too long (max 200 characters)`);
  }

  return errors;
}

/**
 * Import products from file
 */
export async function importProducts(
  file: File,
  uid: string,
  columnMapping?: { [key: string]: string },
  options: ImportOptions = {}
): Promise<ImportResult> {
  const {
    skipHeader = true,
    validateData = true,
    batchSize = 50
  } = options;

  try {
    // Parse file
    const rawData = await parseFile(file);
    
    if (rawData.length === 0) {
      return {
        success: false,
        totalRows: 0,
        successful: 0,
        failed: 0,
        errors: [{ row: 0, errors: ['File is empty'] }]
      };
    }

    // Skip header row if needed
    const dataRows = skipHeader && rawData.length > 0 ? rawData.slice(1) : rawData;
    
    const result: ImportResult = {
      success: true,
      totalRows: dataRows.length,
      successful: 0,
      failed: 0,
      errors: [],
      data: []
    };

    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + (skipHeader ? 2 : 1); // +2 because we skip header and 1-indexed

      try {
        // Map to product
        const productData = mapToProduct(row, columnMapping || {});
        
        // Add required fields
        productData.uid = uid;
        productData.status = 'Active';
        productData.trackInventory = true;
        productData.image = productData.image || '';

        // Validate
        if (validateData) {
          const validationErrors = validateProductData(productData as Partial<Product>, rowNumber);
          if (validationErrors.length > 0) {
            result.errors.push({ row: rowNumber, errors: validationErrors });
            result.failed++;
            continue;
          }

          // Additional validation using schema
          const schemaValidation = validate(productData, validationSchemas.product);
          if (!schemaValidation.isValid) {
            result.errors.push({ 
              row: rowNumber, 
              errors: schemaValidation.errors.map(e => `Row ${rowNumber}: ${e}`)
            });
            result.failed++;
            continue;
          }
        }

        result.data?.push(productData);
        result.successful++;

      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          errors: [error.message || 'Unknown error']
        });
        result.failed++;
      }
    }

    result.success = result.failed === 0;
    return result;

  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    return {
      success: false,
      totalRows: 0,
      successful: 0,
      failed: 0,
      errors: [{ row: 0, errors: [appError.message] }]
    };
  }
}

/**
 * Generate template file for product import
 */
export function generateProductTemplate(): void {
  const templateData = [
    {
      'Product Name': 'Sample Product',
      'Price': 10000,
      'Stock': 50,
      'Buying Price': 8000,
      'Barcode': '123456789',
      'Category': 'Electronics',
      'Description': 'Sample product description'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  
  XLSX.writeFile(workbook, 'product_import_template.xlsx');
}

/**
 * Export products to Excel
 */
export function exportProductsToExcel(products: Product[], filename: string = 'products_export.xlsx'): void {
  const exportData = products.map(p => ({
    'Product Name': p.name,
    'Price': p.price,
    'Stock': p.stock,
    'Buying Price': p.buyingPrice || '',
    'Barcode': p.barcode || '',
    'Category': p.category || '',
    'Description': p.description || '',
    'Status': p.status || 'Active'
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
  
  XLSX.writeFile(workbook, filename);
}

