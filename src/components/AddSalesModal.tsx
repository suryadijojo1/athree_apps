import React, { useState } from 'react';
import { X, UserCheck, Plus, Trash2, Check, AlertCircle, Shield } from 'lucide-react';

interface AddSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesList: string[];
  onAddSales: (newSalesName: string) => void;
  onDeleteSales?: (salesName: string) => void;
  onSelectSales?: (salesName: string) => void;
}

export const AddSalesModal: React.FC<AddSalesModalProps> = ({
  isOpen,
  onClose,
  salesList,
  onAddSales,
  onDeleteSales,
  onSelectSales
}) => {
  const [newSalesName, setNewSalesName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSalesName.trim();
    if (!trimmed) {
      setError('Nama sales tidak boleh kosong.');
      return;
    }

    if (salesList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setError(`Sales "${trimmed}" sudah terdaftar.`);
      return;
    }

    onAddSales(trimmed);
    if (onSelectSales) {
      onSelectSales(trimmed);
    }
    setNewSalesName('');
    setError('');
    setSuccess(`Sales "${trimmed}" berhasil ditambahkan!`);
    setTimeout(() => {
      setSuccess('');
      onClose();
    }, 900);
  };

  const isDefaultSales = (name: string) => {
    return name === 'Kasir (Dimas)' || name === 'Admin (DEAZBAR)';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Kelola &amp; Tambah Sales</h3>
              <p className="text-xs text-slate-500">Daftar petugas sales untuk transaksi &amp; pesanan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-[#00871f] font-semibold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Form Tambah Sales Baru */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="text-xs font-bold text-slate-700 block">
              Tambah Petugas Sales Baru (Khusus Admin):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSalesName}
                onChange={(e) => {
                  setNewSalesName(e.target.value);
                  setError('');
                }}
                placeholder="Contoh: Sales (Budi) atau Kasir (Siti)..."
                className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white font-medium"
                autoFocus
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-[#00871f] hover:bg-[#00701a] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            </div>
          </form>

          {/* Daftar Sales Yang Ada */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
              <span>Daftar Sales Aktif ({salesList.length}):</span>
              <span className="text-[10px] text-slate-400 font-normal">Klik untuk memilih</span>
            </h4>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {salesList.map((salesName, idx) => {
                const isDef = isDefaultSales(salesName);
                return (
                  <div
                    key={salesName}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 transition-colors group"
                  >
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        if (onSelectSales) {
                          onSelectSales(salesName);
                          onClose();
                        }
                      }}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate">{salesName}</span>
                      {isDef && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-[#00871f] font-bold shrink-0 flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5" />
                          Default
                        </span>
                      )}
                    </div>

                    {!isDef && onDeleteSales && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Hapus sales "${salesName}"?`)) {
                            onDeleteSales(salesName);
                          }
                        }}
                        title={`Hapus ${salesName}`}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors ml-2 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
