import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  CheckCircle2,
  History,
  TrendingDown,
  Boxes,
  ShieldAlert,
  Lock,
  UploadCloud
} from 'lucide-react';
import { Product, StockMovement, User } from '../types';
import { formatCurrency, exportStockToExcel, exportStockToPDF } from '../utils/exportUtils';
import { ImportProductsModal, ParsedImportProduct } from './ImportProductsModal';

interface StockManagementViewProps {
  products: Product[];
  categories: string[];
  stockMovements: StockMovement[];
  currentUser: User;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (
    productId: string,
    type: 'IN' | 'OUT' | 'ADJUST',
    qty: number,
    reason: string
  ) => void;
  onImportProducts?: (
    items: ParsedImportProduct[],
    strategy: 'update' | 'skip' | 'new_sku'
  ) => { addedCount: number; updatedCount: number; skippedCount: number };
}

export const StockManagementView: React.FC<StockManagementViewProps> = ({
  products,
  categories,
  stockMovements,
  currentUser,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onImportProducts
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'inventory' | 'history'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Form states for new/edit product
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCategory, setFormCategory] = useState('JERSEY');
  const [formPrice, setFormPrice] = useState<number>(100000);
  const [formCostPrice, setFormCostPrice] = useState<number>(70000);
  const [formStock, setFormStock] = useState<number>(20);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formUnit, setFormUnit] = useState('Pcs');

  const isAdmin = currentUser.role === 'admin';

  // Metrics
  const totalProducts = products.length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAssetValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const lowStockItems = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const outOfStockItems = products.filter((p) => p.stock <= 0);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'Semua' ||
        p.category.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      const matchStatus =
        stockStatusFilter === 'all'
          ? true
          : stockStatusFilter === 'low'
          ? p.stock > 0 && p.stock <= p.minStock
          : p.stock <= 0;

      return matchCat && matchSearch && matchStatus;
    });
  }, [products, selectedCategory, searchQuery, stockStatusFilter]);

  // Open Edit Product
  const openEditModal = (p: Product) => {
    if (!isAdmin) {
      alert('Hanya Administrator/Pemilik yang dapat mengubah master data produk.');
      return;
    }
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCategory(p.category);
    setFormPrice(p.price);
    setFormCostPrice(p.costPrice);
    setFormStock(p.stock);
    setFormMinStock(p.minStock);
    setFormUnit(p.unit);
  };

  // Open Add Product
  const openAddModal = () => {
    if (!isAdmin) {
      alert('Hanya Administrator/Pemilik yang dapat menambah master data produk.');
      return;
    }
    setEditingProduct(null);
    setFormName('');
    setFormSku(`SKU/00${String(products.length + 1).padStart(3, '0')}`);
    setFormCategory(categories.find((c) => c !== 'Semua' && c !== 'Favorit') || 'JERSEY');
    setFormPrice(100000);
    setFormCostPrice(65000);
    setFormStock(30);
    setFormMinStock(5);
    setFormUnit('Pcs');
    setShowAddModal(true);
  };

  // Submit Product Save
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Akses Ditolak: Kasir tidak diizinkan menambah atau mengubah produk!');
      return;
    }
    if (!formName.trim() || !formSku.trim()) return;

    // Generate badge colors & initials
    const words = formName.trim().split(' ');
    const initials =
      words.length >= 2
        ? (words[0][0] + words[1][0]).toUpperCase()
        : formName.trim().substring(0, 2).toUpperCase();

    const colorPalettes = [
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200'
    ];
    const randomBadge = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];

    if (editingProduct) {
      onUpdateProduct({
        ...editingProduct,
        name: formName.trim().toUpperCase(),
        sku: formSku.trim(),
        category: formCategory,
        price: Number(formPrice),
        costPrice: Number(formCostPrice),
        stock: Number(formStock),
        minStock: Number(formMinStock),
        unit: formUnit,
        initials
      });
      setEditingProduct(null);
    } else {
      onAddProduct({
        name: formName.trim().toUpperCase(),
        sku: formSku.trim(),
        category: formCategory,
        price: Number(formPrice),
        costPrice: Number(formCostPrice),
        stock: Number(formStock),
        minStock: Number(formMinStock),
        unit: formUnit,
        colorBadge: randomBadge,
        initials,
        isFavorite: false
      });
      setShowAddModal(false);
    }
  };

  // Submit Stock Adjustment
  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Akses Ditolak: Kasir tidak memiliki izin untuk merubah stok atau mutasi barang!');
      return;
    }
    if (!adjustingProduct) return;
    if (adjustQty <= 0) {
      alert('Jumlah perubahan stok harus lebih dari 0.');
      return;
    }
    onAdjustStock(adjustingProduct.id, adjustType, adjustQty, adjustReason || 'Penyesuaian stok berkala');
    setAdjustingProduct(null);
    setAdjustQty(1);
    setAdjustReason('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Top Bar with Metrics & Action buttons */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#00871f]" />
              Manajemen Stok Barang & Inventaris
            </h2>
            <p className="text-xs text-slate-500">
              Kelola ketersediaan bahan jersey, kaos polos, sablon, dan aksesoris studio
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Export Buttons */}
            <button
              onClick={() => exportStockToExcel(products)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>
            <button
              onClick={() => exportStockToPDF(products)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Ekspor PDF</span>
            </button>

            {/* Import CSV / Excel Button - Only Admin */}
            {isAdmin && (
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                title="Impor master produk dari file CSV atau Excel"
              >
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Impor CSV / Excel</span>
              </button>
            )}

            {/* Add Product button - Only Admin can add products */}
            {isAdmin && (
              <button
                onClick={openAddModal}
                className="px-3 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk</span>
              </button>
            )}
          </div>
        </div>

        {/* Read-Only Notice for Kasir / Non-Admin */}
        {!isAdmin && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mt-3 flex items-center justify-between text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Akses Kasir (Hanya Lihat Stok):</strong> Kasir tidak memiliki akses untuk merubah stok, menambah produk, atau melakukan mutasi inventaris.</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-800 uppercase tracking-wide shrink-0">
              Read Only
            </span>
          </div>
        )}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Total Jenis Produk</span>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{totalProducts} Item</p>
            <span className="text-[10px] text-slate-400">Tersedia di katalog POS</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Total Kuantitas Fisik</span>
            <p className="text-lg font-bold text-[#00871f] mt-0.5">{totalStockUnits} Unit</p>
            <span className="text-[10px] text-slate-400">Jersey, kaos & aksesoris</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Nilai Modal Aset</span>
            {isAdmin ? (
              <>
                <p className="text-lg font-bold text-slate-800 mt-0.5">{formatCurrency(totalAssetValue)}</p>
                <span className="text-[10px] text-slate-400">Berdasarkan harga modal beli</span>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-400 mt-1">Akses Khusus Admin</p>
                <span className="text-[10px] text-slate-400">Hanya tampil di akun Admin</span>
              </>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="text-xs text-slate-500 font-medium">Peringatan Stok</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-amber-600">{lowStockItems.length} Menipis</span>
              <span className="text-slate-300">/</span>
              <span className="text-lg font-bold text-rose-600">{outOfStockItems.length} Habis</span>
            </div>
            <span className="text-[10px] text-slate-400">Segera restock ke supplier</span>
          </div>
        </div>

        {/* Tab switcher: Inventory Table vs History Mutasi */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
          <button
            onClick={() => setActiveSubTab('inventory')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === 'inventory'
                ? 'bg-[#00871f] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Daftar Stok Produk ({products.length})
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-[#00871f] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Riwayat Mutasi Stok ({stockMovements.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSubTab === 'inventory' ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Filter controls */}
            <div className="p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari SKU atau nama produk..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-[#00871f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
                >
                  <option value="Semua">Semua Kategori</option>
                  {categories
                    .filter((c) => c !== 'Semua' && c !== 'Favorit')
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                </select>

                {/* Status Filter */}
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700"
                >
                  <option value="all">Semua Status Stok</option>
                  <option value="low">Hanya Stok Menipis</option>
                  <option value="out">Hanya Stok Habis</option>
                </select>
              </div>
            </div>

            {/* Products Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Produk & SKU</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    {isAdmin && <th className="py-2.5 px-3 text-right">Harga Modal</th>}
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    {isAdmin && <th className="py-2.5 px-3 text-right">Margin / Unit</th>}
                    <th className="py-2.5 px-3 text-center">Stok Saat Ini</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProducts.map((p) => {
                    const margin = p.price - p.costPrice;
                    const marginPercent = ((margin / p.price) * 100).toFixed(0);
                    const isLow = p.stock > 0 && p.stock <= p.minStock;
                    const isOut = p.stock <= 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 border ${p.colorBadge}`}
                            >
                              {p.initials}
                            </span>
                            <div>
                              <p className="font-bold text-slate-800">{p.name}</p>
                              <span className="font-mono text-[10px] text-slate-400">{p.sku}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {p.category}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                            {formatCurrency(p.costPrice)}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          {formatCurrency(p.price)}
                        </td>
                        {isAdmin && (
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-emerald-600 font-semibold">
                              +{formatCurrency(margin)} ({marginPercent}%)
                            </span>
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-sm font-bold text-slate-800">{p.stock}</span>
                          <span className="text-[10px] text-slate-400 ml-1">{p.unit}</span>
                          <div className="text-[9px] text-slate-400">Min: {p.minStock}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isOut ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                              Habis
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Menipis
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                              Aman
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-1">
                              {/* Stock Adjustment button */}
                              <button
                                onClick={() => {
                                  setAdjustingProduct(p);
                                  setAdjustQty(1);
                                  setAdjustType('IN');
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-[#00871f] text-slate-700 rounded-md text-[10px] font-bold transition-colors cursor-pointer"
                                title="Sesuaikan / Masuk Stok"
                              >
                                Mutasi
                              </button>

                              {/* Edit master */}
                              <button
                                onClick={() => openEditModal(p)}
                                className="p-1 hover:text-[#00871f] text-slate-400 transition-colors cursor-pointer"
                                title="Edit Data Produk"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  if (confirm(`Hapus produk ${p.name}?`)) {
                                    onDeleteProduct(p.id);
                                  }
                                }}
                                className="p-1 hover:text-rose-600 text-slate-400 transition-colors cursor-pointer"
                                title="Hapus Produk"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic bg-slate-100 px-2 py-0.5 rounded">
                              Hanya Lihat
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Sub-tab: Riwayat Mutasi Stok */
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-500" />
                Catatan Log Masuk, Keluar, dan Penyesuaian Fisik
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Total {stockMovements.length} transaksi mutasi
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Produk</th>
                    <th className="py-2.5 px-3">Tipe Mutasi</th>
                    <th className="py-2.5 px-3 text-right">Jumlah</th>
                    <th className="py-2.5 px-3 text-center">Stok (Sebelum &rarr; Sesudah)</th>
                    <th className="py-2.5 px-3">Alasan / Referensi</th>
                    <th className="py-2.5 px-3">Operator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {stockMovements.map((sm) => (
                    <tr key={sm.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {sm.date}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {sm.productName}
                        <span className="block font-normal font-mono text-[10px] text-slate-400">
                          {sm.sku}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {sm.type === 'IN' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                            <ArrowDownRight className="w-3 h-3" /> Masuk
                          </span>
                        )}
                        {sm.type === 'SALE' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                            <ArrowUpRight className="w-3 h-3" /> Penjualan
                          </span>
                        )}
                        {sm.type === 'OUT' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                            <TrendingDown className="w-3 h-3" /> Keluar / Rusak
                          </span>
                        )}
                        {sm.type === 'ADJUST' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1 w-fit">
                            Opname Fisik
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {sm.type === 'IN' ? `+${sm.qty}` : `-${sm.qty}`}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {sm.prevStock} &rarr; <span className="font-bold text-slate-800">{sm.newStock}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {sm.reason}
                        {sm.referenceNo && (
                          <span className="ml-1 text-[10px] font-mono text-[#00871f]">
                            ({sm.referenceNo})
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">{sm.operatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL: Tambah / Edit Produk Master
      ========================================================================= */}
      {(showAddModal || editingProduct) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#00871f]" />
              {editingProduct ? 'Edit Master Data Produk' : 'Tambah Produk Baru ke Katalog'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Produk *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: JERSEY HOME ATASAN"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kode SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="SKU/00020"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kategori
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  >
                    {categories
                      .filter((c) => c !== 'Semua' && c !== 'Favorit')
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    <option value="LAINNYA">LAINNYA</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Harga Modal (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Harga Jual Kasir (Rp) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Stok Fisik
                  </label>
                  <input
                    type="number"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Batas Minimum
                  </label>
                  <input
                    type="number"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    placeholder="Pcs / Set"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Mutasi / Penyesuaian Stok
      ========================================================================= */}
      {adjustingProduct && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100">
            <h3 className="text-base font-bold text-slate-800 mb-1">Mutasi / Penyesuaian Stok</h3>
            <p className="text-xs text-slate-500 mb-3">
              {adjustingProduct.name} ({adjustingProduct.sku}) &bull; Stok Sekarang: {adjustingProduct.stock}{' '}
              {adjustingProduct.unit}
            </p>

            <form onSubmit={handleConfirmAdjust} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Jenis Mutasi
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAdjustType('IN')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      adjustType === 'IN'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    + Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('OUT')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      adjustType === 'OUT'
                        ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    - Keluar/Rusak
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADJUST')}
                    className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      adjustType === 'ADJUST'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Opname Fisik
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  {adjustType === 'ADJUST' ? 'Stok Fisik Baru (Hasil Hitung)' : 'Jumlah Unit'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(Number(e.target.value))}
                  className="w-full text-sm font-bold px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan / Alasan Mutasi
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Contoh: Penerimaan bahan supplier / Rusak terpotong"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#00871f] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-lg shadow-sm cursor-pointer"
                >
                  Konfirmasi Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Products from CSV / Excel Modal */}
      {showImportModal && onImportProducts && (
        <ImportProductsModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          existingProducts={products}
          categories={categories}
          onImportProducts={onImportProducts}
        />
      )}
    </div>
  );
};
