import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Calendar,
  Wallet,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign
} from 'lucide-react';
import { Transaction, PaymentMethod } from '../types';
import { formatCurrency } from '../utils/exportUtils';

interface PayPiutangModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSavePayment: (
    txId: string,
    paymentData: {
      amount: number;
      date: string;
      paymentMethod: PaymentMethod;
      notes: string;
    }
  ) => void;
  currentUserName: string;
}

export const PayPiutangModal: React.FC<PayPiutangModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSavePayment,
  currentUserName
}) => {
  // Current local date & time helper: YYYY-MM-DDTHH:mm
  const getNowLocalDateTime = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  };

  const currentRemaining = transaction
    ? Math.max(0, transaction.remainingAmount ?? (transaction.total - transaction.amountPaid))
    : 0;

  const [payAmount, setPayAmount] = useState<number>(currentRemaining);
  const [paymentDate, setPaymentDate] = useState<string>(getNowLocalDateTime());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Tunai');
  const [notes, setNotes] = useState<string>('Pelunasan piutang');

  useEffect(() => {
    if (transaction && isOpen) {
      const rem = Math.max(0, transaction.remainingAmount ?? (transaction.total - transaction.amountPaid));
      setPayAmount(rem);
      setPaymentDate(getNowLocalDateTime());
      setPaymentMethod('Tunai');
      setNotes(`Pelunasan sisa piutang faktur ${transaction.invoiceNo}`);
    }
  }, [transaction, isOpen]);

  const remainingAfterPayment = Math.max(0, currentRemaining - payAmount);
  const isFullSettlement = payAmount >= currentRemaining && currentRemaining > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;
    if (payAmount <= 0) {
      alert('Nominal pembayaran harus lebih dari Rp 0');
      return;
    }

    // Format date string: ensure readable YYYY-MM-DD HH:mm
    const formattedDate = paymentDate.replace('T', ' ');

    onSavePayment(transaction.id, {
      amount: payAmount,
      date: formattedDate,
      paymentMethod,
      notes: notes.trim()
    });

    onClose();
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-[#00871f]">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Pembayaran / Pelunasan Sisa Piutang
              </h3>
              <p className="text-xs text-slate-500">
                Faktur: <span className="font-mono font-bold text-[#00871f]">{transaction.invoiceNo}</span> &bull; {transaction.customer.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pt-4 space-y-4 pr-1">
          {/* Status Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Faktur</span>
              <span className="font-bold text-slate-800 text-sm">{formatCurrency(transaction.total)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Telah Dibayar</span>
              <span className="font-bold text-emerald-700 text-sm">{formatCurrency(transaction.amountPaid)}</span>
            </div>
            <div className="bg-amber-50 rounded-lg p-1 border border-amber-200">
              <span className="text-[10px] text-amber-700 block font-semibold uppercase">Sisa Piutang</span>
              <span className="font-black text-rose-600 text-sm">{formatCurrency(currentRemaining)}</span>
            </div>
          </div>

          {/* Form Input 1: Nominal Bayar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Nominal Pembayaran Piutang (Rp) *
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPayAmount(currentRemaining)}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 hover:bg-emerald-200 text-[#00871f] cursor-pointer"
                >
                  Lunasi Penuh
                </button>
                {currentRemaining > 100000 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(Math.round(currentRemaining / 2))}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    50%
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                required
                min="1000"
                max={currentRemaining}
                step="1000"
                value={payAmount}
                onChange={(e) => setPayAmount(Math.min(currentRemaining, Math.max(0, Number(e.target.value))))}
                className="w-full pl-9 pr-3 py-2 text-sm font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
          </div>

          {/* Form Input 2: Tanggal Pembayaran */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#00871f]" />
                Tanggal Pembayaran Piutang *
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                (Disesuaikan ke Laporan Penjualan Harian)
              </span>
            </label>
            <input
              type="datetime-local"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white font-mono"
            />
            <p className="text-[10.5px] text-slate-500 mt-1">
              Catatan: Apabila pembayaran tunai di tanggal tersebut, akan langsung ditambahkan ke <strong>Laporan Penjualan Harian</strong> pada tanggal tersebut.
            </p>
          </div>

          {/* Form Input 3: Metode Pembayaran */}
          <div>
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#00871f]" />
              Metode Pembayaran *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Tunai', 'QRIS', 'Transfer Bank', 'Kartu Debit'] as PaymentMethod[]).map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#00871f] bg-emerald-50 text-[#00871f] ring-1 ring-[#00871f] shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{method}</span>
                    {method === 'Tunai' && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-200 text-emerald-900 font-semibold">
                        Laci Kas
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {paymentMethod === 'Tunai' ? (
              <div className="mt-2 p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Uang tunai sebesar <strong>{formatCurrency(payAmount)}</strong> akan tercatat pada Kas Harian (Laci).</span>
              </div>
            ) : (
              <div className="mt-2 p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Penerimaan non-tunai via {paymentMethod} akan tercatat pada ringkasan rekening/digital.</span>
              </div>
            )}
          </div>

          {/* Form Input 4: Catatan */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Keterangan / Catatan Pelunasan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pelunasan sisa cetak kaos via kasir..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
            />
          </div>

          {/* Preview Hasil Akhir */}
          <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-600">
              <span>Sisa Piutang Setelah Pembayaran Ini:</span>
              <span className={`font-bold ${remainingAfterPayment === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {remainingAfterPayment === 0 ? 'Rp 0 (LUNAS)' : formatCurrency(remainingAfterPayment)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Status Pembayaran Faktur:</span>
              <span className="font-bold text-slate-800">
                {isFullSettlement ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                    LUNAS
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                    DP / PIUTANG SISA {formatCurrency(remainingAfterPayment)}
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200 text-[11px]">
              <span>Dicatat Oleh:</span>
              <span className="font-semibold text-slate-700">{currentUserName}</span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={payAmount <= 0}
              className="px-5 py-2 text-xs font-bold text-white bg-[#00871f] hover:bg-[#007019] rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Pembayaran &amp; Perbarui Laporan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
