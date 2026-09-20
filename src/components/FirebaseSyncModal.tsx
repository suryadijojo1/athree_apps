import React, { useState } from 'react';
import {
  Flame,
  Cloud,
  CloudCheck,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  DownloadCloud,
  LogOut,
  LogIn,
  X,
  Database,
  Layers,
  ShoppingBag,
  Receipt,
  ArrowRightLeft
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  signInWithGoogleFirebase,
  signOutFirebase,
  syncAllLocalDataToFirestore
} from '../services/firebase';
import { Product, Transaction, CashFlowRecord, CashierShift } from '../types';
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
  onManualSyncSuccess: () => void;
}

export const FirebaseSyncModal: React.FC<FirebaseSyncModalProps> = ({
  isOpen,
  onClose,
  firebaseUser,
  isConnected,
  isSyncing,
  products,
  transactions,
  cashFlowRecords,
  shifts,
  onManualSyncSuccess
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  if (!isOpen) return null;

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
    if (!firebaseUser) {
      setStatusMessage({ text: 'Silakan login dengan Google terlebih dahulu untuk sinkronisasi ke cloud.', isError: true });
      return;
    }
    setIsProcessing(true);
    setStatusMessage(null);
    try {
      const res = await syncAllLocalDataToFirestore({
        products,
        transactions,
        cashFlowRecords,
        shifts
      });
      setStatusMessage({
        text: `Sukses sinkronisasi ke Cloud Firestore! (${res.productsCount} produk, ${res.transactionsCount} transaksi, ${res.cashFlowCount} arus kas)`
      });
      onManualSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Gagal mengunggah data ke Firestore', isError: true });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white p-5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Flame className="w-6 h-6 text-amber-200 fill-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Firebase Cloud Firestore</h3>
              <p className="text-amber-100 text-xs">Sinkronisasi Database Real-time & Multi-Perangkat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status Alert Message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                statusMessage.isError
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              {statusMessage.isError ? (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>
          )}

          {/* Cloud Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-orange-600" />
                Status Database Cloud
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? 'Terhubung (Online)' : 'Siap Terhubung'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Firebase Project:</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">
                  {firebaseConfig.projectId}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Lokasi Wilayah:</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">
                  asia-southeast1 (Singapura)
                </span>
              </div>
            </div>
          </div>

          {/* User Authentication Card */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Autentikasi Firebase
            </h4>
            {firebaseUser ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {firebaseUser.photoURL ? (
                    <img
                      src={firebaseUser.photoURL}
                      alt="User avatar"
                      className="w-10 h-10 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center text-sm">
                      {firebaseUser.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {firebaseUser.displayName || 'Akun Google'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{firebaseUser.email}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Akses Cloud Firestore Aktif
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Hubungkan dengan akun Google Anda untuk mengaktifkan sinkronisasi otomatis ke cloud Firestore secara aman.
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isProcessing ? 'Menghubungkan...' : 'Login dengan Google ke Firebase'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Local vs Cloud Data Summary */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Data Tersimpan di Aplikasi
            </h4>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <ShoppingBag className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                <span className="font-bold text-slate-900 block text-sm">{products.length}</span>
                <span className="text-[11px] text-slate-500">Produk</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <Receipt className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <span className="font-bold text-slate-900 block text-sm">{transactions.length}</span>
                <span className="text-[11px] text-slate-500">Transaksi</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <ArrowRightLeft className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                <span className="font-bold text-slate-900 block text-sm">{cashFlowRecords.length}</span>
                <span className="text-[11px] text-slate-500">Mutasi Kas</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <Cloud className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                <span className="font-bold text-slate-900 block text-sm">{shifts.length}</span>
                <span className="text-[11px] text-slate-500">Shift</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={handleSyncLocalToCloud}
                disabled={isProcessing || isSyncing || !firebaseUser}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {isProcessing ? 'Mengunggah...' : 'Unggah & Sinkronkan Seluruh Data Lokal ke Firestore'}
                </span>
              </button>
              {!firebaseUser && (
                <p className="text-[11px] text-slate-500 text-center">
                  * Login Google diperlukan untuk mengunggah ke database Firestore.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-600" />
            Firestore Cloud Database Aktif
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
