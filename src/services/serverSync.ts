import { Transaction, Product, CashFlowRecord, CashierShift, KaosStockItem, StockMovement, Customer, User } from '../types';

export interface AppDatabasePayload {
  products: Product[];
  categories?: string[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shiftHistory: CashierShift[];
  currentShift?: CashierShift;
  kaosStocks: KaosStockItem[];
  stockMovements: StockMovement[];
  customers: Customer[];
  users?: User[];
  salesList?: string[];
  lastUpdated: string;
  sourceClient?: string;
  isRealData: boolean;
  deletedTransactionIds?: string[];
  savedBy?: string;
  source?: string;
}

// Client ID for this browser tab/session
export const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

/**
 * Resolves the active Cloud SQL API Gateway base URL.
 * Automatically checks for custom runtime overrides, Vite environment variables,
 * or browser location to ensure the request is directed to the active gateway.
 */
export function getServerBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const customGateway =
      (window as any).__CLOUD_SQL_API_GATEWAY__ ||
      (window as any).__CLOUD_SQL_GATEWAY__ ||
      (window as any).__API_BASE_URL__;
    if (customGateway && typeof customGateway === 'string') {
      return customGateway.replace(/\/+$/, '');
    }
  }

  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    const envUrl = env.VITE_API_URL || env.VITE_CLOUD_SQL_GATEWAY || env.VITE_SERVER_URL;
    if (envUrl && typeof envUrl === 'string') {
      return envUrl.replace(/\/+$/, '');
    }
  }

  return '';
}

/**
 * Builds a normalized, fully qualified or relative URL pointing to the Cloud SQL server endpoint.
 */
export function buildApiUrl(path: string): string {
  const base = getServerBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

const LEGACY_DUMMY_INVOICES = new Set([
  '#INV/00001',
  '#INV/00002',
  '#INV/00003',
  '#INV/00004',
  '#INV/00005',
  '#INV/00006',
  '#INV/00007',
  '#INV/00008'
]);

/**
 * Checks whether a transactions list contains user-entered or valid orders
 * rather than only the old legacy dummy mock transactions.
 */
export function isRealUserData(transactions: Transaction[]): boolean {
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return true;
  
  // If there is any non-dummy invoice, it is genuine production data
  const hasNonDummy = transactions.some((tx) => !LEGACY_DUMMY_INVOICES.has(tx.invoiceNo));
  if (hasNonDummy) {
    return true;
  }
  
  // Check specific known real customer or notes names
  for (const tx of transactions) {
    const custName = (tx.customer?.name || (tx as any).customerName || '').toLowerCase();
    if (
      custName.includes('talson') ||
      custName.includes('emedlugun') ||
      custName.includes('melanesia') ||
      tx.invoiceNo.startsWith('#ORD/') ||
      tx.invoiceNo.startsWith('#INV/') ||
      (tx.notes && tx.notes.includes('Revisi oleh'))
    ) {
      return true;
    }
  }

  return true;
}

/**
 * Fetch the master database from the central Express server
 */
export async function fetchServerDatabase(): Promise<{
  success: boolean;
  data: AppDatabasePayload | null;
  isRealData: boolean;
}> {
  const candidatePaths = [
    '/api/database',
    '/api/database/save-all',
    '/api/cloudsql/database',
    '/api/cloudsql/data',
    '/api/cloudsql/sync'
  ];

  const endpoints: string[] = [];
  const base = getServerBaseUrl();
  for (const p of candidatePaths) {
    if (base) endpoints.push(`${base}${p}`);
    endpoints.push(p);
  }
  const uniqueEndpoints = Array.from(new Set(endpoints));

  for (const ep of uniqueEndpoints) {
    try {
      const res = await fetch(ep, {
        headers: { 'Accept': 'application/json', 'X-Client-Id': CLIENT_ID },
        cache: 'no-store'
      });
      if (res.ok) {
        const json = await res.json();
        return {
          success: Boolean(json.success),
          data: json.data || null,
          isRealData: Boolean(json.isRealData)
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch database from ${ep}:`, err);
    }
  }
  return { success: false, data: null, isRealData: false };
}

/**
 * Save full database payload to the central Express server
 */
export interface SaveDatabaseResult {
  success: boolean;
  message?: string;
  error?: string;
  snapshotId?: string;
  transactionsCount?: number;
}

export async function saveServerDatabase(
  payload: Omit<AppDatabasePayload, 'lastUpdated' | 'sourceClient'>,
  options?: { savedBy?: string; source?: string; deletedTransactionIds?: string[] }
): Promise<SaveDatabaseResult> {
  const fullPayload: AppDatabasePayload = {
    ...payload,
    lastUpdated: new Date().toISOString(),
    sourceClient: CLIENT_ID,
    isRealData: true,
    savedBy: options?.savedBy || payload.savedBy || 'Kasir',
    source: options?.source || payload.source || 'sync',
    deletedTransactionIds: options?.deletedTransactionIds || payload.deletedTransactionIds || []
  };

  const candidatePaths = [
    '/api/database/save-all',
    '/api/database',
    '/api/cloudsql/sync',
    '/api/cloudsql/save',
    '/api/cloudsql/save-all'
  ];

  const endpointsToTry: string[] = [];
  const base = getServerBaseUrl();
  for (const p of candidatePaths) {
    if (base) endpointsToTry.push(`${base}${p}`);
    endpointsToTry.push(p);
  }
  const uniqueEndpoints = Array.from(new Set(endpointsToTry));

  let lastErrorMsg = 'Server error: Endpoint Cloud SQL tidak merespons';

  for (const ep of uniqueEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': CLIENT_ID,
          'X-Saved-By': fullPayload.savedBy,
          'X-Save-Source': fullPayload.source
        },
        body: JSON.stringify(fullPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return {
          success: true,
          message: json.message || 'Berhasil disimpan ke Cloud SQL & Server',
          snapshotId: json?.snapshotId,
          transactionsCount: json?.transactionsCount
        };
      }

      // If it's a specific non-404 error (e.g. 400 or 500), read the error and stop
      if (res.status !== 404) {
        try {
          const errJson = await res.json();
          if (errJson?.error) lastErrorMsg = errJson.error;
          else lastErrorMsg = `Server error ${res.status}`;
        } catch {
          lastErrorMsg = `Server error ${res.status}`;
        }
        break;
      } else {
        console.warn(`Database sync endpoint ${ep} returned 404, trying next alternative...`);
        lastErrorMsg = `Server error 404 pada endpoint ${ep}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Koneksi server timeout (12 detik)' };
      }
      lastErrorMsg = err.message || 'Koneksi ke server gagal';
    }
  }

  return { success: false, error: lastErrorMsg };
}

/**
 * Save dedicated backup snapshot to the server with 3-day maximum retention
 */
export async function saveServerBackupSnapshot(
  data: any,
  savedBy: string = 'Kasir Logout',
  source: string = 'logout'
): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl('/api/database/backup-snapshot'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, savedBy, source })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save server backup snapshot:', err);
    return false;
  }
}

/**
 * Fetch 3-day server backup snapshots
 */
export async function fetchServerBackups(): Promise<any[]> {
  try {
    const res = await fetch(buildApiUrl('/api/database/backups'));
    if (!res.ok) return [];
    const json = await res.json();
    return json.backups || [];
  } catch (err) {
    console.warn('Failed to fetch server backups:', err);
    return [];
  }
}

/**
 * Restore server database from a specific snapshot
 */
export async function restoreServerBackup(backupId: string): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl('/api/database/restore-backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to restore server backup:', err);
    return false;
  }
}

/**
 * Fetch latest server backup snapshot
 */
export async function fetchLatestServerSnapshot(): Promise<any | null> {
  try {
    const res = await fetch(buildApiUrl('/api/database/latest-snapshot'));
    if (!res.ok) return null;
    const json = await res.json();
    return json?.snapshot || null;
  } catch (err) {
    console.warn('Failed to fetch latest server snapshot:', err);
    return null;
  }
}

/**
 * Delete a specific server backup snapshot
 */
export async function deleteServerBackup(backupId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(buildApiUrl('/api/database/delete-backup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupId })
    });
    if (!res.ok) {
      // Try RESTful DELETE fallback
      const restRes = await fetch(buildApiUrl(`/api/database/backups/${encodeURIComponent(backupId)}`), {
        method: 'DELETE'
      });
      if (restRes.ok) {
        const json = await restRes.json().catch(() => ({}));
        return { success: true, message: json.message };
      }
      const errJson = await res.json().catch(() => ({ error: 'Gagal menghapus snapshot dari storage' }));
      return { success: false, message: errJson.error || 'Gagal menghapus snapshot dari storage' };
    }
    const json = await res.json().catch(() => ({}));
    return { success: true, message: json.message };
  } catch (err: any) {
    console.warn('Failed to delete server backup:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Delete all server backup snapshots
 */
export async function deleteAllServerBackups(): Promise<number> {
  try {
    const res = await fetch(buildApiUrl('/api/database/delete-all-backups'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) return 0;
    const json = await res.json();
    return json.count || 0;
  } catch (err) {
    console.warn('Failed to delete all server backups:', err);
    return 0;
  }
}

/**
 * Subscribe to real-time updates broadcasted by the central server via Server-Sent Events (SSE)
 */
export function subscribeToServerEvents(
  onUpdate: (payload: AppDatabasePayload) => void,
  onShiftUpdate?: (shift: CashierShift) => void
): () => void {
  let isClosed = false;
  let eventSource: EventSource | null = null;
  let reconnectTimeout: any = null;
  let pollInterval: any = null;

  function connect() {
    if (isClosed) return;
    try {
      if (typeof window !== 'undefined' && typeof (window as any).EventSource === 'function') {
        eventSource = new EventSource(buildApiUrl('/api/database/events'));

        eventSource.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            if (parsed) {
              if (parsed.type === 'shift' && parsed.shift) {
                if (onShiftUpdate) onShiftUpdate(parsed.shift);
              } else if (parsed.data) {
                if (parsed.data.sourceClient === CLIENT_ID) return;
                onUpdate(parsed.data);
                if (parsed.data.currentShift && onShiftUpdate) {
                  onShiftUpdate(parsed.data.currentShift);
                }
              }
            }
          } catch (err) {
            console.warn('Error parsing SSE database event:', err);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 2000);
          }
        };
      }
    } catch (err) {
      if (!isClosed) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }
  }

  // Connect SSE
  connect();

  // Fallback periodic sync heartbeat when SSE is disconnected or reconnecting
  pollInterval = setInterval(async () => {
    if (isClosed) return;
    // Skip polling if SSE is active and healthy
    if (eventSource && eventSource.readyState === 1) return;

    const { success, data } = await fetchServerDatabase();
    if (success && data) {
      if (data.sourceClient !== CLIENT_ID) {
        onUpdate(data);
      }
      if (data.currentShift && onShiftUpdate) {
        onShiftUpdate(data.currentShift);
      }
    }
  }, 6000);

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (pollInterval) clearInterval(pollInterval);
  };
}

/**
 * Dedicated live shift synchronizer
 * Guarantees that opening or closing cashier in Browser 1 is detected by Browser 2
 */
export function startLiveShiftSync(onShiftUpdate: (shift: CashierShift) => void): () => void {
  let isClosed = false;
  let lastShiftJson = '';

  const checkShift = async () => {
    if (isClosed) return;
    try {
      const shift = await fetchCurrentShiftFromServer();
      if (isClosed || !shift) return;
      const currentJson = JSON.stringify({
        id: shift.id,
        isOpen: shift.isOpen,
        startTime: shift.startTime,
        startTimestamp: shift.startTimestamp,
        startingCash: shift.startingCash,
        cashierName: shift.cashierName,
        endTime: shift.endTime,
        actualCash: shift.actualCash
      });
      if (currentJson !== lastShiftJson) {
        lastShiftJson = currentJson;
        onShiftUpdate(shift);
      }
    } catch {}
  };

  // Run immediately
  checkShift();

  // Heartbeat every 4 seconds (lightweight & avoids network congestion)
  const interval = setInterval(checkShift, 4000);

  return () => {
    isClosed = true;
    clearInterval(interval);
  };
}

/**
 * Fast-sync active cashier shift to the server to immediately notify all other browsers
 */
export async function syncShiftToServer(
  shift: CashierShift,
  savedBy: string = 'Kasir'
): Promise<boolean> {
  try {
    const res = await fetch(buildApiUrl('/api/shift/update'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID,
        'X-Saved-By': savedBy
      },
      body: JSON.stringify({ shift, sourceClient: CLIENT_ID, savedBy })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to sync shift to server:', err);
    return false;
  }
}

/**
 * Fetch current live shift from the central server
 */
export async function fetchCurrentShiftFromServer(): Promise<CashierShift | null> {
  try {
    const res = await fetch(buildApiUrl(`/api/shift/current?_t=${Date.now()}`), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.shift || null;
  } catch (err) {
    console.warn('Failed to fetch current shift from server:', err);
    return null;
  }
}

/**
 * Calls backend to analyze data: Insert vs Update, validate #ORD/xxxx format, and conflict detection
 */
export async function analyzeDataViaServer(payload: {
  products?: Product[];
  transactions?: Transaction[];
  cashFlowRecords?: CashFlowRecord[];
}): Promise<any> {
  try {
    const res = await fetch(buildApiUrl('/api/sql/analyze'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Analysis request failed');
    return await res.json();
  } catch (err: any) {
    console.warn('Failed to analyze data via server:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Executes SQL Upsert to Cloud SQL and triggers instant live sync across all open browsers
 */
export async function executeCloudSqlUpsert(payload: {
  products?: Product[];
  transactions?: Transaction[];
  cashFlowRecords?: CashFlowRecord[];
}): Promise<any> {
  try {
    const res = await fetch(buildApiUrl('/api/sql/execute-upsert'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID
      },
      body: JSON.stringify({ ...payload, sourceClient: CLIENT_ID })
    });
    if (!res.ok) throw new Error('Execution request failed');
    return await res.json();
  } catch (err: any) {
    console.warn('Failed to execute Cloud SQL upsert:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Get real-time connection status of live synchronization and Cloud SQL
 */
export async function getLiveSyncStatus(): Promise<any> {
  try {
    const res = await fetch(buildApiUrl(`/api/sql/sync-status?_t=${Date.now()}`), {
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}


