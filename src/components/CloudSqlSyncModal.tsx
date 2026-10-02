import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
  X,
  Server,
  ShieldCheck,
  History,
  RotateCcw,
  Clock,
  Sparkles,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import {
  pushToCloudSql,
  pullFromCloudSql,
  checkCloudSqlStatus,
  CloudSqlStatus,
  saveServerBackupSnapshot,
  fetchServerBackups,
  restoreServerBackup
} from '../services/cloudSqlSync';
import { Product, Transaction, CashFlowRecord, CashierShift, KaosStockItem, Customer, User, StockMovement } from '../types';

interface CloudSqlSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
  currentShift?: CashierShift;
  kaosStocks?: KaosStockItem[];
  customers?: Customer[];
  users?: User[];
  stockMovements?: StockMovement[];
  salesList?: string[];
  onManualSyncSuccess: () => void;
  onApplyDatabasePayload?: (payload: any) => void;
}

export const CloudSqlSyncModal: React.FC<CloudSqlSyncModalProps> = ({
  isOpen,
  onClose,
  products,
  transactions,
  cashFlowRecords,
  shifts,
  currentShift,
  kaosStocks,
  customers,
  users,
  stockMovements,
  salesList,
  onManualSyncSuccess,
  onApplyDatabasePayload
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  const [dbStatus, setDbStatus] = useState<CloudSqlStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'backups'>('status');

  // Load status and backups list on open
  useEffect(() => {
    if (isOpen) {
      checkCloudSqlStatus().then(setDbStatus);
      fetchServerBackups().then((b) => {
        if (b && Array.isArray(b)) setBackupsList(b);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Manual Push to Cloud SQL
  const handlePushToCloudSql = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang menyinkronkan seluruh database ke Cloud SQL...' });

    try {
      const result = await pushToCloudSql({
        products: products || [],
        transactions: transactions || [],
        cashFlowRecords: cashFlowRecords || [],
        shiftHistory: shifts || [],
        currentShift,
        kaosStocks: kaosStocks || [],
        stockMovements: stockMovements || [],
        customers: customers || [],
        users: users || [],
        salesList: salesList || [],
        isRealData: true
      }, 'Sinkronisasi Manual Cloud SQL');

      if (result.success) {
        setStatusMessage({ text: 'Berhasil! Seluruh data disinkronkan ke Cloud SQL & disiarkan secara real-time.' });
        onManualSyncSuccess();
        const updatedStatus = await checkCloudSqlStatus();
        setDbStatus(updatedStatus);
      } else {
        setStatusMessage({
          text: result.error ? `Gagal menyinkronkan: ${result.error}` : 'Gagal menyinkronkan data ke Cloud SQL. Cek koneksi server.',
          isError: true
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Terjadi kesalahan: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Pull from Cloud SQL
  const handlePullFromCloudSql = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang memuat data master dari Cloud SQL...' });

    try {
      const data = await pullFromCloudSql();
      if (data && onApplyDatabasePayload) {
        onApplyDatabasePayload(data);
        setStatusMessage({
          text: `Data Cloud SQL berhasil dimuat: ${data.transactions?.length || 0} transaksi, ${data.products?.length || 0} produk.`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Data dari Cloud SQL kosong atau belum tersimpan.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memuat dari Cloud SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // Create dedicated backup snapshot with 14-day retention
  const handleCreateBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Membuat snapshot cadangan database Cloud SQL (retensi 14 hari)...' });

    try {
      const payload = {
        products,
        transactions,
        cashFlowRecords,
        shiftHistory: shifts,
        currentShift,
        kaosStocks,
        customers,
        users,
        stockMovements,
        salesList,
        isRealData: true
      };

      const success = await saveServerBackupSnapshot(payload, 'Manual Cloud SQL Snapshot', 'modal-cloudsql');
      if (success) {
        setStatusMessage({ text: 'Snapshot cadangan Cloud SQL 14-hari berhasil disimpan!' });
        const fresh = await fetchServerBackups();
        setBackupsList(fresh);
      } else {
        setStatusMessage({ text: 'Gagal membuat snapshot cadangan.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Apakah Anda yakin ingin memulihkan database dari snapshot cadangan ini?')) return;
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang memulihkan database dari cadangan Cloud SQL...' });

    try {
      const ok = await restoreServerBackup(backupId);
      if (ok) {
        setStatusMessage({ text: 'Database Cloud SQL berhasil dipulihkan! Memperbarui tampilan...' });
        const refreshed = await pullFromCloudSql();
        if (refreshed && onApplyDatabasePayload) {
          onApplyDatabasePayload(refreshed);
        }
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Gagal memulihkan snapshot cadangan.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Error saat pemulihan: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 via-[#00871f] to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs shadow-inner border border-white/20">
              <Database className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">Cloud SQL Real-Time Sync</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-emerald-950">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  Real-time
                </span>
              </div>
              <p className="text-xs text-emerald-100/90">
                Database Utama: Cloud SQL (PostgreSQL) • Firebase Firestore: Dinonaktifkan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'status'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Status & Sinkronisasi</span>
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'backups'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Cadangan Rolling (14 Hari)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-semibold">
              {backupsList.length}
            </span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status Message Alert */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs font-medium flex items-center justify-between gap-3 border ${
                statusMessage.isError
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {statusMessage.isError ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-xs font-bold underline hover:opacity-75"
              >
                Tutup
              </button>
            </div>
          )}

          {activeTab === 'status' && (
            <>
              {/* Architecture Badges & Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Cloud SQL Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Database Aktif</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800 mt-1">Cloud SQL (PostgreSQL)</h3>
                    </div>
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                      Terhubung
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    <p className="flex justify-between">
                      <span className="text-slate-500">Real-Time Sync:</span>
                      <span className="font-semibold text-emerald-700">Aktif (SSE &lt; 50ms)</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">Klien Terhubung:</span>
                      <span className="font-semibold text-slate-700">{dbStatus?.totalTransactions ? 'Multi-Browser Aktif' : '1 Klien'}</span>
                    </p>
                  </div>
                </div>

                {/* Firebase Firestore Status Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Firebase Firestore</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-700 mt-1">Dinonaktifkan</h3>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-600">
                      Disabled
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    <p>
                      Firestore telah dinonaktifkan sesuai konfigurasi. Seluruh sinkronisasi real-time dipindahkan sepenuhnya ke Cloud SQL PostgreSQL.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Statistics in Memory & Cloud SQL */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Statistik Database Terintegrasi</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Otomatis tersimpan setiap ada transaksi / perubahan
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Total Transaksi</span>
                    <span className="text-base font-bold text-slate-800">{transactions.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Katalog Produk</span>
                    <span className="text-base font-bold text-slate-800">{products.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Stok Kaos Polos</span>
                    <span className="text-base font-bold text-slate-800">{kaosStocks?.length || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Pelanggan</span>
                    <span className="text-base font-bold text-slate-800">{customers?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Manual Synchronization Buttons */}
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Sinkronisasi Manual & Snapshot</span>
                    </h4>
                    <p className="text-xs text-slate-500">
                      Kirim segera data lokal ke Cloud SQL atau muat ulang versi master terbaru.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    onClick={handlePushToCloudSql}
                    disabled={isProcessing}
                    className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Sinkronkan ke Cloud SQL</span>
                  </button>

                  <button
                    onClick={handlePullFromCloudSql}
                    disabled={isProcessing}
                    className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    <span>Muat dari Cloud SQL</span>
                  </button>

                  <button
                    onClick={handleCreateBackup}
                    disabled={isProcessing}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
                    title="Simpan cadangan dengan retensi 14 hari"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Buat Cadangan 14 Hari</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'backups' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>Daftar Snapshot Cadangan Cloud SQL (Retensi 14 Hari)</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Setiap logout atau perubahan berkala otomatis disimpan dan dihapus aman setelah 14 hari.
                  </p>
                </div>
                <button
                  onClick={handleCreateBackup}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  + Buat Snapshot Baru
                </button>
              </div>

              {backupsList.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  <Database className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  Belum ada snapshot cadangan tersimpan. Klik "Buat Snapshot Baru" di atas.
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {backupsList.map((b) => (
                    <div
                      key={b.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {new Date(b.timestamp).toLocaleString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                            Sisa: {b.remainingDays || 14} Hari
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Sumber: <span className="font-medium text-slate-700">{b.savedBy || 'Kasir'}</span> • Transaksi: {b.stats?.transactionsCount ?? '-'} • Produk: {b.stats?.productsCount ?? '-'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRestoreBackup(b.id)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 hover:border-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Pulihkan</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Real-time SSE Sync aktif pada server</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
