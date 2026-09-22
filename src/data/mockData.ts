import { Product, User, Customer, Transaction, StockMovement, CashierShift, KaosStockItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Dian Octaviani',
    username: 'kasir_dian',
    pin: '1234',
    role: 'kasir',
    avatarText: 'DO',
    roleLabel: 'Kasir POS'
  },
  {
    id: 'u2',
    name: 'Ahmad Rizky (Owner)',
    username: 'admin_ahmad',
    pin: '1234',
    role: 'admin',
    avatarText: 'AR',
    roleLabel: 'Administrator / Pemilik'
  },
  {
    id: 'u3',
    name: 'Budi Santoso',
    username: 'staff_budi',
    pin: '1234',
    role: 'staff',
    avatarText: 'BS',
    roleLabel: 'Staf Produksi / Desain'
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'JERSEY ATASAN (STANDARD)',
    sku: 'SKU/00006',
    category: 'JERSEY',
    price: 160000,
    costPrice: 105000,
    stock: 45,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-rose-100 text-rose-700 border-rose-200',
    initials: 'J(',
    isFavorite: true
  },
  {
    id: 'p2',
    name: 'JERSEY ATASAN (>7PCS)',
    sku: 'SKU/00007',
    category: 'JERSEY',
    price: 135000,
    costPrice: 90000,
    stock: 80,
    minStock: 15,
    unit: 'Pcs',
    colorBadge: 'bg-orange-100 text-orange-700 border-orange-200',
    initials: 'J(',
    isFavorite: true
  },
  {
    id: 'p3',
    name: 'JERSEY FULL PRINTING (ATASAN + CELANA)',
    sku: 'SKU/00008',
    category: 'JERSEY',
    price: 185000,
    costPrice: 120000,
    stock: 28,
    minStock: 8,
    unit: 'Set',
    colorBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    initials: 'JP',
    isFavorite: true
  },
  {
    id: 'p4',
    name: 'MUG CUSTOM',
    sku: 'SKU/00012',
    category: 'CUSTOM MERCHANDISE',
    price: 45000,
    costPrice: 22000,
    stock: 65,
    minStock: 20,
    unit: 'Pcs',
    colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
    initials: 'MC',
    isFavorite: false
  },
  {
    id: 'p5',
    name: 'SABLON + KAOS A3',
    sku: 'SKU/00002',
    category: 'SABLON & PRINTING',
    price: 90000,
    costPrice: 52000,
    stock: 52,
    minStock: 15,
    unit: 'Pcs',
    colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
    initials: 'SK',
    isFavorite: true
  },
  {
    id: 'p5_a4',
    name: 'SABLON + KAOS A4',
    sku: 'SKU/00017',
    category: 'SABLON & PRINTING',
    price: 75000,
    costPrice: 42000,
    stock: 48,
    minStock: 15,
    unit: 'Pcs',
    colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
    initials: 'S4',
    isFavorite: true
  },
  {
    id: 'p6',
    name: 'TAMBAHAN CARTOON MUG',
    sku: 'SKU/00013',
    category: 'CUSTOM MERCHANDISE',
    price: 5000,
    costPrice: 1000,
    stock: 200,
    minStock: 50,
    unit: 'Desain',
    colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    initials: 'TM',
    isFavorite: false
  },
  {
    id: 'p7',
    name: 'TAMBAHAN KERAH POLO',
    sku: 'SKU/00010',
    category: 'JERSEY',
    price: 20000,
    costPrice: 9000,
    stock: 40,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-pink-100 text-pink-800 border-pink-200',
    initials: 'TP',
    isFavorite: false
  },
  {
    id: 'p8',
    name: 'TAMBAHAN KERAH VNECK',
    sku: 'SKU/00009',
    category: 'JERSEY',
    price: 15000,
    costPrice: 6000,
    stock: 45,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-teal-100 text-teal-700 border-teal-200',
    initials: 'TV',
    isFavorite: false
  },
  {
    id: 'p9',
    name: 'TAMBAHAN LENGAN PANJANG',
    sku: 'SKU/00005',
    category: 'JERSEY',
    price: 10000,
    costPrice: 4000,
    stock: 35,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
    initials: 'TP',
    isFavorite: false
  },
  {
    id: 'p10',
    name: 'TAMBAHAN LENGAN PANJANG MANSSET',
    sku: 'SKU/00011',
    category: 'JERSEY',
    price: 10000,
    costPrice: 4000,
    stock: 30,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-slate-200 text-slate-800 border-slate-300',
    initials: 'TP',
    isFavorite: false
  },
  {
    id: 'p11',
    name: 'TAMBAHAN SIZE 2XL-3XL',
    sku: 'SKU/00003',
    category: 'JERSEY',
    price: 10000,
    costPrice: 3500,
    stock: 50,
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-amber-100 text-amber-800 border-amber-200',
    initials: 'T2',
    isFavorite: false
  },
  {
    id: 'p12',
    name: 'TAMBAHAN SIZE 4XL',
    sku: 'SKU/00004',
    category: 'JERSEY',
    price: 15000,
    costPrice: 5000,
    stock: 25,
    minStock: 5,
    unit: 'Pcs',
    colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    initials: 'T4',
    isFavorite: false
  },
  {
    id: 'p13',
    name: 'KAOS POLOS COTTON COMBED 30S',
    sku: 'SKU/00014',
    category: 'KAOS POLOS',
    price: 55000,
    costPrice: 35000,
    stock: 120,
    minStock: 25,
    unit: 'Pcs',
    colorBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    initials: 'KP',
    isFavorite: true
  },
  {
    id: 'p14',
    name: 'HOODIE CUSTOM PRINT FLEECE',
    sku: 'SKU/00015',
    category: 'SABLON & PRINTING',
    price: 175000,
    costPrice: 110000,
    stock: 18,
    minStock: 5,
    unit: 'Pcs',
    colorBadge: 'bg-violet-100 text-violet-800 border-violet-200',
    initials: 'HC',
    isFavorite: false
  },
  {
    id: 'p15',
    name: 'TOTE BAG CANVAS CUSTOM',
    sku: 'SKU/00016',
    category: 'CUSTOM MERCHANDISE',
    price: 35000,
    costPrice: 18000,
    stock: 4, // Menipis for testing alert!
    minStock: 10,
    unit: 'Pcs',
    colorBadge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    initials: 'TB',
    isFavorite: false
  }
];

export const INITIAL_CATEGORIES = [
  'Semua',
  'Favorit',
  'JERSEY',
  'KAOS POLOS',
  'SABLON & PRINTING',
  'CUSTOM MERCHANDISE'
];

export interface KaosColorOption {
  name: string;
  dotClass: string;
}

export const STANDARD_KAOS_COLORS: KaosColorOption[] = [
  { name: 'Hitam', dotClass: 'bg-slate-900 border-slate-700' },
  { name: 'Putih', dotClass: 'bg-white border-slate-300' },
  { name: 'Navy', dotClass: 'bg-blue-900 border-blue-800' },
  { name: 'Maroon', dotClass: 'bg-rose-950 border-rose-900' },
  { name: 'Abu Misty', dotClass: 'bg-slate-400 border-slate-300' },
  { name: 'Hijau Botol', dotClass: 'bg-emerald-950 border-emerald-900' },
  { name: 'Merah Cabe', dotClass: 'bg-red-600 border-red-500' },
  { name: 'Biru Benhur', dotClass: 'bg-blue-600 border-blue-500' },
  { name: 'Kuning Mustard', dotClass: 'bg-amber-600 border-amber-500' }
];

export const STANDARD_KAOS_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];

// Helper to generate unique ID for Kaos Stock
export const generateKaosStockId = (color: string, size: string) => {
  const c = color.trim().toLowerCase().replace(/\s+/g, '_');
  const s = size.trim().toLowerCase().replace(/\s+/g, '_');
  return `kaos_${c}_${s}`;
};

export const INITIAL_KAOS_STOCK: KaosStockItem[] = [
  // Hitam
  { id: 'kaos_hitam_s', color: 'Hitam', size: 'S', stock: 15, minStock: 5 },
  { id: 'kaos_hitam_m', color: 'Hitam', size: 'M', stock: 25, minStock: 8 },
  { id: 'kaos_hitam_l', color: 'Hitam', size: 'L', stock: 35, minStock: 10 },
  { id: 'kaos_hitam_xl', color: 'Hitam', size: 'XL', stock: 30, minStock: 10 },
  { id: 'kaos_hitam_xxl', color: 'Hitam', size: 'XXL', stock: 18, minStock: 5 },
  { id: 'kaos_hitam_3xl', color: 'Hitam', size: '3XL', stock: 10, minStock: 3 },

  // Putih
  { id: 'kaos_putih_s', color: 'Putih', size: 'S', stock: 12, minStock: 5 },
  { id: 'kaos_putih_m', color: 'Putih', size: 'M', stock: 20, minStock: 8 },
  { id: 'kaos_putih_l', color: 'Putih', size: 'L', stock: 28, minStock: 10 },
  { id: 'kaos_putih_xl', color: 'Putih', size: 'XL', stock: 22, minStock: 8 },
  { id: 'kaos_putih_xxl', color: 'Putih', size: 'XXL', stock: 14, minStock: 5 },
  { id: 'kaos_putih_3xl', color: 'Putih', size: '3XL', stock: 8, minStock: 3 },

  // Navy
  { id: 'kaos_navy_s', color: 'Navy', size: 'S', stock: 10, minStock: 4 },
  { id: 'kaos_navy_m', color: 'Navy', size: 'M', stock: 18, minStock: 6 },
  { id: 'kaos_navy_l', color: 'Navy', size: 'L', stock: 24, minStock: 8 },
  { id: 'kaos_navy_xl', color: 'Navy', size: 'XL', stock: 20, minStock: 6 },
  { id: 'kaos_navy_xxl', color: 'Navy', size: 'XXL', stock: 12, minStock: 4 },
  { id: 'kaos_navy_3xl', color: 'Navy', size: '3XL', stock: 6, minStock: 2 },

  // Maroon
  { id: 'kaos_maroon_s', color: 'Maroon', size: 'S', stock: 8, minStock: 3 },
  { id: 'kaos_maroon_m', color: 'Maroon', size: 'M', stock: 15, minStock: 5 },
  { id: 'kaos_maroon_l', color: 'Maroon', size: 'L', stock: 20, minStock: 6 },
  { id: 'kaos_maroon_xl', color: 'Maroon', size: 'XL', stock: 16, minStock: 5 },
  { id: 'kaos_maroon_xxl', color: 'Maroon', size: 'XXL', stock: 10, minStock: 3 },
  { id: 'kaos_maroon_3xl', color: 'Maroon', size: '3XL', stock: 5, minStock: 2 },

  // Abu Misty
  { id: 'kaos_abu_misty_s', color: 'Abu Misty', size: 'S', stock: 10, minStock: 3 },
  { id: 'kaos_abu_misty_m', color: 'Abu Misty', size: 'M', stock: 16, minStock: 5 },
  { id: 'kaos_abu_misty_l', color: 'Abu Misty', size: 'L', stock: 22, minStock: 6 },
  { id: 'kaos_abu_misty_xl', color: 'Abu Misty', size: 'XL', stock: 18, minStock: 5 },
  { id: 'kaos_abu_misty_xxl', color: 'Abu Misty', size: 'XXL', stock: 10, minStock: 3 },
  { id: 'kaos_abu_misty_3xl', color: 'Abu Misty', size: '3XL', stock: 6, minStock: 2 },

  // Hijau Botol
  { id: 'kaos_hijau_botol_s', color: 'Hijau Botol', size: 'S', stock: 6, minStock: 2 },
  { id: 'kaos_hijau_botol_m', color: 'Hijau Botol', size: 'M', stock: 12, minStock: 4 },
  { id: 'kaos_hijau_botol_l', color: 'Hijau Botol', size: 'L', stock: 18, minStock: 5 },
  { id: 'kaos_hijau_botol_xl', color: 'Hijau Botol', size: 'XL', stock: 14, minStock: 4 },
  { id: 'kaos_hijau_botol_xxl', color: 'Hijau Botol', size: 'XXL', stock: 8, minStock: 3 },
  { id: 'kaos_hijau_botol_3xl', color: 'Hijau Botol', size: '3XL', stock: 4, minStock: 2 },

  // Merah Cabe
  { id: 'kaos_merah_cabe_s', color: 'Merah Cabe', size: 'S', stock: 8, minStock: 2 },
  { id: 'kaos_merah_cabe_m', color: 'Merah Cabe', size: 'M', stock: 14, minStock: 4 },
  { id: 'kaos_merah_cabe_l', color: 'Merah Cabe', size: 'L', stock: 16, minStock: 5 },
  { id: 'kaos_merah_cabe_xl', color: 'Merah Cabe', size: 'XL', stock: 12, minStock: 4 },
  { id: 'kaos_merah_cabe_xxl', color: 'Merah Cabe', size: 'XXL', stock: 8, minStock: 2 },
  { id: 'kaos_merah_cabe_3xl', color: 'Merah Cabe', size: '3XL', stock: 4, minStock: 2 },

  // Biru Benhur
  { id: 'kaos_biru_benhur_s', color: 'Biru Benhur', size: 'S', stock: 6, minStock: 2 },
  { id: 'kaos_biru_benhur_m', color: 'Biru Benhur', size: 'M', stock: 10, minStock: 3 },
  { id: 'kaos_biru_benhur_l', color: 'Biru Benhur', size: 'L', stock: 15, minStock: 4 },
  { id: 'kaos_biru_benhur_xl', color: 'Biru Benhur', size: 'XL', stock: 12, minStock: 3 },
  { id: 'kaos_biru_benhur_xxl', color: 'Biru Benhur', size: 'XXL', stock: 6, minStock: 2 },
  { id: 'kaos_biru_benhur_3xl', color: 'Biru Benhur', size: '3XL', stock: 4, minStock: 2 },

  // Kuning Mustard
  { id: 'kaos_kuning_mustard_s', color: 'Kuning Mustard', size: 'S', stock: 6, minStock: 2 },
  { id: 'kaos_kuning_mustard_m', color: 'Kuning Mustard', size: 'M', stock: 10, minStock: 3 },
  { id: 'kaos_kuning_mustard_l', color: 'Kuning Mustard', size: 'L', stock: 14, minStock: 4 },
  { id: 'kaos_kuning_mustard_xl', color: 'Kuning Mustard', size: 'XL', stock: 10, minStock: 3 },
  { id: 'kaos_kuning_mustard_xxl', color: 'Kuning Mustard', size: 'XXL', stock: 6, minStock: 2 },
  { id: 'kaos_kuning_mustard_3xl', color: 'Kuning Mustard', size: '3XL', stock: 4, minStock: 2 }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c0', name: 'Pelanggan Umum (Walk-in)', phone: '-' },
  { id: 'c1', name: 'FC Garuda Jayapura (Bpk. Yohan)', phone: '0812-4899-2311', address: 'Abepura, Jayapura' },
  { id: 'c2', name: 'Komunitas Motor Noken', phone: '0821-9988-1234', address: 'Entrop, Jayapura' },
  { id: 'c3', name: 'Dinas Pariwisata Papua', phone: '0813-4455-6677', address: 'Dok V, Kota Jayapura' },
  { id: 'c4', name: 'SMA Negeri 1 Jayapura (OSIS)', phone: '0852-3322-1100', address: 'Kotaraja' }
];

// Helper to generate dynamic dates relative to current calendar today
const getRelativeIsoDate = (daysAgo: number = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const d0 = getRelativeIsoDate(0); // Hari ini sesuai kalender
const d1 = getRelativeIsoDate(1); // Kemarin
const d2 = getRelativeIsoDate(2);
const d3 = getRelativeIsoDate(3);
const d4 = getRelativeIsoDate(4);
const d7 = getRelativeIsoDate(7);

export const INITIAL_SALES: string[] = [
  'Kasir (Dimas)',
  'Admin (DEAZBAR)'
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1001',
    invoiceNo: '#INV/00001',
    date: `${d0} 09:30`,
    dueDate: `${d0} 16:00`, // Tanggal Jatuh Tempo Penyelesaian
    customer: INITIAL_CUSTOMERS[1],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p2',
        name: 'JERSEY ATASAN (>7PCS)',
        sku: 'SKU/00007',
        price: 135000,
        costPrice: 90000,
        quantity: 12,
        notes: 'Nomor punggung 1-12, font block putih',
        subtotal: 1620000
      },
      {
        productId: 'p7',
        name: 'TAMBAHAN KERAH POLO',
        sku: 'SKU/00010',
        price: 20000,
        costPrice: 9000,
        quantity: 12,
        subtotal: 240000
      }
    ],
    subtotal: 1860000,
    discount: 60000,
    tax: 0,
    total: 1800000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 1800000,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Jatuh tempo hari ini sebelum tanding'
  },
  {
    id: 'tx-1002',
    invoiceNo: '#INV/00002',
    date: `${d0} 10:15`,
    dueDate: `${d0} 14:00`,
    customer: INITIAL_CUSTOMERS[2],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p5',
        name: 'SABLON + KAOS A3',
        sku: 'SKU/00002',
        price: 90000,
        costPrice: 52000,
        quantity: 5,
        notes: 'Warna kaos hitam, sablon emas',
        subtotal: 450000
      }
    ],
    subtotal: 450000,
    discount: 0,
    tax: 0,
    total: 450000,
    paymentMethod: 'Tunai',
    amountPaid: 500000,
    change: 50000,
    status: 'Selesai',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Sudah lunas tunai'
  },
  {
    id: 'tx-1003',
    invoiceNo: '#INV/00003',
    date: `${d0} 11:45`,
    dueDate: `${d0} 17:00`,
    customer: INITIAL_CUSTOMERS[4],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p4',
        name: 'MUG CUSTOM',
        sku: 'SKU/00012',
        price: 45000,
        costPrice: 22000,
        quantity: 20,
        notes: 'Logo Dies Natalis OSIS',
        subtotal: 900000
      }
    ],
    subtotal: 900000,
    discount: 50000,
    tax: 0,
    total: 850000,
    paymentMethod: 'QRIS',
    amountPaid: 850000,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Pesanan untuk acara sekolah'
  },
  {
    id: 'tx-1004',
    invoiceNo: '#INV/00004',
    date: `${d1} 14:20`,
    dueDate: `${d0} 12:00`,
    customer: INITIAL_CUSTOMERS[1],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p1',
        name: 'JERSEY ATASAN (STANDARD)',
        sku: 'SKU/00006',
        price: 150000,
        costPrice: 95000,
        quantity: 8,
        notes: 'Ukuran L 5pcs, XL 3pcs',
        subtotal: 1200000
      }
    ],
    subtotal: 1200000,
    discount: 50000,
    tax: 0,
    total: 1150000,
    paymentMethod: 'Tunai',
    amountPaid: 1200000,
    change: 50000,
    status: 'Selesai',
    cashierName: 'Ahmad Rizky (Owner)',
    cashierId: 'u0',
    notes: 'Sudah diambil oleh Bpk. Yohan'
  },
  {
    id: 'tx-1005',
    invoiceNo: '#INV/00005',
    date: `${d1} 16:45`,
    dueDate: `${d1} 17:00`,
    customer: INITIAL_CUSTOMERS[3],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p15',
        name: 'TOTE BAG CANVAS CUSTOM',
        sku: 'SKU/00016',
        price: 35000,
        costPrice: 18000,
        quantity: 30,
        notes: 'Sablon 1 sisi Festival Danau Sentani',
        subtotal: 1050000
      }
    ],
    subtotal: 1050000,
    discount: 50000,
    tax: 0,
    total: 1000000,
    paymentMethod: 'QRIS',
    amountPaid: 1000000,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Event Dinas Pariwisata'
  },
  {
    id: 'tx-1006',
    invoiceNo: '#INV/00006',
    date: `${d2} 11:10`,
    dueDate: `${d1} 15:00`,
    customer: INITIAL_CUSTOMERS[2],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p14',
        name: 'HOODIE CUSTOM PRINT FLEECE',
        sku: 'SKU/00015',
        price: 175000,
        costPrice: 110000,
        quantity: 6,
        notes: 'Hoodie hitam sablon punggung Noken Club',
        subtotal: 1050000
      }
    ],
    subtotal: 1050000,
    discount: 0,
    tax: 0,
    total: 1050000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 1050000,
    change: 0,
    status: 'Selesai',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Pelunasan transfer BCA'
  },
  {
    id: 'tx-1007',
    invoiceNo: '#INV/00007',
    date: `${d3} 15:30`,
    dueDate: `${d1} 12:00`,
    customer: INITIAL_CUSTOMERS[0],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p5',
        name: 'SABLON + KAOS A3',
        sku: 'SKU/00002',
        price: 90000,
        costPrice: 52000,
        quantity: 10,
        notes: 'Kaos putih katun 30s',
        subtotal: 900000
      }
    ],
    subtotal: 900000,
    discount: 0,
    tax: 0,
    total: 900000,
    paymentMethod: 'Tunai',
    amountPaid: 900000,
    change: 0,
    status: 'Selesai',
    cashierName: 'Ahmad Rizky (Owner)',
    cashierId: 'u0',
    notes: 'Order walk-in'
  },
  {
    id: 'tx-1008',
    invoiceNo: '#INV/00008',
    date: `${d7} 13:00`,
    dueDate: `${d4} 16:00`,
    customer: INITIAL_CUSTOMERS[4],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p2',
        name: 'JERSEY ATASAN (>7PCS)',
        sku: 'SKU/00007',
        price: 135000,
        costPrice: 90000,
        quantity: 15,
        notes: 'Tim Futsal OSIS',
        subtotal: 2025000
      }
    ],
    subtotal: 2025000,
    discount: 75000,
    tax: 0,
    total: 1950000,
    paymentMethod: 'QRIS',
    amountPaid: 1950000,
    change: 0,
    status: 'Selesai',
    cashierName: 'Dian Octaviani',
    cashierId: 'u1',
    notes: 'Selesai tepat waktu'
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-1',
    productId: 'p1',
    productName: 'JERSEY ATASAN (STANDARD)',
    sku: 'SKU/00006',
    type: 'IN',
    qty: 50,
    prevStock: 0,
    newStock: 50,
    date: '2026-09-15 10:00',
    reason: 'Restock bahan jersey polos dari supplier',
    operatorName: 'Ahmad Rizky (Owner)'
  },
  {
    id: 'sm-2',
    productId: 'p2',
    productName: 'JERSEY ATASAN (>7PCS)',
    sku: 'SKU/00007',
    type: 'SALE',
    qty: 12,
    prevStock: 92,
    newStock: 80,
    date: `${d0} 09:30`,
    reason: 'Penjualan #INV/00001',
    operatorName: 'Dian Octaviani',
    referenceNo: '#INV/00001'
  }
];

export const INITIAL_SHIFT: CashierShift = {
  id: 'shift-today',
  shiftNumber: 2,
  outletName: 'Default Outlet',
  cashierName: 'Dian Octaviani',
  startTime: `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 08:00`,
  startingCash: 500000,
  cashSales: 450000,
  nonCashSales: 2650000,
  totalSales: 3100000,
  expectedCash: 950000,
  isOpen: true,
  notes: 'Shift Pagi - Siang aktif'
};
