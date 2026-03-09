import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Calendar as CalendarIcon, Edit, Trash2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { db } from '@/lib/db';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval } from 'date-fns';
import Layout from '@/components/Layout';
import { Expense } from '@shared/schema';

const ExpenseReport: React.FC = () => {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedDuration, setSelectedDuration] = useState<string>('Today');
  const [durationDropdownOpen, setDurationDropdownOpen] = useState<boolean>(false);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groupedExpenses, setGroupedExpenses] = useState<any[]>([]);
  
  // Details Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDateExpenses, setSelectedDateExpenses] = useState<{ date: string, items: Expense[], total: number } | null>(null);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editName, setEditName] = useState(''); // category/name
  const [editDetails, setEditDetails] = useState(''); // description

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
      case 'LastDay': 
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'Single Day':
         // Just sets to today initially, user picks date
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'This Week':
        setStartDate(format(startOfWeek(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today), 'yyyy-MM-dd'));
        break;
      case 'Last Week':
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
      case 'Date range':
        // User manually selects
        break;
    }
  };

  const loadExpenses = async () => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const allExpenses = await db.expenses.toArray();
    const filtered = allExpenses.filter(e => {
      const d = new Date(e.date);
      return d >= start && d <= end;
    });

    setExpenses(filtered);

    // Group by Date
    const groups: Record<string, { date: string, count: number, total: number, items: Expense[] }> = {};
    
    filtered.forEach(e => {
        const dateKey = format(new Date(e.date), 'yyyy-MM-dd');
        if (!groups[dateKey]) {
            groups[dateKey] = { date: dateKey, count: 0, total: 0, items: [] };
        }
        groups[dateKey].count += 1;
        groups[dateKey].total += e.amount;
        groups[dateKey].items.push(e);
    });

    setGroupedExpenses(Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  useEffect(() => {
    loadExpenses();
  }, [startDate, endDate]);

  const handleRowClick = (group: any) => {
    setSelectedDateExpenses(group);
    setDetailsOpen(true);
  };

  const handleEditClick = (expense: Expense) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount.toString());
    setEditName(expense.category); // Assuming category holds the 'Name'
    setEditDetails(expense.description);
    setEditOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
        await db.expenses.delete(id);
        loadExpenses();
        // Update selected group if open
        if (selectedDateExpenses) {
            const updatedItems = selectedDateExpenses.items.filter(i => i.id !== id);
            if (updatedItems.length === 0) {
                setDetailsOpen(false);
                setSelectedDateExpenses(null);
            } else {
                 const newTotal = updatedItems.reduce((s, i) => s + i.amount, 0);
                 setSelectedDateExpenses({ ...selectedDateExpenses, items: updatedItems, total: newTotal });
            }
        }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    
    const amount = parseFloat(editAmount);
    if (isNaN(amount)) {
        alert("Invalid amount");
        return;
    }

    await db.expenses.update(editingExpense.id, {
        amount,
        category: editName,
        description: editDetails
    });

    setEditOpen(false);
    setEditingExpense(null);
    loadExpenses();
    
    // Refresh details view
    if (selectedDateExpenses) {
         // Re-fetch that specific date's items? Easier to just reload logic or manually update state
         // We will rely on loadExpenses re-running or manually update the local state for immediate feedback
         const updatedItems = selectedDateExpenses.items.map(i => i.id === editingExpense.id ? { ...i, amount, category: editName, description: editDetails } : i);
         const newTotal = updatedItems.reduce((s, i) => s + i.amount, 0);
         setSelectedDateExpenses({ ...selectedDateExpenses, items: updatedItems, total: newTotal });
    }
  };

  const overallEntries = expenses.length;
  const overallTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 pb-20">
        {/* Header */}
        <div className="flex items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm">
             <Button 
              variant="ghost" 
              className="mr-2 px-2"
              onClick={() => setLocation('/expenses')}
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Button>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200">Expense Report</h1>
        </div>

        {/* Filters */}
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

        {/* Duration Dropdown */}
        <div className="mb-6">
            <Card className="p-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Select report Duration</div>
                    <div className="relative w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="w-full sm:w-[200px] justify-between bg-white dark:bg-gray-700 dark:text-gray-200"
                            onClick={() => setDurationDropdownOpen(!durationDropdownOpen)}
                        >
                            <span>{selectedDuration}</span>
                            <X className={`w-4 h-4 transition-transform ${durationDropdownOpen ? 'rotate-180' : ''}`} />
                        </Button>
                        {durationDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-full sm:w-[200px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 py-1">
                                {["Today", "LastDay", "Single Day", "This Week", "Last Week", "This Month", "Last Month", "Date range"].map((opt) => (
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

        {/* 3 Grid View Table */}
        <Card className="overflow-hidden border-none shadow-md mb-6">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                <th className="px-4 py-3 text-left font-semibold">DATE</th>
                <th className="px-4 py-3 text-center font-semibold">ENTRY</th>
                <th className="px-4 py-3 text-right font-semibold">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {groupedExpenses.map((group, idx) => (
                <tr 
                    key={idx} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => handleRowClick(group)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{group.date}</td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{group.count}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-bold">{formatCurrency(group.total)}</td>
                </tr>
              ))}
              {groupedExpenses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Footer Summary */}
        <Card className="p-4 bg-white dark:bg-gray-800 shadow-md">
            <div className="flex justify-between items-center">
                <div className="text-gray-700 dark:text-gray-300 font-medium">Overall Entries: <span className="font-bold">{overallEntries}</span></div>
                <div className="flex flex-col items-end">
                    <span className="text-sm text-gray-500">Total</span>
                    <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(overallTotal)}</span>
                </div>
            </div>
        </Card>

        {/* Details Modal */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                <DialogHeader className="flex flex-row items-center gap-2 border-b pb-2">
                    <Button variant="ghost" size="icon" onClick={() => setDetailsOpen(false)} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <DialogTitle>Expense Details</DialogTitle>
                </DialogHeader>
                
                <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {selectedDateExpenses?.items.map((item, i) => (
                        <div key={item.id} className="border-b pb-4 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div className="text-sm text-gray-500">
                                    {format(new Date(item.date), 'hh:mma dd MMMM- yyyy')}
                                </div>
                                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                                    {formatCurrency(item.amount)}
                                </div>
                            </div>
                            
                            <div className="space-y-1 mb-3">
                                <div className="font-medium text-gray-800 dark:text-gray-200">{item.category}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">{item.description}</div>
                            </div>

                            <div className="flex gap-2">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="flex-1 gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    onClick={() => handleEditClick(item)}
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit Expense
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                                    onClick={() => handleDeleteClick(item.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-md bg-white dark:bg-gray-900">
                <DialogHeader>
                    <DialogTitle>Edit the expense of {editingExpense ? formatCurrency(editingExpense.amount) : ''}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Total Expense</label>
                        <Input 
                            type="number" 
                            value={editAmount} 
                            onChange={(e) => setEditAmount(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name of Expense</label>
                        <Input 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)} 
                            placeholder="e.g. Household Bills"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Details</label>
                        <Input 
                            value={editDetails} 
                            onChange={(e) => setEditDetails(e.target.value)} 
                            placeholder="Details..."
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSaveEdit} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </div>
    </Layout>
  );
};

export default ExpenseReport;
