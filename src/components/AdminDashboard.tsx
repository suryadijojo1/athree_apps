import React, { useState, useMemo } from 'react';
import {
  Home,
  TrendingUp,
  FileSpreadsheet,
  Boxes,
  Calendar,
  ShoppingCart,
  Store,
  Plus,
  Minus,
  DollarSign,
  Clock,
  X,
  UserCheck,
  ChevronRight,
  Receipt,
  FileText,
  LogOut,
  Edit3,
  Coins,
  FileEdit,
  Trash2,
  KeyRound,
  Eye,
  Printer,
  Search,
  CheckCircle2,
  Wallet,
  Filter,
  Lock,
  Unlock,
  HardDrive,
  Flame,
  ShieldCheck,
  Shirt,
  Bell,
  AlertTriangle,
  CreditCard,
  Building2
} from 'lucide-react';
import type { Transaction, CashFlowRecord, CashierShift, User } from '../types';
import { formatCurrency } from '../utils/exportUtils';
import { calculateProfit } from '../utils/profitUtils';
import adminBackdrop from '../assets/images/admin_studio_backdrop_1789623254700.jpg';
import { UserManagementModal } from './UserManagementModal';
import { AddSalesModal } from './AddSalesModal';
import { ReviseCashFlowModal } from './ReviseCashFlowModal';

interface AdminDashboardProps {
  currentUser: User;
  users: User[];
  onUpdateUser: (user: User) => void;
  onAddUser?: (user: User) => void;
  onDeleteUser?: (userId: string) => void;
  onNavigate: (view: 'dashboard' | 'pos' | 'orders' | 'reports' | 'stock' | 'kaos-stock' | 'drive', subTab?: 'daily_sales' | 'sales_profit') => void;
  onSwitchUser: () => void;
  onLogout?: () => void;
  onOpenFirebaseModal?: () => void;
  transactions: Transaction[];
  shift: CashierShift;
  cashFlowRecords: CashFlowRecord[];
  onAddCashFlow: (record: Omit<CashFlowRecord, 'id'>) => void;
  onUpdateCashFlow?: (record: CashFlowRecord) => void;
  onDeleteCashFlow?: (recordId: string) => void;
  onViewReceipt: (transaction: Transaction) => void;
  onUpdateShift?: (shift: CashierShift) => void;
  onOpenShiftModal?: (mode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history') => void;
  onReviseInvoice?: (transaction: Transaction) => void;
  onDeleteInvoice?: (transaction: Transaction) => void;
  salesList?: string[];
  onAddSales?: (newSalesName: string) => void;
  onDeleteSales?: (salesName: string) => void;
  allowCashierDrive?: boolean;
  onToggleAllowCashierDrive?: (allowed: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users,
  onUpdateUser,
  onAddUser,
  onDeleteUser,
  onNavigate,
  onSwitchUser,
  onLogout,
  onOpenFirebaseModal,
  transactions,
  shift,
  cashFlowRecords,
  onAddCashFlow,
  onUpdateCashFlow,
  onDeleteCashFlow,
  onViewReceipt,
  onUpdateShift,
  onOpenShiftModal,
  onReviseInvoice,
  onDeleteInvoice,
  salesList = ['Kasir (Dimas)', 'Admin (DEAZBAR)'],
  onAddSales,
  onDeleteSales,
  allowCashierDrive = false,
  onToggleAllowCashierDrive
}) => {
  const [showPendapatanModal, setShowPendapatanModal] = useState(false);
  const [showPengeluaranModal, setShowPengeluaranModal] = useState(false);
  const [cashFlowMethod, setCashFlowMethod] = useState<'TUNAI' | 'TRANSFER'>('TUNAI');
  const [revisingCashFlow, setRevisingCashFlow] = useState<CashFlowRecord | null>(null);
  const [showReviseCashFlowModal, setShowReviseCashFlowModal] = useState<boolean>(false);
  const [showOrderTersimpanModal, setShowOrderTersimpanModal] = useState(false);
  const [showJurnalModal, setShowJurnalModal] = useState(false);
  const [showRevisiSaldoModal, setShowRevisiSaldoModal] = useState(false);
  const [showAddSalesModal, setShowAddSalesModal] = useState(false);
  const [showUserManagementModal, setShowUserManagementModal] = useState(false);
  const [newSaldoInput, setNewSaldoInput] = useState<number>(shift.startingCash);

  // States: Notifikasi Otomatis Jatuh Tempo Produksi (< 2 Hari)
  const [showUrgentOrdersNotification, setShowUrgentOrdersNotification] = useState<boolean>(true);
  const [showUrgentOrdersModal, setShowUrgentOrdersModal] = useState<boolean>(false);
  const [urgentSearchQuery, setUrgentSearchQuery] = useState<string>('');

  // Notifikasi Otomatis: Pesanan produksi (status Menunggu / Sedang Dikerjakan) yang jatuh temponya kurang dari 2 hari lagi
  const urgentProductionOrders = useMemo(() => {
    const now = new Date();
    const todayTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return transactions
      .filter((t) => {
        // Status produksi harus 'Menunggu' atau 'Sedang Dikerjakan'
        if (t.status !== 'Menunggu' && t.status !== 'Sedang Dikerjakan') {
          return false;
        }
        if (!t.dueDate) return false;

        const dueParts = t.dueDate.split(' ')[0].split('-');
        if (dueParts.length < 3) return false;
        const dueYear = parseInt(dueParts[0], 10);
        const dueMonth = parseInt(dueParts[1], 10) - 1;
        const dueDay = parseInt(dueParts[2], 10);
        const dueTimestamp = new Date(dueYear, dueMonth, dueDay).getTime();
        if (isNaN(dueTimestamp)) return false;

        const diffDays = Math.ceil((dueTimestamp - todayTimestamp) / (1000 * 60 * 60 * 24));
        // Kurang dari 2 hari lagi (termasuk <= 2 hari: hari ini, besok, atau sudah terlewat)
        return diffDays <= 2;
      })
      .map((t) => {
        const now = new Date();
        const todayTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const dueParts = t.dueDate.split(' ')[0].split('-');
        const dueYear = parseInt(dueParts[0], 10);
        const dueMonth = parseInt(dueParts[1], 10) - 1;
        const dueDay = parseInt(dueParts[2], 10);
        const dueTimestamp = new Date(dueYear, dueMonth, dueDay).getTime();
        const diffDays = Math.ceil((dueTimestamp - todayTimestamp) / (1000 * 60 * 60 * 24));

        let urgencyLabel = '';
        let urgencyBadgeClass = '';
        if (diffDays < 0) {
          urgencyLabel = `Terlambat ${Math.abs(diffDays)} Hari!`;
          urgencyBadgeClass = 'bg-rose-600 text-white font-extrabold animate-pulse';
        } else if (diffDays === 0) {
          urgencyLabel = 'Jatuh Tempo HARI INI!';
          urgencyBadgeClass = 'bg-red-500 text-white font-black animate-bounce';
        } else if (diffDays === 1) {
          urgencyLabel = 'Besok (1 Hari Lagi)';
          urgencyBadgeClass = 'bg-amber-500 text-white font-bold';
        } else {
          urgencyLabel = '2 Hari Lagi';
          urgencyBadgeClass = 'bg-yellow-400 text-slate-900 font-semibold';
        }

        return {
          ...t,
          diffDays,
          urgencyLabel,
          urgencyBadgeClass
        };
      })
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [transactions]);

  const filteredUrgentOrders = useMemo(() => {
    if (!urgentSearchQuery.trim()) return urgentProductionOrders;
    const q = urgentSearchQuery.toLowerCase().trim();
    return urgentProductionOrders.filter(
      (t) =>
        t.invoiceNo.toLowerCase().includes(q) ||
        t.customer?.name.toLowerCase().includes(q) ||
        t.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }, [urgentProductionOrders, urgentSearchQuery]);

  // Form states
  const [cashFlowAmount, setCashFlowAmount] = useState<number>(50000);
  const [cashFlowCategory, setCashFlowCategory] = useState<string>('Jasa Desain Tambahan');
  const [cashFlowDesc, setCashFlowDesc] = useState<string>('');
  const [cashFlowDate, setCashFlowDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [jurnalDateFilter, setJurnalDateFilter] = useState<string>('all');

  // Total omset across transactions for Jurnal summary
  const totalKas = useMemo(() => {
    return transactions
      .filter((t) => t.status !== 'BATAL')
      .reduce((sum, t) => sum + t.total, 0);
  }, [transactions]);

  // Filtered Jurnal calculations
  const filteredCashFlowsForJurnal = useMemo(() => {
    if (jurnalDateFilter === 'all') return cashFlowRecords;
    return cashFlowRecords.filter((r) => r.date && r.date.startsWith(jurnalDateFilter));
  }, [cashFlowRecords, jurnalDateFilter]);

  const filteredTxForJurnal = useMemo(() => {
    if (jurnalDateFilter === 'all') return transactions.filter((t) => t.status !== 'BATAL');
    return transactions.filter(
      (t) => t.status !== 'BATAL' && t.date && t.date.startsWith(jurnalDateFilter)
    );
  }, [transactions, jurnalDateFilter]);

  const jurnalPemasukanKasir = useMemo(() => {
    return filteredTxForJurnal.reduce((sum, t) => sum + t.total, 0);
  }, [filteredTxForJurnal]);

  const jurnalPendapatanLain = useMemo(() => {
    return filteredCashFlowsForJurnal
      .filter((r) => r.type === 'INCOME')
      .reduce((s, r) => s + r.amount, 0);
  }, [filteredCashFlowsForJurnal]);

  const jurnalPengeluaran = useMemo(() => {
    return filteredCashFlowsForJurnal
      .filter((r) => r.type === 'EXPENSE')
      .reduce((s, r) => s + r.amount, 0);
  }, [filteredCashFlowsForJurnal]);

  const jurnalSaldoBersih = jurnalPemasukanKasir + jurnalPendapatanLain - jurnalPengeluaran;

  const jurnalTotalVendor = useMemo(() => {
    return filteredTxForJurnal.reduce((sum, t) => sum + (t.vendorCost || 0), 0);
  }, [filteredTxForJurnal]);

  const jurnalTotalOngkir = useMemo(() => {
    return filteredTxForJurnal.reduce((sum, t) => sum + (t.shippingCost || 0), 0);
  }, [filteredTxForJurnal]);

  const jurnalTotalKeuntungan = useMemo(() => {
    return filteredTxForJurnal.reduce(
      (sum, t) => sum + calculateProfit(t.total, t.vendorCost || 0, t.shippingCost || 0),
      0
    );
  }, [filteredTxForJurnal]);

  // Saved / in-progress orders
  const pendingOrders = transactions.filter(
    (t) => t.status === 'Sedang Dikerjakan' || t.status === 'Menunggu'
  );

  const handleSavePendapatan = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashFlowAmount <= 0) return;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const fullDate = `${cashFlowDate} ${nowTime}`;
    onAddCashFlow({
      type: 'INCOME',
      category: cashFlowCategory,
      amount: Number(cashFlowAmount),
      description: cashFlowDesc.trim() || 'Pendapatan lain-lain',
      date: fullDate,
      paymentMethod: cashFlowMethod,
      recordedBy: currentUser.name
    });
    const isTransfer = cashFlowMethod === 'TRANSFER';
    setCashFlowAmount(50000);
    setCashFlowDesc('');
    setCashFlowMethod('TUNAI');
    setShowPendapatanModal(false);
    alert(
      isTransfer
        ? `Pendapatan lain Rp ${Number(cashFlowAmount).toLocaleString(
            'id-ID'
          )} (Transfer Bank) berhasil dicatat di Daftar Transaksi Penjualan & omset (TIDAK dimasukkan ke kas fisik toko)!`
        : `Pendapatan lain Rp ${Number(cashFlowAmount).toLocaleString(
            'id-ID'
          )} (Tunai) berhasil dicatat, ditambahkan ke Kas Tunai per hari tgl ${cashFlowDate}, dan masuk Daftar Transaksi Penjualan!`
    );
  };

  const handleSavePengeluaran = (e: React.FormEvent) => {
    e.preventDefault();
    if (cashFlowAmount <= 0) return;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const fullDate = `${cashFlowDate} ${nowTime}`;
    onAddCashFlow({
      type: 'EXPENSE',
      category: cashFlowCategory || 'Bahan Baku & Tinta',
      amount: Number(cashFlowAmount),
      description: cashFlowDesc.trim() || 'Operasional / Pengeluaran toko',
      date: fullDate,
      recordedBy: currentUser.name
    });
    setCashFlowAmount(50000);
    setCashFlowDesc('');
    setShowPengeluaranModal(false);
    alert(`Pengeluaran Rp ${Number(cashFlowAmount).toLocaleString('id-ID')} berhasil dicatat & dikurangi dari transaksi tanggal ${cashFlowDate}!`);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden select-none bg-slate-900">
      {/* Background with Studio Mockups & dark overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={adminBackdrop}
          alt="Studio Mockup Backdrop"
          className="w-full h-full object-cover object-center"
        />
        {/* Subtle dark vignette overlay for optimal contrast */}
        <div className="absolute inset-0 bg-black/45 backdrop-contrast-105"></div>
      </div>

      {/* 1. TOP GREEN BAR (Matches screenshot) */}
      <header className="relative z-10 h-12 bg-[#00871f] px-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-bold uppercase tracking-wider hidden sm:inline">
            Admin Portal &bull; Athree Studio
          </span>
        </div>

        {/* Right Top Icons (Matches screenshot) */}
        <div className="flex items-center gap-4 text-white">
          <button
            onClick={() => onNavigate('dashboard')}
            title="Beranda Admin"
            className="hover:scale-110 active:scale-95 transition-transform"
          >
            <Home className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => onNavigate('reports')}
            title="Grafik & Laporan Penjualan"
            className="hover:scale-110 active:scale-95 transition-transform"
          >
            <TrendingUp className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => setShowJurnalModal(true)}
            title="Jurnal Keuangan"
            className="hover:scale-110 active:scale-95 transition-transform"
          >
            <FileSpreadsheet className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => onNavigate('stock')}
            title="Manajemen Produk & Stok"
            className="hover:scale-110 active:scale-95 transition-transform"
          >
            <Boxes className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => onNavigate('orders')}
            title="Histori & Jatuh Tempo Pesanan"
            className="hover:scale-110 active:scale-95 transition-transform cursor-pointer"
          >
            <Calendar className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => onNavigate('pos')}
            title="KASIR"
            className="hover:scale-110 active:scale-95 transition-transform cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 stroke-[2]" />
          </button>
          <button
            onClick={() => onNavigate('pos')}
            title="KASIR POS"
            className="hover:scale-110 active:scale-95 transition-transform cursor-pointer"
          >
            <Store className="w-5 h-5 stroke-[2]" />
          </button>

          {/* Notifikasi Otomatis Jatuh Tempo Produksi (< 2 Hari) */}
          <button
            type="button"
            onClick={() => setShowUrgentOrdersModal(true)}
            title={`Notifikasi: ${urgentProductionOrders.length} Pesanan Produksi Jatuh Tempo (< 2 Hari)`}
            className="relative hover:scale-110 active:scale-95 transition-transform p-1.5 rounded-lg bg-black/20 hover:bg-black/30 cursor-pointer text-white"
          >
            <Bell className={`w-5 h-5 ${urgentProductionOrders.length > 0 ? 'text-amber-300 animate-bounce' : 'text-white'}`} />
            {urgentProductionOrders.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center animate-pulse shadow-md">
                {urgentProductionOrders.length}
              </span>
            )}
          </button>

          {/* Direct Ganti Akun & Logout Buttons (Replaced the popup menu) */}
          <button
            type="button"
            onClick={() => setShowUserManagementModal(true)}
            title="Ubah Nama Username & PIN Password Pengguna"
            className="hover:scale-110 active:scale-95 transition-transform p-1 cursor-pointer text-white"
          >
            <KeyRound className="w-5 h-5 stroke-[2]" />
          </button>

          <button
            type="button"
            onClick={onSwitchUser}
            title="Ganti Akun Pengguna"
            className="hover:scale-110 active:scale-95 transition-transform p-1 cursor-pointer"
          >
            <UserCheck className="w-5 h-5 stroke-[2]" />
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Logout / Keluar"
              className="hover:scale-110 active:scale-95 transition-transform p-1 cursor-pointer text-white/90 hover:text-white"
            >
              <LogOut className="w-5 h-5 stroke-[2]" />
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN CENTER BODY (Matches screenshot layout) */}
      <div className="relative z-10 flex-1 p-4 md:p-6 lg:p-8 flex flex-col justify-between overflow-y-auto">
        {/* Top Area: Branding & Automated Urgent Orders Notification Widget */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 w-full">
          {/* Top Left: Branding Texts */}
          <div className="flex flex-col items-start gap-2 max-w-sm shrink-0">
            <div className="text-white drop-shadow-md">
              <span className="text-sm md:text-base font-normal text-slate-100 block tracking-wide">
                Pemilik
              </span>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mt-0.5">
                Athree_Studio_Jayapura
              </h1>
              <p className="text-xs md:text-sm font-semibold tracking-wider text-slate-200 uppercase mt-1">
                PUSAT KAOS, SABLON & STIKER
              </p>
            </div>
          </div>

          {/* Automatic Urgent Production Orders Notification Card (< 2 Hari) */}
          {urgentProductionOrders.length > 0 && showUrgentOrdersNotification && (
            <div className="w-full lg:max-w-xl bg-slate-900/90 backdrop-blur-md border border-rose-500/70 rounded-2xl p-3.5 shadow-2xl text-white animate-in fade-in slide-in-from-top-3 duration-300">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-rose-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                    <Bell className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-extrabold text-rose-300 flex items-center gap-1.5">
                      <span>Notifikasi Jatuh Tempo Produksi (&lt; 2 Hari)</span>
                      <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black">
                        {urgentProductionOrders.length} Pesanan
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Status Menunggu / Dikerjakan yang mendekati atau telah lewat batas waktu
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowUrgentOrdersModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    Buka Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUrgentOrdersNotification(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Sembunyikan panel (dapat dibuka kembali lewat lonceng notifikasi)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Order List Cards */}
              <div className="mt-2.5 space-y-2 max-h-44 overflow-y-auto pr-1">
                {urgentProductionOrders.slice(0, 3).map((order) => (
                  <div
                    key={order.id}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-rose-400/50 transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-[12px]">
                          {order.invoiceNo}
                        </span>
                        <span className="text-slate-300 font-semibold truncate">
                          {order.customer?.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {order.items.map((i) => `${i.name} (${i.quantity})`).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-1 rounded-lg text-[10px] whitespace-nowrap shadow-xs ${order.urgencyBadgeClass}`}>
                        {order.urgencyLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('orders')}
                        className="px-2 py-1 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Buka detail di menu Antrean Pesanan"
                      >
                        Buka
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {urgentProductionOrders.length > 3 && (
                <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] text-slate-400">
                  <span>+ {urgentProductionOrders.length - 3} pesanan mendesak lainnya</span>
                  <button
                    type="button"
                    onClick={() => setShowUrgentOrdersModal(true)}
                    className="text-rose-400 hover:text-rose-300 font-bold underline cursor-pointer"
                  >
                    Lihat Selengkapnya &rarr;
                  </button>
                </div>
              )}
            </div>
          )}

          {urgentProductionOrders.length > 0 && !showUrgentOrdersNotification && (
            <button
              type="button"
              onClick={() => setShowUrgentOrdersNotification(true)}
              className="bg-rose-600/95 hover:bg-rose-700 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border border-rose-400 flex items-center gap-1.5 animate-pulse cursor-pointer self-start"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{urgentProductionOrders.length} Pesanan Jatuh Tempo (&lt; 2 Hari)</span>
            </button>
          )}
        </div>

        {/* Bottom Right Floating Action Grid (Matches screenshot) */}
        <div className="self-end flex flex-col items-end gap-3 max-w-4xl w-full">
          {/* Upper row: 4 white rounded rectangular buttons */}
          <div className="flex flex-wrap items-center gap-2.5 justify-end">
            <button
              onClick={() => {
                setCashFlowCategory('Jasa Desain Tambahan');
                setCashFlowDate(new Date().toISOString().slice(0, 10));
                setCashFlowMethod('TUNAI');
                setShowPendapatanModal(true);
              }}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 cursor-pointer"
            >
              + Pendapatan Lain
            </button>
            <button
              onClick={() => {
                setCashFlowCategory('Bahan Baku & Tinta');
                setCashFlowDate(new Date().toISOString().slice(0, 10));
                setShowPengeluaranModal(true);
              }}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 cursor-pointer"
            >
              - Pengeluaran
            </button>
            <button
              onClick={() => setShowJurnalModal(true)}
              className="bg-white hover:bg-emerald-50 text-emerald-800 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-emerald-200 cursor-pointer flex items-center gap-1.5"
            >
              <FileEdit className="w-4 h-4 text-emerald-600" />
              <span>Revisi Kas &amp; Jurnal</span>
            </button>
            <button
              onClick={() => setShowOrderTersimpanModal(true)}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 relative cursor-pointer"
            >
              Order Tersimpan
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {pendingOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => onNavigate('drive')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 flex items-center gap-1.5 cursor-pointer"
              title="Akses Google Drive Cloud Storage & Cadangan Data"
            >
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>Google Drive</span>
            </button>
            <button
              onClick={() => onNavigate('kaos-stock')}
              className="bg-white hover:bg-slate-50 text-emerald-700 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-emerald-100 flex items-center gap-1.5 cursor-pointer"
              title="Manajemen Khusus Stok Kaos Polos (Warna & Ukuran)"
            >
              <Shirt className="w-4 h-4 text-emerald-600" />
              <span>Stok Kaos</span>
            </button>
            {onToggleAllowCashierDrive && (
              <button
                type="button"
                onClick={() => onToggleAllowCashierDrive(!allowCashierDrive)}
                className={`px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-lg hover:shadow-xl transition-all active:scale-95 border flex items-center gap-1.5 cursor-pointer ${
                  allowCashierDrive
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-400'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-100'
                }`}
                title={
                  allowCashierDrive
                    ? 'Akses Drive Kasir: Sedang Aktif (Klik untuk Kunci Khusus Admin)'
                    : 'Akses Drive Kasir: Terkunci Khusus Admin (Klik untuk Berikan Akses Kasir)'
                }
              >
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Drive Kasir: {allowCashierDrive ? 'Diizinkan' : 'Terkunci (Admin)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowUserManagementModal(true)}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 flex items-center gap-1.5 cursor-pointer"
              title="Ubah Nama Username & PIN Password Pengguna"
            >
              <KeyRound className="w-4 h-4 text-[#00871f]" />
              <span>Ubah Username & PIN</span>
            </button>
            {onAddSales && (
              <button
                type="button"
                onClick={() => setShowAddSalesModal(true)}
                className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 flex items-center gap-1.5 cursor-pointer"
                title="Kelola & Tambah Petugas Sales Baru"
              >
                <UserCheck className="w-4 h-4 text-[#00871f]" />
                <span>Kelola Sales</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('reports', 'sales_profit')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-slate-100 flex items-center gap-1.5 cursor-pointer"
              title="Laporan Keuntungan Seluruh Sales (Harian, Bulanan, Tahunan)"
            >
              <TrendingUp className="w-4 h-4 text-[#00871f]" />
              <span>Laporan Keuntungan Sales</span>
            </button>
            {shift.isOpen ? (
              <button
                type="button"
                onClick={() => onOpenShiftModal?.('reconcile')}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-rose-500 flex items-center gap-1.5 cursor-pointer"
                title="Menu Tutup Kasir & Rekonsiliasi Kas"
              >
                <Lock className="w-4 h-4" />
                <span>Tutup Kasir</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenShiftModal?.('open_shift')}
                className="bg-[#00871f] hover:bg-[#007019] text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-lg hover:shadow-xl transition-all active:scale-95 border border-emerald-600 flex items-center gap-1.5 cursor-pointer"
                title="Buka Kasir Baru (Tanggal & Jam Otomatis)"
              >
                <Unlock className="w-4 h-4" />
                <span>Buka Kasir</span>
              </button>
            )}
          </div>

          {/* Lower row: 6 large white square cards (Matches screenshot) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 w-full sm:w-auto">
            {/* 1. GRAFIK */}
            <button
              onClick={() => onNavigate('reports')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <TrendingUp className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">GRAFIK</span>
            </button>

            {/* 2. JURNAL */}
            <button
              onClick={() => setShowJurnalModal(true)}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <FileSpreadsheet className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">JURNAL</span>
            </button>

            {/* 3. PRODUK */}
            <button
              onClick={() => onNavigate('stock')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <Boxes className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">PRODUK</span>
            </button>

            {/* 4. HISTORI */}
            <button
              onClick={() => onNavigate('orders')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <Calendar className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">HISTORI</span>
            </button>

            {/* 5. PEMBAYARAN */}
            <button
              onClick={() => onNavigate('pos')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <ShoppingCart className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">PEMBAYARAN</span>
            </button>

            {/* 6. PENJUALAN */}
            <button
              onClick={() => onNavigate('pos')}
              className="bg-white hover:bg-slate-50 text-[#3b49df] p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-28 h-24 border border-slate-100 group"
            >
              <Store className="w-6 h-6 stroke-[2.2] group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold tracking-wider">PENJUALAN</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM GREEN STRIP (Matches screenshot) */}
      <footer className="relative z-10 h-7 bg-[#00871f] w-full shrink-0 shadow-inner"></footer>

      {/* =========================================================================
          MODAL: Pendapatan Lain
      ========================================================================= */}
      {showPendapatanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Catat Pendapatan Lain
              </h3>
              <button onClick={() => setShowPendapatanModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePendapatan} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tanggal Pendapatan *
                </label>
                <input
                  type="date"
                  required
                  value={cashFlowDate}
                  onChange={(e) => setCashFlowDate(e.target.value)}
                  className="w-full text-xs font-bold text-emerald-800 bg-emerald-50/50 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Otomatis ditambahkan ke omset &amp; kas transaksi tanggal ini
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Pendapatan
                </label>
                <select
                  value={cashFlowCategory}
                  onChange={(e) => setCashFlowCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Jasa Desain Tambahan">Jasa Desain Tambahan</option>
                  <option value="Ongkos Kirim / Ekspedisi">Ongkos Kirim / Ekspedisi</option>
                  <option value="Jasa Maklon Cetak">Jasa Maklon Cetak</option>
                  <option value="Pendapatan Sewa / Lainnya">Pendapatan Sewa / Lainnya</option>
                </select>
              </div>

              {/* Opsi Penerimaan: Transfer / Tunai */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Opsi Penerimaan Pembayaran *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCashFlowMethod('TUNAI')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      cashFlowMethod === 'TUNAI'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Coins className="w-3.5 h-3.5 text-emerald-600" />
                      <span>💵 Tunai</span>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-1 leading-tight">
                      Ditambahkan ke kas toko per hari tgl input &amp; masuk daftar transaksi
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashFlowMethod('TRANSFER')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      cashFlowMethod === 'TRANSFER'
                        ? 'border-blue-500 bg-blue-50 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-slate-50/50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                      <span>💳 Transfer</span>
                    </div>
                    <p className="text-[9.5px] text-slate-500 mt-1 leading-tight">
                      Tercatat di daftar transaksi, TIDAK ditambahkan ke kas fisik
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal (Rp) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={cashFlowAmount}
                  onChange={(e) => setCashFlowAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={cashFlowDesc}
                  onChange={(e) => setCashFlowDesc(e.target.value)}
                  placeholder="Misal: Biaya vector logo manual"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPendapatanModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Kas Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Pengeluaran Toko
      ========================================================================= */}
      {showPengeluaranModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 text-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Minus className="w-4 h-4 text-rose-600" />
                Catat Pengeluaran Toko
              </h3>
              <button onClick={() => setShowPengeluaranModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePengeluaran} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tanggal Pengeluaran *
                </label>
                <input
                  type="date"
                  required
                  value={cashFlowDate}
                  onChange={(e) => setCashFlowDate(e.target.value)}
                  className="w-full text-xs font-bold text-rose-800 bg-rose-50/50 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Otomatis dikurangi dari omset &amp; kas transaksi tanggal ini
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Biaya
                </label>
                <select
                  value={cashFlowCategory}
                  onChange={(e) => setCashFlowCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="Bahan Baku & Tinta">Bahan Baku & Tinta Sablon</option>
                  <option value="Listrik & Operasional">Listrik & Operasional</option>
                  <option value="Gaji / Uang Makan Staf">Gaji / Uang Makan Staf</option>
                  <option value="Maintenance Mesin Sablon">Maintenance Mesin Sablon</option>
                  <option value="Pengeluaran Lainnya">Pengeluaran Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nominal Pengeluaran (Rp) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  required
                  value={cashFlowAmount}
                  onChange={(e) => setCashFlowAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan Pembelian / Pengeluaran
                </label>
                <input
                  type="text"
                  value={cashFlowDesc}
                  onChange={(e) => setCashFlowDesc(e.target.value)}
                  placeholder="Misal: Beli tinta plastisol hitam 1kg"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPengeluaranModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Order Tersimpan (Antrean Produksi & Jatuh Tempo)
      ========================================================================= */}
      {showOrderTersimpanModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-100 text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#00871f]" />
                  Daftar Order Tersimpan & Antrean Produksi
                </h3>
                <p className="text-xs text-slate-500">
                  Total {pendingOrders.length} order aktif dengan jatuh tempo penyelesaian
                </p>
              </div>
              <button
                onClick={() => setShowOrderTersimpanModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {pendingOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Tidak ada order yang sedang tersimpan atau menunggu produksi.
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#00871f]">
                          {order.invoiceNo}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {order.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 mt-0.5">
                        {order.customer.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Target Selesai:{' '}
                        <span className="font-bold text-slate-800">{order.dueDate || '-'}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">
                        {order.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                      </p>
                      {order.vendorName && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded"
                            title="Preview Nama Vendor (Khusus Admin & Kasir - Tidak Dicetak)"
                          >
                            <Building2 className="w-2.5 h-2.5 text-[#00871f]" />
                            Vendor: {order.vendorName}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-right flex items-center gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          {formatCurrency(order.total)}
                        </span>
                        <span className="text-[10px] text-slate-400">{order.paymentMethod}</span>
                      </div>
                      {onReviseInvoice && (
                        <button
                          onClick={() => {
                            setShowOrderTersimpanModal(false);
                            onReviseInvoice(order);
                          }}
                          className="p-1.5 bg-white border border-slate-200 hover:bg-amber-50 hover:text-amber-700 rounded-lg text-slate-600 transition-colors shadow-2xs cursor-pointer"
                          title="Revisi Faktur / Invoice"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteInvoice && (
                        <button
                          onClick={() => {
                            setShowOrderTersimpanModal(false);
                            onDeleteInvoice(order);
                          }}
                          className="p-1.5 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 hover:border-rose-300 transition-colors shadow-2xs cursor-pointer"
                          title="Hapus Faktur (Khusus Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowOrderTersimpanModal(false);
                          onViewReceipt(order);
                        }}
                        className="p-1.5 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-[#00871f] rounded-lg text-slate-600 transition-colors shadow-2xs cursor-pointer"
                        title="Lihat Detail Pesanan"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  setShowOrderTersimpanModal(false);
                  onNavigate('orders');
                }}
                className="text-xs font-bold text-[#00871f] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Buka Manajemen Antrean Lengkap</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowOrderTersimpanModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Jurnal Keuangan
      ========================================================================= */}
      {showJurnalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-5 shadow-2xl border border-slate-100 text-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#00871f]" />
                  Jurnal & Arus Kas Keuangan Toko
                </h3>
                <p className="text-xs text-slate-500">
                  Rekap pemasukan penjualan, pendapatan lain, dan pengeluaran operasional
                </p>
              </div>
              <button onClick={() => setShowJurnalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date filter bar for Jurnal */}
            <div className="flex flex-wrap items-center justify-between gap-2 my-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Filter Tanggal:</span>
                <button
                  type="button"
                  onClick={() => setJurnalDateFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    jurnalDateFilter === 'all'
                      ? 'bg-[#00871f] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Semua Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setJurnalDateFilter(new Date().toISOString().slice(0, 10))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    jurnalDateFilter === new Date().toISOString().slice(0, 10)
                      ? 'bg-[#00871f] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Hari Ini
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-slate-500 font-medium">Pilih Tanggal:</label>
                <input
                  type="date"
                  value={jurnalDateFilter === 'all' ? '' : jurnalDateFilter}
                  onChange={(e) => setJurnalDateFilter(e.target.value || 'all')}
                  className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 cursor-pointer focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider block">Pemasukan Kasir</span>
                <p className="text-sm font-extrabold text-emerald-700 mt-0.5">{formatCurrency(jurnalPemasukanKasir)}</p>
                <span className="text-[10px] text-emerald-600 block mt-0.5">{filteredTxForJurnal.length} transaksi</span>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5">
                <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider block">(+) Pendapatan Lain</span>
                <p className="text-sm font-extrabold text-blue-700 mt-0.5">
                  +{formatCurrency(jurnalPendapatanLain)}
                </p>
                <span className="text-[10px] text-blue-600 block mt-0.5">
                  {filteredCashFlowsForJurnal.filter((r) => r.type === 'INCOME').length} catatan
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                <span className="text-[10px] text-rose-800 font-bold uppercase tracking-wider block">(-) Pengeluaran</span>
                <p className="text-sm font-extrabold text-rose-700 mt-0.5">
                  -{formatCurrency(jurnalPengeluaran)}
                </p>
                <span className="text-[10px] text-rose-600 block mt-0.5">
                  {filteredCashFlowsForJurnal.filter((r) => r.type === 'EXPENSE').length} catatan
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-white">
                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider block">(=) Saldo Bersih</span>
                <p className="text-sm font-extrabold text-emerald-400 mt-0.5">{formatCurrency(jurnalSaldoBersih)}</p>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {jurnalDateFilter === 'all' ? 'Seluruh periode' : `Tgl ${jurnalDateFilter}`}
                </span>
              </div>
            </div>

            {/* Rincian Keuntungan Faktur (Khusus Admin / Owner) */}
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 my-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#00871f] text-white rounded-lg shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-emerald-950 uppercase tracking-wider text-[11px] block">
                    Hasil Keuntungan Faktur Penjualan (Khusus Admin/Owner)
                  </span>
                  <span className="text-[10.5px] text-slate-500">
                    Faktur ({formatCurrency(jurnalPemasukanKasir)}) - [Biaya Vendor ({formatCurrency(jurnalTotalVendor)}) + Biaya Kirim ({formatCurrency(jurnalTotalOngkir)})]
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wider">
                    Total Keuntungan Faktur
                  </span>
                  <span className={`text-base font-black ${jurnalTotalKeuntungan >= 0 ? 'text-[#00871f]' : 'text-rose-600'}`}>
                    {formatCurrency(jurnalTotalKeuntungan)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowJurnalModal(false);
                    onNavigate('reports', 'sales_profit');
                  }}
                  className="px-3 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95"
                  title="Lihat Laporan Keuntungan Seluruh Sales lengkap per Sales, Harian, Bulanan, Tahunan"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Rincian Per Sales &rarr;</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal &amp; Waktu</th>
                    <th className="py-2.5 px-3">Tipe</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Metode Kas</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3">Dicatat Oleh</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                    <th className="py-2.5 px-3 text-center">Aksi Revisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCashFlowsForJurnal.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Belum ada catatan pendapatan lain / pengeluaran untuk {jurnalDateFilter === 'all' ? 'semua tanggal' : `tanggal ${jurnalDateFilter}`}.
                      </td>
                    </tr>
                  ) : (
                    filteredCashFlowsForJurnal.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">{rec.date}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.type === 'INCOME'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rec.type === 'INCOME' ? 'MASUK (+)' : 'KELUAR (-)'}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">{rec.category}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {rec.type === 'INCOME' ? (
                            rec.paymentMethod === 'TRANSFER' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                <CreditCard className="w-3 h-3 text-blue-600" />
                                Transfer (Rekening)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Coins className="w-3 h-3 text-emerald-600" />
                                Tunai (Kas Toko)
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <Coins className="w-3 h-3 text-rose-600" />
                              Kas Toko
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{rec.description || '-'}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px] whitespace-nowrap">{rec.recordedBy}</td>
                        <td
                          className={`py-2 px-3 text-right font-bold whitespace-nowrap ${
                            rec.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {rec.type === 'INCOME' ? '+' : '-'}
                          {formatCurrency(rec.amount)}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRevisingCashFlow(rec);
                                setShowReviseCashFlowModal(true);
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00871f] font-bold text-[10.5px] rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-emerald-200 shadow-2xs"
                              title="Revisi Data Ini"
                            >
                              <FileEdit className="w-3 h-3" />
                              <span>Revisi</span>
                            </button>
                            {onDeleteCashFlow && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Yakin ingin menghapus catatan ${
                                        rec.type === 'INCOME' ? 'pendapatan' : 'pengeluaran'
                                      } sebesar ${formatCurrency(rec.amount)}?`
                                    )
                                  ) {
                                    onDeleteCashFlow(rec.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors cursor-pointer"
                                title="Hapus Catatan"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowJurnalModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                Tutup Jurnal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Revisi Saldo Awal (Admin) */}
      {showRevisiSaldoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Revisi Saldo Awal Hari Ini</h3>
                  <p className="text-[11px] text-slate-500">Khusus Administrator / Pemilik</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRevisiSaldoModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const newAmount = Number(newSaldoInput);
                if (isNaN(newAmount) || newAmount < 0) {
                  alert('Nominal saldo awal tidak valid');
                  return;
                }
                if (onUpdateShift) {
                  const diff = newAmount - shift.startingCash;
                  onUpdateShift({
                    ...shift,
                    startingCash: newAmount,
                    expectedCash: shift.expectedCash + diff,
                    notes: `${shift.notes ? shift.notes + ' | ' : ''}Saldo awal direvisi Admin (${currentUser.name}) menjadi Rp ${newAmount.toLocaleString('id-ID')}`
                  });
                }
                setShowRevisiSaldoModal(false);
              }}
              className="space-y-3 mt-3"
            >
              <div>
                <span className="text-[11px] text-slate-500 block mb-0.5">Nominal Saldo Awal Saat Ini:</span>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg block">
                  {formatCurrency(shift.startingCash)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nominal Saldo Awal Baru (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={newSaldoInput}
                  onChange={(e) => setNewSaldoInput(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  placeholder="Contoh: 500000"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Saldo awal dapat diinput oleh Kasir &amp; Admin saat buka shift, serta dapat direvisi sewaktu-waktu oleh Admin.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRevisiSaldoModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Revisi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Username & PIN Pengguna (Khusus Admin) */}
      <UserManagementModal
        isOpen={showUserManagementModal}
        onClose={() => setShowUserManagementModal(false)}
        users={users}
        currentUser={currentUser}
        onUpdateUser={onUpdateUser}
        onAddUser={onAddUser}
        onDeleteUser={onDeleteUser}
      />

      {/* Modal Kelola & Tambah Petugas Sales (Khusus Admin) */}
      {showAddSalesModal && onAddSales && (
        <AddSalesModal
          isOpen={showAddSalesModal}
          onClose={() => setShowAddSalesModal(false)}
          salesList={salesList}
          onAddSales={onAddSales}
          onDeleteSales={onDeleteSales}
        />
      )}

      {/* Modal: Daftar Lengkap Notifikasi Pesanan Jatuh Tempo Produksi (< 2 Hari) */}
      {showUrgentOrdersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span>Notifikasi Otomatis Jatuh Tempo Produksi (&lt; 2 Hari)</span>
                    <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-xs font-extrabold">
                      {urgentProductionOrders.length} Pesanan
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Daftar pesanan dengan status <strong>Menunggu</strong> atau <strong>Sedang Dikerjakan</strong> yang mendekati atau telah lewat jatuh tempo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUrgentOrdersModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urgentSearchQuery}
                  onChange={(e) => setUrgentSearchQuery(e.target.value)}
                  placeholder="Cari invoice, pelanggan, atau nama produk..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUrgentOrdersModal(false);
                  onNavigate('orders');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Calendar className="w-4 h-4" />
                <span>Buka Menu Antrean Pesanan</span>
              </button>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredUrgentOrders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Tidak ada pesanan produksi mendesak yang cocok dengan pencarian.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  {filteredUrgentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {order.invoiceNo}
                          </span>
                          <span className="font-bold text-slate-700 text-xs">
                            {order.customer?.name}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {order.customer?.phone}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {order.items.map((i) => `${i.name} (${i.quantity} ${i.kaosSize ? `- ${i.kaosSize}` : ''})`).join(', ')}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                          <span>Total: <strong>{formatCurrency(order.total)}</strong></span>
                          {order.remainingAmount ? (
                            <span className="text-rose-600 font-semibold">
                              Sisa Piutang: {formatCurrency(order.remainingAmount)}
                            </span>
                          ) : null}
                          <span>Jatuh Tempo: <strong className="text-slate-700">{order.dueDate}</strong></span>
                          {order.vendorName && (
                            <span
                              className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded"
                              title="Preview Nama Vendor (Khusus Admin & Kasir - Tidak Dicetak)"
                            >
                              <Building2 className="w-2.5 h-2.5 text-[#00871f]" />
                              Vendor: {order.vendorName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap shadow-xs ${order.urgencyBadgeClass}`}>
                          {order.urgencyLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUrgentOrdersModal(false);
                            onViewReceipt(order);
                          }}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Nota</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowUrgentOrdersModal(false);
                            onNavigate('orders');
                          }}
                          className="px-3 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Proses</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Total {filteredUrgentOrders.length} pesanan mendesak ditemukan
              </span>
              <button
                type="button"
                onClick={() => setShowUrgentOrdersModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Revisi Pendapatan Lain / Pengeluaran Toko */}
      <ReviseCashFlowModal
        isOpen={showReviseCashFlowModal}
        onClose={() => {
          setShowReviseCashFlowModal(false);
          setRevisingCashFlow(null);
        }}
        record={revisingCashFlow}
        onSaveRevision={(updated) => {
          if (onUpdateCashFlow) {
            onUpdateCashFlow(updated);
          }
        }}
        onDeleteRecord={(recId) => {
          if (onDeleteCashFlow) {
            onDeleteCashFlow(recId);
          }
        }}
        currentUser={currentUser}
      />
    </div>
  );
};
