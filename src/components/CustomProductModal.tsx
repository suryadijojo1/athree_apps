import React, { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { OrderItem } from '../types';

interface CustomProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomItem: (item: OrderItem) => void;
}

export const CustomProductModal: React.FC<CustomProductModalProps> = ({
  isOpen,
  onClose,
  onAddCustomItem
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(25000);
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price <= 0 || quantity <= 0) return;

    const newItem: OrderItem = {
      productId: `custom-${Date.now()}`,
      name: name.trim().toUpperCase(),
      sku: 'CUSTOM/ADHOC',
      price: Number(price),
      costPrice: Math.round(Number(price) * 0.6),
      quantity: Number(quantity),
      notes: notes.trim(),
      subtotal: Number(price) * Number(quantity)
    };

    onAddCustomItem(newItem);
    setName('');
    setPrice(25000);
    setQuantity(1);
    setNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#00871f]" />
            Tambah Custom Produk / Layanan
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Nama Layanan / Item Custom *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Sablon Teks Belakang Emas"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Harga Satuan (Rp) *
              </label>
              <input
                type="number"
                min="1000"
                step="1000"
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Jumlah *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ukuran, spesifikasi font, warna tinta..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
            >
              Masukan ke Pesanan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
