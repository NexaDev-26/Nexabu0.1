/**
 * Daily Sales Report Component
 * Comprehensive daily sales analytics and summaries
 */

import React, { useState, useMemo } from 'react';
import { Order, Product, UserRole } from '../types';
import { Calendar, DollarSign, ShoppingBag, TrendingUp, Download, FileText, BarChart3, PieChart, ChevronDown, Printer, Bell } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { formatCommission } from '../utils/commissionUtils';
import { exportToPDF, exportToExcel, exportToCSV, exportToText } from '../utils/exportUtils';
import { scheduleReportDelivery } from '../services/reportDeliveryService';

const todayStr = new Date().toISOString().split('T')[0];
const timezones = [
  { label: 'UTC', offset: 0 },
  { label: 'EAT (UTC+3)', offset: 180 },
  { label: 'CET (UTC+1)', offset: 60 },
  { label: 'IST (UTC+5:30)', offset: 330 },
  { label: 'EST (UTC-5)', offset: -300 },
  { label: 'PST (UTC-8)', offset: -480 },
];

const toTzDate = (iso: string, offsetMinutes: number) => {
  const d = new Date(iso);
  return new Date(d.getTime() + offsetMinutes * 60 * 1000);
};

export const DailySalesReport: React.FC = () => {
  const { orders, products, user, showNotification } = useAppContext();
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: todayStr, end: todayStr });
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'custom'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [timezoneOffset, setTimezoneOffset] = useState<number>(180); // default EAT
  const [salesTarget, setSalesTarget] = useState<number>(0);
  const [ordersTarget, setOrdersTarget] = useState<number>(0);
  const [isScheduling, setIsScheduling] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'detailed' | 'products'>('summary');

  // Apply date presets
  const applyPreset = (p: typeof preset) => {
    const now = new Date();
    let start = todayStr;
    let end = todayStr;
    if (p === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      start = end = y.toISOString().split('T')[0];
    } else if (p === 'last7') {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      start = s.toISOString().split('T')[0];
      end = todayStr;
    } else if (p === 'last30') {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      start = s.toISOString().split('T')[0];
      end = todayStr;
    }
    setPreset(p);
    setDateRange({ start, end });
  };

  const handleSchedule = async () => {
    setIsScheduling(true);
    try {
      await scheduleReportDelivery({
        reportType: 'daily-sales',
        format: 'pdf',
        timezoneOffset,
        filters: {
          dateRange,
          statusFilter,
          paymentFilter,
          salesRepFilter,
          branchFilter,
          channelFilter,
        },
        schedule: { type: 'immediate' },
      });
      showNotification('Report scheduled/sent (backend responded)', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Scheduling failed';
      showNotification(msg, 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  // Filter orders by date range and filters
  const scopedOrders = useMemo(() => {
    if (!user) return orders;
    if (user.role === UserRole.ADMIN) return orders;
    const ownerId = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId || user.uid;
    return orders.filter(o => o.sellerId === ownerId);
  }, [orders, user]);

  const filteredOrders = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);

    return scopedOrders.filter(order => {
      const orderDate = toTzDate(order.date, timezoneOffset);
      if (orderDate < startDate || orderDate > endDate) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && (order.paymentMethod || 'Cash') !== paymentFilter) return false;
      if (salesRepFilter !== 'all' && (order.salesRepName || 'N/A') !== salesRepFilter) return false;
      if (branchFilter !== 'all' && (order.branchId || 'Unassigned') !== branchFilter) return false;
      if (channelFilter !== 'all' && (order.channel || 'POS') !== channelFilter) return false;
      if (order.voided) return false;
      return true;
    });
  }, [scopedOrders, dateRange, statusFilter, paymentFilter, salesRepFilter, branchFilter, channelFilter, timezoneOffset]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const orderCount = filteredOrders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    // Build product index for COGS calculations
    const productIndex = new Map<string, Product>();
    products.forEach(p => {
      productIndex.set(p.id, p);
    });

    // COGS & margin
    let totalCogs = 0;
    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (item.productId) {
          const prod = productIndex.get(item.productId);
          if (prod && typeof prod.buyingPrice === 'number') {
            totalCogs += prod.buyingPrice * item.quantity;
          }
        }
      });
    });
    const grossProfit = totalSales - totalCogs;
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    const totalTax = filteredOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const totalDiscounts = filteredOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const totalRefunds = filteredOrders.reduce((sum, o) => sum + (o.refund || 0), 0);
    const netSales = totalSales - totalDiscounts - totalRefunds + totalTax;
    
    // Payment methods breakdown
    const paymentMethods = filteredOrders.reduce((acc, order) => {
      const method = order.paymentMethod || 'Cash';
      acc[method] = (acc[method] || 0) + order.total;
      return acc;
    }, {} as Record<string, number>);

    // Status breakdown
    const statusCounts = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Top products
    const productSales = filteredOrders.reduce((acc, order) => {
      order.items.forEach(item => {
        acc[item.name] = (acc[item.name] || 0) + (item.price * item.quantity);
      });
      return acc;
    }, {} as Record<string, number>);

    const topProducts = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, revenue]) => ({ name, revenue }));

    // Sales rep commissions
    const repCommissions = filteredOrders
      .filter(o => o.salesRepId && o.commission)
      .reduce((acc, order) => {
        const repName = order.salesRepName || 'Unknown';
        acc[repName] = (acc[repName] || 0) + (order.commission || 0);
        return acc;
      }, {} as Record<string, number>);

    // Hourly distribution (timezone aware)
    const hourlyCounts = filteredOrders.reduce((acc, order) => {
      const hour = toTzDate(order.date, timezoneOffset).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Branch breakdown
    const branchTotals = filteredOrders.reduce((acc, order) => {
      const key = order.branchId || 'Unassigned';
      acc[key] = acc[key] || { sales: 0, orders: 0 };
      acc[key].sales += order.total;
      acc[key].orders += 1;
      return acc;
    }, {} as Record<string, { sales: number; orders: number }>);

    return {
      totalSales,
      netSales,
      totalTax,
      totalDiscounts,
      totalRefunds,
      totalCogs,
      grossProfit,
      grossMargin,
      orderCount,
      avgOrderValue,
      paymentMethods,
      statusCounts,
      topProducts,
      repCommissions,
      hourlyCounts,
      branchTotals
    };
  }, [filteredOrders, products, timezoneOffset]);

  // Export handler supporting multiple formats and filters/ranges
  const handleExport = (format: 'pdf' | 'excel' | 'csv' | 'text') => {
    const data = filteredOrders.map(order => {
      // compute order-level COGS
      let orderCogs = 0;
      order.items.forEach(item => {
        if (item.productId) {
          const prod = products.find(p => p.id === item.productId);
          if (prod && typeof prod.buyingPrice === 'number') {
            orderCogs += prod.buyingPrice * item.quantity;
          }
        }
      });
      const orderGrossProfit = order.total - orderCogs;
      const orderTax = order.tax || 0;
      const orderDiscount = order.discount || 0;
      const orderRefund = order.refund || 0;
      const orderNet = order.total - orderDiscount - orderRefund + orderTax;
      return {
        Date: new Date(order.date).toLocaleDateString(),
        'Order ID': order.id.substring(0, 8),
        Customer: order.customerName,
        Items: order.items.length,
        Total: order.total,
        'Payment Method': order.paymentMethod || 'Cash',
        Status: order.status,
        'Sales Rep': order.salesRepName || 'N/A',
        Commission: order.commission || 0,
        COGS: orderCogs,
        'Gross Profit': orderGrossProfit,
        Tax: orderTax,
        Discount: orderDiscount,
        Refund: orderRefund,
        Net: orderNet,
        Branch: order.branchId || 'Unassigned',
        Channel: order.channel || 'POS'
      };
    });

    const columns = [
      { key: 'Date', label: 'Date', width: 30 },
      { key: 'Order ID', label: 'Order ID', width: 30 },
      { key: 'Customer', label: 'Customer', width: 40 },
      { key: 'Items', label: 'Items', width: 20 },
      { key: 'Total', label: 'Total', width: 25 },
      { key: 'Payment Method', label: 'Payment Method', width: 35 },
      { key: 'Status', label: 'Status', width: 25 },
      { key: 'Sales Rep', label: 'Sales Rep', width: 35 },
      { key: 'Commission', label: 'Commission', width: 30 },
      { key: 'COGS', label: 'COGS', width: 30 },
      { key: 'Gross Profit', label: 'Gross Profit', width: 35 },
      { key: 'Tax', label: 'Tax', width: 25 },
      { key: 'Discount', label: 'Discount', width: 30 },
      { key: 'Refund', label: 'Refund', width: 30 },
      { key: 'Net', label: 'Net', width: 30 },
      { key: 'Branch', label: 'Branch', width: 30 },
      { key: 'Channel', label: 'Channel', width: 30 },
    ];

    const filename = `daily-sales-${dateRange.start}_to_${dateRange.end}`;
    const title = `Daily Sales Report - ${new Date(dateRange.start).toLocaleDateString()} to ${new Date(dateRange.end).toLocaleDateString()}`;

    switch (format) {
      case 'pdf':
        exportToPDF(data, title, filename, columns);
        showNotification('Daily report exported as PDF', 'success');
        break;
      case 'excel':
        exportToExcel(data, title, filename, columns);
        showNotification('Daily report exported as Excel', 'success');
        break;
      case 'csv':
        exportToCSV(data, title, filename, columns);
        showNotification('Daily report exported as CSV', 'success');
        break;
      case 'text':
        exportToText(data, title, filename, columns);
        showNotification('Daily report exported as Text', 'success');
        break;
      default:
        break;
    }
  };

  const uniqueStatuses = useMemo(() => Array.from(new Set(scopedOrders.map(o => o.status))), [scopedOrders]);
  const uniquePayments = useMemo(() => Array.from(new Set(scopedOrders.map(o => o.paymentMethod || 'Cash'))), [scopedOrders]);
  const uniqueSalesReps = useMemo(() => Array.from(new Set(scopedOrders.map(o => o.salesRepName || 'N/A'))), [scopedOrders]);
  const uniqueBranches = useMemo(() => Array.from(new Set(scopedOrders.map(o => o.branchId || 'Unassigned'))), [scopedOrders]);
  const uniqueChannels = useMemo(() => Array.from(new Set(scopedOrders.map(o => o.channel || 'POS'))), [scopedOrders]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4 print-hidden">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Daily Sales Report</h2>
          <p className="text-sm text-neutral-500">Comprehensive daily sales analytics</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            {(['today','yesterday','last7','last30'] as const).map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${preset === p ? 'bg-orange-600 text-white border-orange-600' : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'}`}
              >
                {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'last7' ? 'Last 7 days' : 'Last 30 days'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => { setDateRange(r => ({ ...r, start: e.target.value })); setPreset('custom'); }}
              className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
            />
            <span className="text-neutral-500 text-sm">to</span>
          <input
            type="date"
              value={dateRange.end}
              onChange={e => { setDateRange(r => ({ ...r, end: e.target.value })); setPreset('custom'); }}
            className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
          />
          </div>
          <div className="flex gap-2">
            <div className="relative group">
              <button className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 flex items-center gap-2">
              <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-4 h-4" />
            </button>
              <div className="hidden group-hover:flex flex-col absolute right-0 mt-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-md shadow-lg z-10 min-w-[160px]">
                <button onClick={() => handleExport('pdf')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">PDF</button>
                <button onClick={() => handleExport('excel')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Excel</button>
                <button onClick={() => handleExport('csv')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">CSV</button>
                <button onClick={() => handleExport('text')} className="px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">Text</button>
              </div>
            </div>
            <button onClick={() => window.print()} className="px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2">
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={handleSchedule}
              disabled={isScheduling}
              className="px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              {isScheduling ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 print-hidden">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Calendar className="w-4 h-4" />
          Filters
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="all">All Statuses</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={paymentFilter}
          onChange={e => setPaymentFilter(e.target.value)}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="all">All Payments</option>
          {uniquePayments.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select
          value={salesRepFilter}
          onChange={e => setSalesRepFilter(e.target.value)}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="all">All Sales Reps</option>
          {uniqueSalesReps.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="all">All Branches</option>
          {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select
          value={channelFilter}
          onChange={e => setChannelFilter(e.target.value)}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="all">All Channels</option>
          {uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={timezoneOffset}
          onChange={e => setTimezoneOffset(Number(e.target.value))}
          className="p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          {timezones.map(tz => (
            <option key={tz.label} value={tz.offset}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        {(['summary', 'detailed', 'products'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === mode
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary View */}
      {viewMode === 'summary' && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
                <BarChart3 className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">TZS {stats.totalSales.toLocaleString()}</div>
              <div className="text-sm opacity-90">Total Sales</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
                <PieChart className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">TZS {stats.netSales.toLocaleString()}</div>
              <div className="text-sm opacity-90">Net Sales</div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 opacity-80" />
                <PieChart className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">TZS {stats.totalCogs.toLocaleString()}</div>
              <div className="text-sm opacity-90">COGS</div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 opacity-80" />
                <PieChart className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">TZS {stats.grossProfit.toLocaleString()}</div>
              <div className="text-sm opacity-90">Gross Profit</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 opacity-80" />
                <PieChart className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">{stats.orderCount}</div>
              <div className="text-sm opacity-90">Total Orders</div>
            </div>

            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 opacity-80" />
                <PieChart className="w-5 h-5 opacity-60" />
              </div>
              <div className="text-2xl font-bold mb-1">{stats.grossMargin.toFixed(1)}%</div>
              <div className="text-sm opacity-90">Gross Margin</div>
            </div>
          </div>

          {/* Additional KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Average Order Value</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">TZS {stats.avgOrderValue.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Discounts</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">TZS {stats.totalDiscounts.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Refunds</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">TZS {stats.totalRefunds.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <p className="text-xs text-neutral-500 mb-1">Tax</p>
              <p className="text-xl font-bold text-neutral-900 dark:text-white">TZS {stats.totalTax.toLocaleString()}</p>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Payment Methods</h3>
            <div className="space-y-3">
              {Object.entries(stats.paymentMethods).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between">
                  <span className="text-neutral-700 dark:text-neutral-300">{method}</span>
                  <span className="font-bold text-neutral-900 dark:text-white">
                    TZS {amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Targets */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <p className="text-sm text-neutral-500 mb-2">Daily Targets</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-neutral-500">Sales Target (TZS)</label>
                  <input
                    type="number"
                    value={salesTarget || ''}
                    onChange={e => setSalesTarget(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                  {salesTarget > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Progress: {Math.min(100, Math.round((stats.totalSales / salesTarget) * 100))}%
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Orders Target</label>
                  <input
                    type="number"
                    value={ordersTarget || ''}
                    onChange={e => setOrdersTarget(Number(e.target.value) || 0)}
                    className="w-full p-2 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                  {ordersTarget > 0 && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Progress: {Math.min(100, Math.round((stats.orderCount / ordersTarget) * 100))}%
                    </p>
                  )}
                </div>
              </div>
            </div>
            {salesTarget > 0 && stats.totalSales >= salesTarget && (
              <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
                Target hit! 🎉 Net sales: TZS {stats.netSales.toLocaleString()}
              </div>
            )}
          </div>

          {/* Payment & Status Breakdown Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Payment Methods</h3>
              <div className="space-y-3">
                {Object.entries(stats.paymentMethods).map(([method, amount]) => {
                  const percent = stats.totalSales ? Math.round((amount / stats.totalSales) * 100) : 0;
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-300">
                        <span>{method}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Order Status</h3>
              <div className="space-y-3">
                {Object.entries(stats.statusCounts).map(([status, count]) => {
                  const percent = stats.orderCount ? Math.round((count / stats.orderCount) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex justify-between text-sm text-neutral-600 dark:text-neutral-300">
                        <span>{status}</span>
                        <span>{count} ({percent}%)</span>
                      </div>
                      <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hourly distribution */}
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Hourly Orders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {Array.from({ length: 24 }).map((_, hour) => {
                const count = stats.hourlyCounts[hour] || 0;
                const max = Math.max(...Object.values(stats.hourlyCounts || {0:0}));
                const height = max ? Math.round((count / max) * 100) : 0;
                return (
                  <div key={hour} className="flex flex-col items-center gap-1">
                    <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-20 rounded flex items-end">
                      <div className="w-full bg-blue-500 rounded" style={{ height: `${height}%` }} />
                    </div>
                    <span className="text-xs text-neutral-500">{hour}:00</span>
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Branch breakdown */}
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Branch Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="p-3 text-left">Branch</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {Object.entries(stats.branchTotals).map(([branch, info]) => (
                    <tr key={branch} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="p-3 text-neutral-900 dark:text-white">{branch}</td>
                      <td className="p-3 text-right font-medium text-neutral-900 dark:text-white">TZS {info.sales.toLocaleString()}</td>
                      <td className="p-3 text-right text-neutral-700 dark:text-neutral-300">{info.orders}</td>
                    </tr>
                  ))}
                  {Object.keys(stats.branchTotals).length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-neutral-500">No branch data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Products */}
          {stats.topProducts.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Top Products</h3>
              <div className="space-y-2">
                {stats.topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-neutral-900 dark:text-white">{product.name}</span>
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-white">
                      TZS {product.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Detailed View */}
      {viewMode === 'detailed' && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
            <h3 className="font-bold text-neutral-900 dark:text-white">Order Details</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800">
                <tr>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Time</th>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Order ID</th>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Customer</th>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Items</th>
                  <th className="p-4 text-right text-neutral-500 dark:text-neutral-400">Total</th>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Payment</th>
                  <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                      No orders found for this date
                    </td>
                  </tr>
                ) : (
                filteredOrders.map(order => (
                    <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                      <td className="p-4 text-neutral-900 dark:text-white">
                        {new Date(order.date).toLocaleTimeString()}
                      </td>
                      <td className="p-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">
                        {order.id.substring(0, 8)}
                      </td>
                      <td className="p-4 text-neutral-900 dark:text-white">{order.customerName}</td>
                      <td className="p-4 text-neutral-900 dark:text-white">{order.items.length}</td>
                      <td className="p-4 text-right font-medium text-neutral-900 dark:text-white">
                        TZS {order.total.toLocaleString()}
                      </td>
                      <td className="p-4 text-neutral-900 dark:text-white">
                        {order.paymentMethod || 'Cash'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'Delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                          order.status === 'Processing' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products View */}
      {viewMode === 'products' && (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4">Product Sales Breakdown</h3>
          <div className="space-y-2">
            {stats.topProducts.length === 0 ? (
              <p className="text-neutral-500 text-center py-8">No product sales for this date</p>
            ) : (
              stats.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center font-bold text-orange-600 dark:text-orange-400">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900 dark:text-white">{product.name}</div>
                      <div className="text-xs text-neutral-500">
                        {filteredOrders.reduce((count, order) => {
                          const item = order.items.find(i => i.name === product.name);
                          return count + (item ? item.quantity : 0);
                        }, 0)} units sold
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-neutral-900 dark:text-white">
                      TZS {product.revenue.toLocaleString()}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {((product.revenue / stats.totalSales) * 100).toFixed(1)}% of total
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

