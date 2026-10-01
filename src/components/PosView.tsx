import React, { useState, useMemo, useEffect } from 'react';
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
  Unlock,
  Shirt,
  Layers,
  Palette,
  CheckCircle2,
  Check,
  TrendingUp,
  Truck,
  Building2,
  Eye
} from 'lucide-react';
import type {
  Product,
  OrderItem,
  OrderType,
  PaymentMethod,
  Customer,
  Transaction,
  CashierShift,
  KaosStockItem,
  OrderStatus,
  User as AppUser,
  UserRole
} from '../types';
import { formatCurrency } from '../utils/exportUtils';
import { calculateProfit, calculateProfitMargin } from '../utils/profitUtils';
import { AddSalesModal } from './AddSalesModal';
import { STANDARD_KAOS_COLORS, STANDARD_KAOS_SIZES } from '../data/mockData';
import { isSablonKaosProduct, getKaosStockQty } from '../utils/kaosStockUtils';

interface PosViewProps {
  products: Product[];
  categories: string[];
  customers: Customer[];
  kaosStocks?: KaosStockItem[];
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
  currentUser?: AppUser;
  userRole?: UserRole;
  shift?: CashierShift;
  onOpenShiftModal?: (mode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history') => void;
}

export const PosView: React.FC<PosViewProps> = ({
  products,
  categories,
  customers,
  kaosStocks = [],
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
  currentUser,
  userRole,
  shift,
  onOpenShiftModal
}) => {
  // Modal state for selecting an invoice to revise
  const [showSelectInvoiceModal, setShowSelectInvoiceModal] = useState<boolean>(false);
  // Modal state for draft invoice preview (Khusus Admin & Kasir)
  const [showDraftPreviewModal, setShowDraftPreviewModal] = useState<boolean>(false);
  // Catalog View Mode: 'grid' | 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Cashier status guard: Kasir disable/tidak bisa digunakan jika status kasir belum terbuka (shift.isOpen !== true)
  const isCashierOpen = Boolean(shift?.isOpen);

  // Active Cart / Order
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [selectedSales, setSelectedSales] = useState<string>(() => {
    if (isAdmin && salesList.includes('Admin (DEAZBAR)')) return 'Admin (DEAZBAR)';
    return salesList[0] || 'Kasir (Dimas)';
  });
  const [showAddSalesModal, setShowAddSalesModal] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'c0');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Format date to local YYYY-MM-DDTHH:mm string without timezone shifts
  const formatLocalDateTime = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper to add working days excluding Sunday (Hari Minggu TIDAK termasuk dalam hitungan hari)
  const addDaysExcludingSunday = (startDate: Date, days: number): Date => {
    const d = new Date(startDate);
    if (days <= 0) return d;
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      // getDay() === 0 adalah hari Minggu -> tidak dihitung sebagai hari kerja pengerjaan
      if (d.getDay() !== 0) {
        added++;
      }
    }
    return d;
  };

  // TANGGAL JATUH TEMPO PENYELESAIAN (Due Date for completion/production)
  // Default to +2 Hari Kerja (excluding Sundays) jam 17:00
  const getDefaultDueDate = () => {
    const d = addDaysExcludingSunday(new Date(), 2);
    d.setHours(17, 0, 0, 0);
    return formatLocalDateTime(d);
  };
  const [dueDate, setDueDate] = useState<string>(getDefaultDueDate());

  // Payment state
  const [paymentMethodTab, setPaymentMethodTab] = useState<'Tunai' | 'Non Tunai'>('Tunai');
  const [nonCashType, setNonCashType] = useState<'QRIS' | 'Transfer Bank' | 'Kartu Debit'>('QRIS');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [vendorName, setVendorName] = useState<string>('');
  const [vendorCost, setVendorCost] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [nonCashGiven, setNonCashGiven] = useState<number>(0);
  const [hasEditedNonCash, setHasEditedNonCash] = useState<boolean>(false);

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

  // Hasil Keuntungan = Total Nilai Faktur - (Biaya Vendor + Biaya Pengiriman)
  const profit = useMemo(() => {
    return calculateProfit(total, vendorCost, shippingCost);
  }, [total, vendorCost, shippingCost]);

  // Keep nonCashGiven synced to total unless cashier has manually edited the amount
  useEffect(() => {
    if (!hasEditedNonCash) {
      setNonCashGiven(total);
    }
  }, [total, hasEditedNonCash]);

  const totalQuantity = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Sisa tagihan or Kembalian (Berlaku baik untuk Tunai maupun Non Tunai)
  const effectiveCash = paymentMethodTab === 'Tunai' ? cashGiven : nonCashGiven;
  const remainingBill = Math.max(0, total - effectiveCash);
  const changeAmount = Math.max(0, effectiveCash - total);

  // Helper to get unique key for cart row
  const getItemKey = (item: OrderItem) => item.cartItemId || item.productId;

  // Add product to cart
  const handleAddToCart = (product: Product) => {
    if (!isCashierOpen) {
      alert('Kasir belum dibuka! Silakan Buka Kasir terlebih dahulu untuk memulai transaksi penjualan.');
      onOpenShiftModal?.('open_shift');
      return;
    }

    const isKaos = isSablonKaosProduct(product.name);
    const defaultColor = 'Hitam';
    const defaultSize = 'L';

    setCartItems((prev) => {
      // If it's Kaos, find existing by productId AND same color & size
      const existing = isKaos
        ? prev.find(
            (item) =>
              item.productId === product.id &&
              (item.kaosColor || defaultColor) === defaultColor &&
              (item.kaosSize || defaultSize) === defaultSize
          )
        : prev.find((item) => item.productId === product.id);

      if (existing) {
        return prev.map((item) =>
          item === existing
            ? {
                ...item,
                quantity: item.quantity + 1,
                subtotal: (item.quantity + 1) * item.price
              }
            : item
        );
      } else {
        const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        return [
          ...prev,
          {
            cartItemId,
            productId: product.id,
            name: product.name,
            sku: product.sku,
            price: product.price,
            costPrice: product.costPrice,
            quantity: 1,
            notes: '',
            subtotal: product.price,
            kaosColor: isKaos ? defaultColor : undefined,
            kaosSize: isKaos ? defaultSize : undefined
          }
        ];
      }
    });
  };

  // Add another variant of same Kaos product
  const handleAddKaosVariant = (baseItem: OrderItem) => {
    const cartItemId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // pick a sensible alternate or same color
    const nextSize = baseItem.kaosSize === 'L' ? 'XL' : 'L';
    const newItem: OrderItem = {
      ...baseItem,
      cartItemId,
      quantity: 1,
      subtotal: baseItem.price,
      kaosColor: baseItem.kaosColor || 'Hitam',
      kaosSize: nextSize
    };
    setCartItems((prev) => [...prev, newItem]);
  };

  // Update item quantity
  const handleUpdateQty = (itemKey: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (getItemKey(item) === itemKey) {
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
  const handleUpdateItemNote = (itemKey: string, note: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        getItemKey(item) === itemKey ? { ...item, notes: note } : item
      )
    );
  };

  // Update Kaos Color
  const handleUpdateItemKaosColor = (itemKey: string, color: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        getItemKey(item) === itemKey ? { ...item, kaosColor: color } : item
      )
    );
  };

  // Update Kaos Size
  const handleUpdateItemKaosSize = (itemKey: string, size: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        getItemKey(item) === itemKey ? { ...item, kaosSize: size } : item
      )
    );
  };

  // Remove single item
  const handleRemoveItem = (itemKey: string) => {
    setCartItems((prev) => prev.filter((item) => getItemKey(item) !== itemKey));
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

  // Quick preset days for Due Date (excluding Sundays per business rule)
  const setDuePreset = (days: number) => {
    if (days === 0) {
      const d = new Date();
      d.setHours(17, 0, 0, 0);
      if (new Date().getHours() >= 17) {
        d.setHours(new Date().getHours() + 2, 0, 0, 0);
      }
      setDueDate(formatLocalDateTime(d));
    } else {
      const d = addDaysExcludingSunday(new Date(), days);
      d.setHours(17, 0, 0, 0);
      setDueDate(formatLocalDateTime(d));
    }
  };

  // Handle Pay
  const handlePay = () => {
    if (!isCashierOpen) {
      alert('Kasir belum dibuka! Silakan Buka Kasir terlebih dahulu untuk memproses pembayaran.');
      onOpenShiftModal?.('open_shift');
      return;
    }

    if (cartItems.length === 0) {
      alert('Rincian pesanan masih kosong. Silakan pilih produk terlebih dahulu.');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const finalPaymentMethod: PaymentMethod =
      paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType;

    const formattedDueDate = dueDate ? dueDate.replace('T', ' ') : '-';
    const nowStr = formatLocalDateTime(new Date()).replace('T', ' ');

    const isPartialOrUnpaid = effectiveCash < total;
    const remainingAmount = Math.max(0, total - effectiveCash);
    const paymentStatus: 'LUNAS' | 'PIUTANG' | 'DP' = isPartialOrUnpaid
      ? effectiveCash > 0
        ? 'DP'
        : 'PIUTANG'
      : 'LUNAS';

    // If partial or unpaid, status is 'Sedang Dikerjakan'
    const orderStatus: OrderStatus = isPartialOrUnpaid ? 'Sedang Dikerjakan' : 'Selesai';

    let piutangNote = '';
    if (isPartialOrUnpaid) {
      piutangNote = `[PIUTANG ${paymentStatus}] Bayar: ${formatCurrency(effectiveCash)}, Sisa Piutang: ${formatCurrency(remainingAmount)} (Jatuh Tempo: ${formattedDueDate})`;
    }

    const finalNotes = orderNotes
      ? piutangNote
        ? `${orderNotes} | ${piutangNote}`
        : orderNotes
      : piutangNote;

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
      vendorName: vendorName.trim() || undefined,
      vendorCost,
      shippingCost,
      profit,
      paymentMethod: finalPaymentMethod,
      amountPaid: effectiveCash,
      change: changeAmount,
      status: orderStatus,
      paymentStatus,
      remainingAmount,
      cashierName,
      cashierId,
      shiftId: shift?.id,
      notes: finalNotes
    });

    // Reset cart
    setCartItems([]);
    setDiscountAmount(0);
    setVendorName('');
    setVendorCost(0);
    setShippingCost(0);
    setCashGiven(0);
    setNonCashGiven(0);
    setHasEditedNonCash(false);
    setOrderNotes('');
  };

  // Handle Save as In-Progress / Pending Production Order
  const handleSaveAsPending = () => {
    if (!isCashierOpen) {
      alert('Kasir belum dibuka! Silakan Buka Kasir terlebih dahulu untuk menyimpan pesanan.');
      onOpenShiftModal?.('open_shift');
      return;
    }

    if (cartItems.length === 0) {
      alert('Rincian pesanan masih kosong.');
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
    const finalPaymentMethod: PaymentMethod =
      paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType;

    const formattedDueDate = dueDate ? dueDate.replace('T', ' ') : '-';
    const nowStr = formatLocalDateTime(new Date()).replace('T', ' ');

    const isPartialOrUnpaid = effectiveCash < total;
    const remainingAmount = Math.max(0, total - effectiveCash);
    const paymentStatus: 'LUNAS' | 'PIUTANG' | 'DP' = isPartialOrUnpaid
      ? effectiveCash > 0
        ? 'DP'
        : 'PIUTANG'
      : 'LUNAS';

    let piutangNote = '';
    if (isPartialOrUnpaid) {
      piutangNote = `[ANTREAN PRODUKSI / ${paymentStatus}] Bayar: ${formatCurrency(effectiveCash)}, Sisa: ${formatCurrency(remainingAmount)} (Jatuh Tempo: ${formattedDueDate})`;
    }

    const finalNotes = orderNotes
      ? piutangNote
        ? `${orderNotes} | ${piutangNote}`
        : orderNotes
      : piutangNote;

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
      vendorName: vendorName.trim() || undefined,
      vendorCost,
      shippingCost,
      profit,
      paymentMethod: finalPaymentMethod,
      amountPaid: effectiveCash,
      change: changeAmount,
      status: 'Sedang Dikerjakan',
      paymentStatus,
      remainingAmount,
      cashierName,
      cashierId,
      shiftId: shift?.id,
      notes: finalNotes
    });

    alert(`Pesanan berhasil disimpan ke Antrean Produksi dengan Jatuh Tempo: ${formattedDueDate}${remainingAmount > 0 ? ` (Sisa Piutang: ${formatCurrency(remainingAmount)})` : ''}`);
    setCartItems([]);
    setDiscountAmount(0);
    setVendorName('');
    setVendorCost(0);
    setShippingCost(0);
    setCashGiven(0);
    setNonCashGiven(0);
    setHasEditedNonCash(false);
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
            <div className={`px-2.5 py-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
              isCashierOpen 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
                : 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs'
            }`}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCashierOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 ring-2 ring-rose-200'}`} />
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">
                      {isCashierOpen ? 'Kasir Terbuka' : 'Status: Kasir Belum Dibuka / Tutup'}
                    </span>
                    {!isCashierOpen && (
                      <span className="px-1.5 py-0.2 rounded bg-rose-200 text-rose-800 font-extrabold text-[10px] uppercase">
                        Terdisable
                      </span>
                    )}
                  </div>
                  {isCashierOpen && shift.startTime ? (
                    <span className="text-[11px] text-slate-500 block truncate">
                      Kasir: <strong className="text-slate-700">{shift.cashierName}</strong> &bull; Buka: {shift.startTime}
                    </span>
                  ) : (
                    <span className="text-[11px] text-rose-700 font-medium block truncate">
                      Buka kasir untuk mengaktifkan menu penjualan & transaksi.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isCashierOpen ? (
                  <button
                    type="button"
                    onClick={() => onOpenShiftModal?.('reconcile')}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="Menu Tutup Kasir & Rekonsiliasi Kas"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Tutup Kasir</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenShiftModal?.('open_shift')}
                    className="px-3 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 animate-pulse"
                    title="Buka Kasir Baru (Tanggal & Jam Otomatis)"
                  >
                    <Unlock className="w-3 h-3" />
                    <span>Buka Kasir</span>
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
          {!isCashierOpen && (
            <div className="mb-3.5 p-3.5 rounded-xl bg-rose-50/90 border border-rose-300 text-rose-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                    <span>Kasir Belum Dibuka &bull; Menu Penjualan Terdisable</span>
                  </h4>
                  <p className="text-[11px] text-rose-800 mt-0.5 leading-snug">
                    Status kasir belum dibuka atau sudah ditutup. Transaksi dinonaktifkan sampai Buka Kasir dilakukan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenShiftModal?.('open_shift')}
                className="px-3.5 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer transition-all shrink-0 active:scale-95"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Kasir Sekarang</span>
              </button>
            </div>
          )}
          {filteredProducts.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1" />
              <p>Tidak ada produk yang cocok</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${!isCashierOpen ? 'opacity-40 pointer-events-none select-none grayscale-[40%]' : ''}`}>
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
            <div className={`flex flex-col divide-y divide-slate-100 ${!isCashierOpen ? 'opacity-40 pointer-events-none select-none grayscale-[40%]' : ''}`}>
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
              onClick={() => {
                if (!isCashierOpen) {
                  alert('Kasir belum dibuka! Silakan Buka Kasir terlebih dahulu.');
                  onOpenShiftModal?.('open_shift');
                  return;
                }
                onOpenCustomProductModal();
              }}
              disabled={!isCashierOpen}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors shadow-xs ${
                !isCashierOpen
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer'
              }`}
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
              {cartItems.map((item) => {
                const itemKey = getItemKey(item);
                const isKaos = isSablonKaosProduct(item.name);
                const selectedColor = item.kaosColor || 'Hitam';
                const selectedSize = item.kaosSize || 'L';
                const currentKaosStock = getKaosStockQty(kaosStocks, selectedColor, selectedSize);

                return (
                  <div
                    key={itemKey}
                    className={`border rounded-xl p-2.5 flex flex-col gap-2 group transition-all ${
                      isKaos
                        ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{item.name}</h4>
                          {isKaos && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-0.5">
                              <Shirt className="w-2.5 h-2.5" />
                              Sablon + Kaos
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {item.sku} &bull; {formatCurrency(item.price)}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-slate-900 shrink-0">
                        {formatCurrency(item.subtotal)}
                      </span>
                    </div>

                    {/* If Sablon + Kaos: dedicated selection for Warna Kaos & Size Kaos + real-time stock indicator! */}
                    {isKaos ? (
                      <div className="bg-white p-2.5 rounded-lg border border-purple-200/80 shadow-2xs space-y-2.5">
                        {/* 1. Warna Kaos Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <Palette className="w-3 h-3 text-purple-600" />
                              <span>Warna Kaos:</span>
                              <span className="font-extrabold text-purple-700 underline decoration-purple-300 underline-offset-2">
                                {selectedColor}
                              </span>
                            </label>
                            <span className="text-[9px] text-slate-400">Pilih warna kain</span>
                          </div>

                          {/* Quick color buttons */}
                          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {STANDARD_KAOS_COLORS.map((c) => {
                              const isSelected = selectedColor.toLowerCase() === c.name.toLowerCase();
                              return (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => handleUpdateItemKaosColor(itemKey, c.name)}
                                  className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-purple-700 text-white shadow-xs ring-2 ring-purple-300 font-bold scale-[1.02]'
                                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
                                  }`}
                                >
                                  <span className={`w-2.5 h-2.5 rounded-full border shadow-2xs shrink-0 ${c.dotClass}`}></span>
                                  <span>{c.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Size Kaos Selector with Stock info */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                              <Shirt className="w-3 h-3 text-[#00871f]" />
                              <span>Size Kaos:</span>
                              <span className="font-extrabold text-[#00871f]">Size {selectedSize}</span>
                            </label>

                            {/* LIVE STOCK BADGE for chosen (Warna, Size) */}
                            <div
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border transition-all ${
                                currentKaosStock <= 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                  : currentKaosStock <= 5
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              <span>Stok Kaos {selectedColor} [{selectedSize}]:</span>
                              <span className="font-black text-xs">{currentKaosStock} pcs</span>
                            </div>
                          </div>

                          {/* Size Buttons Matrix with live individual stock numbers */}
                          <div className="grid grid-cols-6 gap-1">
                            {STANDARD_KAOS_SIZES.map((sz) => {
                              const isSelected = selectedSize.toUpperCase() === sz.toUpperCase();
                              const stockForSz = getKaosStockQty(kaosStocks, selectedColor, sz);
                              const isOut = stockForSz <= 0;

                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => handleUpdateItemKaosSize(itemKey, sz)}
                                  className={`py-1 px-1 rounded-md text-center transition-all cursor-pointer border ${
                                    isSelected
                                      ? 'bg-[#00871f] text-white font-black border-[#00871f] ring-2 ring-[#00871f]/30 shadow-xs'
                                      : isOut
                                      ? 'bg-rose-50/70 border-rose-200 text-rose-600 hover:bg-rose-100'
                                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  <div className="text-xs font-bold leading-tight">{sz}</div>
                                  <div
                                    className={`text-[8px] leading-none mt-0.5 font-semibold ${
                                      isSelected
                                        ? 'text-emerald-100'
                                        : isOut
                                        ? 'text-rose-600 font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {isOut ? 'Habis' : `${stockForSz} pcs`}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Catatan Pesanan / Spesifikasi Sablon */}
                        <div>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(e) => handleUpdateItemNote(itemKey, e.target.value)}
                            placeholder="Catatan sablon (posisi gambar, warna tinta, nama file)..."
                            className="w-full text-[11px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#00871f] text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                      </div>
                    ) : (
                      /* Standard note input for non-kaos products */
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateItemNote(itemKey, e.target.value)}
                        placeholder="Catatan pesanan / ukuran / spesifikasi..."
                        className="text-[11px] px-2 py-1 bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#00871f] text-slate-700 placeholder:text-slate-400"
                      />
                    )}

                    {/* Quantity & Action controls */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(itemKey)}
                          className="text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer"
                          title="Hapus item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isKaos && (
                          <button
                            type="button"
                            onClick={() => handleAddKaosVariant(item)}
                            className="text-[10px] font-semibold text-purple-700 hover:text-purple-800 bg-purple-100 hover:bg-purple-200/80 px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                            title="Tambah varian warna/ukuran lain untuk sablon ini"
                          >
                            <Plus className="w-3 h-3" />
                            + Varian Kaos Lain
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemKey, -1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemKey, 1)}
                          className="w-5 h-5 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
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

        {/* Kasir Closed Alert Banner in Cart */}
        {!isCashierOpen && (
          <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>Kasir Belum Dibuka (Terdisable)</span>
            </span>
            <button
              type="button"
              onClick={() => onOpenShiftModal?.('open_shift')}
              className="px-2 py-1 bg-[#00871f] hover:bg-[#007019] text-white text-[10px] font-bold rounded cursor-pointer transition-colors shadow-2xs"
            >
              Buka Kasir
            </button>
          </div>
        )}

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
              className="px-2.5 py-1 text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              title="Selesai hari ini"
            >
              Langsung Jadi
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(2)}
              className="px-2.5 py-1 text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              title="+2 Hari Kerja (Hari Minggu tidak dihitung)"
            >
              +2 Hari
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(5)}
              className="px-2.5 py-1 text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              title="+5 Hari Kerja (Hari Minggu tidak dihitung)"
            >
              +5 Hari
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(8)}
              className="px-2.5 py-1 text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              title="+8 Hari Kerja (Hari Minggu tidak dihitung)"
            >
              +8 Hari
            </button>
            <button
              type="button"
              onClick={() => setDuePreset(14)}
              className="px-2.5 py-1 text-[10px] font-bold bg-white border border-amber-300 hover:bg-amber-100 rounded text-amber-900 whitespace-nowrap cursor-pointer transition-colors shadow-2xs"
              title="+14 Hari Kerja (Hari Minggu tidak dihitung)"
            >
              +14 Hari
            </button>
          </div>
          <p className="text-[10px] text-amber-800/90 mt-1 italic flex items-center gap-1 font-medium">
            <span>ℹ️</span>
            <span>Ketentuan: Hari Minggu tidak termasuk dalam hitungan jumlah hari pengerjaan.</span>
          </p>
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

        {/* Rincian Biaya Vendor & Pengiriman */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Truck className="w-3.5 h-3.5 text-[#00871f]" />
              Data Vendor &amp; Pengiriman
            </span>
            <span className="text-[10px] text-slate-400">Rincian Operasional</span>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
              Nama Vendor (Opsional)
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Contoh: Vendor Sablon / Bordir..."
              className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:border-[#00871f] focus:ring-1 focus:ring-[#00871f] focus:outline-none placeholder:text-slate-400 placeholder:font-normal"
            />
            <span className="text-[9.5px] text-slate-400 block mt-0.5 italic">
              * Khusus preview Admin &amp; Kasir (tidak tampil saat print struk)
            </span>

            {/* Live Preview Nama Vendor saat pembuatan invoice (Khusus Admin & Kasir) */}
            {vendorName.trim() && (
              <div className="mt-1.5 p-2 bg-emerald-50/90 border border-emerald-200 rounded-lg text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#00871f]" />
                    Preview Nama Vendor (Admin &amp; Kasir)
                  </span>
                  <span className="text-[9px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                    Tidak Tampil Saat Cetak
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-800 pt-0.5 border-t border-emerald-200/60">
                  <span className="text-[11px] text-slate-600">Vendor Terinput:</span>
                  <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                    {vendorName.trim()}
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 italic">
                  * Nama vendor ini disimpan dalam database dan hanya dapat dilihat oleh Admin &amp; Kasir di preview sistem (tidak akan dicetak saat print struk fisik/PDF).
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                Biaya Vendor
              </label>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus-within:border-[#00871f] focus-within:ring-1 focus-within:ring-[#00871f]">
                <span className="text-slate-400 text-[10px]">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={vendorCost || ''}
                  onChange={(e) => setVendorCost(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full text-right text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                Biaya Pengiriman
              </label>
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1.5 py-0.5 focus-within:border-[#00871f] focus-within:ring-1 focus-within:ring-[#00871f]">
                <span className="text-slate-400 text-[10px]">Rp</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={shippingCost || ''}
                  onChange={(e) => setShippingCost(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full text-right text-xs font-semibold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* PREVIEW HASIL KEUNTUNGAN (Hanya Admin / Owner) */}
          {isAdmin ? (
            <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/90 text-emerald-950 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <TrendingUp className="w-3.5 h-3.5 text-[#00871f]" />
                  Preview Keuntungan (Admin/Owner)
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900">
                  Margin: {calculateProfitMargin(profit, total)}%
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-emerald-200/60">
                <span className="text-[10px] text-slate-600 truncate mr-2" title={`Total Faktur (${formatCurrency(total)}) - [Biaya Vendor (${formatCurrency(vendorCost)}) + Ongkir (${formatCurrency(shippingCost)})]`}>
                  Faktur - (Vendor + Kirim)
                </span>
                <span className={`text-sm font-black shrink-0 ${profit >= 0 ? 'text-[#00871f]' : 'text-rose-600'}`}>
                  {formatCurrency(profit)}
                </span>
              </div>
              <p className="text-[9.5px] text-emerald-700 italic">
                * Keuntungan hanya bisa dilihat oleh Admin/Owner &amp; TIDAK tercetak di struk inv.
              </p>
            </div>
          ) : (
            <div className="mt-1 px-2 py-1.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[10.5px] flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Preview hasil keuntungan terkunci (khusus akses Admin/Owner).</span>
            </div>
          )}
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
              /* Non-Cash sub-options & quick payment helpers */
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-3 gap-1.5">
                  {(['QRIS', 'Transfer Bank', 'Kartu Debit'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setNonCashType(method)}
                      className={`py-1.5 px-1 text-[11px] font-semibold rounded border transition-all text-center cursor-pointer ${
                        nonCashType === method
                          ? 'bg-emerald-50 text-[#00871f] border-[#00871f] font-bold shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>

                {/* Quick Non-Cash Payment Amount Helpers */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setNonCashGiven(total);
                      setHasEditedNonCash(false);
                    }}
                    className={`py-1 px-1.5 rounded font-bold border transition-colors cursor-pointer ${
                      nonCashGiven === total
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Bayar lunas 100% total tagihan"
                  >
                    Bayar Full (Lunas)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNonCashGiven(Math.round(total / 2));
                      setHasEditedNonCash(true);
                    }}
                    className={`py-1 px-1.5 rounded font-bold border transition-colors cursor-pointer ${
                      nonCashGiven === Math.round(total / 2) && total > 0
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Uang Muka 50% tagihan"
                  >
                    DP 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNonCashGiven(0);
                      setHasEditedNonCash(true);
                    }}
                    className={`py-1 px-1.5 rounded font-bold border transition-colors cursor-pointer ${
                      nonCashGiven === 0
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                    title="Belum bayar / Piutang penuh"
                  >
                    Piutang (0)
                  </button>
                </div>
              </div>
            )}

            {/* Total Tagihan, Pembayaran, Sisa Tagihan (matches screenshot) */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Tagihan</span>
                <span className="font-semibold text-slate-800">{formatCurrency(total)}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium flex items-center gap-1">
                  <span>Total Pembayaran</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType})
                  </span>
                </span>
                {paymentMethodTab === 'Tunai' ? (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs font-semibold">Rp</span>
                    <input
                      type="number"
                      value={cashGiven || ''}
                      onChange={(e) => setCashGiven(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="w-28 text-right px-2 py-1 border border-slate-200 rounded text-xs font-semibold focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-xs font-semibold">Rp</span>
                    <input
                      type="number"
                      value={nonCashGiven !== undefined && nonCashGiven !== null ? (nonCashGiven === 0 && !hasEditedNonCash ? '' : nonCashGiven) : ''}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setNonCashGiven(val);
                        setHasEditedNonCash(true);
                      }}
                      placeholder="0"
                      className="w-28 text-right px-2 py-1 border border-emerald-300 bg-emerald-50/20 rounded text-xs font-bold text-slate-800 focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                      title={`Masukkan nominal pembayaran ${nonCashType} yang diterima`}
                    />
                  </div>
                )}
              </div>

              {/* Status Pembayaran: FULL (LUNAS) vs DIALIHKAN KE PIUTANG */}
              {remainingBill > 0 ? (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1 mt-1">
                  <div className="flex justify-between items-center text-amber-900 font-bold">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Dialihkan ke Piutang:
                    </span>
                    <span className="text-rose-600 text-sm font-black">{formatCurrency(remainingBill)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-amber-800">
                    <span>Jatuh Tempo Piutang:</span>
                    <span className="font-bold">{dueDate ? dueDate.replace('T', ' ') : 'Sesuai Deadline'}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 flex justify-between">
                    <span>Status Pembayaran:</span>
                    <span className="font-semibold text-amber-800">
                      {effectiveCash > 0
                        ? `Uang Muka (${paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType} DP: ${formatCurrency(effectiveCash)})`
                        : `Piutang Penuh / Belum Bayar (${paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType})`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center pt-1 text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-md text-[11px] font-bold border border-emerald-200 mt-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Status: Pembayaran FULL (Lunas)
                  </span>
                  {changeAmount > 0 ? (
                    <span className="text-emerald-800 font-black">Kembalian: {formatCurrency(changeAmount)}</span>
                  ) : (
                    <span className="text-emerald-800">Lunas Pas</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tombol Preview Faktur & Vendor (Khusus Admin & Kasir) */}
          <button
            type="button"
            onClick={() => setShowDraftPreviewModal(true)}
            disabled={cartItems.length === 0}
            className="w-full py-2 px-3 bg-emerald-50/90 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Buka preview faktur dan nama vendor (Khusus internal Admin & Kasir)"
          >
            <Eye className="w-3.5 h-3.5 text-[#00871f]" />
            <span>Preview Faktur &amp; Vendor (Admin &amp; Kasir)</span>
          </button>

          {/* Bottom Actions: Bayar & Simpan ke Pesanan (matching screenshot) */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handlePay}
              disabled={!isCashierOpen || cartItems.length === 0}
              className={`py-2.5 px-2 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98] ${
                !isCashierOpen
                  ? 'bg-slate-400 cursor-not-allowed'
                  : remainingBill > 0
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200 cursor-pointer'
                  : 'bg-[#00871f] hover:bg-[#007019] shadow-emerald-200 cursor-pointer'
              }`}
              title={!isCashierOpen ? 'Buka Kasir terlebih dahulu untuk memproses pembayaran' : ''}
            >
              {!isCashierOpen ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Kasir Belum Dibuka</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>
                    {remainingBill > 0
                      ? effectiveCash > 0
                        ? `Bayar DP & Piutang`
                        : 'Catat Piutang'
                      : 'Bayar'}
                  </span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveAsPending}
              disabled={!isCashierOpen || cartItems.length === 0}
              className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-200"
              title={!isCashierOpen ? 'Buka Kasir terlebih dahulu untuk menyimpan pesanan' : ''}
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

      {/* =========================================================================
          MODAL: Preview Faktur Draft & Vendor (Khusus Admin & Kasir)
      ========================================================================= */}
      {showDraftPreviewModal && (() => {
        const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-slate-800 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center">
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Preview Faktur (Draft)</h3>
                    <p className="text-[11px] text-slate-500">Khusus internal Admin &amp; Kasir</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDraftPreviewModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto py-3 space-y-3 flex-1 text-xs">
                {/* Store & Customer Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Pelanggan:</span>
                    <span className="font-bold text-slate-800">{activeCustomer ? activeCustomer.name : 'Pelanggan Umum'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">No. WhatsApp / HP:</span>
                    <span className="font-semibold text-slate-700">{activeCustomer?.phone || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sales / Kasir:</span>
                    <span className="font-semibold text-slate-700">{selectedSales || cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Jatuh Tempo:</span>
                    <span className="font-bold text-rose-600">{dueDate ? dueDate.replace('T', ' ') : 'Langsung Selesai'}</span>
                  </div>
                </div>

                {/* Items List */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                  <div className="font-bold text-slate-700 border-b border-slate-100 pb-1 flex justify-between">
                    <span>Rincian Pesanan ({cartItems.length} item)</span>
                    <span>Subtotal</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {cartItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start text-[11.5px] border-b border-dashed border-slate-100 pb-1 last:border-b-0">
                        <div>
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          <div className="text-[10px] text-slate-500">
                            {item.quantity} x {formatCurrency(item.price)}
                            {(item.kaosColor || item.kaosSize) && (
                              <span className="ml-1 text-purple-700 font-medium">
                                [{item.kaosColor || '-'} / {item.kaosSize || '-'}]
                              </span>
                            )}
                            {item.notes && <span className="ml-1 italic text-slate-400">({item.notes})</span>}
                          </div>
                        </div>
                        <span className="font-bold text-slate-800">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal Belanja:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Diskon:</span>
                      <span className="font-semibold">-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Tagihan:</span>
                    <span className="text-[#00871f]">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Metode &amp; Pembayaran:</span>
                    <span className="font-semibold">{paymentMethodTab === 'Tunai' ? 'Tunai' : nonCashType} ({formatCurrency(effectiveCash)})</span>
                  </div>
                  {remainingBill > 0 ? (
                    <div className="flex justify-between font-bold text-rose-600 bg-rose-50 p-1.5 rounded">
                      <span>Sisa Piutang:</span>
                      <span>{formatCurrency(remainingBill)}</span>
                    </div>
                  ) : changeAmount > 0 ? (
                    <div className="flex justify-between font-bold text-emerald-600 bg-emerald-50 p-1.5 rounded">
                      <span>Kembalian:</span>
                      <span>{formatCurrency(changeAmount)}</span>
                    </div>
                  ) : null}
                </div>

                {/* KOTAK PREVIEW NAMA VENDOR (KHUSUS ADMIN & KASIR - TIDAK TAMPIL SAAT CETAK) */}
                <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-xs">
                      <Building2 className="w-4 h-4 text-[#00871f] shrink-0" />
                      <span>Preview Nama Vendor (Admin &amp; Kasir)</span>
                    </div>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      Tidak Ditampilkan Saat Print
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-emerald-200/70">
                    <span className="text-slate-600 font-medium">Vendor Terdaftar:</span>
                    <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                      {vendorName.trim() || <span className="text-slate-400 font-normal italic">Belum Ada Vendor / Tanpa Vendor</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-600">
                    <span>Biaya Vendor:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(vendorCost)}</span>
                  </div>
                  <p className="text-[9.5px] text-emerald-700 italic">
                    * Nama vendor tersimpan dalam faktur khusus untuk catatan operasional internal Admin &amp; Kasir. Saat struk dicetak atau dibagikan ke pelanggan, nama vendor ini secara otomatis dirahasiakan dan tidak akan tercetak.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDraftPreviewModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Tutup Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDraftPreviewModal(false);
                    handlePay();
                  }}
                  disabled={!isCashierOpen}
                  className="px-4 py-2 bg-[#00871f] hover:bg-[#007019] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-200"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Lanjut Bayar</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
