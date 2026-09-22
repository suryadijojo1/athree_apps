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
  Shirt,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Plus,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { KaosStockItem, StockMovement, User } from '../types';
import { downloadKaosStockAdjustmentTemplate } from '../utils/exportUtils';
import { generateKaosStockId } from '../data/mockData';

export interface ParsedKaosImportRow {
  color: string;
  size: string;
  importedQty: number;
  minStock?: number;
  notes?: string;
  isExisting: boolean;
  existingStock: number;
  newStock: number;
  diff: number; // positive = added, negative = reduced
  isValid: boolean;
  errorReason?: string;
}

interface ImportKaosStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  kaosStocks: KaosStockItem[];
  currentUser: User;
  onApplyImport: (updatedStocks: KaosStockItem[], movements: StockMovement[]) => void;
}

export const ImportKaosStockModal: React.FC<ImportKaosStockModalProps> = ({
  isOpen,
  onClose,
  kaosStocks,
  currentUser,
  onApplyImport
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedKaosImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'diff' | 'new' | 'error'>('all');
  const [previewSearch, setPreviewSearch] = useState('');
  const [allowNewVariants, setAllowNewVariants] = useState(true);
  const [defaultReason, setDefaultReason] = useState('Penyesuaian Stok Opname Kaos Polos');
  const [adjustmentMode, setAdjustmentMode] = useState<'replace' | 'add'>('replace');
  const [importSuccessResult, setImportSuccessResult] = useState<{
    updated: number;
    created: number;
    netPcs: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Helper: Normalize keys
  const normalizeKey = (k: string): string => {
    return k.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  // Helper: Color dots
  const getColorDotClass = (colorName: string): string => {
    const c = colorName.toLowerCase();
    if (c.includes('hitam')) return 'bg-slate-900 border-slate-700';
    if (c.includes('putih')) return 'bg-white border-slate-300';
    if (c.includes('navy') || c.includes('dongker')) return 'bg-blue-900 border-blue-800';
    if (c.includes('maroon') || c.includes('merah tua')) return 'bg-red-950 border-red-800';
    if (c.includes('merah')) return 'bg-red-600 border-red-500';
    if (c.includes('hijau botol') || c.includes('army')) return 'bg-emerald-950 border-emerald-800';
    if (c.includes('hijau')) return 'bg-emerald-600 border-emerald-500';
    if (c.includes('abu') || c.includes('misty')) return 'bg-slate-400 border-slate-300';
    if (c.includes('kuning') || c.includes('mustard')) return 'bg-amber-400 border-amber-300';
    if (c.includes('orange') || c.includes('oranye')) return 'bg-orange-500 border-orange-400';
    if (c.includes('cokelat') || c.includes('coklat')) return 'bg-amber-900 border-amber-800';
    if (c.includes('lilac') || c.includes('ungu')) return 'bg-purple-500 border-purple-400';
    if (c.includes('tosca') || c.includes('toska')) return 'bg-teal-500 border-teal-400';
    return 'bg-indigo-600 border-indigo-500';
  };

  // Process imported file
  const processFileData = (rawRows: Record<string, unknown>[], mode: 'replace' | 'add') => {
    const parsed: ParsedKaosImportRow[] = [];

    rawRows.forEach((row, idx) => {
      // Find color key
      let colorVal = '';
      let sizeVal = '';
      let qtyVal: number | null = null;
      let minStockVal = 5;
      let notesVal = '';

      Object.entries(row).forEach(([origKey, val]) => {
        const k = normalizeKey(origKey);
        const strVal = String(val ?? '').trim();

        if (
          k === 'warnakaos' ||
          k === 'warna' ||
          k === 'color' ||
          k === 'namawarna' ||
          k === 'namakaos'
        ) {
          colorVal = strVal;
        } else if (
          k === 'ukuran' ||
          k === 'size' ||
          k === 'ukurankaos' ||
          k === 'sizekaos'
        ) {
          sizeVal = strVal;
        } else if (
          k === 'stokfisikopname' ||
          k === 'stokfisik' ||
          k === 'stokbaru' ||
          k === 'stok' ||
          k === 'penyesuaianstok' ||
          k === 'penyesuaian' ||
          k === 'qty' ||
          k === 'jumlah' ||
          k === 'stock'
        ) {
          const num = Number(strVal);
          if (!isNaN(num)) qtyVal = Math.max(0, Math.floor(num));
        } else if (
          k === 'stokminimal' ||
          k === 'minstok' ||
          k === 'minimal' ||
          k === 'minstock'
        ) {
          const num = Number(strVal);
          if (!isNaN(num) && num >= 0) minStockVal = Math.floor(num);
        } else if (
          k === 'keterangan' ||
          k === 'catatan' ||
          k === 'reason' ||
          k === 'notes'
        ) {
          notesVal = strVal;
        } else if (k === 'sku') {
          // If SKU is like KAOS-HITAM-XL, can parse if color/size not found
          const parts = strVal.split('-');
          if (parts.length >= 3 && parts[0].toUpperCase() === 'KAOS') {
            if (!colorVal) colorVal = parts[1].replace(/_/g, ' ');
            if (!sizeVal) sizeVal = parts[2];
          }
        }
      });

      // Format casing
      const formattedColor = colorVal
        .split(' ')
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(' ')
        .trim();

      const formattedSize = sizeVal.toUpperCase().trim();

      // Check existing item
      const existing = kaosStocks.find(
        (k) =>
          k.color.toLowerCase() === formattedColor.toLowerCase() &&
          k.size.toUpperCase() === formattedSize.toUpperCase()
      );

      const existingStock = existing ? existing.stock : 0;
      const isValid = Boolean(formattedColor && formattedSize && qtyVal !== null && qtyVal >= 0);

      let errorReason: string | undefined;
      if (!formattedColor) errorReason = 'Kolom Warna kosong';
      else if (!formattedSize) errorReason = 'Kolom Ukuran kosong';
      else if (qtyVal === null) errorReason = 'Jumlah Stok bukan angka yang valid';

      const finalQty = qtyVal ?? 0;
      const newStock = mode === 'replace' ? finalQty : existingStock + finalQty;
      const diff = newStock - existingStock;

      parsed.push({
        color: formattedColor || `Baris #${idx + 1}`,
        size: formattedSize || '-',
        importedQty: finalQty,
        minStock: existing ? existing.minStock : minStockVal,
        notes: notesVal,
        isExisting: Boolean(existing),
        existingStock,
        newStock,
        diff,
        isValid,
        errorReason
      });
    });

    setParsedRows(parsed);
  };

  const handleFileChange = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Format file tidak didukung. Harap unggah file .xlsx, .xls, atau .csv');
      setSelectedFile(null);
      setParsedRows([]);
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    setImportSuccessResult(null);
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
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('File kosong atau tidak memiliki baris data.');
        }

        processFileData(rawJson, adjustmentMode);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Gagal membaca isi file.';
        setParseError(`Kesalahan membaca berkas: ${errorMsg}`);
        setParsedRows([]);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setParseError('Gagal membaca file dari disk perangkat Anda.');
      setIsProcessing(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Re-calculate when adjustment mode changes
  const handleModeChange = (newMode: 'replace' | 'add') => {
    setAdjustmentMode(newMode);
    if (parsedRows.length > 0) {
      setParsedRows((prev) =>
        prev.map((row) => {
          const newStock = newMode === 'replace' ? row.importedQty : row.existingStock + row.importedQty;
          const diff = newStock - row.existingStock;
          return {
            ...row,
            newStock,
            diff
          };
        })
      );
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  // Stats calculation
  const validRows = parsedRows.filter((r) => r.isValid);
  const rowsWithDiff = validRows.filter((r) => r.diff !== 0);
  const newVariantRows = validRows.filter((r) => !r.isExisting);
  const errorRows = parsedRows.filter((r) => !r.isValid);
  const netDiffPcs = validRows.reduce((sum, r) => sum + r.diff, 0);

  // Filtered preview rows
  const filteredPreview = parsedRows.filter((r) => {
    let matchFilter = true;
    if (previewFilter === 'diff') matchFilter = r.diff !== 0;
    else if (previewFilter === 'new') matchFilter = !r.isExisting && r.isValid;
    else if (previewFilter === 'error') matchFilter = !r.isValid;

    let matchSearch = true;
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      matchSearch =
        r.color.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        (r.errorReason && r.errorReason.toLowerCase().includes(q));
    }

    return matchFilter && matchSearch;
  });

  // Execute Import
  const handleExecuteImport = () => {
    if (validRows.length === 0) {
      alert('Tidak ada baris data valid yang dapat diimpor.');
      return;
    }

    const updatedList = [...kaosStocks];
    const generatedMovements: StockMovement[] = [];
    const timestampStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const refCode = `OPNAME-IMP-${Date.now().toString().slice(-6)}`;

    let updatedCount = 0;
    let createdCount = 0;

    validRows.forEach((row) => {
      const existingIdx = updatedList.findIndex(
        (k) =>
          k.color.toLowerCase() === row.color.toLowerCase() &&
          k.size.toUpperCase() === row.size.toUpperCase()
      );

      if (existingIdx !== -1) {
        // Update existing
        const prevStock = updatedList[existingIdx].stock;
        const newStock = row.newStock;

        if (newStock !== prevStock) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            stock: newStock,
            minStock: row.minStock || updatedList[existingIdx].minStock
          };

          const diffVal = newStock - prevStock;
          const isGain = diffVal > 0;

          generatedMovements.push({
            id: `sm-kaos-imp-${Date.now()}-${row.color}-${row.size}`,
            productId: updatedList[existingIdx].id,
            productName: `Kaos Polos ${row.color} (${row.size})`,
            sku: `KAOS-${row.color.toUpperCase().replace(/\s+/g, '-')}-${row.size.toUpperCase()}`,
            type: adjustmentMode === 'add' ? 'IN' : 'ADJUST',
            qty: Math.abs(diffVal),
            prevStock,
            newStock,
            date: timestampStr,
            reason: `${defaultReason} (${isGain ? '+' : ''}${diffVal} Pcs)`,
            operatorName: currentUser.name,
            referenceNo: refCode
          });

          updatedCount++;
        }
      } else if (allowNewVariants) {
        // Create new variant
        const newId = generateKaosStockId(row.color, row.size);
        const newItem: KaosStockItem = {
          id: newId,
          color: row.color,
          size: row.size,
          stock: row.newStock,
          minStock: row.minStock || 5
        };
        updatedList.push(newItem);

        generatedMovements.push({
          id: `sm-kaos-imp-new-${Date.now()}-${row.color}-${row.size}`,
          productId: newId,
          productName: `Kaos Polos ${row.color} (${row.size})`,
          sku: `KAOS-${row.color.toUpperCase().replace(/\s+/g, '-')}-${row.size.toUpperCase()}`,
          type: 'IN',
          qty: row.newStock,
          prevStock: 0,
          newStock: row.newStock,
          date: timestampStr,
          reason: `${defaultReason} (Varian Baru Dibuat)`,
          operatorName: currentUser.name,
          referenceNo: refCode
        });

        createdCount++;
      }
    });

    onApplyImport(updatedList, generatedMovements);

    setImportSuccessResult({
      updated: updatedCount,
      created: createdCount,
      netPcs: netDiffPcs
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedRows([]);
    setParseError(null);
    setImportSuccessResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* 1. Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                Impor Penyesuaian Stok Khusus Kaos
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700 font-normal">
                  Excel / CSV
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Perbarui stok fisik kaos polos per warna & ukuran secara massal (Stock Opname)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-200">
          {/* SUCCESS STATE */}
          {importSuccessResult ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/50 animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h3 className="text-xl font-black text-white tracking-wide">
                Penyesuaian Stok Kaos Berhasil Diimpor!
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Seluruh data inventaris fisik kaos polos telah berhasil diperbarui dan dicatat ke dalam log mutasi stok sistem.
              </p>

              <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mt-4">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <div className="text-[11px] text-slate-400">Varian Diperbarui</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">
                    {importSuccessResult.updated}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <div className="text-[11px] text-slate-400">Varian Baru Dibuat</div>
                  <div className="text-xl font-bold text-blue-400 mt-0.5">
                    {importSuccessResult.created}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <div className="text-[11px] text-slate-400">Net Perubahan Fisik</div>
                  <div
                    className={`text-xl font-bold mt-0.5 ${
                      importSuccessResult.netPcs >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {importSuccessResult.netPcs >= 0 ? `+${importSuccessResult.netPcs}` : importSuccessResult.netPcs} Pcs
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                >
                  Impor File Lain
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#00871f] hover:bg-emerald-700 text-xs font-bold text-white transition-all shadow-md shadow-emerald-950"
                >
                  Tutup & Lihat Stok Kaos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* FILE UPLOAD SECTION (When no file or before parsing) */}
              {!selectedFile || parsedRows.length === 0 ? (
                <div className="space-y-4">
                  {/* Download Template Banner */}
                  <div className="bg-gradient-to-r from-slate-950 to-blue-950/40 border border-blue-900/40 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-900/60 border border-blue-700 flex items-center justify-center text-blue-300 shrink-0 mt-0.5">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Format Template Penyesuaian Stok Kaos
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Unduh format tabel yang sudah terisi otomatis dengan daftar warna & ukuran kaos Anda saat ini.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => downloadKaosStockAdjustmentTemplate(kaosStocks, 'xlsx')}
                        className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        title="Unduh Excel dengan data stok saat ini terisi"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Format Excel (.xlsx)
                      </button>
                      <button
                        onClick={() => downloadKaosStockAdjustmentTemplate(kaosStocks, 'csv')}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors border border-slate-700"
                        title="Unduh format CSV"
                      >
                        CSV
                      </button>
                    </div>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px] ${
                      isDragging
                        ? 'border-blue-500 bg-blue-950/30 scale-[0.99]'
                        : 'border-slate-700 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-950'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 mb-3 shadow-inner">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-sm font-bold text-white">
                      Tarik & lepas file Excel/CSV di sini, atau <span className="text-blue-400 underline">pilih dari komputer</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Mendukung format .xlsx, .xls, atau .csv (Maksimal 10 MB)
                    </p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800">
                      <span>Kolom yang didukung:</span>
                      <strong className="text-slate-200">Warna Kaos</strong> •
                      <strong className="text-slate-200">Ukuran</strong> •
                      <strong className="text-slate-200">Stok Fisik / Baru</strong> •
                      <span className="text-slate-500">(Opsional: Min Stok, Keterangan)</span>
                    </div>
                  </div>

                  {parseError && (
                    <div className="p-3.5 bg-rose-950/80 border border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{parseError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* PREVIEW & CONFIGURATION SECTION */
                <div className="space-y-4">
                  {/* File Bar & Mode Toggle */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate max-w-xs md:max-w-sm">
                            {selectedFile?.name}
                          </h4>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {((selectedFile?.size || 0) / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Total {parsedRows.length} baris terbaca ({validRows.length} valid, {errorRows.length} bermasalah)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleReset}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Ganti File
                      </button>
                    </div>
                  </div>

                  {/* Mode Penyesuaian (Replace vs Add) */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                      Pilih Metode Penyesuaian Stok
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Mode Replace (Stock Opname) */}
                      <button
                        type="button"
                        onClick={() => handleModeChange('replace')}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          adjustmentMode === 'replace'
                            ? 'bg-blue-950/60 border-blue-500 shadow-md shadow-blue-950/40'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CheckCircle2
                              className={`w-4 h-4 ${
                                adjustmentMode === 'replace' ? 'text-blue-400' : 'text-slate-600'
                              }`}
                            />
                            Ganti Stok Fisik (Stock Opname)
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 font-semibold">
                            Direkomendasikan
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">
                          Stok di sistem akan diganti persis sama dengan angka fisik di file. Selisih (+ atau -) dihitung otomatis sebagai penyesuaian opname.
                        </p>
                      </button>

                      {/* Mode Add (Restock In) */}
                      <button
                        type="button"
                        onClick={() => handleModeChange('add')}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          adjustmentMode === 'add'
                            ? 'bg-emerald-950/60 border-emerald-500 shadow-md shadow-emerald-950/40'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <CheckCircle2
                              className={`w-4 h-4 ${
                                adjustmentMode === 'add' ? 'text-emerald-400' : 'text-slate-600'
                              }`}
                            />
                            Tambah ke Stok Berjalan (+Restock)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">
                          Jumlah angka di file akan dijumlahkan / ditambahkan ke atas stok yang saat ini sudah ada di sistem (misal ada kiriman masuk baru).
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Total Baris File</div>
                      <div className="text-lg font-black text-white mt-0.5">{parsedRows.length}</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Ada Perubahan Stok</div>
                      <div className="text-lg font-black text-blue-400 mt-0.5">
                        {rowsWithDiff.length} <span className="text-xs font-normal text-slate-400">Varian</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Varian Baru</div>
                      <div className="text-lg font-black text-indigo-400 mt-0.5">
                        {newVariantRows.length} <span className="text-xs font-normal text-slate-400">Warna/Size</span>
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 font-medium">Net Perubahan Fisik</div>
                      <div
                        className={`text-lg font-black mt-0.5 ${
                          netDiffPcs >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {netDiffPcs >= 0 ? `+${netDiffPcs}` : netDiffPcs}{' '}
                        <span className="text-xs font-normal text-slate-400">Pcs</span>
                      </div>
                    </div>
                  </div>

                  {/* Options & Notes */}
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 w-full">
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Catatan / Alasan Mutasi Log:
                      </label>
                      <input
                        type="text"
                        value={defaultReason}
                        onChange={(e) => setDefaultReason(e.target.value)}
                        placeholder="Contoh: Penyesuaian Stok Opname Akhir Bulan"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="pt-2 sm:pt-4">
                      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={allowNewVariants}
                          onChange={(e) => setAllowNewVariants(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                        />
                        <span>Otomatis buat varian baru jika warna/ukuran belum ada</span>
                      </label>
                    </div>
                  </div>

                  {/* Preview Table Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 w-fit">
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewFilter === 'all'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Semua ({parsedRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('diff')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewFilter === 'diff'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Ada Selisih ({rowsWithDiff.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewFilter('new')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          previewFilter === 'new'
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Varian Baru ({newVariantRows.length})
                      </button>
                      {errorRows.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewFilter('error')}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            previewFilter === 'error'
                              ? 'bg-rose-600 text-white'
                              : 'text-rose-400 hover:text-rose-300'
                          }`}
                        >
                          Error ({errorRows.length})
                        </button>
                      )}
                    </div>

                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        placeholder="Cari pratinjau..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* PREVIEW TABLE */}
                  <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
                    <div className="overflow-x-auto max-h-[300px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-900/90 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">No</th>
                            <th className="py-2.5 px-3">Warna Kaos</th>
                            <th className="py-2.5 px-3 text-center">Ukuran</th>
                            <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                            <th className="py-2.5 px-3 text-right">Data File</th>
                            <th className="py-2.5 px-3 text-center">Selisih</th>
                            <th className="py-2.5 px-3 text-right">Stok Akhir</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {filteredPreview.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                                Tidak ada data yang sesuai filter pratinjau.
                              </td>
                            </tr>
                          ) : (
                            filteredPreview.map((row, idx) => {
                              return (
                                <tr
                                  key={idx}
                                  className={`hover:bg-slate-900/50 transition-colors ${
                                    !row.isValid ? 'bg-rose-950/20' : ''
                                  }`}
                                >
                                  <td className="py-2 px-3 text-slate-500 text-[11px]">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3 font-sans font-medium text-white flex items-center gap-2">
                                    <span
                                      className={`w-3.5 h-3.5 rounded-full border shadow-inner shrink-0 ${getColorDotClass(
                                        row.color
                                      )}`}
                                    ></span>
                                    <span>{row.color}</span>
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold text-slate-200">
                                    {row.size}
                                  </td>
                                  <td className="py-2 px-3 text-right text-slate-400">
                                    {row.isExisting ? `${row.existingStock} Pcs` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-white">
                                    {row.importedQty} Pcs
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {row.diff > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[10px] font-bold">
                                        <ArrowUpRight className="w-3 h-3" />+{row.diff}
                                      </span>
                                    ) : row.diff < 0 ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-800/60 text-[10px] font-bold">
                                        <ArrowDownRight className="w-3 h-3" />
                                        {row.diff}
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 text-[10px] font-bold">
                                        0 (Sama)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-bold text-emerald-400">
                                    {row.newStock} Pcs
                                  </td>
                                  <td className="py-2 px-3 text-center font-sans">
                                    {!row.isValid ? (
                                      <span
                                        title={row.errorReason}
                                        className="inline-block px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 text-[10px] font-semibold border border-rose-800"
                                      >
                                        Error
                                      </span>
                                    ) : !row.isExisting ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] font-semibold border border-indigo-800">
                                        Varian Baru
                                      </span>
                                    ) : row.diff !== 0 ? (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 text-[10px] font-semibold border border-blue-800">
                                        Update Stok
                                      </span>
                                    ) : (
                                      <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                        Cocok
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 3. Modal Footer */}
        {!importSuccessResult && (
          <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-400 hidden sm:block">
              {parsedRows.length > 0
                ? `${validRows.length} baris siap disesuaikan ke stok sistem.`
                : 'Pilih atau seret berkas untuk memulai pratinjau.'}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>

              {parsedRows.length > 0 && (
                <button
                  type="button"
                  disabled={validRows.length === 0}
                  onClick={handleExecuteImport}
                  className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg ${
                    validRows.length > 0
                      ? 'bg-[#00871f] hover:bg-emerald-700 text-white shadow-emerald-950 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Terapkan Penyesuaian ({validRows.length} Item)</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
