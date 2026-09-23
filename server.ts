import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { products, transactions, cashFlowRecords } from './src/db/schema.ts';

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'app-database.json');

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

      currentDbState = payload;

      // Asynchronously persist to disk
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFile(DB_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8', (err) => {
        if (err) console.warn('Could not write database file:', err);
      });

      broadcastDatabaseUpdate(payload);
      res.json({ success: true, timestamp: payload.lastUpdated });
    } catch (err: any) {
      console.error('Failed to save central database:', err);
      res.status(500).json({ error: err.message || 'Server error' });
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
