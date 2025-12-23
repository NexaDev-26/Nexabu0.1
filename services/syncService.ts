/**
 * Sync Service
 * Handles syncing of queued orders when connection is restored
 */

import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import {
  getPendingOrders,
  markOrderSynced,
  removeSyncedOrders,
} from './offlineService';
import { Order } from '../types';

let isSyncing = false;

/**
 * Sync all pending orders
 */
export async function syncPendingOrders(
  onProgress?: (synced: number, total: number) => void,
  onError?: (error: Error) => void
): Promise<{ success: number; failed: number }> {
  if (isSyncing) {
    console.log('Sync already in progress');
    return { success: 0, failed: 0 };
  }

  if (!isFirebaseEnabled || !db) {
    console.warn('Firebase not enabled, cannot sync');
    return { success: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    console.warn('Device is offline, cannot sync');
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  const pendingOrders = await getPendingOrders();
  let success = 0;
  let failed = 0;

  console.log(`Syncing ${pendingOrders.length} pending orders...`);

  for (let i = 0; i < pendingOrders.length; i++) {
    const order = pendingOrders[i];
    try {
      // Add order to Firestore
      await addDoc(collection(db, 'orders'), {
        ...order,
        syncedAt: new Date().toISOString(),
      });

      // Mark as synced
      await markOrderSynced(order.id);
      success++;

      if (onProgress) {
        onProgress(success, pendingOrders.length);
      }

      console.log(`Synced order ${order.id} (${success}/${pendingOrders.length})`);
    } catch (error: any) {
      console.error(`Failed to sync order ${order.id}:`, error);
      failed++;

      if (onError) {
        onError(error);
      }

      // Don't mark as synced if it failed
      // It will be retried on next sync
    }
  }

  // Clean up synced orders (optional - can keep for history)
  // await removeSyncedOrders();

  isSyncing = false;
  console.log(`Sync complete: ${success} succeeded, ${failed} failed`);

  return { success, failed };
}

/**
 * Auto-sync when online
 */
export function setupAutoSync(): () => void {
  const handleOnline = async () => {
    console.log('Connection restored, starting auto-sync...');
    await syncPendingOrders(
      (synced, total) => {
        console.log(`Sync progress: ${synced}/${total}`);
      },
      (error) => {
        console.error('Sync error:', error);
      }
    );
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('online-sync', handleOnline);

  // Also try to sync immediately if already online
  if (navigator.onLine) {
    handleOnline();
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('online-sync', handleOnline);
  };
}

