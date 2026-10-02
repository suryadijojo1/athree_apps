import React, { useState, useEffect } from 'react';
import {
  Flame,
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
  Layers,
  HardDrive
} from 'lucide-react';
import {
  testConnection,
  fetchAllDataFromFirestore,
  syncAllLocalDataToFirestore,
  saveCloudBackupSnapshot,
  fetchCloudBackupSnapshots,
  getCloudBackupSnapshotById,
  CloudBackupSnapshotMeta
} from '../services/firebase';
import {
  saveServerBackupSnapshot,
  fetchServerBackups,
  restoreServerBackup,
  fetchServerDatabase
} from '../services/cloudSqlSync';
import { Product, Transaction, CashFlowRecord, CashierShift, KaosStockItem, Customer, User, StockMovement } from '../types';

interface DatabaseSyncModalProps {
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
  onNavigateToDrive?: () => void;
}

export const CloudSqlSyncModal: React.FC<DatabaseSyncModalProps> = ({
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
  onApplyDatabasePayload,
  onNavigateToDrive
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'firestore' | 'sql' | 'drive'>('firestore');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [firestoreBackups, setFirestoreBackups] = useState<CloudBackupSnapshotMeta[]>([]);
  const [sqlBackups, setSqlBackups] = useState<any[]>([]);

  // Load initial health check and backups on open
  useEffect(() => {
    if (isOpen) {
      testConnection().then(setFirestoreConnected);
      fetchCloudBackupSnapshots().then(setFirestoreBackups).catch(() => {});
      fetchServerBackups().then((b) => {
        if (b && Array.isArray(b)) setSqlBackups(b);
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Force Push All Local Data to Firestore (Primary Database)
  const handlePushAllToFirestore = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang menyinkronkan seluruh database lokal ke Firebase Firestore...' });

    try {
      const res = await syncAllLocalDataToFirestore({
        products,
        transactions,
        cashFlowRecords,
        shiftHistory: shifts,
        currentShift,
        kaosStocks,
        customers,
        users,
        stockMovements
      });

      setStatusMessage({
        text: `Berhasil! Seluruh data disinkronkan ke Firebase Firestore (${res.transactionsCount} transaksi, ${res.productsCount} produk, ${res.cashFlowCount} kas). Real-Time Sync aktif.`
      });
      onManualSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ text: `Terjadi kesalahan saat sync Firestore: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Force Pull All Data from Firestore (Primary Database)
  const handlePullFromFirestore = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang memuat data master dari Firebase Firestore...' });

    try {
      const data = await fetchAllDataFromFirestore();
      if (data && onApplyDatabasePayload) {
        onApplyDatabasePayload({
          products: data.products,
          transactions: data.transactions,
          cashFlowRecords: data.cashFlowRecords,
          shiftHistory: data.shifts,
          currentShift: data.activeShift || currentShift,
          kaosStocks: data.kaosStocks,
          customers: data.customers,
          users: data.users,
          stockMovements: data.stockMovements,
          salesList: salesList || [],
          isRealData: true
        });
        setStatusMessage({
          text: `Data Firestore berhasil dimuat: ${data.transactions?.length || 0} transaksi, ${data.products?.length || 0} produk.`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Data dari Firestore kosong atau belum ada.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memuat dari Firestore: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Create Firestore 14-Day Rolling Backup
  const handleCreateFirestoreBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Membuat snapshot cadangan di Firebase Firestore (retensi 14 hari)...' });

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

      const backupId = await saveCloudBackupSnapshot(payload, 'Manual Firestore Snapshot', 'modal-firestore');
      setStatusMessage({ text: `Snapshot Firestore 14-hari berhasil disimpan (${backupId})!` });
      const fresh = await fetchCloudBackupSnapshots();
      setFirestoreBackups(fresh);
    } catch (err: any) {
      setStatusMessage({ text: `Gagal membuat snapshot Firestore: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Restore from Firestore Backup
  const handleRestoreFirestoreBackup = async (backupId: string) => {
    if (!confirm('Apakah Anda yakin ingin memulihkan database dari snapshot Firestore ini?')) return;
    setIsProcessing(true);
    setStatusMessage({ text: 'Mengambil snapshot cadangan dari Firestore...' });

    try {
      const snapshotPayload = await getCloudBackupSnapshotById(backupId);
      if (snapshotPayload && onApplyDatabasePayload) {
        onApplyDatabasePayload(snapshotPayload);
        setStatusMessage({
          text: `Database berhasil dipulihkan dari snapshot Firestore (${snapshotPayload.transactions?.length || 0} transaksi)!`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Snapshot Firestore tidak ditemukan atau format tidak sesuai.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memulihkan snapshot: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Create Manual Backup in Database SQL (Manual Backup Engine)
  const handleCreateSqlBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Menyimpan snapshot cadangan manual ke Database SQL (retensi 14 hari)...' });

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

      const success = await saveServerBackupSnapshot(payload, 'Manual SQL Snapshot', 'modal-sql');
      if (success) {
        setStatusMessage({ text: 'Cadangan manual ke Database SQL berhasil disimpan!' });
        const fresh = await fetchServerBackups();
        if (fresh && Array.isArray(fresh)) setSqlBackups(fresh);
      } else {
        setStatusMessage({ text: 'Gagal membuat cadangan manual SQL. Cek koneksi server.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal cadangan SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. Restore from SQL Backup
  const handleRestoreSqlBackup = async (backupId: string) => {
    if (!confirm('Apakah Anda yakin ingin memulihkan database dari snapshot SQL ini?')) return;
    setIsProcessing(true);
    setStatusMessage({ text: 'Mengambil snapshot cadangan dari Database SQL...' });

    try {
      const success = await restoreServerBackup(backupId);
      if (success) {
        const fresh = await fetchServerDatabase();
        if (fresh?.data && onApplyDatabasePayload) {
          onApplyDatabasePayload(fresh.data);
        }
        setStatusMessage({
          text: `Database berhasil dipulihkan dari cadangan SQL!`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Snapshot SQL tidak ditemukan atau gagal dipulihkan.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memulihkan snapshot SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateStr?: string | number) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-inner">
              <Flame className="w-6 h-6 fill-amber-400 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Sinkronisasi & Cadangan Database
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  <Zap className="w-3 h-3 fill-amber-300" />
                  Real-time
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 font-medium">
                Database Utama: <span className="text-white font-bold">Firebase Firestore</span> • Cadangan Manual: <span className="text-slate-300">SQL & Google Drive</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('firestore')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'firestore'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>Firebase Firestore (Utama)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'sql'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Database SQL (Manual)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-slate-200 text-slate-700 font-semibold">
              {sqlBackups.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 ${
              activeTab === 'drive'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>Google Drive (Manual)</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status / Alert Banner */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-start justify-between gap-3 text-xs font-medium animate-in fade-in slide-in-from-top-1 ${
                statusMessage.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {statusMessage.isError ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
              <button
                onClick={() => setStatusMessage(null)}
                className="text-slate-500 hover:text-slate-700 font-bold ml-2 shrink-0 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* TAB 1: FIREBASE FIRESTORE (DATABASE UTAMA REAL-TIME) */}
          {activeTab === 'firestore' && (
            <div className="space-y-5">
              {/* Primary Active Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white border border-emerald-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                      <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                      DATABASE UTAMA AKTIF
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {firestoreConnected ? 'Terhubung (Real-Time)' : 'Connecting...'}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    Firebase Firestore (Cloud)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Sinkronisasi otomatis dua arah secara real-time (&lt;50ms) menggunakan listener onSnapshot langsung ke cloud database.
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-emerald-800 font-semibold bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-200/60">
                    <Activity className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                    <span>Sinkronisasi Otomatis Setiap Transaksi & Perubahan Data</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      STATUS CADANGAN MANUAL
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                      Tersedia Manual
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    SQL & Google Drive
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Database SQL dan Google Drive disiapkan khusus untuk cadangan manual (manual backup & restore) tanpa membebani performa kasir.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Retensi Cadangan: 14 Hari Rolling Snapshot</span>
                  </div>
                </div>
              </div>

              {/* Real-time Integrated Database Stats */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    STATISTIK DATA AKTIF TERINTEGRASI
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Auto-Sync Real-Time
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Total Transaksi</span>
                    <span className="text-lg font-bold text-slate-800">{transactions?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Katalog Produk</span>
                    <span className="text-lg font-bold text-slate-800">{products?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Stok Kaos Polos</span>
                    <span className="text-lg font-bold text-slate-800">{kaosStocks?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Pelanggan</span>
                    <span className="text-lg font-bold text-slate-800">{customers?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Firestore Primary Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  AKSI DATABASE UTAMA FIRESTORE
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handlePushAllToFirestore}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <UploadCloud className="w-6 h-6 mb-1 text-emerald-100 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Sinkronkan ke Firestore</span>
                    <span className="text-[10px] text-emerald-200 font-normal mt-0.5">
                      Upload seluruh data lokal ke cloud
                    </span>
                  </button>

                  <button
                    onClick={handlePullFromFirestore}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold transition-all disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <DownloadCloud className="w-6 h-6 mb-1 text-slate-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Muat dari Firestore</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Ambil master data terbaru cloud
                    </span>
                  </button>

                  <button
                    onClick={handleCreateFirestoreBackup}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold transition-all disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <ShieldCheck className="w-6 h-6 mb-1 text-amber-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Snapshot Cadangan (14 Hari)</span>
                    <span className="text-[10px] text-amber-700 font-normal mt-0.5">
                      Simpan checkpoint ke Firestore
                    </span>
                  </button>
                </div>
              </div>

              {/* Firestore Snapshots List */}
              {firestoreBackups.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-600" />
                      DAFTAR SNAPSHOT FIRESTORE (RETENSI 14 HARI)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {firestoreBackups.length} Snapshot
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {firestoreBackups.slice(0, 5).map((snap) => (
                      <div
                        key={snap.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{snap.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Dibuat: {formatDate(snap.createdAt)} • Oleh: {snap.savedBy}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestoreFirestoreBackup(snap.id)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Pulihkan
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DATABASE SQL (CADANGAN MANUAL) */}
          {activeTab === 'sql' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-blue-600" />
                    DATABASE SQL: CADANGAN MANUAL
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                    Cadangan Manual Server
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  Cloud SQL (PostgreSQL) / Server Persistent Storage
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Database SQL berfungsi sebagai mesin cadangan manual untuk menyimpan snapshot lengkap sistem secara berkala ke database SQL / storage server.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleCreateSqlBackup}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4" />
                    Simpan Cadangan ke SQL Sekarang
                  </button>
                </div>
              </div>

              {/* SQL Rolling Backups List */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-blue-600" />
                    SNAPSHOT CADANGAN MANUAL DATABASE SQL (14 HARI)
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {sqlBackups.length} Snapshot
                  </span>
                </div>

                {sqlBackups.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    Belum ada snapshot cadangan SQL tersimpan. Klik tombol &quot;Simpan Cadangan ke SQL Sekarang&quot; untuk membuat snapshot baru.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {sqlBackups.map((snap) => (
                      <div
                        key={snap.id}
                        className="bg-slate-50 hover:bg-slate-100/80 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{snap.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Waktu: {formatDate(snap.createdAt)} • Oleh: {snap.savedBy || 'Kasir'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRestoreSqlBackup(snap.id)}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Pulihkan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE DRIVE (CADANGAN MANUAL) */}
          {activeTab === 'drive' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
                  <HardDrive className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">
                    Google Drive Backup (Cadangan Manual Cloud)
                  </h4>
                  <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
                    Anda dapat mencadangkan seluruh data transaksi, produk, kaos, dan laporan kasir secara mandiri ke Google Drive pribadi Anda untuk arsip aman permanen.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (onNavigateToDrive) onNavigateToDrive();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-2 shadow-md hover:shadow-lg"
                  >
                    <HardDrive className="w-4 h-4" />
                    Buka Panel Cadangan Google Drive
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Database Utama: <strong>Firebase Firestore (Real-Time)</strong></span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
