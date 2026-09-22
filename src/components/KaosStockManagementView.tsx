import React, { useState, useMemo } from 'react';
import {
  Shirt,
  Search,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Printer,
  History,
  TrendingDown,
  CheckCircle2,
  RefreshCw,
  Edit2,
  PlusCircle,
  Layers,
  LayoutGrid,
  ListFilter,
  ShieldAlert,
  Sparkles,
  Info,
  ChevronRight,
  SlidersHorizontal,
  UploadCloud,
  X
} from 'lucide-react';
import { KaosStockItem, StockMovement, User } from '../types';
import { STANDARD_KAOS_COLORS, STANDARD_KAOS_SIZES, KaosColorOption, generateKaosStockId } from '../data/mockData';
import { exportKaosStockToExcel, exportKaosStockToPDF } from '../utils/exportUtils';
import { ImportKaosStockModal } from './ImportKaosStockModal';

interface KaosStockManagementViewProps {
  kaosStocks: KaosStockItem[];
  stockMovements: StockMovement[];
  currentUser: User;
  onUpdateKaosStocks: (newStocks: KaosStockItem[], movements?: StockMovement[]) => void;
  onOpenRegularStock?: () => void;
}

export const KaosStockManagementView: React.FC<KaosStockManagementViewProps> = ({
  kaosStocks,
  stockMovements,
  currentUser,
  onUpdateKaosStocks,
  onOpenRegularStock
}) => {
  const isAdmin = currentUser.role === 'admin';

  // Navigation Subtabs
  const [subTab, setSubTab] = useState<'matrix' | 'table' | 'history'>('matrix');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('Semua');
  const [selectedSize, setSelectedSize] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'safe' | 'low' | 'out'>('all');

  // Modals
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showAddColorModal, setShowAddColorModal] = useState(false);
  const [showImportKaosModal, setShowImportKaosModal] = useState(false);

  // Selected item for quick action
  const [selectedItem, setSelectedItem] = useState<KaosStockItem | null>(null);

  // Form states for Restock
  const [restockColor, setRestockColor] = useState(STANDARD_KAOS_COLORS[0]?.name || 'Hitam');
  const [restockSize, setRestockSize] = useState('L');
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockNotes, setRestockNotes] = useState('Penerimaan Masuk Konveksi / Supplier');

  // Form states for Opname / Adjust
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Koreksi Stok Fisik (Stok Opname)');

  // Form states for Add New Color
  const [newColorName, setNewColorName] = useState('');
  const [newColorDot, setNewColorDot] = useState('bg-indigo-600 border-indigo-500');
  const [newColorInitialStock, setNewColorInitialStock] = useState<number>(10);
  const [newColorMinStock, setNewColorMinStock] = useState<number>(5);

  // Derive all unique colors from current kaosStocks
  const availableColors = useMemo(() => {
    const set = new Set<string>();
    kaosStocks.forEach((k) => set.add(k.color));
    return Array.from(set);
  }, [kaosStocks]);

  // Total summary metrics
  const totalKaosPcs = useMemo(() => {
    return kaosStocks.reduce((sum, item) => sum + item.stock, 0);
  }, [kaosStocks]);

  const totalVariants = kaosStocks.length;

  const lowStockItems = useMemo(() => {
    return kaosStocks.filter((k) => k.stock > 0 && k.stock <= k.minStock);
  }, [kaosStocks]);

  const outOfStockItems = useMemo(() => {
    return kaosStocks.filter((k) => k.stock <= 0);
  }, [kaosStocks]);

  // Color options helper for badge preview
  const getColorDotClass = (colorName: string): string => {
    const found = STANDARD_KAOS_COLORS.find(
      (c) => c.name.toLowerCase() === colorName.toLowerCase()
    );
    if (found) return found.dotClass;

    const lower = colorName.toLowerCase();
    if (lower.includes('hitam')) return 'bg-slate-900 border-slate-700';
    if (lower.includes('putih')) return 'bg-white border-slate-300';
    if (lower.includes('navy')) return 'bg-blue-900 border-blue-800';
    if (lower.includes('maroon')) return 'bg-rose-950 border-rose-900';
    if (lower.includes('abu')) return 'bg-slate-400 border-slate-300';
    if (lower.includes('hijau')) return 'bg-emerald-900 border-emerald-800';
    if (lower.includes('merah')) return 'bg-red-600 border-red-500';
    if (lower.includes('biru')) return 'bg-blue-600 border-blue-500';
    if (lower.includes('kuning')) return 'bg-amber-500 border-amber-400';
    if (lower.includes('lilac') || lower.includes('ungu')) return 'bg-purple-500 border-purple-400';
    if (lower.includes('sage')) return 'bg-teal-700 border-teal-600';
    return 'bg-slate-600 border-slate-500';
  };

  // Filtered kaos stock list
  const filteredKaos = useMemo(() => {
    return kaosStocks.filter((k) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        k.color.toLowerCase().includes(q) ||
        k.size.toLowerCase().includes(q) ||
        `kaos-${k.color}-${k.size}`.toLowerCase().includes(q);

      // Color filter
      const matchColor =
        selectedColor === 'Semua' || k.color.toLowerCase() === selectedColor.toLowerCase();

      // Size filter
      const matchSize =
        selectedSize === 'Semua' || k.size.toUpperCase() === selectedSize.toUpperCase();

      // Status filter
      let matchStatus = true;
      if (stockStatusFilter === 'safe') {
        matchStatus = k.stock > k.minStock;
      } else if (stockStatusFilter === 'low') {
        matchStatus = k.stock > 0 && k.stock <= k.minStock;
      } else if (stockStatusFilter === 'out') {
        matchStatus = k.stock <= 0;
      }

      return matchSearch && matchColor && matchSize && matchStatus;
    });
  }, [kaosStocks, searchQuery, selectedColor, selectedSize, stockStatusFilter]);

  // Grouped by color for Matrix View
  const groupedByColor = useMemo(() => {
    const groups: Record<string, KaosStockItem[]> = {};

    filteredKaos.forEach((item) => {
      if (!groups[item.color]) {
        groups[item.color] = [];
      }
      groups[item.color].push(item);
    });

    // Sort sizes inside each group standard order: S, M, L, XL, XXL, 3XL
    Object.keys(groups).forEach((col) => {
      groups[col].sort((a, b) => {
        const orderA = STANDARD_KAOS_SIZES.indexOf(a.size);
        const orderB = STANDARD_KAOS_SIZES.indexOf(b.size);
        if (orderA !== -1 && orderB !== -1) return orderA - orderB;
        return a.size.localeCompare(b.size);
      });
    });

    return groups;
  }, [filteredKaos]);

  // Kaos Stock Movements
  const kaosMovements = useMemo(() => {
    return stockMovements.filter((m) => {
      const nameMatch = m.productName?.toLowerCase().includes('kaos');
      const skuMatch = m.sku?.toUpperCase().startsWith('KAOS');
      const reasonMatch = m.reason?.toLowerCase().includes('kaos');
      return nameMatch || skuMatch || reasonMatch;
    });
  }, [stockMovements]);

  // Handler: Quick Restock
  const handleQuickAdd = (item: KaosStockItem, addedQty: number) => {
    if (!isAdmin && currentUser.role === 'kasir') {
      alert('Akses Dibatasi: Akun Kasir hanya dapat melihat stok. Hubungi Admin atau Staf Gudang untuk menambah stok.');
      return;
    }

    const newStock = item.stock + addedQty;
    const movement: StockMovement = {
      id: `sm-kaos-in-${Date.now()}-${item.color}-${item.size}`,
      productId: item.id,
      productName: `Kaos Polos ${item.color} (${item.size})`,
      sku: `KAOS-${item.color.toUpperCase().replace(/\s+/g, '-')}-${item.size.toUpperCase()}`,
      type: 'IN',
      qty: addedQty,
      prevStock: item.stock,
      newStock: newStock,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: `Restock Cepat Kaos Polos (+${addedQty} Pcs)`,
      operatorName: currentUser.name,
      referenceNo: `IN-KAOS-${Date.now().toString().slice(-6)}`
    };

    const updated = kaosStocks.map((k) => (k.id === item.id ? { ...k, stock: newStock } : k));
    onUpdateKaosStocks(updated, [movement]);
  };

  // Handler: Modal Restock Submit
  const handleModalRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (restockQty <= 0) {
      alert('Jumlah restock harus lebih dari 0.');
      return;
    }

    const targetItem = kaosStocks.find(
      (k) =>
        k.color.toLowerCase() === restockColor.toLowerCase() &&
        k.size.toUpperCase() === restockSize.toUpperCase()
    );

    let updatedList: KaosStockItem[] = [];
    const prevStockVal = targetItem ? targetItem.stock : 0;
    const newStockVal = prevStockVal + restockQty;

    if (targetItem) {
      updatedList = kaosStocks.map((k) =>
        k.id === targetItem.id ? { ...k, stock: newStockVal } : k
      );
    } else {
      // Variant didn't exist, create it
      const newItem: KaosStockItem = {
        id: generateKaosStockId(restockColor, restockSize),
        color: restockColor,
        size: restockSize,
        stock: restockQty,
        minStock: 5
      };
      updatedList = [...kaosStocks, newItem];
    }

    const movement: StockMovement = {
      id: `sm-kaos-restock-${Date.now()}`,
      productId: targetItem ? targetItem.id : generateKaosStockId(restockColor, restockSize),
      productName: `Kaos Polos ${restockColor} (${restockSize})`,
      sku: `KAOS-${restockColor.toUpperCase().replace(/\s+/g, '-')}-${restockSize.toUpperCase()}`,
      type: 'IN',
      qty: restockQty,
      prevStock: prevStockVal,
      newStock: newStockVal,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: restockNotes || `Restock Kaos Polos Masuk (+${restockQty} Pcs)`,
      operatorName: currentUser.name,
      referenceNo: `RESTOCK-${Date.now().toString().slice(-6)}`
    };

    onUpdateKaosStocks(updatedList, [movement]);
    setShowRestockModal(false);
    setRestockQty(10);
  };

  // Handler: Modal Adjust / Opname Submit
  const handleModalAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (adjustTargetStock < 0) {
      alert('Jumlah stok fisik tidak boleh negatif.');
      return;
    }

    const diff = adjustTargetStock - selectedItem.stock;
    if (diff === 0) {
      setShowAdjustModal(false);
      return;
    }

    const movement: StockMovement = {
      id: `sm-kaos-adj-${Date.now()}`,
      productId: selectedItem.id,
      productName: `Kaos Polos ${selectedItem.color} (${selectedItem.size})`,
      sku: `KAOS-${selectedItem.color.toUpperCase().replace(/\s+/g, '-')}-${selectedItem.size.toUpperCase()}`,
      type: 'ADJUST',
      qty: Math.abs(diff),
      prevStock: selectedItem.stock,
      newStock: adjustTargetStock,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: `${adjustReason} (${diff > 0 ? '+' : ''}${diff} Pcs)`,
      operatorName: currentUser.name,
      referenceNo: `OPNAME-${Date.now().toString().slice(-6)}`
    };

    const updated = kaosStocks.map((k) =>
      k.id === selectedItem.id ? { ...k, stock: adjustTargetStock } : k
    );

    onUpdateKaosStocks(updated, [movement]);
    setShowAdjustModal(false);
    setSelectedItem(null);
  };

  // Handler: Add New Color Variant
  const handleAddNewColorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newColorName.trim();
    if (!trimmed) {
      alert('Nama warna tidak boleh kosong.');
      return;
    }

    const existing = availableColors.some((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      alert(`Warna "${trimmed}" sudah terdaftar di sistem.`);
      return;
    }

    // Generate standard sizes for this new color
    const newItems: KaosStockItem[] = STANDARD_KAOS_SIZES.map((sz) => ({
      id: generateKaosStockId(trimmed, sz),
      color: trimmed,
      size: sz,
      stock: newColorInitialStock,
      minStock: newColorMinStock
    }));

    const newMovements: StockMovement[] = newItems.map((it) => ({
      id: `sm-newcolor-${Date.now()}-${it.size}`,
      productId: it.id,
      productName: `Kaos Polos ${it.color} (${it.size})`,
      sku: `KAOS-${it.color.toUpperCase().replace(/\s+/g, '-')}-${it.size.toUpperCase()}`,
      type: 'IN',
      qty: it.stock,
      prevStock: 0,
      newStock: it.stock,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: `Penambahan Varian Warna Baru "${trimmed}" (+${it.stock} Pcs/Size)`,
      operatorName: currentUser.name,
      referenceNo: `NEW-COLOR-${Date.now().toString().slice(-6)}`
    }));

    onUpdateKaosStocks([...kaosStocks, ...newItems], newMovements);
    setShowAddColorModal(false);
    setNewColorName('');
    setSelectedColor(trimmed);
  };

  return (
    <div id="kaos-stock-management-view" className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-0 overflow-y-auto">
      {/* 1. Header Banner */}
      <div className="bg-slate-950 border-b border-slate-800 p-4 md:p-6 shrink-0 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <Shirt className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black tracking-tight text-white">
                  Manajemen Stok Khusus Kaos Polos
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 border border-emerald-700/60 text-emerald-400">
                  DEAZBAR Sablon
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">
                Monitoring ketersediaan fisik kaos polos per warna & ukuran, integrasi otomatis pengurangan transaksi kasir, serta mutasi stok.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenRegularStock && (
              <button
                onClick={onOpenRegularStock}
                title="Buka Manajemen Stok Produk Umum"
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-4 h-4 text-slate-400" />
                Stok Barang Umum
              </button>
            )}

            <button
              onClick={() => exportKaosStockToExcel(kaosStocks)}
              title="Unduh file Excel (.xlsx)"
              className="px-3 py-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Ekspor Excel
            </button>

            <button
              onClick={() => exportKaosStockToPDF(kaosStocks)}
              title="Cetak Laporan PDF"
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-400" />
              Laporan PDF
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setShowImportKaosModal(true)}
                  title="Impor Penyesuaian Stok Kaos dari file Excel (.xlsx) atau CSV"
                  className="px-3.5 py-2 rounded-xl bg-blue-950/70 hover:bg-blue-900 text-blue-200 border border-blue-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                  Impor Penyesuaian Stok
                </button>

                <button
                  onClick={() => setShowAddColorModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  Tambah Warna Baru
                </button>

                <button
                  onClick={() => setShowRestockModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#00871f] hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950 text-xs font-bold flex items-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Restock Kaos Masuk
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {/* Total Stock */}
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Fisik Kaos</div>
              <div className="text-2xl font-black text-white mt-0.5">
                {totalKaosPcs.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-400">Pcs</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/40 text-emerald-400 flex items-center justify-center">
              <Shirt className="w-5 h-5" />
            </div>
          </div>

          {/* Total Variants */}
          <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Varian Terdaftar</div>
              <div className="text-2xl font-black text-slate-200 mt-0.5">
                {totalVariants} <span className="text-xs font-normal text-slate-400">Kombinasi</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-950/70 border border-blue-800/40 text-blue-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          {/* Menipis Alert */}
          <button
            onClick={() => setStockStatusFilter(stockStatusFilter === 'low' ? 'all' : 'low')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              stockStatusFilter === 'low'
                ? 'bg-amber-950/80 border-amber-500 shadow-md shadow-amber-950/40'
                : 'bg-slate-900/90 border-slate-800 hover:border-amber-700/60'
            }`}
          >
            <div>
              <div className="text-[11px] text-amber-400 font-medium uppercase tracking-wider flex items-center gap-1">
                Stok Menipis
                {lowStockItems.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
              </div>
              <div className="text-2xl font-black text-amber-300 mt-0.5">
                {lowStockItems.length} <span className="text-xs font-normal text-slate-400">Varian</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/40 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </button>

          {/* Habis Alert */}
          <button
            onClick={() => setStockStatusFilter(stockStatusFilter === 'out' ? 'all' : 'out')}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
              stockStatusFilter === 'out'
                ? 'bg-rose-950/80 border-rose-500 shadow-md shadow-rose-950/40'
                : 'bg-slate-900/90 border-slate-800 hover:border-rose-700/60'
            }`}
          >
            <div>
              <div className="text-[11px] text-rose-400 font-medium uppercase tracking-wider flex items-center gap-1">
                Stok Habis
                {outOfStockItems.length > 0 && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
              </div>
              <div className="text-2xl font-black text-rose-400 mt-0.5">
                {outOfStockItems.length} <span className="text-xs font-normal text-slate-400">Varian</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-950/70 border border-rose-800/40 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. Filter & Subtab Bar */}
      <div className="bg-slate-900 border-b border-slate-800 p-3 md:p-4 sticky top-0 z-10 shadow-sm backdrop-blur-md bg-opacity-95">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Subtab Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
            <button
              onClick={() => setSubTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === 'matrix'
                  ? 'bg-[#00871f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Matriks Warna & Ukuran
            </button>
            <button
              onClick={() => setSubTab('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === 'table'
                  ? 'bg-[#00871f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Tabel Daftar Rinci ({filteredKaos.length})
            </button>
            <button
              onClick={() => setSubTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                subTab === 'history'
                  ? 'bg-[#00871f] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Riwayat Mutasi ({kaosMovements.length})
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari warna / size..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Warna */}
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Semua">Semua Warna ({availableColors.length})</option>
              {availableColors.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            {/* Filter Ukuran */}
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs text-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Semua">Semua Size</option>
              {STANDARD_KAOS_SIZES.map((sz) => (
                <option key={sz} value={sz}>
                  Size {sz}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              <button
                onClick={() => setStockStatusFilter('all')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setStockStatusFilter('safe')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'safe' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Aman
              </button>
              <button
                onClick={() => setStockStatusFilter('low')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'low' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                Menipis
              </button>
              <button
                onClick={() => setStockStatusFilter('out')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  stockStatusFilter === 'out' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                Habis
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Main Content Area */}
      <div className="p-4 md:p-6 flex-1">
        {/* SUBTAB 1: Matrix Warna & Ukuran */}
        {subTab === 'matrix' && (
          <div>
            {Object.keys(groupedByColor).length === 0 ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center">
                <Shirt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">Tidak ada data kaos yang sesuai filter</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Coba sesuaikan kata kunci pencarian, filter warna, atau filter status stok.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedColor('Semua');
                    setSelectedSize('Semua');
                    setStockStatusFilter('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  Reset Semua Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {(Object.entries(groupedByColor) as [string, KaosStockItem[]][]).map(([colorName, items]) => {
                  const colorTotalStock = items.reduce((sum, it) => sum + it.stock, 0);
                  const hasLow = items.some((it) => it.stock > 0 && it.stock <= it.minStock);
                  const hasOut = items.some((it) => it.stock <= 0);

                  return (
                    <div
                      key={colorName}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
                    >
                      {/* Color Header */}
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-5 h-5 rounded-full shadow-inner border ${getColorDotClass(
                                colorName
                              )}`}
                            ></span>
                            <div>
                              <h3 className="text-base font-bold text-white tracking-wide">
                                Kaos Polos {colorName}
                              </h3>
                              <div className="text-[11px] text-slate-400">
                                {items.length} Ukuran Aktif
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-black text-emerald-400">
                              {colorTotalStock}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">Pcs</span>
                            </div>
                            <div className="text-[10px] text-slate-500">Total Stok Warna</div>
                          </div>
                        </div>

                        {/* Status Warning Pill if any */}
                        {(hasLow || hasOut) && (
                          <div className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span>
                              {hasOut ? 'Ada ukuran yang habis' : 'Beberapa ukuran menipis'}
                            </span>
                          </div>
                        )}

                        {/* Sizes Grid */}
                        <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5 mt-3.5">
                          {items.map((it) => {
                            const isOut = it.stock <= 0;
                            const isLow = it.stock > 0 && it.stock <= it.minStock;

                            let cardBadgeClass = 'bg-slate-900 border-slate-800 hover:border-slate-700';
                            let statusText = 'Aman';
                            let statusTextColor = 'text-emerald-400';

                            if (isOut) {
                              cardBadgeClass = 'bg-rose-950/40 border-rose-900/80';
                              statusText = 'HABIS';
                              statusTextColor = 'text-rose-400 font-bold';
                            } else if (isLow) {
                              cardBadgeClass = 'bg-amber-950/40 border-amber-900/80';
                              statusText = 'MENIPIS';
                              statusTextColor = 'text-amber-400 font-bold';
                            }

                            return (
                              <div
                                key={it.id}
                                className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all relative group ${cardBadgeClass}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-200 bg-slate-800 px-2 py-0.5 rounded-md">
                                    {it.size}
                                  </span>
                                  <span className={`text-[10px] ${statusTextColor}`}>
                                    {statusText}
                                  </span>
                                </div>

                                <div className="my-2 text-center">
                                  <div className="text-xl font-black text-white">
                                    {it.stock}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Min: {it.minStock} Pcs
                                  </div>
                                </div>

                                {/* Quick Action Buttons */}
                                {isAdmin ? (
                                  <div className="flex items-center justify-center gap-1 pt-1 border-t border-slate-800/80">
                                    <button
                                      onClick={() => handleQuickAdd(it, 1)}
                                      title="Tambah +1 Pcs"
                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      +1
                                    </button>
                                    <button
                                      onClick={() => handleQuickAdd(it, 5)}
                                      title="Tambah +5 Pcs"
                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      +5
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedItem(it);
                                        setAdjustTargetStock(it.stock);
                                        setShowAdjustModal(true);
                                      }}
                                      title="Koreksi / Opname Stok Fisik"
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] transition-colors cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-center text-slate-500 pt-1">
                                    Hanya Lihat
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Card Footer Quick Restock */}
                      {isAdmin && (
                        <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-end">
                          <button
                            onClick={() => {
                              setRestockColor(colorName);
                              setShowRestockModal(true);
                            }}
                            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Restock Warna Ini
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: Tabel Daftar Rinci */}
        {subTab === 'table' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4">No</th>
                    <th className="py-3.5 px-4">SKU / Kode Kaos</th>
                    <th className="py-3.5 px-4">Warna</th>
                    <th className="py-3.5 px-4">Ukuran (Size)</th>
                    <th className="py-3.5 px-4 text-center">Stok Fisik Saat Ini</th>
                    <th className="py-3.5 px-4 text-center">Batas Min. Stok</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    {isAdmin && <th className="py-3.5 px-4 text-right">Aksi Cepat</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {filteredKaos.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-8 text-center text-slate-500">
                        Tidak ada varian kaos yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredKaos.map((item, idx) => {
                      const isOut = item.stock <= 0;
                      const isLow = item.stock > 0 && item.stock <= item.minStock;

                      return (
                        <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4 text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">
                            KAOS-{item.color.toUpperCase().replace(/\s+/g, '-')}-{item.size}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-3.5 h-3.5 rounded-full border shadow-inner ${getColorDotClass(
                                  item.color
                                )}`}
                              ></span>
                              <span className="font-semibold text-white">{item.color}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-bold text-slate-200">
                              {item.size}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`text-sm font-black ${
                                isOut
                                  ? 'text-rose-400'
                                  : isLow
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {item.stock} Pcs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400">
                            {item.minStock} Pcs
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isOut ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                HABIS
                              </span>
                            ) : isLow ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                                MENIPIS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                AMAN
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleQuickAdd(item, 5)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  +5
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedItem(item);
                                    setAdjustTargetStock(item.stock);
                                    setShowAdjustModal(true);
                                  }}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Opname
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB 3: Riwayat Mutasi Kaos */}
        {subTab === 'history' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-md">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Log Riwayat Mutasi Stok Kaos Polos</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mencatat otomatis setiap transaksi kasir, antrean produksi, restock masuk, dan opname koreksi.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
                {kaosMovements.length} Catatan
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Tipe Mutasi</th>
                    <th className="py-3 px-4">Item Kaos</th>
                    <th className="py-3 px-4 text-center">Jumlah</th>
                    <th className="py-3 px-4 text-center">Sebelum &gt; Sesudah</th>
                    <th className="py-3 px-4">Keterangan / Alasan</th>
                    <th className="py-3 px-4">No. Ref</th>
                    <th className="py-3 px-4">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {kaosMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Belum ada riwayat mutasi stok untuk kaos polos.
                      </td>
                    </tr>
                  ) : (
                    kaosMovements.map((m) => {
                      const isOut = m.type === 'OUT' || m.type === 'SALE';
                      const isAdjust = m.type === 'ADJUST';

                      return (
                        <tr key={m.id} className="hover:bg-slate-900/60 transition-colors">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{m.date}</td>
                          <td className="py-3 px-4">
                            {isOut ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                <ArrowDownRight className="w-3 h-3" />
                                KELUAR
                              </span>
                            ) : isAdjust ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-[10px] font-bold">
                                <RefreshCw className="w-3 h-3" />
                                OPNAME
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                <ArrowUpRight className="w-3 h-3" />
                                MASUK
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">{m.productName}</td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span className={isOut ? 'text-rose-400' : 'text-emerald-400'}>
                              {isOut ? '-' : '+'}
                              {m.qty} Pcs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {m.prevStock} &rarr; {m.newStock}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={m.reason}>
                            {m.reason}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            {m.referenceNo || '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{m.operatorName}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Restock Kaos Masuk */}
      {showRestockModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Restock Kaos Polos Masuk</h3>
                  <p className="text-[11px] text-slate-400">Tambah jumlah stok fisik dari kiriman supplier/konveksi.</p>
                </div>
              </div>
              <button
                onClick={() => setShowRestockModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalRestockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Warna Kaos
                </label>
                <select
                  value={restockColor}
                  onChange={(e) => setRestockColor(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {availableColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Pilih Ukuran (Size)
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {STANDARD_KAOS_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setRestockSize(sz)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        restockSize === sz
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jumlah Kaos Masuk (Pcs)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={restockQty}
                    onChange={(e) => setRestockQty(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center gap-1">
                    {[10, 20, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRestockQty(preset)}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Keterangan / Asal Pasokan
                </label>
                <input
                  type="text"
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Contoh: Kiriman Konveksi Bandung PO #99"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00871f] hover:bg-emerald-700 text-xs font-bold text-white shadow-lg shadow-emerald-950 cursor-pointer"
                >
                  Simpan Stok Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Stok Opname / Koreksi Fisik */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Stok Opname / Koreksi Fisik</h3>
                  <p className="text-[11px] text-slate-400">
                    Kaos Polos {selectedItem.color} - Size {selectedItem.size}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdjustModal(false);
                  setSelectedItem(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleModalAdjustSubmit} className="mt-4 space-y-4">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">Stok Sistem Saat Ini:</span>
                  <div className="text-lg font-black text-slate-200">{selectedItem.stock} Pcs</div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">Selisih Opname:</span>
                  <div
                    className={`text-lg font-black ${
                      adjustTargetStock - selectedItem.stock >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {adjustTargetStock - selectedItem.stock >= 0 ? '+' : ''}
                    {adjustTargetStock - selectedItem.stock} Pcs
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Jumlah Stok Fisik Riil (Hasil Hitung Opname)
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustTargetStock}
                  onChange={(e) => setAdjustTargetStock(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-lg font-black text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Alasan Penyesuaian
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="Koreksi Stok Fisik (Stok Opname Rutin)">Koreksi Stok Fisik (Stok Opname Rutin)</option>
                  <option value="Barang Cacat / Rusak / Reject">Barang Cacat / Rusak / Reject</option>
                  <option value="Hilang / Tidak Ditemukan">Hilang / Tidak Ditemukan</option>
                  <option value="Sample / Display Toko">Sample / Display Toko</option>
                  <option value="Koreksi Salah Input Sebelumnya">Koreksi Salah Input Sebelumnya</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow-lg shadow-amber-950 cursor-pointer"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Tambah Warna Baru */}
      {showAddColorModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-400 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Tambah Varian Warna Baru</h3>
                  <p className="text-[11px] text-slate-400">
                    Sistem akan otomatis membuat ukuran S, M, L, XL, XXL, dan 3XL.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddColorModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewColorSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Warna Kaos (Contoh: Lilac, Sage Green, Biru Turkish)
                </label>
                <input
                  type="text"
                  required
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder="Masukkan nama warna baru..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stok Awal per Ukuran
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newColorInitialStock}
                    onChange={(e) => setNewColorInitialStock(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Batas Minimum Stok
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newColorMinStock}
                    onChange={(e) => setNewColorMinStock(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Catatan Otomatis:</span> Warna baru akan langsung tersedia di menu Kasir (POS) saat memilih produk Sablon + Kaos A3 / A4.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddColorModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-950 cursor-pointer"
                >
                  Buat Warna Kaos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal Import Penyesuaian Stok Khusus Kaos (Excel / CSV) */}
      <ImportKaosStockModal
        isOpen={showImportKaosModal}
        onClose={() => setShowImportKaosModal(false)}
        kaosStocks={kaosStocks}
        currentUser={currentUser}
        onApplyImport={(updatedStocks, movements) => {
          onUpdateKaosStocks(updatedStocks, movements);
        }}
      />
    </div>
  );
};
