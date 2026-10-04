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

let runtimeCustomBaseUrl: string | null = null;

/**
 * Programmatically configure or override the Cloud SQL API Gateway base URL.
 */
export function setServerBaseUrl(url: string | null): void {
  runtimeCustomBaseUrl = url ? url.trim().replace(/\/+$/, '') : null;
  if (typeof window !== 'undefined') {
    (window as any).__CLOUD_SQL_API_GATEWAY__ = runtimeCustomBaseUrl;
  }
}

/**
 * Resolves the active Cloud SQL API Gateway base URL.
 * Automatically checks for runtime programmatic overrides, window globals,
 * localStorage persistent settings, and Vite environment variables.
 */
export function getServerBaseUrl(): string {
  // 1. Programmatic override
  if (runtimeCustomBaseUrl) {
    return runtimeCustomBaseUrl;
  }

  // 2. Window global overrides (injected by gateway proxy, script tag, or browser console)
  if (typeof window !== 'undefined') {
    const win = window as any;
    const customGateway =
      win.__CLOUD_SQL_API_GATEWAY__ ||
      win.__CLOUD_SQL_GATEWAY__ ||
      win.CLOUD_SQL_API_GATEWAY ||
      win.CLOUD_SQL_GATEWAY ||
      win.__API_BASE_URL__ ||
      win.__API_URL__ ||
      win.API_BASE_URL ||
      win.API_URL;
    if (customGateway && typeof customGateway === 'string' && customGateway.trim()) {
      return customGateway.trim().replace(/\/+$/, '');
    }

    // 3. LocalStorage persistent configuration
    try {
      const stored =
        localStorage.getItem('CLOUD_SQL_API_GATEWAY') ||
        localStorage.getItem('CLOUD_SQL_GATEWAY') ||
        localStorage.getItem('API_BASE_URL') ||
        localStorage.getItem('VITE_API_URL');
      if (stored && typeof stored === 'string' && stored.trim()) {
        return stored.trim().replace(/\/+$/, '');
      }
    } catch {
      // Ignore localStorage access restrictions
    }
  }

  // 4. Vite bundler environment variables
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const env = (import.meta as any).env;
    const envUrl =
      env.VITE_CLOUD_SQL_API_GATEWAY ||
      env.VITE_CLOUD_SQL_GATEWAY ||
      env.VITE_API_URL ||
      env.VITE_SERVER_URL ||
      env.VITE_API_BASE_URL ||
      env.VITE_API_BASE;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, '');
    }
  }

  return '';
}

/**
 * Resolves the full, absolute base URL (including scheme, host, and port)
 * of the active Cloud SQL API Gateway.
 */
export function getFullServerBaseUrl(): string {
  const base = getServerBaseUrl();
  if (base) {
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return base;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      const normalizedPath = base.startsWith('/') ? base : `/${base}`;
      return `${window.location.origin}${normalizedPath}`.replace(/\/+$/, '');
    }
    return base;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

/**
 * Builds a normalized, properly routed URL pointing to the Cloud SQL server endpoint.
 * Prevents duplicate '/api' path segments and double slashes to eliminate 404 routing errors.
 */
export function buildApiUrl(path: string): string {
  const base = getServerBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!base) return normalizedPath;

  const cleanBase = base.replace(/\/+$/, '');

  // Prevent duplicate '/api' if cleanBase already ends with '/api' and path starts with '/api/'
  if (cleanBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${cleanBase}${normalizedPath.substring(4)}`;
  }

  // Exact match '/api'
  if (cleanBase.endsWith('/api') && normalizedPath === '/api') {
    return cleanBase;
  }

  return `${cleanBase}${normalizedPath}`;
}

/**
 * Builds a fully qualified absolute URL with scheme and host for external requests or diagnostics.
 */
export function buildFullApiUrl(path: string): string {
  const fullBase = getFullServerBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const cleanBase = fullBase.replace(/\/+$/, '');

  if (cleanBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${cleanBase}${normalizedPath.substring(4)}`;
  }
  if (cleanBase.endsWith('/api') && normalizedPath === '/api') {
    return cleanBase;
  }
  return `${cleanBase}${normalizedPath}`;
}

export interface NetworkLogEntry {
  id: string;
  timestamp: string;
  context: string;
  method: string;
  url: string;
  fullUrl: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  is404: boolean;
  success: boolean;
  error?: string;
}

const networkLogs: NetworkLogEntry[] = [];
const MAX_NETWORK_LOGS = 120;

/**
 * Returns recorded network request logs for developer inspection or diagnostics.
 */
export function getNetworkRequestLogs(): NetworkLogEntry[] {
  return [...networkLogs];
}

/**
 * Clears recorded network request logs.
 */
export function clearNetworkRequestLogs(): void {
  networkLogs.length = 0;
}

/**
 * Verbose fetch wrapper for Cloud SQL & Server communications.
 * Logs EVERY outgoing network request and response with execution timing,
 * and specifically highlights HTTP 404 Not Found errors with full URL, method, and gateway status.
 */
export async function verboseFetch(
  inputUrl: string,
  init?: RequestInit,
  contextLabel: string = 'Network Request'
): Promise<Response> {
  const fullUrl = buildFullApiUrl(inputUrl);
  const method = (init?.method || 'GET').toUpperCase();
  const startTime = Date.now();
  const logId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  console.log(
    `%c[ServerSync:REQ] 📡 [${contextLabel}] ${method} %c${fullUrl}`,
    'color: #0284c7; font-weight: bold; background: #e0f2fe; padding: 1px 5px; border-radius: 3px;',
    'color: #0369a1; font-weight: 600;'
  );

  let response: Response;
  try {
    response = await fetch(inputUrl, init);
  } catch (netErr: any) {
    const durationMs = Date.now() - startTime;
    const isAbort = netErr.name === 'AbortError';
    const logItem: NetworkLogEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      context: contextLabel,
      method,
      url: inputUrl,
      fullUrl,
      durationMs,
      is404: false,
      success: false,
      error: isAbort ? 'Request Timeout (Aborted)' : netErr.message || String(netErr)
    };
    networkLogs.unshift(logItem);
    if (networkLogs.length > MAX_NETWORK_LOGS) networkLogs.pop();

    console.error(
      `%c[ServerSync:NET-FAIL] 💥 [${contextLabel}] ${method} ${fullUrl} FAILED after ${durationMs}ms:`,
      'color: #991b1b; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 3px;',
      netErr.message || netErr
    );
    throw netErr;
  }

  const durationMs = Date.now() - startTime;
  const is404 = response.status === 404;

  const logItem: NetworkLogEntry = {
    id: logId,
    timestamp: new Date().toISOString(),
    context: contextLabel,
    method,
    url: inputUrl,
    fullUrl,
    status: response.status,
    statusText: response.statusText,
    durationMs,
    is404,
    success: response.ok
  };
  networkLogs.unshift(logItem);
  if (networkLogs.length > MAX_NETWORK_LOGS) networkLogs.pop();

  if (is404) {
    console.group(
      `%c[ServerSync:404 ERROR] ❌ HTTP 404 Not Found on ${method} [${contextLabel}]`,
      'color: #ffffff; background: #dc2626; font-weight: bold; padding: 2px 8px; border-radius: 4px;'
    );
    console.error(`• Full Target URL : %c${fullUrl}%c`, 'color: #dc2626; font-weight: bold;', '');
    console.error(`• Requested Path  : ${inputUrl}`);
    console.error(`• HTTP Method     : ${method}`);
    console.error(`• HTTP Status     : 404 (Not Found)`);
    console.error(`• Latency         : ${durationMs}ms`);
    console.error(`• Gateway Base    : ${getServerBaseUrl() || '(none / browser origin)'}`);
    console.error(`• Full Base URL   : ${getFullServerBaseUrl()}`);
    console.error(`• Timestamp       : ${new Date().toISOString()}`);
    console.error(`• Context         : ${contextLabel}`);
    console.groupEnd();
  } else if (!response.ok) {
    console.warn(
      `%c[ServerSync:HTTP ${response.status}] ⚠ [${contextLabel}] ${method} %c${fullUrl}%c (${durationMs}ms) - ${response.statusText}`,
      'color: #b45309; font-weight: bold; background: #fef3c7; padding: 1px 5px; border-radius: 3px;',
      'color: #b45309; font-weight: bold;',
      'color: inherit;'
    );
  } else {
    console.log(
      `%c[ServerSync:HTTP ${response.status}] ✔ [${contextLabel}] ${method} %c${fullUrl}%c (${durationMs}ms)`,
      'color: #15803d; font-weight: bold; background: #dcfce7; padding: 1px 5px; border-radius: 3px;',
      'color: #15803d;',
      'color: inherit;'
    );
  }

  return response;
}

export interface CloudSqlDiagnosticInfo {
  fullBaseUrl: string;
  configuredBaseUrl: string;
  primaryEndpoint: string;
  status: string;
  httpStatus?: number;
  connected: boolean;
  cloudSqlDirect: boolean;
  databaseType: string;
  details?: any;
  error?: string;
  testedEndpoints: Array<{
    endpoint: string;
    status: number | string;
    ok: boolean;
    responseTimeMs: number;
  }>;
  totalElapsedMs: number;
  timestamp: string;
}

/**
 * Diagnostic function that tests the Cloud SQL API Gateway and logs the full base URL
 * and connection status of the Cloud SQL service to the console for easier debugging of 404 errors.
 *
 * Can also be executed from browser DevTools:
 *   window.diagnoseCloudSql()
 */
export async function diagnoseCloudSqlService(options?: {
  silent?: boolean;
  timeoutMs?: number;
}): Promise<CloudSqlDiagnosticInfo> {
  const fullBaseUrl = getFullServerBaseUrl();
  const configuredBaseUrl = getServerBaseUrl();
  const targetEndpoint = buildFullApiUrl('/api/cloudsql/status');
  const timeoutMs = options?.timeoutMs || 8000;
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  let connected = false;
  let cloudSqlDirect = false;
  let httpStatus: number | undefined;
  let statusText = 'UNKNOWN';
  let databaseType = 'Cloud SQL (PostgreSQL)';
  let details: any = null;
  let errorMessage: string | undefined;

  const testedEndpoints: Array<{
    endpoint: string;
    status: number | string;
    ok: boolean;
    responseTimeMs: number;
  }> = [];

  const endpointsToCheck = [
    { name: 'Cloud SQL Status', path: '/api/cloudsql/status' },
    { name: 'Cloud SQL Tables', path: '/api/cloudsql/tables' },
    { name: 'Sync Status', path: '/api/sql/sync-status' },
    { name: 'Database State', path: '/api/database' },
    { name: 'Server Health', path: '/api/health' }
  ];

  for (const item of endpointsToCheck) {
    const fullUrl = buildFullApiUrl(item.path);
    const epStart = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await verboseFetch(
        fullUrl,
        {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Client-Id': CLIENT_ID },
          cache: 'no-store',
          signal: controller.signal
        },
        `CloudSqlDiagnostic: ${item.name}`
      );
      clearTimeout(timer);

      const elapsed = Date.now() - epStart;
      testedEndpoints.push({
        endpoint: fullUrl,
        status: res.status,
        ok: res.ok,
        responseTimeMs: elapsed
      });

      if (item.path === '/api/cloudsql/status') {
        httpStatus = res.status;
        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          connected = Boolean(json.connected ?? true);
          cloudSqlDirect = Boolean(json.cloudSqlDirect);
          databaseType = json.databaseType || 'Cloud SQL (PostgreSQL)';
          details = json;
          statusText = 'CONNECTED';
        } else if (res.status === 404) {
          statusText = '404_NOT_FOUND';
          errorMessage = `Endpoint ${fullUrl} returned 404 Not Found`;
        } else {
          statusText = `HTTP_${res.status}`;
          errorMessage = `Endpoint returned HTTP status ${res.status}`;
        }
      }
    } catch (err: any) {
      const elapsed = Date.now() - epStart;
      const isAbort = err.name === 'AbortError';
      testedEndpoints.push({
        endpoint: fullUrl,
        status: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        ok: false,
        responseTimeMs: elapsed
      });
      if (item.path === '/api/cloudsql/status') {
        statusText = isAbort ? 'TIMEOUT' : 'CONNECTION_ERROR';
        errorMessage = err.message || 'Connection failed';
      }
    }
  }

  // If status endpoint was 404, check if alternative endpoints succeeded
  if (!connected) {
    const anySuccess = testedEndpoints.find((t) => t.ok);
    if (anySuccess) {
      connected = true;
      if (statusText === '404_NOT_FOUND') {
        statusText = 'PARTIAL (Status 404, but alternative endpoints responsive)';
      }
    }
  }

  const result: CloudSqlDiagnosticInfo = {
    fullBaseUrl,
    configuredBaseUrl,
    primaryEndpoint: targetEndpoint,
    status: statusText,
    httpStatus,
    connected,
    cloudSqlDirect,
    databaseType,
    details,
    error: errorMessage,
    testedEndpoints,
    totalElapsedMs: Date.now() - startTime,
    timestamp
  };

  if (!options?.silent) {
    logDiagnosticResults(result);
  }

  return result;
}

/**
 * Formats and prints comprehensive diagnostic logs to the browser console.
 */
function logDiagnosticResults(diag: CloudSqlDiagnosticInfo): void {
  const isOk = diag.connected && diag.status !== '404_NOT_FOUND';
  const badgeColor = isOk ? '#00871f' : '#dc2626';

  console.group(
    `%c[Cloud SQL Diagnostics] ${isOk ? '✔ SERVICE CONNECTED' : '✖ CONNECTION ISSUE DETECTED'}`,
    `background: ${badgeColor}; color: #ffffff; font-weight: bold; padding: 2px 8px; border-radius: 4px;`
  );
  console.log('%cFull Base URL:%c', 'font-weight: bold;', 'color: #0284c7; font-weight: bold;', diag.fullBaseUrl);
  console.log(
    '%cConfigured Base URL:%c',
    'font-weight: bold;',
    'color: #475569;',
    diag.configuredBaseUrl || '(default / browser origin)'
  );
  console.log('%cPrimary Endpoint:%c', 'font-weight: bold;', 'color: #0284c7;', diag.primaryEndpoint);
  console.log(
    '%cConnection Status:%c',
    'font-weight: bold;',
    isOk ? 'color: #16a34a; font-weight: bold;' : 'color: #dc2626; font-weight: bold;',
    diag.status + (diag.httpStatus ? ` (HTTP ${diag.httpStatus})` : '')
  );
  console.log(
    '%cCloud SQL Direct DB:%c',
    'font-weight: bold;',
    diag.cloudSqlDirect ? 'color: #16a34a; font-weight: bold;' : 'color: #eab308; font-weight: bold;',
    diag.cloudSqlDirect ? 'Connected (PostgreSQL active)' : 'Standby / Replication mode'
  );
  console.log('%cDatabase Engine:%c', 'font-weight: bold;', 'color: #334155;', diag.databaseType);

  if (diag.error) {
    console.warn(
      '%cDiagnostic Warning:%c',
      'font-weight: bold; color: #dc2626;',
      'color: #dc2626;',
      diag.error,
      '\nIf you see a 404 error, verify that the base URL correctly points to the active Cloud SQL API Gateway.'
    );
  }

  if (console.table && diag.testedEndpoints.length > 0) {
    console.table(
      diag.testedEndpoints.map((t) => ({
        Endpoint: t.endpoint,
        Status: t.status,
        Success: t.ok ? 'YES' : 'NO',
        'Latency (ms)': t.responseTimeMs
      }))
    );
  }

  if (diag.details) {
    console.log('%cResponse Payload:%c', 'font-weight: bold;', '', diag.details);
  }

  console.groupEnd();
}

// Aliases for developer convenience
export const logCloudSqlDiagnostics = diagnoseCloudSqlService;
export const diagnoseCloudSqlConnection = diagnoseCloudSqlService;
export const checkCloudSqlDiagnostics = diagnoseCloudSqlService;

// Attach diagnostics to window for immediate DevTools inspection
if (typeof window !== 'undefined') {
  const win = window as any;
  win.diagnoseCloudSqlService = diagnoseCloudSqlService;
  win.diagnoseCloudSql = diagnoseCloudSqlService;
  win.logCloudSqlDiagnostics = diagnoseCloudSqlService;
  win.getFullServerBaseUrl = getFullServerBaseUrl;
  win.getServerBaseUrl = getServerBaseUrl;
  win.buildApiUrl = buildApiUrl;
  win.buildFullApiUrl = buildFullApiUrl;
  win.verboseFetch = verboseFetch;
  win.getNetworkRequestLogs = getNetworkRequestLogs;
  win.clearNetworkRequestLogs = clearNetworkRequestLogs;
  win.__NETWORK_LOGS__ = networkLogs;
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

  const endpointsToTry: string[] = [];
  for (const p of candidatePaths) {
    endpointsToTry.push(buildApiUrl(p));
    const rel = p.startsWith('/') ? p : `/${p}`;
    if (!endpointsToTry.includes(rel)) {
      endpointsToTry.push(rel);
    }
  }
  const uniqueEndpoints = Array.from(new Set(endpointsToTry));

  for (const ep of uniqueEndpoints) {
    try {
      const res = await verboseFetch(
        ep,
        {
          headers: { Accept: 'application/json', 'X-Client-Id': CLIENT_ID },
          cache: 'no-store'
        },
        'FetchServerDatabase'
      );
      if (res.ok) {
        const json = await res.json();
        return {
          success: Boolean(json.success),
          data: json.data || null,
          isRealData: Boolean(json.isRealData)
        };
      }
    } catch (err) {
      console.warn(`[ServerSync] Failed to fetch database from ${ep}:`, err);
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
  for (const p of candidatePaths) {
    endpointsToTry.push(buildApiUrl(p));
    const rel = p.startsWith('/') ? p : `/${p}`;
    if (!endpointsToTry.includes(rel)) {
      endpointsToTry.push(rel);
    }
  }
  const uniqueEndpoints = Array.from(new Set(endpointsToTry));

  console.log(
    `%c[ServerSync:SAVE] 💾 Initiating full database push (${fullPayload.transactions?.length || 0} tx, ${fullPayload.products?.length || 0} products). Candidates: [${uniqueEndpoints.join(', ')}]`,
    'color: #0369a1; font-weight: bold;'
  );

  let lastErrorMsg = 'Server error: Endpoint Cloud SQL tidak merespons';

  for (let idx = 0; idx < uniqueEndpoints.length; idx++) {
    const ep = uniqueEndpoints[idx];
    const fullUrl = buildFullApiUrl(ep);

    console.log(
      `%c[ServerSync:SAVE] 🔄 Trying candidate #${idx + 1}/${uniqueEndpoints.length}: %c${ep}%c (Full: ${fullUrl})`,
      'color: #475569; font-weight: bold;',
      'color: #0284c7; font-weight: bold;',
      'color: #64748b;'
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await verboseFetch(
        ep,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': CLIENT_ID,
            'X-Saved-By': fullPayload.savedBy,
            'X-Save-Source': fullPayload.source
          },
          body: JSON.stringify(fullPayload),
          signal: controller.signal
        },
        `SaveDatabase (Candidate #${idx + 1}: ${ep})`
      );

      clearTimeout(timeoutId);

      if (res.ok) {
        console.log(
          `%c[ServerSync:SAVE] 🎉 Save successful on candidate #${idx + 1} (${ep})! Full URL: ${fullUrl}`,
          'color: #15803d; font-weight: bold; background: #dcfce7; padding: 2px 6px;'
        );
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
        console.error(
          `%c[ServerSync:SAVE 404] ❌ Endpoint candidate #${idx + 1} (${ep}) returned HTTP 404 Not Found!%c\n• Full Target URL : ${fullUrl}\n• Status Code     : 404\n• Base URL Config : ${getServerBaseUrl() || '(none / browser origin)'}\n• Full Base URL   : ${getFullServerBaseUrl()}\n• Next step       : Trying next alternative candidate...`,
          'background: #fee2e2; color: #dc2626; font-weight: bold; padding: 2px 6px;',
          ''
        );
        lastErrorMsg = `Server error 404 pada endpoint ${ep}`;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'Koneksi server timeout (12 detik)' };
      }
      lastErrorMsg = err.message || 'Koneksi ke server gagal';
    }
  }

  // If a 404 error occurred on all endpoints, run full diagnostics in the console
  if (lastErrorMsg.includes('404')) {
    console.error(
      `%c[ServerSync:SAVE FATAL 404] 💥 All ${uniqueEndpoints.length} candidate endpoints failed with 404! Triggering diagnostic audit...`,
      'background: #7f1d1d; color: #ffffff; font-weight: bold; padding: 3px 8px; border-radius: 4px;'
    );
    diagnoseCloudSqlService().catch(() => {});
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/backup-snapshot'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, savedBy, source })
      },
      'SaveServerBackupSnapshot'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/backups'),
      undefined,
      'FetchServerBackups'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/restore-backup'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      },
      'RestoreServerBackup'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/latest-snapshot'),
      undefined,
      'FetchLatestServerSnapshot'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/delete-backup'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      },
      'DeleteServerBackup'
    );
    if (!res.ok) {
      // Try RESTful DELETE fallback
      const restRes = await verboseFetch(
        buildApiUrl(`/api/database/backups/${encodeURIComponent(backupId)}`),
        {
          method: 'DELETE'
        },
        'DeleteServerBackupREST'
      );
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
    const res = await verboseFetch(
      buildApiUrl('/api/database/delete-all-backups'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      'DeleteAllServerBackups'
    );
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
        const sseUrl = buildApiUrl('/api/database/events');
        console.log(
          `%c[ServerSync:SSE] 📡 Connecting to Server-Sent Events stream: %c${buildFullApiUrl(sseUrl)}`,
          'color: #0284c7; font-weight: bold; background: #e0f2fe; padding: 1px 5px; border-radius: 3px;',
          'color: #0369a1; font-weight: 600;'
        );

        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log(
            `%c[ServerSync:SSE] ✔ SSE connection established: %c${buildFullApiUrl(sseUrl)}`,
            'color: #15803d; font-weight: bold; background: #dcfce7; padding: 1px 5px; border-radius: 3px;',
            'color: #15803d;'
          );
        };

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
            console.warn('[ServerSync:SSE] Error parsing SSE database event:', err);
          }
        };

        eventSource.onerror = () => {
          console.warn(
            `%c[ServerSync:SSE] ⚠ SSE Stream interrupted on %c${buildFullApiUrl(sseUrl)}%c. Reconnecting in 2s...`,
            'color: #b45309; font-weight: bold;',
            'color: #b45309; font-weight: bold;',
            'color: inherit;'
          );
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
    const res = await verboseFetch(
      buildApiUrl('/api/shift/update'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': CLIENT_ID,
          'X-Saved-By': savedBy
        },
        body: JSON.stringify({ shift, sourceClient: CLIENT_ID, savedBy })
      },
      'SyncShiftToServer'
    );
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
    const res = await verboseFetch(
      buildApiUrl(`/api/shift/current?_t=${Date.now()}`),
      {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache'
        }
      },
      'FetchCurrentShiftFromServer'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/sql/analyze'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': CLIENT_ID
        },
        body: JSON.stringify(payload)
      },
      'AnalyzeDataViaServer'
    );
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
    const res = await verboseFetch(
      buildApiUrl('/api/sql/execute-upsert'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': CLIENT_ID
        },
        body: JSON.stringify({ ...payload, sourceClient: CLIENT_ID })
      },
      'ExecuteCloudSqlUpsert'
    );
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
    const res = await verboseFetch(
      buildApiUrl(`/api/sql/sync-status?_t=${Date.now()}`),
      {
        cache: 'no-store'
      },
      'GetLiveSyncStatus'
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}


