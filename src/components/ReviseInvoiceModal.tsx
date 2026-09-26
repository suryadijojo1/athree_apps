import React, { useState } from 'react';
import {
  X,
  FileEdit,
  Trash2,
  Plus,
  Save,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  CreditCard,
  Banknote,
  CheckCircle2,
  UserCheck,
  Shirt,
  Palette,
  ShieldAlert
} from 'lucide-react';
import { Transaction, OrderItem, PaymentMethod, OrderStatus, OrderType, Product } from '../types';
import { formatCurrency } from '../utils/exportUtils';
import { AddSalesModal } from './AddSalesModal';
import { STANDARD_KAOS_COLORS, STANDARD_KAOS_SIZES } from '../data/mockData';
import { isSablonKaosProduct } from '../utils/kaosStockUtils';

interface ReviseInvoiceModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveRevision: (updatedTransaction: Transaction, oldTransaction: Transaction) => void;
  availableProducts: Product[];
  currentUserRole: string;
  currentUserName: string;
  onDeleteInvoice?: (transaction: Transaction) => void;
  salesList?: string[];
  onAddSales?: (newSalesName: string) => void;
  onDeleteSales?: (salesName: string) => void;
}

export const ReviseInvoiceModal: React.FC<ReviseInvoiceModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSaveRevision,
  availableProducts,
  currentUserRole,
  currentUserName,
  onDeleteInvoice,
  salesList = ['Kasir (Dimas)', 'Admin (DEAZBAR)'],
  onAddSales,
  onDeleteSales
}) => {
  if (!isOpen || !transaction) return null;

  // Editable fields initialized from existing transaction
  const [invoiceNo, setInvoiceNo] = useState<string>(transaction.invoiceNo);
  const [transactionDate, setTransactionDate] = useState<string>(
    transaction.date ? transaction.date.replace(' ', 'T') : ''
  );
  const [customerName, setCustomerName] = useState<string>(transaction.customer.name);
  const [customerPhone, setCustomerPhone] = useState<string>(transaction.customer.phone);
  const [orderType, setOrderType] = useState<OrderType>(transaction.orderType);
  const [showAddSalesModal, setShowAddSalesModal] = useState<boolean>(false);
  const [dueDate, setDueDate] = useState<string>(
    transaction.dueDate ? transaction.dueDate.replace(' ', 'T') : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction.paymentMethod);
  const [status, setStatus] = useState<OrderStatus>(transaction.status);
  const [discount, setDiscount] = useState<number>(transaction.discount || 0);
  const [amountPaid, setAmountPaid] = useState<number>(transaction.amountPaid ?? transaction.total);
  const [items, setItems] = useState<OrderItem[]>(
    transaction.items.map((it) => ({ ...it }))
  );
  const [revisionNote, setRevisionNote] = useState<string>('');
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [preparedTx, setPreparedTx] = useState<Transaction | null>(null);

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const remainingAmount = Math.max(0, total - amountPaid);
  const change = Math.max(0, amountPaid - total);
  let paymentStatus: 'LUNAS' | 'PIUTANG' | 'DP' = 'LUNAS';
  if (remainingAmount > 0) {
    paymentStatus = amountPaid > 0 ? 'DP' : 'PIUTANG';
  }

  // Update item quantity
  const handleUpdateQty = (idx: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((it, i) => {
          if (i === idx) {
            const newQ = Math.max(1, it.quantity + delta);
            return {
              ...it,
              quantity: newQ,
              subtotal: newQ * it.price
            };
          }
          return it;
        })
    );
  };

  // Update item price
  const handleUpdatePrice = (idx: number, newPrice: number) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i === idx) {
          const validPrice = Math.max(0, newPrice);
          return {
            ...it,
            price: validPrice,
            subtotal: it.quantity * validPrice
          };
        }
        return it;
      })
    );
  };

  // Update item notes
  const handleUpdateItemNote = (idx: number, note: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, notes: note } : it))
    );
  };

  // Update item Kaos Color
  const handleUpdateItemKaosColor = (idx: number, color: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, kaosColor: color } : it))
    );
  };

  // Update item Kaos Size
  const handleUpdateItemKaosSize = (idx: number, size: string) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, kaosSize: size } : it))
    );
  };

  // Remove item
  const handleRemoveItem = (idx: number) => {
    if (items.length <= 1) {
      alert('Invoice harus memiliki minimal 1 item!');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add new item from products
  const handleAddItem = () => {
    if (!selectedAddProductId) return;
    const prod = availableProducts.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    const isKaos = isSablonKaosProduct(prod.name);
    const existingIdx = items.findIndex((it) => it.productId === prod.id);
    if (existingIdx >= 0 && !isKaos) {
      handleUpdateQty(existingIdx, 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          costPrice: prod.costPrice,
          quantity: 1,
          subtotal: prod.price,
          kaosColor: isKaos ? 'Hitam' : undefined,
          kaosSize: isKaos ? 'L' : undefined
        }
      ]);
    }
    setSelectedAddProductId('');
  };

  // Handle Save
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNo.trim()) {
      alert('Nomor faktur/invoice tidak boleh kosong.');
      return;
    }
    if (items.length === 0) {
      alert('Invoice harus memiliki minimal 1 item.');
      return;
    }

    const formattedDueDate = dueDate ? dueDate.replace('T', ' ') : '-';
    const formattedTransactionDate = transactionDate
      ? transactionDate.replace('T', ' ')
      : transaction.date;
    const auditStamp = `[Revisi oleh ${currentUserRole.toUpperCase()} (${currentUserName}) pd ${new Date().toLocaleString('id-ID')}${revisionNote ? `: ${revisionNote}` : ''}]`;
    const combinedNotes = transaction.notes
      ? `${transaction.notes}\n${auditStamp}`
      : auditStamp;

    const updatedTx: Transaction = {
      ...transaction,
      invoiceNo: invoiceNo.trim(),
      date: formattedTransactionDate,
      customer: {
        ...transaction.customer,
        name: customerName.trim() || 'Pelanggan Umum',
        phone: customerPhone.trim() || '-'
      },
      orderType,
      dueDate: formattedDueDate,
      paymentMethod,
      status,
      items,
      subtotal,
      discount,
      total,
      amountPaid,
      change,
      remainingAmount,
      paymentStatus,
      notes: combinedNotes
    };

    setPreparedTx(updatedTx);
    setShowConfirmModal(true);
  };

  const handleConfirmRevision = () => {
    if (preparedTx) {
      onSaveRevision(preparedTx, transaction);
      setShowConfirmModal(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center shrink-0">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Revisi Invoice / Faktur Pesanan</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {currentUserRole === 'admin' ? 'Akses Admin' : 'Akses Kasir'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Mengedit transaksi: <span className="font-bold text-[#00871f]">{transaction.invoiceNo}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Peringatan Utama Revisi Invoice */}
          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-3 flex items-start gap-2.5 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold text-amber-950 block">PERINGATAN REVISI FAKTUR / INVOICE:</span>
              <span className="text-[11px] text-amber-800">
                Mengubah faktur ini akan memperbarui status transaksi di sistem kasir, menghitung ulang arus kas, dan otomatis menyesuaikan mutasi stok gudang & kaos polos. Pastikan data perubahan telah diverifikasi sebelum disimpan.
              </span>
            </div>
          </div>

          {/* Top Row: Invoice Number, Order Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nomor Faktur / Invoice *
              </label>
              <input
                type="text"
                required
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full text-xs font-mono font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sales</span>
                </label>
                {currentUserRole === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setShowAddSalesModal(true)}
                    className="text-[10px] font-bold text-[#00871f] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Sales</span>
                  </button>
                )}
              </div>
              <select
                value={orderType}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    setShowAddSalesModal(true);
                  } else {
                    setOrderType(e.target.value);
                  }
                }}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white font-medium text-slate-800"
              >
                {salesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {!salesList.includes(orderType) && (
                  <option value={orderType}>{orderType} (Terdahulu)</option>
                )}
                {currentUserRole === 'admin' && (
                  <option value="__ADD_NEW__">+ Tambah Sales Baru...</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Status Pesanan
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white font-bold text-slate-800"
              >
                <option value="Selesai">Selesai (Lunas/Diambil)</option>
                <option value="Sedang Dikerjakan">Sedang Dikerjakan (Produksi)</option>
                <option value="Menunggu">Menunggu / Draft</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>
          </div>

          {/* Row 2: Customer Data, Date & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Tanggal Transaksi
              </label>
              <input
                type="datetime-local"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Nama Pelanggan
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nama pelanggan..."
                className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                No. WhatsApp / Telepon
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0812..."
                className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center gap-1 text-amber-900">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Target Jatuh Tempo
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs font-medium px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/50"
              />
            </div>
          </div>

          {/* Items Table Section */}
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                Daftar Barang &amp; Harga Satuan ({items.length} Item)
              </span>
              {/* Quick Add Product dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedAddProductId}
                  onChange={(e) => setSelectedAddProductId(e.target.value)}
                  className="text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white focus:outline-none max-w-[180px] truncate"
                >
                  <option value="">+ Tambah Produk Katalog...</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.price)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedAddProductId}
                  className="px-2.5 py-1 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  + Tambah
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2.5">Item Produk & Catatan</th>
                    <th className="py-2 px-2.5 text-right w-28">Harga (Rp)</th>
                    <th className="py-2 px-2.5 text-center w-28">Qty</th>
                    <th className="py-2 px-2.5 text-right w-28">Subtotal</th>
                    <th className="py-2 px-2 text-center w-10">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-800">{it.name}</p>
                          {isSablonKaosProduct(it.name) && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-0.5">
                              <Shirt className="w-2.5 h-2.5" />
                              Sablon + Kaos
                            </span>
                          )}
                        </div>

                        {/* Kaos Color & Size selectors if Sablon + Kaos */}
                        {isSablonKaosProduct(it.name) && (
                          <div className="flex items-center gap-2 mt-1 bg-purple-50/60 p-1.5 rounded-lg border border-purple-200/70">
                            <div className="flex items-center gap-1">
                              <Palette className="w-3 h-3 text-purple-600" />
                              <span className="text-[10px] text-slate-600 font-bold">Warna:</span>
                              <select
                                value={it.kaosColor || 'Hitam'}
                                onChange={(e) => handleUpdateItemKaosColor(idx, e.target.value)}
                                className="text-[11px] font-semibold py-0.5 px-1.5 border border-purple-200 rounded bg-white text-purple-900 focus:outline-none focus:ring-1 focus:ring-purple-400"
                              >
                                {STANDARD_KAOS_COLORS.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <Shirt className="w-3 h-3 text-[#00871f]" />
                              <span className="text-[10px] text-slate-600 font-bold">Size:</span>
                              <select
                                value={it.kaosSize || 'L'}
                                onChange={(e) => handleUpdateItemKaosSize(idx, e.target.value)}
                                className="text-[11px] font-bold py-0.5 px-1.5 border border-emerald-300 rounded bg-white text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                {STANDARD_KAOS_SIZES.map((s) => (
                                  <option key={s} value={s}>
                                    Size {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <input
                          type="text"
                          value={it.notes || ''}
                          onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                          placeholder="Catatan sablon / ukuran / spesifikasi..."
                          className="mt-1 w-full text-[11px] px-2 py-0.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f]"
                        />
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={it.price}
                          onChange={(e) => handleUpdatePrice(idx, Number(e.target.value))}
                          className="w-full text-right text-xs font-semibold px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                        />
                      </td>
                      <td className="py-2 px-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, -1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-bold text-slate-800">
                            {it.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, 1)}
                            className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-slate-800">
                        {formatCurrency(it.subtotal)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Hapus baris item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment, Discount & Amount Paid Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Metode Pembayaran
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full text-xs font-medium px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none bg-white"
              >
                <option value="Tunai">Tunai</option>
                <option value="QRIS">QRIS</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="Kartu Debit">Kartu Debit</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Potongan Diskon (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={discount}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Jumlah Telah Dibayar / DP (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value)))}
                className="w-full text-xs font-semibold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
          </div>

          {/* Status Piutang / Pelunasan Banner */}
          {remainingAmount > 0 ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Status: PIUTANG / {paymentStatus}</strong> &bull; Sisa belum terbayar: <strong className="text-amber-800">{formatCurrency(remainingAmount)}</strong>
                </span>
              </div>
              <div className="text-[11px] font-semibold text-amber-700">
                Jatuh Tempo: {dueDate ? dueDate.replace('T', ' ') : 'Sesuai Deadline'}
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Status Pembayaran: LUNAS (Tidak ada piutang)</span>
            </div>
          )}

          {/* Revision Reason / Audit Note */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Alasan / Catatan Revisi Invoice (Audit Log)
            </label>
            <input
              type="text"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="Contoh: Koreksi jumlah pesanan dan nomor telepon pelanggan..."
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
            />
          </div>

          {/* Total Summary Footer */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
            <div className="text-xs space-y-0.5">
              <p className="text-slate-600">Subtotal: {formatCurrency(subtotal)}</p>
              {discount > 0 && (
                <p className="text-rose-600 font-medium">Diskon: -{formatCurrency(discount)}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-[11px] text-emerald-800 font-bold block">TOTAL REVISI AKHIR</span>
              <span className="text-base font-extrabold text-[#00871f]">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-between gap-2">
            {currentUserRole === 'admin' && onDeleteInvoice ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteInvoice(transaction);
                }}
                className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Hapus Faktur Ini (Khusus Admin)"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Hapus Faktur</span>
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#00871f] hover:bg-[#007019] rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Revisi Invoice</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {showAddSalesModal && (
        <AddSalesModal
          isOpen={showAddSalesModal}
          onClose={() => setShowAddSalesModal(false)}
          salesList={salesList}
          onAddSales={(newName) => {
            if (onAddSales) onAddSales(newName);
            setOrderType(newName);
          }}
          onDeleteSales={onDeleteSales}
          onSelectSales={(name) => setOrderType(name)}
        />
      )}

      {/* Confirmation & Warning Dialog Before Committing Invoice Revision */}
      {showConfirmModal && preparedTx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-60 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-amber-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 text-slate-800">
            {/* Modal Header */}
            <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">Konfirmasi Perubahan Faktur</h4>
                  <p className="text-xs text-amber-100 font-mono">Invoice: {preparedTx.invoiceNo}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-semibold text-xs leading-relaxed">
                    Peringatan: Anda akan memperbarui data transaksi ini ke database Cloud. Tindakan ini akan:
                  </p>
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-800 pl-2 text-[11px]">
                  <li>Menyesuaikan stok master dan stok kaos polos secara otomatis.</li>
                  <li>Memperbarui catatan buku kas & rekonsiliasi kasir.</li>
                  <li>Mencatat riwayat audit perubahan oleh akun <span className="font-bold">{currentUserName}</span>.</li>
                </ul>
              </div>

              {/* Difference Summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Nilai Sebelumnya</span>
                  <p className="text-slate-700 font-semibold">{formatCurrency(transaction.total)}</p>
                  <p className="text-[11px] text-slate-500">{transaction.items.length} item • {transaction.status}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] text-emerald-700 font-bold uppercase block">Nilai Setelah Revisi</span>
                  <p className="text-[#00871f] font-bold text-sm">{formatCurrency(preparedTx.total)}</p>
                  <p className="text-[11px] text-emerald-800">{preparedTx.items.length} item • {preparedTx.status}</p>
                </div>
              </div>

              {/* Revision Audit Note Preview */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase block mb-1">
                  Catatan / Alasan Revisi:
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 font-mono">
                  {revisionNote ? revisionNote : 'Koreksi rincian transaksi oleh kasir/admin'}
                </div>
              </div>

              {/* Quick Tag Recommendations */}
              {!revisionNote && (
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">Pilih alasan cepat:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Koreksi kuantitas', 'Perubahan kaos/warna', 'Pelunasan/DP', 'Diskon khusus', 'Permintaan pembeli'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setRevisionNote(tag)}
                        className="px-2 py-0.5 text-[10px] rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 transition-colors cursor-pointer"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                Batal / Periksa Lagi
              </button>
              <button
                type="button"
                onClick={handleConfirmRevision}
                className="px-5 py-2 text-xs font-bold text-white bg-[#00871f] hover:bg-[#007019] rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-200 cursor-pointer transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya, Simpan Revisi Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
