import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, ShieldAlert, CheckSquare, Square, Package, Calendar, User, DollarSign } from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/exportUtils';

interface DeleteInvoiceModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (transactionId: string, restoreStock: boolean, deleteReason: string) => void;
  currentUserRole: string;
}

export const DeleteInvoiceModal: React.FC<DeleteInvoiceModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onConfirmDelete,
  currentUserRole
}) => {
  if (!isOpen || !transaction) return null;

  const isAdmin = currentUserRole === 'admin';
  const [restoreStock, setRestoreStock] = useState<boolean>(true);
  const [deleteReason, setDeleteReason] = useState<string>('Pesanan dibatalkan');

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Akses Ditolak: Hanya akun Administrator yang berwenang menghapus faktur.');
      return;
    }
    onConfirmDelete(transaction.id, restoreStock, deleteReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-100 p-6 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Hapus Faktur / Invoice</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  Khusus Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Konfirmasi penghapusan data transaksi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning if not admin */}
        {!isAdmin ? (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            <div className="flex items-center gap-2 font-bold mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Akses Terbatas</span>
            </div>
            <p>Hanya akun dengan hak akses <strong>Administrator</strong> yang diperbolehkan menghapus faktur transaksi.</p>
            <div className="mt-3 flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="mt-4 space-y-4">
            {/* Red Danger Notice */}
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Tindakan Tidak Dapat Dibatalkan</span>
                Faktur ini akan dihapus permanen dari laporan transaksi kasir dan pembukuan.
              </div>
            </div>

            {/* Transaction Info Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {transaction.invoiceNo}
                </span>
                <span className="font-bold text-emerald-700 text-sm">
                  {formatCurrency(transaction.total)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400 block">Pelanggan:</span>
                  <span className="font-semibold text-slate-800">{transaction.customer.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tanggal:</span>
                  <span className="font-semibold text-slate-800">{transaction.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Metode Pembayaran:</span>
                  <span className="font-semibold text-slate-800">{transaction.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status:</span>
                  <span className="font-semibold text-slate-800">{transaction.status}</span>
                </div>
              </div>

              {/* Rincian Produk di dalam Faktur */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block mb-1">
                  Item dalam Faktur ({transaction.items.length}):
                </span>
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {transaction.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px] text-slate-600">
                      <span className="truncate max-w-[200px]">
                        • {it.name} <strong className="text-slate-800">x{it.quantity}</strong>
                      </span>
                      <span className="font-medium text-slate-700">{formatCurrency(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Checkbox: Restore Stock */}
            <div
              onClick={() => setRestoreStock(!restoreStock)}
              className="p-3 border border-slate-200 hover:border-slate-300 rounded-xl flex items-start gap-2.5 cursor-pointer bg-white transition-colors"
            >
              <div className="mt-0.5 text-[#00871f]">
                {restoreStock ? (
                  <CheckSquare className="w-4 h-4 fill-emerald-100 text-[#00871f]" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">
                  Kembalikan stok produk otomatis ke gudang
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Jumlah barang pada faktur ini akan ditambahkan kembali ke stok dan dicatat pada riwayat mutasi stok (Stok Masuk).
                </p>
              </div>
            </div>

            {/* Delete Reason Input */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Alasan Penghapusan Faktur:
              </label>
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Contoh: Pesanan dibatalkan pelanggan / kesalahan input..."
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-rose-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Faktur Sekarang</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
