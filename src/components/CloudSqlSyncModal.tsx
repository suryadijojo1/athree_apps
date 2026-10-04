import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Activity,
  Layers,
  HardDrive,
  FileUp,
  FileText,
  FolderArchive,
  Play,
  Table,
  Terminal,
  RefreshCw,
  Flame,
  Trash2
} from 'lucide-react';
import {
  saveServerBackupSnapshot,
  fetchServerBackups,
  restoreServerBackup,
  fetchServerDatabase,
  saveServerDatabase,
  checkCloudSqlStatus,
  CloudSqlStatus,
  buildApiUrl,
  diagnoseCloudSqlService
} from '../services/cloudSqlSync';
import { deleteServerBackup, deleteAllServerBackups } from '../services/serverSync';
import { deleteCloudBackupSnapshot } from '../services/firebase';
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
  initialTab?: 'sql' | 'snapshots' | 'query' | 'local' | 'drive' | 'firestore';
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
  onNavigateToDrive,
  initialTab = 'sql'
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'sql' | 'snapshots' | 'query' | 'local' | 'drive' | 'firestore'>(initialTab);
  const [sqlBackups, setSqlBackups] = useState<any[]>([]);
  const [cloudSqlStats, setCloudSqlStats] = useState<CloudSqlStatus | null>(null);
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<string | null>(null);
  const [snapshotFilter, setSnapshotFilter] = useState<string>('');

  // SQL Query Console States
  const [queryInput, setQueryInput] = useState<string>('SELECT id, name, sku, category, price, stock FROM products LIMIT 10;');
  const [queryResult, setQueryResult] = useState<any | null>(null);
  const [queryRunning, setQueryRunning] = useState<boolean>(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [tablesList, setTablesList] = useState<Array<{ name: string; count: number }>>([]);

  // Local File Upload & Restore States
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [parsedLocalBackup, setParsedLocalBackup] = useState<any | null>(null);
  const [fileValidationMessage, setFileValidationMessage] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadInitialData = async () => {
    try {
      const stats = await checkCloudSqlStatus();
      setCloudSqlStats(stats);
      const b = await fetchServerBackups();
      if (b && Array.isArray(b)) setSqlBackups(b);
      const tablesRes = await fetch(buildApiUrl('/api/cloudsql/tables'));
      if (tablesRes.ok) {
        const tData = await tablesRes.json();
        if (tData.tables) setTablesList(tData.tables);
      }
    } catch (err) {
      console.warn('Error loading initial Cloud SQL state:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      loadInitialData();
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // 1. Force Push All Local Data to Cloud SQL Central Database
  const handlePushAllToCloudSql = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang menyinkronkan seluruh database ke Cloud SQL (PostgreSQL)...' });

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

      const res = await saveServerDatabase(payload, {
        savedBy: 'Manual Cloud SQL Sync',
        source: 'modal-cloudsql'
      });

      if (res.success) {
        setStatusMessage({
          text: `Berhasil! Seluruh data disinkronkan ke Cloud SQL (${transactions.length} transaksi, ${products.length} produk). Real-Time SSE aktif.`
        });
        onManualSyncSuccess();
        loadInitialData();
      } else {
        setStatusMessage({ text: `Gagal sinkron Cloud SQL: ${res.error || 'Server error'}`, isError: true });
        diagnoseCloudSqlService().catch(() => {});
      }
    } catch (err: any) {
      setStatusMessage({ text: `Terjadi kesalahan saat sync Cloud SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Force Pull All Data from Cloud SQL Central Database
  const handlePullFromCloudSql = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang memuat data master dari Cloud SQL...' });

    try {
      const res = await fetchServerDatabase();
      if (res.success && res.data && onApplyDatabasePayload) {
        onApplyDatabasePayload(res.data);
        setStatusMessage({
          text: `Data Cloud SQL berhasil dimuat: ${res.data.transactions?.length || 0} transaksi, ${res.data.products?.length || 0} produk.`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Data dari Cloud SQL belum tersedia atau kosong.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memuat dari Cloud SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Create Cloud SQL 14-Day Rolling Backup
  const handleCreateSqlBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Menyimpan snapshot cadangan manual ke Cloud SQL (retensi 14 hari)...' });

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

      const success = await saveServerBackupSnapshot(payload, 'Manual Cloud SQL Snapshot', 'modal-sql');
      if (success) {
        setStatusMessage({ text: 'Snapshot cadangan ke Cloud SQL berhasil disimpan!' });
        const fresh = await fetchServerBackups();
        if (fresh && Array.isArray(fresh)) setSqlBackups(fresh);
      } else {
        setStatusMessage({ text: 'Gagal membuat cadangan manual Cloud SQL.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal cadangan Cloud SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Restore from SQL Backup
  const handleRestoreSqlBackup = async (backupId: string) => {
    if (!confirm('Apakah Anda yakin ingin memulihkan database dari snapshot Cloud SQL ini?')) return;
    setIsProcessing(true);
    setStatusMessage({ text: 'Mengambil snapshot cadangan dari Cloud SQL...' });

    try {
      const success = await restoreServerBackup(backupId);
      if (success) {
        const fresh = await fetchServerDatabase();
        if (fresh?.data && onApplyDatabasePayload) {
          onApplyDatabasePayload(fresh.data);
        }
        setStatusMessage({
          text: `Database berhasil dipulihkan dari cadangan Cloud SQL!`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({ text: 'Snapshot Cloud SQL tidak ditemukan atau gagal dipulihkan.', isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal memulihkan snapshot Cloud SQL: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4b. Delete specific snapshot from storage and UI list
  const handleDeleteSnapshot = async (backupId: string, fileName?: string) => {
    const displayName = fileName || backupId;
    if (!window.confirm(`Hapus file snapshot "${displayName}" secara permanen dari storage server?\n\nTindakan ini akan menghapus file fisik dari storage server dan menghapus rekaman dari daftar.`)) {
      return;
    }

    setDeletingSnapshotId(backupId);
    setStatusMessage({ text: `Menghapus snapshot ${displayName} dari storage server...` });

    try {
      // 1. Delete from Server Storage source (/api/database/delete-backup)
      const res = await deleteServerBackup(backupId);
      
      // 2. Also attempt cleanup from Firestore if backup exists there
      deleteCloudBackupSnapshot(backupId).catch(() => {});

      if (res.success !== false) {
        // Correctly remove the record from both UI list and state immediately
        setSqlBackups((prev) =>
          prev.filter((b) => b.id !== backupId && b.fileName !== fileName && b.fileName !== `${backupId}.json`)
        );
        setStatusMessage({
          text: `File snapshot "${displayName}" berhasil dihapus dari storage server dan daftar antarmuka.`
        });
      } else {
        setStatusMessage({
          text: `Gagal menghapus snapshot dari storage: ${res.message || 'Error server'}`,
          isError: true
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Error saat menghapus file snapshot: ${err.message}`,
        isError: true
      });
    } finally {
      setDeletingSnapshotId(null);
    }
  };

  // 4c. Delete all snapshots
  const handleDeleteAllSnapshots = async () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA file snapshot cadangan dari storage server? Tindakan ini tidak dapat dibatalkan.')) {
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ text: 'Menghapus semua file snapshot dari storage server...' });

    try {
      const count = await deleteAllServerBackups();
      setSqlBackups([]);
      setStatusMessage({
        text: `Berhasil menghapus ${count} file snapshot cadangan dari storage server.`
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Gagal menghapus semua snapshot: ${err.message}`,
        isError: true
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Execute SQL Query via Backend Endpoint
  const handleExecuteSqlQuery = async (customSql?: string) => {
    const statement = customSql || queryInput;
    if (!statement.trim()) return;
    setQueryRunning(true);
    setQueryError(null);
    try {
      const res = await fetch(buildApiUrl('/api/cloudsql/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql_statement: statement })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setQueryError(data.error || 'Eksekusi query gagal');
        setQueryResult(null);
      } else {
        setQueryResult(data);
        setQueryError(null);
      }
    } catch (err: any) {
      setQueryError(err.message || 'Gagal mengirim query ke server Cloud SQL');
      setQueryResult(null);
    } finally {
      setQueryRunning(false);
    }
  };

  // 6. Handle Local File Selection & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setFileValidationMessage('Harap pilih file cadangan dengan ekstensi .json');
      setSelectedLocalFile(null);
      setParsedLocalBackup(null);
      return;
    }

    setSelectedLocalFile(file);
    setIsParsingFile(true);
    setFileValidationMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const payload = parsed.payload || parsed.data || parsed;

        const hasProducts = Array.isArray(payload.products);
        const hasTransactions = Array.isArray(payload.transactions);
        const hasCashFlow = Array.isArray(payload.cashFlowRecords);

        if (!hasProducts && !hasTransactions && !hasCashFlow) {
          setFileValidationMessage('Format file tidak sesuai. File JSON tidak memiliki struktur database kasir.');
          setParsedLocalBackup(null);
          setIsParsingFile(false);
          return;
        }

        const normalizedPayload = {
          products: payload.products || [],
          categories: payload.categories || [],
          transactions: payload.transactions || [],
          cashFlowRecords: payload.cashFlowRecords || [],
          shifts: payload.shifts || payload.shiftHistory || [],
          currentShift: payload.currentShift || payload.activeShift || currentShift,
          kaosStocks: payload.kaosStocks || [],
          customers: payload.customers || [],
          users: payload.users || [],
          stockMovements: payload.stockMovements || [],
          salesList: payload.salesList || [],
          timestamp: parsed.timestamp || parsed.createdAt || payload.timestamp || new Date().toISOString()
        };

        setParsedLocalBackup(normalizedPayload);
        setFileValidationMessage(null);
      } catch (err: any) {
        setFileValidationMessage(`Gagal membaca file JSON: ${err.message}`);
        setParsedLocalBackup(null);
      } finally {
        setIsParsingFile(false);
      }
    };

    reader.onerror = () => {
      setFileValidationMessage('Gagal membaca isi file dari komputer/perangkat.');
      setIsParsingFile(false);
    };

    reader.readAsText(file);
  };

  // 7. Restore from Local JSON File to Cloud SQL
  const handleRestoreFromLocalFile = async () => {
    if (!parsedLocalBackup) return;

    const confirmMsg = `Konfirmasi Pemulihan Database:\n\n` +
      `File: ${selectedLocalFile?.name}\n` +
      `- ${parsedLocalBackup.transactions.length} Transaksi Penjualan\n` +
      `- ${parsedLocalBackup.products.length} Master Produk\n` +
      `- ${parsedLocalBackup.cashFlowRecords.length} Catatan Arus Kas\n` +
      `- ${parsedLocalBackup.kaosStocks.length} Stok Kaos Polos\n` +
      `- ${parsedLocalBackup.customers.length} Pelanggan\n\n` +
      `Apakah Anda yakin ingin memulihkan seluruh database dari file ini? Seluruh data kasir dan Cloud SQL akan diperbarui.`;

    if (!confirm(confirmMsg)) return;

    setIsProcessing(true);
    setStatusMessage({ text: 'Sedang memulihkan database ke sistem dan menyinkronkan ke Cloud SQL...' });

    try {
      if (onApplyDatabasePayload) {
        onApplyDatabasePayload(parsedLocalBackup);
      }

      await saveServerDatabase(parsedLocalBackup, {
        savedBy: 'Local File Upload Restore',
        source: 'local-file-upload'
      });

      saveServerBackupSnapshot(parsedLocalBackup, 'Manual File Upload Restore', 'local-file-upload').catch(() => {});

      setStatusMessage({
        text: `Berhasil memulihkan database dari file lokal "${selectedLocalFile?.name}"! Data lokal dan Cloud SQL telah diperbarui (${parsedLocalBackup.transactions.length} transaksi, ${parsedLocalBackup.products.length} produk).`
      });

      onManualSyncSuccess();
      loadInitialData();
    } catch (err: any) {
      setStatusMessage({
        text: `Gagal memulihkan database: ${err.message}`,
        isError: true
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Download Current Database as Local JSON
  const handleDownloadLocalDatabaseJson = () => {
    try {
      const fullBackupPayload = {
        meta: {
          appName: 'Athree Studio Jayapura POS',
          databaseEngine: 'Cloud SQL (PostgreSQL)',
          exportedAt: new Date().toISOString(),
          version: '1.0'
        },
        products,
        transactions,
        cashFlowRecords,
        shifts,
        currentShift,
        kaosStocks,
        customers,
        users,
        stockMovements,
        salesList
      };

      const jsonStr = JSON.stringify(fullBackupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `athree_database_backup_cloudsql_${dateStr}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        text: `File cadangan database berhasil diunduh (${transactions.length} transaksi, ${products.length} produk)!`
      });
    } catch (err: any) {
      setStatusMessage({
        text: `Gagal mengunduh file cadangan: ${err.message}`,
        isError: true
      });
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
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 px-6 py-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-inner">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Integrasi Database Cloud SQL (PostgreSQL)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <Zap className="w-3 h-3 fill-blue-300" />
                  Real-time SSE
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium">
                Database Utama: <span className="text-white font-bold">Cloud SQL (PostgreSQL)</span> • Firebase Firestore: <span className="text-rose-300 font-bold">Non-aktif</span>
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
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'sql'
                ? 'bg-white text-blue-800 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Database className="w-4 h-4 text-blue-600" />
            <span>Cloud SQL (Database Utama)</span>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'bg-white text-rose-800 border-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Kelola &amp; Hapus Snapshot</span>
            {sqlBackups.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-800 font-bold">
                {sqlBackups.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('query')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'query'
                ? 'bg-white text-blue-800 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span>Query SQL Real-Time</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-100 text-indigo-800 font-bold">
              Console
            </span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'local'
                ? 'bg-white text-blue-800 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-purple-600" />
            <span>Upload / Unduh File (.json)</span>
          </button>

          <button
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'drive'
                ? 'bg-white text-blue-800 border-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <HardDrive className="w-4 h-4 text-emerald-600" />
            <span>Google Drive (Cadangan Manual)</span>
          </button>

          <button
            onClick={() => setActiveTab('firestore')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'firestore'
                ? 'bg-white text-slate-800 border-slate-400 shadow-xs'
                : 'text-slate-400 hover:text-slate-600 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Flame className="w-4 h-4 text-slate-400" />
            <span>Status Firestore</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-100 text-rose-700 font-bold">
              Non-aktif
            </span>
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

          {/* TAB 1: CLOUD SQL (DATABASE UTAMA REAL-TIME) */}
          {activeTab === 'sql' && (
            <div className="space-y-5">
              {/* Primary Active Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 via-indigo-50/50 to-white border border-blue-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-blue-600" />
                      DATABASE UTAMA AKTIF
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Terhubung (Cloud SQL)
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    Cloud SQL (PostgreSQL Engine)
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Sinkronisasi real-time dua arah menggunakan Server-Sent Events (SSE) dan PostgreSQL pool connection untuk integritas ACID data transaksi kasir.
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-blue-800 font-semibold bg-blue-100/60 px-3 py-1.5 rounded-xl border border-blue-200/60">
                    <Activity className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                    <span>Real-Time SSE Streaming Aktif ke Seluruh Browser &amp; Tab</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      STATUS ARSIP &amp; CADANGAN
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      14 Hari Retensi
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    Rolling Backup Snapshots
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Setiap pembaruan data atau logout otomatis membuat snapshot cadangan yang dapat dipulihkan kapan saja dengan aman.
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Snapshot Tersimpan: {sqlBackups.length} snapshot</span>
                  </div>
                </div>
              </div>

              {/* Real-time Integrated Database Stats */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-600" />
                    STATISTIK TABEL CLOUD SQL
                  </h4>
                  <button
                    onClick={loadInitialData}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Tabel Transactions</span>
                    <span className="text-lg font-bold text-slate-800">{transactions?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Tabel Products</span>
                    <span className="text-lg font-bold text-slate-800">{products?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Tabel Kaos Stocks</span>
                    <span className="text-lg font-bold text-slate-800">{kaosStocks?.length || 0}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">Tabel Customers</span>
                    <span className="text-lg font-bold text-slate-800">{customers?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Cloud SQL Primary Actions */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  AKSI DATABASE CLOUD SQL
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handlePushAllToCloudSql}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <UploadCloud className="w-6 h-6 mb-1 text-blue-100 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Sinkronkan ke Cloud SQL</span>
                    <span className="text-[10px] text-blue-200 font-normal mt-0.5">
                      Upload state lokal ke server SQL
                    </span>
                  </button>

                  <button
                    onClick={handlePullFromCloudSql}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 font-bold transition-all disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <DownloadCloud className="w-6 h-6 mb-1 text-slate-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Muat dari Cloud SQL</span>
                    <span className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Ambil master data terbaru SQL
                    </span>
                  </button>

                  <button
                    onClick={handleCreateSqlBackup}
                    disabled={isProcessing}
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold transition-all disabled:opacity-50 cursor-pointer group text-center"
                  >
                    <ShieldCheck className="w-6 h-6 mb-1 text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs">Buat Snapshot SQL (14 Hari)</span>
                    <span className="text-[10px] text-indigo-700 font-normal mt-0.5">
                      Simpan checkpoint ke Cloud SQL
                    </span>
                  </button>
                </div>
              </div>

              {/* Cloud SQL Snapshots List */}
              {sqlBackups.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-blue-600" />
                      DAFTAR SNAPSHOT CLOUD SQL (RETENSI 14 HARI)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {sqlBackups.length} Snapshot
                    </span>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {sqlBackups.slice(0, 5).map((snap) => (
                      <div
                        key={snap.id}
                        className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-blue-300 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-2">
                            <span>{snap.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            Dibuat: {formatDate(snap.createdAt)} • Oleh: {snap.savedBy || 'Kasir'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreSqlBackup(snap.id)}
                            disabled={isProcessing || deletingSnapshotId === snap.id}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors cursor-pointer text-xs flex items-center gap-1 disabled:opacity-50"
                            title="Pulihkan database dari snapshot ini"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Pulihkan
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSnapshot(snap.id, snap.fileName)}
                            disabled={isProcessing || deletingSnapshotId === snap.id}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer text-xs flex items-center gap-1 disabled:opacity-50"
                            title="Hapus file snapshot ini secara permanen dari storage server"
                          >
                            {deletingSnapshotId === snap.id ? (
                              <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: KELOLA & HAPUS SNAPSHOT DATABASE */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-rose-50/60 via-white to-slate-50 border border-rose-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <span>Pusat Manajemen &amp; Hapus File Snapshot</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          {sqlBackups.length} File Snapshot
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Daftar file snapshot cadangan yang tersimpan di storage server (<code className="text-rose-700 font-mono text-[11px] bg-rose-50 px-1 py-0.5 rounded">data/backups/</code>). Admin dapat menghapus snapshot spesifik atau memulihkan database.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCreateSqlBackup}
                      disabled={isProcessing}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Buat Snapshot Baru
                    </button>
                    <button
                      type="button"
                      onClick={loadInitialData}
                      disabled={isProcessing}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-slate-300"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Segarkan
                    </button>
                    {sqlBackups.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllSnapshots}
                        disabled={isProcessing}
                        className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50"
                        title="Hapus seluruh file snapshot cadangan sekaligus dari storage server"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Hapus Semua
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter / Search Bar */}
                {sqlBackups.length > 2 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cari ID snapshot, nama kasir, atau tanggal..."
                      value={snapshotFilter}
                      onChange={(e) => setSnapshotFilter(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                    />
                    {snapshotFilter && (
                      <button
                        type="button"
                        onClick={() => setSnapshotFilter('')}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2 cursor-pointer font-medium"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}

                {/* Snapshots List View */}
                {sqlBackups.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-xl border border-dashed border-rose-200 space-y-2">
                    <History className="w-8 h-8 text-rose-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-700">Belum Ada File Snapshot di Storage Server</div>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Snapshot dibuat otomatis saat logout kasir atau saat Anda menekan tombol "Buat Snapshot Baru".
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                    {sqlBackups
                      .filter((snap) => {
                        if (!snapshotFilter.trim()) return true;
                        const q = snapshotFilter.toLowerCase();
                        return (
                          snap.id?.toLowerCase().includes(q) ||
                          snap.fileName?.toLowerCase().includes(q) ||
                          snap.savedBy?.toLowerCase().includes(q) ||
                          snap.source?.toLowerCase().includes(q)
                        );
                      })
                      .map((snap) => (
                        <div
                          key={snap.id}
                          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-rose-300 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-slate-800 text-xs truncate max-w-[280px]">
                                {snap.fileName || `${snap.id}.json`}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {snap.stats?.transactionsCount || 0} Transaksi
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {snap.stats?.productsCount || 0} Produk
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Sisa {snap.remainingDays || 14} Hari
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                              <span>Dibuat: {formatDate(snap.createdAt || snap.timestamp)}</span>
                              <span>•</span>
                              <span>Oleh: <strong className="text-slate-700 font-semibold">{snap.savedBy || 'Kasir'}</strong></span>
                              <span>•</span>
                              <span>Sumber: <span className="capitalize">{snap.source || 'Manual'}</span></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleRestoreSqlBackup(snap.id)}
                              disabled={isProcessing || deletingSnapshotId === snap.id}
                              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-all cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                              title="Pulihkan database seluruh kasir ke status snapshot ini"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Pulihkan
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(snap.id, snap.fileName)}
                              disabled={isProcessing || deletingSnapshotId === snap.id}
                              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-all cursor-pointer text-xs flex items-center gap-1.5 disabled:opacity-50"
                              title="Hapus file snapshot ini secara permanen dari storage server"
                            >
                              {deletingSnapshotId === snap.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              Hapus File
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: QUERY CONSOLE REAL-TIME */}
          {activeTab === 'query' && (
            <div className="space-y-4">
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Cloud SQL Query Console (PostgreSQL)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Real-Time DQL / Query Inspector
                  </span>
                </div>

                {/* Quick Shortcut Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 py-1">Contoh Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, name, sku, price, stock FROM products LIMIT 10;';
                      setQueryInput(q);
                      handleExecuteSqlQuery(q);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    SELECT * FROM products
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, invoice_no, total, payment_method, status FROM transactions LIMIT 10;';
                      setQueryInput(q);
                      handleExecuteSqlQuery(q);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    SELECT * FROM transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, type, amount, description, date FROM cash_flow_records LIMIT 10;';
                      setQueryInput(q);
                      handleExecuteSqlQuery(q);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    SELECT * FROM cash_flow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, name, phone, type, total_orders FROM customers LIMIT 10;';
                      setQueryInput(q);
                      handleExecuteSqlQuery(q);
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
                  >
                    SELECT * FROM customers
                  </button>
                </div>

                {/* SQL Statement Input */}
                <div className="relative">
                  <textarea
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    rows={3}
                    placeholder="Tuliskan query SQL di sini (misal: SELECT * FROM products;)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Mendukung query SELECT type-safe langsung ke tabel database Cloud SQL.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecuteSqlQuery()}
                    disabled={queryRunning}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{queryRunning ? 'Mengeksekusi...' : 'Jalankan Query'}</span>
                  </button>
                </div>
              </div>

              {/* Query Error Display */}
              {queryError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <div className="font-mono">{queryError}</div>
                </div>
              )}

              {/* Query Results Display */}
              {queryResult && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Hasil Query ({queryResult.rowCount} baris ditemukan)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Sumber: {queryResult.source || 'Cloud SQL'}
                    </span>
                  </div>

                  {queryResult.rows && queryResult.rows.length > 0 ? (
                    <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse font-mono">
                        <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                          <tr>
                            {(queryResult.fields && queryResult.fields.length > 0
                              ? queryResult.fields
                              : Object.keys(queryResult.rows[0])
                            ).map((header: string) => (
                              <th key={header} className="p-2.5 font-bold uppercase text-[10px]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {queryResult.rows.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                              {(queryResult.fields && queryResult.fields.length > 0
                                ? queryResult.fields
                                : Object.keys(queryResult.rows[0])
                              ).map((col: string) => (
                                <td key={col} className="p-2.5 text-slate-700 whitespace-nowrap">
                                  {typeof row[col] === 'object'
                                    ? JSON.stringify(row[col])
                                    : String(row[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                      Query berhasil dieksekusi, tidak ada baris data yang cocok.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FILE CADANGAN LOKAL (UPLOAD & UNDUH) */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-purple-50 via-white to-purple-50/30 border border-purple-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                    <FolderArchive className="w-4 h-4 text-purple-600" />
                    FILE CADANGAN LOKAL (.JSON)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    Upload &amp; Pulihkan
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  Upload &amp; Pulihkan Database dari File Komputer / Perangkat
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Pilih file cadangan JSON yang tersimpan di perangkat lokal Anda. Sistem akan memvalidasi struktur database, menampilkan pratinjau data, dan memulihkan seluruh data kasir serta menyinkronkannya langsung ke Cloud SQL.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                  >
                    <FileUp className="w-4 h-4" />
                    {selectedLocalFile ? 'Pilih File Lain' : 'Pilih File Cadangan Lokal (.json)'}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadLocalDatabaseJson}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 border border-slate-300 shadow-xs"
                  >
                    <DownloadCloud className="w-4 h-4 text-slate-600" />
                    Unduh Database Saat Ini (.json)
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Validation Warning / Error */}
              {fileValidationMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{fileValidationMessage}</span>
                </div>
              )}

              {/* File Loading Spinner */}
              {isParsingFile && (
                <div className="p-6 text-center text-xs text-purple-700 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  <span>Membaca dan memvalidasi file cadangan lokal...</span>
                </div>
              )}

              {/* Selected File Details & Preview Card */}
              {parsedLocalBackup && selectedLocalFile && (
                <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in zoom-in-98 duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                          <span>{selectedLocalFile.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Format Valid
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Ukuran: {(selectedLocalFile.size / 1024).toFixed(1)} KB • Tipe: JSON Backup
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLocalFile(null);
                        setParsedLocalBackup(null);
                        setFileValidationMessage(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-slate-400 hover:text-rose-600 font-semibold cursor-pointer underline self-start sm:self-auto"
                    >
                      Batalkan / Hapus Pilihan
                    </button>
                  </div>

                  {/* Statistics Grid */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                      Pratinjau Data yang Akan Dipulihkan ke Cloud SQL:
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">Transaksi</div>
                        <div className="text-lg font-black text-slate-800">
                          {parsedLocalBackup.transactions?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Data penjualan</div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">Master Produk</div>
                        <div className="text-lg font-black text-slate-800">
                          {parsedLocalBackup.products?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Katalog barang</div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">Arus Kas</div>
                        <div className="text-lg font-black text-slate-800">
                          {parsedLocalBackup.cashFlowRecords?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Pemasukan &amp; pengeluaran</div>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[11px] text-slate-500 font-medium">Stok Kaos Polos</div>
                        <div className="text-lg font-black text-slate-800">
                          {parsedLocalBackup.kaosStocks?.length || 0}
                        </div>
                        <div className="text-[10px] text-slate-400">Varian ukuran/warna</div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Details */}
                  <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-blue-950">
                      <ShieldCheck className="w-4 h-4 text-blue-700" />
                      <span>Proses Pemulihan Aman &amp; Sinkron Cloud SQL Otomatis:</span>
                    </div>
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Memulihkan file ini akan memperbarui database kasir lokal, menyetel status aktif, serta mengirimkan data ke <strong>Cloud SQL (PostgreSQL)</strong> sehingga seluruh browser/tab kasir lain akan langsung tersinkronkan secara real-time.
                    </p>
                  </div>

                  {/* Restore Button */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleRestoreFromLocalFile}
                      disabled={isProcessing}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Pulihkan Database dari File Ini Sekarang</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GOOGLE DRIVE (CADANGAN MANUAL) */}
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
                {onNavigateToDrive && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToDrive();
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
                  >
                    <HardDrive className="w-4 h-4" />
                    Buka Tab Google Drive
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: FIRESTORE STATUS (NONAKTIF) */}
          {activeTab === 'firestore' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      Integrasi Database Firebase Firestore: Dinonaktifkan
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      Sesuai instruksi konfigurasi, database telah sepenuhnya dialihkan ke Cloud SQL (PostgreSQL).
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Status Integrasi: Non-Aktif (FIRESTORE_ENABLED = false)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Sistem kini secara eksklusif menggunakan <strong>Cloud SQL (PostgreSQL)</strong> sebagai database utama untuk menyimpan dan menyinkronkan seluruh produk, transaksi, arus kas, dan kasir aktif dengan dukungan Real-Time Server-Sent Events (SSE).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Cloud SQL Real-Time Central Engine</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
