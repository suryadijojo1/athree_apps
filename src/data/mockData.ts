import { Product, User, Customer, Transaction, StockMovement, CashierShift, KaosStockItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'DIMAS',
    username: 'kasir_dimas',
    pin: '1234',
    role: 'kasir',
    avatarText: 'DI',
    roleLabel: 'Kasir POS'
  },
  {
    id: 'u2',
    name: 'ATHREE(Owner)',
    username: 'admin_athree',
    pin: '1234',
    role: 'admin',
    avatarText: 'AT',
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
  { id: 'c1', name: 'TALSON FC (Jayapura)', phone: '0812-4899-2311', address: 'Abepura, Jayapura' },
  { id: 'c2', name: 'EMEDLUGUN Papuan Club', phone: '0821-9988-1234', address: 'Entrop, Jayapura' },
  { id: 'c3', name: 'MELANESIA SENTANI', phone: '0813-4455-6677', address: 'Sentani, Jayapura' },
  { id: 'c4', name: 'FC Garuda Jayapura (Bpk. Yohan)', phone: '0812-4899-2311', address: 'Abepura, Jayapura' },
  { id: 'c5', name: 'Komunitas Motor Noken', phone: '0821-9988-1234', address: 'Entrop, Jayapura' },
  { id: 'c6', name: 'Dinas Pariwisata Papua', phone: '0813-4455-6677', address: 'Dok V, Kota Jayapura' },
  { id: 'c7', name: 'SMA Negeri 1 Jayapura (OSIS)', phone: '0852-3322-1100', address: 'Kotaraja' }
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
const d5 = getRelativeIsoDate(5);
const d6 = getRelativeIsoDate(6);
const d7 = getRelativeIsoDate(7);

export const INITIAL_SALES: string[] = [
  'Kasir (Dimas)',
  'Admin (DEAZBAR)'
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-41438',
    invoiceNo: '#ORD/41438',
    date: `${d1} 14:15`,
    dueDate: `${d0} 16:00`,
    customer: INITIAL_CUSTOMERS[1],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p3',
        name: 'JERSEY FULL PRINTING (ATASAN + CELANA)',
        sku: 'SKU/00008',
        price: 260000,
        costPrice: 165000,
        quantity: 18,
        notes: 'Desain TALSON Custom Printing Depan & Belakang',
        subtotal: 4680000
      },
      {
        productId: 'p7',
        name: 'TAMBAHAN KERAH POLO',
        sku: 'SKU/00010',
        price: 20000,
        costPrice: 9000,
        quantity: 18,
        notes: 'Kerah Polo warna Hitam variasi Merah',
        subtotal: 360000
      }
    ],
    subtotal: 5040000,
    discount: 40000,
    tax: 0,
    total: 5000000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 3000000,
    remainingAmount: 2000000,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'ATHREE(Owner)',
    cashierId: 'u2',
    notes: 'Seragam TALSON Jayapura - DP 3jt via Transfer Bank'
  },
  {
    id: 'tx-82687',
    invoiceNo: '#INV/82687',
    date: `${d1} 11:30`,
    dueDate: `${d0} 17:00`,
    customer: INITIAL_CUSTOMERS[2],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p5',
        name: 'PAKET SABLON + KAOS A3',
        sku: 'SKU/00002',
        price: 90000,
        costPrice: 52000,
        quantity: 24,
        notes: 'Warna kaos hitam combed 30s, sablon emas metalik EMEDLUGUN',
        subtotal: 2160000
      }
    ],
    subtotal: 2160000,
    discount: 0,
    tax: 0,
    total: 2160000,
    paymentMethod: 'QRIS',
    amountPaid: 2160000,
    remainingAmount: 0,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'DIMAS',
    cashierId: 'u1',
    notes: 'Lunas QRIS - Produksi sablon emas metalik'
  },
  {
    id: 'tx-86871',
    invoiceNo: '#ORD/86871',
    date: `${d2} 15:45`,
    dueDate: `${d1} 15:00`,
    customer: INITIAL_CUSTOMERS[3],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p2',
        name: 'JERSEY ATASAN (>7PCS)',
        sku: 'SKU/00007',
        price: 135000,
        costPrice: 90000,
        quantity: 15,
        notes: 'Nomor punggung 1-15 font block emas',
        subtotal: 2025000
      },
      {
        productId: 'p10',
        name: 'SABLON DTF PRINT A3',
        sku: 'SKU/00004',
        price: 35000,
        costPrice: 18000,
        quantity: 15,
        notes: 'Logo Melanesia Sentani dada kiri & belakang',
        subtotal: 525000
      }
    ],
    subtotal: 2550000,
    discount: 50000,
    tax: 0,
    total: 2500000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 1500000,
    remainingAmount: 1000000,
    change: 0,
    status: 'Sedang Dikerjakan',
    cashierName: 'ATHREE(Owner)',
    cashierId: 'u2',
    notes: 'Pesanan Komunitas Melanesia Sentani - DP 1.5jt'
  },
  {
    id: 'tx-43814',
    invoiceNo: '#INV/43814',
    date: `${d1} 08:20`,
    dueDate: `${d1} 17:00`,
    customer: INITIAL_CUSTOMERS[6],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p5',
        name: 'PAKET SABLON + KAOS A3',
        sku: 'SKU/00002',
        price: 90000,
        costPrice: 52000,
        quantity: 4,
        notes: 'Kaos Polos Hitam Size L - Event Pariwisata',
        subtotal: 360000
      }
    ],
    subtotal: 360000,
    discount: 0,
    tax: 0,
    total: 360000,
    paymentMethod: 'Tunai',
    amountPaid: 400000,
    remainingAmount: 0,
    change: 40000,
    status: 'Selesai',
    cashierName: 'DIMAS',
    cashierId: 'u1',
    notes: 'Lunas tunai kasir'
  },
  {
    id: 'tx-39983',
    invoiceNo: '#INV/39983',
    date: `${d3} 04:50`,
    dueDate: `${d2} 16:00`,
    customer: INITIAL_CUSTOMERS[4],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p2',
        name: 'JERSEY ATASAN (>7PCS)',
        sku: 'SKU/00007',
        price: 135000,
        costPrice: 90000,
        quantity: 8,
        notes: 'Jersey Atasan Garuda Jayapura',
        subtotal: 1080000
      },
      {
        productId: 'p7',
        name: 'TAMBAHAN KERAH POLO',
        sku: 'SKU/00010',
        price: 20000,
        costPrice: 9000,
        quantity: 8,
        notes: 'Kerah Polo variasi',
        subtotal: 160000
      }
    ],
    subtotal: 1240000,
    discount: 40000,
    tax: 0,
    total: 1200000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 1200000,
    remainingAmount: 0,
    change: 0,
    status: 'Selesai',
    cashierName: 'ATHREE(Owner)',
    cashierId: 'u2',
    notes: 'Selesai tepat waktu'
  },
  {
    id: 'tx-18529',
    invoiceNo: '#INV/18529',
    date: `${d5} 07:20`,
    dueDate: `${d5} 12:00`,
    customer: INITIAL_CUSTOMERS[0],
    orderType: 'Kasir (Dimas)',
    items: [
      {
        productId: 'p13',
        name: 'KAOS POLOS COTTON COMBED 30S',
        sku: 'SKU/00014',
        price: 65000,
        costPrice: 42000,
        quantity: 2,
        notes: 'Kaos polos hitam & putih',
        subtotal: 130000
      }
    ],
    subtotal: 130000,
    discount: 0,
    tax: 0,
    total: 130000,
    paymentMethod: 'Tunai',
    amountPaid: 150000,
    remainingAmount: 0,
    change: 20000,
    status: 'Selesai',
    cashierName: 'DIMAS',
    cashierId: 'u1',
    notes: 'Pembelian langsung walk-in'
  },
  {
    id: 'tx-11028',
    invoiceNo: '#INV/11028',
    date: `${d6} 05:39`,
    dueDate: `${d5} 16:00`,
    customer: INITIAL_CUSTOMERS[5],
    orderType: 'Admin (DEAZBAR)',
    items: [
      {
        productId: 'p3',
        name: 'JERSEY FULL PRINTING (ATASAN + CELANA)',
        sku: 'SKU/00008',
        price: 260000,
        costPrice: 165000,
        quantity: 4,
        notes: 'Jersey Touring Komunitas Motor Noken',
        subtotal: 1040000
      }
    ],
    subtotal: 1040000,
    discount: 0,
    tax: 0,
    total: 1040000,
    paymentMethod: 'Transfer Bank',
    amountPaid: 1040000,
    remainingAmount: 0,
    change: 0,
    status: 'Selesai',
    cashierName: 'ATHREE(Owner)',
    cashierId: 'u2',
    notes: 'Lunas Transfer Bank'
  }
];

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] = [
  {
    id: 'sm-1',
    productId: 'p3',
    productName: 'JERSEY FULL PRINTING (ATASAN + CELANA)',
    sku: 'SKU/00008',
    type: 'SALE',
    qty: 18,
    prevStock: 48,
    newStock: 30,
    date: `${d1} 14:15`,
    reason: 'Penjualan Pesanan #ORD/41438 (TALSON)',
    operatorName: 'ATHREE(Owner)',
    referenceNo: '#ORD/41438'
  },
  {
    id: 'sm-2',
    productId: 'p5',
    productName: 'PAKET SABLON + KAOS A3',
    sku: 'SKU/00002',
    type: 'SALE',
    qty: 24,
    prevStock: 63,
    newStock: 39,
    date: `${d1} 11:30`,
    reason: 'Penjualan Kasir #INV/82687 (EMEDLUGUN)',
    operatorName: 'DIMAS',
    referenceNo: '#INV/82687'
  },
  {
    id: 'sm-3',
    productId: 'p2',
    productName: 'JERSEY ATASAN (>7PCS)',
    sku: 'SKU/00007',
    type: 'SALE',
    qty: 15,
    prevStock: 92,
    newStock: 77,
    date: `${d2} 15:45`,
    reason: 'Penjualan Pesanan #ORD/86871 (MELANESIA)',
    operatorName: 'ATHREE(Owner)',
    referenceNo: '#ORD/86871'
  },
  {
    id: 'sm-4',
    productId: 'p5',
    productName: 'PAKET SABLON + KAOS A3',
    sku: 'SKU/00002',
    type: 'SALE',
    qty: 4,
    prevStock: 43,
    newStock: 39,
    date: `${d1} 08:20`,
    reason: 'Penjualan Kasir #INV/43814',
    operatorName: 'DIMAS',
    referenceNo: '#INV/43814'
  }
];

export const INITIAL_SHIFT: CashierShift = {
  id: 'shift-today',
  shiftNumber: 1,
  outletName: 'Athree Studio Jayapura',
  cashierName: 'DIMAS',
  startTime: `${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 08:00`,
  startTimestamp: Date.now(),
  startingCash: 500000,
  cashSales: 0,
  nonCashSales: 0,
  totalSales: 0,
  expectedCash: 500000,
  isOpen: true,
  notes: 'Shift Pagi - Siang aktif Kasir Dimas'
};
