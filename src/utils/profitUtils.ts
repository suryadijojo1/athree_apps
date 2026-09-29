import { User, Transaction } from '../types';

/**
 * Rumus Hasil Keuntungan:
 * Hasil Keuntungan = Total Nilai Faktur - (Biaya Vendor + Biaya Pengiriman)
 */
export const calculateProfit = (
  totalInvoice: number,
  vendorCost = 0,
  shippingCost = 0
): number => {
  const safeTotal = Math.max(0, Number(totalInvoice) || 0);
  const safeVendor = Math.max(0, Number(vendorCost) || 0);
  const safeShipping = Math.max(0, Number(shippingCost) || 0);
  return safeTotal - (safeVendor + safeShipping);
};

/**
 * Pengecekan Hak Akses Admin / Owner:
 * Hanya Admin atau Owner yang memiliki akses untuk melihat hasil preview keuntungan.
 */
export const isAdminOrOwner = (
  userOrRole?: User | string | { role?: string; name?: string; roleLabel?: string } | null
): boolean => {
  if (!userOrRole) return false;
  if (typeof userOrRole === 'string') {
    const r = userOrRole.toLowerCase().trim();
    return r === 'admin' || r === 'owner' || r.includes('owner') || r.includes('pemilik');
  }
  const role = (userOrRole.role || '').toLowerCase().trim();
  const label = ((userOrRole as any).roleLabel || '').toLowerCase().trim();
  const name = (userOrRole.name || '').toLowerCase().trim();
  return (
    role === 'admin' ||
    role === 'owner' ||
    label.includes('owner') ||
    label.includes('pemilik') ||
    label.includes('admin') ||
    name.includes('owner') ||
    name.includes('athree')
  );
};

/**
 * Helper untuk menghitung persentase margin keuntungan
 */
export const calculateProfitMargin = (profit: number, totalInvoice: number): number => {
  if (!totalInvoice || totalInvoice <= 0) return 0;
  return Number(((profit / totalInvoice) * 100).toFixed(1));
};
