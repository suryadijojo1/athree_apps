import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Search,
  Filter,
  Eye,
  Printer,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Check,
  FileEdit,
  Trash2,
  LayoutGrid,
  List,
  X,
  MessageCircle,
  User as UserIcon,
  ShoppingBag,
  Info,
  CalendarDays,
  FileText,
  TrendingUp,
  Truck,
  Lock,
  Edit3,
  Wallet,
  SlidersHorizontal,
  RotateCcw,
  Download,
  Building2,
  Image as ImageIcon,
  Maximize2
} from 'lucide-react';
import type { Transaction, OrderStatus, User as UserType } from '../types';
import { formatCurrency, downloadTransactionReceiptPDF } from '../utils/exportUtils';
import { printTransactionDirectly } from '../utils/printUtils';
import { PrintReceiptModal } from './PrintReceiptModal';
import { MockupPreviewModal } from './MockupPreviewModal';
import { calculateProfit, calculateProfitMargin } from '../utils/profitUtils';
import { compareTransactionsByLatestDate } from '../utils/transactionUtils';

interface ProductionOrdersViewProps {
  transactions: Transaction[];
  onUpdateOrderStatus: (transactionId: string, status: OrderStatus) => void;
  onUpdateDueDate: (transactionId: string, newDueDate: string) => void;
  onUpdateCosts?: (transactionId: string, vendorCost: number, shippingCost: number, vendorName?: string) => void;
  onViewReceipt: (transaction: Transaction) => void;
  onReviseInvoice?: (transaction: Transaction) => void;
  onDeleteInvoice?: (transaction: Transaction) => void;
  onBatchDeleteInvoices?: (transactionIds: string[]) => void;
  onBatchUpdateOrderStatus?: (transactionIds: string[], status: OrderStatus) => void;
  onPayPiutang?: (transaction: Transaction) => void;
  isAdmin?: boolean;
  currentUser?: UserType;
  canViewVendor?: boolean;
}

export const ProductionOrdersView: React.FC<ProductionOrdersViewProps> = ({
  transactions,
  onUpdateOrderStatus,
  onUpdateDueDate,
  onUpdateCosts,
  onViewReceipt,
  onReviseInvoice,
  onDeleteInvoice,
  onBatchDeleteInvoices,
  onBatchUpdateOrderStatus,
  onPayPiutang,
  isAdmin = false,
  currentUser,
  canViewVendor
}) => {
  const canViewVendorResolved = canViewVendor ?? (isAdmin || currentUser?.role === 'kasir' || currentUser?.role === 'admin');

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDueDateTx, setEditingDueDateTx] = useState<Transaction | null>(null);
  const [tempDueDate, setTempDueDate] = useState('');

  // Comprehensive Filter Menu states for Admin/Owner
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [filterDueDateWindow, setFilterDueDateWindow] = useState<'ALL' | 'OVERDUE' | 'TODAY' | 'TOMORROW' | 'NEXT_3_DAYS' | 'THIS_WEEK' | 'THIS_MONTH'>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'ALL' | 'LUNAS' | 'PIUTANG'>('ALL');
  const [filterSales, setFilterSales] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_MONTH' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DUE_DATE_ASC' | 'DUE_DATE_DESC' | 'TOTAL_DESC' | 'PIUTANG_DESC'>('DATE_DESC');

  // Direct Printer Modal State
  const [printModalTx, setPrintModalTx] = useState<Transaction | null>(null);
  
  // View mode: Grid vs List (default to list as requested)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('athree_production_view_mode');
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });

  // Preview Modal state
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [viewingMockupTx, setViewingMockupTx] = useState<Transaction | null>(null);
  const [isEditingCosts, setIsEditingCosts] = useState<boolean>(false);
  const [tempVendorCost, setTempVendorCost] = useState<number>(0);
  const [tempShippingCost, setTempShippingCost] = useState<number>(0);
  const [tempVendorName, setTempVendorName] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('athree_production_view_mode', viewMode);
  }, [viewMode]);

  // Keep previewTx in sync when transactions update, and sync cost states
  useEffect(() => {
    if (previewTx) {
      const updated = transactions.find((t) => t.id === previewTx.id);
      if (updated) {
        setPreviewTx(updated);
        if (!isEditingCosts) {
          setTempVendorCost(updated.vendorCost || 0);
          setTempShippingCost(updated.shippingCost || 0);
          setTempVendorName(updated.vendorName || '');
        }
      }
    }
  }, [transactions]);

  // Reset cost editing when preview modal opens with a new transaction
  useEffect(() => {
    if (previewTx) {
      setTempVendorCost(previewTx.vendorCost || 0);
      setTempShippingCost(previewTx.shippingCost || 0);
      setTempVendorName(previewTx.vendorName || '');
      setIsEditingCosts(false);
    }
  }, [previewTx?.id]);

  // Multi-Invoice Selection States (Permasalahan 2)
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [batchStatusValue, setBatchStatusValue] = useState<OrderStatus>('Sedang Dikerjakan');
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  // Helper to calculate days remaining
  const getDaysDiff = (dueDateStr: string) => {
    if (!dueDateStr) return null;
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueParts = dueDateStr.split(' ')[0].split('-');
    if (dueParts.length < 3) return null;
    const dueZero = new Date(parseInt(dueParts[0], 10), parseInt(dueParts[1], 10) - 1, parseInt(dueParts[2], 10));
    const diffTime = dueZero.getTime() - todayZero.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Distinct sales / pic list from transactions
  const availableSales = useMemo(() => {
    const set = new Set<string>();
    (transactions || []).forEach((t) => {
      if (!t) return;
      if (t.orderType) set.add(t.orderType);
      if (t.cashierName) set.add(t.cashierName);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [transactions]);

  // Count active custom filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStatus !== 'ALL') count++;
    if (filterDueDateWindow !== 'ALL') count++;
    if (filterPaymentStatus !== 'ALL') count++;
    if (filterSales !== 'ALL') count++;
    if (filterDateRange !== 'ALL') count++;
    if (sortBy !== 'DATE_DESC') count++;
    return count;
  }, [filterStatus, filterDueDateWindow, filterPaymentStatus, filterSales, filterDateRange, sortBy]);

  const handleResetFilters = () => {
    setFilterStatus('ALL');
    setFilterDueDateWindow('ALL');
    setFilterPaymentStatus('ALL');
    setFilterSales('ALL');
    setFilterDateRange('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('DATE_DESC');
    setSearchQuery('');
  };

  // Filter and sort transactions
  const filteredList = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;

    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d7Time = d7.getTime();

    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const list = (transactions || []).filter((t) => {
      if (!t || typeof t !== 'object') return false;
      const q = searchQuery.toLowerCase().trim();
      const invoiceNo = t.invoiceNo || '';
      const custName = t.customer?.name || '';
      const custPhone = t.customer?.phone || '';
      const notes = t.notes || '';
      const items = Array.isArray(t.items) ? t.items : [];

      const matchesSearch =
        !q ||
        invoiceNo.toLowerCase().includes(q) ||
        custName.toLowerCase().includes(q) ||
        (custPhone && custPhone.toLowerCase().includes(q)) ||
        notes.toLowerCase().includes(q) ||
        items.some((i) => (i?.name || '').toLowerCase().includes(q) || (i?.notes && i.notes.toLowerCase().includes(q)));

      if (!matchesSearch) return false;

      const days = getDaysDiff(t.dueDate);

      // Status filter
      if (filterStatus === 'IN_PROGRESS') {
        if (t.status !== 'Sedang Dikerjakan' && t.status !== 'Menunggu') return false;
      } else if (filterStatus === 'COMPLETED') {
        if (t.status !== 'Selesai') return false;
      } else if (filterStatus === 'OVERDUE') {
        if (t.status === 'Selesai' || days === null || days >= 0) return false;
      }

      // Due Date Window filter
      if (filterDueDateWindow === 'OVERDUE') {
        if (t.status === 'Selesai' || days === null || days >= 0) return false;
      } else if (filterDueDateWindow === 'TODAY') {
        if (days === null || days !== 0) return false;
      } else if (filterDueDateWindow === 'TOMORROW') {
        if (days === null || days !== 1) return false;
      } else if (filterDueDateWindow === 'NEXT_3_DAYS') {
        if (days === null || days < 0 || days > 3) return false;
      } else if (filterDueDateWindow === 'THIS_WEEK') {
        if (days === null || days < 0 || days > 7) return false;
      } else if (filterDueDateWindow === 'THIS_MONTH') {
        const dDate = t.dueDate ? t.dueDate.split(' ')[0] : '';
        if (!dDate.startsWith(currentMonthPrefix)) return false;
      }

      // Payment Status filter
      const isPiutang = Boolean((t.remainingAmount && t.remainingAmount > 0) || t.paymentStatus === 'PIUTANG' || t.paymentStatus === 'DP');
      if (filterPaymentStatus === 'LUNAS') {
        if (isPiutang) return false;
      } else if (filterPaymentStatus === 'PIUTANG') {
        if (!isPiutang) return false;
      }

      // Sales / Penanggung Jawab filter
      if (filterSales !== 'ALL') {
        const matchesSales = t.orderType === filterSales || t.cashierName === filterSales;
        if (!matchesSales) return false;
      }

      // Order Entry Date filter
      const txDate = t.date ? t.date.split(' ')[0] : (t.createdAt ? t.createdAt.slice(0, 10) : '');
      if (filterDateRange === 'TODAY') {
        if (!txDate.startsWith(todayStr)) return false;
      } else if (filterDateRange === 'YESTERDAY') {
        if (!txDate.startsWith(yestStr)) return false;
      } else if (filterDateRange === 'LAST_7_DAYS') {
        const tTime = new Date(txDate).getTime();
        if (isNaN(tTime) || tTime < d7Time) return false;
      } else if (filterDateRange === 'THIS_MONTH') {
        if (!txDate.startsWith(currentMonthPrefix)) return false;
      } else if (filterDateRange === 'CUSTOM') {
        if (customStartDate && txDate < customStartDate) return false;
        if (customEndDate && txDate > customEndDate) return false;
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'DUE_DATE_ASC') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === 'DUE_DATE_DESC') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      }
      if (sortBy === 'DATE_DESC') {
        return compareTransactionsByLatestDate(a, b);
      }
      if (sortBy === 'TOTAL_DESC') {
        return b.total - a.total;
      }
      if (sortBy === 'PIUTANG_DESC') {
        return (b.remainingAmount || 0) - (a.remainingAmount || 0);
      }
      return compareTransactionsByLatestDate(a, b);
    });

    return list;
  }, [
    transactions,
    filterStatus,
    filterDueDateWindow,
    filterPaymentStatus,
    filterSales,
    filterDateRange,
    customStartDate,
    customEndDate,
    sortBy,
    searchQuery
  ]);

  // Urgent / Overdue count
  const overdueCount = (transactions || []).filter((t) => {
    if (!t) return false;
    const days = getDaysDiff(t.dueDate);
    return t.status !== 'Selesai' && days !== null && days < 0;
  }).length;

  const inProgressCount = (transactions || []).filter(
    (t) => t && (t.status === 'Sedang Dikerjakan' || t.status === 'Menunggu')
  ).length;

  const completedCount = (transactions || []).filter((t) => t && t.status === 'Selesai').length;

  // Multi-Invoice Selection Handlers
  const toggleSelectInvoice = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllFilteredSelected = useMemo(() => {
    return filteredList.length > 0 && filteredList.every((t) => selectedInvoiceIds.has(t.id));
  }, [filteredList, selectedInvoiceIds]);

  const toggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(filteredList.map((t) => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedInvoiceIds(new Set());
  };

  const handleApplyBatchStatus = () => {
    if (selectedInvoiceIds.size === 0) return;
    if (onBatchUpdateOrderStatus) {
      onBatchUpdateOrderStatus(Array.from(selectedInvoiceIds), batchStatusValue);
    } else {
      selectedInvoiceIds.forEach((id) => onUpdateOrderStatus(id, batchStatusValue));
    }
    clearSelection();
  };

  const handleConfirmBatchDelete = () => {
    if (selectedInvoiceIds.size === 0) return;
    if (onBatchDeleteInvoices) {
      onBatchDeleteInvoices(Array.from(selectedInvoiceIds));
    } else if (onDeleteInvoice) {
      const toDelete = transactions.filter((t) => selectedInvoiceIds.has(t.id));
      toDelete.forEach((t) => onDeleteInvoice(t));
    }
    clearSelection();
    setShowBatchDeleteConfirm(false);
  };

  const handleBatchPrint = () => {
    const selectedTxs = transactions.filter((t) => selectedInvoiceIds.has(t.id));
    if (selectedTxs.length === 0) return;
    selectedTxs.forEach((tx) => {
      printTransactionDirectly(tx);
    });
  };

  const handleBatchDownloadPDF = async () => {
    const selectedTxs = transactions.filter((t) => selectedInvoiceIds.has(t.id));
    if (selectedTxs.length === 0) return;
    setIsExportingBatch(true);
    try {
      for (const tx of selectedTxs) {
        await downloadTransactionReceiptPDF(tx);
      }
    } catch (err) {
      console.warn('Batch PDF export warning:', err);
    } finally {
      setIsExportingBatch(false);
    }
  };

  const handleSaveDueDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDueDateTx || !tempDueDate) return;
    const formattedDate = tempDueDate.replace('T', ' ');
    onUpdateDueDate(editingDueDateTx.id, formattedDate);
    if (previewTx && previewTx.id === editingDueDateTx.id) {
      setPreviewTx({
        ...previewTx,
        dueDate: formattedDate
      });
    }
    setEditingDueDateTx(null);
  };

  const handleOpenWhatsApp = (phone: string, customerName: string, invoiceNo: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }
    const message = encodeURIComponent(
      `Halo Kak ${customerName}, kami dari Athree Studio Jayapura mengenai pesanan No Faktur: ${invoiceNo}.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#00871f]" />
              Jadwal & Jatuh Tempo Penyelesaian Pesanan
            </h2>
            <p className="text-xs text-slate-500">
              Pelacakan deadline produksi sablon, jersey, mug, dan pesanan custom pelanggan
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>{inProgressCount} Dalam Pengerjaan</span>
            </span>

            {overdueCount > 0 && (
              <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>{overdueCount} Lewat Jatuh Tempo</span>
              </span>
            )}

            <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{completedCount} Selesai</span>
            </span>
          </div>
        </div>

        {/* Filter & View Mode Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Pesanan ({transactions.length})
            </button>
            <button
              onClick={() => setFilterStatus('IN_PROGRESS')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                filterStatus === 'IN_PROGRESS'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dalam Antrean ({inProgressCount})
            </button>
            <button
              onClick={() => setFilterStatus('OVERDUE')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                filterStatus === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 hover:bg-rose-50'
              }`}
            >
              Lewat Deadline ({overdueCount})
            </button>
            <button
              onClick={() => setFilterStatus('COMPLETED')}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                filterStatus === 'COMPLETED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selesai Diambil ({completedCount})
            </button>
          </div>

          {/* Right controls: Filter Toggle, View Mode Switcher & Search Bar */}
          <div className="flex items-center gap-2">
            {/* Filter Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                showFilterPanel || activeFiltersCount > 0
                  ? 'bg-emerald-50 text-[#00871f] border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Menu Filter & Pencarian Pekerjaan"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#00871f]" />
              <span>Filter Pekerjaan</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#00871f] text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {/* View Mode Toggle: Grid vs List */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan Tabel / List (Klik baris untuk Preview)"
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#00871f] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tampilan Kartu / Grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-56 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari faktur, pelanggan, produk..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
              />
            </div>
          </div>
        </div>

        {/* Expandable Filter Menu for Admin & Owner */}
        {showFilterPanel && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Filter className="w-4 h-4 text-[#00871f]" />
                <span>Menu Filter &amp; Pencarian Pekerjaan Produksi</span>
              </div>
              <div className="flex items-center gap-2">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Filter ({activeFiltersCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowFilterPanel(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {/* 1. Status Pekerjaan */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Status Pekerjaan:
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="ALL">Semua Status ({transactions.length})</option>
                  <option value="IN_PROGRESS">Dalam Antrean / Dikerjakan ({inProgressCount})</option>
                  <option value="OVERDUE">Lewat Deadline / Urgent ({overdueCount})</option>
                  <option value="COMPLETED">Selesai Diambil ({completedCount})</option>
                </select>
              </div>

              {/* 2. Target Jatuh Tempo */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Target Jatuh Tempo:
                </label>
                <select
                  value={filterDueDateWindow}
                  onChange={(e) => setFilterDueDateWindow(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="ALL">Semua Deadline</option>
                  <option value="OVERDUE">Lewat Deadline (Urgent!)</option>
                  <option value="TODAY">Jatuh Tempo Hari Ini</option>
                  <option value="TOMORROW">Jatuh Tempo Besok</option>
                  <option value="NEXT_3_DAYS">3 Hari Ke Depan</option>
                  <option value="THIS_WEEK">Minggu Ini (7 Hari)</option>
                  <option value="THIS_MONTH">Bulan Ini</option>
                </select>
              </div>

              {/* 3. Status Pembayaran */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Status Pembayaran:
                </label>
                <select
                  value={filterPaymentStatus}
                  onChange={(e) => setFilterPaymentStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="ALL">Semua Pembayaran</option>
                  <option value="LUNAS">Lunas</option>
                  <option value="PIUTANG">Ada Piutang / Belum Lunas</option>
                </select>
              </div>

              {/* 4. Sales / Penanggung Jawab */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Sales / PIC:
                </label>
                <select
                  value={filterSales}
                  onChange={(e) => setFilterSales(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="ALL">Semua Sales / Kasir</option>
                  {availableSales.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* 5. Tanggal Pesanan Masuk */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tanggal Masuk Order:
                </label>
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="ALL">Semua Waktu</option>
                  <option value="TODAY">Hari Ini</option>
                  <option value="YESTERDAY">Kemarin</option>
                  <option value="LAST_7_DAYS">7 Hari Terakhir</option>
                  <option value="THIS_MONTH">Bulan Ini</option>
                  <option value="CUSTOM">Rentang Tanggal Kustom...</option>
                </select>
              </div>

              {/* 6. Urutkan (Sort By) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Urutkan Berdasarkan:
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                >
                  <option value="DATE_DESC">Tanggal Faktur/Invoice Terbaru (Paling Atas)</option>
                  <option value="DUE_DATE_ASC">Deadline Terdekat (Mendesak)</option>
                  <option value="DUE_DATE_DESC">Deadline Terjauh</option>
                  <option value="TOTAL_DESC">Total Nilai Terbesar</option>
                  <option value="PIUTANG_DESC">Sisa Piutang Terbesar</option>
                </select>
              </div>
            </div>

            {/* Custom Date Inputs if selected */}
            {filterDateRange === 'CUSTOM' && (
              <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-600">Rentang Tanggal:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <span className="text-slate-400">s/d</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Filters Badges Strip */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#00871f]" />
              <span>Filter Aktif ({filteredList.length} ditemukan):</span>
            </span>

            {filterStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-[#00871f] border border-emerald-200 rounded-md text-[11px] font-medium">
                <span>Status: {filterStatus}</span>
                <button type="button" onClick={() => setFilterStatus('ALL')} className="hover:text-emerald-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterDueDateWindow !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-md text-[11px] font-medium">
                <span>Deadline: {filterDueDateWindow}</span>
                <button type="button" onClick={() => setFilterDueDateWindow('ALL')} className="hover:text-amber-950 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterPaymentStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-medium">
                <span>Bayar: {filterPaymentStatus}</span>
                <button type="button" onClick={() => setFilterPaymentStatus('ALL')} className="hover:text-blue-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterSales !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[11px] font-medium">
                <span>PIC: {filterSales}</span>
                <button type="button" onClick={() => setFilterSales('ALL')} className="hover:text-purple-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {filterDateRange !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[11px] font-medium">
                <span>Waktu: {filterDateRange}</span>
                <button type="button" onClick={() => setFilterDateRange('ALL')} className="hover:text-indigo-900 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-rose-600 hover:text-rose-800 font-bold ml-auto cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Hapus Semua Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* MULTI-INVOICE SELECTION ACTION BAR */}
        {selectedInvoiceIds.size > 0 && (
          <div className="mb-4 p-3.5 bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 text-white rounded-2xl shadow-lg border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/30">
                {selectedInvoiceIds.size}
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-2">
                  <span>{selectedInvoiceIds.size} Invoice Terpilih</span>
                  <span className="text-[10px] text-emerald-300 font-normal">
                    (dari {filteredList.length} total)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer font-medium"
                  >
                    {isAllFilteredSelected ? 'Batal Pilih Semua' : `Pilih Semua (${filteredList.length})`}
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-slate-400 hover:text-white hover:underline cursor-pointer"
                  >
                    Reset Pilihan
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Ubah Status Masal */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                <span className="text-[11px] text-slate-300 pl-2 font-medium">Ubah Status:</span>
                <select
                  value={batchStatusValue}
                  onChange={(e) => setBatchStatusValue(e.target.value as OrderStatus)}
                  className="bg-slate-900 text-xs text-white px-2 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                >
                  <option value="Antrean Produksi">Antrean Produksi</option>
                  <option value="Sedang Dikerjakan">Sedang Dikerjakan</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Diambil/Dikirim">Diambil/Dikirim</option>
                </select>
                <button
                  type="button"
                  onClick={handleApplyBatchStatus}
                  className="px-3 py-1.5 bg-[#00871f] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan</span>
                </button>
              </div>

              {/* Unduh PDF Masal */}
              <button
                type="button"
                onClick={handleBatchDownloadPDF}
                disabled={isExportingBatch}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Unduh faktur PDF yang dipilih"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isExportingBatch ? 'Mengunduh...' : 'Unduh PDF'}</span>
              </button>

              {/* Cetak Masal */}
              <button
                type="button"
                onClick={handleBatchPrint}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Cetak SPK & Faktur yang dipilih"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>Cetak Masal</span>
              </button>

              {/* Hapus Masal */}
              {(isAdmin || Boolean(onBatchDeleteInvoices || onDeleteInvoice)) && (
                <button
                  type="button"
                  onClick={() => setShowBatchDeleteConfirm(true)}
                  className="px-3 py-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Hapus beberapa invoice terpilih"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus ({selectedInvoiceIds.size})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {filteredList.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Clock className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Tidak ada antrean pesanan pada filter ini</p>
            <p className="text-xs text-slate-400 mt-0.5">Coba ubah kata kunci pencarian atau status filter</p>
          </div>
        ) : viewMode === 'list' ? (
          /* =========================================================================
             TAMPILAN LIST (TABLE VIEW) - Klik baris untuk Preview
             ========================================================================= */
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-semibold">
                <span>Daftar Pesanan ({filteredList.length})</span>
                <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">
                  &bull; Centang kotak untuk memilih beberapa invoice &bull; Klik salah satu baris untuk membuka <strong className="text-[#00871f]">Preview Detail & SPK</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isAllFilteredSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded text-[#00871f] focus:ring-[#00871f] cursor-pointer accent-[#00871f]"
                        title={isAllFilteredSelected ? 'Batal pilih semua' : 'Pilih semua invoice'}
                      />
                    </th>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-4">Pelanggan & Sales</th>
                    <th className="py-3 px-4">Rincian Item</th>
                    <th className="py-3 px-4">Target Jatuh Tempo</th>
                    <th className="py-3 px-4">Total & Bayar</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((t) => {
                    const days = getDaysDiff(t.dueDate);
                    const isDone = t.status === 'Selesai';
                    const isOverdue = !isDone && days !== null && days < 0;
                    const isDueToday = !isDone && days === 0;
                    const isPiutang = Boolean(t.remainingAmount && t.remainingAmount > 0);
                    const isSelected = selectedInvoiceIds.has(t.id);

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setPreviewTx(t)}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-50/80 border-l-4 border-l-[#00871f]'
                            : isOverdue
                            ? 'bg-rose-50/30 hover:bg-rose-50/70'
                            : isDueToday
                            ? 'bg-amber-50/30 hover:bg-amber-50/70'
                            : 'hover:bg-emerald-50/40'
                        }`}
                        title="Klik untuk membuka Preview Pesanan"
                      >
                        {/* Checkbox multi-select */}
                        <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectInvoice(t.id, e as any)}
                            className="w-4 h-4 rounded text-[#00871f] focus:ring-[#00871f] cursor-pointer accent-[#00871f]"
                            title={`Pilih invoice ${t.invoiceNo}`}
                          />
                        </td>

                        {/* No Faktur & Tanggal */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-[#00871f] group-hover:underline text-xs flex items-center gap-1.5">
                              {t.invoiceNo || `#ORD/${t.id}`}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {t.date ? t.date.split(' ')[0] : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Pelanggan & Sales */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 text-xs">
                            {t.customer?.name || 'Pelanggan Umum'}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>{t.customer?.phone && t.customer.phone !== '-' ? t.customer.phone : 'Umum'}</span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-slate-600 font-medium">Sales: {t.orderType || t.cashierName || 'Kasir'}</span>
                          </div>
                          {t.vendorName && canViewVendorResolved && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                                title="Preview Nama Vendor (Khusus Admin & Kasir - Tidak Dicetak)"
                              >
                                <Building2 className="w-2.5 h-2.5 text-[#00871f]" />
                                Vendor: {t.vendorName}
                              </span>
                            </div>
                          )}
                          {t.mockupDesign && canViewVendorResolved && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setViewingMockupTx(t)}
                                className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded cursor-pointer transition-colors shadow-2xs"
                                title="Lihat Mockup Desain (Khusus Preview Admin & Kasir)"
                              >
                                <ImageIcon className="w-2.5 h-2.5 text-[#00871f]" />
                                <span>Mockup Desain</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Rincian Item */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            {(t.items || []).slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-xs text-slate-700 truncate flex items-center gap-1">
                                <span className="font-semibold text-slate-900">{item.quantity}x</span>
                                <span className="truncate">{item.name}</span>
                                {(item.kaosColor || item.kaosSize) && (
                                  <span className="text-[10px] text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-100 shrink-0">
                                    {[item.kaosColor, item.kaosSize].filter(Boolean).join(' / ')}
                                  </span>
                                )}
                              </div>
                            ))}
                            {(t.items || []).length > 2 && (
                              <span className="text-[10px] text-slate-400 italic">
                                +{(t.items || []).length - 2} item lainnya
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Jatuh Tempo */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {t.dueDate || '-'}
                            </span>
                            {!isDone && days !== null && (
                              <div className="mt-1">
                                {isOverdue ? (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded border border-rose-200 inline-flex items-center gap-1">
                                    ⚠️ Terlambat {Math.abs(days)} Hari
                                  </span>
                                ) : isDueToday ? (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
                                    ⏰ Hari Ini
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                                    ✓ Sisa {days} Hari
                                  </span>
                                )}
                              </div>
                            )}
                            {isDone && (
                              <span className="text-[10px] font-semibold text-emerald-700 mt-0.5">
                                Selesai
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total & Bayar */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-800 text-xs">
                            {formatCurrency(t.total)}
                          </div>
                          <div className="mt-0.5">
                            {isPiutang ? (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                Piutang: {formatCurrency(t.remainingAmount || 0)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                Lunas
                              </span>
                            )}
                          </div>
                          {isAdmin && (
                            <div className="mt-0.5">
                              <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5" title="Hasil Keuntungan Bersih (Khusus Admin/Owner)">
                                <TrendingUp className="w-2.5 h-2.5 text-[#00871f]" />
                                Laba: {formatCurrency(calculateProfit(t.total, t.vendorCost || 0, t.shippingCost || 0))}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Status Produksi */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800'
                                : isOverdue
                                ? 'bg-rose-100 text-rose-800 animate-pulse'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isDone ? 'Selesai' : t.status}
                          </span>
                        </td>

                        {/* Aksi */}
                        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Tombol Preview Utama */}
                            <button
                              type="button"
                              onClick={() => setPreviewTx(t)}
                              className="px-2.5 py-1 bg-[#00871f]/10 hover:bg-[#00871f] text-[#00871f] hover:text-white rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              title="Buka Preview Pesanan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>

                            {/* Tombol Bayar Piutang jika belum lunas */}
                            {isPiutang && onPayPiutang && (
                              <button
                                type="button"
                                onClick={() => onPayPiutang(t)}
                                className="px-2 py-1 bg-amber-50 hover:bg-emerald-50 text-amber-800 hover:text-[#00871f] border border-amber-300 hover:border-emerald-300 rounded-md text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                title="Bayar / Pelunasan Sisa Piutang"
                              >
                                <Wallet className="w-3.5 h-3.5 text-[#00871f]" />
                                <span>Bayar</span>
                              </button>
                            )}

                            {/* Tombol Selesai Cepat */}
                            {t.status !== 'Selesai' ? (
                              <button
                                type="button"
                                onClick={() => onUpdateOrderStatus(t.id, 'Selesai')}
                                className="p-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-md transition-colors cursor-pointer"
                                title="Tandai Selesai"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpdateOrderStatus(t.id, 'Sedang Dikerjakan')}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer text-[10px]"
                                title="Batal Selesai"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Tombol Cetak SPK ke Printer */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintModalTx(t);
                              }}
                              className="p-1 text-slate-400 hover:text-[#00871f] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Cetak SPK / Struk Langsung ke Printer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* =========================================================================
             TAMPILAN GRID (CARD VIEW)
             ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredList.map((t) => {
              const days = getDaysDiff(t.dueDate);
              const isDone = t.status === 'Selesai';
              const isOverdue = !isDone && days !== null && days < 0;
              const isDueToday = !isDone && days === 0;
              const isSelected = selectedInvoiceIds.has(t.id);

              return (
                <div
                  key={t.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'border-[#00871f] ring-2 ring-[#00871f] bg-emerald-50/20'
                      : isOverdue
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : isDueToday
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Checkbox, Invoice & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectInvoice(t.id, e as any)}
                          className="w-4 h-4 rounded text-[#00871f] focus:ring-[#00871f] cursor-pointer accent-[#00871f]"
                          title={`Pilih invoice ${t.invoiceNo}`}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewTx(t)}
                          className="font-mono font-bold text-xs text-[#00871f] hover:underline cursor-pointer flex items-center gap-1"
                          title="Klik untuk Preview Pesanan"
                        >
                          {t.invoiceNo || `#ORD/${t.id}`}
                        </button>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isDone ? 'Selesai' : (t.status || 'Menunggu')}
                      </span>
                    </div>

                    {/* Customer */}
                    <h3 className="text-sm font-bold text-slate-800">{t.customer?.name || 'Pelanggan Umum'}</h3>
                    <p className="text-[11px] text-slate-500 mb-2">
                      {t.customer?.phone && t.customer.phone !== '-' ? t.customer.phone : 'Pelanggan Umum'} &bull;{' '}
                      <span className="font-semibold text-slate-700">Sales: {t.orderType || t.cashierName || 'Kasir'}</span>
                    </p>
                    {t.vendorName && canViewVendorResolved && (
                      <div className="mb-2">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded"
                          title="Preview Nama Vendor (Khusus Admin & Kasir - Tidak Dicetak)"
                        >
                          <Building2 className="w-3 h-3 text-[#00871f]" />
                          Vendor: {t.vendorName}
                        </span>
                      </div>
                    )}
                    {t.mockupDesign && canViewVendorResolved && (
                      <div className="mb-2">
                        <button
                          type="button"
                          onClick={() => setViewingMockupTx(t)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-colors"
                          title="Lihat Mockup Desain (Khusus Preview Admin & Kasir)"
                        >
                          <ImageIcon className="w-3 h-3 text-[#00871f]" />
                          <span>Lihat Mockup Desain</span>
                        </button>
                      </div>
                    )}

                    {/* JATUH TEMPO PENYELESAIAN BADGE */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          Jatuh Tempo:
                        </span>
                        <button
                          onClick={() => {
                            setEditingDueDateTx(t);
                            setTempDueDate(t.dueDate ? t.dueDate.replace(' ', 'T') : '');
                          }}
                          className="text-[10px] text-[#00871f] hover:underline font-semibold cursor-pointer"
                        >
                          Ubah
                        </button>
                      </div>
                      <p className="text-xs font-bold text-slate-800">{t.dueDate || '-'}</p>

                      {/* Remaining badge */}
                      {!isDone && days !== null && (
                        <div className="mt-1.5">
                          {isOverdue ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                              ⚠️ Terlambat {Math.abs(days)} Hari dari Target!
                            </span>
                          ) : isDueToday ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block">
                              ⏰ Jatuh Tempo HARI INI
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                              ✓ Sisa {days} Hari Menuju Deadline
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-1 mb-3">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                        Rincian Produksi:
                      </p>
                      {(t.items || []).map((i, idx) => (
                        <div key={idx} className="text-xs text-slate-700 flex flex-col py-0.5 border-b border-slate-100 last:border-b-0">
                          <div className="flex justify-between">
                            <span className="font-medium">
                              {i.quantity}x {i.name}
                            </span>
                            {i.notes && (
                              <span className="text-[10px] text-slate-500 italic max-w-[140px] truncate ml-1">
                                ({i.notes})
                              </span>
                            )}
                          </div>
                          {(i.kaosColor || i.kaosSize) && (
                            <div className="text-[10px] font-semibold text-purple-800 flex items-center gap-1 mt-0.5">
                              <span className="px-1.5 py-0.5 bg-purple-100/80 rounded border border-purple-200">
                                Warna: {i.kaosColor || '-'}
                              </span>
                              <span className="px-1.5 py-0.5 bg-purple-100/80 rounded border border-purple-200 font-bold">
                                Size: {i.kaosSize || '-'}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {t.notes && (
                      <p className="text-[11px] text-slate-500 bg-amber-50/70 p-2 rounded border border-amber-100 mb-3">
                        <span className="font-semibold text-amber-800">Catatan:</span> {t.notes}
                      </p>
                    )}

                    {/* Payment & Piutang Status Badge */}
                    <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-500 font-medium">Total Biaya:</span>
                        <span className="font-bold text-slate-800">{formatCurrency(t.total)}</span>
                      </div>
                      {t.remainingAmount && t.remainingAmount > 0 ? (
                        <div className="pt-1.5 border-t border-slate-200/80 space-y-1">
                          <div className="flex justify-between items-center text-slate-600 text-[11px]">
                            <span>Dibayar ({t.paymentStatus || 'DP'}):</span>
                            <span className="font-semibold text-emerald-700">{formatCurrency(t.amountPaid)}</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-600 font-bold">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                              Sisa Piutang:
                            </span>
                            <span className="text-sm font-black">{formatCurrency(t.remainingAmount)}</span>
                          </div>
                          <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex justify-between items-center font-medium">
                            <span>Jatuh Tempo Piutang:</span>
                            <span className="font-bold">{t.dueDate || '-'}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 border-t border-slate-200/80 flex justify-between items-center text-emerald-600 text-[11px] font-bold">
                          <span>Status Pembayaran:</span>
                          <span className="px-2 py-0.5 bg-emerald-100/80 text-emerald-800 rounded">LUNAS</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Status Changer & Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {t.status !== 'Selesai' ? (
                        <button
                          onClick={() => onUpdateOrderStatus(t.id, 'Selesai')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Tandai Selesai</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateOrderStatus(t.id, 'Sedang Dikerjakan')}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-medium hover:underline cursor-pointer"
                        >
                          Batal Selesai
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Tombol Preview */}
                      <button
                        onClick={() => setPreviewTx(t)}
                        className="px-2 py-1 bg-slate-100 hover:bg-[#00871f] text-slate-600 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Buka Preview Pesanan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      {onReviseInvoice && (
                        <button
                          onClick={() => onReviseInvoice(t)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 cursor-pointer"
                          title="Revisi Faktur / Invoice"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setPrintModalTx(t)}
                        className="p-1.5 text-slate-400 hover:text-[#00871f] rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Cetak SPK / Struk Langsung ke Printer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {isAdmin && onDeleteInvoice && (
                        <button
                          onClick={() => onDeleteInvoice(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Hapus Faktur (Khusus Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
         MODAL PREVIEW PESANAN & SPK (Jika salah satu baris/item di-klik)
         ========================================================================= */}
      {previewTx && (() => {
        const pDays = getDaysDiff(previewTx.dueDate);
        const pIsDone = previewTx.status === 'Selesai';
        const pIsOverdue = !pIsDone && pDays !== null && pDays < 0;
        const pIsDueToday = !pIsDone && pDays === 0;
        const pIsPiutang = Boolean(previewTx.remainingAmount && previewTx.remainingAmount > 0);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#00871f] rounded-lg text-white">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold">Preview Pesanan & SPK Produksi</h3>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          pIsDone
                            ? 'bg-emerald-500 text-white'
                            : pIsOverdue
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {pIsDone ? 'Selesai' : previewTx.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono mt-0.5">
                      Faktur: <span className="text-emerald-400 font-bold">{previewTx.invoiceNo}</span> &bull; Tgl: {previewTx.date}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTx(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Tutup Preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* 1. Customer & Sales Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-emerald-100 text-[#00871f] rounded-lg mt-0.5">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pemesan</p>
                      <h4 className="text-sm font-bold text-slate-800">{previewTx.customer?.name || 'Pelanggan Umum'}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No. HP: {previewTx.customer?.phone || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {previewTx.customer?.phone && previewTx.customer.phone !== '-' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenWhatsApp(
                            previewTx.customer?.phone || '',
                            previewTx.customer?.name || 'Pelanggan',
                            previewTx.invoiceNo || ''
                          )
                        }
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat WhatsApp</span>
                      </button>
                    )}
                    <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                      Sales: <span className="text-[#00871f] font-bold">{previewTx.orderType}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Target Jatuh Tempo Banner */}
                <div
                  className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    pIsOverdue
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : pIsDueToday
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-lg ${
                        pIsOverdue
                          ? 'bg-rose-100 text-rose-700'
                          : pIsDueToday
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-[#00871f]'
                      }`}
                    >
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Target Jatuh Tempo Penyelesaian
                      </p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">
                        {previewTx.dueDate || 'Langsung Diambil / Belum Ditentukan'}
                      </p>
                      {!pIsDone && pDays !== null && (
                        <p className="text-xs font-bold mt-1">
                          {pIsOverdue ? (
                            <span className="text-rose-700">⚠️ Terlambat {Math.abs(pDays)} Hari dari Jadwal Target!</span>
                          ) : pIsDueToday ? (
                            <span className="text-amber-800">⏰ Harus Selesai Hari Ini!</span>
                          ) : (
                            <span className="text-emerald-700">✓ Sisa waktu {pDays} hari menuju deadline</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingDueDateTx(previewTx);
                      setTempDueDate(previewTx.dueDate ? previewTx.dueDate.replace(' ', 'T') : '');
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:border-[#00871f] text-slate-700 hover:text-[#00871f] rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                  >
                    Ubah Jadwal
                  </button>
                </div>

                {/* Mockup Desain Produk (Khusus Preview Admin & Kasir) */}
                {previewTx.mockupDesign && canViewVendorResolved && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 text-[#00871f] rounded-lg">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                            Mockup Desain Produk
                          </h4>
                          <p className="text-[10px] text-slate-500">Khusus panduan produksi internal Admin &amp; Kasir (Tidak dicetak di struk)</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewingMockupTx(previewTx)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-[#00871f] border border-slate-300 hover:border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-[#00871f]" />
                        <span>Perbesar Mockup</span>
                      </button>
                    </div>
                    <div
                      onClick={() => setViewingMockupTx(previewTx)}
                      className="relative rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer group max-h-56 flex items-center justify-center p-1"
                      title="Klik untuk melihat ukuran penuh"
                    >
                      <img
                        src={previewTx.mockupDesign}
                        alt="Mockup Desain Pesanan"
                        className="max-h-52 w-auto object-contain rounded group-hover:scale-102 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                        <Maximize2 className="w-4 h-4" />
                        <span>Klik untuk Zoom Penuh</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Rincian Item Produksi */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#00871f]" />
                    Rincian Item & Spesifikasi Produksi
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Produk / Layanan</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3">Spesifikasi Kaos / Keterangan</th>
                          <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(previewTx.items || []).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              {item.name}
                              {item.notes && (
                                <span className="block text-[11px] text-slate-500 font-normal italic mt-0.5">
                                  Catatan: {item.notes}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.kaosColor || item.kaosSize ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {item.kaosColor && (
                                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-semibold">
                                      Warna: {item.kaosColor}
                                    </span>
                                  )}
                                  {item.kaosSize && (
                                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-[10px] font-bold">
                                      Size: {item.kaosSize}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-600">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                              {formatCurrency(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Catatan Khusus Produksi jika ada */}
                {previewTx.notes && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1 mb-0.5">
                      <Info className="w-3.5 h-3.5 text-amber-700" />
                      Instruksi & Catatan Khusus:
                    </span>
                    <p className="text-slate-700">{previewTx.notes}</p>
                  </div>
                )}

                {/* 5. Ringkasan Keuangan & Piutang */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs">
                  <h4 className="font-bold text-slate-700 mb-2 uppercase tracking-wider text-[11px]">
                    Ringkasan Pembayaran & Nilai Faktur
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Total Nilai Faktur:</span>
                      <span className="font-bold text-slate-900 text-sm">{formatCurrency(previewTx.total)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Metode Pembayaran:</span>
                      <span className="font-semibold text-slate-800">{previewTx.paymentMethod || 'Tunai (Cash)'}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Jumlah Terbayar ({previewTx.paymentStatus || 'LUNAS'}):</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(previewTx.amountPaid || previewTx.total)}</span>
                    </div>
                    {pIsPiutang ? (
                      <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex justify-between items-center text-rose-600 font-bold">
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                            Sisa Piutang yang Harus Dilunasi:
                          </span>
                          <span className="text-base font-black">{formatCurrency(previewTx.remainingAmount || 0)}</span>
                        </div>
                        {onPayPiutang && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                onPayPiutang(previewTx);
                                setPreviewTx(null);
                              }}
                              className="px-3 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              <span>Bayar / Lunasi Sisa Piutang</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-emerald-600 font-bold">
                        <span>Status Pembayaran:</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black">LUNAS</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 6. Rincian Biaya Vendor, Biaya Pengiriman & Preview Keuntungan */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#00871f]" />
                      Rincian Biaya Vendor &amp; Biaya Pengiriman
                    </h4>
                    {isAdmin && onUpdateCosts && !isEditingCosts && (
                      <button
                        type="button"
                        onClick={() => {
                          setTempVendorCost(previewTx.vendorCost || 0);
                          setTempShippingCost(previewTx.shippingCost || 0);
                          setIsEditingCosts(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#00871f] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ubah Biaya</span>
                      </button>
                    )}
                  </div>

                  {isEditingCosts ? (
                    <div className="p-3 bg-white border border-[#00871f]/40 rounded-xl space-y-3 shadow-xs">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 block mb-1">
                          Nama Vendor (Opsional)
                        </label>
                        <input
                          type="text"
                          value={tempVendorName}
                          onChange={(e) => setTempVendorName(e.target.value)}
                          placeholder="Contoh: Vendor Sablon / Bordir..."
                          className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-[#00871f] focus:bg-white"
                        />
                        <span className="text-[9.5px] text-slate-400 block mt-0.5 italic">
                          * Khusus preview internal Admin &amp; Kasir (tidak dicetak di struk)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Biaya Vendor (Rp)
                          </label>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#00871f] focus-within:bg-white">
                            <span className="text-slate-400 text-xs">Rp</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={tempVendorCost}
                              onChange={(e) => setTempVendorCost(Math.max(0, Number(e.target.value)))}
                              className="w-full text-xs font-semibold text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Biaya Pengiriman (Rp)
                          </label>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[#00871f] focus-within:bg-white">
                            <span className="text-slate-400 text-xs">Rp</span>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={tempShippingCost}
                              onChange={(e) => setTempShippingCost(Math.max(0, Number(e.target.value)))}
                              className="w-full text-xs font-semibold text-slate-800 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditingCosts(false)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateCosts) {
                              onUpdateCosts(previewTx.id, tempVendorCost, tempShippingCost, tempVendorName);
                              setPreviewTx({
                                ...previewTx,
                                vendorCost: tempVendorCost,
                                shippingCost: tempShippingCost,
                                vendorName: tempVendorName.trim() || undefined,
                                profit: calculateProfit(previewTx.total, tempVendorCost, tempShippingCost)
                              });
                            }
                            setIsEditingCosts(false);
                          }}
                          className="px-3.5 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Biaya &amp; Vendor</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Preview Nama Vendor - Khusus Admin & Kasir */}
                      {canViewVendorResolved && (
                        <div className="p-3 bg-white border border-slate-200 rounded-xl mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10.5px] font-semibold text-slate-500 block mb-0.5">
                              Nama Vendor (Preview Admin &amp; Kasir)
                            </span>
                            <span className="text-[9.5px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Tidak Ditampilkan Saat Print
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Building2 className="w-4 h-4 text-[#00871f]" />
                            <span className="text-xs font-bold text-slate-800">
                              {previewTx.vendorName || <span className="text-slate-400 font-normal italic">Tidak Ada Vendor</span>}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-white border border-slate-200 rounded-xl">
                          <span className="text-[10.5px] font-semibold text-slate-500 block mb-0.5">Biaya Vendor</span>
                          <span className="text-xs font-bold text-slate-800">
                            {formatCurrency(previewTx.vendorCost || 0)}
                          </span>
                        </div>
                        <div className="p-3 bg-white border border-slate-200 rounded-xl">
                          <span className="text-[10.5px] font-semibold text-slate-500 block mb-0.5">Biaya Pengiriman</span>
                          <span className="text-xs font-bold text-slate-800">
                            {formatCurrency(previewTx.shippingCost || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PREVIEW HASIL KEUNTUNGAN (HANYA BISA DILIHAT OLEH ADMIN / OWNER) */}
                  {isAdmin ? (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-300 text-emerald-950 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1 bg-[#00871f] text-white rounded-md">
                            <TrendingUp className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-xs text-emerald-950">
                              HASIL KEUNTUNGAN (PROFIT BERSIH)
                            </h5>
                            <span className="text-[9.5px] font-bold text-emerald-700">
                              🔒 Khusus Admin / Owner &bull; Tidak Tampil di Struk
                            </span>
                          </div>
                        </div>

                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 border border-emerald-300">
                          Margin: {calculateProfitMargin(calculateProfit(previewTx.total, previewTx.vendorCost || 0, previewTx.shippingCost || 0), previewTx.total)}%
                        </span>
                      </div>

                      <div className="pt-2 border-t border-emerald-200/80 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Total Nilai Faktur:</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(previewTx.total)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Dikurangi Biaya Vendor:</span>
                          <span className="font-semibold text-rose-600">- {formatCurrency(previewTx.vendorCost || 0)}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Dikurangi Biaya Pengiriman:</span>
                          <span className="font-semibold text-rose-600">- {formatCurrency(previewTx.shippingCost || 0)}</span>
                        </div>
                        <div className="pt-1.5 border-t border-emerald-300 flex justify-between items-baseline font-black text-sm">
                          <span className="text-emerald-950">Hasil Keuntungan:</span>
                          <span className={`text-base ${calculateProfit(previewTx.total, previewTx.vendorCost || 0, previewTx.shippingCost || 0) >= 0 ? 'text-[#00871f]' : 'text-rose-600'}`}>
                            {formatCurrency(calculateProfit(previewTx.total, previewTx.vendorCost || 0, previewTx.shippingCost || 0))}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-emerald-100/50 border border-emerald-200 text-[10px] text-emerald-900 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          Rumus: <strong>Hasil Keuntungan = Total Nilai Faktur - (Biaya Vendor + Biaya Pengiriman)</strong>. Sesuai ketentuan, biaya keuntungan hanya bisa dilihat oleh Admin/Owner dan tidak boleh tampil di struk inv.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-700">Preview Keuntungan Dirahasiakan</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Hanya akun Admin/Owner yang memiliki hak akses untuk melihat hasil preview keuntungan pesanan ini.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  {/* Status Changer */}
                  {previewTx.status !== 'Selesai' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateOrderStatus(previewTx.id, 'Selesai');
                        setPreviewTx({
                          ...previewTx,
                          status: 'Selesai'
                        });
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Tandai Selesai</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateOrderStatus(previewTx.id, 'Sedang Dikerjakan');
                        setPreviewTx({
                          ...previewTx,
                          status: 'Sedang Dikerjakan'
                        });
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Kembalikan ke Antrean</span>
                    </button>
                  )}

                  {/* Cetak SPK Langsung ke Printer */}
                  <button
                    type="button"
                    onClick={() => setPrintModalTx(previewTx)}
                    className="px-3.5 py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="Cetak SPK / Struk langsung ke printer (tampilkan dialog printer)"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Cetak ke Printer</span>
                  </button>

                  {/* Unduh SPK / PDF */}
                  <button
                    type="button"
                    onClick={() => downloadTransactionReceiptPDF(previewTx)}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Unduh file PDF ke komputer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Unduh PDF</span>
                  </button>

                  {/* Buka Struk Resmi */}
                  <button
                    type="button"
                    onClick={() => {
                      onViewReceipt(previewTx);
                      setPreviewTx(null);
                    }}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-[#00871f]" />
                    <span>Struk Lengkap</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTx(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Tutup Preview
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Ubah Tanggal Jatuh Tempo */}
      {editingDueDateTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-1">Ubah Jatuh Tempo Penyelesaian</h3>
            <p className="text-xs text-slate-500 mb-3">
              {editingDueDateTx.invoiceNo || `#ORD/${editingDueDateTx.id}`} &bull; {editingDueDateTx.customer?.name || 'Pelanggan Umum'}
            </p>

            <form onSubmit={handleSaveDueDate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tanggal & Waktu Target Selesai Baru
                </label>
                <input
                  type="datetime-local"
                  required
                  value={tempDueDate}
                  onChange={(e) => setTempDueDate(e.target.value)}
                  className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDueDateTx(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Masal Invoice */}
      {showBatchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-800">Hapus {selectedInvoiceIds.size} Invoice Terpilih?</h3>
                <p className="text-xs text-slate-500">Tindakan ini permanen dan tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p>Anda akan menghapus <strong>{selectedInvoiceIds.size} faktur</strong> berikut secara permanen dari riwayat transaksi kasir:</p>
              <div className="font-mono text-[11px] max-h-24 overflow-y-auto bg-white/80 p-2 rounded border border-rose-200 space-y-0.5">
                {transactions
                  .filter((t) => selectedInvoiceIds.has(t.id))
                  .slice(0, 10)
                  .map((t) => (
                    <div key={t.id} className="flex justify-between">
                      <span className="font-bold text-rose-700">{t.invoiceNo || t.id}</span>
                      <span className="text-slate-600 truncate max-w-[160px]">{t.customer?.name}</span>
                    </div>
                  ))}
                {selectedInvoiceIds.size > 10 && (
                  <div className="text-slate-400 italic text-[10px]">+ {selectedInvoiceIds.size - 10} faktur lainnya...</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBatchDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus {selectedInvoiceIds.size} Faktur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Langsung ke Printer */}
      <PrintReceiptModal
        transaction={printModalTx}
        isOpen={Boolean(printModalTx)}
        onClose={() => setPrintModalTx(null)}
      />

      {/* Modal Preview Mockup Desain */}
      <MockupPreviewModal
        isOpen={Boolean(viewingMockupTx)}
        onClose={() => setViewingMockupTx(null)}
        mockupUrl={viewingMockupTx?.mockupDesign}
        invoiceNo={viewingMockupTx?.invoiceNo}
        customerName={viewingMockupTx?.customer?.name}
      />
    </div>
  );
};
