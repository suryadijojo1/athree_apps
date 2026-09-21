import React, { useState, useEffect, useCallback } from 'react';
import {
  HardDrive,
  Cloud,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FileText,
  Folder,
  File,
  Search,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  ShieldCheck,
  Database,
  ArrowDownToLine,
  X,
  Clock,
  Copy,
  Check,
  ShieldAlert
} from 'lucide-react';
import {
  googleSignIn,
  logoutGoogle,
  initAuth,
  getAccessToken,
  getCurrentGoogleUser
} from '../services/googleAuth';
import {
  listDriveFiles,
  uploadFileToDrive,
  deleteDriveFile,
  downloadFileContent,
  backupAppDataToDrive,
  getOrCreateBackupFolder,
  BACKUP_FOLDER_NAME
} from '../services/googleDriveService';
import { DriveFile, Transaction, Product, CashFlowRecord, CashierShift, User } from '../types';

interface GoogleDriveViewProps {
  transactions: Transaction[];
  products: Product[];
  cashFlowRecords: CashFlowRecord[];
  shifts?: CashierShift[];
  currentStartingCash?: number;
  currentUser?: User;
  allowCashierDrive?: boolean;
  onSwitchToAdmin?: () => void;
  onRestoreData?: (data: {
    transactions?: Transaction[];
    products?: Product[];
    cashFlowRecords?: CashFlowRecord[];
  }) => void;
}

export const GoogleDriveView: React.FC<GoogleDriveViewProps> = ({
  transactions,
  products,
  cashFlowRecords,
  shifts = [],
  currentStartingCash = 0,
  currentUser,
  allowCashierDrive = false,
  onSwitchToAdmin,
  onRestoreData
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Diagnostic state for Firebase unauthorized-domain
  const [unauthorizedDomainInfo, setUnauthorizedDomainInfo] = useState<{
    hostname: string;
    projectId: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Files state
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState<'all' | 'backup' | 'spreadsheet' | 'pdf' | 'folder'>('all');

  // Backup & Upload States
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    link?: string;
  } | null>(null);

  // Destructive Delete Confirmation Modal (MANDATORY per Workspace guidelines)
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Restore Confirmation Modal
  const [backupToRestore, setBackupToRestore] = useState<{ file: DriveFile; content: any } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // New Folder Modal
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsConnected(true);
        setGoogleUser(user);
        loadFiles();
      },
      () => {
        setIsConnected(false);
        setGoogleUser(null);
        setFiles([]);
      }
    );

    // Initial check if already cached
    getAccessToken().then((token) => {
      if (token) {
        setIsConnected(true);
        setGoogleUser(getCurrentGoogleUser());
        loadFiles();
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const showNotification = (
    type: 'success' | 'error' | 'info',
    message: string,
    link?: string
  ) => {
    setNotification({ type, message, link });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 6000);
  };

  const handleCopyHostname = async (hostname: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(hostname);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = hostname;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    } catch {
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleDownloadLocalBackup = () => {
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        appName: 'Aplikasi Kasir & Manajemen Stok DEAZBAR POS',
        database: 'Cloud SQL PostgreSQL / Local',
        counts: {
          transactions: transactions.length,
          products: products.length,
          cashFlowRecords: cashFlowRecords.length,
        },
        data: {
          transactions,
          products,
          cashFlowRecords,
          shifts,
          currentStartingCash
        }
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_Kasir_Lokal_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', 'File cadangan JSON berhasil diunduh ke perangkat Anda.');
    } catch (err: any) {
      showNotification('error', 'Gagal mengunduh file cadangan lokal: ' + err.message);
    }
  };

  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setIsConnected(true);
        setGoogleUser(result.user);
        setUnauthorizedDomainInfo(null);
        showNotification('success', `Berhasil terhubung dengan akun Google: ${result.user.email}`);
        await loadFiles();
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        const host = err.hostname || (typeof window !== 'undefined' ? window.location.hostname : '');
        setUnauthorizedDomainInfo({
          hostname: host,
          projectId: err.projectId || 'excellent-bit-csjh2'
        });
        setAuthError(`Domain "${host}" belum diizinkan di Firebase Authentication.`);
        showNotification('error', `Domain "${host}" belum diotorisasi di Firebase Authentication.`);
      } else {
        setAuthError(err.message || 'Gagal login ke akun Google');
        showNotification('error', err.message || 'Gagal menghubungkan akun Google');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutGoogle();
      setIsConnected(false);
      setGoogleUser(null);
      setFiles([]);
      showNotification('info', 'Koneksi akun Google berhasil diputus');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const data = await listDriveFiles({ pageSize: 40 });
      setFiles(data);
    } catch (err: any) {
      console.error('Error loading files:', err);
      showNotification('error', err.message || 'Gagal memuat file Google Drive');
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // Quick 1-Click App Backup to Drive
  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const result = await backupAppDataToDrive({
        transactions,
        products,
        cashFlowRecords,
        shifts,
        currentStartingCash
      });

      showNotification(
        'success',
        `Cadangan data berhasil disimpan di Google Drive: ${result.name}`,
        result.webViewLink
      );
      await loadFiles();
    } catch (err: any) {
      console.error('Backup error:', err);
      showNotification('error', err.message || 'Gagal membuat cadangan ke Google Drive');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Upload local file to Drive
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const folderId = await getOrCreateBackupFolder(BACKUP_FOLDER_NAME);
      const uploaded = await uploadFileToDrive({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        content: file,
        folderId,
        description: `Diunggah manual dari DEAZBAR POS pada ${new Date().toLocaleString('id-ID')}`
      });

      showNotification(
        'success',
        `File "${uploaded.name}" berhasil diunggah ke Google Drive!`,
        uploaded.webViewLink
      );
      await loadFiles();
    } catch (err: any) {
      console.error('Upload error:', err);
      showNotification('error', err.message || 'Gagal mengunggah file ke Google Drive');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Create Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      await getOrCreateBackupFolder(newFolderName.trim());
      showNotification('success', `Folder "${newFolderName.trim()}" berhasil dibuat di Google Drive`);
      setShowNewFolderModal(false);
      setNewFolderName('');
      await loadFiles();
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal membuat folder');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Execute Destructive Delete (after explicit user confirmation)
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(fileToDelete.id);
      showNotification('success', `File "${fileToDelete.name}" berhasil dihapus dari Google Drive.`);
      setFiles((prev) => prev.filter((f) => f.id !== fileToDelete.id));
      setFileToDelete(null);
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal menghapus file dari Google Drive.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Inspect & Prepare Restore
  const handlePrepareRestore = async (file: DriveFile) => {
    try {
      showNotification('info', `Mengunduh data cadangan "${file.name}"...`);
      const rawText = await downloadFileContent(file.id);
      const parsed = JSON.parse(rawText);
      if (!parsed.data && !parsed.transactions && !parsed.products) {
        throw new Error('Format file cadangan tidak sesuai standar DEAZBAR POS.');
      }
      setBackupToRestore({ file, content: parsed });
    } catch (err: any) {
      showNotification('error', err.message || 'Gagal membaca isi file cadangan.');
    }
  };

  // Execute Restore
  const handleExecuteRestore = () => {
    if (!backupToRestore || !onRestoreData) return;
    setIsRestoring(true);
    try {
      const data = backupToRestore.content.data || backupToRestore.content;
      onRestoreData({
        transactions: data.transactions,
        products: data.products,
        cashFlowRecords: data.cashFlowRecords
      });
      showNotification(
        'success',
        `Data berhasil dipulihkan dari cadangan Google Drive (${backupToRestore.file.name})!`
      );
      setBackupToRestore(null);
    } catch (err: any) {
      showNotification('error', 'Gagal menerapkan pemulihan data: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Filtered files
  const filteredFiles = files.filter((f) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!f.name.toLowerCase().includes(q)) return false;
    }
    if (fileFilter === 'backup') {
      return f.mimeType === 'application/json' || f.name.endsWith('.json');
    }
    if (fileFilter === 'spreadsheet') {
      return (
        f.mimeType.includes('spreadsheet') ||
        f.mimeType.includes('csv') ||
        f.name.endsWith('.xlsx') ||
        f.name.endsWith('.csv')
      );
    }
    if (fileFilter === 'pdf') {
      return f.mimeType === 'application/pdf' || f.name.endsWith('.pdf');
    }
    if (fileFilter === 'folder') {
      return f.mimeType === 'application/vnd.google-apps.folder';
    }
    return true;
  });

  const getFileIcon = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-100" />;
    }
    if (file.name.endsWith('.json') || file.mimeType === 'application/json') {
      return <FileJson className="w-5 h-5 text-emerald-600" />;
    }
    if (file.mimeType.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (file.mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-600" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '-';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '-';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  // Role Access Control: Restrict to Admin unless allowCashierDrive is enabled
  if (currentUser && currentUser.role !== 'admin' && !allowCashierDrive) {
    return (
      <div className="flex-1 bg-slate-100 flex items-center justify-center p-6 select-none">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 max-w-md text-center space-y-5 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center shadow-xs">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-800">
              Akses Dibatasi Khusus Administrator
            </h2>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Menu <strong>Google Drive Cloud Storage & Cadangan Data</strong> hanya dapat diakses dan dikelola oleh akun
              <strong> Administrator / Pemilik Toko</strong> demi menjaga integritas database dan riwayat penjualan.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-2 text-slate-600">
            <span className="font-bold text-slate-700 block">Status Pengguna Aktif:</span>
            <div className="flex items-center justify-between text-[11px]">
              <span>Nama Akun:</span>
              <span className="font-semibold text-slate-800">{currentUser.name}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span>Peran (Role):</span>
              <span className="font-bold uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                {currentUser.roleLabel || currentUser.role}
              </span>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            {onSwitchToAdmin && (
              <button
                type="button"
                onClick={onSwitchToAdmin}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Masuk Sebagai Administrator / Pemilik</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadLocalBackup}
              className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Cadangan Offline (.JSON) Lokal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-100 select-none">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold shadow-2xs">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              Google Drive Cloud Storage
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200">
                Workspace Terintegrasi
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Cadangkan data penjualan, simpan laporan, dan kelola arsip toko langsung di Google Drive Anda
            </p>
          </div>
        </div>

        {/* Google Connection Status / Sign In Button */}
        <div>
          {isConnected && googleUser ? (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google User'}
                  className="w-7 h-7 rounded-full border border-slate-300"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {(googleUser.displayName || googleUser.email || 'G').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <span className="text-xs font-bold text-slate-800 block leading-tight">
                  {googleUser.displayName || 'Pengguna Google'}
                </span>
                <span className="text-[10px] text-slate-500 block leading-tight truncate max-w-[160px]">
                  {googleUser.email}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline px-2 py-1 rounded cursor-pointer"
                title="Putuskan koneksi Google Drive"
              >
                Keluar
              </button>
            </div>
          ) : (
            /* Official Google Sign-In Material Button */
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthenticating}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-xs hover:shadow-sm cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isAuthenticating ? 'Menghubungkan...' : 'Hubungkan Akun Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Alert Banner / Notification */}
      {notification && (
        <div className="mx-6 mt-4 p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 shadow-xs bg-white">
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-semibold text-slate-800">{notification.message}</span>
            {notification.link && (
              <a
                href={notification.link}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline font-bold flex items-center gap-1 ml-2"
              >
                <span>Buka di Google Drive</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="p-6 space-y-6">
        {/* UNAUTHORIZED DOMAIN DIAGNOSTIC CARD */}
        {unauthorizedDomainInfo && (
          <div className="bg-amber-50/80 border border-amber-300 rounded-2xl p-6 text-left max-w-2xl mx-auto shadow-sm space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Domain Belum Terdaftar di Firebase Authentication
                  </h3>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    auth/unauthorized-domain
                  </span>
                </div>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                  Firebase menolak proses login karena domain Cloud Run saat ini belum ditambahkan ke daftar
                  <strong> Authorized domains</strong> di Firebase Console project Anda (<strong>{unauthorizedDomainInfo.projectId}</strong>).
                </p>
              </div>
            </div>

            {/* Current Hostname with Copy Button */}
            <div className="bg-white border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="overflow-hidden">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Domain Aplikasi Anda Saat Ini:</span>
                <code className="text-xs font-mono font-bold text-blue-700 break-all select-all">
                  {unauthorizedDomainInfo.hostname}
                </code>
              </div>
              <button
                type="button"
                onClick={() => handleCopyHostname(unauthorizedDomainInfo.hostname)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                  copiedDomain
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDomain ? 'Tersalin!' : 'Salin Domain'}</span>
              </button>
            </div>

            {/* Steps to fix */}
            <div className="bg-white/60 border border-amber-200/60 rounded-xl p-3.5 text-xs text-slate-700 space-y-2">
              <span className="font-bold text-slate-900 block">Langkah Mengaktifkan di Firebase Console:</span>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>Klik tombol <strong>Salin Domain</strong> di atas.</li>
                <li>
                  Buka pengaturan Firebase Console:{' '}
                  <a
                    href={`https://console.firebase.google.com/project/${unauthorizedDomainInfo.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-bold inline-flex items-center gap-1"
                  >
                    <span>Buka Firebase Auth Settings</span>
                    <ExternalLink className="w-3 h-3 inline" />
                  </a>
                </li>
                <li>Pilih tab <strong>Authorized domains</strong> (Domain yang diizinkan).</li>
                <li>Klik <strong>Add domain</strong>, tempel domain yang tadi disalin, lalu klik <strong>Add</strong>.</li>
                <li>Kembali ke tab ini lalu klik tombol coba lagi di bawah.</li>
              </ol>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
                <span>{isAuthenticating ? 'Menghubungkan...' : 'Coba Hubungkan Google Drive Lagi'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadLocalBackup}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Cadangan JSON Lokal (Offline)</span>
              </button>
            </div>
          </div>
        )}

        {!isConnected ? (
          /* Connect Prompt Card */
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center max-w-xl mx-auto space-y-4 my-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-100 shadow-sm">
              <Cloud className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Hubungkan Google Drive untuk Cadangan Cloud Otomatis
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dengan menghubungkan akun Google Anda, Anda dapat mencadangkan seluruh data transaksi, master produk,
              dan laporan arus kas toko langsung ke folder Google Drive dengan aman.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthenticating}
                className="w-full sm:w-auto px-6 py-3 bg-[#3b49df] hover:bg-[#2f3ab2] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isAuthenticating ? 'Sedang Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadLocalBackup}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                title="Cadangkan data ke file JSON di komputer tanpa internet"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Unduh Cadangan Offline (.JSON)</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-6 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Aman & Privat
              </span>
              <span className="flex items-center gap-1.5">
                <Database className="w-4 h-4 text-blue-600" />
                Penyimpanan di Akun Anda
              </span>
            </div>
          </div>
        ) : (
          <>
            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Backup Now Card */}
              <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center mb-2.5">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">Cadangkan Data Toko</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                    {transactions.length} Transaksi, {products.length} Produk, {cashFlowRecords.length} Mutasi Kas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  disabled={isBackingUp}
                  className="mt-3 w-full py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isBackingUp ? 'Menyimpan ke Drive...' : 'Cadangkan Sekarang'}</span>
                </button>
              </div>

              {/* 2. Upload Custom File Card */}
              <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2.5">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">Upload Dokumen / Arsip</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                    Unggah nota faktur, invoice PDF, spreadsheet, atau gambar nota ke Google Drive
                  </p>
                </div>
                <label className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 text-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Mengunggah...' : 'Pilih File Lokal'}</span>
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 3. New Folder Card */}
              <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-2.5">
                    <FolderPlus className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">Buat Folder Khusus</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                    Kelola struktur penyimpanan arsip laporan bulanan atau nota toko di Drive
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(true)}
                  className="mt-3 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Tambah Folder</span>
                </button>
              </div>

              {/* 4. Open Drive in New Tab */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2.5">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800">Buka Web Google Drive</h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">
                    Akses dashboard lengkap Google Drive langsung di tab peramban baru
                  </p>
                </div>
                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-95 text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Google Drive</span>
                </a>
              </div>
            </div>

            {/* File Explorer Table Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {/* Explorer Toolbar */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 mr-2">Daftar File di Google Drive:</span>
                  <button
                    type="button"
                    onClick={() => setFileFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      fileFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Semua ({files.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFilter('backup')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      fileFilter === 'backup'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Cadangan (.json)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFilter('spreadsheet')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      fileFilter === 'spreadsheet'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Spreadsheet
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFilter('pdf')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      fileFilter === 'pdf'
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileFilter('folder')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      fileFilter === 'folder'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    Folder
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari file di Drive..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden w-48 sm:w-60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={loadFiles}
                    disabled={isLoadingFiles}
                    title="Segarkan daftar file"
                    className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingFiles ? 'animate-spin text-blue-600' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Files Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Nama File / Folder</th>
                      <th className="py-3 px-4">Ukuran</th>
                      <th className="py-3 px-4">Terakhir Diubah</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingFiles ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                          Memuat file dari Google Drive...
                        </td>
                      </tr>
                    ) : filteredFiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400">
                          <Cloud className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          {searchQuery
                            ? 'Tidak ada file yang cocok dengan pencarian.'
                            : 'Belum ada file di akun Google Drive atau folder ini.'}
                        </td>
                      </tr>
                    ) : (
                      filteredFiles.map((file) => {
                        const isBackupFile = file.name.endsWith('.json') || file.mimeType === 'application/json';
                        return (
                          <tr key={file.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="shrink-0">{getFileIcon(file)}</div>
                                <div>
                                  <span className="font-bold text-slate-800 block truncate max-w-xs sm:max-w-md">
                                    {file.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block truncate max-w-xs">
                                    {file.mimeType}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {formatDateTime(file.modifiedTime)}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Open in Google Drive */}
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Buka di Google Drive"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}

                                {/* Restore Button if Backup File */}
                                {isBackupFile && onRestoreData && (
                                  <button
                                    type="button"
                                    onClick={() => handlePrepareRestore(file)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#00871f] border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Pulihkan data kasir dari cadangan ini"
                                  >
                                    <ArrowDownToLine className="w-3.5 h-3.5" />
                                    <span>Pulihkan</span>
                                  </button>
                                )}

                                {/* Delete Button (Triggers Explicit Confirmation Dialog) */}
                                <button
                                  type="button"
                                  onClick={() => setFileToDelete(file)}
                                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Hapus file dari Google Drive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MANDATORY EXPLICIT CONFIRMATION MODAL FOR DESTRUCTIVE OPERATIONS */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Hapus File Google Drive</h3>
                <p className="text-[11px] text-slate-500">Tindakan ini permanen dan tidak dapat dibatalkan</p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-700">
                Apakah Anda yakin ingin menghapus file berikut dari penyimpanan Google Drive Anda?
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                {getFileIcon(fileToDelete)}
                <div className="truncate">
                  <span className="text-xs font-bold text-slate-800 block truncate">
                    {fileToDelete.name}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Ukuran: {formatFileSize(fileToDelete.size)} | Terakhir diubah:{' '}
                    {formatDateTime(fileToDelete.modifiedTime)}
                  </span>
                </div>
              </div>

              <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-[11px] text-rose-800">
                ⚠️ File akan dihapus secara langsung dari Google Drive Anda melalui otorisasi OAuth.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Konfirmasi Hapus Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORE CONFIRMATION MODAL */}
      {backupToRestore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#00871f] flex items-center justify-center shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Pulihkan Data dari Google Drive</h3>
                <p className="text-[11px] text-slate-500">
                  Cadangan: {backupToRestore.file.name}
                </p>
              </div>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-700">
                Apakah Anda ingin memulihkan data sistem kasir dari file cadangan ini?
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal Cadangan:</span>
                  <span className="font-bold text-slate-800">
                    {backupToRestore.content.backupCreatedAtFormatted || formatDateTime(backupToRestore.file.modifiedTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Transaksi:</span>
                  <span className="font-bold text-emerald-700">
                    {backupToRestore.content.totalTransactions || backupToRestore.content.data?.transactions?.length || 0} Data
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Master Produk:</span>
                  <span className="font-bold text-slate-800">
                    {backupToRestore.content.totalProducts || backupToRestore.content.data?.products?.length || 0} Produk
                  </span>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                ℹ️ Memulihkan cadangan akan memperbarui daftar transaksi, produk, dan catatan mutasi kas saat ini.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBackupToRestore(null)}
                disabled={isRestoring}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring}
                className="px-4 py-2 bg-[#00871f] hover:bg-[#007019] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isRestoring ? 'Memulihkan...' : 'Terapkan Pemulihan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW FOLDER MODAL */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-800">Buat Folder di Google Drive</h3>
              </div>
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Folder:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Laporan_2026 atau Nota_Toko"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {isCreatingFolder ? 'Membuat...' : 'Buat Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
