/**
 * SMS Service
 * Handles SMS sending via Twilio
 */

import { ErrorHandler } from '../utils/errorHandler';

export interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

/**
 * Check if SMS service is configured
 */
export function isSMSConfigured(): boolean {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const phoneNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
  
  return !!(accountSid && authToken && phoneNumber);
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(options: SMSOptions): Promise<boolean> {
  if (!isSMSConfigured()) {
    console.warn('SMS service not configured');
    return false;
  }

  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const fromNumber = options.from || import.meta.env.VITE_TWILIO_PHONE_NUMBER;

  // Format phone number (Twilio expects E.164 format)
  const toNumber = formatPhoneNumber(options.to);

  try {
    // Note: For security, Twilio API calls should be made from backend/Cloud Functions
    // This is a placeholder structure - actual implementation should use Firebase Cloud Functions
    // The credentials should not be exposed in frontend code
    
    // Using Twilio API directly (for demo purposes - should be moved to backend)
    const credentials = btoa(`${accountSid}:${authToken}`);
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber!,
          To: toNumber,
          Body: options.message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Twilio API error: ${error.message || response.statusText}`);
    }

    const result = await response.json();
    return result.sid ? true : false;
  } catch (error: any) {
    ErrorHandler.logError(error, 'Send SMS');
    console.warn('SMS sending failed. For production, implement via Cloud Functions.');
    return false;
  }
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Add country code if missing (default to +1 for US/Canada)
  // Adjust this based on your default country
  if (!cleaned.startsWith('1') && cleaned.length === 10) {
    cleaned = '1' + cleaned;
  }
  
  // Add + prefix
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}

/**
 * SMS templates
 */
export const SMSTemplates = {
  orderConfirmation: (orderNumber: string, total: number) => 
    `Order confirmed! Order #${orderNumber}. Total: ${total}. Thank you!`,

  stockAlert: (productName: string, currentStock: number) =>
    `Low stock alert: ${productName} has ${currentStock} units remaining. Please restock.`,

  invoiceReminder: (invoiceNumber: string, amount: number, dueDate: string) =>
    `Invoice reminder: #${invoiceNumber} for ${amount} is due on ${dueDate}. Please pay soon.`,

  deliveryUpdate: (orderNumber: string, status: string, trackingUrl?: string) =>
    `Order #${orderNumber} status: ${status}${trackingUrl ? `. Track: ${trackingUrl}` : ''}`,

  cartReminder: (storeName: string, itemCount: number, total: number, cartUrl: string) =>
    `You left ${itemCount} items in your cart at ${storeName}. Total: ${total}. Complete: ${cartUrl}`,
};

