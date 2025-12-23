/**
 * Firestore Query Optimizer
 * Utility functions to optimize Firestore queries and prevent common errors
 */

import { Query, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';

/**
 * Safe query builder that handles missing indexes gracefully
 * Sorts client-side if orderBy would require an index
 */
export function buildSafeQuery<T>(
  baseQuery: Query<T>,
  constraints: QueryConstraint[] = []
): Query<T> {
  try {
    return query(baseQuery, ...constraints);
  } catch (error: any) {
    // If index error, return base query without orderBy
    if (error.code === 'failed-precondition' || error.message?.includes('index')) {
      console.warn('Index missing, using base query. Sorting will be done client-side.');
      return baseQuery;
    }
    throw error;
  }
}

/**
 * Client-side sorting helper
 */
export function sortClientSide<T>(
  data: T[],
  sortField: keyof T,
  direction: 'asc' | 'desc' = 'desc'
): T[] {
  return [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    
    return 0;
  });
}

/**
 * Batch query helper to prevent too many listeners
 */
export class QueryManager {
  private listeners: Map<string, () => void> = new Map();
  
  subscribe(key: string, unsubscribe: () => void) {
    // Unsubscribe existing listener if any
    this.unsubscribe(key);
    this.listeners.set(key, unsubscribe);
  }
  
  unsubscribe(key: string) {
    const unsub = this.listeners.get(key);
    if (unsub) {
      unsub();
      this.listeners.delete(key);
    }
  }
  
  unsubscribeAll() {
    this.listeners.forEach(unsub => unsub());
    this.listeners.clear();
  }
}

/**
 * Error handler for Firestore operations
 */
export function handleFirestoreError(error: any, context: string): void {
  if (error.code === 'permission-denied') {
    console.warn(`Permission denied for ${context}. User may not have access.`);
    return;
  }
  
  if (error.code === 'failed-precondition') {
    console.error(`Index missing for ${context}. Please create the required index in Firebase Console.`);
    return;
  }
  
  if (error.code === 'unavailable') {
    console.error(`Firestore unavailable for ${context}. Check network connection.`);
    return;
  }
  
  console.error(`Firestore error in ${context}:`, error);
}

