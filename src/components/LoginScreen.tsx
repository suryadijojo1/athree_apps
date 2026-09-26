import React, { useState } from 'react';
import { User as UserIcon, Lock, Layers, Check, AlertCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { User } from '../types';
import welcomeBg from '../assets/images/kang_sablon_mascot_1789898387552.jpg';

interface LoginScreenProps {
  users: User[];
  onLogin: (user: User) => void;
  sessionTimeoutNotice?: string | null;
  onClearTimeoutNotice?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  users,
  onLogin,
  sessionTimeoutNotice,
  onClearTimeoutNotice
}) => {
  const [usernameInput, setUsernameInput] = useState<string>('admin_athree');
  const [passwordInput, setPasswordInput] = useState<string>('1234');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedRolePreset, setSelectedRolePreset] = useState<'admin' | 'kasir' | 'staff'>('admin');

  const handleSelectPreset = (role: 'admin' | 'kasir' | 'staff') => {
    setSelectedRolePreset(role);
    setErrorMsg('');
    const target = users.find((u) => u.role === role);
    if (target) {
      setUsernameInput(target.username || (role === 'admin' ? 'admin_athree' : role === 'kasir' ? 'kasir_dimas' : 'staff_budi'));
      setPasswordInput(target.pin || '1234');
    } else {
      setUsernameInput(role === 'admin' ? 'admin_athree' : role === 'kasir' ? 'kasir_dimas' : 'staff_budi');
      setPasswordInput('1234');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameInput.toLowerCase().trim();

    // Find matched user by exact username, role, or name
    const matchedUser = users.find(
      (u) =>
        (u.username && u.username.toLowerCase() === cleanUser) ||
        u.role.toLowerCase() === cleanUser ||
        u.name.toLowerCase() === cleanUser ||
        u.name.toLowerCase().includes(cleanUser) ||
        (cleanUser === 'admin' && u.role === 'admin') ||
        (cleanUser === 'athree' && u.role === 'admin') ||
        (cleanUser === 'deazbar' && u.role === 'admin') ||
        (cleanUser === 'kasir' && u.role === 'kasir') ||
        (cleanUser === 'dimas' && u.role === 'kasir') ||
        (cleanUser === 'staff' && u.role === 'staff') ||
        (cleanUser === 'budi' && u.role === 'staff')
    );

    if (!matchedUser) {
      setErrorMsg('Username tidak ditemukan. Periksa kembali username Anda.');
      return;
    }

    if (matchedUser.pin && passwordInput !== matchedUser.pin) {
      setErrorMsg('PIN / Password salah! Silakan coba lagi.');
      return;
    }

    setErrorMsg('');
    onLogin(matchedUser);
  };

  return (
    <div className="min-h-screen w-screen bg-[#203166] flex items-center justify-center p-4 md:p-8 select-none font-sans">
      {/* Outer Card Container (Matches uploaded image) */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full min-h-[520px] flex flex-col md:flex-row border border-slate-700/20 animate-in fade-in zoom-in-95 duration-200">
        
        {/* =========================================================================
            LEFT COLUMN: White Login Form Area
        ========================================================================= */}
        <div className="w-full md:w-[42%] bg-white p-7 md:p-9 flex flex-col justify-between">
          {/* Top Logo / Brand */}
          <div>
            <div className="flex items-center gap-2 text-[#203166]">
              <div className="relative w-7 h-7">
                <div className="w-5 h-5 rounded-md bg-[#203166] absolute top-0 left-0"></div>
                <div className="w-5 h-5 rounded-md border-2 border-[#203166] bg-white absolute bottom-0 right-0"></div>
              </div>
              <div className="leading-tight">
                <span className="font-extrabold text-xs tracking-tight uppercase block text-[#203166]">
                  Athree Studio
                </span>
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider block">
                  JAYAPURA POS
                </span>
              </div>
            </div>
          </div>

          {/* Center Form */}
          <div className="my-auto py-4">
            {/* Circular Avatar Icon (Matches screenshot) */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-full border-2 border-[#203166] flex items-center justify-center text-[#203166] shadow-sm">
                <UserIcon className="w-8 h-8 stroke-[1.8]" />
              </div>
            </div>

            {/* Inactivity / 1-Hour Timeout / Refresh Auto-Logout Notice */}
            {sessionTimeoutNotice && (
              <div
                className={`mb-4 p-3.5 rounded-2xl text-xs space-y-1 relative animate-in fade-in duration-150 border ${
                  sessionTimeoutNotice.toLowerCase().includes('refresh')
                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold">
                  {sessionTimeoutNotice.toLowerCase().includes('refresh') ? (
                    <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>
                    {sessionTimeoutNotice.toLowerCase().includes('refresh')
                      ? 'Auto-Logout: Halaman Di-Refresh'
                      : 'Sesi Berakhir Otomatis (1 Jam)'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {sessionTimeoutNotice}
                </p>
                {sessionTimeoutNotice.toLowerCase().includes('refresh') && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-700 font-semibold mt-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cache &amp; cookies browser telah dibersihkan secara aman</span>
                  </div>
                )}
                {onClearTimeoutNotice && (
                  <button
                    type="button"
                    onClick={onClearTimeoutNotice}
                    className="text-[10px] underline font-semibold mt-1.5 cursor-pointer block opacity-75 hover:opacity-100"
                  >
                    Tutup pemberitahuan ini
                  </button>
                )}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              {/* Username Input Pill */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <UserIcon className="w-4 h-4 stroke-[2]" />
                </div>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="USERNAME"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-400 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#203166] focus:border-transparent transition-all tracking-wider"
                />
              </div>

              {/* Password / PIN Input Pill */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4 stroke-[2]" />
                </div>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="PASSWORD / PIN"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full border border-slate-400 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#203166] focus:border-transparent transition-all tracking-widest"
                />
              </div>

              {errorMsg && (
                <div className="text-[11px] text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Login Button (Matches screenshot) */}
              <button
                type="submit"
                className="w-full py-2.5 rounded-full bg-[#203166] hover:bg-[#182652] active:scale-98 text-white font-extrabold text-xs uppercase tracking-widest shadow-md transition-all mt-1"
              >
                LOGIN
              </button>

              {/* Checkbox and Forgot Password (Matches screenshot) */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 px-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-400 text-[#203166] focus:ring-0 w-3 h-3"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => alert('PIN Default Demo seluruh akun adalah: 1234')}
                  className="text-slate-400 hover:text-slate-700 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            </form>

            {/* Role Demo Quick Preset Switcher */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold text-center mb-2 uppercase tracking-wider">
                Pilihan Cepat Akun Demo:
              </p>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button
                  type="button"
                  onClick={() => handleSelectPreset('admin')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedRolePreset === 'admin'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Admin (ATHREE)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('kasir')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedRolePreset === 'kasir'
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Kasir (Dimas)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('staff')}
                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                    selectedRolePreset === 'staff'
                      ? 'bg-amber-50 border-amber-300 text-amber-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Staf (Budi)
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Pagination Dots (Matches screenshot: •••) */}
          <div className="flex justify-center items-center gap-1 text-[#203166] text-xl font-bold tracking-widest pt-2">
            <span>&bull;</span>
            <span>&bull;</span>
            <span>&bull;</span>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Kang Sablon Art & Welcome
        ========================================================================= */}
        <div className="w-full md:w-[58%] relative min-h-[380px] md:min-h-full flex flex-col justify-between p-6 md:p-8 overflow-hidden bg-[#0a0e1a]">
          {/* Background image: Kang Sablon Mascot Illustration */}
          <div className="absolute inset-0 z-0">
            <img
              src={welcomeBg}
              alt="Kang Sablon Mascot"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
            {/* Subtle dark gradient overlay to ensure text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/40"></div>
          </div>

          {/* Center-Bottom Welcome Typography */}
          <div className="relative z-10 text-white mt-auto pt-16 md:pt-28">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-lg">
              Welcome.
            </h1>
            <p className="text-xs text-white/90 font-medium max-w-sm leading-relaxed mb-4 drop-shadow-md">
              Sistem Kasir Terintegrasi, Manajemen Stok &amp; Pelacakan Jatuh Tempo Penyelesaian Pesanan Athree Studio Jayapura.
            </p>
            <div className="text-[11px] text-white/80 font-medium drop-shadow-sm">
              Pusat Kaos, Sablon &amp; Stiker Jayapura &bull;{' '}
              <span className="text-amber-400 font-bold underline cursor-pointer hover:text-amber-300">
                Siap Melayani
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
