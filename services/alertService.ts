/**
 * Alert Service
 * Handles low-stock alerts and notifications
 */

import { Product } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  uid: string;
  createdAt: string;
  notified: boolean;
  notifiedAt?: string;
}

export interface AlertSettings {
  uid: string;
  enabled: boolean;
  defaultThreshold: number;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  emailRecipients: string[];
  phoneNumbers: string[];
}

/**
 * Check products for low stock
 */
export async function checkLowStock(
  products: Product[],
  uid: string,
  threshold?: number
): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];
  const defaultThreshold = threshold || 10;

  for (const product of products) {
    if (product.trackInventory && product.stock <= defaultThreshold) {
      alerts.push({
        id: `alert_${product.id}_${Date.now()}`,
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        threshold: defaultThreshold,
        uid,
        createdAt: new Date().toISOString(),
        notified: false
      });
    }
  }

  return alerts;
}

/**
 * Save stock alerts to database
 */
export async function saveStockAlerts(alerts: StockAlert[]): Promise<boolean> {
  if (alerts.length === 0) return true;

  try {
    const operations = alerts.map(alert => ({
      type: 'create' as const,
      collection: 'stock_alerts',
      data: alert
    }));

    const response = await ApiService.batchWrite(operations);
    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Save Stock Alerts');
    return false;
  }
}

/**
 * Get active stock alerts for a user
 */
export async function getActiveStockAlerts(uid: string): Promise<StockAlert[]> {
  try {
    const response = await ApiService.getDocuments<StockAlert>('stock_alerts', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'notified', operator: '==', value: false }
      ],
      orderByClause: { field: 'createdAt', direction: 'asc' }
    });

    return response.data || [];
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Stock Alerts');
    return [];
  }
}

/**
 * Mark alert as notified
 */
export async function markAlertAsNotified(alertId: string): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<StockAlert>(
      'stock_alerts',
      alertId,
      {
        notified: true,
        notifiedAt: new Date().toISOString()
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Mark Alert Notified');
    return false;
  }
}

/**
 * Send notification (placeholder - would integrate with email/SMS/WhatsApp services)
 */
export async function sendStockAlertNotification(
  alert: StockAlert,
  settings: AlertSettings
): Promise<boolean> {
  const message = `Low Stock Alert: ${alert.productName} has only ${alert.currentStock} items remaining. Threshold: ${alert.threshold}`;

  try {
    // Email notification
    if (settings.emailNotifications && settings.emailRecipients.length > 0) {
      const { sendEmail, EmailTemplates } = await import('./emailService');
      const emailTemplate = EmailTemplates.stockAlert(
        alert.productName,
        alert.currentStock,
        alert.threshold
      );
      for (const email of settings.emailRecipients) {
        await sendEmail({
          to: email,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        });
      }
    }

    // SMS notification
    if (settings.smsNotifications && settings.phoneNumbers.length > 0) {
      const { sendSMS, SMSTemplates } = await import('./smsService');
      const smsMessage = SMSTemplates.stockAlert(alert.productName, alert.currentStock);
      for (const phone of settings.phoneNumbers) {
        await sendSMS({ to: phone, message: smsMessage });
      }
    }

    // WhatsApp notification
    if (settings.whatsappNotifications && settings.phoneNumbers.length > 0) {
      const { sendWhatsAppMessage } = await import('./whatsappService');
      const whatsappMessage = `🚨 Low Stock Alert\n\nProduct: ${alert.productName}\nCurrent Stock: ${alert.currentStock}\nThreshold: ${alert.threshold}\n\nPlease restock soon!`;
      for (const phone of settings.phoneNumbers) {
        await sendWhatsAppMessage({ to: phone, text: whatsappMessage, type: 'text' });
      }
    }

    return true;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Send Stock Alert Notification');
    return false;
  }
}

/**
 * Process all stock alerts and send notifications
 */
export async function processStockAlerts(
  products: Product[],
  uid: string,
  settings: AlertSettings
): Promise<number> {
  if (!settings.enabled) return 0;

  // Check for low stock
  const alerts = await checkLowStock(products, uid, settings.defaultThreshold);
  
  if (alerts.length === 0) return 0;

  // Save alerts
  await saveStockAlerts(alerts);

  // Send notifications for each alert
  let notifiedCount = 0;
  for (const alert of alerts) {
    const success = await sendStockAlertNotification(alert, settings);
    if (success) {
      await markAlertAsNotified(alert.id);
      notifiedCount++;
    }
  }

  return notifiedCount;
}

/**
 * Get alert settings for a user
 */
export async function getAlertSettings(uid: string): Promise<AlertSettings | null> {
  try {
    const response = await ApiService.getDocuments<AlertSettings>('alert_settings', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }],
      limitCount: 1
    });

    if (response.data && response.data.length > 0) {
      return response.data[0];
    }

    // Return default settings
    return {
      uid,
      enabled: true,
      defaultThreshold: 10,
      emailNotifications: false,
      smsNotifications: false,
      whatsappNotifications: false,
      emailRecipients: [],
      phoneNumbers: []
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Alert Settings');
    return null;
  }
}

/**
 * Save alert settings
 */
export async function saveAlertSettings(settings: AlertSettings): Promise<boolean> {
  try {
    // Check if settings exist
    const existing = await getAlertSettings(settings.uid);
    
    let response;
    if (existing) {
      // Update existing
      const settingsId = (existing as any).id; // Settings should have an ID
      response = await ApiService.updateDocument<AlertSettings>(
        'alert_settings',
        settingsId,
        settings
      );
    } else {
      // Create new
      response = await ApiService.createDocument<AlertSettings>('alert_settings', settings);
    }

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Save Alert Settings');
    return false;
  }
}

