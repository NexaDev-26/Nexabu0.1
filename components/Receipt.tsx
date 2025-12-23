import React, { useState } from 'react';
import { Order } from '../types';
import { X, Share2, Printer, FileText } from 'lucide-react';
import { InvoiceTemplateSelector } from './InvoiceTemplateSelector';
import { useAppContext } from '../hooks/useAppContext';

interface ReceiptProps {
    order: Order;
    onClose: () => void;
}

export const Receipt: React.FC<ReceiptProps> = ({ order, onClose }) => {
    const { user } = useAppContext();
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);
    const subtotal = order.total - (order.tax || 0);
    
    const storeInfo = {
        name: user?.storeName || 'NEXABU STORE',
        address: user?.storeAddress || 'Sinza, Dar es Salaam',
        phone: user?.phone || '',
        email: user?.email || '',
        logo: user?.storeLogo || undefined,
        tin: user?.tin || '123-456-789'
    };

    const handleShare = () => {
        const message = `*Receipt for Order #${order.id}*\n\n` +
                        `Customer: ${order.customerName}\n` +
                        `Date: ${new Date(order.date).toLocaleString()}\n` +
                        `Total Paid: TZS ${order.total.toLocaleString()}\n\n` +
                        `Thank you for your business!`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-neutral-800">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
                    <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Official Receipt</h3>
                    <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 bg-neutral-50 dark:bg-neutral-950/50 font-mono text-sm text-neutral-800 dark:text-neutral-200">
                    <div className="text-center mb-6">
                        <h4 className="font-bold text-xl">NEXABU STORE</h4>
                        <p className="text-xs text-neutral-500">Sinza, Dar es Salaam</p>
                        <p className="text-xs text-neutral-500">TIN: 123-456-789</p>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4">
                        <span className="text-neutral-500">RECEIPT NO:</span> <span className="text-right font-bold">{order.receiptNumber || `TRA-${order.id.slice(-4)}`}</span>
                        <span className="text-neutral-500">DATE:</span> <span className="text-right">{new Date(order.date).toLocaleDateString()}</span>
                        <span className="text-neutral-500">TIME:</span> <span className="text-right">{new Date(order.date).toLocaleTimeString()}</span>
                    </div>

                    <div className="border-t border-b border-dashed border-neutral-300 dark:border-neutral-700 py-2 my-2">
                        <div className="flex justify-between font-bold text-xs">
                            <span>DESCRIPTION</span>
                            <div className="flex gap-4">
                                <span>QTY</span>
                                <span className="w-16 text-right">PRICE</span>
                            </div>
                        </div>
                        <div className="space-y-2 mt-2 text-xs">
                            {Array.isArray(order.items) && order.items.map((item, index) => (
                                <div key={index} className="flex justify-between">
                                    <span>{(item as any).name || 'Unknown Item'}</span>
                                    <div className="flex gap-4">
                                        <span>{(item as any).quantity || 1}</span>
                                        <span className="w-16 text-right">{((item as any).price || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1 text-xs mt-4">
                        <div className="flex justify-between">
                            <span className="text-neutral-500">SUBTOTAL</span>
                            <span className="font-medium">{subtotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-neutral-500">TAX (18%)</span>
                            <span className="font-medium">{(order.tax || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t border-neutral-300 dark:border-neutral-700 pt-2 mt-2">
                            <span>TOTAL</span>
                            <span>{order.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>

                    <p className="text-center text-xs text-neutral-500 mt-6">
                        Thank you for your business!
                    </p>
                </div>

                <div className="p-4 flex gap-3 bg-neutral-100 dark:bg-neutral-800/50">
                    <button onClick={handleShare} className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-500 transition-colors flex justify-center items-center gap-2 text-sm">
                        <Share2 className="w-4 h-4" /> Share to WhatsApp
                    </button>
                    <button onClick={() => setShowTemplateSelector(true)} className="bg-orange-600 text-white p-3 rounded-xl hover:bg-orange-500 transition-colors" title="Choose Template">
                        <FileText className="w-5 h-5" />
                    </button>
                    <button onClick={() => window.print()} className="bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 p-3 rounded-xl hover:opacity-80 transition-opacity">
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Invoice Template Selector */}
            <InvoiceTemplateSelector
                invoice={order}
                isOpen={showTemplateSelector}
                onClose={() => setShowTemplateSelector(false)}
                storeInfo={storeInfo}
            />
        </div>
    );
};

export default Receipt;
