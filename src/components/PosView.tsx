import React, { useState, useMemo } from 'react';
import {
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Trash2,
  Plus,
  Minus,
  Banknote,
  CreditCard,
  Calendar,
  Clock,
  User,
  PlusCircle,
  FileCheck,
  AlertCircle,
  QrCode,
  Sparkles,
  ShoppingBag,
  FileEdit,
  X,
  UserCheck,
  Lock,
  Unlock
} from 'lucide-react';
import {
  Product,
  OrderItem,
  OrderType,
  PaymentMethod,
  Customer,
  Transaction,
  CashierShift
} from '../types';
import { formatCurrency } from '../utils/exportUtils';
import { AddSalesModal } from './AddSalesModal';

interface PosViewProps {
  products: Product[];
  categories: string[];
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onOpenCustomProductModal: () => void;
  onCompletePayment: (transaction: Omit<Transaction, 'id'>) => void;
  onSaveAsPendingOrder: (transaction: Omit<Transaction, 'id'>) => void;
  cashierName: string;
  cashierId: string;
  searchQuery: string;
  recentTransactions?: Transaction[];
  onReviseInvoice?: (transaction: Transaction) => void;
  salesList?: string[];
  onAddSales?: (newSalesName: string) => void;
  onDeleteSales?: (salesName: string) => void;
  isAdmin?: boolean;
  shift?: CashierShift;
  onOpenShiftModal?: (mode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history') => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  categories,
  customers,
  onAddCustomer,
  onOpenCustomProductModal,
  onCompletePayment,
  onSaveAsPendingOrder,
  cashierName,
  cashierId,
  searchQuery,
  recentTransactions = [],
  onReviseInvoice,
  salesList = ['Kasir (Dimas)', 'Admin (DEAZBAR)'],
  onAddSales,
  onDeleteSales,
  isAdmin = false,
  shift,
  onOpenShiftModal
}) => {
  // Modal state for selecting an invoice to revise
  const [showSelectInvoiceModal, setShowSelectInvoiceModal] = useState<boolean>(false);
  // Catalog View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Active Cart / Order
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [selectedSales, setSelectedSales] = useState<string>(() => {
    if (isAdmin && salesList.includes('Admin (DEAZBAR)')) return 'Admin (DEAZBAR)';
    return salesList[0] || 'Kasir (Dimas)';
  });
  const [showAddSalesModal, setShowAddSalesModal] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'c0');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // TANGGAL JATUH TEMPO PENYELESAIAN (Due Date for completion/production)
  // Default to 3 days from now
  const getDefaultDueDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    d.setHours(17, 0, 0, 0);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  };
  const [dueDate, setDueDate] = useState<string>(getDefaultDueDate());

  // Payment state
  const [paymentMethodTab, setPaymentMethodTab] = useState<'Tunai' | 'Non Tunai'>('Tunai');
  const [nonCashType, setNonCashType] = useState<'QRIS' | 'Transfer Bank' | 'Kartu Debit'>('QRIS');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [cashGiven, setCashGiven] = useState<number>(0);

  // New customer quick modal
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');
  const [newCustAddress, setNewCustAddress] = useState<string>('');

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'Semua'
          ? true
          : selectedCategory === 'Favorit'
          ? !!p.isFavorite
          : p.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  }, [cartItems]);

  const total = Math.max(0, subtotal - discountAmount);

  const totalQuantity = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Sisa tagihan or Kembalian
  const effectiveCash = paymentMethodTab === 'Tunai' ? cashGiven : total;
  const remainingBill = Math.max(0, total - effectiveCash);
  const changeAmount = Math.max(0, effectiveCash - total);

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            costPrice: product.costPrice,
            quantity: 1,
            notes: '',
            subtotal: product.price
          }
        ];
      }
    });
  };

  // Update item quantity
  const handleUpdateQty = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, subtotal: newQty * item.price }
              : null;
          }
          return item;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  // Update item note
  const handleUpdateItemNote = (productId: string, note: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, notes: note } : item
      )
    );
  };

  // Remove single item
  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Cancel / Clear Cart
  const handleClearCart = () => {
    if (cartItems.length > 0) {
      if (window.confirm('Batalkan dan kosongkan semua rincian pesanan?')) {
        setCartItems([]);
        setDiscountAmount(0);
        setCashGiven(0);
      }
    }
  };

  // Save new customer
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    const newCust: Customer = {
      id: `c-${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '-',
      address: newCustAddress.trim() || '-'
    };
    onAddCustomer(newCust);
    setSelectedCustomerId(newCust.id);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustAddress('');
    setShowAddCustomerModal(false);
  };

  // Quick preset days for Due Date
  const setDuePreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(17, 0, 0, 0);
    setDueDate(d.toISOString().slice(0, 16));
  };

  // Handle Pay
  const handlePay = () => {
    if (cartItems.length === 0) {
      alert('Rincian pesanan masih kosong. Silakan pilih produk terlebih dahulu.');
      return;
    }

    if (paymentMethodTab === 'Tunai' && cashGiven < total) {
      alert(`Uang pembayaran tunai masih kurang ${formatCurrency(total - cashGiven)}.`);
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const finalPaymentMethod: PaymentMethod =
      paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType;

    const formattedDueDate = dueDate ? dueDate.replace('T', ' ') : '-';
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    onCompletePayment({
      invoiceNo: `#INV/${String(Math.floor(10000 + Math.random() * 90000))}`,
      date: nowStr,
      dueDate: formattedDueDate,
      customer,
      orderType: selectedSales,
      items: cartItems,
      subtotal,
      discount: discountAmount,
      tax: 0,
      total,
      paymentMethod: finalPaymentMethod,
      amountPaid: paymentMethodTab === 'Tunai' ? cashGiven : total,
      change: changeAmount,
      status: 'Selesai',
      cashierName,
      cashierId,
      notes: orderNotes
    });

    // Reset cart
    setCartItems([]);
    setDiscountAmount(0);
    setCashGiven(0);
    setOrderNotes('');
  };

  // Handle Save as In-Progress / Pending Production Order
  const handleSaveAsPending = () => {
    if (cartItems.length === 0) {
      alert('Rincian pesanan masih kosong.');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const finalPaymentMethod: PaymentMethod =
      paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType;

    const formattedDueDate = dueDate ? dueDate.replace('T', ' ') : '-';
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');

    onSaveAsPendingOrder({
      invoiceNo: `#ORD/${String(Math.floor(10000 + Math.random() * 90000))}`,
      date: nowStr,
      dueDate: formattedDueDate,
      customer,
      orderType: selectedSales,
      items: cartItems,
      subtotal,
      discount: discountAmount,
      tax: 0,
      total,
      paymentMethod: finalPaymentMethod,
      amountPaid: effectiveCash,
      change: changeAmount,
      status: 'Sedang Dikerjakan',
      cashierName,
      cashierId,
      notes: orderNotes
    });

    alert('Pesanan berhasil disimpan ke Antrean Produksi dengan Jatuh Tempo: ' + formattedDueDate);
    setCartItems([]);
    setDiscountAmount(0);
    setCashGiven(0);
    setOrderNotes('');
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
      {/* =========================================================================
          COLUMN 1 (Catalog): 5 cols on lg, 4 on xl
      ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-4 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
        {/* Top bar: Shift Status, View toggle & Categories */}
        <div className="p-3 border-b border-slate-200 flex flex-col gap-2">
          {shift && (
            <div className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
              shift.isOpen 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`w-2 h-2 rounded-full shrink-0 ${shift.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <div className="truncate">
                  <span className="font-bold">
                    {shift.isOpen ? `Shift #${shift.shiftNumber || 2} Aktif` : 'Shift Tutup'}
                  </span>
                  {shift.isOpen && shift.startTime && (
                    <span className="text-[11px] text-slate-500 ml-1.5 hidden sm:inline">
                      &bull; Buka: {shift.startTime}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {shift.isOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpenShiftModal?.('reconcile')}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="Menu Akhiri Shift Kasir & Logout Sistem"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Akhiri Shift</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenShiftModal?.('open_shift')}
                    className="px-2.5 py-1 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="Buka Shift Kasir Baru (Tanggal & Jam Otomatis)"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Buka Shift</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Grid / List view mode switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-[#00871f] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-[#00871f] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan List"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Category pills with horizontal scroll */}
            <div className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#00871f] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Container */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredProducts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1" />
              <p>Tidak ada produk yang cocok</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAddToCart(p)}
                  className="group relative bg-white border border-slate-200 rounded-xl p-2.5 text-left hover:border-[#00871f] hover:shadow-md transition-all flex flex-col justify-between active:scale-[0.98]"
                >
                  {/* Price Tag badge on top-left (matches screenshot) */}
                  <span className="inline-block self-start px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold border border-slate-200 mb-1.5">
                    {(p.price / 1000).toLocaleString('id-ID')}.000
                  </span>

                  {/* Pastel Box with Large 2-Char Initials (matches screenshot) */}
                  <div
                    className={`w-full aspect-square rounded-lg flex items-center justify-center border font-bold text-2xl tracking-tighter mb-2 transition-transform group-hover:scale-105 ${p.colorBadge}`}
                  >
                    {p.initials}
                  </div>

                  {/* Product Title & SKU */}
                  <div className="w-full">
                    <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight uppercase">
                      {p.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.sku}</p>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                      <span
                        className={`text-[10px] font-medium ${
                          p.stock <= p.minStock ? 'text-rose-600 font-bold' : 'text-slate-500'
                        }`}
                      >
                        Stok: {p.stock}
                      </span>
                      <span className="text-[10px] text-[#00871f] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        + Tambah
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* List Mode */
            <div className="flex flex-col divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleAddToCart(p)}
                  className="py-2 px-2 hover:bg-emerald-50/50 rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm border shrink-0 ${p.colorBadge}`}
                    >
                      {p.initials}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 leading-snug">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {p.sku} | Stok: {p.stock}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800">
                      {formatCurrency(p.price)}
                    </span>
                    <button className="block text-[10px] text-[#00871f] font-semibold hover:underline">
                      + Tambah
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          COLUMN 2 (Rincian Pesanan / Cart Details): 4 cols on lg, 4 on xl
      ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-4 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
        {/* Customer & Sales Selector dropdowns */}
        <div className="px-3 py-2 border-b border-slate-200 space-y-2 bg-slate-50/50">
          {/* Pelanggan */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                <User className="w-3 h-3 text-slate-400" />
                Pelanggan
              </span>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs font-medium py-1.5 pl-2 pr-6 bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-[#00871f] focus:outline-none shadow-2xs"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone !== '-' ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setShowAddCustomerModal(true)}
              title="Tambah Pelanggan Baru"
              className="mt-3.5 p-1.5 text-[#00871f] hover:bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer bg-white shrink-0 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pelanggan</span>
            </button>
          </div>

          {/* Sales */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-[#00871f]" />
                  Sales
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddSalesModal(true)}
                    className="text-[10px] font-bold text-[#00871f] hover:underline cursor-pointer"
                  >
                    + Kelola Sales
                  </button>
                )}
              </div>
              <select
                value={selectedSales}
                onChange={(e) => {
                  if (e.target.value === '__ADD_NEW__') {
                    setShowAddSalesModal(true);
                  } else {
                    setSelectedSales(e.target.value);
                  }
                }}
                className="w-full text-xs font-bold py-1.5 pl-2 pr-6 bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-[#00871f] focus:outline-none shadow-2xs"
              >
                {salesList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {isAdmin && (
                  <option value="__ADD_NEW__">+ Tambah Sales Baru...</option>
                )}
              </select>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAddSalesModal(true)}
                title="Tambah Sales Baru (Khusus Admin)"
                className="mt-3.5 p-1.5 text-[#00871f] hover:bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer bg-white shrink-0 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sales</span>
              </button>
            )}
          </div>
        </div>

        {/* Rincian Pesanan Header & Action buttons */}
        <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Rincian Pesanan</h2>
          <div className="flex items-center gap-1.5">
            {onReviseInvoice && (
              <button
                type="button"
                onClick={() => setShowSelectInvoiceModal(true)}
                title="Pilih invoice untuk diedit / direvisi"
                className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Revisi Invoice</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCustomProductModal}
              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              Custom Produk
            </button>
            <button
              type="button"
              onClick={handleClearCart}
              disabled={cartItems.length === 0}
              className="px-2.5 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:text-rose-600 hover:border-rose-200 disabled:opacity-40 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>

        {/* Order Items List OR Empty State Illustration */}
        <div className="flex-1 overflow-y-auto p-3">
          {cartItems.length === 0 ? (
            /* Empty State Illustration matching screenshot */
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
              <div className="w-24 h-24 mb-4 relative flex items-center justify-center">
                {/* Clean folder / document tray graphic */}
                <div className="w-16 h-14 bg-slate-200/70 rounded-lg border border-slate-300 relative flex items-center justify-center">
                  <div className="w-10 h-10 bg-white rounded-md border border-slate-300 shadow-xs flex flex-col p-1.5 gap-1 -translate-y-2">
                    <div className="w-full h-1 bg-slate-200 rounded"></div>
                    <div className="w-3/4 h-1 bg-slate-200 rounded"></div>
                    <div className="w-1/2 h-1 bg-slate-200 rounded"></div>
                  </div>
                </div>
                {/* Speech bubble */}
                <div className="absolute top-2 right-1 w-6 h-5 bg-slate-300 rounded-full flex items-center justify-center gap-0.5">
                  <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                  <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                  <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-400">Belum ada pesanan</p>
              <p className="text-xs text-slate-400 mt-1 text-center max-w-xs">
                Pilih produk dari katalog di sebelah kiri untuk menambahkan ke pesanan kasir
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col gap-2 group hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.sku} &bull; {formatCurrency(item.price)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-900 shrink-0">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>

                  {/* Note input for custom instructions (e.g. Size, Jersey Name, Color) */}
                  <input
                    type="text"
                    value={item.notes || ''}
                    onChange={(e) => handleUpdateItemNote(item.productId, e.target.value)}
                    placeholder="Catatan pesanan / ukuran / teks sablon..."
                    className="text-[11px] px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#00871f] text-slate-700 placeholder:text-slate-400"
                  />

                  {/* Quantity controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.productId)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                      title="Hapus item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, -1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.productId, 1)}
                        className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          COLUMN 3 (Payment & Due Date Summary): 4 cols on lg, 4 on xl
      ========================================================================= */}
      <div className="lg:col-span-4 xl:col-span-4 bg-white flex flex-col h-full overflow-y-auto border-l border-slate-200 select-none">
        {/* Order Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">Order #INV/00001</span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            {totalQuantity} Pesanan
          </span>
        </div>

        {/* TANGGAL JATUH TEMPO PENYELESAIAN (Due Date Section - Explicit User Request) */}
        <div className="p-3 bg-amber-50/60 border-b border-amber-200/70">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Tanggal Jatuh Tempo Penyelesaian</span>
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 text-amber-800 font-semibold">
              Wajib untuk Order Custom
            </span>
          </div>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full text-xs font-medium px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setDuePreset(0)}
              className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap"
            >
              Langsung Jadi
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(2)}
              className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap"
            >
              +2 Hari
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(5)}
              className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap"
            >
              +5 Hari
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(7)}
              className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap"
            >
              +7 Hari
            </button>
          </div>
        </div>

        {/* Totals Breakdown */}
        <div className="p-3 border-b border-slate-200 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Diskon Potongan</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px]">Rp</span>
              <input
                type="number"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                placeholder="0"
                className="w-20 text-right px-1.5 py-0.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm font-bold text-slate-900">
            <span>Total Tagihan</span>
            <span className="text-base text-[#00871f]">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Kasir Checkout Section */}
        <div className="p-3 flex-1 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 tracking-wide uppercase">KASIR</h3>

            {/* Tunai vs Non Tunai tabs */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setPaymentMethodTab('Tunai')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  paymentMethodTab === 'Tunai'
                    ? 'bg-[#00871f] text-white border-[#00871f] shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Tunai</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethodTab('Non Tunai')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  paymentMethodTab === 'Non Tunai'
                    ? 'bg-[#00871f] text-white border-[#00871f] shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Non Tunai</span>
              </button>
            </div>

            {/* Quick cash helper buttons if Tunai */}
            {paymentMethodTab === 'Tunai' ? (
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashGiven(total)}
                    className="py-1.5 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Uang Pas
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashGiven(Math.ceil(total / 50000) * 50000 || 50000)}
                    className="py-1.5 px-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                  >
                    Bulatkan 50K
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[50000, 100000, 200000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashGiven(amt)}
                      className="py-1 text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded transition-colors"
                    >
                      {(amt / 1000).toLocaleString('id-ID')}k
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Non-Cash sub-options */
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {(['QRIS', 'Transfer Bank', 'Kartu Debit'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setNonCashType(method)}
                    className={`py-1.5 px-1 text-[11px] font-semibold rounded border transition-all text-center ${
                      nonCashType === method
                        ? 'bg-emerald-50 text-[#00871f] border-[#00871f] font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            )}

            {/* Total Tagihan, Pembayaran, Sisa Tagihan (matches screenshot) */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Tagihan</span>
                <span className="font-semibold text-slate-800">{formatCurrency(total)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span>Total Pembayaran</span>
                {paymentMethodTab === 'Tunai' ? (
                  <input
                    type="number"
                    value={cashGiven || ''}
                    onChange={(e) => setCashGiven(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0"
                    className="w-28 text-right px-2 py-1 border border-slate-200 rounded text-xs font-semibold focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                  />
                ) : (
                  <span className="font-semibold text-slate-800">{formatCurrency(total)}</span>
                )}
              </div>

              <div className="flex justify-between items-center pt-1">
                <span
                  className={`font-semibold ${
                    remainingBill > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {remainingBill > 0 ? 'Sisa Tagihan' : 'Kembalian'}
                </span>
                <span
                  className={`font-bold text-sm ${
                    remainingBill > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {remainingBill > 0
                    ? formatCurrency(remainingBill)
                    : formatCurrency(changeAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Actions: Bayar & Simpan ke Pesanan (matching screenshot) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handlePay}
              disabled={cartItems.length === 0}
              className="py-2.5 px-3 bg-[#00871f] hover:bg-[#007019] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 transition-all active:scale-[0.98] cursor-pointer"
            >
              <FileCheck className="w-4 h-4" />
              <span>Bayar</span>
            </button>
            <button
              type="button"
              onClick={handleSaveAsPending}
              disabled={cartItems.length === 0}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Simpan ke Pesanan</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL: Tambah Pelanggan Baru
      ========================================================================= */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-[#00871f]" />
              Tambah Data Pelanggan
            </h3>
            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Pelanggan / Organisasi *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="Contoh: FC Papua United / Bpk. Yohan"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  No. Telepon / WhatsApp
                </label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Alamat / Keterangan
                </label>
                <textarea
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  rows={2}
                  placeholder="Abepura / Dok IX Jayapura"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                ></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Pilih Faktur/Invoice yang akan Direvisi */}
      {showSelectInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 p-5 animate-in fade-in zoom-in-95 duration-150 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <FileEdit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Pilih Invoice untuk Direvisi</h3>
                  <p className="text-[11px] text-slate-500">Kasir & Admin dapat mengubah rincian barang, harga, atau pelanggan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSelectInvoiceModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-xs">Belum ada transaksi invoice yang tersimpan.</p>
                </div>
              ) : (
                recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setShowSelectInvoiceModal(false);
                      if (onReviseInvoice) {
                        onReviseInvoice(tx);
                      }
                    }}
                    className="p-3 bg-slate-50 hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-800 group-hover:text-amber-800">
                          {tx.invoiceNo}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          tx.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {tx.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 font-medium">
                        {tx.customer.name} ({tx.items.length} item) • {tx.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-[#00871f] block">
                        {formatCurrency(tx.total)}
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold group-hover:underline">
                        Pilih Revisi &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSelectInvoiceModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSalesModal && (
        <AddSalesModal
          isOpen={showAddSalesModal}
          onClose={() => setShowAddSalesModal(false)}
          salesList={salesList}
          onAddSales={(newName) => {
            if (onAddSales) onAddSales(newName);
            setSelectedSales(newName);
          }}
          onDeleteSales={onDeleteSales}
          onSelectSales={(name) => setSelectedSales(name)}
        />
      )}
    </div>
  );
};
