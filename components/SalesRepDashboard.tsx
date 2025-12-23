/**
 * Sales Representative Dashboard
 * Performance tracking and commission reports for sales reps
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User, Order, UserRole } from '../types';
import { Trophy, DollarSign, ShoppingBag, TrendingUp, Calendar, User as UserIcon, Award, BarChart3 } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { formatCommission } from '../utils/commissionUtils';

export const SalesRepDashboard: React.FC = () => {
  const { user, orders, allUsers, showNotification } = useAppContext();
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('month');

  // Get sales reps for this vendor
  const salesReps = useMemo(() => {
    if (!user) return [];
    const targetUid = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
    return allUsers.filter(u => u.role === UserRole.SALES_REP && u.employerId === targetUid);
  }, [allUsers, user]);

  // Filter orders by sales rep and time range (memoized for performance)
  const repOrders = useMemo(() => {
    if (!selectedRepId) {
      // Show all sales rep orders
      return orders.filter(o => o.salesRepId);
    }

    const filtered = orders.filter(order => {
      if (order.salesRepId !== selectedRepId) return false;
      
      if (timeRange === 'all') return true;
      
      const orderDate = new Date(order.date);
      const now = new Date();
      
      if (timeRange === 'today') {
        return orderDate.toDateString() === now.toDateString();
      }
      
      if (timeRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      }
      
      if (timeRange === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDate >= monthAgo;
      }
      
      return true;
    });
    
    return filtered;
  }, [orders, selectedRepId, timeRange]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSales = repOrders.reduce((sum, o) => sum + o.total, 0);
    const totalCommission = repOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
    const orderCount = repOrders.length;
    const avgOrderValue = orderCount > 0 ? totalSales / orderCount : 0;
    
    return {
      totalSales,
      totalCommission,
      orderCount,
      avgOrderValue
    };
  }, [repOrders]);

  // Top performing sales reps
  const topReps = useMemo(() => {
    const repStats = salesReps.map(rep => {
      const repOrders = orders.filter(o => o.salesRepId === rep.uid);
      const totalSales = repOrders.reduce((sum, o) => sum + o.total, 0);
      const totalCommission = repOrders.reduce((sum, o) => sum + (o.commission || 0), 0);
      
      return {
        rep,
        orderCount: repOrders.length,
        totalSales,
        totalCommission
      };
    });

    return repStats
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);
  }, [salesReps, orders]);

  if (salesReps.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700">
          <UserIcon className="w-12 h-12 mx-auto mb-4 text-neutral-400" />
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">No Sales Representatives</h3>
          <p className="text-neutral-500">Add sales representatives in Staff Management to track their performance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Sales Rep Performance</h2>
          <p className="text-sm text-neutral-500">Track sales and commissions</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['today', 'week', 'month', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-orange-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Rep Selector */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
          Filter by Sales Rep
        </label>
        <select
          value={selectedRepId || ''}
          onChange={e => setSelectedRepId(e.target.value || null)}
          className="w-full max-w-md p-2.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
        >
          <option value="">All Sales Reps</option>
          {salesReps.map(rep => (
            <option key={rep.uid} value={rep.uid}>
              {rep.name} {rep.commissionRate ? `(${rep.commissionRate}%)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <ShoppingBag className="w-5 h-5 opacity-60" />
          </div>
          <div className="text-2xl font-bold mb-1">TZS {stats.totalSales.toLocaleString()}</div>
          <div className="text-sm opacity-90">Total Sales</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Trophy className="w-8 h-8 opacity-80" />
            <Award className="w-5 h-5 opacity-60" />
          </div>
          <div className="text-2xl font-bold mb-1">{formatCommission(stats.totalCommission)}</div>
          <div className="text-sm opacity-90">Total Commission</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="w-8 h-8 opacity-80" />
            <BarChart3 className="w-5 h-5 opacity-60" />
          </div>
          <div className="text-2xl font-bold mb-1">{stats.orderCount}</div>
          <div className="text-sm opacity-90">Orders</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <DollarSign className="w-5 h-5 opacity-60" />
          </div>
          <div className="text-2xl font-bold mb-1">TZS {stats.avgOrderValue.toLocaleString()}</div>
          <div className="text-sm opacity-90">Avg Order Value</div>
        </div>
      </div>

      {/* Top Performers */}
      {!selectedRepId && (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top Performers
          </h3>
          <div className="space-y-3">
            {topReps.map((stat, index) => (
              <div
                key={stat.rep.uid}
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-orange-600 text-white' :
                    'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-white">{stat.rep.name}</div>
                    <div className="text-xs text-neutral-500">{stat.orderCount} orders</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-neutral-900 dark:text-white">TZS {stat.totalSales.toLocaleString()}</div>
                  <div className="text-xs text-green-600 dark:text-green-400">{formatCommission(stat.totalCommission)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-bold text-neutral-900 dark:text-white">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Date</th>
                <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Customer</th>
                <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Sales Rep</th>
                <th className="p-4 text-right text-neutral-500 dark:text-neutral-400">Total</th>
                <th className="p-4 text-right text-neutral-500 dark:text-neutral-400">Commission</th>
                <th className="p-4 text-left text-neutral-500 dark:text-neutral-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {repOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    No orders found for selected criteria
                  </td>
                </tr>
              ) : (
                repOrders.slice(0, 20).map(order => (
                  <tr key={order.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="p-4 text-neutral-900 dark:text-white">
                      {new Date(order.date).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-neutral-900 dark:text-white">{order.customerName}</td>
                    <td className="p-4 text-neutral-900 dark:text-white">{order.salesRepName || 'N/A'}</td>
                    <td className="p-4 text-right font-medium text-neutral-900 dark:text-white">
                      TZS {order.total.toLocaleString()}
                    </td>
                    <td className="p-4 text-right text-green-600 dark:text-green-400">
                      {order.commission ? formatCommission(order.commission) : 'N/A'}
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
    </div>
  );
};

