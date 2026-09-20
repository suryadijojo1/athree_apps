import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  X,
  Download,
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Product } from '../types';
import { formatCurrency, downloadProductImportTemplate } from '../utils/exportUtils';

export interface ParsedImportProduct {
  sku: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  isExisting: boolean;
  isValid: boolean;
  errorReason?: string;
}

interface ImportProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingProducts: Product[];
  categories: string[];
  onImportProducts: (
    items: ParsedImportProduct[],
    strategy: 'update' | 'skip' | 'new_sku'
  ) => { addedCount: number; updatedCount: number; skippedCount: number };
}

export const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onClose,
  existingProducts,
  categories,
  onImportProducts
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedImportProduct[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip' | 'new_sku'>('update');
  const [importResult, setImportResult] = useState<{
    added: number;
    updated: number;
    skipped: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Normalize column name for lenient matching
  const normalizeKey = (k: string): string => {
    return k
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Process file upload
  const handleFileChange = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      setSelectedFile(null);
      setParsedData([]);
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    setImportResult(null);
    setIsProcessing(true);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error('File tidak memiliki lembar kerja (sheet) yang valid.');
        }

        const worksheet = workbook.Sheets[sheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File Excel / CSV kosong atau tidak memiliki baris data.');
        }

        const existingSkuSet = new Map<string, Product>();
        existingProducts.forEach((p) => {
          existingSkuSet.set(p.sku.toLowerCase().trim(), p);
        });

        const defaultCategory =
          categories.find((c) => c !== 'Semua' && c !== 'Favorit') || 'JERSEY';

        const parsedList: ParsedImportProduct[] = rawJson.map((row, index) => {
          // Find fields by lenient key matching
          let rawSku = '';
          let rawName = '';
          let rawCat = '';
          let rawPrice: any = 0;
          let rawCost: any = 0;
          let rawStock: any = 0;
          let rawMinStock: any = 5;
          let rawUnit = 'Pcs';

          Object.entries(row).forEach(([key, val]) => {
            const norm = normalizeKey(key);
            const strVal = String(val ?? '').trim();

            if (['sku', 'kode', 'kodebarang', 'barcode', 'code'].includes(norm)) {
              rawSku = strVal;
            } else if (
              ['namaproduk', 'nama', 'namabarang', 'productname', 'name', 'item', 'produk'].includes(
                norm
              )
            ) {
              rawName = strVal;
            } else if (['kategori', 'category', 'kelompok', 'grup'].includes(norm)) {
              rawCat = strVal;
            } else if (
              ['hargajual', 'harga', 'price', 'sellingprice', 'jual', 'hargapcs'].includes(norm)
            ) {
              rawPrice = val;
            } else if (
              ['hargamodal', 'modal', 'cost', 'costprice', 'beli', 'hargabeli'].includes(norm)
            ) {
              rawCost = val;
            } else if (
              ['stok', 'stoksaatini', 'stock', 'qty', 'jumlah', 'stokawal'].includes(norm)
            ) {
              rawStock = val;
            } else if (
              ['stokminimal', 'stokmin', 'minstock', 'minimumstock', 'alertstok'].includes(norm)
            ) {
              rawMinStock = val;
            } else if (['satuan', 'unit', 'uom', 'ukuran'].includes(norm)) {
              rawUnit = strVal;
            }
          });

          // Validation & parsing
          const cleanNumber = (num: any, fallback = 0): number => {
            if (typeof num === 'number') return isNaN(num) ? fallback : num;
            if (typeof num === 'string') {
              const cleaned = num.replace(/[^0-9.-]+/g, '');
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? fallback : parsed;
            }
            return fallback;
          };

          const price = cleanNumber(rawPrice, 0);
          const costPrice = cleanNumber(rawCost, Math.round(price * 0.7));
          const stock = cleanNumber(rawStock, 0);
          const minStock = cleanNumber(rawMinStock, 5);

          const sku = rawSku || `SKU/IMP-${Date.now().toString().slice(-4)}-${index + 1}`;
          const name = rawName || `PRODUK IMPOR #${index + 1}`;
          const category = rawCat ? rawCat.toUpperCase() : defaultCategory;
          const unit = rawUnit || 'Pcs';

          const isExisting = existingSkuSet.has(sku.toLowerCase().trim());
          const isValid = Boolean(name && name.length >= 2);

          return {
            sku: sku.trim(),
            name: name.trim().toUpperCase(),
            category,
            price,
            costPrice,
            stock,
            minStock,
            unit,
            isExisting,
            isValid,
            errorReason: isValid ? undefined : 'Nama produk terlalu singkat atau kosong'
          };
        });

        setParsedData(parsedList);
      } catch (err: any) {
        setParseError(err?.message || 'Gagal membaca atau memproses file.');
        setParsedData([]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseError('Terjadi kesalahan saat membaca file fisik.');
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmImport = () => {
    const validItems = parsedData.filter((i) => i.isValid);
    if (validItems.length === 0) {
      alert('Tidak ada data produk yang valid untuk diimpor.');
      return;
    }

    const result = onImportProducts(validItems, duplicateStrategy);
    setImportResult({
      added: result.addedCount,
      updated: result.updatedCount,
      skipped: result.skippedCount
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedData([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validCount = parsedData.filter((i) => i.isValid).length;
  const existingCount = parsedData.filter((i) => i.isExisting).length;
  const newCount = validCount - existingCount;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full flex flex-col max-h-[92vh] shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                Impor Produk Massal
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold uppercase tracking-wider">
                  Excel / CSV
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Tambah atau perbarui puluhan katalog produk sekaligus menggunakan file spreadsheet
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Result Banner if import succeeded */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-emerald-800">Proses Impor Selesai Berhasil!</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    Katalog dan stok produk telah diperbarui secara instan ke sistem POS Athree Jayapura:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                      +{importResult.added} Produk Baru Ditambahkan
                    </span>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                      {importResult.updated} Produk Diperbarui
                    </span>
                    {importResult.skipped > 0 && (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        {importResult.skipped} Dilewati
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={onClose}
                      className="px-4 py-1.5 bg-[#00871f] hover:bg-[#007019] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Selesai & Lihat Stok
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-100/50 cursor-pointer"
                    >
                      Impor File Lain
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!importResult && (
            <>
              {/* Step 1: Template Download Bar */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 border border-blue-200/70 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">
                      Belum memiliki format data yang sesuai?
                    </span>
                    <span className="text-[11px] text-blue-700">
                      Unduh template contoh dengan kolom: SKU, Nama Produk, Kategori, Harga Jual, Harga Modal, Stok, Satuan.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => downloadProductImportTemplate('xlsx')}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>Template (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadProductImportTemplate('csv')}
                    className="flex-1 sm:flex-initial px-3 py-1.5 bg-white hover:bg-blue-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Template (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Upload Dropzone */}
              {!selectedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#00871f] bg-emerald-50/50 scale-[0.99]'
                      : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-inner">
                    <UploadCloud className="w-7 h-7 stroke-[2]" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    Klik untuk pilih file atau seret file ke sini
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Mendukung file Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong>
                  </p>
                  <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-400">
                    <span>Maksimal 5.000 produk</span>
                    <span>•</span>
                    <span>Deteksi kolom otomatis</span>
                  </div>
                </div>
              ) : (
                /* File Selected Banner */
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center font-bold text-xs">
                      {selectedFile.name.endsWith('.csv') ? 'CSV' : 'XLS'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{selectedFile.name}</h4>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB • {parsedData.length} baris terdeteksi
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-2.5 py-1.5 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  >
                    Ganti File
                  </button>
                </div>
              )}

              {/* Error Notice */}
              {parseError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Step 3: Duplicate Strategy & Preview */}
              {parsedData.length > 0 && (
                <div className="space-y-4">
                  {/* Duplicate Strategy Option */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[#00871f]" />
                        Perilaku Jika SKU Sudah Terdaftar:
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {existingCount > 0
                          ? `${existingCount} item memiliki SKU yang sudah ada di sistem`
                          : 'Semua item merupakan SKU baru'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <label
                        className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition-all ${
                          duplicateStrategy === 'update'
                            ? 'border-[#00871f] bg-emerald-50/50 text-slate-900 font-semibold ring-1 ring-[#00871f]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateStrategy"
                          value="update"
                          checked={duplicateStrategy === 'update'}
                          onChange={() => setDuplicateStrategy('update')}
                          className="mt-0.5 text-[#00871f] focus:ring-[#00871f]"
                        />
                        <div className="text-[11px] leading-tight">
                          <span className="block font-bold">Perbarui Data (Update)</span>
                          <span className="text-[10px] text-slate-500">
                            Perbarui harga & stok pada SKU yang ada
                          </span>
                        </div>
                      </label>

                      <label
                        className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition-all ${
                          duplicateStrategy === 'skip'
                            ? 'border-[#00871f] bg-emerald-50/50 text-slate-900 font-semibold ring-1 ring-[#00871f]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateStrategy"
                          value="skip"
                          checked={duplicateStrategy === 'skip'}
                          onChange={() => setDuplicateStrategy('skip')}
                          className="mt-0.5 text-[#00871f] focus:ring-[#00871f]"
                        />
                        <div className="text-[11px] leading-tight">
                          <span className="block font-bold">Lewati (Skip)</span>
                          <span className="text-[10px] text-slate-500">
                            Jangan ubah produk dengan SKU lama
                          </span>
                        </div>
                      </label>

                      <label
                        className={`border rounded-xl p-2.5 flex items-start gap-2 cursor-pointer transition-all ${
                          duplicateStrategy === 'new_sku'
                            ? 'border-[#00871f] bg-emerald-50/50 text-slate-900 font-semibold ring-1 ring-[#00871f]'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicateStrategy"
                          value="new_sku"
                          checked={duplicateStrategy === 'new_sku'}
                          onChange={() => setDuplicateStrategy('new_sku')}
                          className="mt-0.5 text-[#00871f] focus:ring-[#00871f]"
                        />
                        <div className="text-[11px] leading-tight">
                          <span className="block font-bold">Buat SKU Baru</span>
                          <span className="text-[10px] text-slate-500">
                            Beri akhiran unik dan buat produk baru
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Summary counts */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Pratinjau Data ({validCount} Produk Siap Diimpor)
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-[#00871f]">
                        {newCount} Baru
                      </span>
                      {existingCount > 0 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                          {existingCount} Update SKU
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Menampilkan maksimal 20 baris pertama
                    </span>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-56">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="p-2 pl-3">Status</th>
                            <th className="p-2">SKU</th>
                            <th className="p-2">Nama Produk</th>
                            <th className="p-2">Kategori</th>
                            <th className="p-2 text-right">Harga Jual</th>
                            <th className="p-2 text-right">Modal</th>
                            <th className="p-2 text-center">Stok</th>
                            <th className="p-2 pr-3 text-center">Satuan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedData.slice(0, 20).map((row, idx) => (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50 ${!row.isValid ? 'bg-rose-50/50' : ''}`}
                            >
                              <td className="p-2 pl-3">
                                {row.isExisting ? (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 text-blue-800">
                                    Update
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-[#00871f]">
                                    Baru
                                  </span>
                                )}
                              </td>
                              <td className="p-2 font-mono text-[11px] font-semibold text-slate-700">
                                {row.sku}
                              </td>
                              <td className="p-2 font-medium text-slate-800 max-w-[180px] truncate">
                                {row.name}
                              </td>
                              <td className="p-2">
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-700 font-medium">
                                  {row.category}
                                </span>
                              </td>
                              <td className="p-2 text-right font-bold text-[#00871f]">
                                {formatCurrency(row.price)}
                              </td>
                              <td className="p-2 text-right text-slate-500">
                                {formatCurrency(row.costPrice)}
                              </td>
                              <td className="p-2 text-center font-bold text-slate-800">
                                {row.stock}
                              </td>
                              <td className="p-2 pr-3 text-center text-slate-500">
                                {row.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            {importResult ? 'Tutup' : 'Batal'}
          </button>

          {!importResult && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={validCount === 0 || isProcessing}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-[#00871f] hover:bg-[#007019] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {validCount > 0
                    ? `Impor ${validCount} Produk Sekarang`
                    : 'Pilih File Terlebih Dahulu'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
