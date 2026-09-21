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
