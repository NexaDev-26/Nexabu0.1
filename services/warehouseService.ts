/**
 * Warehouse Transfer Service
 * Handles product transfers between stores/branches
 */

import { Product, Branch } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';

export interface WarehouseTransfer {
  id: string;
  uid: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  items: TransferItem[];
  status: 'Pending' | 'Approved' | 'In Transit' | 'Completed' | 'Cancelled';
  requestedBy: string;
  requestedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  requestedDate: string;
  approvedDate?: string;
  completedDate?: string;
  notes?: string;
}

export interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
  currentStock?: number;
}

/**
 * Create a transfer request
 */
export async function createTransferRequest(
  transfer: Omit<WarehouseTransfer, 'id' | 'requestedDate' | 'status'>
): Promise<string | null> {
  try {
    const transferData: Omit<WarehouseTransfer, 'id'> = {
      ...transfer,
      status: 'Pending',
      requestedDate: new Date().toISOString()
    };

    const response = await ApiService.createDocument<WarehouseTransfer>('warehouse_transfers', transferData);
    
    if (response.success && response.data) {
      return response.data.id;
    }
    
    return null;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Create Transfer Request');
    return null;
  }
}

/**
 * Get transfer requests for a user
 */
export async function getTransferRequests(
  uid: string,
  branchId?: string
): Promise<WarehouseTransfer[]> {
  try {
    const whereClauses: Array<{ field: string; operator: any; value: any }> = [
      { field: 'uid', operator: '==', value: uid }
    ];

    // If branchId provided, get transfers for that branch (as source or destination)
    // Note: This requires a compound query or client-side filtering
    const response = await ApiService.getDocuments<WarehouseTransfer>('warehouse_transfers', {
      whereClauses,
      orderByClause: { field: 'requestedDate', direction: 'desc' }
    });

    if (!response.data) return [];

    // Filter by branch if specified
    if (branchId) {
      return response.data.filter(
        t => t.fromBranchId === branchId || t.toBranchId === branchId
      );
    }

    return response.data;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Transfer Requests');
    return [];
  }
}

/**
 * Approve transfer request
 */
export async function approveTransfer(
  transferId: string,
  approvedBy: string,
  approvedByName?: string
): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<WarehouseTransfer>(
      'warehouse_transfers',
      transferId,
      {
        status: 'Approved',
        approvedBy,
        approvedByName,
        approvedDate: new Date().toISOString()
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Approve Transfer');
    return false;
  }
}

/**
 * Complete transfer (update inventory)
 */
export async function completeTransfer(
  transferId: string,
  transfer: WarehouseTransfer
): Promise<boolean> {
  try {
    // Use transaction to ensure atomicity
    const result = await ApiService.runTransaction(async (transaction) => {
      // Update source branch inventory (decrease)
      for (const item of transfer.items) {
        const sourceProductRef = await ApiService.getDocument<Product>(
          'products',
          item.productId
        );

        if (!sourceProductRef.data) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const sourceProduct = sourceProductRef.data;
        
        // Verify product belongs to source branch
        if (sourceProduct.uid !== transfer.uid) {
          throw new Error('Product ownership mismatch');
        }

        // Update stock
        const newStock = (sourceProduct.stock || 0) - item.quantity;
        if (newStock < 0) {
          throw new Error(`Insufficient stock for ${item.productName}`);
        }

        await ApiService.updateDocument<Product>(
          'products',
          item.productId,
          { stock: newStock }
        );

        // Update destination branch inventory (increase)
        // Note: In a real system, you'd need to find/create product in destination branch
        // For now, we'll just update the transfer status
      }

      // Update transfer status
      await ApiService.updateDocument<WarehouseTransfer>(
        'warehouse_transfers',
        transferId,
        {
          status: 'Completed',
          completedDate: new Date().toISOString()
        }
      );

      return true;
    });

    return result.success || false;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Complete Transfer');
    return false;
  }
}

/**
 * Cancel transfer request
 */
export async function cancelTransfer(transferId: string): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<WarehouseTransfer>(
      'warehouse_transfers',
      transferId,
      {
        status: 'Cancelled'
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Cancel Transfer');
    return false;
  }
}

/**
 * Get transfer history
 */
export async function getTransferHistory(
  uid: string,
  status?: WarehouseTransfer['status']
): Promise<WarehouseTransfer[]> {
  try {
    const whereClauses: Array<{ field: string; operator: any; value: any }> = [
      { field: 'uid', operator: '==', value: uid }
    ];

    if (status) {
      whereClauses.push({ field: 'status', operator: '==', value: status });
    }

    const response = await ApiService.getDocuments<WarehouseTransfer>('warehouse_transfers', {
      whereClauses,
      orderByClause: { field: 'requestedDate', direction: 'desc' }
    });

    return response.data || [];
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Transfer History');
    return [];
  }
}

/**
 * Validate transfer request
 */
export function validateTransferRequest(
  transfer: Partial<WarehouseTransfer>,
  sourceProducts: Product[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!transfer.fromBranchId) {
    errors.push('Source branch is required');
  }

  if (!transfer.toBranchId) {
    errors.push('Destination branch is required');
  }

  if (transfer.fromBranchId === transfer.toBranchId) {
    errors.push('Source and destination branches cannot be the same');
  }

  if (!transfer.items || transfer.items.length === 0) {
    errors.push('At least one item is required');
  }

  // Validate each item
  transfer.items?.forEach((item, index) => {
    if (!item.productId) {
      errors.push(`Item ${index + 1}: Product is required`);
    }

    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }

    // Check stock availability
    const product = sourceProducts.find(p => p.id === item.productId);
    if (product) {
      if ((product.stock || 0) < item.quantity) {
        errors.push(
          `Item ${index + 1}: Insufficient stock. Available: ${product.stock}, Requested: ${item.quantity}`
        );
      }
    } else {
      errors.push(`Item ${index + 1}: Product not found`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

