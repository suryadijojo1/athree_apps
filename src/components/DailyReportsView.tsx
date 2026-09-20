import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CreditCard,
  Search,
  Eye,
  Printer,
  Clock,
  ArrowUpRight,
  FileEdit,
  Trash2,
  Edit3,
  Coins,
  X,
  RotateCcw,
  SlidersHorizontal,
  UserCheck,
  CheckCircle2,
  CalendarDays,
  DollarSign,
  Layers,
  Download,
  ChevronDown,
  FileDown,
  PlusCircle,
  MinusCircle,
  TrendingUp,
  TrendingDown,
  HardDrive,
  Cloud
} from 'lucide-react';
import { Transaction, User, CashierShift, CashFlowRecord } from '../types';
import {
  formatCurrency,
  exportSalesToExcel,
  exportSalesToPDF,
  downloadTransactionReceiptPDF
} from '../utils/exportUtils';
import { uploadFileToDrive, getOrCreateBackupFolder } from '../services/googleDriveService';
import { getAccessToken, googleSignIn } from '../services/googleAuth';

interface DailyReportsViewProps {
  transactions: Transaction[];
  currentUser: User;
  onViewReceipt: (transaction: Transaction) => void;
  onReviseInvoice?: (transaction: Transaction) => void;
  onDeleteInvoice?: (transaction: Transaction) => void;
  shift?: CashierShift;
  onUpdateShift?: (shift: CashierShift) => void;
  cashFlowRecords?: CashFlowRecord[];
  onAddCashFlow?: (record: Omit<CashFlowRecord, 'id'>) => void;
}

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({
  transactions,
  currentUser,
  onViewReceipt,
  onReviseInvoice,
  onDeleteInvoice,
  shift,
  onUpdateShift,
  cashFlowRecords = [],
  onAddCashFlow
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Dynamic calendar dates
  const todayObj = useMemo(() => new Date(), []);
  const formatIsoDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayIsoStr = useMemo(() => formatIsoDate(todayObj), [todayObj]);
  const yesterdayIsoStr = useMemo(() => {
    const y = new Date(todayObj);
    y.setDate(y.getDate() - 1);
    return formatIsoDate(y);
  }, [todayObj]);
  const sevenDaysAgoIsoStr = useMemo(() => {
    const s = new Date(todayObj);
    s.setDate(s.getDate() - 7);
    return formatIsoDate(s);
  }, [todayObj]);
  const currentMonthPrefix = useMemo(() => {
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}`;
  }, [todayObj]);

  const todayFormattedText = useMemo(() => {
    return todayObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [todayObj]);
  const yesterdayFormattedText = useMemo(() => {
    const y = new Date(todayObj);
    y.setDate(y.getDate() - 1);
    return y.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [todayObj]);
  const monthFormattedText = useMemo(() => {
    return todayObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [todayObj]);
  const todayDateStr = useMemo(() => {
    return todayObj.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [todayObj]);

  // Filters State: Default to 'today' per current calendar date
  const [datePreset, setDatePreset] = useState<
    'all' | 'today' | 'yesterday' | '7days' | 'month' | 'custom'
  >('today');

  const [startDate, setStartDate] = useState<string>(todayIsoStr);
  const [endDate, setEndDate] = useState<string>(todayIsoStr);
  const [cashierFilter, setCashierFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomDateInputs, setShowCustomDateInputs] = useState(false);

  // Selected date for reviewing cash and transactions in the Kas card
  const [selectedReviewDate, setSelectedReviewDate] = useState<string>(todayIsoStr);

  // Persistent map of starting cash by date: { 'YYYY-MM-DD': number }
  const [dailyStartingCashMap, setDailyStartingCashMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('athree_daily_starting_cash');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const currentStartingCash = dailyStartingCashMap[selectedReviewDate] ?? shift?.startingCash ?? 500000;
  const [showRevisiSaldoModal, setShowRevisiSaldoModal] = useState(false);
  const [newSaldoInput, setNewSaldoInput] = useState<number>(currentStartingCash);
  const [revisiNoteInput, setRevisiNoteInput] = useState<string>('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const formatSelectedReviewDate = (isoStr: string) => {
    try {
      const [y, m, d] = isoStr.split('-');
      if (!y || !m || !d) return isoStr;
      return `${d}/${m}/${y}`;
    } catch {
      return isoStr;
    }
  };

  const formatSelectedReviewDateFull = (isoStr: string) => {
    try {
      const [y, m, d] = isoStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  // Transactions specifically for selected review date
  const reviewDateTransactions = useMemo(() => {
    return transactions.filter((t) => t.date && t.date.startsWith(selectedReviewDate));
  }, [transactions, selectedReviewDate]);

  // Cash in drawer calculations for selected review date
  const reviewDateCashSales = useMemo(() => {
    return reviewDateTransactions
      .filter((t) => t.paymentMethod === 'Tunai' && t.status !== 'BATAL')
      .reduce((acc, t) => acc + t.total, 0);
  }, [reviewDateTransactions]);

  const reviewDateNonCashSales = useMemo(() => {
    return reviewDateTransactions
      .filter((t) => t.paymentMethod !== 'Tunai' && t.status !== 'BATAL')
      .reduce((acc, t) => acc + t.total, 0);
  }, [reviewDateTransactions]);

  // Cash flow records specifically for selected review date
  const reviewDateIncomeRecords = useMemo(() => {
    return cashFlowRecords.filter(
      (r) => r.type === 'INCOME' && r.date && r.date.startsWith(selectedReviewDate)
    );
  }, [cashFlowRecords, selectedReviewDate]);

  const reviewDateExpenseRecords = useMemo(() => {
    return cashFlowRecords.filter(
      (r) => r.type === 'EXPENSE' && r.date && r.date.startsWith(selectedReviewDate)
    );
  }, [cashFlowRecords, selectedReviewDate]);

  const reviewDateOtherIncome = useMemo(() => {
    return reviewDateIncomeRecords.reduce((s, r) => s + r.amount, 0);
  }, [reviewDateIncomeRecords]);

  const reviewDateExpense = useMemo(() => {
    return reviewDateExpenseRecords.reduce((s, r) => s + r.amount, 0);
  }, [reviewDateExpenseRecords]);

  // Kas di laci tanggal tersebut dikurangi pengeluaran toko dan ditambah pendapatan lain
  const reviewDateKasDiLaci =
    currentStartingCash + reviewDateCashSales + reviewDateOtherIncome - reviewDateExpense;
  const reviewDateTotalSales = reviewDateCashSales + reviewDateNonCashSales;
  const reviewDateNetRevenue = reviewDateTotalSales + reviewDateOtherIncome - reviewDateExpense;

  const handleFilterToReviewDate = (dateStr: string) => {
    setDatePreset('custom');
    setStartDate(dateStr);
    setEndDate(dateStr);
    setShowCustomDateInputs(true);
  };

  const handleSelectReviewDate = (dateStr: string) => {
    if (!dateStr) return;
    setSelectedReviewDate(dateStr);
    handleFilterToReviewDate(dateStr);
  };

  const handlePrevReviewDay = () => {
    try {
      const [y, m, d] = selectedReviewDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() - 1);
      const prevIso = formatIsoDate(dt);
      setSelectedReviewDate(prevIso);
      handleFilterToReviewDate(prevIso);
    } catch {
      // ignore
    }
  };

  const handleNextReviewDay = () => {
    try {
      const [y, m, d] = selectedReviewDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      const nextIso = formatIsoDate(dt);
      setSelectedReviewDate(nextIso);
      handleFilterToReviewDate(nextIso);
    } catch {
      // ignore
    }
  };

  // Available Cashiers from transaction history
  const availableCashiers = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      if (t.cashierName && t.cashierName.trim()) {
        set.add(t.cashierName.trim());
      }
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Available Sales options
  const availableSales = useMemo(() => {
    const set = new Set<string>(['Kasir (Dimas)', 'Admin (DEAZBAR)']);
    transactions.forEach((t) => {
      if (t.orderType && t.orderType.trim()) {
        set.add(t.orderType.trim());
      }
    });
    return Array.from(set);
  }, [transactions]);

  // Main Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const tDate = t.date.slice(0, 10); // 'YYYY-MM-DD'

      // 1. Date filter
      if (datePreset === 'today') {
        if (!t.date.startsWith(todayIsoStr)) return false;
      } else if (datePreset === 'yesterday') {
        if (!t.date.startsWith(yesterdayIsoStr)) return false;
      } else if (datePreset === '7days') {
        if (tDate < sevenDaysAgoIsoStr || tDate > todayIsoStr) return false;
      } else if (datePreset === 'month') {
        if (!t.date.startsWith(currentMonthPrefix)) return false;
      } else if (datePreset === 'custom') {
        if (startDate && tDate < startDate) return false;
        if (endDate && tDate > endDate) return false;
      }
      // 'all' includes every date

      // 2. Cashier filter
      if (cashierFilter !== 'all' && t.cashierName !== cashierFilter) {
        return false;
      }

      // 3. Sales filter
      if (salesFilter !== 'all' && t.orderType !== salesFilter) {
        return false;
      }

      // 4. Payment method filter
      if (paymentFilter !== 'all' && t.paymentMethod !== paymentFilter) {
        return false;
      }

      // 5. Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      // 6. Search query (Invoice, customer, product items, notes, cashier, sales)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchInv = t.invoiceNo.toLowerCase().includes(q);
        const matchCust = t.customer.name.toLowerCase().includes(q);
        const matchCashier = t.cashierName?.toLowerCase().includes(q);
        const matchSales = t.orderType?.toLowerCase().includes(q);
        const matchItems = t.items.some((i) => i.name.toLowerCase().includes(q));
        const matchNotes = t.notes?.toLowerCase().includes(q);
        if (!matchInv && !matchCust && !matchCashier && !matchSales && !matchItems && !matchNotes) {
          return false;
        }
      }

      return true;
    });
  }, [
    transactions,
    datePreset,
    todayIsoStr,
    yesterdayIsoStr,
    sevenDaysAgoIsoStr,
    currentMonthPrefix,
    startDate,
    endDate,
    cashierFilter,
    salesFilter,
    paymentFilter,
    statusFilter,
    searchQuery
  ]);

  // Aggregate Metrics for Filtered Sales
  const totalRevenue = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + t.total, 0);
  }, [filteredTransactions]);

  const totalCost = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const itemsCost = t.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
      return acc + itemsCost;
    }, 0);
  }, [filteredTransactions]);

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent =
    totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  const filteredCash = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.paymentMethod === 'Tunai')
      .reduce((acc, t) => acc + t.total, 0);
  }, [filteredTransactions]);

  const filteredNonCash = totalRevenue - filteredCash;

  // Filtered Cash Flow records (Income & Expense) for the active date range
  const filteredCashFlows = useMemo(() => {
    return cashFlowRecords.filter((r) => {
      const recDate = r.date ? r.date.slice(0, 10) : '';
      if (!recDate) return true;
      if (datePreset === 'all') return true;
      if (datePreset === 'today') return recDate === todayIsoStr;
      if (datePreset === 'yesterday') return recDate === yesterdayIsoStr;
      if (datePreset === '7days') return recDate >= sevenDaysAgoIsoStr;
      if (datePreset === 'thisMonth') return recDate.startsWith(currentMonthPrefix);
      if (datePreset === 'custom' && startDate && endDate) {
        return recDate >= startDate && recDate <= endDate;
      }
      return true;
    });
  }, [
    cashFlowRecords,
    datePreset,
    todayIsoStr,
    yesterdayIsoStr,
    sevenDaysAgoIsoStr,
    currentMonthPrefix,
    startDate,
    endDate
  ]);

  const filteredIncomeTotal = useMemo(() => {
    return filteredCashFlows
      .filter((r) => r.type === 'INCOME')
      .reduce((s, r) => s + r.amount, 0);
  }, [filteredCashFlows]);

  const filteredExpenseTotal = useMemo(() => {
    return filteredCashFlows
      .filter((r) => r.type === 'EXPENSE')
      .reduce((s, r) => s + r.amount, 0);
  }, [filteredCashFlows]);

  const netFilteredRevenue = totalRevenue + filteredIncomeTotal - filteredExpenseTotal;
  const netFilteredProfit = grossProfit + filteredIncomeTotal - filteredExpenseTotal;

  // Top Products in current filter
  const topProducts = useMemo(() => {
    const map: { [name: string]: { name: string; qty: number; revenue: number } } = {};
    filteredTransactions.forEach((t) => {
      t.items.forEach((item) => {
        if (!map[item.name]) {
          map[item.name] = { name: item.name, qty: 0, revenue: 0 };
        }
        map[item.name].qty += item.quantity;
        map[item.name].revenue += item.subtotal;
      });
    });
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Active filter count
  const isCustomFiltered =
    datePreset !== 'today' ||
    cashierFilter !== 'all' ||
    salesFilter !== 'all' ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setDatePreset('today');
    setShowCustomDateInputs(false);
    setCashierFilter('all');
    setSalesFilter('all');
    setPaymentFilter('all');
    setStatusFilter('all');
    setSearchQuery('');
    setStartDate(todayIsoStr);
    setEndDate(todayIsoStr);
  };

  const handleSelectAllSales = () => {
    setDatePreset('all');
    setShowCustomDateInputs(false);
  };

  const handleDownloadCSV = () => {
    if (filteredTransactions.length === 0) return;
    const headers = [
      'No',
      'No Faktur',
      'Waktu Order',
      'Jatuh Tempo',
      'Pelanggan',
      'Sales / Tipe Order',
      'Kasir',
      'Item Pesanan',
      'Metode Bayar',
      'Subtotal',
      'Diskon',
      'Total',
      'Status',
      'Catatan'
    ];
    const rows = filteredTransactions.map((t, idx) => [
      idx + 1,
      `"${t.invoiceNo}"`,
      `"${t.date}"`,
      `"${t.dueDate || '-'}"`,
      `"${t.customer.name}"`,
      `"${t.orderType || '-'}"`,
      `"${t.cashierName || '-'}"`,
      `"${t.items.map((i) => `${i.name} (x${i.quantity})`).join(', ').replace(/"/g, '""')}"`,
      `"${t.paymentMethod}"`,
      t.subtotal,
      t.discount || 0,
      t.total,
      `"${t.status}"`,
      `"${(t.notes || '-').replace(/"/g, '""')}"`
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Laporan_Penjualan_${datePreset}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const datePresetLabel = useMemo(() => {
    switch (datePreset) {
      case 'all':
        return 'Semua Penjualan';
      case 'today':
        return `Hari Ini (${todayFormattedText})`;
      case 'yesterday':
        return `Kemarin (${yesterdayFormattedText})`;
      case '7days':
        return '7 Hari Terakhir';
      case 'month':
        return `Bulan Ini (${monthFormattedText})`;
      case 'custom':
        return `${startDate} s/d ${endDate}`;
      default:
        return 'Semua Penjualan';
    }
  }, [datePreset, startDate, endDate, todayFormattedText, yesterdayFormattedText, monthFormattedText]);

  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadToast, setDriveUploadToast] = useState<{ message: string; link?: string; isError?: boolean } | null>(null);

  const handleUploadReportToDrive = async () => {
    setIsUploadingToDrive(true);
    setDriveUploadToast(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (!res) throw new Error('Otorisasi Google Drive dibatalkan');
        token = res.accessToken;
      }

      const folderId = await getOrCreateBackupFolder('POS_DEAZBAR_Backups');
      const fileName = `Laporan_Penjualan_${datePresetLabel.replace(/[\s/\\:]+/g, '_')}_${Date.now()}.json`;

      const reportPayload = {
        title: `Laporan Penjualan (${datePresetLabel})`,
        generatedAt: new Date().toISOString(),
        generatedAtFormatted: new Date().toLocaleString('id-ID'),
        summary: {
          totalTransactions: filteredTransactions.length,
          grossSales: totalRevenue,
          otherIncome: filteredIncomeTotal,
          expenses: filteredExpenseTotal,
          netRevenue: netFilteredRevenue,
          netProfit: netFilteredProfit
        },
        transactions: filteredTransactions,
        cashFlowRecords: filteredCashFlows
      };

      const uploaded = await uploadFileToDrive({
        name: fileName,
        mimeType: 'application/json',
        content: JSON.stringify(reportPayload, null, 2),
        folderId,
        description: `Laporan Penjualan (${datePresetLabel}) diekspor dari DEAZBAR POS`
      });

      setDriveUploadToast({
        message: `Laporan berhasil disimpan ke Google Drive (${uploaded.name})!`,
        link: uploaded.webViewLink
      });
      setTimeout(() => setDriveUploadToast(null), 7000);
    } catch (err: any) {
      console.error('Upload report to drive error:', err);
      setDriveUploadToast({
        message: err.message || 'Gagal menyimpan laporan ke Google Drive',
        isError: true
      });
      setTimeout(() => setDriveUploadToast(null), 6000);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Header & Export Bar */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#00871f]" />
              Laporan Penjualan Harian & Analisis
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#00871f] font-bold tracking-wider">
                Hari Ini: {todayFormattedText}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Pantau omset harian, mutasi kas di laci, metode pembayaran, dan riwayat pesanan studio sesuai tanggal kalender
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() =>
                exportSalesToExcel(
                  filteredTransactions,
                  `Laporan_Penjualan_${datePreset}_${Date.now()}`,
                  filteredCashFlows
                )
              }
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>
            <button
              onClick={() =>
                exportSalesToPDF(
                  filteredTransactions,
                  `Laporan Penjualan (${datePresetLabel})`,
                  filteredCashFlows
                )
              }
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Ekspor PDF</span>
            </button>
            <button
              onClick={handleUploadReportToDrive}
              disabled={isUploadingToDrive}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Simpan Laporan ini langsung ke folder Google Drive Anda"
            >
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>{isUploadingToDrive ? 'Menyimpan...' : 'Simpan ke Drive'}</span>
            </button>
          </div>
        </div>

        {driveUploadToast && (
          <div className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            driveUploadToast.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}>
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{driveUploadToast.message}</span>
              {driveUploadToast.link && (
                <a
                  href={driveUploadToast.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold underline ml-1 hover:text-blue-700"
                >
                  Buka di Drive ↗
                </a>
              )}
            </div>
            <button
              onClick={() => setDriveUploadToast(null)}
              className="font-bold text-slate-400 hover:text-slate-600 px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tampilan Kas Hari Ini & Metrik Ringkasan Terfilter */}
        <div className="mt-4 flex flex-wrap items-stretch gap-3">
          {/* Card Kas Tanggal Terpilih & Review Selisih */}
          <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-200 text-slate-800 w-full sm:w-80 transition-all">
            <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-200">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Coins className="w-3.5 h-3.5 text-[#00871f] shrink-0" />
                <span className="text-xs font-bold text-slate-800 shrink-0">Kas</span>
                <input
                  type="date"
                  value={selectedReviewDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectReviewDate(e.target.value);
                    }
                  }}
                  className="text-xs font-bold text-[#00871f] bg-slate-100 hover:bg-slate-200/80 px-1.5 py-0.5 rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#00871f] cursor-pointer"
                  title="Pilih tanggal untuk melihat dan merevisi review transaksi & saldo kas tanggal tersebut"
                />
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setNewSaldoInput(currentStartingCash);
                    setRevisiNoteInput('');
                    setShowRevisiSaldoModal(true);
                  }}
                  className="text-[10px] font-bold text-[#00871f] hover:underline flex items-center gap-0.5 cursor-pointer shrink-0 ml-1"
                  title={`Revisi Nominal Saldo Awal Tanggal ${formatSelectedReviewDate(selectedReviewDate)}`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Revisi Saldo</span>
                </button>
              )}
            </div>

            {/* Quick date switcher buttons */}
            <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-100 text-[10px]">
              <button
                type="button"
                onClick={handlePrevReviewDay}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                title="Hari Sebelumnya"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => handleSelectReviewDate(todayIsoStr)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer font-semibold ${
                  selectedReviewDate === todayIsoStr && datePreset === 'custom' && startDate === todayIsoStr
                    ? 'bg-[#00871f] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handleSelectReviewDate(yesterdayIsoStr)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer font-semibold ${
                  selectedReviewDate === yesterdayIsoStr && datePreset === 'custom' && startDate === yesterdayIsoStr
                    ? 'bg-[#00871f] text-white'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={handleNextReviewDay}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                title="Hari Berikutnya"
              >
                ▶
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Saldo Awal:</span>
                <span className="font-bold text-[#00871f]">
                  {currentStartingCash.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Tunai (Kasir):</span>
                <span className="font-semibold text-slate-800">
                  {reviewDateCashSales.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Non Tunai:</span>
                <span className="font-semibold text-slate-800">
                  {reviewDateNonCashSales.toLocaleString('id-ID')}
                </span>
              </div>
              {/* Dampak Pendapatan Lain & Pengeluaran Toko untuk tanggal ini */}
              <div className="flex justify-between items-center text-[11px] text-emerald-700 bg-emerald-50/70 px-1.5 py-0.5 rounded">
                <span className="font-medium">(+) Pendapatan Lain:</span>
                <span className="font-bold">+{reviewDateOtherIncome.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-rose-700 bg-rose-50/70 px-1.5 py-0.5 rounded">
                <span className="font-medium">(-) Pengeluaran Toko:</span>
                <span className="font-bold">-{reviewDateExpense.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center font-bold pt-1 border-t border-slate-100">
                <span className="text-slate-800">Kas di Laci:</span>
                <span className="text-slate-900 font-extrabold">
                  {reviewDateKasDiLaci.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-600 pt-0.5">
                <span className="font-medium">Omset Bersih Tgl Ini:</span>
                <span className="font-bold text-[#00871f]">
                  {formatCurrency(reviewDateNetRevenue)}
                </span>
              </div>
              <div className="pt-1.5 mt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">
                  {selectedReviewDate === todayIsoStr
                    ? 'Transaksi Hari Ini:'
                    : selectedReviewDate === yesterdayIsoStr
                    ? 'Transaksi Kemarin:'
                    : `Transaksi ${formatSelectedReviewDate(selectedReviewDate)}:`}
                </span>
                <button
                  type="button"
                  onClick={() => handleFilterToReviewDate(selectedReviewDate)}
                  className="font-bold text-[#3b49df] hover:underline cursor-pointer flex items-center gap-0.5"
                  title={`Lihat & review transaksi tanggal ${formatSelectedReviewDate(selectedReviewDate)}`}
                >
                  <span>{reviewDateTransactions.length} Transaksi ➔</span>
                </button>
              </div>
            </div>
          </div>

          {/* Baris Ringkasan Hasil Penjualan Terfilter */}
          <div className="flex-1 bg-slate-50/80 rounded-xl p-3 border border-slate-200 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Ringkasan Penjualan & Keuangan:
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-[#00871f]">
                  {datePresetLabel}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {filteredTransactions.length} Transaksi | {filteredCashFlows.length} Mutasi Kas
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Penjualan Kotor</span>
                <span className="text-xs font-bold text-slate-800">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
              <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[10px] text-emerald-700 font-medium block">(+) Pendapatan Lain</span>
                <span className="text-xs font-bold text-emerald-800">
                  +{formatCurrency(filteredIncomeTotal)}
                </span>
              </div>
              <div className="bg-rose-50/70 p-2 rounded-lg border border-rose-200 shadow-2xs">
                <span className="text-[10px] text-rose-700 font-medium block">(-) Pengeluaran Toko</span>
                <span className="text-xs font-bold text-rose-800">
                  -{formatCurrency(filteredExpenseTotal)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-300 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Omset Bersih</span>
                <span className="text-xs font-bold text-[#00871f]">
                  {formatCurrency(netFilteredRevenue)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-medium block">Laba Bersih</span>
                <span className="text-xs font-bold text-indigo-700">
                  {formatCurrency(netFilteredProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* MENU FILTER PENJUALAN HARIAN */}
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-3">
          {/* Header Menu Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#00871f]/10 text-[#00871f] flex items-center justify-center">
                <Filter className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  Menu Filter Penjualan Harian
                  {isCustomFiltered && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                      Filter Aktif
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Filter periode penjualan harian, kasir penanggung jawab, metode pembayaran, dan status faktur
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tombol Tampilkan Semua Penjualan Cepat */}
              <button
                onClick={handleSelectAllSales}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  datePreset === 'all'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tampilkan Semua Penjualan</span>
              </button>

              {/* Tombol Reset Filter */}
              {isCustomFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Kembalikan semua filter ke default"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Baris 1: Filter Periode Tanggal Harian */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              Periode:
            </span>

            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                onClick={() => {
                  setDatePreset('today');
                  setShowCustomDateInputs(false);
                  setSelectedReviewDate(todayIsoStr);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini ({todayFormattedText})
              </button>
              <button
                onClick={() => {
                  setDatePreset('yesterday');
                  setShowCustomDateInputs(false);
                  setSelectedReviewDate(yesterdayIsoStr);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'yesterday'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kemarin
              </button>
              <button
                onClick={() => {
                  setDatePreset('7days');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === '7days'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                onClick={() => {
                  setDatePreset('month');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'month'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
              <button
                onClick={() => {
                  setDatePreset('all');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'all'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Penjualan
              </button>
              <button
                onClick={() => {
                  setDatePreset('custom');
                  setShowCustomDateInputs(true);
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  datePreset === 'custom'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Pilih Tanggal / Rentang</span>
              </button>
            </div>

            {/* Custom Date Range Picker inputs when active */}
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 bg-emerald-50/70 border border-emerald-200 p-1.5 rounded-xl animate-in fade-in zoom-in-95">
                <span className="text-[11px] font-semibold text-emerald-800 ml-1">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate === startDate || !endDate) {
                      setEndDate(e.target.value);
                    }
                    if (e.target.value) {
                      setSelectedReviewDate(e.target.value);
                    }
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00871f]"
                />
                <span className="text-[11px] font-semibold text-emerald-800">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (e.target.value && e.target.value === startDate) {
                      setSelectedReviewDate(e.target.value);
                    }
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00871f]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(todayIsoStr);
                    setEndDate(todayIsoStr);
                    setSelectedReviewDate(todayIsoStr);
                  }}
                  className="text-[10px] font-bold text-emerald-700 hover:underline px-1.5"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(yesterdayIsoStr);
                    setEndDate(yesterdayIsoStr);
                    setSelectedReviewDate(yesterdayIsoStr);
                  }}
                  className="text-[10px] font-bold text-emerald-700 hover:underline px-1.5"
                >
                  Kemarin
                </button>
              </div>
            )}
          </div>

          {/* Baris 2: Search, Filter Sales, Filter Kasir, Metode Pembayaran, dan Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari no faktur, pelanggan, produk..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f] text-slate-800"
              />
            </div>

            {/* Filter Sales */}
            <div className="flex items-center gap-1.5">
              <select
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              >
                <option value="all">Semua Petugas Sales</option>
                {availableSales.map((s) => (
                  <option key={s} value={s}>
                    Sales: {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Kasir / Operator */}
            <div className="flex items-center gap-1.5">
              <select
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              >
                <option value="all">Semua Kasir & Operator</option>
                {availableCashiers.map((c) => (
                  <option key={c} value={c}>
                    Kasir: {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Metode Pembayaran */}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              >
                <option value="all">Semua Metode Pembayaran</option>
                <option value="Tunai">Tunai</option>
                <option value="QRIS">QRIS</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Kartu Debit">Kartu Debit</option>
              </select>
            </div>

            {/* Filter Status */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              >
                <option value="all">Semua Status Pesanan</option>
                <option value="Selesai">Selesai</option>
                <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                <option value="Menunggu">Menunggu</option>
              </select>
            </div>
          </div>
        </div>

        {/* Top selling preview banner */}
        {topProducts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-[#00871f]" />
              5 Produk Terlaris Periode Ini ({datePresetLabel})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {topProducts.map((p, idx) => (
                <div key={p.name} className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-[#00871f] text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800 truncate">{p.name}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                    <span>{p.qty} pcs</span>
                    <span className="font-semibold text-slate-700">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner Review Transaksi Tanggal */}
        {(datePreset === 'today' || datePreset === 'yesterday' || (datePreset === 'custom' && startDate === endDate)) && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileEdit className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block">
                  Mode Review &amp; Koreksi Transaksi Tanggal:{' '}
                  {datePreset === 'today'
                    ? todayFormattedText
                    : datePreset === 'yesterday'
                    ? yesterdayFormattedText
                    : formatSelectedReviewDateFull(startDate)}
                </span>
                <p className="text-[11px] text-amber-800">
                  Periksa rincian faktur di bawah. Jika terdapat selisih uang fisik atau kesalahan input kasir (nominal, pelanggan, item, atau metode bayar), klik tombol <strong>Revisi</strong> pada baris transaksi.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[11px] font-semibold text-slate-700">Ganti Tanggal Review:</span>
                  <input
                    type="date"
                    value={datePreset === 'today' ? todayIsoStr : datePreset === 'yesterday' ? yesterdayIsoStr : startDate}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleSelectReviewDate(e.target.value);
                      }
                    }}
                    className="bg-white border border-amber-300 rounded-md px-2 py-0.5 text-xs text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                  />
                  <span className="text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded font-medium">
                    {filteredTransactions.length} Faktur Ditemukan di Tanggal Ini
                  </span>
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  const targetDate =
                    datePreset === 'today'
                      ? todayIsoStr
                      : datePreset === 'yesterday'
                      ? yesterdayIsoStr
                      : startDate;
                  setSelectedReviewDate(targetDate);
                  setNewSaldoInput(dailyStartingCashMap[targetDate] ?? shift?.startingCash ?? 500000);
                  setRevisiNoteInput('');
                  setShowRevisiSaldoModal(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-200/80 hover:bg-amber-200 text-amber-900 font-bold text-[11px] flex items-center gap-1 shrink-0 self-start sm:self-center transition-colors cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 text-amber-800" />
                <span>Revisi Saldo Kas</span>
              </button>
            )}
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Daftar Transaksi Penjualan
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {filteredTransactions.length} Data
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Total Omset: <strong>{formatCurrency(totalRevenue)}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">No. Faktur</th>
                  <th className="py-2.5 px-3">Waktu Order</th>
                  <th className="py-2.5 px-3">Jatuh Tempo</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3">Kasir / Operator</th>
                  <th className="py-2.5 px-3">Item Pesanan</th>
                  <th className="py-2.5 px-3">Metode Bayar</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Filter className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                        <p className="text-xs font-medium text-slate-500">
                          Tidak ada transaksi yang cocok dengan kriteria filter yang dipilih.
                        </p>
                        <button
                          onClick={handleResetFilters}
                          className="text-xs font-bold text-[#00871f] hover:underline"
                        >
                          Tampilkan Semua Penjualan
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#00871f]">
                        {t.invoiceNo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {t.date}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-800 block">
                          {t.dueDate || '-'}
                        </span>
                        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          Target Selesai
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800 block">{t.customer.name}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium mt-0.5">
                          Sales: {t.orderType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-700 text-xs block">
                          {t.cashierName || '-'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs">
                        <p className="truncate text-slate-800 font-medium">
                          {t.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                        </p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(t.total)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {t.status === 'Selesai' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Selesai
                          </span>
                        ) : t.status === 'Sedang Dikerjakan' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Sedang Dikerjakan
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-semibold">
                            {t.status}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onReviseInvoice && (
                            <button
                              onClick={() => onReviseInvoice(t)}
                              title="Revisi Faktur / Koreksi Kesalahan Input"
                              className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <FileEdit className="w-3 h-3 text-amber-600" />
                              <span>Revisi</span>
                            </button>
                          )}
                          <button
                            onClick={() => onViewReceipt(t)}
                            title="Lihat Struk / Detail"
                            className="p-1 hover:text-[#00871f] text-slate-400 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => downloadTransactionReceiptPDF(t)}
                            title="Unduh Struk PDF"
                            className="p-1 hover:text-[#00871f] text-slate-400 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && onDeleteInvoice && (
                            <button
                              onClick={() => onDeleteInvoice(t)}
                              title="Hapus Faktur (Khusus Admin)"
                              className="p-1 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredTransactions.length > 0 && (
                <tfoot className="bg-slate-50/95 font-semibold border-t-2 border-slate-200 text-slate-800">
                  <tr>
                    <td colSpan={6} className="py-3 px-3 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800">Total Penjualan:</span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#00871f] font-bold">
                          {filteredTransactions.length} Faktur / Pesanan
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-[10px] text-slate-500 font-medium space-y-0.5">
                        <div>Tunai: <strong className="text-slate-800">{formatCurrency(filteredCash)}</strong></div>
                        <div>Non-Tunai: <strong className="text-slate-800">{formatCurrency(filteredNonCash)}</strong></div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-sm font-black text-[#00871f] block">
                        {formatCurrency(totalRevenue)}
                      </span>
                    </td>
                    <td colSpan={2} className="py-3 px-3 text-center text-[10px] text-slate-400 font-medium">
                      Lunas / Terverifikasi
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Bottom Card Footer: Tampilan Total Penjualan & Menu Download Report */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tampilan Total Penjualan & Rincian */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-white border border-emerald-300 rounded-xl px-4 py-2.5 shadow-2xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center font-bold shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Total Penjualan ({datePresetLabel})
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-slate-900 tracking-tight">
                      {formatCurrency(totalRevenue)}
                    </span>
                    <span className="text-xs font-bold text-[#00871f] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {filteredTransactions.length} Transaksi
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian Mutasi Kas: Pendapatan Lain (+) & Pengeluaran Toko (-) */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {filteredIncomeTotal > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 shadow-2xs">
                    <span className="text-[10px] text-emerald-700 font-semibold block uppercase">
                      (+) Pendapatan Lain
                    </span>
                    <span className="font-bold text-emerald-800">
                      +{formatCurrency(filteredIncomeTotal)}
                    </span>
                  </div>
                )}
                {filteredExpenseTotal > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 shadow-2xs">
                    <span className="text-[10px] text-rose-700 font-semibold block uppercase">
                      (-) Pengeluaran
                    </span>
                    <span className="font-bold text-rose-800">
                      -{formatCurrency(filteredExpenseTotal)}
                    </span>
                  </div>
                )}
                <div className="bg-white border border-emerald-400 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-[10px] text-[#00871f] font-semibold block uppercase">
                    (=) Omset Bersih
                  </span>
                  <span className="font-black text-[#00871f]">
                    {formatCurrency(netFilteredRevenue)}
                  </span>
                </div>
              </div>

              {/* Rincian Metode Bayar */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Tunai (Laci)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(filteredCash)}</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Non-Tunai (Transfer/QRIS)</span>
                  <span className="font-bold text-slate-800">{formatCurrency(filteredNonCash)}</span>
                </div>
                {isAdmin && (
                  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-2xs hidden lg:block">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Laba Bersih</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(netFilteredProfit)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Menu Download Report */}
            <div className="flex items-center gap-2 relative">
              {/* Quick 1-click Download Buttons */}
              <button
                type="button"
                onClick={() =>
                  exportSalesToExcel(
                    filteredTransactions,
                    `Laporan_Penjualan_${datePreset}_${Date.now()}`,
                    filteredCashFlows
                  )
                }
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#00871f] border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                title="Download cepat format Excel (.xlsx) dengan rincian arus kas"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  exportSalesToPDF(
                    filteredTransactions,
                    `Laporan Penjualan (${datePresetLabel})`,
                    filteredCashFlows
                  )
                }
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                title="Download cepat format PDF dengan mutasi kas"
              >
                <FileText className="w-4 h-4 text-rose-600" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              {/* Main Download Report Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                  className="px-4 py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm hover:shadow-md cursor-pointer active:scale-95"
                  title="Buka Menu Download Report Lengkap"
                >
                  <Download className="w-4 h-4" />
                  <span>Menu Download Report</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      showDownloadMenu ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showDownloadMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDownloadMenu(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-[#00871f]" />
                          Menu Download Report Penjualan
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Periode: <strong>{datePresetLabel}</strong> ({filteredTransactions.length} Data)
                        </p>
                      </div>

                      <div className="py-1 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            exportSalesToExcel(
                              filteredTransactions,
                              `Laporan_Penjualan_${datePreset}_${Date.now()}`,
                              filteredCashFlows
                            );
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 transition-colors flex items-start gap-2.5 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-slate-800 group-hover:text-emerald-800">
                              Download Laporan Excel (.xlsx)
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              Format spreadsheet tabel penjualan & arus kas lengkap
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            exportSalesToPDF(
                              filteredTransactions,
                              `Laporan Penjualan (${datePresetLabel})`,
                              filteredCashFlows
                            );
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-rose-50 text-slate-700 hover:text-rose-900 transition-colors flex items-start gap-2.5 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-slate-800 group-hover:text-rose-800">
                              Download Laporan PDF (.pdf)
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              Dokumen siap cetak dengan mutasi kas & omset bersih
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            handleDownloadCSV();
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-blue-900 transition-colors flex items-start gap-2.5 cursor-pointer group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                            <FileDown className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-slate-800 group-hover:text-blue-800">
                              Download Data CSV (.csv)
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              Format data mentah untuk import spreadsheet
                            </span>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowDownloadMenu(false);
                            window.print();
                          }}
                          className="w-full text-left p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-start gap-2.5 cursor-pointer group border-t border-slate-100"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-300 transition-colors">
                            <Printer className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-slate-800">
                              Cetak Halaman Laporan
                            </span>
                            <span className="text-[11px] text-slate-500 block leading-tight">
                              Kirim langsung ke printer atau print dialog
                            </span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card Rincian Arus Kas: Pendapatan Lain (+) & Pengeluaran Toko (-) Periode Terpilih */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center font-bold">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  Mutasi Kas Toko: Pendapatan Lain & Pengeluaran
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                    {filteredCashFlows.length} Catatan
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dihitung otomatis memotong (pengeluaran) atau menambah (pendapatan lain) saldo transaksi pada tanggal terkait
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>+ {formatCurrency(filteredIncomeTotal)}</span>
              </div>
              <div className="bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                <span>- {formatCurrency(filteredExpenseTotal)}</span>
              </div>
              <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl font-bold">
                Net: {filteredIncomeTotal - filteredExpenseTotal >= 0 ? '+' : ''}
                {formatCurrency(filteredIncomeTotal - filteredExpenseTotal)}
              </div>
            </div>
          </div>

          {filteredCashFlows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Coins className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-500" />
              Tidak ada catatan pengeluaran toko atau pendapatan lain pada periode{' '}
              <strong>{datePresetLabel}</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal</th>
                    <th className="py-2.5 px-3">Jenis Mutasi</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Dicatat Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCashFlows.map((record) => {
                    const isIncome = record.type === 'INCOME';
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">
                          {record.date}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isIncome ? (
                              <>
                                <TrendingUp className="w-3 h-3" />
                                Pendapatan Lain (+)
                              </>
                            ) : (
                              <>
                                <TrendingDown className="w-3 h-3" />
                                Pengeluaran Toko (-)
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-800 font-medium">
                          {record.category}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {record.description || '-'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                            isIncome ? 'text-[#00871f]' : 'text-rose-600'
                          }`}
                        >
                          {isIncome ? '+' : '-'} {formatCurrency(record.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-medium whitespace-nowrap">
                          {record.recordedBy || 'Admin'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Revisi Saldo Awal */}
      {showRevisiSaldoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Revisi Saldo Awal Kas
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tanggal: <span className="text-[#00871f] font-bold">{formatSelectedReviewDate(selectedReviewDate)}</span> (Admin Only)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRevisiSaldoModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal Saldo Awal Baru (Rp):
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={newSaldoInput}
                  onChange={(e) => setNewSaldoInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-sm font-bold text-slate-900 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  placeholder="500000"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alasan Koreksi / Selisih (Opsional):
                </label>
                <input
                  type="text"
                  value={revisiNoteInput}
                  onChange={(e) => setRevisiNoteInput(e.target.value)}
                  placeholder="Contoh: Koreksi salah hitung uang kembalian..."
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 text-slate-600">
                <div className="flex justify-between">
                  <span>Saldo Awal Tercatat:</span>
                  <span className="font-semibold text-slate-700">
                    {currentStartingCash.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Penjualan Tunai Tanggal Ini:</span>
                  <span className="font-semibold text-slate-700">
                    {reviewDateCashSales.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-slate-200/60">
                  <span>Estimasi Kas Baru di Laci:</span>
                  <span className="text-[#00871f]">
                    {(newSaldoInput + reviewDateCashSales).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRevisiSaldoModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const updatedMap = {
                    ...dailyStartingCashMap,
                    [selectedReviewDate]: newSaldoInput
                  };
                  setDailyStartingCashMap(updatedMap);
                  try {
                    localStorage.setItem('athree_daily_starting_cash', JSON.stringify(updatedMap));
                  } catch {
                    // ignore
                  }

                  if (selectedReviewDate === todayIsoStr && onUpdateShift && shift) {
                    onUpdateShift({
                      ...shift,
                      startingCash: newSaldoInput,
                      expectedCash: newSaldoInput + reviewDateCashSales
                    });
                  }
                  setShowRevisiSaldoModal(false);
                }}
                className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
