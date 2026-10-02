import type { Product, Transaction, CashFlowRecord } from '../types';

export type EntityType = 'product' | 'transaction' | 'cash_flow';
export type OperationCategory = 'INSERT' | 'UPDATE' | 'NO_CHANGE' | 'CONFLICT';

export interface FieldValidationError {
  field: string;
  value: any;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: FieldValidationError[];
  warnings: FieldValidationError[];
  sanitized: any;
}

export interface ConflictResolution {
  field: string;
  existingValue: any;
  incomingValue: any;
  discrepancyDescription: string;
  recommendedStrategy: 'LATEST_WINS' | 'CONSERVE_STOCK' | 'SERVER_TRUTH' | 'SMART_MERGE';
  recommendationExplanation: string;
  suggestedResolvedValue: any;
}

export interface AnalysisItemResult {
  id: string;
  identifier: string; // e.g. SKU or InvoiceNo or ID
  entityType: EntityType;
  operation: OperationCategory;
  summary: string;
  validation: ValidationResult;
  conflicts: ConflictResolution[];
  sqlUpsert: string;
  cleanJson: any;
}

export interface BatchAnalysisReport {
  timestamp: string;
  totalRecords: number;
  insertCount: number;
  updateCount: number;
  noChangeCount: number;
  conflictCount: number;
  invalidCount: number;
  items: AnalysisItemResult[];
  combinedSql: string;
  cleanStructuredPayload: {
    products: Product[];
    transactions: Transaction[];
    cashFlowRecords: CashFlowRecord[];
  };
}

// ============================================================================
// 1. VALIDATION ENGINE (Memvalidasi format data: #ORD/xxxx, stok, nama produk)
// ============================================================================

/**
 * Validates Order / Invoice Number format.
 * Expected format: #ORD/YYYYMMDD/xxxx or #ORD/xxxx or #INV/xxxx or #PL/xxxx
 */
export function validateOrderInvoiceNumber(invoiceNo: any): { isValid: boolean; message?: string; sanitized: string } {
  if (typeof invoiceNo !== 'string' || !invoiceNo.trim()) {
    return {
      isValid: false,
      message: 'Nomor order / invoice wajib diisi dan berupa string non-kosong.',
      sanitized: `#ORD/${new Date().toISOString().slice(2, 10).replace(/-/g, '')}/${Math.floor(1000 + Math.random() * 9000)}`
    };
  }

  let cleaned = invoiceNo.trim().toUpperCase();
  if (!cleaned.startsWith('#')) {
    cleaned = '#' + cleaned;
  }

  // Regex format check: #ORD/..., #INV/..., #PL/...
  const pattern = /^#(ORD|INV|PL)\/[\w\d\-\/]+$/i;
  if (!pattern.test(cleaned)) {
    return {
      isValid: false,
      message: `Format nomor order "${invoiceNo}" tidak standar. Format yang valid contohnya: #ORD/20261001/0001 atau #INV/00001`,
      sanitized: cleaned
    };
  }

  return { isValid: true, sanitized: cleaned };
}

/**
 * Validates product details (nama produk, stok, sku, harga)
 */
export function validateProductFormat(product: any): ValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: FieldValidationError[] = [];
  const sanitized: any = { ...product };

  // 1. Validate Product Name
  if (!product.name || typeof product.name !== 'string' || product.name.trim().length < 2) {
    errors.push({
      field: 'name',
      value: product.name,
      message: 'Nama produk wajib diisi dan minimal 2 karakter.',
      severity: 'error'
    });
    sanitized.name = (product.name && typeof product.name === 'string') ? product.name.trim() : 'Produk Tanpa Nama';
  } else {
    sanitized.name = product.name.trim();
  }

  // 2. Validate Stock
  const stockNum = Number(product.stock);
  if (isNaN(stockNum) || !Number.isInteger(stockNum)) {
    errors.push({
      field: 'stock',
      value: product.stock,
      message: 'Jumlah stok harus berupa bilangan bulat (integer).',
      severity: 'error'
    });
    sanitized.stock = Math.max(0, parseInt(String(product.stock || 0), 10) || 0);
  } else if (stockNum < 0) {
    errors.push({
      field: 'stock',
      value: product.stock,
      message: 'Jumlah stok tidak boleh bernilai negatif (< 0).',
      severity: 'error'
    });
    sanitized.stock = 0;
  } else {
    sanitized.stock = stockNum;
  }

  // 3. Validate SKU
  if (!product.sku || typeof product.sku !== 'string' || !product.sku.trim()) {
    const generatedSku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    warnings.push({
      field: 'sku',
      value: product.sku,
      message: `SKU produk kosong. Sistem menghasilkan SKU otomatis: ${generatedSku}`,
      severity: 'warning'
    });
    sanitized.sku = generatedSku;
  } else {
    sanitized.sku = product.sku.trim().toUpperCase();
  }

  // 4. Validate Price & Cost Price
  const priceNum = Number(product.price);
  if (isNaN(priceNum) || priceNum < 0) {
    errors.push({
      field: 'price',
      value: product.price,
      message: 'Harga jual harus berupa nilai numerik positif (>= 0).',
      severity: 'error'
    });
    sanitized.price = 0;
  } else {
    sanitized.price = priceNum;
  }

  const costNum = Number(product.costPrice ?? 0);
  sanitized.costPrice = (isNaN(costNum) || costNum < 0) ? 0 : costNum;

  // Defaults
  sanitized.id = product.id ? String(product.id) : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  sanitized.category = product.category ? String(product.category).trim() : 'Umum';
  sanitized.minStock = typeof product.minStock === 'number' ? Math.max(0, product.minStock) : 5;
  sanitized.unit = product.unit ? String(product.unit).trim() : 'Pcs';
  sanitized.colorBadge = product.colorBadge || 'bg-blue-600';
  sanitized.initials = product.initials || sanitized.name.slice(0, 2).toUpperCase();
  sanitized.isFavorite = Boolean(product.isFavorite);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitized
  };
}

/**
 * Validates Transaction / Order format (#ORD/xxxx, items, total, customer)
 */
export function validateTransactionFormat(tx: any): ValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: FieldValidationError[] = [];
  const sanitized: any = { ...tx };

  // 1. Validate Order / Invoice Number (#ORD/xxxx)
  const invValidation = validateOrderInvoiceNumber(tx.invoiceNo);
  if (!invValidation.isValid) {
    errors.push({
      field: 'invoiceNo',
      value: tx.invoiceNo,
      message: invValidation.message || 'Format nomor order tidak valid.',
      severity: 'error'
    });
  }
  sanitized.invoiceNo = invValidation.sanitized;

  // 2. Validate Items Array
  if (!Array.isArray(tx.items) || tx.items.length === 0) {
    errors.push({
      field: 'items',
      value: tx.items,
      message: 'Transaksi pesanan wajib memiliki minimal 1 rincian item.',
      severity: 'error'
    });
    sanitized.items = [];
  } else {
    sanitized.items = tx.items.map((item: any, idx: number) => {
      const qty = Number(item.quantity);
      const prc = Number(item.price);
      const validQty = (!isNaN(qty) && qty > 0) ? Math.floor(qty) : 1;
      const validPrc = (!isNaN(prc) && prc >= 0) ? prc : 0;
      return {
        id: item.id || `item_${idx}_${Date.now()}`,
        name: item.name ? String(item.name).trim() : 'Item',
        quantity: validQty,
        price: validPrc,
        subtotal: validQty * validPrc,
        notes: item.notes ? String(item.notes).trim() : undefined,
        kaosColor: item.kaosColor || undefined,
        kaosSize: item.kaosSize || undefined,
      };
    });
  }

  // 3. Validate Total Amount
  const totalNum = Number(tx.total);
  if (isNaN(totalNum) || totalNum < 0) {
    errors.push({
      field: 'total',
      value: tx.total,
      message: 'Total nilai transaksi harus berupa angka positif.',
      severity: 'error'
    });
    sanitized.total = sanitized.items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0);
  } else {
    sanitized.total = totalNum;
  }

  // 4. Validate Customer
  if (!tx.customer || typeof tx.customer !== 'object') {
    sanitized.customer = {
      id: 'cust_umum',
      name: 'Pelanggan Umum',
      phone: '-'
    };
  } else {
    sanitized.customer = {
      id: tx.customer.id || 'cust_umum',
      name: (tx.customer.name && String(tx.customer.name).trim()) || 'Pelanggan Umum',
      phone: (tx.customer.phone && String(tx.customer.phone).trim()) || '-'
    };
  }

  // Defaults
  sanitized.id = tx.id ? String(tx.id) : `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  sanitized.date = tx.date ? String(tx.date) : new Date().toISOString().slice(0, 10);
  sanitized.dueDate = tx.dueDate ? String(tx.dueDate) : sanitized.date;
  sanitized.time = tx.time ? String(tx.time) : (sanitized.date.length > 10 ? sanitized.date.slice(11, 16) : '00:00');
  sanitized.paymentMethod = tx.paymentMethod || 'Tunai';
  sanitized.amountPaid = typeof tx.amountPaid === 'number' ? tx.amountPaid : (typeof tx.paidAmount === 'number' ? tx.paidAmount : sanitized.total);
  sanitized.change = typeof tx.change === 'number' ? tx.change : (typeof tx.changeAmount === 'number' ? tx.changeAmount : 0);
  sanitized.remainingAmount = Math.max(0, sanitized.total - sanitized.amountPaid);
  sanitized.status = tx.status || (sanitized.remainingAmount > 0 ? 'Belum Lunas' : 'Selesai');
  sanitized.paymentStatus = sanitized.remainingAmount > 0 ? 'PIUTANG' : 'LUNAS';
  sanitized.cashierName = tx.cashierName ? String(tx.cashierName).trim() : 'Kasir';
  sanitized.cashierId = tx.cashierId || 'cashier_default';
  sanitized.orderType = tx.orderType ? String(tx.orderType).trim() : 'Kasir';
  sanitized.subtotal = typeof tx.subtotal === 'number' ? tx.subtotal : sanitized.total;
  sanitized.discount = typeof tx.discount === 'number' ? tx.discount : 0;
  sanitized.tax = typeof tx.tax === 'number' ? tx.tax : 0;
  sanitized.vendorName = tx.vendorName ? String(tx.vendorName).trim() : undefined;
  sanitized.vendorCost = typeof tx.vendorCost === 'number' ? Math.max(0, tx.vendorCost) : 0;
  sanitized.shippingCost = typeof tx.shippingCost === 'number' ? Math.max(0, tx.shippingCost) : 0;

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitized
  };
}

// ============================================================================
// 2. CONFLICT RESOLUTION ENGINE (Nomor invoice sama tapi stok berbeda, dll)
// ============================================================================

export function detectConflicts(
  entityType: EntityType,
  incoming: any,
  existing: any,
  currentProducts: Product[] = []
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];
  if (!existing) return conflicts;

  if (entityType === 'transaction') {
    // Conflict 1: Discrepancy in Invoice Stock vs Current Inventory Stock
    if (Array.isArray(incoming.items)) {
      for (const item of incoming.items) {
        const prod = currentProducts.find((p) => p.name.toLowerCase() === item.name.toLowerCase() || p.id === item.id);
        if (prod) {
          // Check if item quantity in invoice exceeds current stock
          if (prod.stock < item.quantity && existing.status !== 'Selesai') {
            conflicts.push({
              field: `stock_${prod.name}`,
              existingValue: prod.stock,
              incomingValue: item.quantity,
              discrepancyDescription: `Nomor order ${incoming.invoiceNo} memesan ${item.quantity} pcs "${prod.name}", namun stok sistem hanya tersisa ${prod.stock} pcs.`,
              recommendedStrategy: 'CONSERVE_STOCK',
              recommendationExplanation:
                'Rekomendasi: Terapkan strategi Pengamanan Stok (Stock Conservation). Kunci pesanan dan catat penyesuaian mutasi agar tidak terjadi over-selling fisik.',
              suggestedResolvedValue: {
                adjustedQuantity: Math.min(prod.stock, item.quantity),
                backorderQuantity: Math.max(0, item.quantity - prod.stock)
              }
            });
          }
        }
      }
    }

    // Conflict 2: Same Invoice No but different Totals or Status
    if (incoming.invoiceNo === existing.invoiceNo) {
      if (Math.abs((incoming.total || 0) - (existing.total || 0)) > 1) {
        const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || incoming.date).getTime() || 0;
        const existingTime = new Date(existing.updatedAt || existing.createdAt || existing.date).getTime() || 0;
        const latestWins = incomingTime >= existingTime;

        conflicts.push({
          field: 'total',
          existingValue: existing.total,
          incomingValue: incoming.total,
          discrepancyDescription: `Nomor invoice sama (${incoming.invoiceNo}) memiliki nominal berbeda. Server: Rp ${existing.total?.toLocaleString('id-ID')}, Data Masuk: Rp ${incoming.total?.toLocaleString('id-ID')}.`,
          recommendedStrategy: 'LATEST_WINS',
          recommendationExplanation: latestWins
            ? 'Rekomendasi: Data masuk memiliki timestamp lebih baru (Revisi Faktur). Terapkan nilai data masuk.'
            : 'Rekomendasi: Data server tercatat lebih baru. Pertahankan nilai server untuk mencegah penimpaan data usang.',
          suggestedResolvedValue: latestWins ? incoming.total : existing.total
        });
      }

      if (incoming.status !== existing.status) {
        const isServerSettled = existing.status === 'Selesai' && incoming.status === 'Belum Lunas';
        conflicts.push({
          field: 'status',
          existingValue: existing.status,
          incomingValue: incoming.status,
          discrepancyDescription: `Status order berbeda: Server "${existing.status}" vs Data Masuk "${incoming.status}".`,
          recommendedStrategy: isServerSettled ? 'SERVER_TRUTH' : 'LATEST_WINS',
          recommendationExplanation: isServerSettled
            ? 'Rekomendasi: Status server sudah "Selesai" (Lunas). Jangan timpa menjadi piutang kembali.'
            : 'Rekomendasi: Perbarui status sesuai proses operasional terkini.',
          suggestedResolvedValue: isServerSettled ? existing.status : incoming.status
        });
      }
    }
  } else if (entityType === 'product') {
    // Conflict 3: Same SKU / ID but Stock Discrepancy
    if (incoming.stock !== existing.stock) {
      const incomingTime = new Date(incoming.updatedAt || incoming.createdAt || 0).getTime() || 0;
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime() || 0;
      const latestWins = incomingTime >= existingTime;

      conflicts.push({
        field: 'stock',
        existingValue: existing.stock,
        incomingValue: incoming.stock,
        discrepancyDescription: `Stok produk "${incoming.name}" (SKU: ${incoming.sku}) berbeda. Server: ${existing.stock} pcs, Data Masuk: ${incoming.stock} pcs.`,
        recommendedStrategy: 'CONSERVE_STOCK',
        recommendationExplanation:
          'Rekomendasi: Lakukan verifikasi stok fisik. Jika pembaruan berasal dari import stok baru, gunakan nilai masuk dan catat audit log penyesuaian.',
        suggestedResolvedValue: latestWins ? incoming.stock : existing.stock
      });
    }

    if (incoming.price !== existing.price) {
      conflicts.push({
        field: 'price',
        existingValue: existing.price,
        incomingValue: incoming.price,
        discrepancyDescription: `Harga produk "${incoming.name}" berselisih. Server: Rp ${existing.price?.toLocaleString('id-ID')} vs Masuk: Rp ${incoming.price?.toLocaleString('id-ID')}.`,
        recommendedStrategy: 'LATEST_WINS',
        recommendationExplanation: 'Rekomendasi: Terapkan harga terbaru dengan strategi Latest Timestamp Wins.',
        suggestedResolvedValue: incoming.price
      });
    }
  }

  return conflicts;
}

// ============================================================================
// 3. SQL UPSERT GENERATOR (PostgreSQL / Cloud SQL)
// ============================================================================

/**
 * Escapes string safely for standard SQL literals
 */
export function sqlEscape(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

/**
 * Generates SQL Upsert statement for a Product
 */
export function generateProductUpsertSQL(p: Product): string {
  const id = sqlEscape(p.id);
  const name = sqlEscape(p.name);
  const sku = sqlEscape(p.sku);
  const category = sqlEscape(p.category || 'Umum');
  const price = Number(p.price) || 0;
  const costPrice = Number(p.costPrice) || 0;
  const stock = Math.max(0, parseInt(String(p.stock || 0), 10));
  const minStock = Math.max(0, parseInt(String(p.minStock || 5), 10));
  const unit = sqlEscape(p.unit || 'Pcs');
  const colorBadge = sqlEscape(p.colorBadge || 'bg-blue-600');
  const initials = sqlEscape(p.initials || p.name.slice(0, 2).toUpperCase());
  const isFavorite = p.isFavorite ? 'TRUE' : 'FALSE';

  return `INSERT INTO products (
  id, name, sku, category, price, cost_price, stock, min_stock, unit, color_badge, initials, is_favorite, created_at
) VALUES (
  ${id}, ${name}, ${sku}, ${category}, ${price}, ${costPrice}, ${stock}, ${minStock}, ${unit}, ${colorBadge}, ${initials}, ${isFavorite}, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sku = EXCLUDED.sku,
  category = EXCLUDED.category,
  price = EXCLUDED.price,
  cost_price = EXCLUDED.cost_price,
  stock = EXCLUDED.stock,
  min_stock = EXCLUDED.min_stock,
  unit = EXCLUDED.unit,
  color_badge = EXCLUDED.color_badge,
  initials = EXCLUDED.initials,
  is_favorite = EXCLUDED.is_favorite
RETURNING *;`;
}

/**
 * Generates SQL Upsert statement for a Transaction / Order
 */
export function generateTransactionUpsertSQL(t: Transaction): string {
  const id = sqlEscape(t.id);
  const invoiceNo = sqlEscape(t.invoiceNo);
  const date = sqlEscape(t.date || new Date().toISOString().slice(0, 10));
  const time = sqlEscape((t as any).time || (t.date && t.date.length > 10 ? t.date.slice(11, 16) : '00:00'));
  const custName = sqlEscape(t.customer?.name || 'Pelanggan Umum');
  const custPhone = sqlEscape(t.customer?.phone || '-');
  const payMethod = sqlEscape(t.paymentMethod || 'Tunai');
  const total = Number(t.total) || 0;
  const paid = Number(t.amountPaid ?? (t as any).paidAmount) || 0;
  const change = Number(t.change ?? (t as any).changeAmount) || 0;
  const status = sqlEscape(t.status || 'Selesai');
  const cashier = sqlEscape(t.cashierName || 'Kasir');
  const notes = sqlEscape(t.notes || '');
  const itemsJson = sqlEscape(JSON.stringify(t.items || []));

  return `INSERT INTO transactions (
  id, invoice_no, date, time, customer_name, customer_phone, payment_method, total, paid_amount, change_amount, status, cashier_name, notes, items_json, created_at
) VALUES (
  ${id}, ${invoiceNo}, ${date}, ${time}, ${custName}, ${custPhone}, ${payMethod}, ${total}, ${paid}, ${change}, ${status}, ${cashier}, ${notes}, ${itemsJson}, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  invoice_no = EXCLUDED.invoice_no,
  date = EXCLUDED.date,
  time = EXCLUDED.time,
  customer_name = EXCLUDED.customer_name,
  customer_phone = EXCLUDED.customer_phone,
  payment_method = EXCLUDED.payment_method,
  total = EXCLUDED.total,
  paid_amount = EXCLUDED.paid_amount,
  change_amount = EXCLUDED.change_amount,
  status = EXCLUDED.status,
  cashier_name = EXCLUDED.cashier_name,
  notes = EXCLUDED.notes,
  items_json = EXCLUDED.items_json
RETURNING *;`;
}

/**
 * Generates SQL Upsert statement for a Cash Flow Record
 */
export function generateCashFlowUpsertSQL(cf: CashFlowRecord): string {
  const id = sqlEscape(cf.id);
  const type = sqlEscape(cf.type || 'PENGELUARAN');
  const category = sqlEscape(cf.category || 'Operasional');
  const amount = Number(cf.amount) || 0;
  const description = sqlEscape(cf.description || '-');
  const date = sqlEscape(cf.date || new Date().toISOString().slice(0, 10));
  const recordedBy = sqlEscape(cf.recordedBy || 'Admin');

  return `INSERT INTO cash_flow_records (
  id, type, category, amount, description, date, recorded_by, created_at
) VALUES (
  ${id}, ${type}, ${category}, ${amount}, ${description}, ${date}, ${recordedBy}, NOW()
)
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  category = EXCLUDED.category,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  date = EXCLUDED.date,
  recorded_by = EXCLUDED.recorded_by
RETURNING *;`;
}

// ============================================================================
// 4. MAIN ANALYSIS PIPELINE (Menganalisis Insert vs Update/Upsert, Validasi, & Resolusi)
// ============================================================================

export function analyzeIncomingPayload(
  payload: {
    products?: any[];
    transactions?: any[];
    cashFlowRecords?: any[];
  },
  existingState?: {
    products?: Product[];
    transactions?: Transaction[];
    cashFlowRecords?: CashFlowRecord[];
  }
): BatchAnalysisReport {
  const existingProducts = existingState?.products || [];
  const existingTransactions = existingState?.transactions || [];
  const existingCashFlow = existingState?.cashFlowRecords || [];

  const existingProductMap = new Map<string, Product>();
  const existingProductSkuMap = new Map<string, Product>();
  existingProducts.forEach((p) => {
    existingProductMap.set(p.id, p);
    if (p.sku) existingProductSkuMap.set(p.sku.toUpperCase(), p);
  });

  const existingTxMap = new Map<string, Transaction>();
  const existingTxInvMap = new Map<string, Transaction>();
  existingTransactions.forEach((t) => {
    existingTxMap.set(t.id, t);
    if (t.invoiceNo) existingTxInvMap.set(t.invoiceNo.toUpperCase(), t);
  });

  const existingCashFlowMap = new Map<string, CashFlowRecord>();
  existingCashFlow.forEach((cf) => existingCashFlowMap.set(cf.id, cf));

  const items: AnalysisItemResult[] = [];
  const sqlStatements: string[] = [];
  const cleanProducts: Product[] = [];
  const cleanTransactions: Transaction[] = [];
  const cleanCashFlow: CashFlowRecord[] = [];

  let insertCount = 0;
  let updateCount = 0;
  let noChangeCount = 0;
  let conflictCount = 0;
  let invalidCount = 0;

  // 1. Process Products
  if (Array.isArray(payload.products)) {
    payload.products.forEach((rawP) => {
      const validation = validateProductFormat(rawP);
      if (!validation.isValid) invalidCount++;

      const sanitizedP = validation.sanitized as Product;
      const existing = existingProductMap.get(sanitizedP.id) || existingProductSkuMap.get(sanitizedP.sku.toUpperCase());
      const conflicts = detectConflicts('product', sanitizedP, existing, existingProducts);

      let op: OperationCategory = 'INSERT';
      let summary = '';

      if (conflicts.length > 0) {
        op = 'CONFLICT';
        conflictCount++;
        summary = `Konflik terdeteksi (${conflicts.length} perselisihan) pada SKU "${sanitizedP.sku}"`;
      } else if (!existing) {
        op = 'INSERT';
        insertCount++;
        summary = `Data baru (Insert): Produk "${sanitizedP.name}" belum terdaftar di database`;
      } else {
        const isIdentical =
          existing.name === sanitizedP.name &&
          existing.price === sanitizedP.price &&
          existing.stock === sanitizedP.stock &&
          existing.costPrice === sanitizedP.costPrice;

        if (isIdentical) {
          op = 'NO_CHANGE';
          noChangeCount++;
          summary = `Data lama identik: Produk "${sanitizedP.name}" sudah sesuai di database`;
        } else {
          op = 'UPDATE';
          updateCount++;
          summary = `Pembaruan data lama (Upsert): Produk "${sanitizedP.name}" mengalami perubahan harga/stok`;
        }
      }

      const sqlUpsert = generateProductUpsertSQL(sanitizedP);
      sqlStatements.push(sqlUpsert);
      cleanProducts.push(sanitizedP);

      items.push({
        id: sanitizedP.id,
        identifier: sanitizedP.sku,
        entityType: 'product',
        operation: op,
        summary,
        validation,
        conflicts,
        sqlUpsert,
        cleanJson: sanitizedP
      });
    });
  }

  // 2. Process Transactions / Orders (#ORD/xxxx)
  if (Array.isArray(payload.transactions)) {
    payload.transactions.forEach((rawTx) => {
      const validation = validateTransactionFormat(rawTx);
      if (!validation.isValid) invalidCount++;

      const sanitizedTx = validation.sanitized as Transaction;
      const existing = existingTxMap.get(sanitizedTx.id) || existingTxInvMap.get(sanitizedTx.invoiceNo.toUpperCase());
      const conflicts = detectConflicts('transaction', sanitizedTx, existing, existingProducts);

      let op: OperationCategory = 'INSERT';
      let summary = '';

      if (conflicts.length > 0) {
        op = 'CONFLICT';
        conflictCount++;
        summary = `Konflik terdeteksi (${conflicts.length} perselisihan) pada nomor faktur "${sanitizedTx.invoiceNo}"`;
      } else if (!existing) {
        op = 'INSERT';
        insertCount++;
        summary = `Data baru (Insert): Nomor Order ${sanitizedTx.invoiceNo} belum ada di sistem database`;
      } else {
        const isIdentical =
          existing.total === sanitizedTx.total &&
          existing.status === sanitizedTx.status &&
          existing.amountPaid === sanitizedTx.amountPaid;

        if (isIdentical) {
          op = 'NO_CHANGE';
          noChangeCount++;
          summary = `Data lama identik: Order ${sanitizedTx.invoiceNo} sudah tercatat di sistem`;
        } else {
          op = 'UPDATE';
          updateCount++;
          summary = `Pembaruan data lama (Upsert): Order ${sanitizedTx.invoiceNo} diperbarui (Revisi/Pembayaran)`;
        }
      }

      const sqlUpsert = generateTransactionUpsertSQL(sanitizedTx);
      sqlStatements.push(sqlUpsert);
      cleanTransactions.push(sanitizedTx);

      items.push({
        id: sanitizedTx.id,
        identifier: sanitizedTx.invoiceNo,
        entityType: 'transaction',
        operation: op,
        summary,
        validation,
        conflicts,
        sqlUpsert,
        cleanJson: sanitizedTx
      });
    });
  }

  // 3. Process Cash Flow Records
  if (Array.isArray(payload.cashFlowRecords)) {
    payload.cashFlowRecords.forEach((rawCf) => {
      const sanitizedCf: CashFlowRecord = {
        id: rawCf.id || `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: (rawCf.type === 'INCOME' || rawCf.type === 'PENDAPATAN') ? 'INCOME' : 'EXPENSE',
        category: rawCf.category ? String(rawCf.category).trim() : 'Operasional',
        amount: Math.max(0, Number(rawCf.amount) || 0),
        description: rawCf.description ? String(rawCf.description).trim() : 'Catatan Kas',
        date: rawCf.date || new Date().toISOString().slice(0, 10),
        recordedBy: rawCf.recordedBy || 'Admin'
      };

      const existing = existingCashFlowMap.get(sanitizedCf.id);
      let op: OperationCategory = existing ? 'UPDATE' : 'INSERT';
      let summary = existing
        ? `Pembaruan data lama (Upsert): Catatan kas "${sanitizedCf.description}"`
        : `Data baru (Insert): Catatan kas baru Rp ${sanitizedCf.amount.toLocaleString('id-ID')}`;

      if (existing) {
        updateCount++;
      } else {
        insertCount++;
      }

      const sqlUpsert = generateCashFlowUpsertSQL(sanitizedCf);
      sqlStatements.push(sqlUpsert);
      cleanCashFlow.push(sanitizedCf);

      items.push({
        id: sanitizedCf.id,
        identifier: sanitizedCf.description.slice(0, 20),
        entityType: 'cash_flow',
        operation: op,
        summary,
        validation: { isValid: true, errors: [], warnings: [], sanitized: sanitizedCf },
        conflicts: [],
        sqlUpsert,
        cleanJson: sanitizedCf
      });
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalRecords: items.length,
    insertCount,
    updateCount,
    noChangeCount,
    conflictCount,
    invalidCount,
    items,
    combinedSql: sqlStatements.join('\n\n'),
    cleanStructuredPayload: {
      products: cleanProducts,
      transactions: cleanTransactions,
      cashFlowRecords: cleanCashFlow
    }
  };
}
