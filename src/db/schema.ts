import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, doublePrecision, boolean } from 'drizzle-orm/pg-core';

// Users table (synced with Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('kasir'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Products / Catalog table
export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  category: text('category').notNull(),
  price: doublePrecision('price').notNull(),
  costPrice: doublePrecision('cost_price').default(0),
  stock: integer('stock').default(0),
  minStock: integer('min_stock').default(5),
  unit: text('unit').default('Pcs'),
  colorBadge: text('color_badge'),
  initials: text('initials'),
  isFavorite: boolean('is_favorite').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Transactions / Orders table
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  invoiceNo: text('invoice_no').notNull(),
  date: text('date').notNull(),
  time: text('time').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  paymentMethod: text('payment_method').notNull(),
  total: doublePrecision('total').notNull(),
  paidAmount: doublePrecision('paid_amount').notNull(),
  changeAmount: doublePrecision('change_amount').default(0),
  status: text('status').default('Selesai'),
  cashierName: text('cashier_name'),
  notes: text('notes'),
  itemsJson: text('items_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Cash flow records table (Buku Kas & Pengeluaran)
export const cashFlowRecords = pgTable('cash_flow_records', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  category: text('category').notNull(),
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  recordedBy: text('recorded_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Customers table
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').default(''),
  address: text('address').default(''),
  type: text('type').default('Reguler'),
  discount: doublePrecision('discount').default(0),
  totalSpent: doublePrecision('total_spent').default(0),
  totalOrders: integer('total_orders').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Kaos Stocks table
export const kaosStocks = pgTable('kaos_stocks', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  color: text('color').notNull(),
  hexColor: text('hex_color').default('#000000'),
  size: text('size').notNull(),
  stock: integer('stock').default(0),
  costPrice: doublePrecision('cost_price').default(0),
  sellingPrice: doublePrecision('selling_price').default(0),
  lastRestocked: text('last_restocked'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Shifts table (Riwayat & Kasir Aktif)
export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  shiftNumber: integer('shift_number').default(1),
  outletName: text('outlet_name').default('Athree Studio Jayapura'),
  cashierName: text('cashier_name').notNull(),
  startTime: text('start_time').notNull(),
  startTimestamp: text('start_timestamp'),
  endTime: text('end_time'),
  endTimestamp: text('end_timestamp'),
  startingCash: doublePrecision('starting_cash').default(0),
  cashSales: doublePrecision('cash_sales').default(0),
  nonCashSales: doublePrecision('non_cash_sales').default(0),
  totalSales: doublePrecision('total_sales').default(0),
  expectedCash: doublePrecision('expected_cash').default(0),
  actualCash: doublePrecision('actual_cash'),
  difference: doublePrecision('difference'),
  isOpen: boolean('is_open').default(false),
  notes: text('notes'),
  totalTransactions: integer('total_transactions').default(0),
  detailsJson: text('details_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Stock Movements table
export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  type: text('type').notNull(), // IN / OUT / ADJUSTMENT
  quantity: integer('quantity').notNull(),
  previousStock: integer('previous_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason').notNull(),
  date: text('date').notNull(),
  performedBy: text('performed_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Master Cloud SQL Sync State (Key-value snapshot store for instant real-time synchronization)
export const masterSyncState = pgTable('master_sync_state', {
  id: text('id').primaryKey(), // e.g. 'current_state'
  payloadJson: text('payload_json').notNull(),
  lastUpdated: text('last_updated').notNull(),
  updatedBy: text('updated_by').default('System'),
  createdAt: timestamp('created_at').defaultNow(),
});
