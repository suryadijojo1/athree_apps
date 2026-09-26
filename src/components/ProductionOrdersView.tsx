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
  User,
  ShoppingBag,
  Info,
  CalendarDays,
  FileText
} from 'lucide-react';
import { Transaction, OrderStatus } from '../types';
import { formatCurrency, downloadTransactionReceiptPDF } from '../utils/exportUtils';

interface ProductionOrdersViewProps {
  transactions: Transaction[];
  onUpdateOrderStatus: (transactionId: string, status: OrderStatus) => void;
  onUpdateDueDate: (transactionId: string, newDueDate: string) => void;
  onViewReceipt: (transaction: Transaction) => void;
  onReviseInvoice?: (transaction: Transaction) => void;
  onDeleteInvoice?: (transaction: Transaction) => void;
  isAdmin?: boolean;
}

export const ProductionOrdersView: React.FC<ProductionOrdersViewProps> = ({
  transactions,
  onUpdateOrderStatus,
  onUpdateDueDate,
  onViewReceipt,
  onReviseInvoice,
  onDeleteInvoice,
  isAdmin = false
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDueDateTx, setEditingDueDateTx] = useState<Transaction | null>(null);
  const [tempDueDate, setTempDueDate] = useState('');
  
  // View mode: Grid vs List (default to list as requested)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('athree_production_view_mode');
    return saved === 'grid' || saved === 'list' ? saved : 'list';
  });

  // Preview Modal state
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

  useEffect(() => {
    localStorage.setItem('athree_production_view_mode', viewMode);
  }, [viewMode]);

  // Keep previewTx in sync when transactions update
  useEffect(() => {
    if (previewTx) {
      const updated = transactions.find((t) => t.id === previewTx.id);
      if (updated) {
        setPreviewTx(updated);
      }
    }
  }, [transactions]);

  // Helper to calculate days remaining
  const getDaysDiff = (dueDateStr: string) => {
    if (!dueDateStr) return null;
    const now = new Date();
    const due = new Date(dueDateStr);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter transactions
  const filteredList = useMemo(() => {
    return transactions.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.invoiceNo.toLowerCase().includes(q) ||
        t.customer.name.toLowerCase().includes(q) ||
        t.items.some((i) => i.name.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const days = getDaysDiff(t.dueDate);

      if (filterStatus === 'IN_PROGRESS') {
        return t.status === 'Sedang Dikerjakan' || t.status === 'Menunggu';
      }
      if (filterStatus === 'COMPLETED') {
        return t.status === 'Selesai';
      }
      if (filterStatus === 'OVERDUE') {
        return t.status !== 'Selesai' && days !== null && days < 0;
      }
      return true;
    });
  }, [transactions, filterStatus, searchQuery]);

  // Urgent / Overdue count
  const overdueCount = transactions.filter((t) => {
    const days = getDaysDiff(t.dueDate);
    return t.status !== 'Selesai' && days !== null && days < 0;
  }).length;

  const inProgressCount = transactions.filter(
    (t) => t.status === 'Sedang Dikerjakan' || t.status === 'Menunggu'
  ).length;

  const completedCount = transactions.filter((t) => t.status === 'Selesai').length;

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

          {/* Right controls: View Mode Switcher & Search Bar */}
          <div className="flex items-center gap-2">
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
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
                  &bull; Klik salah satu baris untuk membuka <strong className="text-[#00871f]">Preview Detail & SPK</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
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

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setPreviewTx(t)}
                        className={`group cursor-pointer transition-colors ${
                          isOverdue
                            ? 'bg-rose-50/30 hover:bg-rose-50/70'
                            : isDueToday
                            ? 'bg-amber-50/30 hover:bg-amber-50/70'
                            : 'hover:bg-emerald-50/40'
                        }`}
                        title="Klik untuk membuka Preview Pesanan"
                      >
                        {/* No Faktur & Tanggal */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-[#00871f] group-hover:underline text-xs flex items-center gap-1.5">
                              {t.invoiceNo}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {t.date ? t.date.split(' ')[0] : '-'}
                            </span>
                          </div>
                        </td>

                        {/* Pelanggan & Sales */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 text-xs">
                            {t.customer.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>{t.customer.phone !== '-' ? t.customer.phone : 'Umum'}</span>
                            <span className="text-slate-300">&bull;</span>
                            <span className="text-slate-600 font-medium">Sales: {t.orderType}</span>
                          </div>
                        </td>

                        {/* Rincian Item */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="space-y-0.5">
                            {t.items.slice(0, 2).map((item, idx) => (
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
                            {t.items.length > 2 && (
                              <span className="text-[10px] text-slate-400 italic">
                                +{t.items.length - 2} item lainnya
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

                            {/* Tombol Cetak SPK */}
                            <button
                              type="button"
                              onClick={() => downloadTransactionReceiptPDF(t)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              title="Unduh SPK / Struk PDF"
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

              return (
                <div
                  key={t.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isOverdue
                      ? 'border-rose-300 ring-1 ring-rose-200'
                      : isDueToday
                      ? 'border-amber-300 ring-1 ring-amber-200'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Invoice & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => setPreviewTx(t)}
                        className="font-mono font-bold text-xs text-[#00871f] hover:underline cursor-pointer flex items-center gap-1"
                        title="Klik untuk Preview Pesanan"
                      >
                        {t.invoiceNo}
                      </button>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isDone ? 'Selesai' : t.status}
                      </span>
                    </div>

                    {/* Customer */}
                    <h3 className="text-sm font-bold text-slate-800">{t.customer.name}</h3>
                    <p className="text-[11px] text-slate-500 mb-2">
                      {t.customer.phone !== '-' ? t.customer.phone : 'Pelanggan Umum'} &bull;{' '}
                      <span className="font-semibold text-slate-700">Sales: {t.orderType}</span>
                    </p>

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
                      {t.items.map((i, idx) => (
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
                        onClick={() => downloadTransactionReceiptPDF(t)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Unduh Struk / SPK Cetak"
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
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pemesan</p>
                      <h4 className="text-sm font-bold text-slate-800">{previewTx.customer.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        No. HP: {previewTx.customer.phone || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {previewTx.customer.phone && previewTx.customer.phone !== '-' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenWhatsApp(
                            previewTx.customer.phone,
                            previewTx.customer.name,
                            previewTx.invoiceNo
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
                        {previewTx.items.map((item, idx) => (
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
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-rose-600 font-bold">
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                          Sisa Piutang yang Harus Dilunasi:
                        </span>
                        <span className="text-base font-black">{formatCurrency(previewTx.remainingAmount || 0)}</span>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-emerald-600 font-bold">
                        <span>Status Pembayaran:</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black">LUNAS</span>
                      </div>
                    )}
                  </div>
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

                  {/* Unduh SPK / PDF */}
                  <button
                    type="button"
                    onClick={() => downloadTransactionReceiptPDF(previewTx)}
                    className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-4 h-4 text-emerald-600" />
                    <span>Unduh SPK (PDF)</span>
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
              {editingDueDateTx.invoiceNo} &bull; {editingDueDateTx.customer.name}
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
    </div>
  );
};
