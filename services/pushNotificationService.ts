/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging (FCM) push notifications
 */

import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { ErrorHandler } from '../utils/errorHandler';

let messagingInstance: Messaging | null = null;
let isInitialized = false;

/**
 * Initialize push notification service
 */
export async function initPushNotifications(firebaseApp: FirebaseApp): Promise<boolean> {
  if (isInitialized && messagingInstance) {
    return true;
  }

  try {
    if (typeof window === 'undefined') {
      return false; // Server-side rendering
    }

    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.warn('This browser does not support service workers');
      return false;
    }

    messagingInstance = getMessaging(firebaseApp);
    isInitialized = true;

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return true;
    }

    return false;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Init Push Notifications');
    return false;
  }
}

/**
 * Get FCM token for current device
 */
export async function getFCMToken(): Promise<string | null> {
  if (!messagingInstance) {
    console.warn('Push notifications not initialized');
    return null;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    const token = await getToken(messagingInstance, {
      vapidKey: process.env.VAPID_KEY || '', // Should be set in environment
      serviceWorkerRegistration: registration
    });

    return token;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get FCM Token');
    return null;
  }
}

/**
 * Subscribe to foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messagingInstance) {
    return null;
  }

  try {
    const unsubscribe = onMessage(messagingInstance, (payload) => {
      callback(payload);
    });

    return unsubscribe;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Subscribe Foreground Messages');
    return null;
  }
}

/**
 * Send notification to device (requires backend/Cloud Function)
 * This is a placeholder - actual sending should be done from backend
 */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  data?: { [key: string]: string };
  clickAction?: string;
}

/**
 * Show local notification (browser API)
 */
export async function showLocalNotification(payload: NotificationPayload): Promise<void> {
  if (!('Notification' in window)) {
    return;
  }

  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    const notification = new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192x192.png',
      image: payload.image,
      badge: '/icon-192x192.png',
      tag: 'nexabu-notification',
      data: payload.data,
      requireInteraction: false
    });

    notification.onclick = (event) => {
      event.preventDefault();
      if (payload.clickAction) {
        window.open(payload.clickAction, '_blank');
      }
      notification.close();
    };
  }
}

/**
 * Save FCM token to user profile
 */
export async function saveFCMTokenToUser(token: string, userId: string): Promise<boolean> {
  try {
    // This would update the user's document in Firestore with the FCM token
    // Implementation depends on your API service
    const { ApiService } = await import('./apiService');
    
    const response = await ApiService.updateDocument('users', userId, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date().toISOString()
    });

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Save FCM Token');
    return false;
  }
}

/**
 * Notification types
 */
export enum NotificationType {
  ORDER_UPDATE = 'ORDER_UPDATE',
  LOW_STOCK = 'LOW_STOCK',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  DELIVERY_UPDATE = 'DELIVERY_UPDATE',
  SYSTEM = 'SYSTEM'
}

/**
 * Create notification payload
 */
export function createNotificationPayload(
  type: NotificationType,
  data: any
): NotificationPayload {
  const payloads: { [key: string]: NotificationPayload } = {
    [NotificationType.ORDER_UPDATE]: {
      title: 'Order Update',
      body: `Order #${data.orderId} status: ${data.status}`,
      data: { orderId: data.orderId, type: NotificationType.ORDER_UPDATE },
      clickAction: `/orders`
    },
    [NotificationType.LOW_STOCK]: {
      title: 'Low Stock Alert',
      body: `${data.productName} is running low (${data.stock} remaining)`,
      data: { productId: data.productId, type: NotificationType.LOW_STOCK },
      clickAction: `/inventory`
    },
    [NotificationType.PAYMENT_RECEIVED]: {
      title: 'Payment Received',
      body: `Received TZS ${data.amount?.toLocaleString()} from ${data.customerName}`,
      data: { paymentId: data.paymentId, type: NotificationType.PAYMENT_RECEIVED },
      clickAction: `/wallet`
    },
    [NotificationType.DELIVERY_UPDATE]: {
      title: 'Delivery Update',
      body: `Delivery for order #${data.orderId}: ${data.status}`,
      data: { deliveryId: data.deliveryId, type: NotificationType.DELIVERY_UPDATE },
      clickAction: `/delivery`
    },
    [NotificationType.SYSTEM]: {
      title: data.title || 'System Notification',
      body: data.body || 'You have a new notification',
      data: { type: NotificationType.SYSTEM }
    }
  };

  return payloads[type] || payloads[NotificationType.SYSTEM];
}

