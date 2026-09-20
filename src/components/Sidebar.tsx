import React from 'react';
import { 
  Monitor, 
  FileText, 
  BarChart3, 
  Package, 
  LogOut,
  Clock,
  ShieldCheck,
  Home,
  HardDrive
} from 'lucide-react';
import { User } from '../types';

export type ActiveTab = 'dashboard' | 'pos' | 'orders' | 'reports' | 'stock' | 'drive';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User;
  onSwitchUser: () => void;
  onLogout: () => void;
  pendingOrdersCount: number;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onSwitchUser,
  onLogout,
  pendingOrdersCount,
  lowStockCount
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isKasir = currentUser.role === 'kasir';
  const isStaff = currentUser.role === 'staff';

  return (
    <aside className="w-16 md:w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 justify-between select-none z-20 shrink-0 shadow-lg">
      {/* Top User Initials Avatar */}
      <div className="flex flex-col items-center gap-4 w-full">
        <button
          onClick={onSwitchUser}
          title={`Masuk sebagai: ${currentUser.name} (${currentUser.roleLabel})`}
          className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-bold flex items-center justify-center text-sm shadow-inner transition-colors relative group cursor-pointer"
        >
          {currentUser.avatarText}
          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#00871f] border-2 border-slate-900"></span>
          {/* Tooltip */}
          <div className="absolute left-16 bg-black text-white text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
            {currentUser.name} ({currentUser.role.toUpperCase()})
          </div>
        </button>

        {/* Navigation Icons */}
        <nav className="flex flex-col items-center gap-2 w-full px-2">
          {/* 0. Admin Home / Dashboard (If Admin) */}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard Utama Pemilik (Admin Portal)"
              className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-[#00871f] text-white shadow-md shadow-emerald-950'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          {/* 1. KASIR */}
          <button
            onClick={() => setActiveTab('pos')}
            title="KASIR"
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'pos'
                ? 'bg-[#00871f] text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Monitor className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* 2. Daftar Pesanan & Jatuh Tempo */}
          <button
            onClick={() => setActiveTab('orders')}
            title="Daftar Pesanan & Jatuh Tempo Produksi"
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#00871f] text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5 md:w-6 md:h-6" />
            {pendingOrdersCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </button>

          {/* 3. Laporan Penjualan Harian */}
          <button
            onClick={() => {
              if (isStaff) {
                alert('Akses Dibatasi: Staf Produksi hanya memiliki hak akses Pesanan & Stok.');
                return;
              }
              setActiveTab('reports');
            }}
            title={isStaff ? 'Laporan Dibatasi untuk Staf' : 'Laporan Penjualan Harian'}
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-[#00871f] text-white shadow-md shadow-emerald-950'
                : isStaff
                ? 'text-slate-600 opacity-40 cursor-not-allowed'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <BarChart3 className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* 4. Manajemen Stok Barang */}
          <button
            onClick={() => {
              if (isKasir) {
                alert('Perhatian: Akun Kasir hanya dapat melihat stok, sedangkan Admin dapat menambah/mengedit master produk.');
              }
              setActiveTab('stock');
            }}
            title="Manajemen Stok Barang"
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-[#00871f] text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Package className="w-5 h-5 md:w-6 md:h-6" />
            {lowStockCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
            )}
          </button>

          {/* 5. Google Drive Cloud Backup & Storage */}
          <button
            onClick={() => setActiveTab('drive')}
            title="Google Drive Cloud Storage & Cadangan Data"
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all relative cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-950'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <HardDrive className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </nav>
      </div>

      {/* Bottom Switch / Logout */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        <div className="text-[10px] text-center text-slate-400 font-medium px-1">
          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-mono uppercase text-[9px]">
            {currentUser.role}
          </span>
        </div>
        <button
          onClick={onLogout}
          title="Logout / Keluar ke Halaman Login"
          className="w-10 h-10 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 flex items-center justify-center transition-colors cursor-pointer group"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </aside>
  );
};
