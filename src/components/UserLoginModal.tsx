import React, { useState } from 'react';
import { Shield, KeyRound, UserCheck, Check, Lock, X, LogOut } from 'lucide-react';
import { User, UserRole } from '../types';

interface UserLoginModalProps {
  users: User[];
  currentUser: User;
  onSelectUser: (user: User) => void;
  onClose: () => void;
  isOpen: boolean;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
}

export const UserLoginModal: React.FC<UserLoginModalProps> = ({
  users,
  currentUser,
  onSelectUser,
  onClose,
  isOpen,
  onLogout,
  onOpenUserManagement
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<User>(currentUser);
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCandidate.pin && pinInput !== selectedCandidate.pin) {
      setErrorMsg('PIN salah. Silakan periksa kembali PIN Anda.');
      return;
    }
    setErrorMsg('');
    setPinInput('');
    onSelectUser(selectedCandidate);
    onClose();
  };

  const roleCapabilities: Record<UserRole, string[]> = {
    admin: [
      'Akses Penuh Seluruh Sistem POS',
      'Manajemen Master Produk & Stok',
      'Laporan Penjualan & Laba Bersih',
      'Ekspor Data PDF & Excel'
    ],
    kasir: [
      'Operasional Mesin Kasir (POS)',
      'Buka / Tutup Shift Kasir',
      'Cetak Struk & Simpan Pesanan',
      'Melihat Ketersediaan Stok'
    ],
    staff: [
      'Pelacakan Jatuh Tempo Produksi',
      'Pembaruan Status Sablon & Cetak',
      'Catat Mutasi Stok Fisik / Masuk',
      'Akses Finansial Dibatasi'
    ]
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Sistem Hak Akses Pengguna</h3>
              <p className="text-xs text-slate-500">Pilih akun dan masukkan PIN untuk berganti peran</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded-lg"
          >
            Tutup
          </button>
        </div>

        {/* User Card List */}
        <div className="space-y-2 mb-4">
          {users.map((user) => {
            const isSelected = selectedCandidate.id === user.id;
            return (
              <div
                key={user.id}
                onClick={() => {
                  setSelectedCandidate(user);
                  setErrorMsg('');
                }}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {user.avatarText}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{user.name}</h4>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-semibold text-blue-700">{user.roleLabel}</span>
                      {user.username && (
                        <>
                          <span className="text-slate-300">&bull;</span>
                          <span className="text-slate-500 font-mono">@{user.username}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-bold">
                    {user.role}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Role Privileges Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 text-xs">
          <p className="font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            Hak Akses: {selectedCandidate.roleLabel}
          </p>
          <ul className="space-y-1 text-slate-600">
            {roleCapabilities[selectedCandidate.role].map((cap, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* PIN Entry Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Masukkan PIN Keamanan (Demo PIN: 1234)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Ketik PIN 1234..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            {errorMsg && <p className="text-[11px] text-rose-600 mt-1 font-medium">{errorMsg}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-200 transition-all cursor-pointer"
          >
            Masuk sebagai {selectedCandidate.name}
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar / Logout dari Akun</span>
            </button>
          )}

          {currentUser.role === 'admin' && onOpenUserManagement && (
            <div className="pt-2 border-t border-slate-100 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenUserManagement();
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 cursor-pointer py-1"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Kelola / Ubah Username & PIN (Admin)</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
