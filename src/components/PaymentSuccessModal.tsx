import React from 'react';
import { CheckCircle2, Printer, Download, Share2, X, Clock, Calendar, FileEdit, Trash2 } from 'lucide-react';
import { Transaction } from '../types';
import { formatCurrency, downloadTransactionReceiptPDF } from '../utils/exportUtils';

interface PaymentSuccessModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  onRevise?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  isAdmin?: boolean;
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  transaction,
  onClose,
  onRevise,
  onDelete,
  isAdmin = false
}) => {
  if (!transaction) return null;

  const isPiutang = Boolean(transaction.remainingAmount && transaction.remainingAmount > 0);

  const handleShareWA = () => {
    const piutangInfo = isPiutang
      ? `\n*Status:* DP / Piutang Belum Lunas\n*Dibayar:* ${formatCurrency(transaction.amountPaid)}\n*Sisa Piutang:* ${formatCurrency(transaction.remainingAmount || 0)}\n*Jatuh Tempo Pelunasan:* ${transaction.dueDate || '-'}`
      : `\n*Status:* LUNAS (Selesai)`;
    const text = `*ATHREE STUDIO JAYAPURA*\nNo Faktur: ${transaction.invoiceNo}\nPelanggan: ${transaction.customer.name}\nTotal: ${formatCurrency(transaction.total)}${piutangInfo}\nTarget Jatuh Tempo: ${transaction.dueDate || '-'}\nTerima kasih atas pesanan Anda!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Top Success Icon */}
        <div className="flex flex-col items-center text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Transaksi Berhasil!</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{transaction.invoiceNo}</p>
        </div>

        {/* Tanggal Jatuh Tempo Penyelesaian Highlighted Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs">
          <div className="flex items-center justify-between text-amber-900 font-bold mb-1">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Jatuh Tempo Penyelesaian
            </span>
          </div>
          <p className="text-xs font-bold text-slate-900">
            {transaction.dueDate || 'Langsung Diambil'}
          </p>
          <span className="text-[10px] text-amber-700">
            Harap informasikan tanggal ini kepada pelanggan
          </span>
        </div>

        {/* Receipt Details Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Pelanggan:</span>
            <span className="font-bold text-slate-800">{transaction.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tipe Order:</span>
            <span className="font-semibold text-slate-700">{transaction.orderType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Metode Bayar:</span>
            <span className="font-semibold text-slate-700">{transaction.paymentMethod}</span>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm">
            <span>Total Tagihan:</span>
            <span className="text-[#00871f]">{formatCurrency(transaction.total)}</span>
          </div>

          {isPiutang ? (
            <div className="pt-2 border-t border-amber-200 bg-amber-50/70 p-2.5 rounded-lg space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Dibayar / Uang Muka (DP):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(transaction.amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold text-rose-600">
                <span>Sisa Piutang:</span>
                <span>{formatCurrency(transaction.remainingAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-amber-900 pt-1 border-t border-amber-200/60 font-semibold">
                <span>Jatuh Tempo Pelunasan:</span>
                <span>{transaction.dueDate || 'Sesuai Deadline'}</span>
              </div>
            </div>
          ) : (
            transaction.paymentMethod === 'Tunai' && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Uang Diterima:</span>
                  <span>{formatCurrency(transaction.amountPaid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-emerald-600">
                  <span>Kembalian:</span>
                  <span>{formatCurrency(transaction.change)}</span>
                </div>
              </>
            )
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => downloadTransactionReceiptPDF(transaction)}
            className="w-full py-2.5 bg-[#00871f] hover:bg-[#007019] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Unduh Struk (PDF)</span>
          </button>

          {onRevise && (
            <button
              onClick={() => {
                onClose();
                onRevise(transaction);
              }}
              className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileEdit className="w-4 h-4 text-amber-700" />
              <span>Revisi Faktur / Invoice Ini</span>
            </button>
          )}

          {isAdmin && onDelete && (
            <button
              onClick={() => {
                onClose();
                onDelete(transaction);
              }}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Hapus Faktur Ini (Khusus Admin)</span>
            </button>
          )}

          <button
            onClick={handleShareWA}
            className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Kirim Bukti via WhatsApp</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Selesai / Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
};
