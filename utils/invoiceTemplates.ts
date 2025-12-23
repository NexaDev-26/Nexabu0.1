/**
 * Invoice Template System
 * Multiple invoice/receipt templates for different use cases
 */

import { Order, Invoice } from '../types';

export type InvoiceTemplate = 'simple' | 'detailed' | 'branded' | 'minimal' | 'professional';

export interface TemplateConfig {
  name: string;
  description: string;
  showLogo: boolean;
  showTax: boolean;
  showPaymentTerms: boolean;
  showNotes: boolean;
  colorScheme: string;
}

export const TEMPLATE_CONFIGS: Record<InvoiceTemplate, TemplateConfig> = {
  simple: {
    name: 'Simple',
    description: 'Basic invoice with essential information',
    showLogo: false,
    showTax: true,
    showPaymentTerms: false,
    showNotes: false,
    colorScheme: 'gray'
  },
  detailed: {
    name: 'Detailed',
    description: 'Comprehensive invoice with all details',
    showLogo: true,
    showTax: true,
    showPaymentTerms: true,
    showNotes: true,
    colorScheme: 'blue'
  },
  branded: {
    name: 'Branded',
    description: 'Custom branded invoice with logo',
    showLogo: true,
    showTax: true,
    showPaymentTerms: true,
    showNotes: true,
    colorScheme: 'orange'
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean minimal design',
    showLogo: false,
    showTax: false,
    showPaymentTerms: false,
    showNotes: false,
    colorScheme: 'neutral'
  },
  professional: {
    name: 'Professional',
    description: 'Business professional format',
    showLogo: true,
    showTax: true,
    showPaymentTerms: true,
    showNotes: true,
    colorScheme: 'blue'
  }
};

/**
 * Generate invoice HTML based on template
 */
export function generateInvoiceHTML(
  invoice: Invoice | Order,
  template: InvoiceTemplate = 'simple',
  storeInfo?: { name?: string; address?: string; phone?: string; email?: string; logo?: string; tin?: string }
): string {
  const config = TEMPLATE_CONFIGS[template];
  const isOrder = 'items' in invoice && !('invoiceNumber' in invoice);
  const items = isOrder ? (invoice as Order).items : (invoice as Invoice).items;
  const total = isOrder ? (invoice as Order).total : (invoice as Invoice).total;
  const tax = (invoice as Invoice).tax || 0;
  const subtotal = total - tax;

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${isOrder ? 'Receipt' : 'Invoice'} - ${config.name} Template</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1f2937;
          background: #f9fafb;
        }
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
          ${config.showLogo && storeInfo?.logo ? 'display: flex; justify-content: space-between; align-items: center;' : ''}
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #${template === 'branded' ? 'f97316' : template === 'detailed' ? '3b82f6' : '6b7280'};
        }
        .logo {
          max-width: 150px;
          max-height: 80px;
        }
        .store-info {
          ${config.showLogo && storeInfo?.logo ? '' : 'text-align: center;'}
        }
        .store-name {
          font-size: 24px;
          font-weight: bold;
          color: #${template === 'branded' ? 'f97316' : template === 'detailed' ? '3b82f6' : '1f2937'};
          margin-bottom: 10px;
        }
        .store-details {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.6;
        }
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          margin: 30px 0;
          color: #${template === 'branded' ? 'f97316' : template === 'detailed' ? '3b82f6' : '1f2937'};
        }
        .invoice-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 30px;
        }
        .info-section {
          background: #f9fafb;
          padding: 15px;
          border-radius: 8px;
        }
        .info-label {
          font-size: 11px;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 5px;
        }
        .info-value {
          font-size: 14px;
          font-weight: 600;
          color: #1f2937;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        thead {
          background: #${template === 'branded' ? 'f97316' : template === 'detailed' ? '3b82f6' : '6b7280'};
          color: white;
        }
        th {
          padding: 12px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .text-right {
          text-align: right;
        }
        .totals {
          margin-top: 20px;
          margin-left: auto;
          width: 300px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .total-row.final {
          border-top: 2px solid #${template === 'branded' ? 'f97316' : template === 'detailed' ? '3b82f6' : '6b7280'};
          border-bottom: none;
          font-weight: bold;
          font-size: 18px;
          padding-top: 15px;
          margin-top: 10px;
        }
        .notes {
          margin-top: 30px;
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
          font-size: 12px;
          color: #6b7280;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 11px;
          color: #9ca3af;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          ${config.showLogo && storeInfo?.logo ? `<img src="${storeInfo.logo}" alt="Logo" class="logo" />` : ''}
          <div class="store-info">
            <div class="store-name">${storeInfo?.name || 'NEXABU STORE'}</div>
            <div class="store-details">
              ${storeInfo?.address || 'Sinza, Dar es Salaam'}<br/>
              ${storeInfo?.phone ? `Phone: ${storeInfo.phone}<br/>` : ''}
              ${storeInfo?.email ? `Email: ${storeInfo.email}<br/>` : ''}
              ${storeInfo?.tin ? `TIN: ${storeInfo.tin}` : 'TIN: 123-456-789'}
            </div>
          </div>
        </div>

        <div class="invoice-title">${isOrder ? 'RECEIPT' : 'INVOICE'}</div>

        <div class="invoice-info">
          <div class="info-section">
            <div class="info-label">${isOrder ? 'Receipt' : 'Invoice'} Number</div>
            <div class="info-value">${isOrder ? `TRA-${(invoice as Order).id.slice(-4)}` : (invoice as Invoice).invoiceNumber}</div>
          </div>
          <div class="info-section">
            <div class="info-label">Date</div>
            <div class="info-value">${new Date(isOrder ? (invoice as Order).date : (invoice as Invoice).issueDate).toLocaleDateString()}</div>
          </div>
          <div class="info-section">
            <div class="info-label">Customer</div>
            <div class="info-value">${isOrder ? (invoice as Order).customerName : (invoice as Invoice).customerName}</div>
          </div>
          ${config.showPaymentTerms && !isOrder ? `
          <div class="info-section">
            <div class="info-label">Payment Terms</div>
            <div class="info-value">${(invoice as Invoice).paymentTerms || 'Net 30'}</div>
          </div>
          ` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right">Quantity</th>
              <th class="text-right">Price</th>
              <th class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">TZS ${item.price.toLocaleString()}</td>
                <td class="text-right">TZS ${(item.price * item.quantity).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>TZS ${subtotal.toLocaleString()}</span>
          </div>
          ${config.showTax && tax > 0 ? `
          <div class="total-row">
            <span>Tax (18%):</span>
            <span>TZS ${tax.toLocaleString()}</span>
          </div>
          ` : ''}
          <div class="total-row final">
            <span>Total:</span>
            <span>TZS ${total.toLocaleString()}</span>
          </div>
        </div>

        ${config.showNotes && !isOrder ? `
        <div class="notes">
          <strong>Notes:</strong><br/>
          ${(invoice as Invoice).notes || 'Thank you for your business!'}
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated by Nexabu POS System</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return html;
}

/**
 * Generate invoice as plain text
 */
export function generateInvoiceText(
  invoice: Invoice | Order,
  template: InvoiceTemplate = 'simple',
  storeInfo?: { name?: string; address?: string; phone?: string; email?: string; tin?: string }
): string {
  const isOrder = 'items' in invoice && !('invoiceNumber' in invoice);
  const items = isOrder ? (invoice as Order).items : (invoice as Invoice).items;
  const total = isOrder ? (invoice as Order).total : (invoice as Invoice).total;
  const tax = (invoice as Invoice).tax || 0;
  const subtotal = total - tax;

  const lines = [
    '='.repeat(50),
    storeInfo?.name || 'NEXABU STORE',
    '='.repeat(50),
    storeInfo?.address || 'Sinza, Dar es Salaam',
    storeInfo?.phone ? `Phone: ${storeInfo.phone}` : '',
    storeInfo?.email ? `Email: ${storeInfo.email}` : '',
    storeInfo?.tin ? `TIN: ${storeInfo.tin}` : 'TIN: 123-456-789',
    '',
    isOrder ? 'RECEIPT' : 'INVOICE',
    '='.repeat(50),
    `${isOrder ? 'Receipt' : 'Invoice'} Number: ${isOrder ? `TRA-${(invoice as Order).id.slice(-4)}` : (invoice as Invoice).invoiceNumber}`,
    `Date: ${new Date(isOrder ? (invoice as Order).date : (invoice as Invoice).issueDate).toLocaleDateString()}`,
    `Customer: ${isOrder ? (invoice as Order).customerName : (invoice as Invoice).customerName}`,
    '',
    'Items:',
    '-'.repeat(50),
    ...items.map(item => 
      `${item.name.padEnd(30)} ${item.quantity.toString().padStart(3)} x TZS ${item.price.toLocaleString().padStart(10)} = TZS ${(item.price * item.quantity).toLocaleString().padStart(12)}`
    ),
    '-'.repeat(50),
    `Subtotal:${' '.repeat(35)}TZS ${subtotal.toLocaleString().padStart(12)}`,
    tax > 0 ? `Tax (18%):${' '.repeat(33)}TZS ${tax.toLocaleString().padStart(12)}` : '',
    '='.repeat(50),
    `TOTAL:${' '.repeat(38)}TZS ${total.toLocaleString().padStart(12)}`,
    '='.repeat(50),
    '',
    'Thank you for your business!',
    'Generated by Nexabu POS System'
  ].filter(line => line !== '');

  return lines.join('\n');
}

