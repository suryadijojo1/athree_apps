import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

/**
 * Dynamically resolves the active Cloud SQL socket directory path.
 * If SQL_HOST is not set or its path does not exist, looks in /app/cloudsql
 * for any directory containing the PostgreSQL unix socket (.s.PGSQL.5432).
 */
export function resolveSqlHost(): string | undefined {
  const envHost = process.env.SQL_HOST;
  if (envHost && fs.existsSync(envHost)) {
    return envHost;
  }
  const cloudSqlDir = '/app/cloudsql';
  try {
    if (fs.existsSync(cloudSqlDir)) {
      const entries = fs.readdirSync(cloudSqlDir);
      for (const entry of entries) {
        const fullPath = path.join(cloudSqlDir, entry);
        if (fs.existsSync(path.join(fullPath, '.s.PGSQL.5432'))) {
          return fullPath;
        }
      }
      if (entries.length > 0) {
        return path.join(cloudSqlDir, entries[0]);
      }
    }
  } catch {}
  return envHost;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const resolvedHost = resolveSqlHost();
    global._postgresPool = new Pool({
      host: resolvedHost,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
