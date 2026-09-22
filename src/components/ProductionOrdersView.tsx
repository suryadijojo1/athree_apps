import React, { useState, useMemo } from 'react';
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
  Trash2
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

  const handleSaveDueDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDueDateTx || !tempDueDate) return;
    onUpdateDueDate(editingDueDateTx.id, tempDueDate.replace('T', ' '));
    setEditingDueDateTx(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Banner */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
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

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Pesanan ({transactions.length})
            </button>
            <button
              onClick={() => setFilterStatus('IN_PROGRESS')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                filterStatus === 'IN_PROGRESS'
                  ? 'bg-[#00871f] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dalam Antrean ({inProgressCount})
            </button>
            <button
              onClick={() => setFilterStatus('OVERDUE')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterStatus === 'OVERDUE'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lewat Deadline ({overdueCount})
            </button>
            <button
              onClick={() => setFilterStatus('COMPLETED')}
              className={`px-3 py-1 rounded-md transition-all ${
                filterStatus === 'COMPLETED'
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Selesai Diambil
            </button>
          </div>

          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pelanggan atau no faktur..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
            />
          </div>
        </div>
      </div>

      {/* Orders List / Cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredList.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400">
            <Clock className="w-12 h-12 stroke-1 mb-2" />
            <p className="text-sm font-medium">Tidak ada antrean pesanan pada filter ini</p>
          </div>
        ) : (
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
                      <span className="font-mono font-bold text-xs text-[#00871f]">
                        {t.invoiceNo}
                      </span>
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
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Tandai Selesai</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdateOrderStatus(t.id, 'Sedang Dikerjakan')}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-[11px] font-medium hover:underline"
                        >
                          Batal Selesai
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
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
                        onClick={() => onViewReceipt(t)}
                        className="p-1.5 text-slate-400 hover:text-[#00871f] rounded-lg hover:bg-slate-100 cursor-pointer"
                        title="Lihat Detail Pesanan"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => downloadTransactionReceiptPDF(t)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100"
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
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
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
