/**
 * API Service Layer - Abstraction for Firebase operations
 * Provides consistent interface for all database operations
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  startAfter,
  writeBatch,
  Transaction,
  runTransaction,
  onSnapshot,
  Unsubscribe,
  Query,
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { db, isFirebaseEnabled } from '../firebaseConfig';

// Type definitions
export interface QueryOptions {
  whereClauses?: Array<{ field: string; operator: any; value: any }>;
  orderByClause?: { field: string; direction?: 'asc' | 'desc' };
  limitCount?: number;
  startAfterDoc?: any;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Generic service class for Firestore operations
 */
export class ApiService {
  /**
   * Get a single document by ID
   */
  static async getDocument<T>(
    collectionName: string, 
    documentId: string
  ): Promise<ServiceResponse<T>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: { ...docSnap.data(), id: docSnap.id } as T
        };
      } else {
        return { success: false, error: 'Document not found' };
      }
    } catch (error: any) {
      console.error(`Error getting document ${collectionName}/${documentId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to get document',
        code: error.code
      };
    }
  }

  /**
   * Get multiple documents with optional filtering and sorting
   */
  static async getDocuments<T>(
    collectionName: string,
    options?: QueryOptions
  ): Promise<ServiceResponse<T[]>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const constraints: QueryConstraint[] = [];
      
      // Add where clauses
      if (options?.whereClauses) {
        options.whereClauses.forEach(clause => {
          constraints.push(where(clause.field, clause.operator, clause.value));
        });
      }

      // Add orderBy clause
      if (options?.orderByClause) {
        constraints.push(
          orderBy(
            options.orderByClause.field, 
            options.orderByClause.direction || 'asc'
          )
        );
      }

      // Add limit
      if (options?.limitCount) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      
      const data = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as T[];

      return { success: true, data };
    } catch (error: any) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      
      // Handle missing index error gracefully
      if (error.code === 'failed-precondition') {
        return {
          success: false,
          error: 'Database index required. Please create the index in Firebase Console.',
          code: error.code
        };
      }

      return {
        success: false,
        error: error.message || 'Failed to get documents',
        code: error.code
      };
    }
  }

  /**
   * Create a new document
   */
  static async createDocument<T>(
    collectionName: string,
    data: Omit<T, 'id'>
  ): Promise<ServiceResponse<T>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date().toISOString()
      });
      
      const newDoc = await getDoc(docRef);
      return {
        success: true,
        data: { ...newDoc.data(), id: newDoc.id } as T
      };
    } catch (error: any) {
      console.error(`Error creating document in ${collectionName}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to create document',
        code: error.code
      };
    }
  }

  /**
   * Update an existing document
   */
  static async updateDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>
  ): Promise<ServiceResponse<T>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      
      const updatedDoc = await getDoc(docRef);
      return {
        success: true,
        data: { ...updatedDoc.data(), id: updatedDoc.id } as T
      };
    } catch (error: any) {
      console.error(`Error updating document ${collectionName}/${documentId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to update document',
        code: error.code
      };
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(
    collectionName: string,
    documentId: string
  ): Promise<ServiceResponse<void>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      await deleteDoc(doc(db, collectionName, documentId));
      return { success: true };
    } catch (error: any) {
      console.error(`Error deleting document ${collectionName}/${documentId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to delete document',
        code: error.code
      };
    }
  }

  /**
   * Batch write operations
   */
  static async batchWrite(
    operations: Array<{
      type: 'create' | 'update' | 'delete';
      collection: string;
      docId?: string;
      data?: any;
    }>
  ): Promise<ServiceResponse<void>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const batch = writeBatch(db);

      operations.forEach(op => {
        if (op.type === 'delete' && op.docId) {
          batch.delete(doc(db, op.collection, op.docId));
        } else if (op.type === 'update' && op.docId && op.data) {
          batch.update(doc(db, op.collection, op.docId), op.data);
        } else if (op.type === 'create' && op.data) {
          batch.set(doc(collection(db, op.collection)), op.data);
        }
      });

      await batch.commit();
      return { success: true };
    } catch (error: any) {
      console.error('Error in batch write:', error);
      return {
        success: false,
        error: error.message || 'Failed to execute batch write',
        code: error.code
      };
    }
  }

  /**
   * Subscribe to real-time updates
   */
  static subscribeToCollection<T>(
    collectionName: string,
    options: QueryOptions,
    callback: (data: T[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    if (!isFirebaseEnabled || !db) {
      onError?.(new Error('Database not initialized'));
      return () => {};
    }

    try {
      const constraints: QueryConstraint[] = [];
      
      if (options.whereClauses) {
        options.whereClauses.forEach(clause => {
          constraints.push(where(clause.field, clause.operator, clause.value));
        });
      }

      // Note: orderBy removed to avoid index errors - sort client-side instead
      if (options.limitCount) {
        constraints.push(limit(options.limitCount));
      }

      const q = query(collection(db, collectionName), ...constraints);
      
      return onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as T[];

          // Client-side sorting if orderBy was requested
          if (options.orderByClause) {
            data.sort((a: any, b: any) => {
              const aVal = a[options.orderByClause!.field] || '';
              const bVal = b[options.orderByClause!.field] || '';
              const direction = options.orderByClause.direction || 'asc';
              
              if (direction === 'desc') {
                return bVal.toString().localeCompare(aVal.toString());
              }
              return aVal.toString().localeCompare(bVal.toString());
            });
          }

          callback(data);
        },
        (error) => {
          console.error(`Error in subscription to ${collectionName}:`, error);
          onError?.(error);
        }
      );
    } catch (error: any) {
      console.error(`Error setting up subscription to ${collectionName}:`, error);
      onError?.(error);
      return () => {};
    }
  }

  /**
   * Run a transaction
   */
  static async runTransaction<T>(
    updateFunction: (transaction: Transaction) => Promise<T>
  ): Promise<ServiceResponse<T>> {
    if (!isFirebaseEnabled || !db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const result = await runTransaction(db, updateFunction);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Transaction error:', error);
      return {
        success: false,
        error: error.message || 'Transaction failed',
        code: error.code
      };
    }
  }
}

/**
 * Convenience functions for common operations
 */
export const apiService = {
  // Products
  getProducts: (uid: string) => 
    ApiService.getDocuments('products', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }]
    }),

  // Orders
  getOrders: (sellerId: string) =>
    ApiService.getDocuments('orders', {
      whereClauses: [{ field: 'sellerId', operator: '==', value: sellerId }],
      orderByClause: { field: 'date', direction: 'desc' }
    }),

  // Customers
  getCustomers: (uid: string) =>
    ApiService.getDocuments('customers', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }]
    }),

  // Expenses
  getExpenses: (uid: string) =>
    ApiService.getDocuments('expenses', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }],
      orderByClause: { field: 'date', direction: 'desc' }
    }),

  // Invoices
  getInvoices: (uid: string) =>
    ApiService.getDocuments('invoices', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }],
      orderByClause: { field: 'issueDate', direction: 'desc' }
    }),

  // Bills
  getBills: (uid: string) =>
    ApiService.getDocuments('bills', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }],
      orderByClause: { field: 'dueDate', direction: 'asc' }
    }),
};

