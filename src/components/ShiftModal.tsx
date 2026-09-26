import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  DollarSign,
  Lock,
  Unlock,
  X,
  AlertCircle,
  Edit3,
  CheckCircle2,
  BarChart3,
  CreditCard,
  User as UserIcon,
  Printer,
  Calculator,
  RotateCcw,
  AlertTriangle,
  History,
  Check,
  ChevronRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { CashierShift, User, Transaction, CashFlowRecord, CashDenomination } from '../types';
import { formatCurrency } from '../utils/exportUtils';

interface ShiftModalProps {
  shift: CashierShift;
  isOpen: boolean;
  onClose: () => void;
  onUpdateShift: (updatedShift: CashierShift) => void;
  activeCashierName: string;
  currentUser?: User;
  transactions?: Transaction[];
  cashFlowRecords?: CashFlowRecord[];
  shiftHistory?: CashierShift[];
  onSaveToHistory?: (closedShift: CashierShift) => void;
  initialViewMode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history';
  onLogout?: () => void;
  users?: User[];
  onUpdateUser?: (updatedUser: User) => void;
  onOpenUserManagement?: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  shift,
  isOpen,
  onClose,
  onUpdateShift,
  activeCashierName,
  currentUser,
  transactions = [],
  cashFlowRecords = [],
  shiftHistory = [],
  onSaveToHistory,
  initialViewMode,
  onLogout,
  users = [],
  onUpdateUser,
  onOpenUserManagement
}) => {
  // Modal View Modes:
  // 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history'
  const [viewMode, setViewMode] = useState<
    'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history'
  >(() => initialViewMode || (shift.isOpen ? 'overview' : 'closed_summary'));

  // Admin user selection and rename states
  const [selectedCashierUserId, setSelectedCashierUserId] = useState<string>(() => {
    const match = users?.find((u) => u.name.toLowerCase() === activeCashierName.toLowerCase());
    return match?.id || currentUser?.id || (users && users[0]?.id) || '';
  });
  const [customCashierName, setCustomCashierName] = useState<string>(activeCashierName);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserNameVal, setEditingUserNameVal] = useState<string>('');

  const [editingActiveShiftCashier, setEditingActiveShiftCashier] = useState<boolean>(false);
  const [editingActiveShiftCashierName, setEditingActiveShiftCashierName] = useState<string>(shift.cashierName);

  // Live real-time clock ticker (updates every second for precise automatic time stamping)
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatIndonesianFull = (date: Date) => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = days[date.getDay()];
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${dayName}, ${dateStr} - ${timeStr} WIT`;
  };

  const formatShortDateTime = (date: Date) => {
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  };

  // Selected historic shift to view details of
  const [selectedHistoryShift, setSelectedHistoryShift] = useState<CashierShift | null>(null);

  // If shift state changes or modal opens or initialViewMode changes, reset appropriate mode
  useEffect(() => {
    if (isOpen) {
      if (initialViewMode) {
        setViewMode(initialViewMode);
      } else if (shift.isOpen) {
        setViewMode('overview');
      } else {
        setViewMode('closed_summary');
      }
    }
  }, [isOpen, shift.isOpen, initialViewMode]);

  // Denominations for cash physical counting
  const [denominations, setDenominations] = useState<CashDenomination>({
    k100: 0,
    k50: 0,
    k20: 0,
    k10: 0,
    k5: 0,
    k2: 0,
    k1: 0,
    coins: 0
  });

  const [inputMode, setInputMode] = useState<'denominations' | 'direct'>('denominations');
  const [directCashInput, setDirectCashInput] = useState<number>(shift.expectedCash);

  // Notes and Verification checkbox
  const [notesInput, setNotesInput] = useState<string>(shift.notes || '');
  const [isVerifiedCheck, setIsVerifiedCheck] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');

  // Admin starting cash revision
  const [isEditingStartingCash, setIsEditingStartingCash] = useState<boolean>(false);
  const [revisedStartingCash, setRevisedStartingCash] = useState<number>(shift.startingCash);
  const [startingCashInput, setStartingCashInput] = useState<number>(500000);

  // Helper to parse date strings in various formats safely
  const parseDateString = (dateStr?: string): number | null => {
    if (!dateStr) return null;
    const direct = Date.parse(dateStr);
    if (!isNaN(direct)) return direct;

    try {
      const cleaned = dateStr.replace(/\./g, ':');
      const monthNames: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
        jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
        oct: '10', nop: '11', nov: '11', des: '12', dec: '12'
      };
      const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2}))?/);
      if (match) {
        const day = match[1].padStart(2, '0');
        const monStr = match[2].toLowerCase().slice(0, 3);
        const mon = monthNames[monStr] || '01';
        const year = match[3];
        const hour = (match[4] || '00').padStart(2, '0');
        const min = (match[5] || '00').padStart(2, '0');
        const iso = `${year}-${mon}-${day}T${hour}:${min}:00`;
        const t = Date.parse(iso);
        if (!isNaN(t)) return t;
      }
    } catch {}
    return null;
  };

  // Calculate live shift statistics strictly isolated to THIS active shift
  const shiftStats = useMemo(() => {
    // Tentukan tanggal hari ini (ISO: YYYY-MM-DD)
    const todayIso = new Date().toISOString().slice(0, 10);

    // Filter transaksi: Hapus akumulasi sesi lama!
    // Untuk shift aktif (isOpen), HANYA hitung transaksi hari ini (todayIso).
    // Transaksi dari hari-hari sebelumnya TIDAK dihitung ke dalam shift hari ini.
    const shiftTransactions = transactions.filter((t) => {
      if (t.status === 'BATAL') return false;

      const txDate = t.date || (t.createdAt ? t.createdAt.slice(0, 10) : '');

      if (shift.isOpen) {
        // Shift aktif: HANYA transaksi HARI INI
        if (!txDate.startsWith(todayIso)) {
          return false;
        }
        // Jika ada shiftId, cocokkan atau jika dibuat hari ini tetap dihitung
        if (t.shiftId) {
          return t.shiftId === shift.id || t.shiftId.includes(todayIso);
        }
        return true;
      }

      // Untuk shift yang sudah ditutup (history/closed summary):
      if (t.shiftId && t.shiftId === shift.id) {
        return true;
      }
      const shiftStart = shift.startTimestamp || parseDateString(shift.startTime);
      const shiftEnd = shift.endTimestamp || (shift.endTime ? parseDateString(shift.endTime) : null);
      if (shiftStart && shiftEnd) {
        const txTime = parseDateString(t.createdAt || t.date);
        if (txTime && txTime >= shiftStart - 60000 && txTime <= shiftEnd + 60000) {
          return true;
        }
      }
      return false;
    });

    // Filter cash flow records: HANYA hari ini untuk shift aktif
    const shiftCashFlows = cashFlowRecords.filter((c) => {
      const cDate = c.date || (c.createdAt ? c.createdAt.slice(0, 10) : '');
      if (shift.isOpen) {
        if (!cDate.startsWith(todayIso)) {
          return false;
        }
        if (c.shiftId) {
          return c.shiftId === shift.id || c.shiftId.includes(todayIso);
        }
        return true;
      }
      if (c.shiftId && c.shiftId === shift.id) return true;
      return false;
    });

    const cashTx = shiftTransactions.filter((t) => t.paymentMethod === 'Tunai' && t.status !== 'BATAL');
    const nonCashTx = shiftTransactions.filter((t) => t.paymentMethod !== 'Tunai' && t.status !== 'BATAL');
    const qrisTx = shiftTransactions.filter((t) => t.paymentMethod === 'QRIS' && t.status !== 'BATAL');
    const transferTx = shiftTransactions.filter(
      (t) => (t.paymentMethod === 'Transfer Bank' || t.paymentMethod === 'Kartu Debit' || t.paymentMethod === 'Kartu Kredit') && t.status !== 'BATAL'
    );

    const calcCashSales = cashTx.reduce((sum, t) => sum + (t.amountPaid || t.total), 0);
    const calcNonCashSales = nonCashTx.reduce((sum, t) => sum + (t.amountPaid || t.total), 0);
    const totalOmzet = calcCashSales + calcNonCashSales;

    const totalDiscount = shiftTransactions.reduce((sum, t) => sum + (t.discount || 0), 0);
    const completedCount = shiftTransactions.filter((t) => t.status === 'SELESAI').length;

    // Unpaid transactions (Dalam Proses / Pending) in this shift
    const unpaidOrders = shiftTransactions.filter(
      (t) => t.status === 'DALAM_PROSES' || t.status === 'PENDING'
    );
    const unpaidCount = unpaidOrders.length;
    const unpaidAmount = unpaidOrders.reduce((sum, t) => sum + (t.remainingAmount || 0), 0);

    // Cash flow additions (other income & operational expense) in this shift
    const cashIncome = shiftCashFlows
      .filter((c) => c.type === 'INCOME')
      .reduce((sum, c) => sum + c.amount, 0);
    const cashExpense = shiftCashFlows
      .filter((c) => c.type === 'EXPENSE')
      .reduce((sum, c) => sum + c.amount, 0);

    // System theoretical cash in drawer for this shift:
    // Modal Awal + Penjualan Tunai Aktual + Kas Masuk Aktual - Pengeluaran Kas Aktual
    const systemCash = shift.startingCash + calcCashSales + cashIncome - cashExpense;

    return {
      cashSales: calcCashSales,
      nonCashSales: calcNonCashSales,
      totalOmzet,
      totalDiscount,
      completedCount,
      unpaidCount,
      unpaidAmount,
      qrisSales: qrisTx.reduce((sum, t) => sum + (t.amountPaid || t.total), 0),
      transferSales: transferTx.reduce((sum, t) => sum + (t.amountPaid || t.total), 0),
      cashIncome,
      cashExpense,
      systemCash,
      shiftTransactionsCount: shiftTransactions.length
    };
  }, [transactions, cashFlowRecords, shift]);

  // Calculate physical cash from denominations
  const denominationTotal = useMemo(() => {
    return (
      denominations.k100 * 100000 +
      denominations.k50 * 50000 +
      denominations.k20 * 20000 +
      denominations.k10 * 10000 +
      denominations.k5 * 5000 +
      denominations.k2 * 2000 +
      denominations.k1 * 1000 +
      denominations.coins
    );
  }, [denominations]);

  // Actual physical cash: either from denomination count or direct input
  const physicalCashTotal = inputMode === 'denominations' ? denominationTotal : directCashInput;

  // Real-time difference (Fisik - Sistem)
  const cashDifference = physicalCashTotal - shiftStats.systemCash;

  if (!isOpen) return null;

  // Handler: Update denomination count
  const handleDenominationChange = (field: keyof CashDenomination, value: number) => {
    setDenominations((prev) => ({
      ...prev,
      [field]: Math.max(0, value || 0)
    }));
  };

  // Handler: Copy system cash to physical for fast match
  const handleMatchWithSystem = () => {
    setDirectCashInput(shiftStats.systemCash);
    setInputMode('direct');
  };

  // Handler: Reset denominations
  const handleResetDenominations = () => {
    setDenominations({
      k100: 0,
      k50: 0,
      k20: 0,
      k10: 0,
      k5: 0,
      k2: 0,
      k1: 0,
      coins: 0
    });
    setDirectCashInput(0);
  };

  // Handler: Confirm Close Shift with Physical Cash Check
  const handleConfirmCloseShift = () => {
    setValidationError('');

    // Validation: Kasir must enter physical cash
    if (physicalCashTotal <= 0 && shiftStats.systemCash > 0) {
      if (!confirm('Uang fisik terdeteksi Rp 0. Apakah Anda yakin tidak ada uang fisik sama sekali di laci?')) {
        return;
      }
    }

    // Validation: If there is difference, note is mandatory
    if (cashDifference !== 0 && !notesInput.trim()) {
      setValidationError('Terdapat selisih kas fisik dan sistem. Kasir WAJIB menuliskan catatan/keterangan alasan selisih kas.');
      return;
    }

    const now = new Date();
    const fullEndDateTime = formatShortDateTime(now);

    const shiftNumber = (shift.shiftNumber || (shiftHistory.length > 0 ? shiftHistory.length + 1 : 2));

    const closedShiftData: CashierShift = {
      ...shift,
      isOpen: false,
      shiftNumber,
      outletName: shift.outletName || 'athree studio jayapura',
      endTime: fullEndDateTime,
      endTimestamp: now.getTime(),
      actualCash: physicalCashTotal,
      difference: cashDifference,
      expectedCash: shiftStats.systemCash,
      cashSales: shiftStats.cashSales,
      nonCashSales: shiftStats.nonCashSales,
      totalSales: shiftStats.totalOmzet,
      totalDiscount: shiftStats.totalDiscount,
      totalTransactions: shiftStats.completedCount,
      unpaidCount: shiftStats.unpaidCount,
      unpaidAmount: shiftStats.unpaidAmount,
      notes: notesInput || (cashDifference === 0 ? 'Kroscek fisik dan sistem sesuai (balance)' : `Selisih kas ${formatCurrency(cashDifference)}`),
      paymentMethodBreakdown: {
        cash: shiftStats.cashSales,
        transfer: shiftStats.transferSales,
        qris: shiftStats.qrisSales,
        other: Math.max(0, shiftStats.nonCashSales - shiftStats.transferSales - shiftStats.qrisSales)
      },
      cashDenominations: denominations
    };

    // Update current shift
    onUpdateShift(closedShiftData);

    // Save to history
    if (onSaveToHistory) {
      onSaveToHistory(closedShiftData);
    }

    // Immediately show the success summary screen matching image.png!
    setViewMode('closed_summary');
  };

  // Handler: Akhiri Shift & Logout dari sistem (User Request: "menu ini adalah menu akhiri shift, ketika di tekan maka shift berakhir dan system terlogout")
  const handleEndShiftAndLogout = (reconciledData?: Partial<CashierShift>) => {
    const now = new Date();
    const fullEndDateTime = formatShortDateTime(now);
    const shiftNumber = shift.shiftNumber || (shiftHistory.length > 0 ? shiftHistory.length + 1 : 2);

    const physicalCash = reconciledData?.actualCash !== undefined ? reconciledData.actualCash : (physicalCashTotal || shiftStats.systemCash);
    const diff = physicalCash - shiftStats.systemCash;

    const closedShiftData: CashierShift = {
      ...shift,
      isOpen: false,
      shiftNumber,
      outletName: shift.outletName || 'Default Outlet',
      endTime: fullEndDateTime,
      endTimestamp: now.getTime(),
      actualCash: physicalCash,
      difference: diff,
      expectedCash: shiftStats.systemCash,
      cashSales: shiftStats.cashSales,
      nonCashSales: shiftStats.nonCashSales,
      totalSales: shiftStats.totalOmzet,
      totalDiscount: shiftStats.totalDiscount,
      totalTransactions: shiftStats.completedCount,
      unpaidCount: shiftStats.unpaidCount,
      unpaidAmount: shiftStats.unpaidAmount,
      notes: notesInput || (diff === 0 ? 'Shift berakhir & balance 100%' : `Shift diakhiri selisih kas ${formatCurrency(diff)}`),
      paymentMethodBreakdown: {
        cash: shiftStats.cashSales,
        transfer: shiftStats.transferSales,
        qris: shiftStats.qrisSales,
        other: Math.max(0, shiftStats.nonCashSales - shiftStats.transferSales - shiftStats.qrisSales)
      },
      cashDenominations: denominations,
      ...reconciledData
    };

    // Update current shift state
    onUpdateShift(closedShiftData);

    // Save to history
    if (onSaveToHistory) {
      onSaveToHistory(closedShiftData);
    }

    // Close modal & trigger system logout
    onClose();
    if (onLogout) {
      onLogout();
    }
  };

  // Handler: Open new shift
  const handleOpenNewShift = () => {
    const now = new Date();
    const fullStartDateTime = formatShortDateTime(now);

    const newShiftNumber = (shiftHistory.length || 0) + 1;
    const assignedCashierName =
      currentUser?.role === 'admin' && customCashierName.trim()
        ? customCashierName.trim()
        : activeCashierName;

    const newShift: CashierShift = {
      id: `shift-${Date.now()}`,
      shiftNumber: newShiftNumber,
      outletName: 'athree studio jayapura',
      cashierName: assignedCashierName,
      startTime: fullStartDateTime,
      startTimestamp: now.getTime(),
      startingCash: startingCashInput,
      cashSales: 0,
      nonCashSales: 0,
      totalSales: 0,
      totalDiscount: 0,
      totalTransactions: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      expectedCash: startingCashInput,
      actualCash: undefined,
      difference: undefined,
      isOpen: true,
      notes: notesInput || 'Shift baru dibuka'
    };

    onUpdateShift(newShift);
    setViewMode('overview');
  };

  // Handler: Print shift closure receipt / report
  const handlePrintShiftReport = (targetShift: CashierShift) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup diblokir browser. Harap izinkan popup untuk mencetak laporan shift.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan Tutup Shift #${targetShift.shiftNumber || 2} - ${targetShift.cashierName}</title>
          <style>
            body { font-family: monospace, Courier, sans-serif; font-size: 12px; padding: 20px; line-height: 1.4; color: #111; max-width: 320px; margin: 0 auto; }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #444; margin: 8px 0; }
            .flex { display: flex; justify-content: space-between; }
            .header-title { font-size: 15px; font-weight: bold; text-transform: uppercase; }
            .badge { padding: 2px 6px; border: 1px solid #111; border-radius: 4px; font-size: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">ATHREE STUDIO JAYAPURA</div>
            <div>Pusat Kaos, Sablon & Stiker</div>
            <div>Jl. Percetakan Negara, Jayapura</div>
            <div class="divider"></div>
            <div class="bold">LAPORAN TUTUP SHIFT #${targetShift.shiftNumber || 2}</div>
            <div>${targetShift.endTime || new Date().toLocaleString('id-ID')}</div>
          </div>

          <div class="divider"></div>
          <div class="flex"><span>Kasir:</span><span class="bold">${targetShift.cashierName}</span></div>
          <div class="flex"><span>Outlet:</span><span>${targetShift.outletName || 'Default Outlet'}</span></div>
          <div class="flex"><span>Waktu Buka:</span><span>${targetShift.startTime}</span></div>
          <div class="flex"><span>Waktu Tutup:</span><span>${targetShift.endTime || '-'}</span></div>

          <div class="divider"></div>
          <div class="bold">RINGKASAN PENJUALAN</div>
          <div class="flex"><span>Total Omzet:</span><span class="bold">${formatCurrency(targetShift.totalSales)}</span></div>
          <div class="flex"><span>Total Diskon:</span><span>${formatCurrency(targetShift.totalDiscount || 0)}</span></div>
          <div class="flex"><span>Transaksi Selesai:</span><span>${targetShift.totalTransactions || 0}</span></div>
          <div class="flex"><span>Belum Terbayar:</span><span>${targetShift.unpaidCount || 0} (${formatCurrency(targetShift.unpaidAmount || 0)})</span></div>

          <div class="divider"></div>
          <div class="bold">METODE PEMBAYARAN</div>
          <div class="flex"><span>Tunai (Cash):</span><span>${formatCurrency(targetShift.cashSales)}</span></div>
          <div class="flex"><span>Non-Tunai:</span><span>${formatCurrency(targetShift.nonCashSales)}</span></div>
          <div class="flex"><span> - QRIS:</span><span>${formatCurrency(targetShift.paymentMethodBreakdown?.qris || 0)}</span></div>
          <div class="flex"><span> - Transfer Bank:</span><span>${formatCurrency(targetShift.paymentMethodBreakdown?.transfer || 0)}</span></div>

          <div class="divider"></div>
          <div class="bold">KROSCEK KAS LACI (REKONSILIASI)</div>
          <div class="flex"><span>Saldo Awal:</span><span>${formatCurrency(targetShift.startingCash)}</span></div>
          <div class="flex"><span>Kas di Sistem:</span><span class="bold">${formatCurrency(targetShift.expectedCash)}</span></div>
          <div class="flex"><span>Uang Fisik Aktual:</span><span class="bold">${formatCurrency(targetShift.actualCash || targetShift.expectedCash)}</span></div>
          <div class="divider"></div>
          <div class="flex bold">
            <span>Selisih:</span>
            <span>${(targetShift.difference || 0) === 0 ? 'SESUAI (Rp 0)' : formatCurrency(targetShift.difference || 0)}</span>
          </div>

          ${targetShift.notes ? `<div style="margin-top: 6px; font-style: italic;">Catatan: ${targetShift.notes}</div>` : ''}

          <div class="divider"></div>
          <div style="margin-top: 20px; display: flex; justify-content: space-between; text-align: center;">
            <div>Kasir Yang Bertugas,<br/><br/><br/>( ${targetShift.cashierName} )</div>
            <div>Supervisor / Owner,<br/><br/><br/>( .................... )</div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  // Determine active display data for closed summary
  const summaryShift = selectedHistoryShift || shift;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-100 my-auto text-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* ======================================================== */}
        {/* VIEW 1: TUTUP SHIFT BERHASIL (EXACT MATCH WITH IMAGE.PNG) */}
        {/* ======================================================== */}
        {viewMode === 'closed_summary' && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Top Bar Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-base font-bold text-slate-800">
                {selectedHistoryShift ? 'Detil Histori Tutup Shift' : 'Tutup Shift Berhasil'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1">
              {/* Profile Card with cyan circle, outlet name, timestamp, and shift number */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Cyan / Teal circle avatar */}
                  <div className="w-12 h-12 rounded-full bg-[#d7f4f2] text-[#008f88] flex items-center justify-center shrink-0">
                    <UserIcon className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">
                      {summaryShift.outletName === 'Default Outlet' ? 'athree studio jayapura' : (summaryShift.outletName || 'athree studio jayapura')}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{summaryShift.startTime || '17 Sep 2026, 12:10'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-medium text-slate-600 block">Detil Shift</span>
                  <span className="text-xl font-bold text-slate-700">#{summaryShift.shiftNumber || 2}</span>
                </div>
              </div>

              {/* Light Gray 3-column banner: NAMA OUTLET, WAKTU BUKA, WAKTU TUTUP */}
              <div className="bg-[#f8fafc] border border-slate-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block">
                    NAMA OUTLET
                  </span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">
                    {summaryShift.outletName || 'Default Outlet'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block">
                    WAKTU BUKA
                  </span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">
                    {summaryShift.startTime || '17 Sep 2026, 12:10'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block">
                    WAKTU TUTUP
                  </span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">
                    {summaryShift.endTime || '18 Sep 2026, 07:48'}
                  </span>
                </div>
              </div>

              {/* Card 1: Ringkasan Penjualan (Exact layout from image.png) */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 stroke-[2]" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Ringkasan Penjualan</h4>
                </div>

                <div className="space-y-2.5 pt-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Total Omzet</span>
                    <span className="font-bold text-slate-900">
                      {summaryShift.totalSales ? formatCurrency(summaryShift.totalSales) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Total Diskon</span>
                    <span className="font-semibold text-slate-800">
                      {summaryShift.totalDiscount ? formatCurrency(summaryShift.totalDiscount) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Transaksi Selesai</span>
                    <span className="font-semibold text-slate-800">
                      {summaryShift.totalTransactions !== undefined ? summaryShift.totalTransactions : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600 font-medium">
                    <span>Belum Terbayar</span>
                    <span className="font-bold">
                      {summaryShift.unpaidCount !== undefined ? summaryShift.unpaidCount : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600 font-medium">
                    <span>Belum Terbayar (Rp.)</span>
                    <span className="font-bold">
                      {summaryShift.unpaidAmount ? formatCurrency(summaryShift.unpaidAmount) : '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: KROSCEK KAS FISIK VS SISTEM (Rekonsiliasi Laci) */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#00871f] flex items-center justify-center">
                      <DollarSign className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Kroscek Kas Fisik & Sistem</h4>
                      <p className="text-[11px] text-slate-500">Hasil rekonsiliasi laci kasir oleh {summaryShift.cashierName}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                      (summaryShift.difference || 0) === 0
                        ? 'bg-emerald-100 text-[#00871f]'
                        : (summaryShift.difference || 0) < 0
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {(summaryShift.difference || 0) === 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sesuai (Balance)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Selisih {formatCurrency(summaryShift.difference || 0)}</span>
                      </>
                    )}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Modal Kas Awal:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{formatCurrency(summaryShift.startingCash)}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Kas di Sistem:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{formatCurrency(summaryShift.expectedCash)}</span>
                  </div>
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <span className="text-emerald-700 block text-[10px] font-medium">Uang Fisik Kasir:</span>
                    <span className="font-bold text-[#00871f] mt-0.5 block">
                      {formatCurrency(summaryShift.actualCash || summaryShift.expectedCash)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-400 block text-[10px]">Penjualan Tunai:</span>
                    <span className="font-bold text-slate-800 mt-0.5 block">{formatCurrency(summaryShift.cashSales)}</span>
                  </div>
                </div>

                {summaryShift.notes && (
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-900 mt-2">
                    <span className="font-bold block text-[11px] mb-0.5">Catatan Kasir:</span>
                    <p className="italic">{summaryShift.notes}</p>
                  </div>
                )}
              </div>

              {/* Card 3: Metode Pembayaran (Exact layout from image.png) */}
              <div className="border border-slate-200/80 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 stroke-[2]" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">Metode Pembayaran</h4>
                </div>

                <div className="space-y-2 pt-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Tunai (Cash)</span>
                    <span className="font-semibold text-slate-900">
                      {summaryShift.cashSales ? formatCurrency(summaryShift.cashSales) : '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">QRIS</span>
                    <span className="font-semibold text-slate-900">
                      {summaryShift.paymentMethodBreakdown?.qris
                        ? formatCurrency(summaryShift.paymentMethodBreakdown.qris)
                        : formatCurrency(shiftStats.qrisSales)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Transfer Bank & Debit</span>
                    <span className="font-semibold text-slate-900">
                      {summaryShift.paymentMethodBreakdown?.transfer
                        ? formatCurrency(summaryShift.paymentMethodBreakdown.transfer)
                        : formatCurrency(shiftStats.transferSales)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Cetak, Buka Shift Baru, and the [ X Tutup ] button matching image.png */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintShiftReport(summaryShift)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Cetak Laporan Tutup Shift</span>
                </button>

                {shiftHistory.length > 0 && !selectedHistoryShift && (
                  <button
                    type="button"
                    onClick={() => setViewMode('history')}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Shift</span>
                  </button>
                )}

                {selectedHistoryShift && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHistoryShift(null);
                      setViewMode('history');
                    }}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
                  >
                    Kembali ke Riwayat
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Menu Akhiri Shift & Logout: Ketika ditekan maka shift berakhir dan system terlogout */}
                <button
                  type="button"
                  onClick={() => {
                    if (shift.isOpen) {
                      handleEndShiftAndLogout();
                    } else {
                      onClose();
                      if (onLogout) {
                        onLogout();
                      }
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Menu Akhiri Shift Kasir & Logout Sistem"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Akhiri Shift &amp; Logout</span>
                </button>

                {!shift.isOpen && !selectedHistoryShift && (
                  <button
                    type="button"
                    onClick={() => setViewMode('open_shift')}
                    className="px-4 py-2 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Buka Shift Baru</span>
                  </button>
                )}

                {/* The clean [ X Tutup ] button as seen in bottom right of image.png */}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: KROSCEK UANG FISIK VS SISTEM (WAJIB TUTUP SHIFT) */}
        {/* ======================================================== */}
        {viewMode === 'reconcile' && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Kroscek Uang Fisik vs Sistem (Tutup Shift)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Kasir: <strong className="text-slate-700">{activeCashierName}</strong> &bull; Waktu Buka: {shift.startTime}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                title="Batal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Tanggal dan Jam Otomatis Buka & Tutup Shift */}
              <div className="bg-gradient-to-r from-emerald-50 via-slate-50 to-rose-50 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center shrink-0">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                      Waktu Buka Shift
                    </span>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">
                      {shift.startTime || 'Otomatis'}
                    </span>
                  </div>
                </div>

                <div className="hidden sm:flex items-center text-slate-400">
                  <ArrowRight className="w-4 h-4" />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">
                        Waktu Tutup Shift (Otomatis)
                      </span>
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    </div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm font-mono">
                      {formatIndonesianFull(currentDateTime)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SOP Instruction Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5">SOP Kasir: Kroscek Fisik Uang Laci</p>
                  <p className="text-amber-800 leading-relaxed">
                    Kasir wajib menghitung uang fisik yang ada di laci kasir dan membandingkannya dengan pencatatan di sistem. Jika terdapat selisih, kasir wajib memberikan keterangan pada kolom catatan.
                  </p>
                </div>
              </div>

              {/* Side-by-Side Comparison: Kas Sistem vs Uang Fisik Kasir */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Kas di Sistem */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-[#00871f]" />
                      1. Kas di Sistem (Otomatis)
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-mono px-1.5 py-0.5 rounded">
                      Teoritis
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Modal Kas Awal Laci:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(shift.startingCash)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Penjualan Tunai:</span>
                    <span className="font-bold text-[#00871f]">{formatCurrency(shiftStats.cashSales)}</span>
                  </div>
                  {shiftStats.cashIncome > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>(+) Kas Masuk Lain:</span>
                      <span className="font-bold">+{formatCurrency(shiftStats.cashIncome)}</span>
                    </div>
                  )}
                  {shiftStats.cashExpense > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>(-) Pengeluaran Kas Laci:</span>
                      <span className="font-bold">-{formatCurrency(shiftStats.cashExpense)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500 text-[11px] pt-1 border-t border-dashed border-slate-200">
                    <span>Penjualan Non-Tunai:</span>
                    <span>{formatCurrency(shiftStats.nonCashSales)}</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 mt-2">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                      TOTAL KAS SEHARUSNYA DI LACI:
                    </span>
                    <span className="text-lg font-extrabold text-slate-900 block mt-0.5">
                      {formatCurrency(shiftStats.systemCash)}
                    </span>
                  </div>
                </div>

                {/* 2. Uang Fisik Kasir (Dihitung Kasir) */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-2.5 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-[#00871f]" />
                        2. Uang Fisik di Laci (Kasir)
                      </span>
                      {/* Input Mode Selector */}
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-emerald-200">
                        <button
                          type="button"
                          onClick={() => setInputMode('denominations')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            inputMode === 'denominations'
                              ? 'bg-[#00871f] text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Pecahan
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode('direct')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                            inputMode === 'direct'
                              ? 'bg-[#00871f] text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Nominal
                        </button>
                      </div>
                    </div>

                    {/* Denomination Counter Mode */}
                    {inputMode === 'denominations' ? (
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 100.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k100 || ''}
                              onChange={(e) => handleDenominationChange('k100', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 50.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k50 || ''}
                              onChange={(e) => handleDenominationChange('k50', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 20.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k20 || ''}
                              onChange={(e) => handleDenominationChange('k20', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 10.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k10 || ''}
                              onChange={(e) => handleDenominationChange('k10', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 5.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k5 || ''}
                              onChange={(e) => handleDenominationChange('k5', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 2.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k2 || ''}
                              onChange={(e) => handleDenominationChange('k2', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Rp 1.000:</span>
                            <input
                              type="number"
                              min="0"
                              value={denominations.k1 || ''}
                              onChange={(e) => handleDenominationChange('k1', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                          <div className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-emerald-100">
                            <span className="font-medium text-slate-700">Koin/Receh (Rp):</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              value={denominations.coins || ''}
                              onChange={(e) => handleDenominationChange('coins', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 text-right font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <button
                            type="button"
                            onClick={handleResetDenominations}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleMatchWithSystem}
                            className="text-[#00871f] hover:underline font-medium cursor-pointer"
                          >
                            Cocokkan dengan Sistem
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Direct Input Mode */
                      <div className="mt-3 space-y-2">
                        <label className="text-[11px] font-semibold text-slate-700 block">
                          Total Uang Kas Fisik di Laci (Rp):
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={directCashInput}
                          onChange={(e) => setDirectCashInput(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full text-base font-bold text-slate-900 px-3 py-2 border border-emerald-300 rounded-xl bg-white focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                          placeholder="Masukkan total uang fisik"
                        />
                        <button
                          type="button"
                          onClick={handleMatchWithSystem}
                          className="text-[11px] text-[#00871f] hover:underline font-medium cursor-pointer block"
                        >
                          Salin Nilai dari Sistem ({formatCurrency(shiftStats.systemCash)})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Physical Cash Total Display */}
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 mt-2">
                    <span className="text-[10px] text-emerald-800 block uppercase font-bold tracking-wider">
                      TOTAL UANG FISIK AKTUAL:
                    </span>
                    <span className="text-lg font-extrabold text-[#00871f] block mt-0.5">
                      {formatCurrency(physicalCashTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-Time Reconciliation Result (Status Banner) */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  cashDifference === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : cashDifference < 0
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : 'bg-blue-50 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      cashDifference === 0
                        ? 'bg-emerald-200 text-[#00871f]'
                        : cashDifference < 0
                        ? 'bg-rose-200 text-rose-700'
                        : 'bg-blue-200 text-blue-700'
                    }`}
                  >
                    {cashDifference === 0 ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold block uppercase tracking-wider">
                      {cashDifference === 0
                        ? 'Status Kroscek: Sesuai (Balance 100%)'
                        : cashDifference < 0
                        ? 'Status Kroscek: Selisih Kurang (Defisit)'
                        : 'Status Kroscek: Selisih Lebih (Surplus)'}
                    </span>
                    <p className="text-xs opacity-90">
                      {cashDifference === 0
                        ? 'Uang kas fisik di laci cocok sempurna dengan perhitungan sistem.'
                        : cashDifference < 0
                        ? `Uang fisik kasir KURANG ${formatCurrency(Math.abs(cashDifference))} dari sistem.`
                        : `Uang fisik kasir LEBIH ${formatCurrency(cashDifference)} dari sistem.`}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold opacity-75 block">Nominal Selisih:</span>
                  <span
                    className={`text-base font-extrabold font-mono block ${
                      cashDifference === 0
                        ? 'text-[#00871f]'
                        : cashDifference < 0
                        ? 'text-rose-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {cashDifference > 0 ? `+${formatCurrency(cashDifference)}` : formatCurrency(cashDifference)}
                  </span>
                </div>
              </div>

              {/* Notes & Explanation (Mandatory if Difference != 0) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Catatan Kroscek Kasir:
                  </label>
                  {cashDifference !== 0 && (
                    <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      * Wajib diisi karena ada selisih kas
                    </span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder={
                    cashDifference !== 0
                      ? 'Wajib jelaskan penyebab selisih kas (Contoh: Ada kembalian 2.000 belum diambil pelanggan / uang receh belum ditukar)'
                      : 'Catatan opsional rekonsiliasi kas...'
                  }
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none text-slate-800"
                />
              </div>

              {/* Validation error notice */}
              {validationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Kasir Verification Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={isVerifiedCheck}
                  onChange={(e) => setIsVerifiedCheck(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#00871f] focus:ring-[#00871f] w-4 h-4"
                />
                <span className="text-xs text-slate-700 leading-relaxed select-none">
                  Saya (<strong>{activeCashierName}</strong>) menyatakan telah menghitung uang fisik di laci dan memvalidasi keakuratan data kas &amp; transaksi pada shift ini.
                </span>
              </label>
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
              >
                Kembali
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConfirmCloseShift}
                  disabled={!isVerifiedCheck}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    isVerifiedCheck
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Simpan kroscek dan lihat ringkasan laporan shift"
                >
                  Lihat Ringkasan Shift
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleEndShiftAndLogout({
                      actualCash: physicalCashTotal,
                      difference: cashDifference,
                      notes: notesInput || (cashDifference === 0 ? 'Kroscek fisik dan sistem balance 100%' : `Selisih kas ${formatCurrency(cashDifference)}`),
                      cashDenominations: denominations
                    });
                  }}
                  disabled={!isVerifiedCheck}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer ${
                    isVerifiedCheck
                      ? 'bg-rose-600 hover:bg-rose-700 text-white active:scale-95'
                      : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  }`}
                  title="Menu Akhiri Shift: Shift berakhir dan sistem langsung otomatis logout"
                >
                  <Lock className="w-4 h-4" />
                  <span>Akhiri Shift &amp; Logout Sistem</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: ACTIVE SHIFT OVERVIEW                            */}
        {/* ======================================================== */}
        {viewMode === 'overview' && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Manajemen Shift Kasir</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">
                      Kasir Aktif: <strong className="text-slate-700">{shift.cashierName}</strong> &bull; Outlet: {shift.outletName || 'Default Outlet'}
                    </p>
                    {currentUser?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActiveShiftCashier(!editingActiveShiftCashier);
                          setEditingActiveShiftCashierName(shift.cashierName);
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Admin: Ubah Nama Kasir pada Shift Ini"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ubah Nama Kasir</span>
                      </button>
                    )}
                  </div>
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

            {/* Admin inline cashier rename box */}
            {editingActiveShiftCashier && currentUser?.role === 'admin' && (
              <div className="mx-6 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                  <span>Admin: Ubah Nama Kasir Bertugas pada Shift</span>
                  <button
                    type="button"
                    onClick={() => setEditingActiveShiftCashier(false)}
                    className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editingActiveShiftCashierName}
                    onChange={(e) => setEditingActiveShiftCashierName(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-1.5 border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Masukkan nama kasir baru..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newName = editingActiveShiftCashierName.trim();
                      if (newName) {
                        onUpdateShift({
                          ...shift,
                          cashierName: newName
                        });
                        const matchingUser = users?.find(
                          (u) => u.name.toLowerCase() === shift.cashierName.toLowerCase()
                        );
                        if (matchingUser && onUpdateUser) {
                          onUpdateUser({
                            ...matchingUser,
                            name: newName
                          });
                        }
                        setEditingActiveShiftCashier(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer shrink-0"
                  >
                    Simpan
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Active Shift Indicator */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Shift Harian Aktif (Hari Ini)</span>
                    <span className="text-[11px] text-emerald-700">Buka: {shift.startTime} &bull; Khusus Transaksi Hari Ini</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-emerald-100 text-[#00871f] px-2.5 py-1 rounded-lg">
                  Harian
                </span>
              </div>

              {/* Financial Breakdown Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs">
                {/* Modal Kas Awal with Admin Edit */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">Modal Kas Awal Laci:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{formatCurrency(shift.startingCash)}</span>
                    {currentUser?.role === 'admin' && !isEditingStartingCash && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevisedStartingCash(shift.startingCash);
                          setIsEditingStartingCash(true);
                        }}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#00871f] hover:bg-emerald-200 cursor-pointer flex items-center gap-1"
                        title="Admin: Revisi Saldo Awal"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Revisi</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin starting cash edit box */}
                {isEditingStartingCash && currentUser?.role === 'admin' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                      <span>Revisi Modal Awal (Admin):</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingStartingCash(false)}
                        className="text-slate-400 hover:text-slate-600 text-[11px]"
                      >
                        Batal
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={revisedStartingCash}
                        onChange={(e) => setRevisedStartingCash(Number(e.target.value))}
                        className="w-full text-xs font-bold px-2 py-1.5 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newAmount = Number(revisedStartingCash);
                          if (newAmount >= 0) {
                            const diff = newAmount - shift.startingCash;
                            onUpdateShift({
                              ...shift,
                              startingCash: newAmount,
                              expectedCash: shift.expectedCash + diff,
                              notes: `${shift.notes ? shift.notes + ' | ' : ''}Saldo awal direvisi Admin (${currentUser?.name}) menjadi ${formatCurrency(newAmount)}`
                            });
                            setIsEditingStartingCash(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg cursor-pointer shrink-0"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-slate-600">
                  <span>Penjualan Tunai Shift Ini:</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(shiftStats.cashSales)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Penjualan Non-Tunai (QRIS &amp; Transfer):</span>
                  <span className="font-semibold text-[#00871f]">{formatCurrency(shiftStats.nonCashSales)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Total Omzet Penjualan:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(shiftStats.totalOmzet)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-800">Ekspektasi Kas di Laci Saat Ini:</span>
                  <span className="text-emerald-700 text-base">{formatCurrency(shiftStats.systemCash)}</span>
                </div>
              </div>

              {/* Requirement Alert: Kroscek is Mandatory before close */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Untuk menutup shift, kasir akan diarahkan ke tahap <strong>Kroscek Uang Fisik vs Sistem</strong> guna mencocokkan fisik uang laci dengan pencatatan sistem.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
                >
                  Tutup Jendela
                </button>
                {shiftHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewMode('history')}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Shift</span>
                  </button>
                )}
              </div>

              {/* Primary Actions: Akhiri Shift Langsung & Logout ATAU Kroscek Dulu */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEndShiftAndLogout()}
                  className="px-4 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                  title="Menu Akhiri Shift Kasir & Logout Sistem"
                >
                  <Lock className="w-4 h-4" />
                  <span>Akhiri Shift &amp; Logout</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('reconcile')}
                  className="px-4 py-2.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                  title="Kroscek uang fisik laci sebelum mengakhiri shift"
                >
                  <Calculator className="w-4 h-4" />
                  <span>Kroscek &amp; Akhiri Shift</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: OPEN NEW SHIFT FORM                              */}
        {/* ======================================================== */}
        {viewMode === 'open_shift' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center shrink-0">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Buka Shift Kasir Baru</h3>
                  <p className="text-xs text-slate-500">Pencatatan transaksi kasir harian (khusus transaksi hari ini)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('closed_summary')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Tanggal & Jam Buka Shift Otomatis */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#00871f] shrink-0 animate-pulse" />
                    Tanggal &amp; Jam Buka Shift (Otomatis):
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00871f] text-white">
                    Real-Time Sistem
                  </span>
                </div>
                <div className="bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200/80 flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold font-mono tracking-tight text-slate-800">
                    {formatIndonesianFull(currentDateTime)}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold hidden sm:inline">
                    Pencatatan Otomatis
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800/80 mt-1.5 leading-relaxed">
                  Tanggal dan jam saat shift dibuka akan otomatis direkam secara presisi saat Anda menekan tombol <strong>"Buka Shift Sekarang"</strong>.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    Nama Kasir yang Bertugas:
                  </label>
                  {currentUser?.role === 'admin' && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                      Hak Akses Admin: Bisa Pilih &amp; Ubah Nama User
                    </span>
                  )}
                </div>

                {currentUser?.role === 'admin' && users && users.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedCashierUserId}
                        onChange={(e) => {
                          const uid = e.target.value;
                          setSelectedCashierUserId(uid);
                          const found = users.find((u) => u.id === uid);
                          if (found) {
                            setCustomCashierName(found.name);
                          }
                        }}
                        className="flex-1 text-xs font-bold px-3 py-2 bg-white border border-blue-300 rounded-xl text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.roleLabel || (u.role === 'admin' ? 'Administrator' : 'Kasir')})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const found = users.find((u) => u.id === selectedCashierUserId);
                          if (found) {
                            setEditingUserId(found.id);
                            setEditingUserNameVal(found.name);
                          }
                        }}
                        className="px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Admin: Ubah Nama User Ini"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Ubah Nama</span>
                      </button>
                    </div>

                    {editingUserId && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-900">Edit Nama Pengguna (Admin):</span>
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingUserNameVal}
                            onChange={(e) => setEditingUserNameVal(e.target.value)}
                            className="w-full text-xs font-bold px-3 py-1.5 border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Masukkan nama baru..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (editingUserNameVal.trim() && onUpdateUser) {
                                const found = users.find((u) => u.id === editingUserId);
                                if (found) {
                                  const updated = { ...found, name: editingUserNameVal.trim() };
                                  onUpdateUser(updated);
                                  setCustomCashierName(editingUserNameVal.trim());
                                  setEditingUserId(null);
                                }
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer shrink-0"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={activeCashierName}
                    className="w-full text-xs font-bold px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-700"
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Saldo Awal (Modal Kas Laci) (Rp):
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                    Bisa diinput Kasir &amp; Admin
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={startingCashInput}
                  onChange={(e) => setStartingCashInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full text-sm font-bold text-slate-900 px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  placeholder="Contoh: 500000"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Modal kas awal yang dimasukkan ke laci kasir saat toko mulai beroperasi.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Catatan Pembukaan Shift:
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Misal: Shift Pagi / Siang, uang modal pecahan 50k & 20k"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('closed_summary')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleOpenNewShift}
                className="px-5 py-2.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Buka Shift Sekarang</span>
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 5: SHIFT HISTORY                                    */}
        {/* ======================================================== */}
        {viewMode === 'history' && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Riwayat Tutup Shift Kasir</h3>
                  <p className="text-xs text-slate-500">Daftar shift yang telah ditutup dan rekonsiliasi kas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewMode(shift.isOpen ? 'overview' : 'closed_summary')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              {shiftHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada riwayat shift yang tersimpan.</p>
                </div>
              ) : (
                shiftHistory.map((h, idx) => (
                  <div
                    key={h.id || idx}
                    onClick={() => {
                      setSelectedHistoryShift(h);
                      setViewMode('closed_summary');
                    }}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-[#00871f] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          Shift #{h.shiftNumber || idx + 1} &bull; {h.cashierName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (h.difference || 0) === 0
                              ? 'bg-emerald-100 text-[#00871f]'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {(h.difference || 0) === 0 ? 'Sesuai' : `Selisih ${formatCurrency(h.difference || 0)}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Buka: {h.startTime} &bull; Tutup: {h.endTime || '-'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Total Omzet:</span>
                        <span className="text-xs font-bold text-slate-900">{formatCurrency(h.totalSales)}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewMode(shift.isOpen ? 'overview' : 'closed_summary')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Kembali
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
