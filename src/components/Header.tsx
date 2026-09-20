import React, { useState } from 'react';
import { Search, Barcode, Calendar, UserCheck, Shield, ChevronDown, CheckCircle2, Home, LogOut, KeyRound, Calculator, Lock, Unlock, Clock } from 'lucide-react';
import { User, CashierShift } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentUser: User;
  onOpenShiftModal: (mode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history') => void;
  onSwitchUser: () => void;
  shift: CashierShift;
  onScanBarcodePrompt: () => void;
  onGoToAdminDashboard?: () => void;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  setSearchQuery,
  currentUser,
  onOpenShiftModal,
  onSwitchUser,
  shift,
  onScanBarcodePrompt,
  onGoToAdminDashboard,
  onLogout,
  onOpenUserManagement
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Format today's date in Indonesian e.g. "17 September 2026"
  const formattedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="h-16 bg-[#00871f] text-white border-b border-emerald-800 px-4 md:px-6 flex items-center justify-between gap-4 select-none shrink-0 shadow-md">
      {/* Left: Outlet Name & Subtitle */}
      <div className="flex items-center gap-3 min-w-[200px] lg:min-w-[240px]">
        <div>
          <h1 className="text-base md:text-lg font-bold text-white tracking-tight leading-tight flex items-center gap-2">
            Athree Studio Jayapura
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-emerald-100 font-medium">Default Outlet</span>
            {currentUser.role === 'admin' && onGoToAdminDashboard && (
              <button
                type="button"
                onClick={onGoToAdminDashboard}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-bold transition-colors cursor-pointer border border-white/30"
                title="Kembali ke Dashboard Pemilik"
              >
                <Home className="w-3 h-3 text-white" />
                <span>Dashboard Pemilik</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Search bar with barcode icon */}
      <div className="flex-1 max-w-xl mx-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari produk atau SKU..."
            className="w-full pl-10 pr-10 py-2 text-sm bg-white border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300 text-slate-800 placeholder:text-slate-400 shadow-inner transition-all"
          />
          <button
            type="button"
            onClick={onScanBarcodePrompt}
            title="Scan Barcode / Cari Cepat SKU"
            className="absolute right-2.5 p-1 text-slate-400 hover:text-[#00871f] rounded transition-colors"
          >
            <Barcode className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Right: Date, Shift button, Profile */}
      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        {/* Date Display */}
        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-white bg-black/20 border border-white/20 px-3 py-1.5 rounded-lg">
          <span>{formattedDate}</span>
          <Calendar className="w-3.5 h-3.5 text-emerald-200" />
        </div>

        {/* Shift Button & Direct Action */}
        {shift.isOpen ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onOpenShiftModal('overview')}
              className="hidden sm:flex flex-col text-left px-2.5 py-1 rounded-lg bg-black/20 border border-white/20 hover:bg-black/30 transition-colors cursor-pointer group text-white"
              title="Klik untuk melihat detail shift aktif"
            >
              <span className="text-[10px] font-semibold text-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Shift #{shift.shiftNumber || 2} Aktif
              </span>
              <span className="text-[11px] text-white group-hover:text-emerald-100 font-medium">
                Buka: {shift.startTime}
              </span>
            </button>

            {/* Dedicated Akhiri Shift Button */}
            <button
              type="button"
              onClick={() => onOpenShiftModal('reconcile')}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Menu Akhiri Shift Kasir & Logout Sistem"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Akhiri Shift</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenShiftModal('open_shift')}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-[#00871f] font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Buka Shift Kasir Baru (Tanggal & Jam Otomatis)"
          >
            <Unlock className="w-3.5 h-3.5 text-[#00871f]" />
            <span>Buka Shift</span>
          </button>
        )}

        {/* User Profile Avatar with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
            title="Profil Pengguna"
          >
            <div className="w-9 h-9 rounded-full bg-white text-[#00871f] font-bold text-xs flex items-center justify-center shadow-xs">
              {currentUser.avatarText}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-emerald-100 hidden md:block" />
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />

              <div
                className="absolute right-0 mt-2 w-64 bg-white text-slate-800 rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Sedang Masuk</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{currentUser.name}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-[#00871f] border border-emerald-200 font-medium">
                      <Shield className="w-3 h-3" />
                      {currentUser.roleLabel}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  {shift.isOpen ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenShiftModal('reconcile');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-rose-600" />
                        <span>Akhiri Shift &amp; Logout Sistem</span>
                      </span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">Aktif</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenShiftModal('open_shift');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <Unlock className="w-4 h-4 text-[#00871f]" />
                        <span>Buka Shift Kasir Baru</span>
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-[#00871f] px-1.5 py-0.5 rounded font-mono">Tutup</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenShiftModal('history');
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                  >
                    <span>Riwayat Tutup Shift</span>
                    <Calculator className="w-4 h-4 text-slate-500" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      onSwitchUser();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-medium text-[#00871f] hover:bg-emerald-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                  >
                    <span>Ganti Akun / Hak Akses</span>
                    <UserCheck className="w-4 h-4" />
                  </button>

                  {currentUser.role === 'admin' && onOpenUserManagement && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenUserManagement();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-600" />
                        <span>Kelola &amp; Ubah Nama User</span>
                      </span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-semibold">Admin</span>
                    </button>
                  )}

                  {onLogout && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center justify-between cursor-pointer border-t border-slate-100"
                    >
                      <span>Logout / Keluar Akun</span>
                      <LogOut className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
