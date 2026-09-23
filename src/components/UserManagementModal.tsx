import React, { useState } from 'react';
import {
  X,
  UserCheck,
  KeyRound,
  Shield,
  ShieldCheck,
  User,
  Check,
  Eye,
  EyeOff,
  AlertCircle,
  Plus,
  Trash2,
  Lock,
  Sparkles,
  Edit2
} from 'lucide-react';
import { User as UserType, UserRole } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserType[];
  currentUser: UserType;
  onUpdateUser: (updatedUser: UserType) => void;
  onAddUser?: (newUser: UserType) => void;
  onDeleteUser?: (userId: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onUpdateUser,
  onAddUser,
  onDeleteUser
}) => {
  const [selectedUser, setSelectedUser] = useState<UserType>(() => {
    // Default select current user or first admin
    return users.find((u) => u.id === currentUser.id) || users[0];
  });

  const [name, setName] = useState<string>(selectedUser.name);
  const [username, setUsername] = useState<string>(selectedUser.username || '');
  const [pin, setPin] = useState<string>(selectedUser.pin || '1234');
  const [confirmPin, setConfirmPin] = useState<string>(selectedUser.pin || '1234');
  const [role, setRole] = useState<UserRole>(selectedUser.role);
  const [roleLabel, setRoleLabel] = useState<string>(selectedUser.roleLabel);

  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectUser = (u: UserType) => {
    setIsAddingNew(false);
    setSelectedUser(u);
    setName(u.name);
    setUsername(u.username || '');
    setPin(u.pin || '1234');
    setConfirmPin(u.pin || '1234');
    setRole(u.role);
    setRoleLabel(u.roleLabel);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleStartAddNew = () => {
    setIsAddingNew(true);
    setName('');
    setUsername('');
    setPin('1234');
    setConfirmPin('1234');
    setRole('kasir');
    setRoleLabel('Kasir POS');
    setErrorMessage('');
    setSuccessMessage('');
  };

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validations
    const trimmedName = name.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (!trimmedName) {
      setErrorMessage('Nama pengguna tidak boleh kosong.');
      return;
    }

    if (!cleanUsername) {
      setErrorMessage('Username login tidak boleh kosong.');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMessage('Username minimal 3 karakter.');
      return;
    }

    // Check duplicate username
    const isDuplicate = users.some(
      (u) =>
        u.username?.toLowerCase() === cleanUsername &&
        (!isAddingNew ? u.id !== selectedUser.id : true)
    );

    if (isDuplicate) {
      setErrorMessage(`Username "${cleanUsername}" sudah digunakan oleh akun lain. Silakan pilih username lain.`);
      return;
    }

    if (!cleanPin) {
      setErrorMessage('PIN password tidak boleh kosong.');
      return;
    }

    if (cleanPin.length < 4) {
      setErrorMessage('PIN password minimal 4 karakter / digit.');
      return;
    }

    if (cleanPin !== confirmPin.trim()) {
      setErrorMessage('Konfirmasi PIN password tidak cocok!');
      return;
    }

    const calculatedAvatar = getInitials(trimmedName);
    const assignedRoleLabel =
      role === 'admin'
        ? 'Administrator / Pemilik'
        : role === 'kasir'
        ? 'Kasir POS'
        : 'Staf Produksi / Desain';

    if (isAddingNew) {
      const newUser: UserType = {
        id: `u-${Date.now()}`,
        name: trimmedName,
        username: cleanUsername,
        pin: cleanPin,
        role,
        avatarText: calculatedAvatar,
        roleLabel: assignedRoleLabel
      };

      if (onAddUser) {
        onAddUser(newUser);
        setSelectedUser(newUser);
        setIsAddingNew(false);
        setSuccessMessage(`Akun baru "${trimmedName}" dengan username "${cleanUsername}" berhasil ditambahkan!`);
      }
    } else {
      const updated: UserType = {
        ...selectedUser,
        name: trimmedName,
        username: cleanUsername,
        pin: cleanPin,
        role,
        avatarText: calculatedAvatar,
        roleLabel: assignedRoleLabel
      };

      onUpdateUser(updated);
      setSelectedUser(updated);
      setSuccessMessage(`Username dan PIN untuk "${trimmedName}" berhasil diperbarui!`);
    }

    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00871f] text-white flex items-center justify-center shadow-md">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Kelola Username & PIN Password
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  Khusus Admin
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Ubah nama pengguna, username untuk login, serta PIN keamanan akun POS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Split Left (User List) & Right (Edit Form) */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: List of Users */}
          <div className="w-full md:w-5/12 p-4 bg-slate-50 flex flex-col justify-between shrink-0 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Daftar Pengguna ({users.length})
                </span>
                {onAddUser && (
                  <button
                    type="button"
                    onClick={handleStartAddNew}
                    className="text-xs font-bold text-[#00871f] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {users.map((u) => {
                  const isSelected = !isAddingNew && selectedUser.id === u.id;
                  const isCurrent = currentUser.id === u.id;

                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-white border-[#00871f] shadow-sm ring-2 ring-[#00871f]/20'
                          : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.role === 'admin'
                              ? 'bg-blue-100 text-blue-800'
                              : u.role === 'kasir'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.avatarText}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 truncate block">
                              {u.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span className="font-mono text-[#00871f] font-semibold">
                              @{u.username || 'belum_ada'}
                            </span>
                            <span>&bull;</span>
                            <span className="capitalize">{u.role}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400">
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-semibold">
                          PIN: {u.pin ? '••••' : '1234'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info notice */}
            <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-slate-700 text-[11px] space-y-1">
              <div className="flex items-center gap-1 font-bold text-blue-900">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Otorisasi & Keamanan</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Username digunakan untuk login di layar masuk. PIN digunakan untuk otorisasi akses kasir dan transaksi.
              </p>
            </div>
          </div>

          {/* Right Column: Edit / Add Form */}
          <div className="w-full md:w-7/12 p-5 bg-white flex flex-col justify-between">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#00871f] flex items-center justify-center">
                      <Edit2 className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {isAddingNew
                        ? 'Tambah Akun Pengguna Baru'
                        : `Edit Username & PIN: ${selectedUser.name}`}
                    </h3>
                  </div>
                  {!isAddingNew && selectedUser.role && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        selectedUser.role === 'admin'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedUser.role === 'kasir'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedUser.role}
                    </span>
                  )}
                </div>

                {/* Success Alert */}
                {successMessage && (
                  <div className="mb-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Error Alert */}
                {errorMessage && (
                  <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Fields */}
                <div className="space-y-3">
                  {/* 1. Nama Lengkap */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nama Lengkap Pengguna <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Dimas Saputra"
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                      required
                    />
                  </div>

                  {/* 2. Username Login */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Nama Username (Untuk Login) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-mono text-xs">
                        @
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) =>
                          setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                        }
                        placeholder="admin / kasir_dian"
                        className="w-full text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-xl pl-7 pr-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                        required
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Hanya huruf kecil, angka, dan garis bawah (_). Digunakan saat login.
                    </span>
                  </div>

                  {/* 3. PIN / Password Baru */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">
                          PIN / Password <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showPin ? 'Sembunyikan' : 'Lihat'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPin ? 'text' : 'password'}
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                          placeholder="4 digit angka atau password"
                          className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00871f]"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Konfirmasi PIN <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type={showPin ? 'text' : 'password'}
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        placeholder="Ulangi PIN password"
                        className={`w-full text-xs font-mono font-bold bg-slate-50 border rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 ${
                          confirmPin && confirmPin !== pin
                            ? 'border-rose-300 focus:ring-rose-500'
                            : 'border-slate-300 focus:ring-[#00871f]'
                        }`}
                        required
                      />
                    </div>
                  </div>

                  {/* 4. Role Selection */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Peran Hak Akses (Role)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRole('admin')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          role === 'admin'
                            ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('kasir')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          role === 'kasir'
                            ? 'bg-emerald-50 border-[#00871f] text-[#00871f] ring-1 ring-[#00871f]'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Kasir POS
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('staff')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                          role === 'staff'
                            ? 'bg-amber-50 border-amber-500 text-amber-800 ring-1 ring-amber-500'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Staf Produksi
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPin('1234');
                      setConfirmPin('1234');
                    }}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Reset PIN ke 1234
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold bg-[#00871f] hover:bg-[#007019] text-white rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isAddingNew ? 'Tambah Pengguna' : 'Simpan Perubahan'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
