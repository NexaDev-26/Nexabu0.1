/**
 * Offline Service
 * Handles offline functionality: order queue, product caching, and sync
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Order, Product } from '../types';

// IndexedDB Schema
interface NexabuDB extends DBSchema {
  pendingOrders: {
    key: string;
    value: Order & { queuedAt: number; synced: boolean };
  };
  cachedProducts: {
    key: string;
    value: Product & { cachedAt: number };
  };
  cart: {
    key: string;
    value: { product: Product; quantity: number; addedAt: number };
  };
}

let db: IDBPDatabase<NexabuDB> | null = null;

/**
 * Initialize IndexedDB
 */
export async function initOfflineDB(): Promise<void> {
  try {
    db = await openDB<NexabuDB>('nexabu-offline', 1, {
      upgrade(db) {
        // Pending Orders Store
        if (!db.objectStoreNames.contains('pendingOrders')) {
          const orderStore = db.createObjectStore('pendingOrders', { keyPath: 'id' });
          orderStore.createIndex('queuedAt', 'queuedAt');
          orderStore.createIndex('synced', 'synced');
        }

        // Cached Products Store
        if (!db.objectStoreNames.contains('cachedProducts')) {
          const productStore = db.createObjectStore('cachedProducts', { keyPath: 'id' });
          productStore.createIndex('cachedAt', 'cachedAt');
        }

        // Cart Store
        if (!db.objectStoreNames.contains('cart')) {
          const cartStore = db.createObjectStore('cart', { keyPath: 'product.id' });
          cartStore.createIndex('addedAt', 'addedAt');
        }
      },
    });
    console.log('Offline DB initialized');
  } catch (error) {
    console.error('Failed to initialize offline DB:', error);
  }
}

/**
 * Check if device is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Queue order for sync when online
 */
export async function queueOrder(order: Order): Promise<void> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    throw new Error('Failed to initialize offline database');
  }

  try {
    const queuedOrder = {
      ...order,
      queuedAt: Date.now(),
      synced: false,
    };
    await db.put('pendingOrders', queuedOrder);
    console.log('Order queued for sync:', order.id);
  } catch (error) {
    console.error('Failed to queue order:', error);
    throw error;
  }
}

/**
 * Get all pending orders
 */
export async function getPendingOrders(): Promise<Order[]> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return [];
  }

  try {
    // Some environments throw DataError on IDBKeyRange.only(false); fallback to filtering in JS
    const all = await db.getAll('pendingOrders');
    const pending = all.filter(o => !o.synced);
    return pending.map(({ queuedAt, synced, ...order }) => order);
  } catch (error) {
    console.error('Failed to get pending orders:', error);
    return [];
  }
}

/**
 * Mark order as synced
 */
export async function markOrderSynced(orderId: string): Promise<void> {
  if (!db) return;

  try {
    const order = await db.get('pendingOrders', orderId);
    if (order) {
      await db.put('pendingOrders', { ...order, synced: true });
    }
  } catch (error) {
    console.error('Failed to mark order as synced:', error);
  }
}

/**
 * Remove synced orders (cleanup)
 */
export async function removeSyncedOrders(): Promise<void> {
  if (!db) return;

  try {
    const tx = db.transaction('pendingOrders', 'readwrite');
    const store = tx.objectStore('pendingOrders');
    const index = store.index('synced');
    const syncedOrders = await index.getAll(IDBKeyRange.only(true));
    
    await Promise.all(syncedOrders.map(order => store.delete(order.id)));
    await tx.done;
  } catch (error) {
    console.error('Failed to remove synced orders:', error);
  }
}

/**
 * Cache products for offline use
 */
export async function cacheProducts(products: Product[]): Promise<void> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return;
  }

  try {
    const tx = db.transaction('cachedProducts', 'readwrite');
    const store = tx.objectStore('cachedProducts');
    
    // Keep only last 100 products (remove oldest)
    const allCached = await store.getAll();
    if (allCached.length + products.length > 100) {
      const sorted = allCached.sort((a, b) => a.cachedAt - b.cachedAt);
      const toRemove = sorted.slice(0, products.length);
      await Promise.all(toRemove.map(p => store.delete(p.id)));
    }

    // Add new products
    const now = Date.now();
    await Promise.all(
      products.map(product =>
        store.put({ ...product, cachedAt: now })
      )
    );
    await tx.done;
    console.log(`Cached ${products.length} products`);
  } catch (error) {
    console.error('Failed to cache products:', error);
  }
}

/**
 * Get cached products
 */
export async function getCachedProducts(): Promise<Product[]> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return [];
  }

  try {
    const products = await db.getAll('cachedProducts');
    return products.map(({ cachedAt, ...product }) => product);
  } catch (error) {
    console.error('Failed to get cached products:', error);
    return [];
  }
}

/**
 * Save cart to offline storage
 */
export async function saveCart(cart: { product: Product; quantity: number }[]): Promise<void> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return;
  }

  try {
    const tx = db.transaction('cart', 'readwrite');
    const store = tx.objectStore('cart');
    await store.clear();
    
    const now = Date.now();
    await Promise.all(
      cart.map(item =>
        store.put({ ...item, addedAt: now })
      )
    );
    await tx.done;
  } catch (error) {
    console.error('Failed to save cart:', error);
  }
}

/**
 * Get cart from offline storage
 */
export async function getCart(): Promise<{ product: Product; quantity: number }[]> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return [];
  }

  try {
    const cart = await db.getAll('cart');
    return cart.map(({ addedAt, ...item }) => item);
  } catch (error) {
    console.error('Failed to get cart:', error);
    return [];
  }
}

/**
 * Clear cart from offline storage
 */
export async function clearCart(): Promise<void> {
  if (!db) return;

  try {
    const tx = db.transaction('cart', 'readwrite');
    await tx.objectStore('cart').clear();
    await tx.done;
  } catch (error) {
    console.error('Failed to clear cart:', error);
  }
}

/**
 * Get count of pending orders
 */
export async function getPendingOrdersCount(): Promise<number> {
  if (!db) {
    await initOfflineDB();
  }
  if (!db) {
    return 0;
  }

  try {
    const all = await db.getAll('pendingOrders');
    return all.filter(o => !o.synced).length;
  } catch (error) {
    console.error('Failed to get pending orders count:', error);
    return 0;
  }
}

