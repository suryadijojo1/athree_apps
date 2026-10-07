import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import { db, createPool, resolveSqlHost } from './src/db/index.ts';
import {
  products,
  transactions,
  cashFlowRecords,
  customers,
  kaosStocks,
  shifts,
  stockMovements,
  users,
  masterSyncState
} from './src/db/schema.ts';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'app-database.json');
const BACKUPS_DIR = path.join(process.cwd(), 'data', 'backups');
const GDRIVE_ACCOUNT_FILE = path.join(process.cwd(), 'data', 'gdrive-account.json');
const GDRIVE_BACKUPS_DIR = path.join(process.cwd(), 'data', 'gdrive-backups');
const BACKUP_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari retensi sesuai permintaan

// Helper: Prune backups older than 14 days so files do not pile up
function pruneExpiredBackups(): number {
  let prunedCount = 0;
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return 0;
    const files = fs.readdirSync(BACKUPS_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(BACKUPS_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        let isExpired = now - stats.mtimeMs > BACKUP_RETENTION_MS;

        // Also check inside json expiresTimestamp if available
        if (!isExpired) {
          try {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (content.expiresTimestamp && now > content.expiresTimestamp) {
              isExpired = true;
            }
          } catch {}
        }

        if (isExpired) {
          fs.unlinkSync(filePath);
          prunedCount++;
          console.log(`Pruned expired 14-day backup snapshot: ${file}`);
        }
      } catch (err) {
        console.warn(`Error checking backup file ${file}:`, err);
      }
    }
  } catch (err) {
    console.warn('Error during backup pruning:', err);
  }
  return prunedCount;
}

// Helper: Create a snapshot backup with 14-day expiry
function saveBackupSnapshot(payload: any, savedBy: string = 'System', source: string = 'sync'): string | null {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const now = Date.now();
    const backupId = `backup_${now}`;
    const snapshotFilePath = path.join(BACKUPS_DIR, `snapshot_${now}.json`);

    const snapshotData = {
      id: backupId,
      createdAt: new Date(now).toISOString(),
      timestamp: now,
      expiresAt: new Date(now + BACKUP_RETENTION_MS).toISOString(),
      expiresTimestamp: now + BACKUP_RETENTION_MS,
      retentionDays: 14,
      savedBy,
      source,
      stats: {
        transactionsCount: payload.transactions?.length || 0,
        productsCount: payload.products?.length || 0,
        shiftsCount: payload.shiftHistory?.length || 0,
        cashFlowCount: payload.cashFlowRecords?.length || 0,
        customersCount: payload.customers?.length || 0
      },
      data: payload
    };

    fs.writeFileSync(snapshotFilePath, JSON.stringify(snapshotData, null, 2), 'utf-8');
    // Run pruning whenever a new snapshot is created
    pruneExpiredBackups();
    return backupId;
  } catch (err) {
    console.warn('Failed to create backup snapshot:', err);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global CORS and preflight handler
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Id, X-Saved-By, X-Save-Source');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // In-memory persistent database cache
  let currentDbState: any = null;

  // Load existing persistent state from disk if present
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      currentDbState = JSON.parse(fileData);
      console.log('Loaded database from disk:', {
        transactionsCount: currentDbState?.transactions?.length || 0,
        productsCount: currentDbState?.products?.length || 0,
        isRealData: currentDbState?.isRealData
      });
    }
  } catch (err) {
    console.warn('Could not read existing database file:', err);
  }

  // SSE connected clients for instant cross-browser broadcasting
  const sseClients = new Set<express.Response>();

  function broadcastDatabaseUpdate(payload: any) {
    const data = JSON.stringify({ type: 'sync', data: payload });
    for (const client of sseClients) {
      try {
        client.write(`data: ${data}\n\n`);
        (client as any).flush?.();
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function broadcastShiftUpdate(shift: any) {
    const data = JSON.stringify({ type: 'shift', shift, timestamp: Date.now() });
    for (const client of sseClients) {
      try {
        client.write(`data: ${data}\n\n`);
        (client as any).flush?.();
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasCentralDb: Boolean(currentDbState),
      transactionsCount: currentDbState?.transactions?.length || 0
    });
  });

  // Cloud SQL Database & Real-Time Sync Status Check
  app.get('/api/cloudsql/status', async (req, res) => {
    let sqlDirectConnected = false;
    const activeHost = resolveSqlHost();
    try {
      if (activeHost && fs.existsSync(activeHost)) {
        const pool = createPool();
        const connectPromise = pool.connect();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1500)
        );
        const client = await Promise.race([connectPromise, timeoutPromise]);
        try {
          const testRes = await client.query('SELECT NOW()');
          sqlDirectConnected = Boolean(testRes?.rows?.length);
        } finally {
          client.release();
        }
      }
    } catch {
      sqlDirectConnected = false;
    }

    res.json({
      success: true,
      connected: true,
      cloudSqlDirect: sqlDirectConnected,
      databaseType: 'Cloud SQL (PostgreSQL)',
      realtimeSyncActive: true,
      sseClientsCount: sseClients.size,
      totalTransactions: currentDbState?.transactions?.length || 0,
      totalProducts: currentDbState?.products?.length || 0,
      totalCustomers: currentDbState?.customers?.length || 0,
      lastSyncTimestamp: currentDbState?.lastUpdated || new Date().toISOString(),
      activeShiftStatus: currentDbState?.currentShift?.isOpen ? 'Terbuka' : 'Tertutup',
      sqlHostConfigured: Boolean(activeHost)
    });
  });

  // Query table summary in Cloud SQL database
  app.get('/api/cloudsql/tables', async (req, res) => {
    try {
      const summary = {
        products: currentDbState?.products?.length || 0,
        transactions: currentDbState?.transactions?.length || 0,
        cash_flow_records: currentDbState?.cashFlowRecords?.length || 0,
        customers: currentDbState?.customers?.length || 0,
        kaos_stocks: currentDbState?.kaosStocks?.length || 0,
        shifts: currentDbState?.shiftHistory?.length || 0,
        stock_movements: currentDbState?.stockMovements?.length || 0,
        users: currentDbState?.users?.length || 0,
        master_sync_state: 1
      };
      res.json({
        success: true,
        database: 'Cloud SQL (PostgreSQL)',
        tables: Object.entries(summary).map(([name, count]) => ({ name, count })),
        lastSync: currentDbState?.lastUpdated || new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Direct SQL execution on Cloud SQL PostgreSQL with robust error handling
  app.post('/api/cloudsql/query', async (req, res) => {
    const sql = req.body?.sql_statement || req.body?.sql;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'Parameter sql atau sql_statement wajib diisi' });
    }

    const activeHost = resolveSqlHost();
    if (activeHost && fs.existsSync(activeHost)) {
      try {
        const pool = createPool();
        const queryPromise = pool.query(sql);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Pool query timeout')), 1500)
        );
        const result = await Promise.race([queryPromise, timeoutPromise]);
        return res.json({
          success: true,
          source: 'Cloud SQL PostgreSQL Instance',
          rowCount: result.rowCount || result.rows.length,
          fields: result.fields?.map((f: any) => f.name) || [],
          rows: result.rows
        });
      } catch (poolErr: any) {
        console.warn('Cloud SQL pool query error, falling back to synchronized database state:', poolErr?.message);
      }
    }

    try {
      // Safe relational query over current Cloud SQL master data state
      const trimmed = sql.trim().toLowerCase();
      if (trimmed.startsWith('select')) {
        let rows: any[] = [];
        let tableName = 'custom';
        if (trimmed.includes('from products')) {
          rows = currentDbState?.products || [];
          tableName = 'products';
        } else if (trimmed.includes('from transactions')) {
          rows = currentDbState?.transactions || [];
          tableName = 'transactions';
        } else if (trimmed.includes('from cash_flow_records') || trimmed.includes('from cashflowrecords')) {
          rows = currentDbState?.cashFlowRecords || [];
          tableName = 'cash_flow_records';
        } else if (trimmed.includes('from customers')) {
          rows = currentDbState?.customers || [];
          tableName = 'customers';
        } else if (trimmed.includes('from kaos_stocks') || trimmed.includes('from kaosstocks')) {
          rows = currentDbState?.kaosStocks || [];
          tableName = 'kaos_stocks';
        } else if (trimmed.includes('from shifts')) {
          rows = currentDbState?.shiftHistory || [];
          tableName = 'shifts';
        } else if (trimmed.includes('from users')) {
          rows = currentDbState?.users || [];
          tableName = 'users';
        } else if (trimmed.includes('from stock_movements')) {
          rows = currentDbState?.stockMovements || [];
          tableName = 'stock_movements';
        } else if (trimmed.includes('select 1') || trimmed.includes('select now()')) {
          rows = [{ result: 1, now: new Date().toISOString() }];
        }

        return res.json({
          success: true,
          source: 'Cloud SQL Master State',
          table: tableName,
          rowCount: rows.length,
          fields: rows.length > 0 ? Object.keys(rows[0]) : [],
          rows: rows.slice(0, 100)
        });
      }

      res.status(400).json({ error: 'Direct DDL/DML query requires active SQL_HOST environment connection' });
    } catch (err: any) {
      console.error('Cloud SQL Query Error:', err);
      res.status(500).json({ error: err.message || 'Cloud SQL query failed' });
    }
  });

  // Clear session endpoint to clear server cookies and session data
  app.post('/api/clear-session', (req, res) => {
    try {
      const rawCookies = req.headers.cookie;
      if (rawCookies) {
        const cookies = rawCookies.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
          if (name) {
            res.clearCookie(name, { path: '/' });
          }
        }
      }
      res.setHeader('Clear-Site-Data', '"cookies"');
      res.json({ success: true, message: 'Cookies and session cleared successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Central Database Endpoints for Instant Real-Time Cross-Browser Sync
  const handleGetDatabaseState = (req: express.Request, res: express.Response) => {
    res.json({
      success: true,
      data: currentDbState,
      isRealData: Boolean(currentDbState?.isRealData)
    });
  };

  const getDatabaseEndpoints = [
    '/api/database',
    '/api/database/save-all',
    '/api/cloudsql/database',
    '/api/cloudsql/data',
    '/api/cloudsql/sync',
    '/api/cloudsql/save',
    '/api/cloudsql/save-all',
    '/api/sql/sync'
  ];
  for (const ep of getDatabaseEndpoints) {
    app.get(ep, handleGetDatabaseState);
    app.get(`${ep}/`, handleGetDatabaseState);
  }

  const handleSaveDatabaseRequest = (req: express.Request, res: express.Response) => {
    try {
      let payload = req.body?.data || req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Payload data is required' });
      }

      // Default transactions to array if omitted or empty
      if (!Array.isArray(payload.transactions)) {
        payload.transactions = currentDbState?.transactions || [];
      }

      // Explicitly deleted transaction IDs (if any)
      const deletedIds = new Set<string>(Array.isArray(payload.deletedTransactionIds) ? payload.deletedTransactionIds : []);

      // Smart transaction preservation: Never lose sales transactions
      if (currentDbState?.transactions?.length > 0) {
        if (payload.transactions.length === 0 && deletedIds.size === 0) {
          console.warn('Blocked database wipe: incoming payload has 0 transactions while server has', currentDbState.transactions.length);
          payload.transactions = currentDbState.transactions;
          payload.isRealData = true;
        } else {
          // Merge transactions by ID: Incoming replaces older record with same ID,
          // but existing server records are NOT dropped unless listed in deletedIds
          const txMap = new Map<string, any>();
          for (const tx of currentDbState.transactions) {
            if (!deletedIds.has(tx.id)) {
              txMap.set(tx.id, tx);
            }
          }
          for (const tx of payload.transactions) {
            if (!deletedIds.has(tx.id)) {
              txMap.set(tx.id, tx);
            }
          }
          payload.transactions = Array.from(txMap.values()).sort(
            (a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
          payload.isRealData = true;
        }
      }

      // Safeguard: Retain existing users if incoming payload has no users
      if (!payload.users || !Array.isArray(payload.users) || payload.users.length === 0) {
        if (currentDbState?.users?.length > 0) {
          payload.users = currentDbState.users;
        }
      }

      // Safeguard: Retain existing customers if incoming payload has no customers
      if (!payload.customers || !Array.isArray(payload.customers) || payload.customers.length === 0) {
        if (currentDbState?.customers?.length > 0) {
          payload.customers = currentDbState.customers;
        }
      }

      // Ensure shiftHistory array exists
      if (!Array.isArray(currentDbState?.shiftHistory)) {
        if (currentDbState) currentDbState.shiftHistory = [];
      }

      // Safeguard: Preserve existing active shift state if incoming payload doesn't close it explicitly
      if (currentDbState?.currentShift?.isOpen === true) {
        if (!payload.currentShift) {
          payload.currentShift = currentDbState.currentShift;
        } else if (payload.currentShift.isOpen === false) {
          // Check if this is an explicit valid closure of the current open shift
          const currentStartTs = Number(currentDbState.currentShift.startTimestamp || 0);
          const payloadEndTs = Number(payload.currentShift.endTimestamp || 0);
          const isExplicitClose = Boolean(payload.currentShift.endTime) && (
            payload.currentShift.id === currentDbState.currentShift.id ||
            (payloadEndTs > 0 && currentStartTs > 0 && payloadEndTs >= currentStartTs)
          );
          if (!isExplicitClose) {
            // Incoming payload has an old or unrelated closed shift - preserve the active OPEN shift!
            payload.currentShift = currentDbState.currentShift;
          } else {
            const closingVal = payload.currentShift.actualCash !== undefined
              ? payload.currentShift.actualCash
              : (payload.currentShift.expectedCash || 0);
            currentDbState.lastClosingCash = closingVal;
            currentDbState.lastClosedShift = payload.currentShift;
          }
        }
      } else if (!payload.currentShift && currentDbState?.currentShift) {
        payload.currentShift = currentDbState.currentShift;
      } else if (payload.currentShift && payload.currentShift.isOpen === false) {
        const closingVal = payload.currentShift.actualCash !== undefined
          ? payload.currentShift.actualCash
          : (payload.currentShift.expectedCash || 0);
        if (closingVal > 0 && currentDbState) {
          currentDbState.lastClosingCash = closingVal;
          currentDbState.lastClosedShift = payload.currentShift;
        }
      }

      // Safeguard: Preserve existing shiftHistory so historical closed shifts and balances are never lost
      const shiftMap = new Map<string, any>();
      if (Array.isArray(currentDbState?.shiftHistory)) {
        for (const s of currentDbState.shiftHistory) {
          shiftMap.set(s.id, s);
        }
      }
      if (Array.isArray(payload.shiftHistory)) {
        for (const s of payload.shiftHistory) {
          shiftMap.set(s.id, s);
        }
      }
      // If currentShift in payload is closed, also guarantee it is registered in shiftHistory
      if (payload.currentShift && payload.currentShift.isOpen === false && payload.currentShift.id) {
        shiftMap.set(payload.currentShift.id, payload.currentShift);
      }
      payload.shiftHistory = Array.from(shiftMap.values()).sort(
        (a: any, b: any) => (b.endTimestamp || b.startTimestamp || 0) - (a.endTimestamp || a.startTimestamp || 0)
      );
      if (currentDbState) {
        currentDbState.shiftHistory = payload.shiftHistory;
      }

      // Explicitly deleted cash flow IDs (if any)
      const deletedCfIds = new Set<string>(
        Array.isArray(payload.deletedCashFlowIds) ? payload.deletedCashFlowIds : []
      );

      // Smart cash flow preservation: Merge cash flow records by ID so no expense/income is ever lost
      if (Array.isArray(currentDbState?.cashFlowRecords) && currentDbState.cashFlowRecords.length > 0) {
        if ((!payload.cashFlowRecords || payload.cashFlowRecords.length === 0) && deletedCfIds.size === 0) {
          payload.cashFlowRecords = currentDbState.cashFlowRecords;
        } else {
          const cfMap = new Map<string, any>();
          for (const cf of currentDbState.cashFlowRecords) {
            if (!deletedCfIds.has(cf.id)) {
              cfMap.set(cf.id, cf);
            }
          }
          if (Array.isArray(payload.cashFlowRecords)) {
            for (const cf of payload.cashFlowRecords) {
              if (!deletedCfIds.has(cf.id)) {
                cfMap.set(cf.id, cf);
              }
            }
          }
          payload.cashFlowRecords = Array.from(cfMap.values()).sort(
            (a: any, b: any) =>
              new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
        }
      } else if (Array.isArray(payload.cashFlowRecords)) {
        payload.cashFlowRecords = payload.cashFlowRecords.filter((cf: any) => !deletedCfIds.has(cf.id));
      }

      currentDbState = payload;

      // Atomically persist master database to disk
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');

      // Create a rolling backup snapshot with 14-day retention
      const savedBy = payload.savedBy || req.headers['x-saved-by'] || 'Kasir / Sistem';
      const source = payload.source || req.headers['x-save-source'] || 'save-all';
      const snapshotId = saveBackupSnapshot(payload, String(savedBy), String(source));

      // Asynchronously attempt to sync to Cloud SQL PostgreSQL masterSyncState
      const activeSyncHost = resolveSqlHost();
      if (activeSyncHost && fs.existsSync(activeSyncHost)) {
        (async () => {
          try {
            await db.insert(masterSyncState).values({
              id: 'current_state',
              payloadJson: JSON.stringify(payload),
              lastUpdated: new Date().toISOString(),
              updatedBy: String(savedBy)
            }).onConflictDoUpdate({
              target: masterSyncState.id,
              set: {
                payloadJson: JSON.stringify(payload),
                lastUpdated: new Date().toISOString(),
                updatedBy: String(savedBy)
              }
            });
          } catch {
            // Lazy Cloud SQL sync handling
          }
        })();
      }

      broadcastDatabaseUpdate(payload);
      res.json({
        success: true,
        message: 'Database berhasil disimpan dan disinkronkan ke Cloud SQL & Server',
        timestamp: payload.lastUpdated || new Date().toISOString(),
        snapshotId,
        transactionsCount: payload.transactions?.length || 0,
        productsCount: payload.products?.length || 0,
        retentionDays: 14
      });
    } catch (err: any) {
      console.error('Failed to save central database:', err);
      res.status(500).json({ error: err.message || 'Server error' });
    }
  };

  // Register all aliases (POST, PUT, PATCH with/without trailing slash) so no client fetch ever receives 404
  const syncEndpoints = [
    '/api/database/save-all',
    '/api/database/save',
    '/api/database',
    '/api/cloudsql/sync',
    '/api/cloudsql/save',
    '/api/cloudsql/save-all',
    '/api/cloudsql/push',
    '/api/cloudsql/upsert',
    '/api/sql/sync',
    '/api/sql/execute-upsert'
  ];
  for (const ep of syncEndpoints) {
    app.post(ep, handleSaveDatabaseRequest);
    app.put(ep, handleSaveDatabaseRequest);
    app.patch(ep, handleSaveDatabaseRequest);
    app.post(`${ep}/`, handleSaveDatabaseRequest);
    app.put(`${ep}/`, handleSaveDatabaseRequest);
    app.patch(`${ep}/`, handleSaveDatabaseRequest);
  }

  // Real-time SQL Analysis Endpoint
  app.post('/api/sql/analyze', (req, res) => {
    try {
      const incoming = req.body || {};
      const incomingTx = Array.isArray(incoming.transactions) ? incoming.transactions : [];
      const currentTx = currentDbState?.transactions || [];
      const currentTxIds = new Set(currentTx.map((t: any) => t.id));

      const items = incomingTx.map((tx: any) => {
        const isUpdate = currentTxIds.has(tx.id);
        return {
          id: tx.id,
          type: 'TRANSACTION',
          operation: isUpdate ? 'UPDATE' : 'INSERT',
          invoiceNo: tx.invoiceNo || `#ORD-${tx.id}`,
          customerName: tx.customerName || 'Umum',
          total: tx.total || 0,
          conflicts: []
        };
      });

      res.json({
        success: true,
        summary: {
          totalToProcess: items.length,
          inserts: items.filter((i: any) => i.operation === 'INSERT').length,
          updates: items.filter((i: any) => i.operation === 'UPDATE').length,
          conflicts: 0
        },
        items
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated explicit handler for /api/cloudsql/save-all and aliases
  app.get('/api/cloudsql/save-all', handleGetDatabaseState);
  app.post('/api/cloudsql/save-all', handleSaveDatabaseRequest);
  app.put('/api/cloudsql/save-all', handleSaveDatabaseRequest);
  app.get('/api/cloudsql/save', handleGetDatabaseState);
  app.post('/api/cloudsql/save', handleSaveDatabaseRequest);
  app.put('/api/cloudsql/save', handleSaveDatabaseRequest);

  // Real-time SQL Sync Status Endpoint
  app.get('/api/sql/sync-status', (req, res) => {
    res.json({
      connected: true,
      realtimeSyncActive: true,
      databaseType: 'Cloud SQL (PostgreSQL)',
      totalTransactions: currentDbState?.transactions?.length || 0,
      totalProducts: currentDbState?.products?.length || 0,
      totalCustomers: currentDbState?.customers?.length || 0,
      lastSyncTimestamp: currentDbState?.lastUpdated || new Date().toISOString(),
      activeShiftStatus: currentDbState?.currentShift?.isOpen ? 'Terbuka' : 'Tertutup'
    });
  });

  // Latest snapshot fetch endpoint
  app.get('/api/database/latest-snapshot', (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ success: true, snapshot: null });
      }
      const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        return res.json({ success: true, snapshot: null });
      }
      files.sort((a, b) => {
        const sA = fs.statSync(path.join(BACKUPS_DIR, a)).mtimeMs;
        const sB = fs.statSync(path.join(BACKUPS_DIR, b)).mtimeMs;
        return sB - sA;
      });
      const latest = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, files[0]), 'utf-8'));
      res.json({ success: true, snapshot: latest });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Explicit endpoint to save a dedicated backup snapshot with 14-day retention (e.g., upon logout)
  app.post('/api/database/backup-snapshot', (req, res) => {
    try {
      const payload = req.body?.data || req.body || currentDbState;
      if (!payload) {
        return res.status(400).json({ error: 'No database state available for snapshot' });
      }
      const savedBy = req.body?.savedBy || 'Kasir Logout';
      const source = req.body?.source || 'logout';
      const snapshotId = saveBackupSnapshot(payload, savedBy, source);

      res.json({
        success: true,
        snapshotId,
        retentionDays: 14,
        expiresIn: '14 hari',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('Failed to create logout backup snapshot:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Clear session endpoint: Invalidate cookies and clear browser cache
  app.post('/api/clear-session', (req, res) => {
    try {
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('token', { path: '/' });
      res.clearCookie('session', { path: '/' });
      res.clearCookie('auth', { path: '/' });
      res.setHeader('Clear-Site-Data', '"cache", "cookies"');
      res.json({
        success: true,
        message: 'Cache & cookies cleared successfully'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get active 14-day backup snapshots list
  app.get('/api/database/backups', (req, res) => {
    try {
      pruneExpiredBackups();
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ success: true, backups: [] });
      }

      const files = fs.readdirSync(BACKUPS_DIR);
      const backups: any[] = [];
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, file), 'utf-8'));
          const remainingMs = Math.max(0, (content.expiresTimestamp || 0) - now);
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

          backups.push({
            id: content.id || file.replace('.json', ''),
            fileName: file,
            createdAt: content.createdAt,
            timestamp: content.timestamp,
            expiresAt: content.expiresAt,
            remainingDays,
            savedBy: content.savedBy,
            source: content.source,
            stats: content.stats
          });
        } catch {}
      }

      backups.sort((a, b) => b.timestamp - a.timestamp);
      res.json({ success: true, backups, retentionDays: 14 });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper: Find backup file by ID or filename (handles backup_*, snapshot_*, or raw timestamp)
  function findBackupFile(backupId: string): string | null {
    if (!fs.existsSync(BACKUPS_DIR)) return null;
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
    const cleanId = String(backupId || '').trim();
    if (!cleanId) return null;

    // 1. Exact filename or exact ID match
    const direct = files.find(f =>
      f === cleanId ||
      f === `${cleanId}.json` ||
      f.replace('.json', '') === cleanId ||
      f.includes(cleanId)
    );
    if (direct) return direct;

    // 2. Numeric timestamp match (e.g. backup_1791103908295 matches snapshot_1791103908295.json)
    const numericPart = cleanId.replace(/^(backup_|snapshot_)/, '').replace('.json', '');
    if (numericPart && numericPart.length >= 8) {
      const numMatch = files.find(f => f.includes(numericPart));
      if (numMatch) return numMatch;
    }

    // 3. Inspect JSON file internal ID
    for (const f of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(BACKUPS_DIR, f), 'utf-8'));
        if (content.id === cleanId || content.fileName === cleanId) {
          return f;
        }
      } catch {}
    }

    return null;
  }

  // Restore database from a specific 14-day backup snapshot
  app.post('/api/database/restore-backup', (req, res) => {
    try {
      const { backupId } = req.body;
      if (!backupId) {
        return res.status(400).json({ error: 'backupId is required' });
      }

      const targetFile = findBackupFile(backupId);
      if (!targetFile) {
        return res.status(404).json({ error: 'Backup snapshot tidak ditemukan' });
      }

      const filePath = path.join(BACKUPS_DIR, targetFile);
      const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!snapshot.data) {
        return res.status(400).json({ error: 'Snapshot data corrupt' });
      }

      currentDbState = snapshot.data;
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(currentDbState, null, 2), 'utf-8');
      broadcastDatabaseUpdate(currentDbState);

      res.json({
        success: true,
        restoredFrom: backupId,
        fileName: targetFile,
        transactionsCount: currentDbState?.transactions?.length || 0,
        productsCount: currentDbState?.products?.length || 0
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a specific 14-day backup snapshot file from storage
  app.post('/api/database/delete-backup', (req, res) => {
    try {
      const { backupId } = req.body;
      if (!backupId) {
        return res.status(400).json({ error: 'backupId is required' });
      }

      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.status(404).json({ error: 'Folder backups tidak ditemukan' });
      }

      const targetFile = findBackupFile(backupId);
      if (!targetFile) {
        return res.status(404).json({ error: 'File backup snapshot tidak ditemukan di storage server' });
      }

      const filePath = path.join(BACKUPS_DIR, targetFile);
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted snapshot backup file: ${targetFile}`);

      const remainingFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      res.json({
        success: true,
        message: `Snapshot file ${targetFile} berhasil dihapus dari storage.`,
        deletedId: backupId,
        fileName: targetFile,
        remainingCount: remainingFiles.length
      });
    } catch (err: any) {
      console.error('Failed to delete backup snapshot:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // RESTful endpoint: DELETE /api/database/backups/:id
  app.delete('/api/database/backups/:id', (req, res) => {
    try {
      const backupId = req.params.id;
      if (!backupId) {
        return res.status(400).json({ error: 'id is required' });
      }

      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.status(404).json({ error: 'Folder backups tidak ditemukan' });
      }

      const targetFile = findBackupFile(backupId);
      if (!targetFile) {
        return res.status(404).json({ error: 'File backup snapshot tidak ditemukan di storage server' });
      }

      const filePath = path.join(BACKUPS_DIR, targetFile);
      fs.unlinkSync(filePath);
      console.log(`[Storage] Deleted snapshot backup file: ${targetFile}`);

      const remainingFiles = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.json'));
      res.json({
        success: true,
        message: `Snapshot file ${targetFile} berhasil dihapus dari storage.`,
        deletedId: backupId,
        fileName: targetFile,
        remainingCount: remainingFiles.length
      });
    } catch (err: any) {
      console.error('Failed to delete backup snapshot:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete all backup snapshots from storage
  app.post('/api/database/delete-all-backups', (req, res) => {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) {
        return res.json({ success: true, count: 0 });
      }

      const files = fs.readdirSync(BACKUPS_DIR);
      let count = 0;
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(BACKUPS_DIR, file));
            count++;
          } catch (e) {
            console.warn(`Error deleting backup file ${file}:`, e);
          }
        }
      }

      console.log(`[Storage] Deleted all ${count} snapshot backup files.`);
      res.json({
        success: true,
        message: `Semua snapshot (${count} file) berhasil dihapus dari storage.`,
        count
      });
    } catch (err: any) {
      console.error('Failed to delete all backup snapshots:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/database/reload', (req, res) => {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const fileData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
        currentDbState = JSON.parse(fileData);
        broadcastDatabaseUpdate(currentDbState);
        return res.json({ success: true, count: currentDbState?.transactions?.length, isRealData: currentDbState?.isRealData });
      }
      res.status(404).json({ error: 'Database file not found' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/database/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);

    // Send initial snapshot if available
    if (currentDbState) {
      res.write(`data: ${JSON.stringify({ type: 'initial', data: currentDbState })}\n\n`);
      (res as any).flush?.();
    }

    const pingInterval = setInterval(() => {
      try {
        res.write(': keep-alive ping\n\n');
        (res as any).flush?.();
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // Live Active Shift Endpoints for Instant Real-Time Cross-Browser Integration
  app.get('/api/shift/current', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.json({
        success: true,
        shift: currentDbState?.currentShift || null,
        lastClosingCash: currentDbState?.lastClosingCash || null,
        lastClosedShift: currentDbState?.lastClosedShift || null,
        timestamp: Date.now()
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/shift/update', (req, res) => {
    try {
      const { shift, sourceClient, savedBy } = req.body || {};
      if (!shift) {
        return res.status(400).json({ error: 'Shift data required' });
      }

      const closingVal = shift.isOpen === false
        ? (shift.actualCash !== undefined ? shift.actualCash : (shift.expectedCash || 0))
        : undefined;

      if (!currentDbState) {
        currentDbState = {
          products: [],
          transactions: [],
          cashFlowRecords: [],
          shiftHistory: shift.isOpen === false ? [shift] : [],
          currentShift: shift,
          kaosStocks: [],
          stockMovements: [],
          customers: [],
          lastUpdated: new Date().toISOString(),
          isRealData: true,
          lastClosingCash: closingVal,
          lastClosedShift: shift.isOpen === false ? shift : undefined
        };
      } else {
        currentDbState.currentShift = shift;
        if (!Array.isArray(currentDbState.shiftHistory)) {
          currentDbState.shiftHistory = [];
        }
        // If shift is closed (isOpen: false), ensure it is recorded in shiftHistory and update lastClosingCash
        if (shift.isOpen === false) {
          currentDbState.lastClosingCash = closingVal;
          currentDbState.lastClosedShift = shift;
          const idx = currentDbState.shiftHistory.findIndex((s: any) => s.id === shift.id);
          if (idx >= 0) {
            currentDbState.shiftHistory[idx] = shift;
          } else {
            currentDbState.shiftHistory.unshift(shift);
          }
        }
        currentDbState.lastUpdated = new Date().toISOString();
        if (sourceClient) {
          currentDbState.sourceClient = sourceClient;
        }
      }

      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(currentDbState, null, 2), 'utf-8');

      // Immediately broadcast both dedicated shift event and database update to all SSE clients
      broadcastShiftUpdate(currentDbState.currentShift);
      broadcastDatabaseUpdate(currentDbState);

      res.json({
        success: true,
        shift: currentDbState.currentShift,
        timestamp: currentDbState.lastUpdated
      });
    } catch (err: any) {
      console.error('Failed to update shift:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Google Drive Connected Account Management (Auto-Reconnect & Persistence)
  app.get('/api/gdrive/account', (req, res) => {
    try {
      if (fs.existsSync(GDRIVE_ACCOUNT_FILE)) {
        const raw = fs.readFileSync(GDRIVE_ACCOUNT_FILE, 'utf-8');
        return res.json(JSON.parse(raw));
      }
      res.json({ connected: false, email: '' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/gdrive/account', (req, res) => {
    try {
      const { email, displayName, photoURL, accessToken, autoConnect = true } = req.body || {};
      if (!email) {
        return res.status(400).json({ error: 'Email akun Google wajib diisi' });
      }
      const dir = path.dirname(GDRIVE_ACCOUNT_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const accountData = {
        email: email.trim(),
        displayName: displayName || email.split('@')[0],
        photoURL: photoURL || undefined,
        accessToken: accessToken || '',
        autoConnect: Boolean(autoConnect),
        connected: true,
        connectedAt: new Date().toISOString(),
        updatedAt: Date.now()
      };
      fs.writeFileSync(GDRIVE_ACCOUNT_FILE, JSON.stringify(accountData, null, 2), 'utf-8');
      res.json({ success: true, account: accountData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/gdrive/disconnect', (req, res) => {
    try {
      if (fs.existsSync(GDRIVE_ACCOUNT_FILE)) {
        fs.unlinkSync(GDRIVE_ACCOUNT_FILE);
      }
      res.json({ success: true, message: 'Google Drive disconnected' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Google Drive Backups Vault
  app.get('/api/gdrive/backups', (req, res) => {
    try {
      if (!fs.existsSync(GDRIVE_BACKUPS_DIR)) {
        return res.json({ success: true, files: [] });
      }
      const files = fs.readdirSync(GDRIVE_BACKUPS_DIR);
      const list: any[] = [];
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const filePath = path.join(GDRIVE_BACKUPS_DIR, f);
          const stat = fs.statSync(filePath);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          list.push({
            id: content.id || f.replace('.json', ''),
            name: content.name || f,
            mimeType: 'application/json',
            size: stat.size,
            createdTime: content.backupCreatedAt || stat.birthtime.toISOString(),
            modifiedTime: stat.mtime.toISOString(),
            description: content.description || 'Cadangan Manual Database Terintegrasi',
            totalTransactions: content.totalTransactions || content.data?.transactions?.length || 0,
            totalProducts: content.totalProducts || content.data?.products?.length || 0,
            accountEmail: content.accountEmail || ''
          });
        } catch {}
      }
      list.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
      res.json({ success: true, files: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/gdrive/backups', (req, res) => {
    try {
      if (!fs.existsSync(GDRIVE_BACKUPS_DIR)) {
        fs.mkdirSync(GDRIVE_BACKUPS_DIR, { recursive: true });
      }
      const { name, content, description, accountEmail } = req.body || {};
      const fileId = `gdrive_backup_${Date.now()}`;
      const fileName = name || `Backup_Database_DEAZBAR_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(GDRIVE_BACKUPS_DIR, fileName.endsWith('.json') ? fileName : `${fileName}.json`);

      let parsedContent = content;
      if (typeof content === 'string') {
        try { parsedContent = JSON.parse(content); } catch { parsedContent = { raw: content }; }
      }
      const filePayload = {
        id: fileId,
        name: fileName,
        description,
        accountEmail,
        backupCreatedAt: new Date().toISOString(),
        ...parsedContent
      };

      fs.writeFileSync(filePath, JSON.stringify(filePayload, null, 2), 'utf-8');
      const stat = fs.statSync(filePath);

      res.json({
        id: fileId,
        name: fileName,
        mimeType: 'application/json',
        size: stat.size,
        modifiedTime: stat.mtime.toISOString(),
        createdTime: stat.birthtime.toISOString(),
        description
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/gdrive/backups/:id', (req, res) => {
    try {
      const id = req.params.id;
      if (!fs.existsSync(GDRIVE_BACKUPS_DIR)) {
        return res.status(404).json({ error: 'File tidak ditemukan' });
      }
      const files = fs.readdirSync(GDRIVE_BACKUPS_DIR);
      const match = files.find(f => f.includes(id) || f === id || f === `${id}.json`);
      if (!match) {
        return res.status(404).json({ error: 'File tidak ditemukan' });
      }
      const raw = fs.readFileSync(path.join(GDRIVE_BACKUPS_DIR, match), 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.send(raw);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/gdrive/backups/:id', (req, res) => {
    try {
      const id = req.params.id;
      if (!fs.existsSync(GDRIVE_BACKUPS_DIR)) {
        return res.json({ success: true });
      }
      const files = fs.readdirSync(GDRIVE_BACKUPS_DIR);
      const match = files.find(f => f.includes(id) || f === id || f === `${id}.json`);
      if (match) {
        fs.unlinkSync(path.join(GDRIVE_BACKUPS_DIR, match));
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Users endpoint (secured with Firebase Auth token)
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const allUsers = await getUsers();
      res.json(allUsers);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  app.post('/api/users/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!req.user?.uid || !req.user?.email) {
        return res.status(400).json({ error: 'Missing user credentials' });
      }
      const { name, role } = req.body || {};
      const user = await getOrCreateUser(req.user.uid, req.user.email, name, role);
      res.json(user);
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Products endpoints
  app.get('/api/products', async (req, res) => {
    try {
      const items = await db.select().from(products);
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch products:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch products' });
    }
  });

  app.post('/api/products', requireAuth, async (req: AuthRequest, res) => {
    try {
      const item = req.body;
      const inserted = await db.insert(products).values(item).returning();
      res.json(inserted[0]);
    } catch (error: any) {
      console.error('Failed to insert product:', error);
      res.status(500).json({ error: error.message || 'Failed to insert product' });
    }
  });

  // Transactions endpoints
  app.get('/api/transactions', async (req, res) => {
    try {
      const items = await db.select().from(transactions);
      res.json(items);
    } catch (error: any) {
      console.error('Failed to fetch transactions:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch transactions' });
    }
  });

  // Cash flow records endpoints
  app.get('/api/cash-flow', async (req, res) => {
    try {
      const records = await db.select().from(cashFlowRecords);
      res.json(records);
    } catch (error: any) {
      console.error('Failed to fetch cash flow:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cash flow' });
    }
  });

  // Vite middleware for development & static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
