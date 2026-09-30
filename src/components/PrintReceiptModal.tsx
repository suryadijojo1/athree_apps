import React, { useState } from 'react';
import { Printer, X, FileText, Check, Download, AlertCircle, Copy } from 'lucide-react';
import { Transaction } from '../types';
import { printTransactionDirectly, PrintFormat } from '../utils/printUtils';
import { downloadTransactionReceiptPDF } from '../utils/exportUtils';

interface PrintReceiptModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  transaction,
  isOpen,
  onClose
}) => {
  const [format, setFormat] = useState<PrintFormat>('thermal80');
  const [isPrinting, setIsPrinting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isOpen || !transaction) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    await printTransactionDirectly(transaction, { format });
    setIsPrinting(false);
  };

  const handleDownloadPDF = () => {
    downloadTransactionReceiptPDF(transaction);
  };

  const handleCopyText = () => {
    const text = `ATHREE STUDIO JAYAPURA\nNo. Faktur: ${transaction.invoiceNo}\nTanggal: ${transaction.date}\nPelanggan: ${transaction.customer.name}\nTotal: Rp ${transaction.total.toLocaleString('id-ID')}\nStatus: ${transaction.status}`;
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 to-[#00871f] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Cetak Struk / SPK ke Printer</h3>
              <p className="text-[11px] text-emerald-100">
                Faktur #{transaction.invoiceNo} &bull; {transaction.customer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Printer Target Info Box */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg shrink-0 mt-0.5">
              <Printer className="w-4 h-4 text-[#00871f]" />
            </div>
            <div className="space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>Tujuan: Langsung ke Printer Fisik</span>
                <span className="text-[10px] bg-[#00871f] text-white px-1.5 py-0.2 rounded font-semibold">Aktif</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Struk langsung dikirim ke jendela cetak sistem. Anda dapat memilih printer tujuan (seperti <strong>Printer Kasir Thermal POS-80/58</strong> atau printer inkjet/laser) tanpa mendownload file PDF.
              </p>
            </div>
          </div>

          {/* Paper Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Format Kertas &amp; Tipe Dokumen:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('thermal80')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  format === 'thermal80'
                    ? 'border-[#00871f] bg-emerald-50/50 ring-2 ring-[#00871f]/20 font-bold text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="text-xs font-bold">Thermal 80mm</div>
                <div className="text-[10px] text-slate-500 font-normal">Struk Kasir Standar</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('thermal58')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  format === 'thermal58'
                    ? 'border-[#00871f] bg-emerald-50/50 ring-2 ring-[#00871f]/20 font-bold text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="text-xs font-bold">Thermal 58mm</div>
                <div className="text-[10px] text-slate-500 font-normal">Struk Kasir Mini</div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('spk_a4')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                  format === 'spk_a4'
                    ? 'border-[#00871f] bg-emerald-50/50 ring-2 ring-[#00871f]/20 font-bold text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className="text-xs font-bold">SPK A4 / Nota</div>
                <div className="text-[10px] text-slate-500 font-normal">Surat Perintah Kerja</div>
              </button>
            </div>
          </div>

          {/* Quick Preview Box */}
          <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 font-mono text-[11px] leading-relaxed max-h-48 overflow-y-auto">
            <div className="text-center font-bold text-slate-800">ATHREE STUDIO JAYAPURA</div>
            <div className="text-center text-[10px] text-slate-500 border-b border-dashed border-slate-300 pb-1 mb-2">
              Jl. Raya Abepura - Jayapura
            </div>
            <div className="flex justify-between">
              <span>Faktur:</span>
              <span className="font-bold">{transaction.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span className="font-semibold">{transaction.customer.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Jatuh Tempo:</span>
              <span className="font-semibold text-rose-600">{transaction.dueDate || 'Langsung Selesai'}</span>
            </div>
            <div className="border-t border-dashed border-slate-300 my-1.5" />
            <div className="space-y-1">
              {transaction.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="truncate max-w-[200px]">{it.quantity}x {it.name}</span>
                  <span className="font-semibold">Rp {it.subtotal.toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-slate-300 my-1.5" />
            <div className="flex justify-between font-bold text-xs text-slate-800">
              <span>TOTAL:</span>
              <span>Rp {transaction.total.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Dibayar ({transaction.paymentMethod}):</span>
              <span>Rp {transaction.amountPaid.toLocaleString('id-ID')}</span>
            </div>
            {transaction.remainingAmount && transaction.remainingAmount > 0 ? (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>Sisa Piutang:</span>
                <span>Rp {transaction.remainingAmount.toLocaleString('id-ID')}</span>
              </div>
            ) : (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Kembalian:</span>
                <span>Rp {transaction.change.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Salin Rincian Teks"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copyFeedback ? 'Tersalin!' : 'Salin'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Unduh file PDF ke komputer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Unduh PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-5 py-2.5 bg-[#00871f] hover:bg-[#007019] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? 'Membuka Printer...' : 'Cetak Langsung ke Printer'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
