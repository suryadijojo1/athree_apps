import React, { useState, useEffect } from 'react';
import {
  X,
  FileEdit,
  Trash2,
  Save,
  AlertTriangle,
  Calendar,
  Coins,
  CreditCard,
  Banknote,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { CashFlowRecord, User } from '../types';
import { formatCurrency } from '../utils/exportUtils';

interface ReviseCashFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: CashFlowRecord | null;
  onSaveRevision: (updatedRecord: CashFlowRecord) => void;
  onDeleteRecord?: (recordId: string) => void;
  currentUser: User;
}

export const ReviseCashFlowModal: React.FC<ReviseCashFlowModalProps> = ({
  isOpen,
  onClose,
  record,
  onSaveRevision,
  onDeleteRecord,
  currentUser
}) => {
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('12:00');
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
  const [description, setDescription] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  useEffect(() => {
    if (record && isOpen) {
      // Parse date & time
      if (record.date) {
        const parts = record.date.split(' ');
        setDate(parts[0] || new Date().toISOString().slice(0, 10));
        setTime(parts[1] || new Date().toTimeString().slice(0, 5));
      } else {
        setDate(new Date().toISOString().slice(0, 10));
        setTime(new Date().toTimeString().slice(0, 5));
      }

      setAmount(record.amount || 0);
      setDescription(record.description || '');

      // Payment method for income (default to TUNAI if not set)
      if (record.paymentMethod === 'TRANSFER') {
        setPaymentMethod('TRANSFER');
      } else {
        setPaymentMethod('TUNAI');
      }

      // Check category
      const standardIncome = [
        'Jasa Desain Tambahan',
        'Ongkos Kirim / Ekspedisi',
        'Jasa Maklon Cetak',
        'Pendapatan Sewa / Lainnya'
      ];
      const standardExpense = [
        'Bahan Baku & Tinta',
        'Bahan Baku & Tinta Sablon',
        'Listrik & Operasional',
        'Gaji / Uang Makan Staf',
        'Maintenance Mesin Sablon',
        'Pengeluaran Lainnya'
      ];

      const checkList = record.type === 'INCOME' ? standardIncome : standardExpense;
      if (checkList.includes(record.category)) {
        setCategory(record.category);
        setIsCustomCategory(false);
        setCustomCategory('');
      } else {
        setCategory('__CUSTOM__');
        setIsCustomCategory(true);
        setCustomCategory(record.category || '');
      }

      setConfirmDelete(false);
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const isIncome = record.type === 'INCOME';

  const handleQuickAddAmount = (addValue: number) => {
    setAmount((prev) => Math.max(0, (prev || 0) + addValue));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('Nominal harus lebih besar dari 0!');
      return;
    }

    const finalCategory = isCustomCategory ? (customCategory.trim() || 'Lain-lain') : category;
    const finalDate = `${date} ${time}`;

    const updated: CashFlowRecord = {
      ...record,
      category: finalCategory,
      amount: Number(amount),
      description: description.trim(),
      date: finalDate,
      paymentMethod: isIncome ? paymentMethod : 'TUNAI',
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.name
    };

    onSaveRevision(updated);
    onClose();
  };

  const handleDelete = () => {
    if (!onDeleteRecord) return;
    onDeleteRecord(record.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 text-slate-800 overflow-hidden">
        {/* Header */}
        <div
          className={`p-4 border-b flex items-center justify-between ${
            isIncome
              ? 'bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-white border-emerald-100'
              : 'bg-gradient-to-r from-rose-50 via-rose-50/50 to-white border-rose-100'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                isIncome ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>{isIncome ? 'Revisi Pendapatan Lain' : 'Revisi Pengeluaran Toko'}</span>
                <span
                  className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                    isIncome ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {isIncome ? 'Kas Masuk (+)' : 'Kas Keluar (-)'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Ubah nominal, tanggal, kategori, atau metode penerimaan transaksi ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Tanggal & Waktu */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Tanggal Transaksi *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Waktu (Jam:Menit)
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
              />
            </div>
          </div>

          {/* OPSI TRANSFER / TUNAI (Khusus Pendapatan Lain) */}
          {isIncome && (
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Opsi Penerimaan Pembayaran *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TUNAI')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    paymentMethod === 'TUNAI'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-xs">
                    <Coins className={`w-4 h-4 ${paymentMethod === 'TUNAI' ? 'text-emerald-700' : 'text-slate-500'}`} />
                    <span>💵 Tunai (Kas Fisik)</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 mt-1.5 leading-snug">
                    <strong className="text-emerald-800">Ditambahkan ke kas toko</strong> per hari tanggal saat diinput &amp; tercatat di daftar transaksi penjualan.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black text-xs">
                    <CreditCard className={`w-4 h-4 ${paymentMethod === 'TRANSFER' ? 'text-blue-700' : 'text-slate-500'}`} />
                    <span>💳 Transfer Bank</span>
                  </div>
                  <p className="text-[10.5px] text-slate-600 mt-1.5 leading-snug">
                    <strong className="text-blue-800">Hanya tercatat</strong> di daftar transaksi penjualan &amp; omset, <span className="underline decoration-rose-400">TIDAK ditambahkan ke kas fisik</span> toko.
                  </p>
                </button>
              </div>

              <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {paymentMethod === 'TUNAI'
                    ? 'Status: Saldo kas toko tanggal terkait otomatis bertambah sesuai nominal.'
                    : 'Status: Masuk rekapan penjualan/omset tanpa mempengaruhi hitungan kas laci.'}
                </span>
              </div>
            </div>
          )}

          {/* Kategori */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kategori {isIncome ? 'Pendapatan' : 'Biaya / Pengeluaran'} *
            </label>
            <select
              value={category}
              onChange={(e) => {
                const val = e.target.value;
                setCategory(val);
                setIsCustomCategory(val === '__CUSTOM__');
              }}
              className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white cursor-pointer"
            >
              {isIncome ? (
                <>
                  <option value="Jasa Desain Tambahan">Jasa Desain Tambahan</option>
                  <option value="Ongkos Kirim / Ekspedisi">Ongkos Kirim / Ekspedisi</option>
                  <option value="Jasa Maklon Cetak">Jasa Maklon Cetak</option>
                  <option value="Pendapatan Sewa / Lainnya">Pendapatan Sewa / Lainnya</option>
                  <option value="__CUSTOM__">+ Ketik Kategori Lainnya...</option>
                </>
              ) : (
                <>
                  <option value="Bahan Baku & Tinta">Bahan Baku &amp; Tinta Sablon</option>
                  <option value="Listrik & Operasional">Listrik &amp; Operasional</option>
                  <option value="Gaji / Uang Makan Staf">Gaji / Uang Makan Staf</option>
                  <option value="Maintenance Mesin Sablon">Maintenance Mesin Sablon</option>
                  <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
                  <option value="__CUSTOM__">+ Ketik Kategori Lainnya...</option>
                </>
              )}
            </select>

            {isCustomCategory && (
              <input
                type="text"
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Masukkan nama kategori baru..."
                className="mt-2 w-full text-xs px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-emerald-50/20"
              />
            )}
          </div>

          {/* Nominal (Rp) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Nominal {isIncome ? 'Pendapatan' : 'Pengeluaran'} (Rp) *
              </label>
              <span className={`text-xs font-black ${isIncome ? 'text-[#00871f]' : 'text-rose-600'}`}>
                {formatCurrency(amount)}
              </span>
            </div>
            <input
              type="number"
              min="1000"
              step="1000"
              required
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Contoh: 50000"
              className={`w-full text-base font-extrabold px-3 py-2 border rounded-lg focus:ring-2 focus:outline-none ${
                isIncome
                  ? 'border-emerald-200 focus:ring-emerald-500 text-emerald-900 bg-emerald-50/20'
                  : 'border-rose-200 focus:ring-rose-500 text-rose-900 bg-rose-50/20'
              }`}
            />
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-slate-400 font-semibold mr-1">Tambah Cepat:</span>
              {[10000, 25000, 50000, 100000, 200000, 500000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAddAmount(val)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
                >
                  +{val >= 1000 ? `${val / 1000}rb` : val}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(0)}
                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Keterangan Singkat */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Keterangan / Catatan Singkat
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isIncome ? 'Misal: Biaya edit mockup kaos 2 sisi' : 'Misal: Beli tinta plastisol hitam 1kg'}
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Audit Info */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/70 text-[11px] text-slate-500 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3 h-3 text-slate-400" />
                Dicatat Pertama Kali:
              </span>
              <span className="font-bold text-slate-700">{record.recordedBy || 'Admin'}</span>
            </div>
            {record.updatedBy && (
              <div className="flex items-center justify-between text-slate-400">
                <span>Terakhir Direvisi:</span>
                <span className="font-medium text-slate-600">
                  {record.updatedBy} ({record.updatedAt ? record.updatedAt.slice(0, 16).replace('T', ' ') : '-'})
                </span>
              </div>
            )}
          </div>

          {/* Confirmation Box for Delete */}
          {confirmDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-1">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Yakin ingin menghapus catatan {isIncome ? 'pendapatan' : 'pengeluaran'} ini?</span>
              </div>
              <p className="text-[11px] text-rose-700 mb-2.5">
                Data akan dihapus permanen dari buku kas dan riwayat transaksi. Saldo kas akan disesuaikan otomatis.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 text-xs font-semibold bg-white border border-rose-200 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Ya, Hapus Catatan
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <div>
              {onDeleteRecord && !confirmDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  isIncome
                    ? 'bg-[#00871f] hover:bg-[#007019]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
