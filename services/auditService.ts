/**
 * Audit Logging Service
 * Tracks user actions, system events, and data changes for security and compliance
 */

import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { User } from '../types';

export interface AuditLog {
  id?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date | Timestamp;
  success: boolean;
  errorMessage?: string;
}

export enum AuditAction {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SIGNUP = 'SIGNUP',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  
  // CRUD Operations
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  
  // Business Operations
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_CANCEL = 'ORDER_CANCEL',
  PAYMENT_PROCESS = 'PAYMENT_PROCESS',
  INVENTORY_ADJUST = 'INVENTORY_ADJUST',
  STOCK_TRANSFER = 'STOCK_TRANSFER',
  
  // Administrative
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  PERMISSION_CHANGE = 'PERMISSION_CHANGE',
  SETTINGS_UPDATE = 'SETTINGS_UPDATE',
  
  // System
  EXPORT_DATA = 'EXPORT_DATA',
  IMPORT_DATA = 'IMPORT_DATA',
  BACKUP = 'BACKUP',
  RESTORE = 'RESTORE',
}

/**
 * Log an audit event
 */
export async function logAuditEvent(
  user: User | { uid: string; email?: string; name?: string },
  action: AuditAction,
  resourceType: string,
  options: {
    resourceId?: string;
    details?: Record<string, any>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<void> {
  if (!isFirebaseEnabled || !db) {
    console.warn('Audit logging disabled - Firebase not initialized');
    return;
  }

  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      userId: user.uid,
      userEmail: user.email,
      userName: user.name,
      action,
      resourceType,
      resourceId: options.resourceId,
      details: options.details,
      ipAddress: typeof window !== 'undefined' ? await getClientIP() : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date(),
      success: options.success !== false,
      errorMessage: options.errorMessage,
    };

    await addDoc(collection(db, 'audit_logs'), auditLog);
  } catch (error: any) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging failures shouldn't break the app
  }
}

/**
 * Get client IP address (simplified - in production, use a proper service)
 */
async function getClientIP(): Promise<string | undefined> {
  try {
    // In a real app, you'd call your backend API to get the real IP
    // For now, we'll just return undefined
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(
  userId: string,
  limitCount: number = 100
): Promise<AuditLog[]> {
  if (!isFirebaseEnabled || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as AuditLog));
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a resource
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  limitCount: number = 100
): Promise<AuditLog[]> {
  if (!isFirebaseEnabled || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('resourceType', '==', resourceType),
      where('resourceId', '==', resourceId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as AuditLog));
  } catch (error: any) {
    console.error('Failed to fetch resource audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs by action type
 */
export async function getAuditLogsByAction(
  action: AuditAction,
  limitCount: number = 100
): Promise<AuditLog[]> {
  if (!isFirebaseEnabled || !db) {
    return [];
  }

  try {
    const q = query(
      collection(db, 'audit_logs'),
      where('action', '==', action),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    } as AuditLog));
  } catch (error: any) {
    console.error('Failed to fetch audit logs by action:', error);
    return [];
  }
}

