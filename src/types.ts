export type UserRole = 'admin' | 'kasir' | 'staff';

export interface User {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: UserRole;
  avatarText: string;
  roleLabel: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  colorBadge: string;
  initials: string;
  isFavorite?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  costPrice: number;
  quantity: number;
  notes?: string;
  subtotal: number;
}

export type OrderType = 'Kasir (Dimas)' | 'Admin (DEAZBAR)' | string;

export type OrderStatus = 'Selesai' | 'Sedang Dikerjakan' | 'Menunggu' | 'Dibatalkan';

export type PaymentMethod = 'Tunai' | 'QRIS' | 'Transfer Bank' | 'Kartu Debit';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

export interface Transaction {
  id: string;
  invoiceNo: string;
  date: string; // ISO or YYYY-MM-DD HH:mm
  dueDate: string; // Tanggal Jatuh Tempo Penyelesaian (YYYY-MM-DD or YYYY-MM-DD HH:mm)
  customer: Customer;
  orderType: OrderType;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  change: number;
  status: OrderStatus;
  cashierName: string;
  cashierId: string;
  notes?: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'IN' | 'OUT' | 'ADJUST' | 'SALE';
  qty: number;
  prevStock: number;
  newStock: number;
  date: string;
  reason: string;
  operatorName: string;
  referenceNo?: string;
}

export interface CashDenomination {
  k100: number;
  k50: number;
  k20: number;
  k10: number;
  k5: number;
  k2: number;
  k1: number;
  coins: number;
}

export interface PaymentBreakdown {
  cash: number;
  transfer: number;
  qris: number;
  other: number;
}

export interface CashierShift {
  id: string;
  shiftNumber?: number;
  outletName?: string;
  cashierName: string;
  cashierId?: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  cashSales: number;
  nonCashSales: number;
  totalSales: number;
  expectedCash: number;
  actualCash?: number;
  difference?: number;
  isOpen: boolean;
  notes?: string;
  totalTransactions?: number;
  totalDiscount?: number;
  unpaidCount?: number;
  unpaidAmount?: number;
  paymentMethodBreakdown?: PaymentBreakdown;
  cashDenominations?: CashDenomination;
}

export interface CashFlowRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  date: string;
  recordedBy: string;
  createdAt?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  parents?: string[];
}

