import React, { useState, useEffect, useRef } from 'react';
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
  HardDrive,
  FileUp,
  FileText,
  FolderArchive,
  FileCheck2,
  Trash2,
  Trash,
  Star,
  AlertTriangle
} from 'lucide-react';
import {
  testConnection,
  fetchAllDataFromFirestore,
  syncAllLocalDataToFirestore,
  saveCloudBackupSnapshot,
  fetchCloudBackupSnapshots,
  getCloudBackupSnapshotById,
  deleteCloudBackupSnapshot,
  deleteAllCloudBackupSnapshots,
  getLatestCloudBackupSnapshot,
  CloudBackupSnapshotMeta
} from '../services/firebase';
import {
  saveServerBackupSnapshot,
  fetchServerBackups,
  restoreServerBackup,
  fetchServerDatabase,
  deleteServerBackup,
  deleteAllServerBackups,
  fetchLatestServerSnapshot
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
  initialTab?: 'firestore' | 'snapshots' | 'local' | 'sql' | 'drive';
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
  initialTab,
  onManualSyncSuccess,
  onApplyDatabasePayload,
  onNavigateToDrive
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'firestore' | 'snapshots' | 'local' | 'sql' | 'drive'>(initialTab || 'firestore');
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [firestoreBackups, setFirestoreBackups] = useState<CloudBackupSnapshotMeta[]>([]);
  const [sqlBackups, setSqlBackups] = useState<any[]>([]);

  // In-App Safe Confirmation Modal State (replaces blocked window.confirm)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Local File Upload & Restore States
  const [selectedLocalFile, setSelectedLocalFile] = useState<File | null>(null);
  const [parsedLocalBackup, setParsedLocalBackup] = useState<any | null>(null);
  const [fileValidationMessage, setFileValidationMessage] = useState<string | null>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load initial health check and backups on open
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      testConnection().then(setFirestoreConnected);
      fetchCloudBackupSnapshots().then(setFirestoreBackups).catch(() => {});
      fetchServerBackups().then((b) => {
        if (b && Array.isArray(b)) setSqlBackups(b);
      }).catch(() => {});
    }
  }, [isOpen, initialTab]);

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

  // 3. Create Firestore 3-Day Rolling Backup (Max 3 days to prevent database piling up)
  const handleCreateFirestoreBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Membuat snapshot cadangan di Firebase Firestore (retensi 3 hari maksimal)...' });

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
      setStatusMessage({ text: `Snapshot Firestore 3-hari berhasil disimpan (${backupId})!` });
      const fresh = await fetchCloudBackupSnapshots();
      setFirestoreBackups(fresh);
    } catch (err: any) {
      setStatusMessage({ text: `Gagal membuat snapshot Firestore: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Restore from Firestore Backup
  const handleRestoreFirestoreBackup = (backupId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pulihkan Database dari Snapshot Firestore?',
      message: `Apakah Anda yakin ingin memulihkan database dari snapshot Firestore "${backupId}" ini? Seluruh data kasir saat ini akan diperbarui sesuai snapshot ini.`,
      confirmLabel: 'Ya, Pulihkan Database',
      isDanger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: 'Mengambil snapshot cadangan dari Firestore...' });

        try {
          const snapshotPayload = await getCloudBackupSnapshotById(backupId);
          if (snapshotPayload && onApplyDatabasePayload) {
            onApplyDatabasePayload(snapshotPayload);
            setStatusMessage({
              text: `Database berhasil dipulihkan dari snapshot Firestore (${snapshotPayload.transactions?.length || 0} transaksi, ${snapshotPayload.products?.length || 0} produk)!`
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
      }
    });
  };

  // Sinkronisasi Snapshot Terakhir (Selalu mengambil snapshot paling mutakhir)
  const handleSyncLatestSnapshot = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Mencari snapshot database paling terakhir...' });

    try {
      const [cloudSnap, serverSnap] = await Promise.all([
        getLatestCloudBackupSnapshot().catch(() => null),
        fetchLatestServerSnapshot().catch(() => null)
      ]);

      let targetSnapshot: any = null;
      let sourceName = '';
      let snapTimestamp: number = 0;

      if (cloudSnap && serverSnap) {
        if ((cloudSnap.timestamp || 0) >= (serverSnap.timestamp || 0)) {
          targetSnapshot = cloudSnap.payload;
          sourceName = `Cloud Firestore (${cloudSnap.id})`;
          snapTimestamp = cloudSnap.timestamp;
        } else {
          targetSnapshot = serverSnap.data;
          sourceName = `Server Backup (${serverSnap.id})`;
          snapTimestamp = serverSnap.timestamp;
        }
      } else if (cloudSnap) {
        targetSnapshot = cloudSnap.payload;
        sourceName = `Cloud Firestore (${cloudSnap.id})`;
        snapTimestamp = cloudSnap.timestamp;
      } else if (serverSnap) {
        targetSnapshot = serverSnap.data;
        sourceName = `Server Backup (${serverSnap.id})`;
        snapTimestamp = serverSnap.timestamp;
      }

      if (targetSnapshot && onApplyDatabasePayload) {
        onApplyDatabasePayload(targetSnapshot);
        // Sinkronkan kembali ke koleksi live Firebase Firestore
        syncAllLocalDataToFirestore({
          products: targetSnapshot.products,
          transactions: targetSnapshot.transactions,
          cashFlowRecords: targetSnapshot.cashFlowRecords,
          shiftHistory: targetSnapshot.shiftHistory || targetSnapshot.shifts,
          currentShift: targetSnapshot.currentShift || targetSnapshot.shift || targetSnapshot.activeShift,
          kaosStocks: targetSnapshot.kaosStocks,
          customers: targetSnapshot.customers,
          users: targetSnapshot.users,
          stockMovements: targetSnapshot.stockMovements
        }).catch(() => {});

        const dateStr = snapTimestamp ? new Date(snapTimestamp).toLocaleString('id-ID') : 'Terbaru';
        setStatusMessage({
          text: `Snapshot terakhir (${sourceName} • ${dateStr}) berhasil dibuka & disinkronkan (${targetSnapshot.transactions?.length || 0} transaksi, ${targetSnapshot.products?.length || 0} produk)!`
        });
        onManualSyncSuccess();
      } else {
        setStatusMessage({
          text: 'Tidak ada snapshot database yang tersedia untuk disinkronkan.',
          isError: true
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Gagal sinkronisasi snapshot terakhir: ${err.message}`, isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  // Hapus Snapshot Firestore Tertentu (Tanpa window.confirm yang terblokir)
  const handleDeleteFirestoreBackup = (backupId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Snapshot Firestore?',
      message: `Apakah Anda yakin ingin menghapus snapshot cadangan "${backupId}" dari Cloud Firestore? File snapshot yang dihapus tidak dapat dipulihkan.`,
      confirmLabel: 'Ya, Hapus Snapshot',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: `Menghapus snapshot ${backupId} dari Cloud Firestore...` });

        try {
          const ok = await deleteCloudBackupSnapshot(backupId);
          if (ok) {
            setStatusMessage({ text: `Snapshot ${backupId} berhasil dihapus dari Cloud Firestore!` });
            setFirestoreBackups((prev) => prev.filter((b) => b.id !== backupId));
            const fresh = await fetchCloudBackupSnapshots().catch(() => []);
            if (fresh && Array.isArray(fresh)) setFirestoreBackups(fresh);
          } else {
            setStatusMessage({ text: `Gagal menghapus snapshot ${backupId}.`, isError: true });
          }
        } catch (err: any) {
          setStatusMessage({ text: `Error hapus snapshot: ${err.message}`, isError: true });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // Hapus Semua Snapshot Firestore
  const handleDeleteAllFirestoreBackups = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus SEMUA Snapshot Firestore?',
      message: 'PERINGATAN: Anda akan menghapus SELURUH daftar snapshot cadangan database di Cloud Firestore. Tindakan ini permanen.',
      confirmLabel: 'Ya, Hapus Semua Snapshot',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: 'Menghapus seluruh snapshot cadangan Cloud Firestore...' });

        try {
          const count = await deleteAllCloudBackupSnapshots();
          setStatusMessage({ text: `Seluruh (${count}) snapshot cadangan Firestore berhasil dihapus!` });
          setFirestoreBackups([]);
        } catch (err: any) {
          setStatusMessage({ text: `Error hapus semua: ${err.message}`, isError: true });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // 5. Create Manual Backup in Database SQL (Manual Backup Engine)
  const handleCreateSqlBackup = async () => {
    setIsProcessing(true);
    setStatusMessage({ text: 'Menyimpan snapshot cadangan manual ke Database SQL (retensi 3 hari maksimal)...' });

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
  const handleRestoreSqlBackup = (backupId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Pulihkan Database dari Snapshot SQL?',
      message: `Apakah Anda yakin ingin memulihkan database dari snapshot SQL "${backupId}" ini?`,
      confirmLabel: 'Ya, Pulihkan Sekarang',
      isDanger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
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
      }
    });
  };

  // Hapus Snapshot SQL Tertentu
  const handleDeleteSqlBackup = (backupId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Snapshot SQL?',
      message: `Apakah Anda yakin ingin menghapus snapshot SQL "${backupId}" ini? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus Snapshot',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: `Menghapus snapshot SQL ${backupId}...` });

        try {
          const ok = await deleteServerBackup(backupId);
          if (ok) {
            setStatusMessage({ text: `Snapshot SQL ${backupId} berhasil dihapus!` });
            setSqlBackups((prev) => prev.filter((b) => b.id !== backupId));
            const fresh = await fetchServerBackups().catch(() => []);
            if (fresh && Array.isArray(fresh)) setSqlBackups(fresh);
          } else {
            setStatusMessage({ text: `Gagal menghapus snapshot SQL ${backupId}.`, isError: true });
          }
        } catch (err: any) {
          setStatusMessage({ text: `Error: ${err.message}`, isError: true });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // Hapus Semua Snapshot SQL
  const handleDeleteAllSqlBackups = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus SEMUA Snapshot SQL?',
      message: 'PERINGATAN: Apakah Anda yakin ingin menghapus SELURUH snapshot cadangan di Database SQL? Tindakan ini permanen.',
      confirmLabel: 'Ya, Hapus Semua Snapshot SQL',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: 'Menghapus seluruh snapshot cadangan SQL...' });

        try {
          const count = await deleteAllServerBackups();
          setStatusMessage({ text: `Seluruh (${count}) snapshot cadangan SQL berhasil dihapus!` });
          setSqlBackups([]);
        } catch (err: any) {
          setStatusMessage({ text: `Error hapus semua: ${err.message}`, isError: true });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // 7. Handle Local File Selection & Validation
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

        // Normalize if nested inside payload or data
        const payload = parsed.payload || parsed.data || parsed;

        const hasProducts = Array.isArray(payload.products);
        const hasTransactions = Array.isArray(payload.transactions);
        const hasCashFlow = Array.isArray(payload.cashFlowRecords);

        if (!hasProducts && !hasTransactions && !hasCashFlow) {
          setFileValidationMessage('Format file tidak sesuai. File JSON tidak memiliki struktur database kasir (products, transactions, dll).');
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

  // 8. Restore from Local JSON File
  const handleRestoreFromLocalFile = () => {
    if (!parsedLocalBackup) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Pulihkan Database dari File Cadangan Lokal?',
      message: `File: ${selectedLocalFile?.name || 'File Lokal'}\n` +
        `• ${parsedLocalBackup.transactions.length} Transaksi Penjualan\n` +
        `• ${parsedLocalBackup.products.length} Master Produk\n` +
        `• ${parsedLocalBackup.cashFlowRecords.length} Catatan Kas\n` +
        `• ${parsedLocalBackup.kaosStocks.length} Stok Kaos Polos\n` +
        `• ${parsedLocalBackup.customers.length} Pelanggan\n\n` +
        `Apakah Anda yakin ingin memulihkan seluruh database dari file ini? Seluruh data kasir dan Firebase Firestore akan diperbarui.`,
      confirmLabel: 'Ya, Pulihkan Database',
      isDanger: false,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsProcessing(true);
        setStatusMessage({ text: 'Sedang memulihkan database ke sistem dan menyinkronkan ke Firebase Firestore...' });

        try {
          // A. Update local React states
          if (onApplyDatabasePayload) {
            onApplyDatabasePayload(parsedLocalBackup);
          }

          // B. Push to Firebase Firestore cloud (Primary Real-Time Database)
          await syncAllLocalDataToFirestore({
            products: parsedLocalBackup.products,
            transactions: parsedLocalBackup.transactions,
            cashFlowRecords: parsedLocalBackup.cashFlowRecords,
            shiftHistory: parsedLocalBackup.shifts,
            currentShift: parsedLocalBackup.currentShift,
            kaosStocks: parsedLocalBackup.kaosStocks,
            customers: parsedLocalBackup.customers,
            users: parsedLocalBackup.users,
            stockMovements: parsedLocalBackup.stockMovements
          });

          // C. Save to server backup
          saveServerBackupSnapshot(parsedLocalBackup, 'Manual File Upload Restore', 'local-file-upload').catch(() => {});

          setStatusMessage({
            text: `Berhasil memulihkan database dari file lokal "${selectedLocalFile?.name}"! Data lokal dan cloud Firebase Firestore telah diperbarui (${parsedLocalBackup.transactions.length} transaksi, ${parsedLocalBackup.products.length} produk).`
          });

          onManualSyncSuccess();
        } catch (err: any) {
          setStatusMessage({
            text: `Gagal memulihkan database: ${err.message}`,
            isError: true
          });
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  // 9. Download Current Database as Local JSON
  const handleDownloadLocalDatabaseJson = () => {
    try {
      const fullBackupPayload = {
        meta: {
          appName: 'Athree Studio Jayapura POS',
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
      a.download = `athree_database_backup_${dateStr}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        text: `File cadangan database lokal berhasil diunduh (${transactions.length} transaksi, ${products.length} produk)!`
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
                Database Utama: <span className="text-white font-bold">Firebase Firestore</span> • Cadangan Manual: <span className="text-slate-300">File Lokal & SQL</span>
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
            onClick={() => setActiveTab('firestore')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
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
            onClick={() => setActiveTab('snapshots')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'snapshots'
                ? 'bg-white text-rose-800 border-rose-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Kelola &amp; Hapus Snapshot</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-800 font-extrabold">
              {firestoreBackups.length + sqlBackups.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('local')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'local'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <FolderArchive className="w-4 h-4 text-purple-600" />
            <span>Upload File Cadangan Lokal (.json)</span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-purple-100 text-purple-800 font-bold">
              Pulihkan
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
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
                    <span>Retensi Cadangan: 3 Hari Maksimal Rolling Snapshot</span>
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
                    <span className="text-xs">Snapshot Cadangan (3 Hari)</span>
                    <span className="text-[10px] text-amber-700 font-normal mt-0.5">
                      Simpan checkpoint ke Firestore
                    </span>
                  </button>
                </div>
              </div>

              {/* Firestore Snapshots List & Management Menu */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-600" />
                      MENU &amp; DAFTAR SNAPSHOT FIRESTORE (RETENSI 3 HARI MAKSIMAL)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {firestoreBackups.length} Snapshot Tersimpan
                    </span>
                  </div>
                  
                  {/* Menu Aksi Snapshot */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncLatestSnapshot}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                      title="Buka &amp; Sinkronkan Snapshot Database yang Paling Baru"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      <span>Sinkronkan Snapshot Terakhir</span>
                    </button>

                    {firestoreBackups.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllFirestoreBackups}
                        disabled={isProcessing}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Hapus Semua Snapshot Cadangan di Firestore"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Hapus Semua</span>
                      </button>
                    )}
                  </div>
                </div>

                {firestoreBackups.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                    Belum ada snapshot cadangan Firestore. Klik tombol &quot;Snapshot Cadangan (3 Hari)&quot; di atas untuk membuat snapshot baru.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {firestoreBackups.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className={`p-3 rounded-xl border text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          idx === 0 
                            ? 'bg-amber-50/40 border-amber-300 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                            <span>{snap.id}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400 text-slate-900 border border-amber-500 flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-slate-900 text-slate-900" />
                                SNAPSHOT TERAKHIR (AKTIF)
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Dibuat: <strong>{formatDate(snap.createdAt)}</strong></span>
                            <span>•</span>
                            <span>Oleh: {snap.savedBy}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreFirestoreBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                            title="Pulihkan dan Terapkan Snapshot Ini"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteFirestoreBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                            title="Hapus Snapshot Ini dari Cloud Firestore"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: MENU KELOLA & HAPUS SNAPSHOT */}
          {activeTab === 'snapshots' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Header Box */}
              <div className="bg-gradient-to-br from-rose-50 via-white to-amber-50/40 border border-rose-200 rounded-2xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-xs">
                      <Trash2 className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">
                        Menu Kelola &amp; Hapus Snapshot Database
                      </h4>
                      <p className="text-xs text-slate-500">
                        Hapus snapshot cadangan yang sudah tidak diperlukan atau sinkronkan snapshot paling baru.
                      </p>
                    </div>
                  </div>

                  {/* Primary Action: Sinkronkan Snapshot Terakhir */}
                  <button
                    type="button"
                    onClick={handleSyncLatestSnapshot}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    title="Buka &amp; Sinkronkan Database ke Snapshot Terakhir"
                  >
                    <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>Sinkronkan Snapshot Terakhir</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-rose-100/80">
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-500 block font-semibold">Snapshot Firestore</span>
                    <span className="text-base font-bold text-emerald-800">{firestoreBackups.length} file</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-[10px] text-slate-500 block font-semibold">Snapshot SQL</span>
                    <span className="text-base font-bold text-blue-800">{sqlBackups.length} file</span>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 col-span-2">
                    <span className="text-[10px] text-slate-500 block font-semibold">Masa Retensi Otomatis</span>
                    <span className="text-xs font-bold text-slate-700">3 Hari Maksimal (Database Tidak Menumpuk)</span>
                  </div>
                </div>
              </div>

              {/* SECTION 1: DAFTAR SNAPSHOT CLOUD FIRESTORE */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Daftar Snapshot Firebase Firestore (Cloud)
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        {firestoreBackups.length} Snapshot Tersimpan
                      </span>
                    </div>
                  </div>

                  {firestoreBackups.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllFirestoreBackups}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer w-fit"
                      title="Hapus Seluruh Snapshot Firestore"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus Semua Snapshot Firestore</span>
                    </button>
                  )}
                </div>

                {firestoreBackups.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    Tidak ada snapshot cadangan di Cloud Firestore.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {firestoreBackups.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className={`p-3.5 rounded-xl border text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          idx === 0
                            ? 'bg-amber-50/50 border-amber-300 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-slate-900">{snap.id}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400 text-slate-900 border border-amber-500 flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-slate-900 text-slate-900" />
                                SNAPSHOT TERAKHIR (AKTIF)
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Waktu: <strong>{formatDate(snap.createdAt)}</strong></span>
                            <span>•</span>
                            <span>Oleh: {snap.savedBy}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreFirestoreBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                            title="Pulihkan dan Terapkan Snapshot Ini"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteFirestoreBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                            title="Hapus Snapshot Ini Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: DAFTAR SNAPSHOT DATABASE SQL */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Daftar Snapshot Database SQL (Server)
                      </h5>
                      <span className="text-[11px] text-slate-500">
                        {sqlBackups.length} Snapshot Tersimpan
                      </span>
                    </div>
                  </div>

                  {sqlBackups.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteAllSqlBackups}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer w-fit"
                      title="Hapus Seluruh Snapshot SQL"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Hapus Semua Snapshot SQL</span>
                    </button>
                  )}
                </div>

                {sqlBackups.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    Tidak ada snapshot cadangan di Database SQL.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {sqlBackups.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className={`p-3.5 rounded-xl border text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          idx === 0
                            ? 'bg-blue-50/50 border-blue-300 shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-slate-900">{snap.id}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-600 text-white flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                SNAPSHOT SQL TERAKHIR
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800 font-semibold border border-blue-200">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-700">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Waktu: <strong>{formatDate(snap.createdAt)}</strong></span>
                            <span>•</span>
                            <span>Oleh: {snap.savedBy || 'Kasir'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreSqlBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold border border-blue-200 transition-colors cursor-pointer text-xs flex items-center gap-1.5"
                            title="Pulihkan snapshot SQL ini"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSqlBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors cursor-pointer text-xs flex items-center gap-1.5 shadow-xs"
                            title="Hapus Snapshot SQL Ini Permanen"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-white" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: FILE CADANGAN LOKAL (UPLOAD & PULIHKAN) */}
          {activeTab === 'local' && (
            <div className="space-y-5">
              {/* Header Box */}
              <div className="bg-gradient-to-br from-purple-50 via-white to-purple-50/30 border border-purple-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                    <FolderArchive className="w-4 h-4 text-purple-600" />
                    PILIH FILE CADANGAN LOKAL (.JSON)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                    Upload &amp; Pulihkan
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-800">
                  Upload &amp; Pulihkan Database dari File Komputer / Perangkat
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Pilih file cadangan JSON yang tersimpan di perangkat lokal Anda. Sistem akan memvalidasi struktur database, menampilkan pratinjau data, dan memulihkan seluruh data kasir serta menyinkronkannya langsung ke Firebase Firestore.
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
                      Pratinjau Data yang Akan Dipulihkan:
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
                  <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-3 text-xs text-purple-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-purple-950">
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                      <span>Proses Pemulihan Aman &amp; Sinkron Cloud Otomatis:</span>
                    </div>
                    <p className="text-[11px] text-purple-800 leading-relaxed">
                      Memulihkan file ini akan memperbarui database kasir lokal, menyetel status aktif, serta mengirimkan data ke <strong>Firebase Firestore</strong> sehingga seluruh perangkat kasir lain akan langsung tersinkronkan secara real-time.
                    </p>
                  </div>

                  {/* Restore Button */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleRestoreFromLocalFile}
                      disabled={isProcessing}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Pulihkan Database dari File Ini Sekarang</span>
                    </button>
                  </div>
                </div>
              )}

              {/* No File Selected Guide */}
              {!selectedLocalFile && !isParsingFile && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-purple-400 hover:bg-purple-50/20 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-3"
                >
                  <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-200">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-700">
                      Klik di Sini untuk Memilih File Cadangan (.json)
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Pilih file cadangan JSON dari harddisk, flashdisk, atau folder download komputer Anda.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                    <span>Format yang didukung: <strong>.json</strong></span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DATABASE SQL (CADANGAN MANUAL) */}
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-blue-600" />
                      MENU &amp; DAFTAR SNAPSHOT CADANGAN SQL (3 HARI MAKSIMAL)
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {sqlBackups.length} Snapshot SQL Tersimpan
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncLatestSnapshot}
                      disabled={isProcessing}
                      className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                      title="Buka &amp; Sinkronkan Snapshot Database yang Paling Baru"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      <span>Sinkronkan Snapshot Terakhir</span>
                    </button>

                    {sqlBackups.length > 0 && (
                      <button
                        type="button"
                        onClick={handleDeleteAllSqlBackups}
                        disabled={isProcessing}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200 transition-colors disabled:opacity-50 cursor-pointer"
                        title="Hapus Semua Snapshot Cadangan di SQL"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span className="hidden sm:inline">Hapus Semua</span>
                      </button>
                    )}
                  </div>
                </div>

                {sqlBackups.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-slate-100">
                    Belum ada snapshot cadangan SQL tersimpan. Klik tombol &quot;Simpan Cadangan ke SQL Sekarang&quot; untuk membuat snapshot baru.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {sqlBackups.map((snap, idx) => (
                      <div
                        key={snap.id}
                        className={`p-3 rounded-xl border text-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          idx === 0 
                            ? 'bg-blue-50/40 border-blue-300 shadow-xs' 
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="font-bold text-slate-800 flex flex-wrap items-center gap-2">
                            <span>{snap.id}</span>
                            {idx === 0 && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-500 text-white flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                                SNAPSHOT SQL TERAKHIR
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              {snap.stats?.transactionsCount || 0} Transaksi
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {snap.stats?.productsCount || 0} Produk
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block">
                            Waktu: <strong>{formatDate(snap.createdAt)}</strong> • Oleh: {snap.savedBy || 'Kasir'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRestoreSqlBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                            title="Pulihkan snapshot SQL ini"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Pulihkan</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSqlBackup(snap.id)}
                            disabled={isProcessing}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors cursor-pointer text-xs flex items-center gap-1"
                            title="Hapus Snapshot SQL Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            <span>Hapus</span>
                          </button>
                        </div>
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

      {/* IN-APP CONFIRMATION DIALOG MODAL (Guarantees zero iframe blocking) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-inner ${
              confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
            }`}>
              {confirmDialog.isDanger ? (
                <Trash2 className="w-7 h-7 text-rose-600 animate-pulse" />
              ) : (
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-base font-bold text-slate-900">
                {confirmDialog.title}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line text-left bg-slate-50 p-3 rounded-xl border border-slate-100">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs transition-all cursor-pointer shadow-md hover:shadow-lg ${
                  confirmDialog.isDanger
                    ? 'bg-rose-600 hover:bg-rose-700 active:scale-98'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-98'
                }`}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
