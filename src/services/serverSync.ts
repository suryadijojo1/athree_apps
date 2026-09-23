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
}

// Client ID for this browser tab/session
export const CLIENT_ID = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

const MOCK_INVOICE_NUMBERS = new Set([
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
 * Checks whether a transactions list contains real user-entered orders
 * (e.g. #ORD/41438, #INV/82687, #ORD/86871, or custom names like TALSON, EMEDLUGUN, MELANESIA SENTANI)
 * rather than the standard default 8 mock transactions.
 */
export function isRealUserData(transactions: Transaction[]): boolean {
  if (!transactions || transactions.length === 0) return false;
  
  // If count is not the default 8, or any invoice/customer is outside the mock set
  for (const tx of transactions) {
    if (!MOCK_INVOICE_NUMBERS.has(tx.invoiceNo)) {
      return true;
    }
    // Check specific known real customer / notes names from user production data
    const custName = (tx.customer?.name || (tx as any).customerName || '').toLowerCase();
    if (
      custName.includes('talson') ||
      custName.includes('emedlugun') ||
      custName.includes('melanesia') ||
      tx.invoiceNo.startsWith('#ORD/') ||
      (tx.notes && tx.notes.includes('Revisi oleh'))
    ) {
      return true;
    }
  }

  // If all transactions are exactly the mock set
  return false;
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
  payload: Omit<AppDatabasePayload, 'lastUpdated' | 'sourceClient'>
): Promise<boolean> {
  try {
    const fullPayload: AppDatabasePayload = {
      ...payload,
      lastUpdated: new Date().toISOString(),
      sourceClient: CLIENT_ID,
      isRealData: isRealUserData(payload.transactions) || payload.isRealData
    };

    const res = await fetch('/api/database/save-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': CLIENT_ID
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
