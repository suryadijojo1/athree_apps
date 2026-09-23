import React, { useState } from 'react';
import {
  Flame,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
  LogOut,
  LogIn,
  X,
  Server
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithGoogleFirebase,
  signOutFirebase,
  syncAllLocalDataToFirestore,
  fetchAllDataFromFirestore
} from '../services/firebase';
import {
  saveServerDatabase,
  fetchServerDatabase,
  isRealUserData
} from '../services/serverSync';
import { Product, Transaction, CashFlowRecord, CashierShift, KaosStockItem, Customer, User, StockMovement } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  firebaseUser: FirebaseUser | null;
  isConnected: boolean;
  isSyncing: boolean;
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
  kaosStocks?: KaosStockItem[];
  customers?: Customer[];
  users?: User[];
  stockMovements?: StockMovement[];
  salesList?: string[];
  onManualSyncSuccess: () => void;
  onApplyCloudData?: (cloudData: {
    products: Product[];
    transactions: Transaction[];
    cashFlowRecords: CashFlowRecord[];
    shifts: CashierShift[];
    kaosStocks?: KaosStockItem[];
    customers?: Customer[];
    users?: User[];
    stockMovements?: StockMovement[];
    salesList?: string[];
  }) => void;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  firebaseUser,
  products,
  transactions,
  cashFlowRecords,
  shifts,
  kaosStocks,
  customers,
  users,
  stockMovements,
  salesList,
  onManualSyncSuccess,
  onApplyCloudData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

  const isCurrentBrowserMaster = isRealUserData(transactions);

  // Sync to Central Express Server
  const handlePushToServerMaster = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const ok = await saveServerDatabase({
        products,
        transactions,
        cashFlowRecords,
        shiftHistory: shifts,
        kaosStocks: kaosStocks || [],
        stockMovements: stockMovements || [],
        customers: customers || [],
        users: users || [],
        salesList: salesList || [],
        isRealData: true
      });

      if (ok) {
        setStatusMessage({
          text: `Berhasil! Data browser ini telah dijadikan Master Database di Server Pusat (${transactions.length} pesanan/faktur, ${products.length} produk). Seluruh browser lain akan otomatis menerima data ini!`
        });
        onManualSyncSuccess();
      } else {
        throw new Error('Gagal menghubungi server pusat');
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal menyimpan ke server pusat', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePullFromServer = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await fetchServerDatabase();
      if (!res.success || !res.data) {
        setStatusMessage({
          text: 'Belum ada data tersimpan di server pusat. Buka browser yang memiliki data asli lalu klik "Jadikan Master Server Pusat".',
          isError: true
        });
        return;
      }

      if (onApplyCloudData) {
        onApplyCloudData({
          products: res.data.products || [],
          transactions: res.data.transactions || [],
          cashFlowRecords: res.data.cashFlowRecords || [],
          shifts: res.data.shiftHistory || [],
          kaosStocks: res.data.kaosStocks || [],
          customers: res.data.customers || [],
          users: res.data.users || [],
          stockMovements: res.data.stockMovements || [],
          salesList: res.data.salesList || []
        });
      }

      setStatusMessage({
        text: `Sukses memuat data terbaru dari Server Pusat! (${res.data.transactions?.length || 0} pesanan/faktur, ${res.data.products?.length || 0} produk dimuat ke browser ini)`
      });
      onManualSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mengambil data dari server pusat', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignIn = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await signInWithGoogleFirebase();
      setStatusMessage({ text: 'Berhasil login dengan akun Google ke Firebase!' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal login ke Firebase', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      await signOutFirebase();
      setStatusMessage({ text: 'Berhasil keluar dari Firebase.' });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal logout', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncLocalToCloud = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await syncAllLocalDataToFirestore({
        products,
        transactions,
        cashFlowRecords,
        shifts,
        kaosStocks,
        customers
      });
      setStatusMessage({
        text: `Sukses mengunggah ke Cloud Firestore! (${res.productsCount} produk, ${res.transactionsCount} transaksi)`
      });
      onManualSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mengunggah data ke Firestore', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const cloudData = await fetchAllDataFromFirestore();
      if (cloudData.products.length === 0 && cloudData.transactions.length === 0) {
        setStatusMessage({
          text: 'Database Cloud Firestore masih kosong. Silakan buka browser asal Anda lalu klik "Unggah ke Cloud" terlebih dahulu.',
          isError: true
        });
        return;
      }
      if (onApplyCloudData) {
        onApplyCloudData({
          ...cloudData,
          stockMovements: stockMovements || [],
          salesList: salesList || []
        });
      }
      setStatusMessage({
        text: `Sukses menyamakan data dari Cloud! (${cloudData.products.length} produk, ${cloudData.transactions.length} transaksi dimuat di browser ini)`
      });
      onManualSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mengambil data dari Firestore', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#00871f] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Server className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Sinkronisasi Database Pusat Real-time</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Menyinkronkan data otomatis antar semua browser &amp; perangkat secara langsung
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                statusMessage.isError
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border border-emerald-200 text-[#00871f]'
              }`}
            >
              {statusMessage.isError ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#00871f]" />
              )}
              <div className="flex-1 font-medium">{statusMessage.text}</div>
            </div>
          )}

          {/* Current Browser Status Card */}
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Status Database Browser Saat Ini
                </span>
              </div>
              {isCurrentBrowserMaster ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Data Asli Terdeteksi (Gambar 1)
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  Data Browser Lain / Default
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Pesanan / Faktur</span>
                <span className="text-sm font-bold text-slate-800">{transactions.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Produk Master</span>
                <span className="text-sm font-bold text-slate-800">{products.length}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Stok Kaos Polos</span>
                <span className="text-sm font-bold text-slate-800">{kaosStocks?.length || 0}</span>
              </div>
            </div>

            {isCurrentBrowserMaster && (
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                💡 Browser ini memegang <strong>Data Asli (#ORD/41438 TALSON, #INV/82687 EMEDLUGUN, #ORD/86871 MELANESIA SENTANI)</strong>. Klik tombol hijau di bawah untuk memastikan data ini tersimpan sebagai Master di Server Pusat!
              </p>
            )}
          </div>

          {/* Central Server Sync Actions */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Aksi Sinkronisasi Server Pusat
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handlePushToServerMaster}
                disabled={isProcessing}
                className="w-full py-2.5 px-3 rounded-xl bg-[#00871f] hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4 text-emerald-100" />
                <span>Jadikan Master Server Pusat</span>
              </button>

              <button
                type="button"
                onClick={handlePullFromServer}
                disabled={isProcessing}
                className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-300 flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <DownloadCloud className="w-4 h-4 text-indigo-600" />
                <span>Tarik Data Terbaru dari Server</span>
              </button>
            </div>
          </div>

          {/* Firestore Backup Section (Optional) */}
          <div className="pt-2 border-t border-slate-200">
            <details className="text-xs text-slate-600">
              <summary className="font-semibold cursor-pointer text-slate-700 hover:text-emerald-700 py-1">
                Cadangan Eksternal (Cloud Firestore)
              </summary>
              <div className="mt-2 p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Project ID: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">{firebaseConfig.projectId}</code></span>
                  <span>{firebaseUser ? `User: ${firebaseUser.email}` : 'Anonim / Publik'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSyncLocalToCloud}
                    disabled={isProcessing}
                    className="py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Upload ke Firestore</span>
                  </button>
                  <button
                    type="button"
                    onClick={handlePullFromCloud}
                    disabled={isProcessing}
                    className="py-1.5 px-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg text-[11px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                    <span>Download dari Firestore</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Real-time Sync: SSE Active</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
