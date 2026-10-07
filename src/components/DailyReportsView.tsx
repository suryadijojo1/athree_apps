import React, { useState, useMemo, useEffect } from 'react';
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
  Cloud,
  Check,
  Wallet,
  Building2,
  Lock
} from 'lucide-react';
import { Transaction, User, CashierShift, CashFlowRecord } from '../types';
import { resolveLastClosingCash, getShiftTimestamp, isMockOrTestShift } from '../utils/shiftUtils';
import {
  formatCurrency,
  exportSalesToExcel,
  exportSalesToPDF,
  downloadTransactionReceiptPDF
} from '../utils/exportUtils';
import { PrintReceiptModal } from './PrintReceiptModal';
import { ReviseCashFlowModal } from './ReviseCashFlowModal';
import { calculateProfit, isAdminOrOwner } from '../utils/profitUtils';
import { uploadFileToDrive, getOrCreateBackupFolder } from '../services/googleDriveService';
import { getAccessToken, googleSignIn } from '../services/googleAuth';
import { SalesProfitReportView } from './SalesProfitReportView';

interface DailyReportsViewProps {
  transactions: Transaction[];
  currentUser: User;
  onViewReceipt: (transaction: Transaction) => void;
  onReviseInvoice?: (transaction: Transaction) => void;
  onDeleteInvoice?: (transaction: Transaction) => void;
  onPayPiutang?: (transaction: Transaction) => void;
  shift?: CashierShift;
  onUpdateShift?: (shift: CashierShift) => void;
  shiftHistory?: CashierShift[];
  cashFlowRecords?: CashFlowRecord[];
  onAddCashFlow?: (record: Omit<CashFlowRecord, 'id'>) => void;
  onUpdateCashFlow?: (record: CashFlowRecord) => void;
  onDeleteCashFlow?: (recordId: string) => void;
  salesList?: string[];
  initialSubTab?: 'daily_sales' | 'sales_profit';
}

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({
  transactions,
  currentUser,
  onViewReceipt,
  onReviseInvoice,
  onDeleteInvoice,
  onPayPiutang,
  shift,
  onUpdateShift,
  shiftHistory = [],
  cashFlowRecords = [],
  onAddCashFlow,
  onUpdateCashFlow,
  onDeleteCashFlow,
  salesList = ['Kasir (Dimas)', 'Admin (DEAZBAR)'],
  initialSubTab = 'daily_sales'
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [subTab, setSubTab] = useState<'daily_sales' | 'sales_profit'>(initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

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
  const thirtyDaysAgoIsoStr = useMemo(() => {
    const s = new Date(todayObj);
    s.setDate(s.getDate() - 30);
    return formatIsoDate(s);
  }, [todayObj]);
  const currentMonthPrefix = useMemo(() => {
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}`;
  }, [todayObj]);

  const lastMonthObj = useMemo(() => {
    return new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, 1);
  }, [todayObj]);
  const lastMonthPrefix = useMemo(() => {
    return `${lastMonthObj.getFullYear()}-${String(lastMonthObj.getMonth() + 1).padStart(2, '0')}`;
  }, [lastMonthObj]);
  const lastMonthFormattedText = useMemo(() => {
    return lastMonthObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }, [lastMonthObj]);

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
    'all' | 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'lastMonth' | 'custom'
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

  // Dynamic starting cash resolution:
  // 1. Manual revision from dailyStartingCashMap
  // 2. Active shift startingCash if viewing today and shift is open
  // 3. Shift on selectedReviewDate from shiftHistory
  // 4. Closing balance of previous closed shift before selectedReviewDate
  // 5. Unified resolver from shiftUtils (checks last closed shift, server, localStorage, fallback)
  const currentStartingCash = useMemo(() => {
    if (dailyStartingCashMap[selectedReviewDate] !== undefined) {
      return dailyStartingCashMap[selectedReviewDate];
    }
    if (selectedReviewDate === todayIsoStr && shift?.isOpen && shift?.startingCash !== undefined) {
      return shift.startingCash;
    }
    if (Array.isArray(shiftHistory) && shiftHistory.length > 0) {
      const matchThisDate = shiftHistory.find((s) => {
        const sDate = s.startTime || s.endTime || '';
        return (
          sDate.includes(selectedReviewDate) ||
          (s.startTimestamp && new Date(s.startTimestamp).toISOString().startsWith(selectedReviewDate))
        );
      });
      if (matchThisDate && matchThisDate.startingCash !== undefined) {
        return matchThisDate.startingCash;
      }

      // Find closed shifts prior to review date
      const reviewTime = new Date(`${selectedReviewDate} 23:59:59`).getTime();
      const prevShifts = shiftHistory
        .filter((s) => {
          if (s.isOpen) return false;
          if (isMockOrTestShift(s)) return false;
          const sTime = getShiftTimestamp(s);
          return sTime > 0 && sTime <= reviewTime;
        })
        .sort((a, b) => getShiftTimestamp(b) - getShiftTimestamp(a));

      if (prevShifts.length > 0) {
        const prev = prevShifts[0];
        return prev.actualCash !== undefined ? prev.actualCash : (prev.expectedCash || 500000);
      }
    }

    // Fallback to unified resolver
    const resolved = resolveLastClosingCash({
      shiftHistory,
      currentShift: shift,
      targetDate: selectedReviewDate,
      dailyMap: dailyStartingCashMap
    });
    return resolved.amount;
  }, [dailyStartingCashMap, selectedReviewDate, shift, shiftHistory, todayIsoStr]);
  const [showRevisiSaldoModal, setShowRevisiSaldoModal] = useState(false);
  const [newSaldoInput, setNewSaldoInput] = useState<number>(currentStartingCash);
  const [revisiNoteInput, setRevisiNoteInput] = useState<string>('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveUploadToast, setDriveUploadToast] = useState<{ message: string; link?: string; isError?: boolean } | null>(null);
  const [printModalTx, setPrintModalTx] = useState<Transaction | null>(null);

  // States: Revisi & Catat Pendapatan Lain / Pengeluaran Toko
  const [revisingCashFlow, setRevisingCashFlow] = useState<CashFlowRecord | null>(null);
  const [showReviseCashFlowModal, setShowReviseCashFlowModal] = useState<boolean>(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState<boolean>(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState<boolean>(false);
  const [cashFlowDateInput, setCashFlowDateInput] = useState<string>(todayIsoStr);
  const [cashFlowCategoryInput, setCashFlowCategoryInput] = useState<string>('Jasa Desain Tambahan');
  const [cashFlowAmountInput, setCashFlowAmountInput] = useState<number>(50000);
  const [cashFlowMethodInput, setCashFlowMethodInput] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
  const [cashFlowDescInput, setCashFlowDescInput] = useState<string>('');

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

  // Pendapatan lain Tunai (menambah saldo kas fisik toko per hari tgl saat diinput)
  const reviewDateCashOtherIncome = useMemo(() => {
    return reviewDateIncomeRecords
      .filter((r) => r.paymentMethod !== 'TRANSFER')
      .reduce((s, r) => s + r.amount, 0);
  }, [reviewDateIncomeRecords]);

  // Pendapatan lain Transfer (hanya tercatat di daftar transaksi, TIDAK ditambahkan ke kas fisik)
  const reviewDateTransferOtherIncome = useMemo(() => {
    return reviewDateIncomeRecords
      .filter((r) => r.paymentMethod === 'TRANSFER')
      .reduce((s, r) => s + r.amount, 0);
  }, [reviewDateIncomeRecords]);

  const reviewDateExpense = useMemo(() => {
    return reviewDateExpenseRecords.reduce((s, r) => s + r.amount, 0);
  }, [reviewDateExpenseRecords]);

  // Pendapatan lain Tunai yang belum masuk ke reviewDateTransactions (mencegah hitung ganda jika tx sudah dibuat)
  const reviewDateStandaloneCashIncome = useMemo(() => {
    return reviewDateIncomeRecords
      .filter(
        (r) =>
          r.paymentMethod !== 'TRANSFER' &&
          (!r.transactionId || !reviewDateTransactions.some((t) => t.id === r.transactionId))
      )
      .reduce((s, r) => s + r.amount, 0);
  }, [reviewDateIncomeRecords, reviewDateTransactions]);

  // Kas di laci tanggal tersebut dikurangi pengeluaran toko dan ditambah pendapatan lain Tunai:
  const reviewDateKasDiLaci =
    currentStartingCash + reviewDateCashSales + reviewDateStandaloneCashIncome - reviewDateExpense;

  const reviewDateStandaloneOtherIncome = useMemo(() => {
    return reviewDateIncomeRecords
      .filter(
        (r) => !r.transactionId || !reviewDateTransactions.some((t) => t.id === r.transactionId)
      )
      .reduce((s, r) => s + r.amount, 0);
  }, [reviewDateIncomeRecords, reviewDateTransactions]);

  const reviewDateTotalSales = reviewDateCashSales + reviewDateNonCashSales;
  const reviewDateNetRevenue =
    reviewDateTotalSales + reviewDateStandaloneOtherIncome - reviewDateExpense;

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

  // Safe Date Extractor helper
  const getTxDate = (t: Transaction): string => {
    const raw = t.date || t.createdAt || '';
    return raw ? raw.slice(0, 10) : '';
  };

  // Helper to check if a specific date falls within the active preset/range
  const isDateInActiveRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (datePreset === 'all') return true;
    if (datePreset === 'today') return d === todayIsoStr;
    if (datePreset === 'yesterday') return d === yesterdayIsoStr;
    if (datePreset === '7days') return d >= sevenDaysAgoIsoStr && d <= todayIsoStr;
    if (datePreset === '30days') return d >= thirtyDaysAgoIsoStr && d <= todayIsoStr;
    if (datePreset === 'month') return d.startsWith(currentMonthPrefix);
    if (datePreset === 'lastMonth') return d.startsWith(lastMonthPrefix);
    if (datePreset === 'custom') {
      const minD = startDate <= endDate ? startDate : endDate;
      const maxD = startDate <= endDate ? endDate : startDate;
      if (minD && d < minD) return false;
      if (maxD && d > maxD) return false;
      return true;
    }
    return false;
  };

  // Check if transaction has order creation OR piutang payment in active date range
  const doesTxMatchDateRange = (t: Transaction): boolean => {
    // 1. Order created in active date range
    if (isDateInActiveRange(getTxDate(t))) return true;
    // 2. Piutang paid date in active date range
    if (t.piutangPaidDate && isDateInActiveRange(t.piutangPaidDate)) return true;
    // 3. Any individual piutang payment in active date range
    if (t.piutangPayments && t.piutangPayments.some((p) => isDateInActiveRange(p.date))) return true;
    return false;
  };

  // Financial breakdown of transaction for the selected date range
  const getTxRangeFinancials = (t: Transaction) => {
    const isOrderInActiveRange = isDateInActiveRange(getTxDate(t));

    // Piutang payments made within this active date range
    const piutangPaymentsInRange = (t.piutangPayments || []).filter((p) =>
      isDateInActiveRange(p.date)
    );

    const piutangCashReceived = piutangPaymentsInRange
      .filter((p) => p.paymentMethod === 'Tunai')
      .reduce((sum, p) => sum + p.amount, 0);

    const piutangNonCashReceived = piutangPaymentsInRange
      .filter((p) => p.paymentMethod !== 'Tunai')
      .reduce((sum, p) => sum + p.amount, 0);

    // Fallback if transaction has piutangPaidDate in range but no piutangPayments array
    let legacyPiutangCash = 0;
    let legacyPiutangNonCash = 0;
    if (
      !isOrderInActiveRange &&
      t.piutangPaidDate &&
      isDateInActiveRange(t.piutangPaidDate) &&
      piutangPaymentsInRange.length === 0
    ) {
      const amount = t.amountPaid || t.total;
      if (t.paymentMethod === 'Tunai') {
        legacyPiutangCash = amount;
      } else {
        legacyPiutangNonCash = amount;
      }
    }

    const totalPiutangCash = piutangCashReceived + legacyPiutangCash;
    const totalPiutangNonCash = piutangNonCashReceived + legacyPiutangNonCash;

    let orderCash = 0;
    let orderNonCash = 0;

    if (isOrderInActiveRange) {
      const isPiutang =
        Boolean(t.remainingAmount && t.remainingAmount > 0) ||
        t.paymentStatus === 'DP' ||
        t.paymentStatus === 'PIUTANG';

      if (!isPiutang && (!t.piutangPayments || t.piutangPayments.length === 0)) {
        if (t.paymentMethod === 'Tunai') {
          orderCash = t.total;
        } else {
          orderNonCash = t.total;
        }
      } else {
        // Initial down payment paid when created
        const allPiutangSum = (t.piutangPayments || []).reduce((sum, p) => sum + p.amount, 0);
        const initialPaid = Math.max(0, (t.amountPaid || 0) - allPiutangSum);
        if (t.paymentMethod === 'Tunai') {
          orderCash = initialPaid;
        } else {
          orderNonCash = initialPaid;
        }
      }
    }

    const totalCash = orderCash + totalPiutangCash;
    const totalNonCash = orderNonCash + totalPiutangNonCash;
    const totalCollected = totalCash + totalNonCash;

    return {
      isOrderInActiveRange,
      hasPiutangPaymentInRange: totalPiutangCash > 0 || totalPiutangNonCash > 0,
      piutangCashReceived: totalPiutangCash,
      piutangNonCashReceived: totalPiutangNonCash,
      orderCash,
      orderNonCash,
      totalCash,
      totalNonCash,
      totalCollected,
      piutangPaymentsInRange
    };
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

  // Available Payment Methods dynamically collected from transaction data + standard POS options
  const availablePaymentMethods = useMemo(() => {
    const set = new Set<string>(['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit']);
    transactions.forEach((t) => {
      if (t.paymentMethod && t.paymentMethod.trim()) {
        set.add(t.paymentMethod.trim());
      }
    });
    return Array.from(set);
  }, [transactions]);

  // Stage 1 Filter: Filter by Date Range, Cashier, Sales, Status, and Search (All except Payment Method)
  const dateFilteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Date range filter: include order creation OR piutang payment in range
      if (!doesTxMatchDateRange(t)) return false;

      // 2. Cashier filter
      if (cashierFilter !== 'all' && t.cashierName !== cashierFilter) {
        return false;
      }

      // 3. Sales filter
      if (salesFilter !== 'all' && t.orderType !== salesFilter) {
        return false;
      }

      // 4. Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }

      // 5. Search query (Invoice, customer, product items, notes, cashier, sales)
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
    thirtyDaysAgoIsoStr,
    currentMonthPrefix,
    lastMonthPrefix,
    startDate,
    endDate,
    cashierFilter,
    salesFilter,
    statusFilter,
    searchQuery
  ]);

  // Performance breakdown by payment method for the active date range (for owner monitoring)
  const paymentMethodStats = useMemo(() => {
    const validTransactions = dateFilteredTransactions.filter((t) => t.status !== 'BATAL');
    const totalDateRevenue = validTransactions.reduce((acc, t) => {
      const fin = getTxRangeFinancials(t);
      return acc + (fin.isOrderInActiveRange ? t.total : fin.totalCollected);
    }, 0);

    const breakdown: Record<string, { total: number; count: number; percent: number }> = {};
    availablePaymentMethods.forEach((m) => {
      breakdown[m] = { total: 0, count: 0, percent: 0 };
    });

    let nonCashTotal = 0;
    let nonCashCount = 0;

    validTransactions.forEach((t) => {
      const fin = getTxRangeFinancials(t);
      if (fin.totalCash > 0) {
        breakdown['Tunai'].total += fin.totalCash;
        breakdown['Tunai'].count += 1;
      }
      if (fin.totalNonCash > 0) {
        const nonMethod = t.paymentMethod !== 'Tunai' ? t.paymentMethod : 'Transfer Bank';
        if (!breakdown[nonMethod]) {
          breakdown[nonMethod] = { total: 0, count: 0, percent: 0 };
        }
        breakdown[nonMethod].total += fin.totalNonCash;
        breakdown[nonMethod].count += 1;
        nonCashTotal += fin.totalNonCash;
        nonCashCount += 1;
      }
    });

    Object.keys(breakdown).forEach((m) => {
      breakdown[m].percent = totalDateRevenue > 0 ? (breakdown[m].total / totalDateRevenue) * 100 : 0;
    });

    const nonCashPercent = totalDateRevenue > 0 ? (nonCashTotal / totalDateRevenue) * 100 : 0;

    return {
      totalRevenue: totalDateRevenue,
      totalCount: validTransactions.length,
      breakdown,
      nonCash: {
        total: nonCashTotal,
        count: nonCashCount,
        percent: nonCashPercent
      }
    };
  }, [dateFilteredTransactions, availablePaymentMethods, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  // Stage 2 Filter: Final transactions filtered by selected Payment Method
  const filteredTransactions = useMemo(() => {
    if (paymentFilter === 'all') return dateFilteredTransactions;
    if (paymentFilter === 'non_cash') {
      return dateFilteredTransactions.filter((t) => {
        const fin = getTxRangeFinancials(t);
        return fin.totalNonCash > 0 || (fin.isOrderInActiveRange && t.paymentMethod !== 'Tunai');
      });
    }
    if (paymentFilter === 'Tunai') {
      return dateFilteredTransactions.filter((t) => {
        const fin = getTxRangeFinancials(t);
        return fin.totalCash > 0 || (fin.isOrderInActiveRange && t.paymentMethod === 'Tunai');
      });
    }
    return dateFilteredTransactions.filter((t) => t.paymentMethod === paymentFilter);
  }, [dateFilteredTransactions, paymentFilter, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  // Aggregate Metrics for Filtered Sales
  const totalRevenue = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const fin = getTxRangeFinancials(t);
      if (fin.isOrderInActiveRange) {
        return acc + t.total;
      }
      return acc + fin.totalCollected;
    }, 0);
  }, [filteredTransactions, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  const totalCost = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const vendorAndShipping = (t.vendorCost || 0) + (t.shippingCost || 0);
      return acc + vendorAndShipping;
    }, 0);
  }, [filteredTransactions]);

  const grossProfit = totalRevenue - totalCost;
  const profitMarginPercent =
    totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';

  const filteredCash = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const fin = getTxRangeFinancials(t);
      return acc + fin.totalCash;
    }, 0);
  }, [filteredTransactions, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  const filteredNonCash = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const fin = getTxRangeFinancials(t);
      return acc + fin.totalNonCash;
    }, 0);
  }, [filteredTransactions, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  // Total cash specifically received from piutang payments on this active date range
  const totalPiutangCashInPeriod = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      const fin = getTxRangeFinancials(t);
      return acc + fin.piutangCashReceived;
    }, 0);
  }, [filteredTransactions, datePreset, todayIsoStr, yesterdayIsoStr, sevenDaysAgoIsoStr, thirtyDaysAgoIsoStr, currentMonthPrefix, lastMonthPrefix, startDate, endDate]);

  // Total remaining piutang across currently filtered transactions
  const totalRemainingPiutang = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      return acc + (t.remainingAmount || 0);
    }, 0);
  }, [filteredTransactions]);

  // Filtered Cash Flow records (Income & Expense) for the active date range
  const filteredCashFlows = useMemo(() => {
    return cashFlowRecords.filter((r) => {
      const recDate = r.date ? r.date.slice(0, 10) : '';
      if (!recDate) return true;
      if (datePreset === 'all') return true;
      if (datePreset === 'today') return recDate === todayIsoStr;
      if (datePreset === 'yesterday') return recDate === yesterdayIsoStr;
      if (datePreset === '7days') return recDate >= sevenDaysAgoIsoStr && recDate <= todayIsoStr;
      if (datePreset === '30days') return recDate >= thirtyDaysAgoIsoStr && recDate <= todayIsoStr;
      if (datePreset === 'month') return recDate.startsWith(currentMonthPrefix);
      if (datePreset === 'lastMonth') return recDate.startsWith(lastMonthPrefix);
      if (datePreset === 'custom' && startDate && endDate) {
        const minD = startDate <= endDate ? startDate : endDate;
        const maxD = startDate <= endDate ? endDate : startDate;
        return recDate >= minD && recDate <= maxD;
      }
      return true;
    });
  }, [
    cashFlowRecords,
    datePreset,
    todayIsoStr,
    yesterdayIsoStr,
    sevenDaysAgoIsoStr,
    thirtyDaysAgoIsoStr,
    currentMonthPrefix,
    lastMonthPrefix,
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
      case '30days':
        return '30 Hari Terakhir';
      case 'month':
        return `Bulan Ini (${monthFormattedText})`;
      case 'lastMonth':
        return `Bulan Lalu (${lastMonthFormattedText})`;
      case 'custom': {
        const minD = startDate <= endDate ? startDate : endDate;
        const maxD = startDate <= endDate ? endDate : startDate;
        return minD === maxD
          ? `Tanggal ${formatSelectedReviewDate(minD)}`
          : `Rentang ${formatSelectedReviewDate(minD)} s/d ${formatSelectedReviewDate(maxD)}`;
      }
      default:
        return 'Semua Penjualan';
    }
  }, [datePreset, startDate, endDate, todayFormattedText, yesterdayFormattedText, monthFormattedText, lastMonthFormattedText]);

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

  // If Admin chose to view Sales Profit Report sub-feature
  if (subTab === 'sales_profit' && isAdmin) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
        {/* Sub-tab Navigation */}
        <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('daily_sales')}
              className="px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>1. Laporan Transaksi &amp; Arus Kas</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('sales_profit')}
              className="px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-[#00871f] text-white shadow-xs"
            >
              <TrendingUp className="w-4 h-4 text-emerald-200" />
              <span>2. Laporan Keuntungan Seluruh Sales</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-white/20 text-white">
                Khusus Admin
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Mode Akses: <strong className="text-emerald-400">Admin / Owner</strong></span>
          </div>
        </div>

        <SalesProfitReportView
          transactions={transactions}
          currentUser={currentUser}
          salesList={salesList}
          onViewReceipt={onViewReceipt}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Sub-tab Navigation (Khusus Admin) */}
      {isAdmin && (
        <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs shrink-0 select-none shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubTab('daily_sales')}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === 'daily_sales'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-slate-200" />
              <span>1. Laporan Transaksi &amp; Arus Kas</span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('sales_profit')}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === 'sales_profit'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>2. Laporan Keuntungan Seluruh Sales</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                Khusus Admin
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Mode Akses: <strong className="text-emerald-400">Admin / Owner</strong></span>
          </div>
        </div>
      )}

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
                  filteredCashFlows,
                  isAdminOrOwner(currentUser)
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
                <span className="font-medium">(+) Pendapatan Lain (Tunai):</span>
                <span className="font-bold">+{reviewDateCashOtherIncome.toLocaleString('id-ID')}</span>
              </div>
              {reviewDateTransferOtherIncome > 0 && (
                <div className="flex justify-between items-center text-[10.5px] text-blue-700 bg-blue-50/70 px-1.5 py-0.5 rounded">
                  <span className="font-medium">ℹ️ Pendapatan (Transfer):</span>
                  <span className="font-bold">{reviewDateTransferOtherIncome.toLocaleString('id-ID')} (Non-Kas)</span>
                </div>
              )}
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

            <div className={`grid grid-cols-2 ${isAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2.5`}>
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
              {isAdmin && (
                <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-medium block">Laba Bersih</span>
                  <span className="text-xs font-bold text-indigo-700">
                    {formatCurrency(netFilteredProfit)}
                  </span>
                </div>
              )}
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

          {/* Bagian 1: Filter Rentang Tanggal (Date Range Filter) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar className="w-4 h-4 text-[#00871f]" />
                <span>Rentang Tanggal Penjualan:</span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-[#00871f] font-semibold border border-emerald-200">
                  {datePresetLabel}
                </span>
              </div>
              {datePreset === 'custom' && (
                <span className="text-[11px] text-slate-500 font-medium">
                  {startDate === endDate
                    ? '1 Hari Terpilih'
                    : `${Math.max(1, Math.round((new Date(endDate >= startDate ? endDate : startDate).getTime() - new Date(endDate >= startDate ? startDate : endDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} Hari Terpilih`}
                </span>
              )}
            </div>

            {/* Tombol Preset Rentang Tanggal */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDatePreset('today');
                  setShowCustomDateInputs(false);
                  setSelectedReviewDate(todayIsoStr);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'today'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('yesterday');
                  setShowCustomDateInputs(false);
                  setSelectedReviewDate(yesterdayIsoStr);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'yesterday'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Kemarin
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('7days');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === '7days'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('30days');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === '30days'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                30 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('month');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'month'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('lastMonth');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'lastMonth'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('all');
                  setShowCustomDateInputs(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  datePreset === 'all'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                Semua Periode
              </button>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('custom');
                  setShowCustomDateInputs(true);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  datePreset === 'custom'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Pilih Rentang Tanggal</span>
              </button>
            </div>

            {/* Drawer Input Rentang Tanggal Kustom (Custom Date Range Picker) */}
            {(datePreset === 'custom' || showCustomDateInputs) && (
              <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl animate-in fade-in zoom-in-95 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
                      Rentang Tanggal Kustom:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-emerald-800">Dari:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          if (!endDate) {
                            setEndDate(e.target.value);
                          }
                          if (e.target.value) {
                            setSelectedReviewDate(e.target.value);
                          }
                        }}
                        className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#00871f] shadow-2xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
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
                        className="bg-white border border-emerald-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-[#00871f] shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Pintasan cepat di dalam picker */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-emerald-700 font-medium">Pintasan:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(todayIsoStr);
                        setEndDate(todayIsoStr);
                        setSelectedReviewDate(todayIsoStr);
                        setDatePreset('today');
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(yesterdayIsoStr);
                        setEndDate(yesterdayIsoStr);
                        setSelectedReviewDate(yesterdayIsoStr);
                        setDatePreset('yesterday');
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      Kemarin
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(sevenDaysAgoIsoStr);
                        setEndDate(todayIsoStr);
                        setDatePreset('custom');
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      7 Hari
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate(thirtyDaysAgoIsoStr);
                        setEndDate(todayIsoStr);
                        setDatePreset('custom');
                      }}
                      className="px-2 py-0.5 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold transition-colors cursor-pointer"
                    >
                      30 Hari
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bagian 2: Filter & Pemantauan Performa Metode Pembayaran (Payment Method Performance Filter) */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <CreditCard className="w-4 h-4 text-indigo-600" />
                <span>Filter &amp; Performa Metode Pembayaran ({datePresetLabel}):</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Omset Terfilter: <strong className="text-slate-800">{formatCurrency(totalRevenue)}</strong> ({filteredTransactions.length} Faktur)
              </span>
            </div>

            {/* Kartu Tab Metode Pembayaran Presisi */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* Tab Semua Metode */}
              <button
                type="button"
                onClick={() => setPaymentFilter('all')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'all'
                    ? 'bg-slate-800 border-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold block truncate">Semua Metode</span>
                  {paymentFilter === 'all' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'all' ? 'text-white' : 'text-slate-900'}`}>
                  {formatCurrency(paymentMethodStats.totalRevenue)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {paymentMethodStats.totalCount} Faktur (100%)
                </span>
              </button>

              {/* Tab Tunai */}
              <button
                type="button"
                onClick={() => setPaymentFilter('Tunai')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'Tunai'
                    ? 'bg-emerald-700 border-emerald-800 text-white shadow-xs'
                    : 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    <Coins className="w-3 h-3 text-amber-500" />
                    Tunai (Cash)
                  </span>
                  {paymentFilter === 'Tunai' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'Tunai' ? 'text-white' : 'text-emerald-900'}`}>
                  {formatCurrency(paymentMethodStats.breakdown['Tunai']?.total || 0)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'Tunai' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                  {paymentMethodStats.breakdown['Tunai']?.count || 0} Faktur ({paymentMethodStats.breakdown['Tunai']?.percent.toFixed(0) || 0}%)
                </span>
              </button>

              {/* Tab QRIS */}
              <button
                type="button"
                onClick={() => setPaymentFilter('QRIS')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'QRIS'
                    ? 'bg-blue-700 border-blue-800 text-white shadow-xs'
                    : 'bg-blue-50/60 hover:bg-blue-100/60 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    <CheckCircle2 className="w-3 h-3 text-blue-500" />
                    QRIS
                  </span>
                  {paymentFilter === 'QRIS' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'QRIS' ? 'text-white' : 'text-blue-900'}`}>
                  {formatCurrency(paymentMethodStats.breakdown['QRIS']?.total || 0)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'QRIS' ? 'text-blue-100' : 'text-blue-700'}`}>
                  {paymentMethodStats.breakdown['QRIS']?.count || 0} Faktur ({paymentMethodStats.breakdown['QRIS']?.percent.toFixed(0) || 0}%)
                </span>
              </button>

              {/* Tab Transfer Bank */}
              <button
                type="button"
                onClick={() => setPaymentFilter('Transfer Bank')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'Transfer Bank'
                    ? 'bg-indigo-700 border-indigo-800 text-white shadow-xs'
                    : 'bg-indigo-50/60 hover:bg-indigo-100/60 border-indigo-200 text-indigo-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    <ArrowUpRight className="w-3 h-3 text-indigo-500" />
                    Transfer Bank
                  </span>
                  {paymentFilter === 'Transfer Bank' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'Transfer Bank' ? 'text-white' : 'text-indigo-900'}`}>
                  {formatCurrency(paymentMethodStats.breakdown['Transfer Bank']?.total || 0)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'Transfer Bank' ? 'text-indigo-100' : 'text-indigo-700'}`}>
                  {paymentMethodStats.breakdown['Transfer Bank']?.count || 0} Faktur ({paymentMethodStats.breakdown['Transfer Bank']?.percent.toFixed(0) || 0}%)
                </span>
              </button>

              {/* Tab Kartu Debit */}
              <button
                type="button"
                onClick={() => setPaymentFilter('Kartu Debit')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'Kartu Debit'
                    ? 'bg-purple-700 border-purple-800 text-white shadow-xs'
                    : 'bg-purple-50/60 hover:bg-purple-100/60 border-purple-200 text-purple-950'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    <CreditCard className="w-3 h-3 text-purple-500" />
                    Kartu Debit
                  </span>
                  {paymentFilter === 'Kartu Debit' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'Kartu Debit' ? 'text-white' : 'text-purple-900'}`}>
                  {formatCurrency(paymentMethodStats.breakdown['Kartu Debit']?.total || 0)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'Kartu Debit' ? 'text-purple-100' : 'text-purple-700'}`}>
                  {paymentMethodStats.breakdown['Kartu Debit']?.count || 0} Faktur ({paymentMethodStats.breakdown['Kartu Debit']?.percent.toFixed(0) || 0}%)
                </span>
              </button>

              {/* Tab Semua Non-Tunai */}
              <button
                type="button"
                onClick={() => setPaymentFilter('non_cash')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  paymentFilter === 'non_cash'
                    ? 'bg-amber-700 border-amber-800 text-white shadow-xs'
                    : 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200 text-amber-950'
                }`}
                title="Saring gabungan semua transaksi non-tunai (QRIS + Transfer + Debit)"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1 truncate">
                    <SlidersHorizontal className="w-3 h-3 text-amber-600" />
                    Semua Non-Tunai
                  </span>
                  {paymentFilter === 'non_cash' && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                </div>
                <span className={`text-xs font-extrabold block truncate ${paymentFilter === 'non_cash' ? 'text-white' : 'text-amber-900'}`}>
                  {formatCurrency(paymentMethodStats.nonCash.total)}
                </span>
                <span className={`text-[10px] block mt-0.5 font-medium ${paymentFilter === 'non_cash' ? 'text-amber-100' : 'text-amber-700'}`}>
                  {paymentMethodStats.nonCash.count} Faktur ({paymentMethodStats.nonCash.percent.toFixed(0)}%)
                </span>
              </button>
            </div>
          </div>

          {/* Bagian 3: Search, Filter Sales, Kasir, Dropdown Pembayaran & Status Pesanan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1 border-t border-slate-100">
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
                <option value="all">Semua Kasir &amp; Operator</option>
                {availableCashiers.map((c) => (
                  <option key={c} value={c}>
                    Kasir: {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Metode Pembayaran Dropdown */}
            <div>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              >
                <option value="all">Semua Metode Pembayaran</option>
                <option value="Tunai">Tunai (Cash)</option>
                <option value="QRIS">QRIS</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Kartu Debit">Kartu Debit</option>
                <option value="non_cash">Semua Non-Tunai (Gabungan)</option>
                {availablePaymentMethods
                  .filter((m) => !['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit'].includes(m))
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
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

          {/* Bagian 4: Tag Filter Aktif (Active Filter Chips) */}
          {isCustomFiltered && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Filter Diterapkan:</span>

              {datePreset !== 'today' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  <Calendar className="w-3 h-3" />
                  Periode: {datePresetLabel}
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('today');
                      setStartDate(todayIsoStr);
                      setEndDate(todayIsoStr);
                      setSelectedReviewDate(todayIsoStr);
                    }}
                    className="hover:text-emerald-950 font-bold ml-0.5 cursor-pointer"
                    title="Hapus filter periode"
                  >
                    ×
                  </button>
                </span>
              )}

              {paymentFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold border border-blue-200">
                  <CreditCard className="w-3 h-3" />
                  Metode: {paymentFilter === 'non_cash' ? 'Semua Non-Tunai' : paymentFilter}
                  <button
                    type="button"
                    onClick={() => setPaymentFilter('all')}
                    className="hover:text-blue-950 font-bold ml-0.5 cursor-pointer"
                    title="Hapus filter metode bayar"
                  >
                    ×
                  </button>
                </span>
              )}

              {salesFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-semibold border border-indigo-200">
                  Sales: {salesFilter}
                  <button
                    type="button"
                    onClick={() => setSalesFilter('all')}
                    className="hover:text-indigo-950 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              {cashierFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-200">
                  Kasir: {cashierFilter}
                  <button
                    type="button"
                    onClick={() => setCashierFilter('all')}
                    className="hover:text-amber-950 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              {statusFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-semibold">
                  Status: {statusFilter}
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="hover:text-slate-950 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              {searchQuery.trim() !== '' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[11px] font-semibold border border-purple-200">
                  <Search className="w-3 h-3" />
                  "{searchQuery}"
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:text-purple-950 font-bold ml-0.5 cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-1"
              >
                Reset Semua
              </button>
            </div>
          )}
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

        {/* Informative Banner: Penerimaan Pembayaran Tunai Piutang pada Tanggal Ini */}
        {totalPiutangCashInPeriod > 0 && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-200/80 text-[#00871f] flex items-center justify-center font-bold shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800">
                  Penerimaan Pembayaran Tunai Piutang pada Periode Ini:
                </p>
                <p className="text-[11px] text-emerald-800">
                  Uang tunai sebesar <strong>{formatCurrency(totalPiutangCashInPeriod)}</strong> dari pembayaran sisa piutang telah otomatis ditambahkan ke Total Penjualan &amp; Kas Tunai Harian.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-white border border-emerald-300 font-black text-[#00871f] text-xs">
              +{formatCurrency(totalPiutangCashInPeriod)} Kas Tunai
            </span>
          </div>
        )}

        {/* Transactions Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-800">
                Daftar Transaksi Penjualan
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {filteredTransactions.length} Data
              </span>
              {paymentFilter !== 'all' && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                  Metode: {paymentFilter === 'non_cash' ? 'Semua Non-Tunai' : paymentFilter}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Periode: <strong>{datePresetLabel}</strong></span>
              <span>•</span>
              <span>Total Omset: <strong className="text-slate-900 font-bold">{formatCurrency(totalRevenue)}</strong></span>
            </div>
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
                  <th className="py-2.5 px-3 text-right">Total Faktur</th>
                  <th className="py-2.5 px-3 text-right">Sisa Pembayaran Piutang</th>
                  <th className="py-2.5 px-3 text-center">Tanggal</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-10 text-center text-slate-400">
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
                  filteredTransactions.map((t) => {
                    const fin = getTxRangeFinancials(t);
                    const isPiutang = Boolean(t.remainingAmount && t.remainingAmount > 0);
                    const hasSettledPiutang = Boolean(
                      t.piutangPayments &&
                        t.piutangPayments.length > 0 &&
                        (!t.remainingAmount || t.remainingAmount <= 0)
                    );

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#00871f]">
                          {t.invoiceNo}
                          {fin.piutangCashReceived > 0 && (
                            <span className="block mt-0.5 text-[9px] font-sans font-bold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded w-fit">
                              +Bayar Tunai pd Tgl Ini
                            </span>
                          )}
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
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                              {t.orderType === 'Pendapatan Lain' ? '⭐ Pendapatan Lain' : `Sales: ${t.orderType}`}
                            </span>
                            {t.vendorName && (isAdminOrOwner(currentUser) || currentUser.role === 'kasir') && (
                              <span
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                                title="Preview Nama Vendor (Khusus Admin & Kasir - Tidak Dicetak)"
                              >
                                <Building2 className="w-2.5 h-2.5 text-[#00871f]" />
                                Vendor: {t.vendorName}
                              </span>
                            )}
                          </div>
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
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.paymentMethod === 'Tunai'
                                ? 'bg-emerald-100 text-emerald-800'
                                : t.paymentMethod === 'QRIS'
                                ? 'bg-blue-100 text-blue-800'
                                : t.paymentMethod === 'Transfer Bank'
                                ? 'bg-indigo-100 text-indigo-800'
                                : t.paymentMethod === 'Kartu Debit'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {t.paymentMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="font-bold text-slate-900 block">{formatCurrency(t.total)}</span>
                          {isAdminOrOwner(currentUser) && (
                            <span
                              className="inline-block text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1 py-0.2 rounded mt-0.5"
                              title={`Hasil Keuntungan: Total (${formatCurrency(t.total)}) - [Vendor (${formatCurrency(t.vendorCost || 0)}) + Ongkir (${formatCurrency(t.shippingCost || 0)})]`}
                            >
                              Laba: {formatCurrency(calculateProfit(t.total, t.vendorCost || 0, t.shippingCost || 0))}
                            </span>
                          )}
                        </td>

                        {/* Kolom 1: Sisa Pembayaran Piutang */}
                        <td className="py-2.5 px-3 text-right">
                          {isPiutang ? (
                            <div>
                              <span className="font-black text-rose-600 block text-xs">
                                {formatCurrency(t.remainingAmount || 0)}
                              </span>
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold inline-block">
                                {t.amountPaid > 0 ? 'DP / Kurang' : 'Belum Bayar'}
                              </span>
                            </div>
                          ) : hasSettledPiutang ? (
                            <div>
                              <span className="font-bold text-emerald-700 block text-xs">
                                Rp 0
                              </span>
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold inline-block">
                                Lunas
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
                        </td>

                        {/* Kolom 2: Tanggal Pembayaran / Pelunasan Piutang */}
                        <td className="py-2.5 px-3 text-center">
                          {t.piutangPaidDate || (t.piutangPayments && t.piutangPayments.length > 0) ? (
                            <div>
                              <span className="font-mono text-[11px] font-bold text-slate-800 block">
                                {t.piutangPaidDate || t.piutangPayments![t.piutangPayments!.length - 1].date}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 mt-0.5">
                                <Calendar className="w-2.5 h-2.5 text-[#00871f]" />
                                {t.piutangPayments?.[t.piutangPayments.length - 1]?.paymentMethod === 'Tunai'
                                  ? 'Bayar Tunai'
                                  : (t.piutangPayments?.[t.piutangPayments.length - 1]?.paymentMethod || 'Bayar Piutang')}
                              </span>
                            </div>
                          ) : isPiutang ? (
                            <div>
                              <span className="font-mono text-[11px] text-amber-700 font-semibold block">
                                {t.dueDate || '-'}
                              </span>
                              <span className="text-[9.5px] text-amber-600 block">
                                (Jatuh Tempo)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono">-</span>
                          )}
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
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* Tombol Bayar / Pelunasan Piutang jika ada sisa piutang */}
                            {isPiutang && onPayPiutang && (
                              <button
                                type="button"
                                onClick={() => onPayPiutang(t)}
                                title="Bayar / Pelunasan Sisa Piutang (Tunai / Non-Tunai)"
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-[#00871f] border border-emerald-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shrink-0 shadow-2xs"
                              >
                                <Wallet className="w-3 h-3 text-[#00871f]" />
                                <span>Bayar Piutang</span>
                              </button>
                            )}

                            {/* Tombol Revisi: Khusus Pendapatan Lain vs Faktur Biasa */}
                            {t.orderType === 'Pendapatan Lain' || t.invoiceNo.startsWith('PL-') ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const cf = cashFlowRecords.find(
                                    (c) => c.transactionId === t.id || c.id === t.id
                                  );
                                  if (cf) {
                                    setRevisingCashFlow(cf);
                                  } else {
                                    setRevisingCashFlow({
                                      id: `cf-${t.id}`,
                                      transactionId: t.id,
                                      type: 'INCOME',
                                      category: t.items[0]?.name || 'Pendapatan Lain',
                                      amount: t.total,
                                      description: t.notes || '',
                                      date: t.date,
                                      recordedBy: t.cashierName,
                                      paymentMethod: t.paymentMethod === 'Tunai' ? 'TUNAI' : 'TRANSFER'
                                    });
                                  }
                                  setShowReviseCashFlowModal(true);
                                }}
                                title="Revisi Pendapatan Lain"
                                className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-[#00871f] border border-emerald-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <FileEdit className="w-3 h-3 text-[#00871f]" />
                                <span>Revisi</span>
                              </button>
                            ) : onReviseInvoice && (
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
                              onClick={() => setPrintModalTx(t)}
                              title="Cetak Struk Langsung ke Printer"
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
                    );
                  })
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
                    <td className="py-3 px-3 text-right">
                      <span className="text-xs font-black text-rose-600 block">
                        {formatCurrency(totalRemainingPiutang)}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-normal">Sisa Piutang</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      {totalPiutangCashInPeriod > 0 ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                          +{formatCurrency(totalPiutangCashInPeriod)} Kas
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">-</span>
                      )}
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
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800">{formatCurrency(filteredCash)}</span>
                    {totalPiutangCashInPeriod > 0 && (
                      <span
                        className="text-[9.5px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold"
                        title={`Termasuk ${formatCurrency(totalPiutangCashInPeriod)} dari pelunasan piutang tunai pada tanggal ini`}
                      >
                        +{formatCurrency(totalPiutangCashInPeriod)} Piutang
                      </span>
                    )}
                  </div>
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
                    filteredCashFlows,
                    isAdminOrOwner(currentUser)
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
                              filteredCashFlows,
                              isAdminOrOwner(currentUser)
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

            <div className="flex items-center gap-2 flex-wrap">
              {onAddCashFlow && (
                <div className="flex items-center gap-1.5 mr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCashFlowDateInput(todayIsoStr);
                      setCashFlowCategoryInput('Jasa Desain Tambahan');
                      setCashFlowAmountInput(50000);
                      setCashFlowMethodInput('TUNAI');
                      setCashFlowDescInput('');
                      setShowAddIncomeModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-[#00871f] hover:bg-[#007019] text-white font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>+ Pendapatan Lain</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashFlowDateInput(todayIsoStr);
                      setCashFlowCategoryInput('Bahan Baku & Tinta');
                      setCashFlowAmountInput(50000);
                      setCashFlowDescInput('');
                      setShowAddExpenseModal(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-all"
                  >
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>- Pengeluaran Toko</span>
                  </button>
                </div>
              )}

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
                    <th className="py-2.5 px-3">Metode Kas</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Dicatat Oleh</th>
                    <th className="py-2.5 px-3 text-center">Aksi Revisi</th>
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
                        <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                          {record.category}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isIncome ? (
                            record.paymentMethod === 'TRANSFER' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <CreditCard className="w-3 h-3 text-blue-600" />
                                Transfer (Rekening)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Coins className="w-3 h-3 text-emerald-600" />
                                Tunai (Kas Toko)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <Coins className="w-3 h-3 text-rose-600" />
                              Kas Toko
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
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
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRevisingCashFlow(record);
                                setShowReviseCashFlowModal(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00871f] font-bold text-[10.5px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-emerald-200 shadow-2xs"
                              title="Revisi / Edit Data Ini"
                            >
                              <FileEdit className="w-3 h-3" />
                              <span>Revisi</span>
                            </button>
                            {onDeleteCashFlow && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Yakin ingin menghapus catatan ${
                                        record.type === 'INCOME' ? 'pendapatan' : 'pengeluaran'
                                      } sebesar ${formatCurrency(record.amount)}?`
                                    )
                                  ) {
                                    onDeleteCashFlow(record.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* Direct Printer Modal */}
      <PrintReceiptModal
        transaction={printModalTx}
        isOpen={Boolean(printModalTx)}
        onClose={() => setPrintModalTx(null)}
      />

      {/* Modal: Revisi Pendapatan Lain / Pengeluaran Toko */}
      <ReviseCashFlowModal
        isOpen={showReviseCashFlowModal}
        onClose={() => {
          setShowReviseCashFlowModal(false);
          setRevisingCashFlow(null);
        }}
        record={revisingCashFlow}
        onSaveRevision={(updated) => {
          if (onUpdateCashFlow) {
            onUpdateCashFlow(updated);
          }
        }}
        onDeleteRecord={(recId) => {
          if (onDeleteCashFlow) {
            onDeleteCashFlow(recId);
          }
        }}
        currentUser={currentUser}
      />

      {/* Modal: Tambah Pendapatan Lain (Langsung dari Laporan) */}
      {showAddIncomeModal && onAddCashFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Catat Pendapatan Lain
              </h3>
              <button
                type="button"
                onClick={() => setShowAddIncomeModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cashFlowAmountInput <= 0) return;
                const nowTime = new Date().toTimeString().slice(0, 5);
                const fullDate = `${cashFlowDateInput} ${nowTime}`;
                onAddCashFlow({
                  type: 'INCOME',
                  category: cashFlowCategoryInput,
                  amount: Number(cashFlowAmountInput),
                  description: cashFlowDescInput.trim() || 'Pendapatan lain-lain',
                  date: fullDate,
                  paymentMethod: cashFlowMethodInput,
                  recordedBy: currentUser.name
                });
                setShowAddIncomeModal(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tanggal Pendapatan *
                </label>
                <input
                  type="date"
                  required
                  value={cashFlowDateInput}
                  onChange={(e) => setCashFlowDateInput(e.target.value)}
                  className="w-full text-xs font-bold text-emerald-800 bg-emerald-50/50 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Pendapatan
                </label>
                <select
                  value={cashFlowCategoryInput}
                  onChange={(e) => setCashFlowCategoryInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="Jasa Desain Tambahan">Jasa Desain Tambahan</option>
                  <option value="Ongkos Kirim / Ekspedisi">Ongkos Kirim / Ekspedisi</option>
                  <option value="Jasa Maklon Cetak">Jasa Maklon Cetak</option>
                  <option value="Pendapatan Sewa / Lainnya">Pendapatan Sewa / Lainnya</option>
                </select>
              </div>

              {/* Opsi Penerimaan: Transfer / Tunai */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Opsi Penerimaan Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashFlowMethodInput('TUNAI')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      cashFlowMethodInput === 'TUNAI'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      <span>💵 Tunai</span>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-1 leading-tight">
                      Ditambahkan ke kas toko per hari tgl input &amp; masuk daftar transaksi
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashFlowMethodInput('TRANSFER')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      cashFlowMethodInput === 'TRANSFER'
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>💳 Transfer</span>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-1 leading-tight">
                      Tercatat di daftar transaksi, TIDAK ditambahkan ke kas fisik
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal (Rp) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={cashFlowAmountInput}
                  onChange={(e) => setCashFlowAmountInput(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={cashFlowDescInput}
                  onChange={(e) => setCashFlowDescInput(e.target.value)}
                  placeholder="Misal: Biaya vector logo manual"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddIncomeModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Pendapatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Tambah Pengeluaran Toko (Langsung dari Laporan) */}
      {showAddExpenseModal && onAddCashFlow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MinusCircle className="w-4 h-4 text-rose-600" />
                Catat Pengeluaran Toko
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (cashFlowAmountInput <= 0) return;
                const nowTime = new Date().toTimeString().slice(0, 5);
                const fullDate = `${cashFlowDateInput} ${nowTime}`;
                onAddCashFlow({
                  type: 'EXPENSE',
                  category: cashFlowCategoryInput || 'Bahan Baku & Tinta',
                  amount: Number(cashFlowAmountInput),
                  description: cashFlowDescInput.trim() || 'Operasional / Pengeluaran toko',
                  date: fullDate,
                  paymentMethod: 'TUNAI',
                  recordedBy: currentUser.name
                });
                setShowAddExpenseModal(false);
                setCashFlowDescInput('');
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tanggal Pengeluaran *
                </label>
                <input
                  type="date"
                  required
                  value={cashFlowDateInput}
                  onChange={(e) => setCashFlowDateInput(e.target.value)}
                  className="w-full text-xs font-bold text-rose-800 bg-rose-50/50 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Otomatis memotong saldo kas toko tanggal transaksi ini
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Biaya
                </label>
                <select
                  value={cashFlowCategoryInput}
                  onChange={(e) => setCashFlowCategoryInput(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="Bahan Baku & Tinta">Bahan Baku &amp; Tinta Sablon</option>
                  <option value="Listrik & Operasional">Listrik &amp; Operasional</option>
                  <option value="Gaji / Uang Makan Staf">Gaji / Uang Makan Staf</option>
                  <option value="Maintenance Mesin Sablon">Maintenance Mesin Sablon</option>
                  <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal Pengeluaran (Rp) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={cashFlowAmountInput}
                  onChange={(e) => setCashFlowAmountInput(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan Pembelian / Pengeluaran
                </label>
                <input
                  type="text"
                  value={cashFlowDescInput}
                  onChange={(e) => setCashFlowDescInput(e.target.value)}
                  placeholder="Misal: Beli tinta plastisol hitam 1kg"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
