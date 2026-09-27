import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { products, transactions, cashFlowRecords } from './src/db/schema.ts';

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

  // Central Database Endpoints for Instant Real-Time Cross-Browser Sync
  app.get('/api/database', (req, res) => {
    res.json({
      success: true,
      data: currentDbState,
      isRealData: Boolean(currentDbState?.isRealData)
    });
  });

  app.post('/api/database/save-all', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || !Array.isArray(payload.transactions)) {
        return res.status(400).json({ error: 'Invalid payload' });
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

      // Safeguard: Preserve existing active shift state if not explicitly specified
      if (!payload.currentShift && currentDbState?.currentShift) {
        payload.currentShift = currentDbState.currentShift;
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

      broadcastDatabaseUpdate(payload);
      res.json({
        success: true,
        timestamp: payload.lastUpdated,
        snapshotId,
        transactionsCount: payload.transactions.length,
        retentionDays: 14
      });
    } catch (err: any) {
      console.error('Failed to save central database:', err);
      res.status(500).json({ error: err.message || 'Server error' });
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

  // Restore database from a specific 14-day backup snapshot
  app.post('/api/database/restore-backup', (req, res) => {
    try {
      const { backupId } = req.body;
      if (!backupId) {
        return res.status(400).json({ error: 'backupId is required' });
      }

      const files = fs.readdirSync(BACKUPS_DIR);
      const targetFile = files.find(f => f.includes(backupId) || f === `${backupId}.json`);
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
        transactionsCount: currentDbState?.transactions?.length || 0,
        productsCount: currentDbState?.products?.length || 0
      });
    } catch (err: any) {
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
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sseClients.add(res);

    // Send initial snapshot if available
    if (currentDbState) {
      res.write(`data: ${JSON.stringify({ type: 'initial', data: currentDbState })}\n\n`);
    }

    const pingInterval = setInterval(() => {
      try {
        res.write(': keep-alive ping\n\n');
      } catch {
        clearInterval(pingInterval);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(pingInterval);
      sseClients.delete(res);
    });
  });

  // Live Active Shift Endpoints for Instant Real-Time Cross-Browser Integration
  app.get('/api/shift/current', (req, res) => {
    try {
      res.json({
        success: true,
        shift: currentDbState?.currentShift || null
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

      if (!currentDbState) {
        currentDbState = {
          products: [],
          transactions: [],
          cashFlowRecords: [],
          shiftHistory: [],
          currentShift: shift,
          kaosStocks: [],
          stockMovements: [],
          customers: [],
          lastUpdated: new Date().toISOString(),
          isRealData: true
        };
      } else {
        currentDbState.currentShift = shift;
        // If shift is closed (isOpen: false), ensure it is also recorded in shiftHistory if not already there
        if (shift.isOpen === false && Array.isArray(currentDbState.shiftHistory)) {
          const exists = currentDbState.shiftHistory.some((s: any) => s.id === shift.id && s.endTime);
          if (!exists) {
            currentDbState.shiftHistory = [shift, ...currentDbState.shiftHistory];
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

      // Immediately broadcast database update containing updated shift to all SSE clients
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
