import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Download,
  Printer,
  Calendar,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  Lock,
  Search,
  Filter,
  Users,
  Eye,
  Info,
  DollarSign,
  ChevronDown,
  RefreshCw,
  Truck,
  Building2,
  ShieldAlert
} from 'lucide-react';
import type { Transaction, User } from '../types';
import {
  formatCurrency,
  exportSalesProfitToExcel,
  exportSalesProfitToPDF,
  SalesProfitSummaryItem
} from '../utils/exportUtils';
import { calculateProfit, calculateProfitMargin } from '../utils/profitUtils';

interface SalesProfitReportViewProps {
  transactions: Transaction[];
  currentUser: User;
  salesList?: string[];
  onViewReceipt?: (transaction: Transaction) => void;
}

type PeriodType = 'daily' | 'monthly' | 'yearly';

export const SalesProfitReportView: React.FC<SalesProfitReportViewProps> = ({
  transactions,
  currentUser,
  salesList = ['Kasir (Dimas)', 'Admin (DEAZBAR)'],
  onViewReceipt
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Period Selection: 'daily' | 'monthly' | 'yearly'
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');

  // Dates state
  const now = new Date();
  const currentIsoDate = now.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(currentIsoDate);

  // Month & Year state
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  // Search in transaction table
  const [searchQuery, setSearchQuery] = useState('');

  // Collect all unique sales names from salesList and transactions
  const allAvailableSales = useMemo(() => {
    const set = new Set<string>();
    salesList.forEach((s) => set.add(s.trim()));
    transactions.forEach((t) => {
      if (t.orderType && t.orderType !== 'Pendapatan Lain' && !t.orderType.startsWith('PL-')) {
        set.add(t.orderType.trim());
      }
    });
    // Ensure default ones exist if empty
    if (set.size === 0) {
      set.add('Kasir (Dimas)');
      set.add('Admin (DEAZBAR)');
    }
    return Array.from(set).sort();
  }, [salesList, transactions]);

  // Selected (checked) sales state - defaults to ALL sales checked
  const [selectedSalesSet, setSelectedSalesSet] = useState<Set<string>>(
    () => new Set(allAvailableSales)
  );

  // Keep selectedSalesSet updated if new sales appear
  const handleToggleSales = (salesName: string) => {
    setSelectedSalesSet((prev) => {
      const next = new Set(prev);
      if (next.has(salesName)) {
        next.delete(salesName);
      } else {
        next.add(salesName);
      }
      return next;
    });
  };

  const handleSelectAllSales = () => {
    setSelectedSalesSet(new Set(allAvailableSales));
  };

  const handleDeselectAllSales = () => {
    setSelectedSalesSet(new Set());
  };

  // Month Names in Indonesian
  const monthNames = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ];

  const availableYears = useMemo(() => {
    const currentYear = now.getFullYear();
    return [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  }, [now]);

  // Format label for current period
  const periodLabel = useMemo(() => {
    if (periodType === 'daily') {
      try {
        const [y, m, d] = selectedDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return `Harian: ${dt.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}`;
      } catch {
        return `Harian: ${selectedDate}`;
      }
    } else if (periodType === 'monthly') {
      return `Bulanan: ${monthNames[selectedMonth]} ${selectedYear}`;
    } else {
      return `Tahunan: Tahun ${selectedYear}`;
    }
  }, [periodType, selectedDate, selectedMonth, selectedYear]);

  // Filter transactions by period
  const periodTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (!t.date || t.status === 'BATAL') return false;
      // Exclude pure non-sales other income if desired
      if (t.orderType === 'Pendapatan Lain' || t.invoiceNo.startsWith('PL-')) return false;

      if (periodType === 'daily') {
        return t.date.startsWith(selectedDate);
      } else if (periodType === 'monthly') {
        const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        return t.date.startsWith(prefix);
      } else {
        const prefix = `${selectedYear}`;
        return t.date.startsWith(prefix);
      }
    });
  }, [transactions, periodType, selectedDate, selectedMonth, selectedYear]);

  // Transactions filtered by CHECKED sales
  const activeTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      const sales = (t.orderType || t.cashierName || 'Kasir (Dimas)').trim();
      return selectedSalesSet.has(sales);
    });
  }, [periodTransactions, selectedSalesSet]);

  // Further filter activeTransactions by search query
  const searchedTransactions = useMemo(() => {
    if (!searchQuery.trim()) return activeTransactions;
    const q = searchQuery.toLowerCase();
    return activeTransactions.filter((t) => {
      return (
        t.invoiceNo.toLowerCase().includes(q) ||
        (t.customer?.name || '').toLowerCase().includes(q) ||
        (t.orderType || '').toLowerCase().includes(q) ||
        (t.vendorName || '').toLowerCase().includes(q) ||
        t.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [activeTransactions, searchQuery]);

  // Per-Sales Breakdown Summary Table
  const salesSummaryList: SalesProfitSummaryItem[] = useMemo(() => {
    return allAvailableSales.map((salesName) => {
      const salesTx = periodTransactions.filter(
        (t) => (t.orderType || t.cashierName || '').trim() === salesName
      );
      const totalInvoice = salesTx.reduce((sum, t) => sum + (t.total || 0), 0);
      const vendorCost = salesTx.reduce((sum, t) => sum + (t.vendorCost || 0), 0);
      const shippingCost = salesTx.reduce((sum, t) => sum + (t.shippingCost || 0), 0);
      const profit = calculateProfit(totalInvoice, vendorCost, shippingCost);
      const marginPercent = calculateProfitMargin(profit, totalInvoice);

      return {
        salesName,
        orderCount: salesTx.length,
        totalInvoice,
        vendorCost,
        shippingCost,
        profit,
        marginPercent
      };
    });
  }, [allAvailableSales, periodTransactions]);

  // Total Metrics for CHECKED (Active) sales (matching the green card screenshot!)
  const totalMetrics = useMemo(() => {
    const totalInvoice = activeTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const vendorCost = activeTransactions.reduce((sum, t) => sum + (t.vendorCost || 0), 0);
    const shippingCost = activeTransactions.reduce((sum, t) => sum + (t.shippingCost || 0), 0);
    const profit = calculateProfit(totalInvoice, vendorCost, shippingCost);
    const marginPercent = calculateProfitMargin(profit, totalInvoice);

    return {
      orderCount: activeTransactions.length,
      totalInvoice,
      vendorCost,
      shippingCost,
      profit,
      marginPercent
    };
  }, [activeTransactions]);

  // Export handlers
  const handleExportExcel = () => {
    const checkedSummary = salesSummaryList.filter((s) => selectedSalesSet.has(s.salesName));
    exportSalesProfitToExcel(checkedSummary, activeTransactions, periodLabel);
  };

  const handleExportPDF = () => {
    const checkedSummary = salesSummaryList.filter((s) => selectedSalesSet.has(s.salesName));
    exportSalesProfitToPDF(checkedSummary, activeTransactions, periodLabel, totalMetrics);
  };

  const handlePrint = () => {
    window.print();
  };

  // If user is not admin, show restricted screen
  if (!isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 text-center min-h-[500px]">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">Akses Laporan Keuntungan Terkunci</h3>
        <p className="text-xs text-slate-500 max-w-md mt-1 mb-4 leading-relaxed">
          Sesuai standar operasional Athree Studio, data keuntungan bersih, biaya vendor, dan margin seluruh sales dirahasiakan dan <strong>hanya dapat diakses serta diunduh oleh Admin / Owner</strong>.
        </p>
        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          Silakan beralih ke akun Admin untuk melihat laporan ini.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-y-auto">
      {/* Top Header & Export Action Bar */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-100 text-[#00871f] rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Laporan Hasil Keuntungan Seluruh Sales
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Khusus Admin / Owner
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis laba bersih, biaya vendor, dan biaya kirim per sales berdasarkan periode Harian, Bulanan, dan Tahunan
            </p>
          </div>

          {/* Download & Print Buttons (Only Admin) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Unduh rekapitulasi dan rincian transaksi keuntungan ke file Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Unduh Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Unduh laporan keuntungan format PDF resmi"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="Cetak langsung laporan ke printer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Laporan</span>
            </button>
          </div>
        </div>

        {/* Filter Periode & Pilihan Sales Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Mode Periode Switcher: Harian | Bulanan | Tahunan */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPeriodType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                periodType === 'daily'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Harian</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                periodType === 'monthly'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Bulanan</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                periodType === 'yearly'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Tahunan</span>
            </button>
          </div>

          {/* Specific Period Pickers */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {periodType === 'daily' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                <span className="text-slate-500 font-medium">Pilih Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="font-bold text-[#00871f] bg-transparent focus:outline-none cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(currentIsoDate)}
                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-[#00871f] rounded font-bold text-[10.5px] cursor-pointer"
                >
                  Hari Ini
                </button>
              </div>
            )}

            {periodType === 'monthly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                <span className="text-slate-500 font-medium">Bulan:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-xs"
                >
                  {monthNames.map((m, idx) => (
                    <option key={idx} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <span className="text-slate-400">|</span>

                <span className="text-slate-500 font-medium">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-xs"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(now.getMonth());
                    setSelectedYear(now.getFullYear());
                  }}
                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-[#00871f] rounded font-bold text-[10.5px] cursor-pointer"
                >
                  Bulan Ini
                </button>
              </div>
            )}

            {periodType === 'yearly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                <span className="text-slate-500 font-medium">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-xs"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setSelectedYear(now.getFullYear())}
                  className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-[#00871f] rounded font-bold text-[10.5px] cursor-pointer"
                >
                  Tahun Ini
                </button>
              </div>
            )}

            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#00871f] font-bold border border-emerald-200 text-xs">
              {periodLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4 max-w-7xl mx-auto w-full">
        {/* =========================================================================
            1. CARD PREVIEW HASIL KEUNTUNGAN (PROFIT BERSIH)
            Persis dengan contoh preview yang dikirimkan user!
        ========================================================================= */}
        <div className="border border-emerald-300 bg-[#f0fdf4] rounded-2xl p-5 sm:p-6 shadow-sm text-slate-800 transition-all">
          {/* Header Card */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#00871f] text-white flex items-center justify-center shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>HASIL KEUNTUNGAN (PROFIT BERSIH)</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <span>🔒 Khusus Admin / Owner &bull; Tidak Tampil di Struk</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-emerald-800 font-semibold">{periodLabel}</span>
                </span>
              </div>
            </div>

            {/* Margin Pill Badge */}
            <div className="self-start sm:self-center">
              <span className="px-3.5 py-1 rounded-full bg-emerald-200/90 text-emerald-950 font-extrabold text-xs sm:text-sm border border-emerald-300 shadow-2xs">
                Margin: {totalMetrics.marginPercent}%
              </span>
            </div>
          </div>

          {/* Breakdown Lines (Matches Screenshot) */}
          <div className="space-y-2 py-2 text-xs sm:text-sm border-t border-emerald-200/70">
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Total Nilai Faktur:</span>
              <span className="font-bold text-slate-900 font-mono text-sm sm:text-base">
                {formatCurrency(totalMetrics.totalInvoice)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Dikurangi Biaya Vendor:</span>
              <span className="font-bold text-rose-600 font-mono text-sm sm:text-base">
                - {formatCurrency(totalMetrics.vendorCost)}
              </span>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Dikurangi Biaya Pengiriman:</span>
              <span className="font-bold text-rose-600 font-mono text-sm sm:text-base">
                - {formatCurrency(totalMetrics.shippingCost)}
              </span>
            </div>
          </div>

          {/* Hasil Keuntungan Row */}
          <div className="pt-3 pb-3 border-t-2 border-emerald-300/80 flex justify-between items-baseline">
            <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Hasil Keuntungan:
            </span>
            <span
              className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
                totalMetrics.profit >= 0 ? 'text-[#00871f]' : 'text-rose-600'
              }`}
            >
              {formatCurrency(totalMetrics.profit)}
            </span>
          </div>

          {/* Formula Info Callout Box (Matches Screenshot) */}
          <div className="mt-2 p-3 rounded-xl bg-white/80 border border-emerald-200 text-[11px] sm:text-xs text-slate-600 flex items-start gap-2.5">
            <div className="p-1 rounded-full bg-emerald-100 text-[#00871f] shrink-0 mt-0.5">
              <Info className="w-3.5 h-3.5" />
            </div>
            <div className="leading-relaxed">
              <span>
                Rumus: <strong>Hasil Keuntungan = Total Nilai Faktur - (Biaya Vendor + Biaya Pengiriman)</strong>. Sesuai ketentuan, biaya keuntungan hanya bisa dilihat oleh Admin/Owner dan tidak boleh tampil di struk inv.
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            2. DAFTAR SALES & PILIHAN / CENTANG (MULTI-SELECT CHECKBOXES)
        ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00871f]" />
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                Pilih / Centang Petugas Sales ({selectedSalesSet.size} dari {allAvailableSales.length} Dipilih)
              </h4>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAllSales}
                className="px-2.5 py-1 text-[11px] font-semibold text-[#00871f] hover:bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
              >
                Pilih Semua
              </button>
              <button
                type="button"
                onClick={handleDeselectAllSales}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
              >
                Hapus Centang Semua
              </button>
            </div>
          </div>

          {/* Checkboxes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {salesSummaryList.map((sales) => {
              const isChecked = selectedSalesSet.has(sales.salesName);
              return (
                <div
                  key={sales.salesName}
                  onClick={() => handleToggleSales(sales.salesName)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                    isChecked
                      ? 'bg-emerald-50/70 border-[#00871f] ring-1 ring-[#00871f]/20 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 opacity-70'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 text-[#00871f]">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#00871f]" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-900 truncate">
                        {sales.salesName}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                        {sales.orderCount} Faktur
                      </span>
                    </div>

                    <div className="mt-1 flex items-baseline justify-between text-[11px]">
                      <span className="text-slate-500">Nilai Faktur:</span>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(sales.totalInvoice)}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="text-emerald-700 font-medium">Keuntungan:</span>
                      <span className="font-bold text-[#00871f]">
                        {formatCurrency(sales.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            3. TABEL PERBANDINGAN PERFORMA KEUNTUNGAN PER PETUGAS SALES
        ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#00871f]" />
                Tabel Rekapitulasi Hasil Keuntungan Per Sales ({periodLabel})
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Rincian perbandingan nilai faktur, beban vendor, beban kirim, keuntungan bersih, dan margin
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-center">
              Total {activeTransactions.length} Faktur Dicentang
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-10">Pilih</th>
                  <th className="py-3 px-3">Petugas Sales</th>
                  <th className="py-3 px-3 text-center">Faktur</th>
                  <th className="py-3 px-3 text-right">Nilai Faktur</th>
                  <th className="py-3 px-3 text-right text-rose-600">Biaya Vendor</th>
                  <th className="py-3 px-3 text-right text-rose-600">Biaya Kirim</th>
                  <th className="py-3 px-3 text-right text-[#00871f]">Hasil Keuntungan</th>
                  <th className="py-3 px-3 text-center">Margin</th>
                  <th className="py-3 px-3 text-right">Rata-rata/Inv</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesSummaryList.map((sales, idx) => {
                  const isChecked = selectedSalesSet.has(sales.salesName);
                  const avgPerOrder =
                    sales.orderCount > 0 ? Math.round(sales.profit / sales.orderCount) : 0;

                  return (
                    <tr
                      key={sales.salesName}
                      className={`transition-colors ${
                        isChecked ? 'hover:bg-emerald-50/40 bg-white' : 'bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSales(sales.salesName)}
                          className="text-[#00871f] hover:scale-110 transition-transform cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#00871f]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00871f]" />
                          {sales.salesName}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {sales.orderCount}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(sales.totalInvoice)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-600">
                        {sales.vendorCost > 0 ? `- ${formatCurrency(sales.vendorCost)}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-rose-600">
                        {sales.shippingCost > 0 ? `- ${formatCurrency(sales.shippingCost)}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-sm text-[#00871f]">
                        {formatCurrency(sales.profit)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10.5px] ${
                            Number(sales.marginPercent) >= 30
                              ? 'bg-emerald-100 text-emerald-800'
                              : Number(sales.marginPercent) > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sales.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-600">
                        {formatCurrency(avgPerOrder)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-emerald-50/70 border-t-2 border-emerald-300 font-bold text-slate-900">
                <tr>
                  <td colSpan={2} className="py-3 px-3 text-emerald-950 font-black">
                    TOTAL SALES TERPILIH:
                  </td>
                  <td className="py-3 px-3 text-center font-black">
                    {totalMetrics.orderCount}
                  </td>
                  <td className="py-3 px-3 text-right font-black">
                    {formatCurrency(totalMetrics.totalInvoice)}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-rose-700">
                    - {formatCurrency(totalMetrics.vendorCost)}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-rose-700">
                    - {formatCurrency(totalMetrics.shippingCost)}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-base text-[#00871f]">
                    {formatCurrency(totalMetrics.profit)}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-xs">
                      {totalMetrics.marginPercent}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {formatCurrency(
                      totalMetrics.orderCount > 0
                        ? Math.round(totalMetrics.profit / totalMetrics.orderCount)
                        : 0
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* =========================================================================
            4. RINCIAN FAKTUR TRANSAKSI (SESUAI SALES YANG DICENTANG)
        ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#00871f]" />
                Rincian Transaksi Faktur &amp; Vendor
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daftar pesanan dari sales yang dicentang. Klik baris atau icon nota untuk melihat struk invoice.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari faktur, pelanggan, vendor..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-3">No. Faktur</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Petugas Sales</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3">Nama Vendor</th>
                  <th className="py-2.5 px-3 text-right">Nilai Faktur</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Biaya Vendor</th>
                  <th className="py-2.5 px-3 text-right text-rose-600">Ongkir</th>
                  <th className="py-2.5 px-3 text-right text-[#00871f]">Keuntungan</th>
                  <th className="py-2.5 px-3 text-center">Margin</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada transaksi faktur ditemukan untuk periode dan sales terpilih.
                    </td>
                  </tr>
                ) : (
                  searchedTransactions.map((tx) => {
                    const vCost = tx.vendorCost || 0;
                    const sCost = tx.shippingCost || 0;
                    const profit = calculateProfit(tx.total, vCost, sCost);
                    const margin = calculateProfitMargin(profit, tx.total);

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#00871f] whitespace-nowrap">
                          {tx.invoiceNo}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10.5px]">
                            {tx.orderType || tx.cashierName || 'Kasir (Dimas)'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {tx.customer?.name}
                        </td>
                        <td className="py-2.5 px-3">
                          {tx.vendorName ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                              <Building2 className="w-2.5 h-2.5 text-[#00871f]" />
                              {tx.vendorName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(tx.total)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-600">
                          {vCost > 0 ? `- ${formatCurrency(vCost)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-rose-600">
                          {sCost > 0 ? `- ${formatCurrency(sCost)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#00871f]">
                          {formatCurrency(profit)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              Number(margin) >= 30
                                ? 'bg-emerald-100 text-emerald-800'
                                : Number(margin) > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {margin}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {onViewReceipt && (
                            <button
                              type="button"
                              onClick={() => onViewReceipt(tx)}
                              className="p-1 text-slate-400 hover:text-[#00871f] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Lihat Detail Struk & Preview Vendor"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
