/**
 * Advanced Analytics Service
 * Provides comprehensive business analytics and reporting
 */

import { Order, Product, Expense, Invoice, Bill, Customer } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';

export interface AnalyticsPeriod {
  startDate: string;
  endDate: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
}

export interface SalesAnalytics {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  salesGrowth: number; // Percentage
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    date: string;
    sales: number;
    orders: number;
  }>;
  salesByCategory?: Array<{
    category: string;
    sales: number;
    percentage: number;
  }>;
}

export interface ProfitLossReport {
  period: AnalyticsPeriod;
  revenue: {
    total: number;
    fromSales: number;
    fromInvoices: number;
    other: number;
  };
  costOfGoodsSold: {
    total: number;
    purchases: number;
    adjustments: number;
  };
  grossProfit: number;
  operatingExpenses: {
    total: number;
    byCategory: Array<{
      category: string;
      amount: number;
      percentage: number;
    }>;
  };
  netProfit: number;
  profitMargin: number; // Percentage
  ebitda?: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  averageCustomerValue: number;
  customerRetentionRate: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalSpent: number;
    orderCount: number;
    lastOrderDate: string;
  }>;
  customerLifetimeValue: number;
}

export interface InventoryAnalytics {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  turnoverRate: number;
  topSellingProducts: Array<{
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  slowMovingProducts: Array<{
    productId: string;
    productName: string;
    stock: number;
    lastSold?: string;
  }>;
}

export interface PerformanceMetrics {
  conversionRate: number;
  averageOrderValue: number;
  itemsPerOrder: number;
  cartAbandonmentRate?: number;
  deliveryTime?: number; // Average in hours
  customerSatisfaction?: number; // 0-100
}

/**
 * Get sales analytics for a period
 */
export async function getSalesAnalytics(
  uid: string,
  period: AnalyticsPeriod
): Promise<SalesAnalytics | null> {
  try {
    // Get orders in period
    const ordersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: period.startDate },
        { field: 'date', operator: '<=', value: period.endDate }
      ]
    });

    if (!ordersResponse.success || !ordersResponse.data) {
      return null;
    }

    const orders = ordersResponse.data.filter(o => o.status !== 'Cancelled');
    
    // Calculate previous period for growth comparison
    const prevStart = new Date(period.startDate);
    const prevEnd = new Date(period.endDate);
    const daysDiff = (prevEnd.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24);
    prevEnd.setTime(prevStart.getTime());
    prevStart.setTime(prevStart.getTime() - (daysDiff + 1) * 24 * 60 * 60 * 1000);

    const prevOrdersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: prevStart.toISOString() },
        { field: 'date', operator: '<=', value: prevEnd.toISOString() }
      ]
    });

    const prevOrders = prevOrdersResponse.data?.filter(o => o.status !== 'Cancelled') || [];
    const prevSales = prevOrders.reduce((sum, o) => sum + o.total, 0);

    // Calculate metrics
    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    const salesGrowth = prevSales > 0 ? ((totalSales - prevSales) / prevSales) * 100 : 0;

    // Top products
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    orders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const productId = item.productId || item.id || 'unknown';
          const productName = item.name || item.productName || 'Unknown';
          const quantity = item.quantity || 1;
          const price = item.price || 0;
          
          if (!productSales[productId]) {
            productSales[productId] = { name: productName, quantity: 0, revenue: 0 };
          }
          productSales[productId].quantity += quantity;
          productSales[productId].revenue += price * quantity;
        });
      }
    });

    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        quantitySold: data.quantity,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Sales by day
    const salesByDayMap: { [key: string]: { sales: number; orders: number } } = {};
    orders.forEach(order => {
      const date = new Date(order.date).toISOString().split('T')[0];
      if (!salesByDayMap[date]) {
        salesByDayMap[date] = { sales: 0, orders: 0 };
      }
      salesByDayMap[date].sales += order.total;
      salesByDayMap[date].orders += 1;
    });

    const salesByDay = Object.entries(salesByDayMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalSales,
      totalOrders,
      averageOrderValue,
      salesGrowth,
      topProducts,
      salesByDay
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Sales Analytics');
    return null;
  }
}

/**
 * Generate Profit & Loss Report
 */
export async function generateProfitLossReport(
  uid: string,
  period: AnalyticsPeriod
): Promise<ProfitLossReport | null> {
  try {
    // Get revenue (orders + invoices)
    const ordersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: period.startDate },
        { field: 'date', operator: '<=', value: period.endDate },
        { field: 'status', operator: '!=', value: 'Cancelled' }
      ]
    });

    const invoicesResponse = await ApiService.getDocuments<Invoice>('invoices', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'dateIssued', operator: '>=', value: period.startDate },
        { field: 'dateIssued', operator: '<=', value: period.endDate },
        { field: 'status', operator: '==', value: 'Paid' }
      ]
    });

    // Get expenses
    const expensesResponse = await ApiService.getDocuments<Expense>('expenses', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: period.startDate },
        { field: 'date', operator: '<=', value: period.endDate }
      ]
    });

    // Get purchase orders (cost of goods)
    const purchaseOrdersResponse = await ApiService.getDocuments<any>('purchase_orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'createdAt', operator: '>=', value: period.startDate },
        { field: 'createdAt', operator: '<=', value: period.endDate },
        { field: 'status', operator: '==', value: 'Completed' }
      ]
    });

    const orders = ordersResponse.data || [];
    const invoices = invoicesResponse.data || [];
    const expenses = expensesResponse.data || [];
    const purchaseOrders = purchaseOrdersResponse.data || [];

    // Calculate revenue
    const revenueFromSales = orders.reduce((sum, o) => sum + o.total, 0);
    const revenueFromInvoices = invoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const totalRevenue = revenueFromSales + revenueFromInvoices;

    // Calculate COGS (simplified - would need actual purchase costs)
    const costOfGoodsSold = purchaseOrders.reduce((sum, po) => sum + (po.totalCost || 0), 0);
    
    // Gross profit
    const grossProfit = totalRevenue - costOfGoodsSold;

    // Operating expenses by category
    const expensesByCategory: { [key: string]: number } = {};
    let totalOperatingExpenses = 0;

    expenses.forEach(expense => {
      const category = expense.categoryName || 'Other';
      if (!expensesByCategory[category]) {
        expensesByCategory[category] = 0;
      }
      expensesByCategory[category] += expense.amount || 0;
      totalOperatingExpenses += expense.amount || 0;
    });

    const expensesByCategoryArray = Object.entries(expensesByCategory)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalOperatingExpenses > 0 ? (amount / totalOperatingExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    // Net profit
    const netProfit = grossProfit - totalOperatingExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period,
      revenue: {
        total: totalRevenue,
        fromSales: revenueFromSales,
        fromInvoices: revenueFromInvoices,
        other: 0
      },
      costOfGoodsSold: {
        total: costOfGoodsSold,
        purchases: costOfGoodsSold,
        adjustments: 0
      },
      grossProfit,
      operatingExpenses: {
        total: totalOperatingExpenses,
        byCategory: expensesByCategoryArray
      },
      netProfit,
      profitMargin
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Generate Profit Loss Report');
    return null;
  }
}

/**
 * Get customer analytics
 */
export async function getCustomerAnalytics(
  uid: string,
  period: AnalyticsPeriod
): Promise<CustomerAnalytics | null> {
  try {
    const customersResponse = await ApiService.getDocuments<Customer>('customers', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid }
      ]
    });

    const ordersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: period.startDate },
        { field: 'date', operator: '<=', value: period.endDate }
      ]
    });

    if (!customersResponse.data || !ordersResponse.data) {
      return null;
    }

    const customers = customersResponse.data;
    const orders = ordersResponse.data.filter(o => o.status !== 'Cancelled');

    // Calculate previous period
    const prevStart = new Date(period.startDate);
    const daysDiff = (new Date(period.endDate).getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24);
    prevStart.setTime(prevStart.getTime() - (daysDiff + 1) * 24 * 60 * 60 * 1000);

    const prevCustomersResponse = await ApiService.getDocuments<Customer>('customers', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'createdAt', operator: '>=', value: prevStart.toISOString() },
        { field: 'createdAt', operator: '<', value: period.startDate }
      ]
    });

    const newCustomers = customers.filter(c => {
      const createdAt = c.createdAt || '';
      return createdAt >= period.startDate && createdAt <= period.endDate;
    }).length;

    // Customer spending
    const customerSpending: { [key: string]: { name: string; total: number; orders: number; lastOrder: string } } = {};
    orders.forEach(order => {
      const customerId = order.customerId || order.customerName || 'unknown';
      if (!customerSpending[customerId]) {
        customerSpending[customerId] = {
          name: order.customerName || 'Unknown',
          total: 0,
          orders: 0,
          lastOrder: order.date
        };
      }
      customerSpending[customerId].total += order.total;
      customerSpending[customerId].orders += 1;
      if (order.date > customerSpending[customerId].lastOrder) {
        customerSpending[customerId].lastOrder = order.date;
      }
    });

    const activeCustomers = Object.keys(customerSpending).length;
    const totalCustomerValue = Object.values(customerSpending).reduce((sum, c) => sum + c.total, 0);
    const averageCustomerValue = activeCustomers > 0 ? totalCustomerValue / activeCustomers : 0;

    // Customer retention (simplified - customers who ordered in both periods)
    const prevOrdersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: prevStart.toISOString() },
        { field: 'date', operator: '<', value: period.startDate }
      ]
    });

    const prevCustomers = new Set(
      (prevOrdersResponse.data || []).map(o => o.customerId || o.customerName)
    );
    const currentCustomers = new Set(Object.keys(customerSpending));
    const retainedCustomers = [...currentCustomers].filter(id => prevCustomers.has(id)).length;
    const customerRetentionRate = prevCustomers.size > 0 
      ? (retainedCustomers / prevCustomers.size) * 100 
      : 0;

    const topCustomers = Object.entries(customerSpending)
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        totalSpent: data.total,
        orderCount: data.orders,
        lastOrderDate: data.lastOrder
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Customer Lifetime Value (simplified - average per customer)
    const customerLifetimeValue = averageCustomerValue * 12; // Annual estimate

    return {
      totalCustomers: customers.length,
      activeCustomers,
      newCustomers,
      averageCustomerValue,
      customerRetentionRate,
      topCustomers,
      customerLifetimeValue
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Customer Analytics');
    return null;
  }
}

/**
 * Get inventory analytics
 */
export async function getInventoryAnalytics(
  uid: string,
  products: Product[]
): Promise<InventoryAnalytics | null> {
  try {
    // Filter products that belong to the user (uid only, no employerId needed since products already filtered)
    const userProducts = products.filter(p => p.uid === uid);
    
    // Get orders for turnover calculation
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ordersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: thirtyDaysAgo.toISOString() },
        { field: 'status', operator: '!=', value: 'Cancelled' }
      ]
    });

    const orders = ordersResponse.data || [];

    // Calculate product sales
    const productSales: { [key: string]: { name: string; unitsSold: number; revenue: number } } = {};
    orders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const productId = item.productId || item.id || '';
          if (productId && userProducts.find(p => p.id === productId)) {
            if (!productSales[productId]) {
              productSales[productId] = {
                name: item.name || item.productName || 'Unknown',
                unitsSold: 0,
                revenue: 0
              };
            }
            productSales[productId].unitsSold += item.quantity || 1;
            productSales[productId].revenue += (item.price || 0) * (item.quantity || 1);
          }
        });
      }
    });

    const totalValue = userProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
    const lowStockItems = userProducts.filter(p => {
      const threshold = p.lowStockThreshold || 10;
      return (p.stock || 0) > 0 && (p.stock || 0) <= threshold;
    }).length;
    const outOfStockItems = userProducts.filter(p => (p.stock || 0) === 0).length;

    // Inventory turnover (simplified)
    const totalCostOfSales = Object.values(productSales).reduce((sum, ps) => sum + ps.revenue, 0);
    const averageInventory = totalValue / 2; // Simplified
    const turnoverRate = averageInventory > 0 ? totalCostOfSales / averageInventory : 0;

    const topSellingProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        productName: data.name,
        unitsSold: data.unitsSold,
        revenue: data.revenue
      }))
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    // Slow moving products (haven't sold in 60 days)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const recentProductIds = new Set(Object.keys(productSales));
    
    const slowMovingProducts = userProducts
      .filter(p => !recentProductIds.has(p.id) && (p.stock || 0) > 0)
      .map(p => ({
        productId: p.id,
        productName: p.name,
        stock: p.stock || 0
      }))
      .slice(0, 10);

    return {
      totalProducts: userProducts.length,
      totalValue,
      lowStockItems,
      outOfStockItems,
      turnoverRate,
      topSellingProducts,
      slowMovingProducts
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Inventory Analytics');
    return null;
  }
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(
  uid: string,
  period: AnalyticsPeriod
): Promise<PerformanceMetrics | null> {
  try {
    const ordersResponse = await ApiService.getDocuments<Order>('orders', {
      whereClauses: [
        { field: 'uid', operator: '==', value: uid },
        { field: 'date', operator: '>=', value: period.startDate },
        { field: 'date', operator: '<=', value: period.endDate }
      ]
    });

    const orders = ordersResponse.data || [];
    const completedOrders = orders.filter(o => o.status === 'Delivered');

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Items per order
    let totalItems = 0;
    orders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          totalItems += item.quantity || 1;
        });
      }
    });
    const itemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

    // Conversion rate (simplified - would need visitor data)
    const conversionRate = 0; // Placeholder

    // Cart abandonment (would need cart data)
    // const cartAbandonmentRate = ...;

    return {
      conversionRate,
      averageOrderValue,
      itemsPerOrder
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Performance Metrics');
    return null;
  }
}


