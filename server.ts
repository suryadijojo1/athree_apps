import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { products, transactions, cashFlowRecords } from './src/db/schema.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'cloudsql' });
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
