import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, BarChart3, LineChart, Calendar as CalendarIcon, ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Layout from '@/components/Layout';
import { db } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval } from 'date-fns';

const ReportBlank: React.FC = () => {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDuration, setSelectedDuration] = useState<string>('Today');
  const [durationDropdownOpen, setDurationDropdownOpen] = useState<boolean>(false);

  // Metrics State
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [totalAccumulated, setTotalAccumulated] = useState<number>(0);
  const [netSales, setNetSales] = useState<number>(0);
  const [cogs, setCogs] = useState<number>(0);
  const [margin, setMargin] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [profit, setProfit] = useState<number>(0);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const handleDurationChange = (preset: string) => {
    setSelectedDuration(preset);
    setDurationDropdownOpen(false);
    const today = new Date();

    switch (preset) {
      case 'Today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'LastDay': // Assuming Last Day means Yesterday
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'This Week':
        setStartDate(format(startOfWeek(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today), 'yyyy-MM-dd'));
        break;
      case 'LastWeek':
        const lastWeekStart = startOfWeek(subWeeks(today, 1));
        const lastWeekEnd = endOfWeek(subWeeks(today, 1));
        setStartDate(format(lastWeekStart, 'yyyy-MM-dd'));
        setEndDate(format(lastWeekEnd, 'yyyy-MM-dd'));
        break;
      case 'This Month':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'Last Month':
        const lastMonthStart = startOfMonth(subMonths(today, 1));
        const lastMonthEnd = endOfMonth(subMonths(today, 1));
        setStartDate(format(lastMonthStart, 'yyyy-MM-dd'));
        setEndDate(format(lastMonthEnd, 'yyyy-MM-dd'));
        break;
      case 'Date Range':
        // No auto update, user selects
        break;
    }
  };

  const loadData = async () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Fetch Sales
    const sales = await db.sales.toArray();
    const filteredSales = sales.filter(s => {
      const d = new Date(s.createdAt as any);
      return d >= start && d <= end;
    });

    const count = filteredSales.length;
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);

    // Calculate COGS
    // 1. Get average cost of products from purchases
    const purchases = await db.purchases.toArray();
    const avgCostByName: Record<string, number> = {};
    const purchaseCounts: Record<string, number> = {};
    
    purchases.forEach(p => {
      const name = p.productName;
      avgCostByName[name] = (avgCostByName[name] || 0) + (p.cost || 0);
      purchaseCounts[name] = (purchaseCounts[name] || 0) + 1;
    });
    
    Object.keys(avgCostByName).forEach(name => {
      avgCostByName[name] = avgCostByName[name] / (purchaseCounts[name] || 1);
    });

    // 2. Fallback to product definition cost if no purchase history
    const products = await db.products.toArray();
    const productCostById: Record<string, number> = {};
    const productNameById: Record<string, string> = {};
    products.forEach(p => {
      productNameById[p.id] = p.name;
      productCostById[p.id] = avgCostByName[p.name] || p.cost || 0;
    });

    // 3. Sum up cost for all items in filtered sales
    const saleIds = new Set(filteredSales.map(s => s.id));
    const saleItems = await db.saleItems.toArray();
    const filteredItems = saleItems.filter(item => saleIds.has(item.saleId));

    let totalCOGS = 0;
    filteredItems.forEach(item => {
      // Try to find cost by product name (from purchases) or ID (from products)
      let cost = 0;
      // If we have product name from product table
      const pName = productNameById[item.productId];
      if (pName && avgCostByName[pName]) {
        cost = avgCostByName[pName];
      } else if (productCostById[item.productId]) {
        cost = productCostById[item.productId];
      }
      totalCOGS += cost * item.quantity;
    });

    // Fetch Expenses
    const allExpenses = await db.expenses.toArray();
    const filteredExpenses = allExpenses.filter(e => {
        const d = new Date(e.date);
        return d >= start && d <= end;
    });
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Set States
    setTransactionCount(count);
    setTotalAccumulated(totalSales);
    setNetSales(totalSales); // Assuming Net = Gross for now
    setCogs(totalCOGS);
    setMargin(totalSales - totalCOGS);
    setExpenses(totalExpenses);
    setProfit((totalSales - totalCOGS) - totalExpenses);
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const handleExport = async () => {
    // Generate CSV for the current view
    // We can export the Summary metrics AND/OR the detailed transaction list.
    // Let's export the detailed transaction list for utility.
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const sales = await db.sales.toArray();
    const filteredSales = sales.filter(s => {
        const d = new Date(s.createdAt as any);
        return d >= start && d <= end;
    });

    // Basic CSV content
    const headers = ['Sale ID', 'Date', 'Staff ID', 'Payment Type', 'Total Amount'];
    const rows = filteredSales.map(s => [
        s.id,
        format(new Date(s.createdAt as any), 'yyyy-MM-dd HH:mm:ss'),
        s.staffId || '',
        s.paymentType,
        s.total.toFixed(2)
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20">
        {/* Header Container */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm gap-4">
          <div className="flex items-center w-full sm:w-auto">
             <Button 
              variant="ghost" 
              className="mr-2 px-2"
              onClick={() => setLocation('/admin-main')}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Reports</h1>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button 
              variant="outline"
              className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-900"
              onClick={() => setLocation('/stock-insights')}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Stock Insights</span>
            </Button>
            
            <Button 
              variant="outline"
              className="flex items-center gap-2 border-pink-200 text-pink-700 hover:bg-pink-50 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-900"
              onClick={() => setLocation('/sales-summary')}
            >
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">Sales Summary</span>
            </Button>
          </div>
        </div>

        {/* Calendar Selectors */}
        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 ml-1">Start Date</label>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 ml-1">End Date</label>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800"
                    />
                </div>
            </div>
        </div>

        {/* Report Duration Dropdown */}
        <div className="mb-6">
            <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Select Report Duration</div>
                    <div className="relative w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="w-full sm:w-[200px] justify-between bg-white dark:bg-gray-700 dark:text-gray-200"
                            onClick={() => setDurationDropdownOpen(!durationDropdownOpen)}
                        >
                            <span>{selectedDuration}</span>
                            <ChevronDown className="w-4 h-4" />
                        </Button>
                        {durationDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-full sm:w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
                                {["Today", "LastDay", "This Week", "LastWeek", "This Month", "Last Month", "Date Range"].map((opt) => (
                                    <button
                                        key={opt}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        onClick={() => handleDurationChange(opt)}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>

        {/* Transaction Count & Total Accumulated */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
                <div className="text-sm text-blue-600 dark:text-blue-400 mb-1 font-medium">Transaction Count</div>
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{transactionCount}</div>
            </Card>
            <Card className="p-6 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800">
                <div className="text-sm text-green-600 dark:text-green-400 mb-1 font-medium">Total Accumulated</div>
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalAccumulated)}</div>
            </Card>
        </div>

        {/* Financial Metrics Stack */}
        <div className="space-y-3 mb-8">
            {/* Net Sales */}
            <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 border-l-4 border-l-purple-500 shadow-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300">Net Sales</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(netSales)}</div>
            </Card>

            {/* Cost of Product Sold */}
            <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 border-l-4 border-l-orange-500 shadow-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300">Cost of Product Sold</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(cogs)}</div>
            </Card>

            {/* Margin */}
            <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 border-l-4 border-l-teal-500 shadow-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300">Margin</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(margin)}</div>
            </Card>

            {/* Expenses */}
            <Card className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 border-l-4 border-l-red-500 shadow-sm">
                <div className="font-medium text-gray-700 dark:text-gray-300">Expenses</div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(expenses)}</div>
            </Card>

            {/* Profit */}
            <Card className="p-4 flex items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-l-4 border-l-green-600 shadow-md">
                <div className="font-bold text-gray-800 dark:text-gray-200">Profit</div>
                <div className={`text-xl font-extrabold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(profit)}
                </div>
            </Card>
        </div>

        {/* Export Button */}
        <div className="flex justify-center">
            <Button 
                className="w-full sm:w-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 rounded-xl text-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all hover:scale-105"
                onClick={handleExport}
            >
                <Download className="w-5 h-5" />
                Export Reports
            </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ReportBlank;
