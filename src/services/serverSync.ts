import { Transaction, Product, CashFlowRecord, CashierShift, KaosStockItem, StockMovement, Customer, User } from '../types';

export interface AppDatabasePayload {
  products: Product[];
  categories?: string[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shiftHistory: CashierShift[];
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
  try {
    const res = await fetch('/api/database', {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      return { success: false, data: null, isRealData: false };
    }
    const json = await res.json();
    return {
      success: Boolean(json.success),
      data: json.data || null,
      isRealData: Boolean(json.isRealData)
    };
  } catch (err) {
    console.warn('Failed to fetch central database from server:', err);
    return { success: false, data: null, isRealData: false };
  }
}

/**
 * Save full database payload to the central Express server
 */
export async function saveServerDatabase(
  payload: Omit<AppDatabasePayload, 'lastUpdated' | 'sourceClient'>,
  options?: { savedBy?: string; source?: string; deletedTransactionIds?: string[] }
): Promise<boolean> {
  try {
    const fullPayload: AppDatabasePayload = {
      ...payload,
      lastUpdated: new Date().toISOString(),
      sourceClient: CLIENT_ID,
      isRealData: true,
      savedBy: options?.savedBy || payload.savedBy || 'Kasir',
      source: options?.source || payload.source || 'sync',
      deletedTransactionIds: options?.deletedTransactionIds || payload.deletedTransactionIds || []
    };

    const res = await fetch('/api/database/save-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID,
        'X-Saved-By': fullPayload.savedBy || 'Kasir',
        'X-Save-Source': fullPayload.source || 'sync'
      },
      body: JSON.stringify(fullPayload)
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }
    return true;
  } catch (err) {
    console.warn('Failed to save to central server database:', err);
    return false;
  }
}

/**
 * Save dedicated backup snapshot to the server with 14-day retention
 */
export async function saveServerBackupSnapshot(
  data: any,
  savedBy: string = 'Kasir Logout',
  source: string = 'logout'
): Promise<boolean> {
  try {
    const res = await fetch('/api/database/backup-snapshot', {
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
 * Fetch 14-day server backup snapshots
 */
export async function fetchServerBackups(): Promise<any[]> {
  try {
    const res = await fetch('/api/database/backups');
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
    const res = await fetch('/api/database/restore-backup', {
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
 * Subscribe to real-time updates broadcasted by the central server via Server-Sent Events (SSE)
 */
export function subscribeToServerEvents(
  onUpdate: (payload: AppDatabasePayload) => void
): () => void {
  let isClosed = false;
  let eventSource: EventSource | null = null;
  let reconnectTimeout: any = null;
  let pollInterval: any = null;

  function connect() {
    if (isClosed) return;
    try {
      eventSource = new EventSource('/api/database/events');

      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.data) {
            // If the update came from this tab itself, ignore to avoid redundant state thrashing
            if (parsed.data.sourceClient === CLIENT_ID) return;
            onUpdate(parsed.data);
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
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      if (!isClosed) {
        reconnectTimeout = setTimeout(connect, 5000);
      }
    }
  }

  // Connect SSE
  connect();

  // Also maintain a periodic 10-second sync heartbeat as fallback
  pollInterval = setInterval(async () => {
    if (isClosed) return;
    const { success, data } = await fetchServerDatabase();
    if (success && data && data.sourceClient !== CLIENT_ID) {
      onUpdate(data);
    }
  }, 10000);

  return () => {
    isClosed = true;
    if (eventSource) eventSource.close();
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (pollInterval) clearInterval(pollInterval);
  };
}
