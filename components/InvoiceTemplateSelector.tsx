/**
 * Invoice Template Selector Component
 * Allows users to select and preview invoice templates
 */

import React, { useState } from 'react';
import { Invoice, Order } from '../types';
import { FileText, Eye, Download, X } from 'lucide-react';
import { InvoiceTemplate, TEMPLATE_CONFIGS, generateInvoiceHTML, generateInvoiceText } from '../utils/invoiceTemplates';

interface InvoiceTemplateSelectorProps {
  invoice: Invoice | Order;
  isOpen: boolean;
  onClose: () => void;
  storeInfo?: { name?: string; address?: string; phone?: string; email?: string; logo?: string; tin?: string };
}

export const InvoiceTemplateSelector: React.FC<InvoiceTemplateSelectorProps> = ({
  invoice,
  isOpen,
  onClose,
  storeInfo
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<InvoiceTemplate>('simple');
  const [previewMode, setPreviewMode] = useState(false);

  if (!isOpen) return null;

  const handleDownload = (format: 'html' | 'text') => {
    if (format === 'html') {
      const html = generateInvoiceHTML(invoice, selectedTemplate, storeInfo);
      const blob = new Blob([html], { type: 'text/html' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${selectedTemplate}-${Date.now()}.html`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      const text = generateInvoiceText(invoice, selectedTemplate, storeInfo);
      const blob = new Blob([text], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${selectedTemplate}-${Date.now()}.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    const html = generateInvoiceHTML(invoice, selectedTemplate, storeInfo);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Select Invoice Template</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Template Selection */}
          <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 p-4 overflow-y-auto">
            <h4 className="font-semibold text-neutral-900 dark:text-white mb-4">Templates</h4>
            <div className="space-y-2">
              {(Object.keys(TEMPLATE_CONFIGS) as InvoiceTemplate[]).map(template => {
                const config = TEMPLATE_CONFIGS[template];
                return (
                  <button
                    key={template}
                    onClick={() => setSelectedTemplate(template)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedTemplate === template
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="font-medium text-neutral-900 dark:text-white mb-1">
                      {config.name}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {config.description}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {config.showLogo && <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Logo</span>}
                      {config.showTax && <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">Tax</span>}
                      {config.showPaymentTerms && <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">Terms</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h4 className="font-semibold text-neutral-900 dark:text-white">Preview</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {previewMode ? 'Hide' : 'Show'} Preview
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => handleDownload('html')}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  HTML
                </button>
                <button
                  onClick={() => handleDownload('text')}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  TXT
                </button>
              </div>
            </div>

            {previewMode && (
              <div className="flex-1 overflow-auto p-4 bg-neutral-50 dark:bg-neutral-950">
                <iframe
                  srcDoc={generateInvoiceHTML(invoice, selectedTemplate, storeInfo)}
                  className="w-full h-full border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white"
                  title="Invoice Preview"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

