/**
 * Abandoned Cart Recovery Service
 * Tracks and recovers abandoned shopping carts
 */

import { Product, Customer } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';
import { sendWhatsAppMessage, formatPhoneForWhatsApp } from './whatsappService';
import { createNotificationPayload, NotificationType, showLocalNotification } from './pushNotificationService';

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface AbandonedCart {
  id: string;
  uid: string; // Store owner ID
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  currency: string;
  createdAt: string;
  lastUpdated: string;
  status: 'active' | 'recovered' | 'expired';
  recoveryAttempts: number;
  lastRecoveryAttempt?: string;
  recoveredAt?: string;
  recoveredOrderId?: string;
}

/**
 * Create or update abandoned cart
 */
export async function saveAbandonedCart(cart: Omit<AbandonedCart, 'id' | 'createdAt' | 'lastUpdated' | 'status' | 'recoveryAttempts'>): Promise<string | null> {
  try {
    // Check if cart already exists for this customer
    const existingCarts = await ApiService.getDocuments<AbandonedCart>('abandoned_carts', {
      whereClauses: [
        { field: 'uid', operator: '==', value: cart.uid },
        { field: 'customerPhone', operator: '==', value: cart.customerPhone || '' },
        { field: 'status', operator: '==', value: 'active' }
      ],
      limitCount: 1
    });

    if (existingCarts.success && existingCarts.data && existingCarts.data.length > 0) {
      // Update existing cart
      const existingCart = existingCarts.data[0];
      const response = await ApiService.updateDocument<AbandonedCart>(
        'abandoned_carts',
        existingCart.id,
        {
          ...cart,
          lastUpdated: new Date().toISOString(),
          status: 'active',
          recoveryAttempts: existingCart.recoveryAttempts
        }
      );

      return response.success ? existingCart.id : null;
    } else {
      // Create new cart
      const cartData: Omit<AbandonedCart, 'id'> = {
        ...cart,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        status: 'active',
        recoveryAttempts: 0
      };

      const response = await ApiService.createDocument<AbandonedCart>('abandoned_carts', cartData);
      return response.success && response.data ? response.data.id : null;
    }
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Save Abandoned Cart');
    return null;
  }
}

/**
 * Get active abandoned carts for a store
 */
export async function getAbandonedCarts(uid: string, hoursSinceAbandonment: number = 24): Promise<AbandonedCart[]> {
  try {
    const response = await ApiService.getDocuments<AbandonedCart>('abandoned_carts', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'status', operator: '==', value: 'active' }
      ],
      orderByClause: { field: 'lastUpdated', direction: 'desc' }
    });

    if (!response.data) return [];

    // Filter by time since last update
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursSinceAbandonment);

    return response.data.filter(cart => {
      const lastUpdated = new Date(cart.lastUpdated);
      return lastUpdated < cutoffTime;
    });
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Abandoned Carts');
    return [];
  }
}

/**
 * Send recovery message
 */
export async function sendCartRecoveryMessage(
  cart: AbandonedCart,
  recoveryType: 'whatsapp' | 'email' | 'sms' = 'whatsapp'
): Promise<boolean> {
  if (cart.recoveryAttempts >= 3) {
    console.warn('Maximum recovery attempts reached');
    return false;
  }

  const itemsList = cart.items.map(item => 
    `• ${item.productName} x${item.quantity} - TZS ${(item.price * item.quantity).toLocaleString()}`
  ).join('\n');

  const message = `Hi ${cart.customerName || 'there'},\n\n` +
    `You left items in your cart:\n\n${itemsList}\n\n` +
    `Total: TZS ${cart.total.toLocaleString()}\n\n` +
    `Complete your purchase now: ${window.location.origin}/storefront\n\n` +
    `Thank you!`;

  try {
    let success = false;

    switch (recoveryType) {
      case 'whatsapp':
        if (cart.customerPhone) {
          const formattedPhone = formatPhoneForWhatsApp(cart.customerPhone);
          success = await sendWhatsAppMessage({
            to: formattedPhone,
            message,
            type: 'text'
          });
        }
        break;

      case 'email':
        if (cart.customerEmail) {
          const { sendEmail } = await import('./emailService');
          success = await sendEmail({
            to: cart.customerEmail,
            subject: 'Complete Your Purchase',
            html: `<html><body><p>${message}</p><p><a href="${recoveryUrl}">Complete Purchase</a></p></body></html>`,
            text: `${message}\n\nComplete Purchase: ${recoveryUrl}`,
          });
        }
        break;

      case 'sms':
        if (cart.customerPhone) {
          const { sendSMS, SMSTemplates } = await import('./smsService');
          const smsMessage = SMSTemplates.cartReminder(
            cart.storeName || 'Store',
            cart.items.length,
            cart.total,
            recoveryUrl
          );
          success = await sendSMS({ to: cart.customerPhone, message: smsMessage });
        }
        break;
    }

    if (success) {
      // Update recovery attempt
      await ApiService.updateDocument<AbandonedCart>(
        'abandoned_carts',
        cart.id,
        {
          recoveryAttempts: cart.recoveryAttempts + 1,
          lastRecoveryAttempt: new Date().toISOString()
        }
      );
    }

    return success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Send Cart Recovery Message');
    return false;
  }
}

/**
 * Process recovery campaigns (should run periodically)
 */
export async function processRecoveryCampaign(
  uid: string,
  recoveryDelayHours: number = 24
): Promise<number> {
  const abandonedCarts = await getAbandonedCarts(uid, recoveryDelayHours);
  let recoveredCount = 0;

  for (const cart of abandonedCarts) {
    // Skip if already attempted recently (within last 6 hours)
    if (cart.lastRecoveryAttempt) {
      const lastAttempt = new Date(cart.lastRecoveryAttempt);
      const sixHoursAgo = new Date();
      sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
      
      if (lastAttempt > sixHoursAgo) {
        continue;
      }
    }

    // Send recovery message
    const success = await sendCartRecoveryMessage(cart, 'whatsapp');
    if (success) {
      recoveredCount++;
    }
  }

  return recoveredCount;
}

/**
 * Mark cart as recovered
 */
export async function markCartAsRecovered(
  cartId: string,
  orderId: string
): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<AbandonedCart>(
      'abandoned_carts',
      cartId,
      {
        status: 'recovered',
        recoveredAt: new Date().toISOString(),
        recoveredOrderId: orderId
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Mark Cart as Recovered');
    return false;
  }
}

/**
 * Expire old carts (cleanup)
 */
export async function expireOldCarts(uid: string, daysOld: number = 30): Promise<number> {
  try {
    const response = await ApiService.getDocuments<AbandonedCart>('abandoned_carts', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'status', operator: '==', value: 'active' }
      ]
    });

    if (!response.data) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let expiredCount = 0;
    for (const cart of response.data) {
      const lastUpdated = new Date(cart.lastUpdated);
      if (lastUpdated < cutoffDate) {
        await ApiService.updateDocument<AbandonedCart>(
          'abandoned_carts',
          cart.id,
          { status: 'expired' }
        );
        expiredCount++;
      }
    }

    return expiredCount;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Expire Old Carts');
    return 0;
  }
}

/**
 * Get recovery statistics
 */
export async function getRecoveryStats(uid: string, days: number = 30): Promise<{
  totalAbandoned: number;
  recovered: number;
  expired: number;
  recoveryRate: number;
  totalRevenueRecovered: number;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const response = await ApiService.getDocuments<AbandonedCart>('abandoned_carts', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid }
      ]
    });

    if (!response.data) {
      return {
        totalAbandoned: 0,
        recovered: 0,
        expired: 0,
        recoveryRate: 0,
        totalRevenueRecovered: 0
      };
    }

    const recentCarts = response.data.filter(cart => {
      const createdAt = new Date(cart.createdAt);
      return createdAt >= cutoffDate;
    });

    const recovered = recentCarts.filter(c => c.status === 'recovered');
    const expired = recentCarts.filter(c => c.status === 'expired');
    const totalAbandoned = recentCarts.length;
    const recoveryRate = totalAbandoned > 0 ? (recovered.length / totalAbandoned) * 100 : 0;
    const totalRevenueRecovered = recovered.reduce((sum, cart) => sum + cart.total, 0);

    return {
      totalAbandoned,
      recovered: recovered.length,
      expired: expired.length,
      recoveryRate,
      totalRevenueRecovered
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Recovery Stats');
    return {
      totalAbandoned: 0,
      recovered: 0,
      expired: 0,
      recoveryRate: 0,
      totalRevenueRecovered: 0
    };
  }
}

