import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// PDF Export Functions
export const exportToPDF = (data: any[], title: string, filename: string, columns: { key: string; label: string; width?: number }[]) => {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text(title, 14, 20);
  
  // Add date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);
  
  let y = 40;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 14;
  const rowHeight = 7;
  const startX = margin;
  let currentX = startX;
  
  // Table header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  columns.forEach((col, idx) => {
    const width = col.width || 40;
    doc.text(col.label, currentX, y);
    currentX += width;
  });
  
  y += rowHeight;
  doc.setLineWidth(0.5);
  doc.line(margin, y - 3, doc.internal.pageSize.width - margin, y - 3);
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  data.forEach((row, rowIdx) => {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }
    
    currentX = startX;
    columns.forEach((col) => {
      const width = col.width || 40;
      const value = formatCellValue(row[col.key]);
      doc.text(String(value).substring(0, 25), currentX, y);
      currentX += width;
    });
    y += rowHeight;
  });
  
  doc.save(`${filename}.pdf`);
};

// Excel Export Functions
export const exportToExcel = (data: any[], title: string, filename: string, columns: { key: string; label: string }[]) => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Map data to include only the specified columns
  const mappedData = data.map(row => {
    const obj: any = {};
    columns.forEach(col => {
      obj[col.label] = formatCellValue(row[col.key]);
    });
    return obj;
  });
  
  const ws = XLSX.utils.json_to_sheet(mappedData);
  
  // Set column widths
  const colWidths = columns.map(col => ({ wch: Math.max(col.label.length, 15) }));
  ws['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// Helper function to format cell values
const formatCellValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
};

// Sales Report Export
export const exportSalesReport = (orders: any[], filename: string = 'sales_report') => {
  const reportData = orders.map(order => ({
    'Order ID': order.id?.substring(0, 8) || 'N/A',
    'Date': new Date(order.date).toLocaleDateString(),
    'Customer': order.customerName || 'N/A',
    'Items': Array.isArray(order.items) ? order.items.length : 0,
    'Total (TZS)': order.total || 0,
    'Status': order.status || 'N/A',
    'Payment Method': order.paymentMethod || 'N/A'
  }));
  
  exportToExcel(reportData, 'Sales Report', filename, [
    { key: 'Order ID', label: 'Order ID' },
    { key: 'Date', label: 'Date' },
    { key: 'Customer', label: 'Customer' },
    { key: 'Items', label: 'Items' },
    { key: 'Total (TZS)', label: 'Total (TZS)' },
    { key: 'Status', label: 'Status' },
    { key: 'Payment Method', label: 'Payment Method' }
  ]);
};

// Expense Report Export
export const exportExpenseReport = (expenses: any[], filename: string = 'expense_report') => {
  const reportData = expenses.map(expense => ({
    'Date': new Date(expense.date).toLocaleDateString(),
    'Category': expense.categoryName || 'N/A',
    'Description': expense.description || 'N/A',
    'Amount (TZS)': expense.amount || 0,
    'Payment Method': expense.paymentMethod || 'N/A',
    'Status': expense.status || 'N/A',
    'Vendor': expense.vendor || 'N/A'
  }));
  
  exportToExcel(reportData, 'Expense Report', filename, [
    { key: 'Date', label: 'Date' },
    { key: 'Category', label: 'Category' },
    { key: 'Description', label: 'Description' },
    { key: 'Amount (TZS)', label: 'Amount (TZS)' },
    { key: 'Payment Method', label: 'Payment Method' },
    { key: 'Status', label: 'Status' },
    { key: 'Vendor', label: 'Vendor' }
  ]);
};

// Inventory Report Export
export const exportInventoryReport = (products: any[], filename: string = 'inventory_report') => {
  const reportData = products.map(product => ({
    'Product Name': product.name || 'N/A',
    'Category': product.category || 'N/A',
    'Stock': product.stock || 0,
    'Price (TZS)': product.price || 0,
    'Buying Price (TZS)': product.buyingPrice || 0,
    'Status': product.status || 'Active',
    'Barcode': product.barcode || 'N/A'
  }));
  
  exportToExcel(reportData, 'Inventory Report', filename, [
    { key: 'Product Name', label: 'Product Name' },
    { key: 'Category', label: 'Category' },
    { key: 'Stock', label: 'Stock' },
    { key: 'Price (TZS)', label: 'Price (TZS)' },
    { key: 'Buying Price (TZS)', label: 'Buying Price (TZS)' },
    { key: 'Status', label: 'Status' },
    { key: 'Barcode', label: 'Barcode' }
  ]);
};

// Customer Report Export
export const exportCustomerReport = (customers: any[], filename: string = 'customer_report') => {
  const reportData = customers.map(customer => ({
    'Name': customer.fullName || 'N/A',
    'Type': customer.type || 'Customer',
    'Phone': customer.phone || 'N/A',
    'Email': customer.email || 'N/A',
    'Location': `${customer.city || ''}, ${customer.district || ''}`.trim() || 'N/A',
    'Opening Balance (TZS)': customer.openingBalance || 0,
    'Status': customer.status || 'Active',
    'Date Added': new Date(customer.dateAdded).toLocaleDateString()
  }));
  
  exportToExcel(reportData, 'Customer Report', filename, [
    { key: 'Name', label: 'Name' },
    { key: 'Type', label: 'Type' },
    { key: 'Phone', label: 'Phone' },
    { key: 'Email', label: 'Email' },
    { key: 'Location', label: 'Location' },
    { key: 'Opening Balance (TZS)', label: 'Opening Balance (TZS)' },
    { key: 'Status', label: 'Status' },
    { key: 'Date Added', label: 'Date Added' }
  ]);
};

// Text Export Functions
export const exportToText = (data: any[], title: string, filename: string, columns: { key: string; label: string }[]) => {
  const lines = [
    '='.repeat(60),
    title.toUpperCase(),
    '='.repeat(60),
    `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    '',
    // Header
    columns.map(col => col.label.padEnd(20)).join(' | '),
    '-'.repeat(60),
    // Data rows
    ...data.map(row => 
      columns.map(col => {
        const value = formatCellValue(row[col.key]);
        return String(value).substring(0, 20).padEnd(20);
      }).join(' | ')
    ),
    '='.repeat(60)
  ];

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.txt`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// CSV Export Functions
export const exportToCSV = (data: any[], title: string, filename: string, columns: { key: string; label: string }[]) => {
  const headers = columns.map(col => col.label);
  const rows = data.map(row => 
    columns.map(col => {
      const value = formatCellValue(row[col.key]);
      // Escape quotes and wrap in quotes if contains comma
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
  );

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};