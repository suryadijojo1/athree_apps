import { Transaction } from '../types';

/**
 * Mengambil nilai timestamp numerik (milidetik) dari sebuah transaksi/invoice.
 * Memprioritaskan tanggal invoice (tx.date) dengan presisi intra-day (createdAt).
 * Mendukung format ISO (2026-10-11T14:30:00), YYYY-MM-DD HH:mm, YYYY-MM-DD, dsb.
 */
export const getTransactionTimestamp = (tx: Partial<Transaction> | null | undefined): number => {
  if (!tx) return 0;

  let dateTs = 0;
  if (tx.date && typeof tx.date === 'string') {
    const cleanDate = tx.date.trim().replace(' ', 'T');
    const parsed = new Date(cleanDate).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      dateTs = parsed;
    }
  }

  let createdTs = 0;
  if (tx.createdAt && typeof tx.createdAt === 'string') {
    const cleanCreated = tx.createdAt.trim().replace(' ', 'T');
    const parsed = new Date(cleanCreated).getTime();
    if (!isNaN(parsed) && parsed > 0) {
      createdTs = parsed;
    }
  }

  // Jika tx.date hanya berupa tanggal (panjang 10 karakter: YYYY-MM-DD) dan tx.createdAt ada,
  // gunakan createdTs jika berada pada hari yang sama atau untuk presisi jam/menit
  if (tx.date && tx.date.trim().length === 10 && createdTs > 0) {
    return createdTs;
  }

  if (dateTs > 0) return dateTs;
  if (createdTs > 0) return createdTs;

  // Ekstraksi timestamp dari ID (misal: tx-1790066565691 atau sejenisnya)
  if (tx.id && typeof tx.id === 'string') {
    const match = tx.id.match(/\d{10,13}/);
    if (match) {
      const num = Number(match[0]);
      if (!isNaN(num) && num > 1500000000000) {
        return num;
      }
    }
  }

  return 0;
};

/**
 * Membandingkan 2 transaksi agar tanggal invoice terbaru berada paling atas (Descending).
 * Jika tanggal persis sama, nomor faktur / ID yang lebih tinggi berada di atas.
 */
export const compareTransactionsByLatestDate = (a: Transaction, b: Transaction): number => {
  const timeA = getTransactionTimestamp(a);
  const timeB = getTransactionTimestamp(b);

  if (timeB !== timeA) {
    return timeB - timeA;
  }

  // Tie-breaker 1: nomor invoice (misal #INV/002 sebelum #INV/001)
  const invA = a.invoiceNo || '';
  const invB = b.invoiceNo || '';
  const invComp = invB.localeCompare(invA, undefined, { numeric: true, sensitivity: 'base' });
  if (invComp !== 0) {
    return invComp;
  }

  // Tie-breaker 2: ID transaksi
  return (b.id || '').localeCompare(a.id || '');
};

/**
 * Mengurutkan array transaksi dengan tanggal invoice terbaru paling atas (Descending).
 * Mengembalikan array baru tanpa memutasi array asli.
 */
export const sortTransactionsByLatestDate = (transactions: Transaction[]): Transaction[] => {
  if (!transactions || !Array.isArray(transactions)) return [];
  return [...transactions].sort(compareTransactionsByLatestDate);
};
