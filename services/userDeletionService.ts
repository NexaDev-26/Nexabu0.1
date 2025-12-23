/**
 * User Deletion Service
 * Handles cascading deletion of all user data when an account is deleted
 */

import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { ErrorHandler } from '../utils/errorHandler';

/**
 * Collections that contain user data by uid field
 */
const USER_DATA_COLLECTIONS = [
  'products',
  'orders',
  'customers',
  'expenses',
  'invoices',
  'bills',
  'branches',
  'purchase_orders',
  'inventory_adjustments',
  'transactions',
  'deliveries',
  'drivers',
  'credit_applications',
  'wholesale_orders',
  'item_groups',
  'item_categories',
  'item_units',
  'stock_alerts',
  'alert_settings',
  'warehouse_transfers',
  'delivery_tracking',
  'shop_pages',
  'abandoned_carts',
  'expense_categories'
] as const;

/**
 * Collections that reference user by different field names
 */
const REFERENCE_COLLECTIONS = [
  { name: 'orders', fields: ['sellerId', 'customerId'] },
  { name: 'warehouse_transfers', fields: ['fromBranchUid', 'toBranchUid'] },
  { name: 'delivery_tracking', fields: ['driverId', 'orderId'] },
  { name: 'abandoned_carts', fields: ['customerId'] }
] as const;

/**
 * Delete all data associated with a user
 * This includes:
 * - All collections where uid matches
 * - All documents where user is referenced (orders, transfers, etc.)
 * - Staff members (where employerId matches)
 * - User's own profile
 */
export async function deleteUserAccount(userId: string): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  if (!db) {
    return { success: false, deletedCount: 0, errors: ['Firebase not initialized'] };
  }

  const errors: string[] = [];
  let deletedCount = 0;

  try {
    // Delete from collections where uid field matches
    for (const collectionName of USER_DATA_COLLECTIONS) {
      try {
        const q = query(collection(db, collectionName), where('uid', '==', userId));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let batchCount = 0;
        const maxBatchSize = 500; // Firestore batch limit

        // Process in batches to respect Firestore limits
        const docsToDelete = snapshot.docs;
        for (let i = 0; i < docsToDelete.length; i += maxBatchSize) {
          const batch = writeBatch(db);
          const batchDocs = docsToDelete.slice(i, i + maxBatchSize);
          
          batchDocs.forEach((docSnapshot) => {
            batch.delete(doc(db, collectionName, docSnapshot.id));
            deletedCount++;
          });

          await batch.commit();
        }
      } catch (error: any) {
        const appError = ErrorHandler.handleApiError(error);
        errors.push(`Error deleting from ${collectionName}: ${appError.message}`);
        ErrorHandler.logError(appError, `Delete from ${collectionName}`);
      }
    }

    // Delete references where user appears in other fields
    for (const refCollection of REFERENCE_COLLECTIONS) {
      try {
        const collectionName = refCollection.name;
        
        for (const field of refCollection.fields) {
          const q = query(collection(db, collectionName), where(field, '==', userId));
          const snapshot = await getDocs(q);
          
          const batch = writeBatch(db);
          let batchCount = 0;

          // Process in batches
          const docsToDelete = snapshot.docs;
          for (let i = 0; i < docsToDelete.length; i += 500) {
            const batch = writeBatch(db);
            const batchDocs = docsToDelete.slice(i, i + 500);
            
            batchDocs.forEach((docSnapshot) => {
              batch.delete(doc(db, collectionName, docSnapshot.id));
              deletedCount++;
            });

            await batch.commit();
          }
        }
      } catch (error: any) {
        const appError = ErrorHandler.handleApiError(error);
        errors.push(`Error deleting references from ${refCollection.name}: ${appError.message}`);
        ErrorHandler.logError(appError, `Delete references from ${refCollection.name}`);
      }
    }

    // Delete staff members (users where employerId matches)
    try {
      const staffQuery = query(collection(db, 'users'), where('employerId', '==', userId));
      const staffSnapshot = await getDocs(staffQuery);
      
      const batch = writeBatch(db);
      let batchCount = 0;

      // Process staff in batches
      const staffDocs = staffSnapshot.docs;
      for (let i = 0; i < staffDocs.length; i += 500) {
        const batch = writeBatch(db);
        const batchDocs = staffDocs.slice(i, i + 500);
        
        batchDocs.forEach((staffDoc) => {
          batch.delete(doc(db, 'users', staffDoc.id));
          deletedCount++;
        });

        await batch.commit();
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      errors.push(`Error deleting staff members: ${appError.message}`);
      ErrorHandler.logError(appError, 'Delete Staff Members');
    }

    // Finally, delete the user's own profile
    try {
      await deleteDoc(doc(db, 'users', userId));
      deletedCount++;
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      errors.push(`Error deleting user profile: ${appError.message}`);
      ErrorHandler.logError(appError, 'Delete User Profile');
    }

    return {
      success: errors.length === 0,
      deletedCount,
      errors
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Delete User Account');
    return {
      success: false,
      deletedCount,
      errors: [appError.message, ...errors]
    };
  }
}

/**
 * Get count of data that will be deleted for a user
 * Useful for showing confirmation message
 */
export async function getUserDataCount(userId: string): Promise<{ [collection: string]: number }> {
  if (!db) {
    return {};
  }

  const counts: { [collection: string]: number } = {};

  try {
    // Count documents in uid-based collections
    for (const collectionName of USER_DATA_COLLECTIONS) {
      try {
        const q = query(collection(db, collectionName), where('uid', '==', userId));
        const snapshot = await getDocs(q);
        counts[collectionName] = snapshot.size;
      } catch (error) {
        counts[collectionName] = 0;
      }
    }

    // Count staff members
    try {
      const staffQuery = query(collection(db, 'users'), where('employerId', '==', userId));
      const staffSnapshot = await getDocs(staffQuery);
      counts['staff_members'] = staffSnapshot.size;
    } catch (error) {
      counts['staff_members'] = 0;
    }

    // Count references
    for (const refCollection of REFERENCE_COLLECTIONS) {
      for (const field of refCollection.fields) {
        try {
          const q = query(collection(db, refCollection.name), where(field, '==', userId));
          const snapshot = await getDocs(q);
          const key = `${refCollection.name}_${field}`;
          counts[key] = (counts[key] || 0) + snapshot.size;
        } catch (error) {
          // Ignore
        }
      }
    }
  } catch (error: any) {
    ErrorHandler.logError(ErrorHandler.handleApiError(error), 'Get User Data Count');
  }

  return counts;
}

