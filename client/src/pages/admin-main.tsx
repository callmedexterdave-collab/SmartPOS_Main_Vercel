import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { LogOut, DollarSign, Package, Plus, Eye, Calendar, CreditCard, Receipt, User, FileText } from 'lucide-react';
import Layout from '@/components/Layout';
import FloatingActionButton from '@/components/FloatingActionButton';
import { useAuth } from '@/contexts/AuthContext';
import {
    SalesService, ProductService, ExpenseService, PurchaseService, CreditorService
} from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ChartContainer } from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '@/lib/db';

// Schemas for expenses and purchases
const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  date: z.string().min(1, 'Date is required'),
});

const purchaseSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  cost: z.number().min(0.01, 'Cost must be greater than 0'),
  supplier: z.string().min(1, 'Supplier is required'),
  date: z.string().min(1, 'Date is required'),
});

const creditorSchema = z.object({
  name: z.string().min(1, 'Creditor name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  description: z.string().min(1, 'Description is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  reminderDate: z.string().min(1, 'Reminder date is required'),
});

type ExpenseFormData = z.infer<typeof expenseSchema>;
type PurchaseFormData = z.infer<typeof purchaseSchema>;
type CreditorFormData = z.infer<typeof creditorSchema>;

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface Purchase {
  id: string;
  productName: string;
  quantity: number;
  cost: number;
  supplier: string | null;
  date: string;
}

interface Creditor {
  id: string;
  name: string;
  amount: number;
  description: string;
  dueDate: string;
  reminderDate: string;
  isPaid: boolean;
}

const AdminMain: React.FC = () => {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState({
    todaySales: 0,
    totalProducts: 0,
    totalIncome: 0,
    revenueTrend: '+0.0%',
    expenseTrend: '+0.0%',
    profitTrend: '+0.0%',
  });

  // State for expenses, purchases, and creditors
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddPurchaseOpen, setIsAddPurchaseOpen] = useState(false);
  const [isAddCreditorOpen, setIsAddCreditorOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Form hooks
  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      amount: 0,
      category: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const purchaseForm = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      productName: '',
      quantity: 1,
      cost: 0,
      supplier: '',
      date: new Date().toISOString().split('T')[0],
    },
  });
  
  const creditorForm = useForm<CreditorFormData>({
    resolver: zodResolver(creditorSchema),
    defaultValues: {
      name: '',
      amount: 0,
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      reminderDate: new Date().toISOString().split('T')[0],
    },
  });

  const handleTutorialClick = () => {
    // Tutorial functionality - can be expanded later
    console.log('Tutorial started');
  };

  const handleAddExpense = async (data: ExpenseFormData) => {
    try {
      await ExpenseService.addExpense({
        description: data.description,
        amount: data.amount,
        category: data.category,
        date: new Date(data.date),
      });
      setIsAddExpenseOpen(false);
      expenseForm.reset();
      toast({
        title: 'Expense Added',
        description: `${data.description} has been added`,
      });
      loadFinancialData(); // Refresh data
      loadStats(); // Refresh stats for trends
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add expense',
        variant: 'destructive',
      });
    }
  };

  const handleAddPurchase = async (data: PurchaseFormData) => {
    try {
      await PurchaseService.addPurchase({
        productName: data.productName,
        quantity: data.quantity,
        cost: data.cost,
        supplier: data.supplier || null,
        date: new Date(data.date),
        description: null,
        details: null,
        expirationDate: null,
      });
      setIsAddPurchaseOpen(false);
      purchaseForm.reset();
      toast({
        title: 'Purchase Added',
        description: `${data.productName} has been added`,
      });
      loadFinancialData(); // Refresh data
      loadStats(); // Refresh stats for trends
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add purchase',
        variant: 'destructive',
      });
    }
  };
  
  const handleAddCreditor = async (data: CreditorFormData) => {
    try {
      await CreditorService.addCreditor({
        name: data.name,
        amount: data.amount,
        description: data.description,
        dueDate: new Date(data.dueDate),
        reminderDate: new Date(data.reminderDate),
        isPaid: false,
      });
      setIsAddCreditorOpen(false);
      creditorForm.reset();
      toast({
        title: 'Creditor Added',
        description: `${data.name} has been added to the ledger`,
      });
      loadFinancialData(); // Refresh data
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add creditor',
        variant: 'destructive',
      });
    }
  };

  const getFilteredExpenses = () => {
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === selectedMonth && expenseDate.getFullYear() === selectedYear;
    });
  };

  const getFilteredPurchases = () => {
    return purchases.filter(purchase => {
      const purchaseDate = new Date(purchase.date);
      return purchaseDate.getMonth() === selectedMonth && purchaseDate.getFullYear() === selectedYear;
    });
  };
  
  const getFilteredCreditors = () => {
    return creditors.filter(creditor => {
      const dueDate = new Date(creditor.dueDate);
      return dueDate.getMonth() === selectedMonth && dueDate.getFullYear() === selectedYear;
    });
  };
  
  const getUpcomingPayments = () => {
    const today = new Date();
    return creditors.filter(creditor => {
      if (creditor.isPaid) return false;
      const dueDate = new Date(creditor.dueDate);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7; // Due within a week
    });
  };

  const getMonthName = (month: number) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  };

  const loadFinancialData = async () => {
    try {
      const [expensesData, purchasesData, creditorsData] = await Promise.all([
        ExpenseService.getAllExpenses(),
        PurchaseService.getAllPurchases(),
        CreditorService.getAllCreditors(),
      ]);
      setExpenses(expensesData.map(e => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        category: e.category,
        date: (e.date instanceof Date ? e.date : new Date(e.date ?? Date.now())).toISOString().split('T')[0],
      })));
      setPurchases(purchasesData.map(p => ({
        id: p.id,
        productName: p.productName,
        quantity: p.quantity,
        cost: p.cost,
        supplier: p.supplier ?? null,
        date: (p.date instanceof Date ? p.date : new Date(p.date ?? Date.now())).toISOString().split('T')[0],
      })));
      setCreditors(creditorsData.map(c => ({
        id: c.id,
        name: c.name,
        amount: c.amount,
        description: c.description ?? '',
        dueDate: (c.dueDate instanceof Date ? c.dueDate : new Date(c.dueDate ?? Date.now())).toISOString().split('T')[0],
        reminderDate: (c.reminderDate instanceof Date ? c.reminderDate : new Date(c.reminderDate ?? Date.now())).toISOString().split('T')[0],
        isPaid: !!c.isPaid,
      })));
    } catch (error) {
      console.error('Error loading financial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load financial data',
        variant: 'destructive',
      });
    }
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '+0.0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const loadStats = async () => {
    try {
      const products = await ProductService.getAllProducts();
      const todaysSales = await SalesService.getTodaysSales();
      const todaysTotal = Array.isArray(todaysSales)
        ? todaysSales.reduce((sum, sale) => sum + (sale.total || 0), 0)
        : 0;
      const totalIncome = await SalesService.getTotalSales();

      // Calculate trends (Current week vs Previous week)
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      const allSales = await db.sales.toArray();
      const allExpenses = await db.expenses.toArray();

      const currentWeekSales = allSales
        .filter(s => new Date(s.createdAt as any) >= oneWeekAgo)
        .reduce((sum, s) => sum + (s.total || 0), 0);
      const previousWeekSales = allSales
        .filter(s => {
          const d = new Date(s.createdAt as any);
          return d >= twoWeeksAgo && d < oneWeekAgo;
        })
        .reduce((sum, s) => sum + (s.total || 0), 0);

      const currentWeekExpenses = allExpenses
        .filter(e => new Date(e.date) >= oneWeekAgo)
        .reduce((sum, e) => sum + (e.amount || 0), 0);
      const previousWeekExpenses = allExpenses
        .filter(e => {
          const d = new Date(e.date);
          return d >= twoWeeksAgo && d < oneWeekAgo;
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const currentProfit = currentWeekSales - currentWeekExpenses;
      const previousProfit = previousWeekSales - previousWeekExpenses;

      setStats({
        todaySales: todaysTotal,
        totalProducts: products.length,
        totalIncome,
        revenueTrend: calculateTrend(currentWeekSales, previousWeekSales),
        expenseTrend: calculateTrend(currentWeekExpenses, previousWeekExpenses),
        profitTrend: calculateTrend(currentProfit, previousProfit),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard stats',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadStats();
    loadFinancialData();
    loadChartData();
    
    // Update date and time every second
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Derived KPI values (Income, Expenses, Profit)
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const profit = stats.totalIncome - totalExpenses;

  const [chartData, setChartData] = useState<Array<{ date: string; income: number; expenses: number }>>([]);

  const loadChartData = async () => {
    try {
      const sales = await db.sales.toArray();
      const allExpenses = await db.expenses.toArray();

      const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return d;
      });

      const data = days.map(d => {
        const next = new Date(d);
        next.setHours(23, 59, 59, 999);

        const income = sales
          .filter(s => {
            const c = new Date(s.createdAt as any);
            return c >= d && c <= next && (s.paymentType as any) !== 'credits';
          })
          .reduce((sum, s) => sum + (s.total || 0), 0);

        const exp = allExpenses
          .filter(e => {
            const c = new Date(e.date);
            return c >= d && c <= next;
          })
          .reduce((sum, e) => sum + (e.amount || 0), 0);

        return { date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), income, expenses: exp };
      });

      setChartData(data);
    } catch (error) {
      console.error('Failed to load chart data', error);
    }
  };

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background"
      >
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between p-6">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black tracking-tighter gold-gradient-text uppercase">SmartPOS+</h1>
              <div className="text-[10px] font-bold tracking-[0.2em] text-gray-400 mt-1 uppercase">
                {currentDateTime.toLocaleDateString('en-US', {month: 'long', day: '2-digit', year: 'numeric'})} • {currentDateTime.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit', hour12: true})}
              </div>
            </div>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-3 bg-white p-1.5 pr-4 rounded-full border border-gray-100 shadow-sm hover:shadow-md transition-all focus:outline-none group">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#BF953F] to-[#B38728] rounded-full flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Administrator</span>
                    <span className="text-[10px] text-gray-400 font-medium">Control Center</span>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" sideOffset={10} className="w-56 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 p-2">
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      setLocation('/role-selection');
                    }}
                    className="h-12 px-4 rounded-xl text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 cursor-pointer flex items-center transition-colors group"
                  >
                    <LogOut className="w-4 h-4 mr-3 text-gray-400 group-hover:text-red-500 transition-colors" />
                    <span>Terminate Session</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6 space-y-8 pb-32">
          {/* Welcome Header Section */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative overflow-hidden bg-white p-10 rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)]"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#BF953F]/10 to-transparent rounded-full -mr-20 -mt-20 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-[#BF953F]/5 to-transparent rounded-full -ml-20 -mb-20 blur-3xl"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#BF953F]/10 border border-[#BF953F]/20 mb-4"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[#BF953F] animate-pulse"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#BF953F]">Active Dashboard</span>
                </motion.div>
                <h1 className="text-5xl font-black text-gray-900 tracking-tighter leading-[0.9]">
                  Welcome back, <br />
                  <span className="gold-gradient-text">{user?.ownerName || user?.username || 'Commander'}</span>
                </h1>
              </div>

              <div className="text-right flex flex-col items-end">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Total Gross Income</div>
                <div className="text-6xl font-black tracking-tighter text-gray-900 leading-none">
                  ₱{stats.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="modern-card p-8 group cursor-pointer"
              onClick={() => setLocation('/transaction-history')}
            >
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-500 transition-colors duration-500">
                <DollarSign className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span data-testid="text-today-sales">₱{stats.todaySales.toFixed(2)}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Daily Sales Revenue</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="modern-card p-8 group cursor-pointer"
              onClick={() => setLocation('/inventory')}
            >
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-500 transition-colors duration-500">
                <Package className="w-6 h-6 text-blue-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span data-testid="text-total-products">{stats.totalProducts}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Active Inventory Count</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="modern-card p-8 group cursor-pointer"
            >
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#BF953F] transition-colors duration-500">
                <CreditCard className="w-6 h-6 text-[#BF953F] group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span>{getFilteredCreditors().length}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pending Receivables</div>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="modern-card p-8 group cursor-pointer"
            >
              <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-500 transition-colors duration-500">
                <Receipt className="w-6 h-6 text-purple-500 group-hover:text-white transition-colors duration-500" />
              </div>
              <div className="text-3xl font-black text-gray-900 tracking-tighter mb-1">
                <span>₱{totalExpenses.toFixed(2)}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly Operating Costs</div>
            </motion.div>
          </div>

          {/* Business Tools Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-widest text-gray-900">Executive Tools</h2>
              <div className="h-[2px] flex-1 mx-8 bg-gray-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'Inventory', desc: 'Product tracking', icon: Package, path: '/inventory', color: 'pink' },
                { title: 'Financials', desc: 'Ledger management', icon: CreditCard, path: '/ledger', color: 'indigo' },
                { title: 'Expenses', desc: 'Cost analysis', icon: DollarSign, path: '/expenses', color: 'emerald' },
                { title: 'Logistics', desc: 'Purchase orders', icon: Calendar, path: '/purchased', color: 'amber' },
              ].map((tool, i) => (
                <motion.button
                  key={tool.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  onClick={() => setLocation(tool.path)}
                  className="modern-card p-6 flex flex-col items-start text-left group"
                >
                  <div className={`p-4 bg-${tool.color}-50 rounded-2xl mb-4 group-hover:bg-${tool.color}-500 transition-colors`}>
                    <tool.icon className={`w-6 h-6 text-${tool.color}-500 group-hover:text-white transition-colors`} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{tool.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">{tool.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Stunning Analytics Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1 }}
              className="lg:col-span-2 bg-white rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.03)] p-10"
            >
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tighter">Performance Matrix</h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">7-Day Financial Trajectory</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#BF953F]"></div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Gross Income</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-200"></div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Expenses</span>
                  </div>
                </div>
              </div>

              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#BF953F" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#BF953F" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#CBD5E1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#CBD5E1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                      tickFormatter={(v) => `₱${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '20px',
                        border: 'none',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                        padding: '16px',
                        backgroundColor: 'white'
                      }}
                      itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                      labelStyle={{ marginBottom: '8px', color: '#94A3B8', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#BF953F"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#CBD5E1"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#expensesGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="space-y-6"
            >
              {[
                { label: 'Total Revenue', value: stats.totalIncome, color: '#BF953F', trend: stats.revenueTrend },
                { label: 'Operational Cost', value: totalExpenses, color: '#94A3B8', trend: stats.expenseTrend },
                { label: 'Net Profit Margin', value: profit, color: profit >= 0 ? '#10B981' : '#EF4444', trend: stats.profitTrend },
              ].map((kpi, i) => (
                <div key={kpi.label} className="modern-card p-8 group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{kpi.label}</span>
                    <span className={`text-[10px] font-black p-1 px-2 rounded-full ${kpi.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                      {kpi.trend}
                    </span>
                  </div>
                  <div className={`text-4xl font-black tracking-tighter mb-2 ${kpi.label === 'Total Revenue' ? 'gold-gradient-text' : 'text-gray-900'}`}>
                    ₱{kpi.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <div className="w-full h-1 bg-gray-50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '70%' }}
                      transition={{ delay: 1.5 + i * 0.2, duration: 1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: kpi.color }}
                    ></motion.div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Floating Action Button */}
        <FloatingActionButton onTutorialClick={handleTutorialClick} />

        {/* Add Expense Dialog */}
        <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Expense</DialogTitle>
            </DialogHeader>
            
            <Form {...expenseForm}>
              <form onSubmit={expenseForm.handleSubmit(handleAddExpense)} className="space-y-4">
                <FormField
                  control={expenseForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Description</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Rent, Utilities, Supplies"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Amount (₱)</FormLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Category</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        >
                          <option value="">Select category</option>
                          <option value="Rent">Rent</option>
                          <option value="Utilities">Utilities</option>
                          <option value="Supplies">Supplies</option>
                          <option value="Equipment">Equipment</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Other">Other</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={expenseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Date</FormLabel>
                      <FormControl>
                        <input
                          type="date"
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddExpenseOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Expense
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Purchase Dialog */}
        <Dialog open={isAddPurchaseOpen} onOpenChange={setIsAddPurchaseOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Purchase</DialogTitle>
            </DialogHeader>
            
            <Form {...purchaseForm}>
              <form onSubmit={purchaseForm.handleSubmit(handleAddPurchase)} className="space-y-4">
                <FormField
                  control={purchaseForm.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Product Name</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Coca Cola, Bread"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={purchaseForm.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Quantity</FormLabel>
                        <FormControl>
                          <input
                            type="number"
                            min="1"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={purchaseForm.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Cost (₱)</FormLabel>
                        <FormControl>
                          <input
                            type="number"
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={purchaseForm.control}
                  name="supplier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Supplier</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Coca Cola Company"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={purchaseForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Date</FormLabel>
                      <FormControl>
                        <input
                          type="date"
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddPurchaseOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Purchase
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add Creditor Dialog */}
        <Dialog open={isAddCreditorOpen} onOpenChange={setIsAddCreditorOpen}>
          <DialogContent className="max-w-md dark:bg-gray-800 dark:text-gray-200">
            <DialogHeader>
              <DialogTitle className="dark:text-gray-200">Add New Creditor</DialogTitle>
            </DialogHeader>
            
            <Form {...creditorForm}>
              <form onSubmit={creditorForm.handleSubmit(handleAddCreditor)} className="space-y-4">
                <FormField
                  control={creditorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Creditor Name</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Supplier Company, Bank"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={creditorForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Amount (₱)</FormLabel>
                      <FormControl>
                        <input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={creditorForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-300">Description</FormLabel>
                      <FormControl>
                        <input
                          {...field}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          placeholder="e.g., Inventory loan, Equipment financing"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={creditorForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Due Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={creditorForm.control}
                    name="reminderDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-300">Reminder Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddCreditorOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#FF8882] hover:bg-[#D89D9D]"
                  >
                    Add Creditor
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-20 mb-10 text-center space-y-2"
        >
          <p className="text-[#BF953F] text-[11px] font-black tracking-[0.3em] uppercase">
            @2026 SMARTPOS+
          </p>
          <div className="space-y-1">
            <p className="text-gray-500 text-[10px] font-bold tracking-wider uppercase">
              Redesigned and Developed By: <span className="text-gray-900 dark:text-gray-100">Dexter Dave A. Ros</span>
            </p>
            <p className="text-gray-400 text-[9px] font-medium italic">
              ( Bachelor of Science In Information System )
            </p>
          </div>
          <p className="text-gray-300 dark:text-gray-600 text-[8px] font-medium tracking-widest uppercase mt-4 opacity-80">
            "This System is Protected Under Copyright law"
          </p>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default AdminMain;
