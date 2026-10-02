import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  Send,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  X,
  Layers,
  HelpCircle,
  Eye,
  SlidersHorizontal,
  FileText
} from 'lucide-react';
import type { Product, Transaction, CashFlowRecord } from '../types';
import {
  analyzeIncomingPayload,
  BatchAnalysisReport,
  AnalysisItemResult
} from '../utils/dataAnalysisEngine';
import {
  executeCloudSqlUpsert,
  getLiveSyncStatus,
  CLIENT_ID
} from '../services/serverSync';
import { formatCurrency } from '../utils/exportUtils';

interface DataSyncInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  onTriggerLiveSyncNotification?: (message: string) => void;
}

export const DataSyncInspectorModal: React.FC<DataSyncInspectorModalProps> = ({
  isOpen,
  onClose,
  products,
  transactions,
  cashFlowRecords,
  onTriggerLiveSyncNotification
}) => {
  const [activeTab, setActiveTab] = useState<'analysis' | 'conflicts' | 'sql' | 'livesync'>('analysis');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);

  // Custom simulation input or live system data toggle
  const [dataSourceMode, setDataSourceMode] = useState<'live_system' | 'custom_simulation'>('live_system');
  const [customJsonInput, setCustomJsonInput] = useState<string>('');
  const [selectedFilterOp, setSelectedFilterOp] = useState<'ALL' | 'INSERT' | 'UPDATE' | 'CONFLICT' | 'NO_CHANGE'>('ALL');

  // Default custom sample showing both new insert and conflict (same invoice no with stock difference)
  const defaultSampleJson = useMemo(() => {
    return JSON.stringify(
      {
        products: [
          {
            id: products[0]?.id || 'prod_sample_1',
            name: products[0]?.name || 'Kaos Polos Cotton Combed 30s',
            sku: products[0]?.sku || 'TSHIRT-BLK-L',
            category: 'Kaos Polos',
            price: 55000,
            costPrice: 38000,
            stock: (products[0]?.stock || 20) + 15, // Differs to trigger UPDATE/CONFLICT
            unit: 'Pcs'
          },
          {
            id: `prod_new_${Date.now()}`,
            name: 'Polo Shirt Bordir Custom (Baru)',
            sku: `POLO-EMB-${Math.floor(100 + Math.random() * 900)}`,
            category: 'Kemeja & Polo',
            price: 85000,
            costPrice: 55000,
            stock: 30,
            unit: 'Pcs'
          }
        ],
        transactions: [
          {
            id: transactions[0]?.id || 'tx_sample_1',
            invoiceNo: transactions[0]?.invoiceNo || '#ORD/20261001/0001',
            date: new Date().toISOString().slice(0, 10),
            time: '14:30',
            customer: { name: 'Budi Santoso', phone: '08123456789' },
            items: [
              {
                name: products[0]?.name || 'Kaos Polos Cotton Combed 30s',
                quantity: 999, // Unusually high quantity to trigger conflict recommendation
                price: 55000,
                subtotal: 55000 * 999
              }
            ],
            total: 55000 * 999,
            status: 'Belum Lunas',
            paymentMethod: 'Transfer'
          },
          {
            id: `tx_new_${Date.now()}`,
            invoiceNo: `#ORD/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}/${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toISOString().slice(0, 10),
            time: '15:00',
            customer: { name: 'PT Sinar Maju Tekstil', phone: '08198765432' },
            items: [
              {
                name: 'Sablon DTF Lusinan',
                quantity: 12,
                price: 45000,
                subtotal: 540000
              }
            ],
            total: 540000,
            paidAmount: 540000,
            changeAmount: 0,
            status: 'Selesai',
            paymentMethod: 'Tunai'
          }
        ]
      },
      null,
      2
    );
  }, [products, transactions]);

  useEffect(() => {
    if (!customJsonInput) {
      setCustomJsonInput(defaultSampleJson);
    }
  }, [defaultSampleJson, customJsonInput]);

  // Periodic poll of live sync status
  useEffect(() => {
    if (!isOpen) return;
    const fetchStatus = async () => {
      const res = await getLiveSyncStatus();
      if (res) setSyncStatus(res);
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Compute Analysis Report
  const analysisReport: BatchAnalysisReport = useMemo(() => {
    if (dataSourceMode === 'live_system') {
      return analyzeIncomingPayload(
        { products, transactions, cashFlowRecords },
        { products, transactions, cashFlowRecords }
      );
    } else {
      try {
        const parsed = JSON.parse(customJsonInput || '{}');
        return analyzeIncomingPayload(parsed, { products, transactions, cashFlowRecords });
      } catch {
        return {
          timestamp: new Date().toISOString(),
          totalRecords: 0,
          insertCount: 0,
          updateCount: 0,
          noChangeCount: 0,
          conflictCount: 0,
          invalidCount: 1,
          items: [],
          combinedSql: '-- Syntax JSON tidak valid. Silakan periksa tanda kurung atau koma.',
          cleanStructuredPayload: { products: [], transactions: [], cashFlowRecords: [] }
        };
      }
    }
  }, [dataSourceMode, customJsonInput, products, transactions, cashFlowRecords]);

  // Filtered items based on user selection
  const filteredItems = useMemo(() => {
    if (selectedFilterOp === 'ALL') return analysisReport.items;
    return analysisReport.items.filter((item) => item.operation === selectedFilterOp);
  }, [analysisReport.items, selectedFilterOp]);

  // Extract all conflicts
  const conflictItems = useMemo(() => {
    return analysisReport.items.filter((item) => item.conflicts && item.conflicts.length > 0);
  }, [analysisReport.items]);

  const handleExecuteUpsert = async () => {
    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const payloadToExecute =
        dataSourceMode === 'live_system'
          ? { products, transactions, cashFlowRecords }
          : JSON.parse(customJsonInput || '{}');

      const result = await executeCloudSqlUpsert(payloadToExecute);
      setExecutionResult(result);
      if (onTriggerLiveSyncNotification) {
        onTriggerLiveSyncNotification('Data berhasil dieksekusi & disinkronkan secara live ke Cloud SQL dan seluruh browser!');
      }
    } catch (err: any) {
      setExecutionResult({ success: false, error: err.message });
    } finally {
      setIsExecuting(false);
    }
  };

  const copyToClipboard = (text: string, isSql: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSql) {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5 select-none animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Header Bar */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00871f] text-white rounded-xl shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base tracking-tight">
                  Pusat Analisis Data, Cloud SQL &amp; Live Sync
                </h3>
                <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                  Live Real-Time
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Klasifikasi Insert/Update, Validasi Format #ORD/xxxx &amp; Stok, Query Upsert, Conflict Resolution &amp; Sinkronisasi Antar-Browser
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 text-xs">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">
                Browser Terhubung: <strong className="text-white">{syncStatus?.connectedBrowsers ?? 1}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-5 pt-2.5 border-b border-slate-200 flex items-center justify-between shrink-0 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'analysis'
                  ? 'bg-white text-[#00871f] border-t-2 border-[#00871f] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>1. Analisis &amp; Validasi Data</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                {analysisReport.totalRecords}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('conflicts')}
              className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'conflicts'
                  ? 'bg-white text-rose-600 border-t-2 border-rose-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>2. Resolusi Konflik</span>
              {conflictItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                  {conflictItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'sql'
                  ? 'bg-white text-blue-600 border-t-2 border-blue-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>3. Query SQL (Upsert) &amp; JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('livesync')}
              className={`px-3.5 py-2 font-bold rounded-t-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'livesync'
                  ? 'bg-white text-emerald-600 border-t-2 border-emerald-500 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-500" />
              <span>4. Live Multi-Browser Sync</span>
            </button>
          </div>

          {/* Mode Switcher: Live System Data vs Custom Simulation */}
          <div className="flex items-center gap-2 pb-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Sumber Data:</span>
            <div className="bg-slate-200/80 p-0.5 rounded-lg flex items-center gap-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setDataSourceMode('live_system')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  dataSourceMode === 'live_system' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Data Master Sistem
              </button>
              <button
                type="button"
                onClick={() => setDataSourceMode('custom_simulation')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  dataSourceMode === 'custom_simulation' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                }`}
              >
                Uji Simulasi / JSON
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Custom JSON Simulation Editor Bar */}
          {dataSourceMode === 'custom_simulation' && (
            <div className="bg-slate-900 text-slate-200 p-4 rounded-xl space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  Editor Simulasi Data Masuk (JSON Payload)
                </span>
                <span className="text-[10.5px] text-slate-400">
                  Uji coba validasi format (#ORD/xxxx, stok negatif/angka) &amp; deteksi konflik
                </span>
              </div>
              <textarea
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                rows={6}
                className="w-full font-mono text-xs bg-slate-950 text-emerald-300 p-3 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
                placeholder="Masukkan payload JSON..."
              />
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-emerald-800 block">1. Data Baru (Insert)</span>
              <span className="text-xl font-black text-[#00871f] font-mono">{analysisReport.insertCount}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Belum terdaftar di Cloud SQL</span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-blue-800 block">2. Pembaruan (Upsert)</span>
              <span className="text-xl font-black text-blue-700 font-mono">{analysisReport.updateCount}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Perubahan stok/harga/status</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-slate-700 block">3. Data Identik</span>
              <span className="text-xl font-black text-slate-700 font-mono">{analysisReport.noChangeCount}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Sama persis dengan database</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-rose-800 block">4. Konflik Terdeteksi</span>
              <span className="text-xl font-black text-rose-600 font-mono">{analysisReport.conflictCount}</span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Selisih stok/nomor invoice</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <span className="text-[11px] font-semibold text-amber-800 block">5. Validitas Format</span>
              <span className="text-xl font-black text-amber-700 font-mono">
                {analysisReport.invalidCount === 0 ? '100% Valid' : `${analysisReport.invalidCount} Peringatan`}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Format #ORD/xxxx &amp; stok</span>
            </div>
          </div>

          {/* =========================================================================
              TAB 1: ANALISIS & VALIDASI DATA
          ========================================================================= */}
          {activeTab === 'analysis' && (
            <div className="space-y-3">
              {/* Filter Pills */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs flex-wrap">
                  <span className="text-slate-500 font-medium">Filter Kategori:</span>
                  {(['ALL', 'INSERT', 'UPDATE', 'CONFLICT', 'NO_CHANGE'] as const).map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setSelectedFilterOp(op)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        selectedFilterOp === op
                          ? 'bg-[#00871f] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {op === 'ALL' && 'Semua Data'}
                      {op === 'INSERT' && `Insert (${analysisReport.insertCount})`}
                      {op === 'UPDATE' && `Update (${analysisReport.updateCount})`}
                      {op === 'CONFLICT' && `Konflik (${analysisReport.conflictCount})`}
                      {op === 'NO_CHANGE' && `Identik (${analysisReport.noChangeCount})`}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan {filteredItems.length} dari {analysisReport.totalRecords} entri
                </div>
              </div>

              {/* Items List Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tipe &amp; Identifier</th>
                      <th className="py-2.5 px-3">Kategori Operasi</th>
                      <th className="py-2.5 px-3">Validasi Format (#ORD/Stok/Nama)</th>
                      <th className="py-2.5 px-3">Hasil Analisis &amp; Keterangan</th>
                      <th className="py-2.5 px-3 text-right">Preview Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Tidak ada data yang sesuai dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                  item.entityType === 'transaction'
                                    ? 'bg-purple-100 text-purple-800'
                                    : item.entityType === 'product'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.entityType === 'transaction' ? 'Order/Invoice' : item.entityType === 'product' ? 'Produk' : 'Buku Kas'}
                              </span>
                              <span className="font-mono font-bold text-slate-900">{item.identifier}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                item.operation === 'INSERT'
                                  ? 'bg-emerald-100 text-[#00871f] border border-emerald-300'
                                  : item.operation === 'UPDATE'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : item.operation === 'CONFLICT'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {item.operation === 'INSERT' && <CheckCircle2 className="w-3 h-3" />}
                              {item.operation === 'UPDATE' && <RefreshCw className="w-3 h-3" />}
                              {item.operation === 'CONFLICT' && <AlertTriangle className="w-3 h-3" />}
                              {item.operation === 'INSERT' ? 'INSERT (Baru)' : item.operation === 'UPDATE' ? 'UPDATE (Upsert)' : item.operation === 'CONFLICT' ? 'KONFLIK' : 'NO CHANGE'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            {item.validation.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Check className="w-3 h-3 text-[#00871f]" />
                                Format Sesuai Standar
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {item.validation.errors.map((err, eIdx) => (
                                  <span key={eIdx} className="block text-[10.5px] text-rose-700 font-medium">
                                    &bull; {err.message}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-slate-600 max-w-sm">
                            <p className="text-[11.5px] leading-relaxed">{item.summary}</p>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                            {item.entityType === 'transaction' && formatCurrency(item.cleanJson.total)}
                            {item.entityType === 'product' && `${item.cleanJson.stock} ${item.cleanJson.unit}`}
                            {item.entityType === 'cash_flow' && formatCurrency(item.cleanJson.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: RESOLUSI KONFLIK (Nomor invoice sama tapi stok berbeda, dll)
          ========================================================================= */}
          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1">
                  <h4 className="font-bold text-sm">Prinsip &amp; Rekomendasi Resolusi Konflik (Conflict Resolution)</h4>
                  <p className="leading-relaxed">
                    Sistem mendeteksi perselisihan data (misalnya: nomor invoice sama tapi stok atau total berbeda antar-browser). Sistem memberikan <strong>rekomendasi terbaik</strong> secara otomatis untuk memastikan keakuratan inventaris dan integritas data Cloud SQL.
                  </p>
                </div>
              </div>

              {conflictItems.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                  <ShieldCheck className="w-10 h-10 text-[#00871f] mx-auto" />
                  <h4 className="font-bold text-slate-800 text-sm">Tidak Ada Konflik Data</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Seluruh nomor invoice, stok barang, dan identitas transaksi sinkron sempurna dengan database Cloud SQL tanpa perselisihan.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conflictItems.map((item, idx) => (
                    <div key={idx} className="border border-rose-200 rounded-xl p-4 bg-rose-50/40 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-rose-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-rose-900 bg-white border border-rose-300 px-2 py-0.5 rounded">
                            {item.identifier}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {item.entityType === 'transaction' ? 'Konflik Nomor Order / Faktur' : 'Konflik Stok Produk'}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-600 text-white rounded-full">
                          Perlu Resolusi
                        </span>
                      </div>

                      {item.conflicts.map((conf, cIdx) => (
                        <div key={cIdx} className="bg-white rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[11px] font-bold text-slate-700 block">
                                Kasus Konflik: {conf.discrepancyDescription}
                              </span>
                              <div className="flex items-center gap-4 mt-1 text-[11.5px]">
                                <span className="text-slate-500">
                                  Nilai Database Saat Ini: <strong className="text-slate-800">{JSON.stringify(conf.existingValue)}</strong>
                                </span>
                                <span className="text-slate-500">
                                  Nilai Masuk: <strong className="text-rose-600">{JSON.stringify(conf.incomingValue)}</strong>
                                </span>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                              Strategi: {conf.recommendedStrategy}
                            </span>
                          </div>

                          {/* Recommendation Box */}
                          <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2">
                            <Sparkles className="w-4 h-4 text-[#00871f] shrink-0 mt-0.5" />
                            <div className="text-[11px] leading-relaxed">
                              <strong>Rekomendasi Penyelesaian Terbaik:</strong> {conf.recommendationExplanation}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 3: QUERY SQL (UPSERT) & CLEAN JSON
          ========================================================================= */}
          {activeTab === 'sql' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Query SQL Upsert (Cloud SQL PostgreSQL)</h4>
                  <p className="text-xs text-slate-500">
                    Query terstruktur dengan klausul <code>ON CONFLICT DO UPDATE</code> yang siap dieksekusi otomatis oleh backend.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(analysisReport.combinedSql, true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-[#00871f]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Tersalin!' : 'Salin Query SQL'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(JSON.stringify(analysisReport.cleanStructuredPayload, null, 2), false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-[#00871f]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? 'Tersalin!' : 'Salin JSON Bersih'}</span>
                  </button>
                </div>
              </div>

              {/* SQL Code Box */}
              <div className="bg-slate-950 text-slate-200 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-72 border border-slate-800">
                <pre className="text-emerald-400 whitespace-pre">{analysisReport.combinedSql}</pre>
              </div>

              {/* Execution Feedback */}
              {executionResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    executionResult.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50 border-rose-300 text-rose-950'
                  }`}
                >
                  {executionResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00871f] shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">
                      {executionResult.success
                        ? 'Eksekusi Upsert Berhasil & Data Tersinkronisasi Live!'
                        : 'Eksekusi Mengalami Kendala'}
                    </span>
                    <span className="text-[11px] block mt-0.5">
                      {executionResult.success
                        ? `Query Cloud SQL diproses dan perubahan telah disiarkan secara real-time ke ${executionResult.liveSync?.connectedBrowsers || 1} browser aktif.`
                        : executionResult.error}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 4: LIVE MULTI-BROWSER SYNCHRONIZATION MONITOR
          ========================================================================= */}
          {activeTab === 'livesync' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#00871f] animate-pulse" />
                  <h4 className="font-bold text-slate-800 text-sm">
                    Mekanisme Sinkronisasi Otomatis Real Live (Multi-Browser)
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Ketika Anda membuka aplikasi di browser lain (Chrome, Edge, Safari, Tablet kasir, atau smartphone), sistem menggunakan <strong>Server-Sent Events (SSE)</strong>, <strong>BroadcastChannel</strong>, dan <strong>Cloud SQL Master Sync</strong> sehingga penambahan transaksi, perubahan stok, atau revisi invoice langsung tampil di layar browser lain secara instan tanpa perlu reload.
                </p>
              </div>

              {/* Live Connection Diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Browser Client ID</span>
                  <span className="text-xs font-mono font-bold text-slate-800 block truncate">{CLIENT_ID}</span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    Klien Aktif
                  </span>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Browser Terkoneksi</span>
                  <span className="text-lg font-bold text-slate-800 font-mono">
                    {syncStatus?.connectedBrowsers ?? 1} Perangkat
                  </span>
                  <span className="text-[10px] text-slate-500 block">Saling bertukar data secara live</span>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold block uppercase">Cloud SQL Status</span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {syncStatus?.cloudSql?.host || 'Terhubung'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">Database: {syncStatus?.cloudSql?.database || 'PostgreSQL'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Real-time Live Sync aktif antar seluruh sesi browser</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleExecuteUpsert}
              disabled={isExecuting}
              className="px-4 py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>{isExecuting ? 'Mengeksekusi ke Cloud SQL...' : 'Eksekusi Otomatis ke Cloud SQL &amp; Sync'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
