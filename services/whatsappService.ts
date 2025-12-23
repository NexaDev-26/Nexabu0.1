/**
 * WhatsApp Integration Service
 * Handles WhatsApp Business API integration for order notifications and customer communication
 */

import { Order, Customer } from '../types';
import { ErrorHandler } from '../utils/errorHandler';

export interface WhatsAppMessage {
  to: string;
  message?: string;
  text?: string;
  type?: 'text' | 'template' | 'image' | 'document';
  template?: {
    name: string;
    language?: string;
    parameters?: Array<string | { type?: string; value: string }>;
  };
  previewUrl?: boolean;
  mediaUrl?: string;
}

export interface WhatsAppConfig {
  apiKey: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken?: string;
  apiVersion?: string;
}

// Default config (should come from environment variables)
let whatsappConfig: WhatsAppConfig | null = null;

/**
 * Initialize WhatsApp service
 */
export function initWhatsAppService(config: WhatsAppConfig): void {
  whatsappConfig = {
    ...config,
    apiVersion: config.apiVersion || 'v18.0'
  };
}

/**
 * Format phone number for WhatsApp (E.164 format)
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle Tanzanian numbers
  if (digits.startsWith('0')) {
    digits = '255' + digits.substring(1);
  } else if (!digits.startsWith('255')) {
    digits = '255' + digits;
  }

  // Ensure it starts with +
  return '+' + digits;
}

/**
 * Check if WhatsApp service is configured
 */
export function isWhatsAppConfigured(): boolean {
  const accessToken = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
  return !!(accessToken && phoneNumberId);
}

/**
 * Send WhatsApp message via WhatsApp Business API
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<boolean> {
  if (!isWhatsAppConfigured()) {
    console.warn('WhatsApp service not configured');
    return false;
  }

  const accessToken = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = import.meta.env.VITE_WHATSAPP_API_VERSION || 'v18.0';

  if (!accessToken || !phoneNumberId) {
    console.error('WhatsApp API credentials not configured');
    return false;
  }

  try {
    // Format phone number (WhatsApp requires E.164 format)
    const toNumber = formatPhoneNumber(message.to);

    // Build message payload
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
    };

    // Add message content based on type
    if (message.text || message.message) {
      payload.type = 'text';
      payload.text = {
        body: message.text || message.message || '',
        preview_url: message.previewUrl || false,
      };
    } else if (message.template) {
      payload.type = 'template';
      payload.template = {
        name: message.template.name,
        language: { code: message.template.language || 'en' },
        components: message.template.parameters ? [{
          type: 'body',
          parameters: message.template.parameters.map(param => ({
            type: typeof param === 'string' ? 'text' : param.type || 'text',
            text: typeof param === 'string' ? param : param.value,
          })),
        }] : undefined,
      };
    }

    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp API error: ${error.error?.message || response.statusText}`);
    }

    const result = await response.json();
    return result.messages ? true : false;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Send WhatsApp Message');
    return false;
  }
}

/**
 * Send order confirmation message
 */
export async function sendOrderConfirmation(order: Order, customer: Customer): Promise<boolean> {
  if (!customer.phone) {
    console.warn('Customer phone number not available');
    return false;
  }

  const message = `Hello ${customer.fullName},\n\n` +
    `Your order #${order.id} has been confirmed!\n\n` +
    `Order Details:\n` +
    `Total: TZS ${order.total.toLocaleString()}\n` +
    `Status: ${order.status}\n\n` +
    `Thank you for your business!`;

  return await sendWhatsAppMessage({
    to: customer.phone,
    text: message,
    type: 'text'
  });
}

/**
 * Send order status update
 */
export async function sendOrderStatusUpdate(
  order: Order,
  customer: Customer,
  newStatus: string
): Promise<boolean> {
  if (!customer.phone) {
    return false;
  }

  const statusMessages: { [key: string]: string } = {
    'Processing': 'is being prepared',
    'Delivered': 'has been delivered',
    'Cancelled': 'has been cancelled'
  };

  const message = `Hello ${customer.fullName},\n\n` +
    `Your order #${order.id} ${statusMessages[newStatus] || `status updated to ${newStatus}`}.\n\n` +
    `Thank you for your business!`;

  return await sendWhatsAppMessage({
    to: customer.phone,
    text: message,
    type: 'text'
  });
}

/**
 * Send invoice notification
 */
export async function sendInvoiceNotification(
  invoiceNumber: string,
  amount: number,
  dueDate: string,
  customer: Customer
): Promise<boolean> {
  if (!customer.phone) {
    return false;
  }

  const message = `Hello ${customer.fullName},\n\n` +
    `Invoice #${invoiceNumber}\n` +
    `Amount: TZS ${amount.toLocaleString()}\n` +
    `Due Date: ${new Date(dueDate).toLocaleDateString()}\n\n` +
    `Please make payment by the due date.\n\n` +
    `Thank you!`;

  return await sendWhatsAppMessage({
    to: customer.phone,
    text: message,
    type: 'text'
  });
}

/**
 * Send payment reminder
 */
export async function sendPaymentReminder(
  invoiceNumber: string,
  amount: number,
  daysOverdue: number,
  customer: Customer
): Promise<boolean> {
  if (!customer.phone) {
    return false;
  }

  const message = `Hello ${customer.fullName},\n\n` +
    `This is a reminder that your invoice #${invoiceNumber} is ${daysOverdue} day(s) overdue.\n\n` +
    `Amount: TZS ${amount.toLocaleString()}\n\n` +
    `Please make payment at your earliest convenience.\n\n` +
    `Thank you!`;

  return await sendWhatsAppMessage({
    to: customer.phone,
    text: message,
    type: 'text'
  });
}

/**
 * Send low stock alert to owner
 */
export async function sendLowStockAlert(
  productName: string,
  currentStock: number,
  threshold: number,
  ownerPhone: string
): Promise<boolean> {
  const message = `🚨 Low Stock Alert\n\n` +
    `Product: ${productName}\n` +
    `Current Stock: ${currentStock}\n` +
    `Threshold: ${threshold}\n\n` +
    `Please restock soon!`;

  return await sendWhatsAppMessage({
    to: ownerPhone,
    message,
    type: 'text'
  });
}

/**
 * Format phone number for WhatsApp (E.164 format)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle Tanzanian numbers
  if (digits.startsWith('0')) {
    digits = '255' + digits.substring(1);
  } else if (!digits.startsWith('255')) {
    digits = '255' + digits;
  }

  // Ensure it starts with +
  return '+' + digits;
}

/**
 * Validate phone number for WhatsApp
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const formatted = formatPhoneForWhatsApp(phone);
  // WhatsApp numbers should be in E.164 format: +[country code][number]
  const e164Pattern = /^\+[1-9]\d{1,14}$/;
  return e164Pattern.test(formatted);
}

