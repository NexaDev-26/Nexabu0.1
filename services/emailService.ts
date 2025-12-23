/**
 * Email Service
 * Handles email sending via SendGrid or AWS SES
 */

import { ErrorHandler } from '../utils/errorHandler';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    type?: string;
  }>;
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  const sendgridKey = import.meta.env.VITE_SENDGRID_API_KEY;
  const awsRegion = import.meta.env.VITE_AWS_SES_REGION;
  const awsAccessKey = import.meta.env.VITE_AWS_SES_ACCESS_KEY_ID;
  
  return !!(sendgridKey || (awsRegion && awsAccessKey));
}

/**
 * Send email using SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<boolean> {
  const apiKey = import.meta.env.VITE_SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error('SendGrid API key not configured');
  }

  const fromEmail = options.from || 'noreply@nexabu.com';
  const toEmails = Array.isArray(options.to) ? options.to : [options.to];

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: toEmails.map(email => ({
          to: [{ email }],
        })),
        from: { email: fromEmail },
        subject: options.subject,
        content: [
          options.html ? { type: 'text/html', value: options.html } : null,
          options.text ? { type: 'text/plain', value: options.text } : null,
        ].filter(Boolean),
        reply_to: options.replyTo ? { email: options.replyTo } : undefined,
        attachments: options.attachments?.map(att => ({
          content: typeof att.content === 'string' 
            ? att.content 
            : Buffer.from(att.content).toString('base64'),
          filename: att.filename,
          type: att.type || 'application/octet-stream',
          disposition: 'attachment',
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${response.status} ${error}`);
    }

    return true;
  } catch (error: any) {
    ErrorHandler.logError(error, 'Send Email via SendGrid');
    throw error;
  }
}

/**
 * Send email using AWS SES
 */
async function sendViaAWS_SES(options: EmailOptions): Promise<boolean> {
  // Note: AWS SES requires backend implementation for proper signing
  // This is a placeholder - actual implementation should use Firebase Cloud Functions
  console.warn('AWS SES email sending requires backend implementation via Cloud Functions');
  return false;
}

/**
 * Send email
 * Automatically uses configured service (SendGrid or AWS SES)
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('Email service not configured');
    return false;
  }

  try {
    // Prefer SendGrid if configured
    if (import.meta.env.VITE_SENDGRID_API_KEY) {
      return await sendViaSendGrid(options);
    }
    
    // Fall back to AWS SES
    if (import.meta.env.VITE_AWS_SES_REGION) {
      return await sendViaAWS_SES(options);
    }

    return false;
  } catch (error: any) {
    ErrorHandler.logError(error, 'Send Email');
    return false;
  }
}

/**
 * Email templates
 */
export const EmailTemplates = {
  orderConfirmation: (orderNumber: string, customerName: string, items: any[], total: number) => ({
    subject: `Order Confirmation #${orderNumber}`,
    html: `
      <html>
        <body>
          <h2>Order Confirmation</h2>
          <p>Dear ${customerName},</p>
          <p>Thank you for your order!</p>
          <p><strong>Order Number:</strong> ${orderNumber}</p>
          <h3>Items:</h3>
          <ul>
            ${items.map(item => `<li>${item.name} x ${item.quantity} - ${item.price}</li>`).join('')}
          </ul>
          <p><strong>Total: ${total}</strong></p>
          <p>Thank you for your business!</p>
        </body>
      </html>
    `,
    text: `Order Confirmation #${orderNumber}\n\nDear ${customerName},\n\nThank you for your order!\n\nOrder Number: ${orderNumber}\n\nItems:\n${items.map(item => `- ${item.name} x ${item.quantity} - ${item.price}`).join('\n')}\n\nTotal: ${total}\n\nThank you for your business!`,
  }),

  stockAlert: (productName: string, currentStock: number, threshold: number) => ({
    subject: `Low Stock Alert: ${productName}`,
    html: `
      <html>
        <body>
          <h2>Low Stock Alert</h2>
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>Current Stock:</strong> ${currentStock}</p>
          <p><strong>Threshold:</strong> ${threshold}</p>
          <p>Please restock this product soon.</p>
        </body>
      </html>
    `,
    text: `Low Stock Alert\n\nProduct: ${productName}\nCurrent Stock: ${currentStock}\nThreshold: ${threshold}\n\nPlease restock this product soon.`,
  }),

  invoiceReminder: (invoiceNumber: string, customerName: string, amount: number, dueDate: string) => ({
    subject: `Invoice Reminder #${invoiceNumber}`,
    html: `
      <html>
        <body>
          <h2>Invoice Reminder</h2>
          <p>Dear ${customerName},</p>
          <p>This is a reminder that you have an outstanding invoice.</p>
          <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
          <p><strong>Amount:</strong> ${amount}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p>Please make payment at your earliest convenience.</p>
        </body>
      </html>
    `,
    text: `Invoice Reminder #${invoiceNumber}\n\nDear ${customerName},\n\nThis is a reminder that you have an outstanding invoice.\n\nInvoice Number: ${invoiceNumber}\nAmount: ${amount}\nDue Date: ${dueDate}\n\nPlease make payment at your earliest convenience.`,
  }),
};
