import React, { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '@/components/Layout';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { Calendar, ChevronDown, BarChart3, LineChart } from 'lucide-react';
import { db } from '@/lib/db';
import { getUnitMultiplier } from '@/lib/utils';

export default function AdminReports() {
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [durationOpen, setDurationOpen] = useState<boolean>(false);
  const [transactionCount, setTransactionCount] = useState<number>(0);
  const [netSales, setNetSales] = useState<number>(0);
  const [avgBasketSize, setAvgBasketSize] = useState<number>(0);
  const [cogs, setCogs] = useState<number>(0);
  const [expenses, setExpenses] = useState<number>(0);
  const [profit, setProfit] = useState<number>(0);
  const [inventoryPrice, setInventoryPrice] = useState<number>(0);
  const [inventoryCost, setInventoryCost] = useState<number>(0);
  const [potentialMargin, setPotentialMargin] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; qty: number; unitPrice: number; discount: number; cost: number; margin: number }>>([]);
  const [grossMargin, setGrossMargin] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [netMargin, setNetMargin] = useState<number>(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  const sDate = useMemo(() => new Date(startDate), [startDate]);
  const eDate = useMemo(() => { const d = new Date(endDate); d.setHours(23,59,59,999); return d; }, [endDate]);

  const formatCurrency = (v: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' }).format(v); }
    catch { return `₱${v.toFixed(2)}`; }
  };

  const reloadReportData = async () => {
    const sales = await db.sales
      .filter(s => {
        const d = new Date(s.createdAt as any);
        return d >= sDate && d <= eDate;
      })
      .toArray();
    const saleIds = new Set(sales.map(s => s.id));
    const items = await db.saleItems
      .filter(si => saleIds.has(si.saleId))
      .toArray();
    const purchases = await db.purchases
      .filter(p => {
        const d = new Date(p.date as any);
        return d <= eDate;
      })
      .toArray();
    const products = await db.products.toArray();
    const expensesRows = await db.expenses
      .filter(ex => {
        const d = new Date(ex.date as any);
        return d >= sDate && d <= eDate;
      })
      .toArray();

    const txCount = sales.length;
    const totalSales = sales.reduce((sum, s) => sum + (s.total || 0), 0);

    const avgCostByName: Record<string, number> = {};
    const countsByName: Record<string, number> = {};
    for (const p of purchases) {
      const name = p.productName;
      avgCostByName[name] = (avgCostByName[name] || 0) + (p.cost || 0);
      countsByName[name] = (countsByName[name] || 0) + 1;
    }
    for (const name of Object.keys(avgCostByName)) {
      avgCostByName[name] = avgCostByName[name] / (countsByName[name] || 1);
    }

    const productNameById: Record<string, string> = {};
    for (const p of products) productNameById[p.id] = p.name;

    const totalQtyCost = items.reduce((sum, it) => {
      const pname = productNameById[it.productId] || '';
      const cost = avgCostByName[pname] || 0;
      const multiplier = getUnitMultiplier((it as any).unit || 'pieces');
      return sum + cost * (it.quantity || 0) * multiplier;
    }, 0);

    const totalExpenses = expensesRows.reduce((sum, ex) => sum + (ex.amount || 0), 0);
    const margin = totalSales - totalQtyCost;
    const totalProfit = margin - totalExpenses;

    setTransactionCount(txCount);
    setNetSales(totalSales);
    setAvgBasketSize(txCount > 0 ? totalSales / txCount : 0);
    setCogs(totalQtyCost);
    setExpenses(totalExpenses);
    setProfit(totalProfit);

    const invPrice = products.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 0), 0);
    const invCost = products.reduce((sum, p) => {
      const cost = avgCostByName[p.name] || 0;
      return sum + cost * (p.quantity || 0);
    }, 0);
    setInventoryPrice(invPrice);
    setInventoryCost(invCost);
    setPotentialMargin(invPrice - invCost);

    const perProduct: Record<string, { name: string; qty: number; unitPriceSum: number; unitPriceCount: number; discount: number; costSum: number; margin: number }> = {};
    for (const it of items) {
      const name = productNameById[it.productId] || '';
      const unitPrice = it.price || 0;
      const multiplier = getUnitMultiplier((it as any).unit || 'pieces');
      const actualQty = (it.quantity || 0) * multiplier;

      const fullPrice = products.find(p => p.id === it.productId)?.price || unitPrice;
      const discount = Math.max(0, fullPrice - unitPrice) * actualQty;
      const cost = (avgCostByName[name] || 0) * actualQty;
      const lineMargin = (unitPrice - (avgCostByName[name] || 0)) * actualQty;

      if (!perProduct[name]) perProduct[name] = { name, qty: 0, unitPriceSum: 0, unitPriceCount: 0, discount: 0, costSum: 0, margin: 0 };
      perProduct[name].qty += actualQty;
      perProduct[name].unitPriceSum += unitPrice;
      perProduct[name].unitPriceCount += 1;
      perProduct[name].discount += discount;
      perProduct[name].costSum += cost;
      perProduct[name].margin += lineMargin;
    }
    const rows = Object.values(perProduct)
      .map(r => ({
        name: r.name,
        qty: r.qty,
        unitPrice: r.unitPriceCount ? r.unitPriceSum / r.unitPriceCount : 0,
        discount: r.discount,
        cost: r.costSum,
        margin: r.margin,
      }))
      .sort((a,b) => b.qty - a.qty)
      .slice(0, 20);
    setTopProducts(rows);
    const gMargin = rows.reduce((sum, r) => sum + r.margin, 0);
    const dTotal = rows.reduce((sum, r) => sum + r.discount, 0);
    setGrossMargin(gMargin);
    setDiscountTotal(dTotal);
    const nMargin = gMargin - serviceFee - deliveryFee - dTotal;
    setNetMargin(nMargin);
  };

  useEffect(() => { reloadReportData(); }, [startDate, endDate]);

  const setDurationPreset = (preset: 'today'|'week'|'month'|'custom') => {
    setDuration(preset);
    const now = new Date();
    if (preset === 'today') {
      const d = new Date();
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(d.toISOString().split('T')[0]);
    } else if (preset === 'week') {
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const monday = new Date(now); monday.setDate(now.getDate() - diffToMonday);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(first.toISOString().split('T')[0]);
      setEndDate(last.toISOString().split('T')[0]);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Start Date', startDate],
      ['End Date', endDate],
      ['Transaction Count', String(transactionCount)],
      ['Avg Basket Size', String(avgBasketSize.toFixed(2))],
      ['Net Sales', String(netSales.toFixed(2))],
      ['COGS', String(cogs.toFixed(2))],
      ['Expenses', String(expenses.toFixed(2))],
      ['Profit', String(profit.toFixed(2))],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fname = `report_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <div className="relative flex items-center justify-center py-1">
          <div className="text-lg font-bold text-gray-900">Reports</div>
          <div className="absolute right-0 flex items-center gap-3">
            <button className="flex flex-col items-center text-gray-700" onClick={() => setLocation('/stock-insights')}>
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs">Stock Insights</span>
            </button>
            <button className="flex flex-col items-center text-gray-700" onClick={() => setLocation('/sales-summary')}>
              <LineChart className="w-5 h-5" />
              <span className="text-xs">Sales Summary</span>
            </button>
          </div>
        </div>

        

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7A3E9D] text-white shadow">
            <Calendar className="w-4 h-4" />
            <span>{startDate}</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7A3E9D] text-white shadow">
            <Calendar className="w-4 h-4" />
            <span>{endDate}</span>
          </button>
        </div>

        <div className="mt-3 rounded-xl p-4 bg-gradient-to-r from-[#7A3E9D] to-[#9C5CBD] text-white flex items-center justify-between">
          <div className="text-sm font-medium">Report Duration</div>
          <div className="relative">
            <button
              className="px-4 py-2 rounded-xl bg-[#E4008A] text-white flex items-center gap-2 shadow"
              onClick={() => setDurationOpen(v => !v)}
            >
              <span>
                {duration === 'today' ? 'Today' : duration === 'week' ? 'This Week' : duration === 'month' ? 'This Month' : 'Custom'}
              </span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {durationOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white text-gray-800 rounded-lg shadow border">
                <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => { setDurationPreset('today'); setDurationOpen(false); }}>Today</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => { setDurationPreset('week'); setDurationOpen(false); }}>This Week</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => { setDurationPreset('month'); setDurationOpen(false); }}>This Month</button>
                <button className="w-full text-left px-3 py-2 hover:bg-gray-100" onClick={() => { setDuration('custom'); setDurationOpen(false); }}>Custom</button>
              </div>
            )}
          </div>
        </div>

        

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-4 bg-[#E4008A] text-white">
            <div className="text-xs">Transaction Count</div>
            <div className="text-3xl font-bold">{transactionCount}</div>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-br from-[#7A3E9D] to-[#5e2d76] text-white">
            <div className="text-xs">Avg. Basket Size</div>
            <div className="text-3xl font-bold">{formatCurrency(avgBasketSize)}</div>
          </div>
        </div>

        <div className="rounded-xl p-4 bg-gradient-to-br from-[#7A3E9D] to-[#5e2d76] text-white">
          <div className="flex items-center justify-between">
            <button className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 flex items-center gap-2">
              <span>CLICK ME</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            <div className="text-right">
              <div className="text-xs">NET SALES</div>
              <div className="text-3xl font-bold">{formatCurrency(netSales)}</div>
            </div>
          </div>
        </div>

        <Card className="p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">Cost of Product Sold</div>
          <div className="text-base font-semibold text-gray-800">{formatCurrency(cogs)}</div>
        </Card>

        <div className="rounded-xl p-4 bg-[#7A3E9D] text-white flex items-center justify-between">
          <div className="text-sm">Margin</div>
          <div className="text-2xl font-bold">{formatCurrency(netSales - cogs)}</div>
        </div>

        <Card className="p-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">Expenses</div>
          <div className={`text-base font-semibold ${expenses <= 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatCurrency(expenses)}</div>
        </Card>

        <div className="rounded-xl p-4 bg-[#E4008A] text-white">
          <div className="text-sm">Profit</div>
          <div className="text-3xl font-bold">{formatCurrency(profit)}</div>
        </div>

        

        

        
      </div>
    </Layout>
  );
}
