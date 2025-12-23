
import React, { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { ArrowUpRight, Users, ShoppingBag, DollarSign, AlertTriangle, CheckCircle, Package, TrendingUp, Clock, ArrowRight, BrainCircuit, Sparkles, Building, Calendar, FileText, PieChart } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { chatWithGemini } from '../services/geminiService';
import { Expense, UserRole } from '../types';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { exportSalesReport, exportExpenseReport } from '../utils/exportUtils';
import { Download } from 'lucide-react';

const StatCard: React.FC<{ title: string; value: string; subValue?: string; icon: React.ReactNode; color: string; }> = ({ title, value, subValue, icon, color }) => (
  <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{title}</p>
        <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{value}</h3>
        {subValue && <p className="text-xs text-neutral-500 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color} text-white shadow-lg`}>
        {icon}
      </div>
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const { user, orders, products, branches } = useAppContext();
  const [forecast, setForecast] = useState<string | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Load expenses
  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
      const handleError = (error: any) => {
        if (error.code !== 'permission-denied') {
          console.error("Expenses listener error:", error);
        }
      };

      const unsub = onSnapshot(
        query(collection(db, 'expenses'), where('uid', '==', targetUid)),
        (snapshot) => {
          const data = snapshot.docs.map(d => ({...d.data(), id: d.id} as Expense));
          data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
          setExpenses(data);
        },
        handleError
      );

      return () => unsub();
    }
  }, [user]);

  // --- Real Data Calculations ---
  const stats = useMemo(() => {
    const totalIncome = orders.reduce((sum, o) => sum + (o.status !== 'Cancelled' ? o.total : 0), 0);
    // Use real expenses from database, fallback to 0 if none exist
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0); 
    const totalProfit = totalIncome - totalExpenses;
    
    const paidInvoices = orders.filter(o => o.status === 'Delivered').length;
    const outstandingInvoices = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
    
    // Package Active Days
    const activeDays = user?.activationDate 
        ? Math.ceil((new Date().getTime() - new Date(user.activationDate).getTime()) / (1000 * 3600 * 24))
        : 1;

    // Generate Chart Data (Real data for last 7 days)
    const chartData = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6-i));
        const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
        const dayStrFull = d.toISOString().split('T')[0];
        const dayOrders = orders.filter(o => {
          const orderDate = new Date(o.date).toISOString().split('T')[0];
          return orderDate === dayStrFull;
        });
        const dayExpenses = expenses.filter(e => {
          const expenseDate = new Date(e.date).toISOString().split('T')[0];
          return expenseDate === dayStrFull;
        });
        const income = dayOrders.reduce((sum, o) => sum + o.total, 0);
        const expense = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        return { name: dayStr, Income: income, Expense: expense, Profit: income - expense };
    });

    return { 
        totalIncome, 
        totalExpenses, 
        totalProfit, 
        paidInvoices, 
        outstandingInvoices,
        activeDays,
        branchCount: branches.length + 1, // Main + branches
        totalItems: products.length,
        lowStock: products.filter(p => p.stock < 10).length,
        cashSales: totalIncome,
        chartData
    };
  }, [orders, products, branches, user, expenses]);

  const handleGenerateForecast = async () => {
      setIsForecasting(true);
      try {
          const prompt = `Analyze sales data: Total Revenue ${stats.totalIncome}. Predict next week's trend.`;
          const result = await chatWithGemini(prompt, [], true);
          setForecast(result.text || "Forecast unavailable.");
      } catch (e) { setForecast("AI unavailable."); } finally { setIsForecasting(false); }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Dashboard</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Overview for {user?.storeName}</p>
        </div>
        <div className="flex items-center gap-3">
        <div className="bg-neutral-100 dark:bg-neutral-800 px-4 py-2 rounded-lg text-sm font-mono">
            {new Date().toDateString()}
          </div>
          <button
            onClick={() => exportSalesReport(orders, `sales_report_${new Date().toISOString().split('T')[0]}`)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Export Sales
          </button>
          <button
            onClick={() => exportExpenseReport(expenses, `expense_report_${new Date().toISOString().split('T')[0]}`)}
            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Export Expenses
          </button>
        </div>
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Income" value={`TZS ${stats.totalIncome.toLocaleString()}`} icon={<DollarSign className="w-6 h-6" />} color="bg-green-600" />
        <StatCard title="Total Expenses" value={`TZS ${stats.totalExpenses.toLocaleString()}`} icon={<TrendingUp className="w-6 h-6" />} color="bg-red-500" />
        <StatCard title="Total Profits" value={`TZS ${stats.totalProfit.toLocaleString()}`} icon={<DollarSign className="w-6 h-6" />} color="bg-blue-600" />
        <StatCard title="Active Days" value={`${stats.activeDays} Days`} subValue={`Plan: ${user?.subscriptionPlan || 'Free'}`} icon={<Calendar className="w-6 h-6" />} color="bg-purple-600" />
      </div>

      {/* Analytics Chart */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-neutral-900 dark:text-white"><PieChart className="w-5 h-5 text-orange-600"/> Profit & Loss Trend</h3>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.chartData}>
                    <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ea580c" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ea580c" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false}/>
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000}k`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.2} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#171717', border: '1px solid #333', borderRadius: '8px' }} 
                        itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="Profit" stroke="#ea580c" fillOpacity={1} fill="url(#colorProfit)" />
                    <Area type="monotone" dataKey="Income" stroke="#16a34a" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
                </AreaChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Branch Count" value={stats.branchCount.toString()} icon={<Building className="w-6 h-6" />} color="bg-orange-500" />
          <StatCard title="Total Items" value={stats.totalItems.toString()} subValue={`${stats.lowStock} Low Stock`} icon={<Package className="w-6 h-6" />} color="bg-indigo-500" />
          <StatCard title="Cash Sales" value={`TZS ${stats.cashSales.toLocaleString()}`} icon={<ShoppingBag className="w-6 h-6" />} color="bg-teal-600" />
      </div>

      {/* Invoices Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div><p className="text-neutral-500 text-sm">Total Invoices</p><h3 className="text-xl font-bold dark:text-white">{orders.length}</h3></div>
              <FileText className="text-neutral-400"/>
          </div>
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div><p className="text-neutral-500 text-sm">Paid Invoices</p><h3 className="text-xl font-bold text-green-600">{stats.paidInvoices}</h3></div>
              <CheckCircle className="text-green-500"/>
          </div>
          <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div><p className="text-neutral-500 text-sm">Outstanding</p><h3 className="text-xl font-bold text-orange-600">{stats.outstandingInvoices}</h3></div>
              <Clock className="text-orange-500"/>
          </div>
      </div>

      {/* AI Widget */}
      <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white p-6 rounded-xl shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex justify-between items-center">
              <div>
                  <h3 className="font-bold text-lg flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-orange-400"/> AI Business Insights</h3>
                  <p className="text-sm text-neutral-400 mt-1">{forecast || "Click to analyze your sales patterns."}</p>
              </div>
              <button onClick={handleGenerateForecast} disabled={isForecasting} className="px-4 py-2 bg-white text-neutral-900 rounded-lg font-bold text-sm flex items-center gap-2">
                  {isForecasting ? <Sparkles className="animate-spin w-4 h-4"/> : <Sparkles className="w-4 h-4"/>} Analyze
              </button>
          </div>
      </div>
    </div>
  );
};
