import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Transaction, CashFlowRecord, CashierShift, KaosStockItem, StockMovement, Customer, User } from '../types';
import { getDocs } from 'firebase/firestore';

// Initialize Firebase with exact config and database ID
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-aplikasikasirman-c4020c71-4153-4487-b4fc-621dc809ce75');
export const auth = getAuth(app);

// Operation types for standard error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot as required by skill guidelines
export async function testConnection(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase Firestore is operating in offline/local cache mode.');
    } else {
      console.warn('Firebase Firestore connection check:', error instanceof Error ? error.message : error);
    }
    return false;
  }
}

// Auth functions
export async function signInWithGoogleFirebase(): Promise<FirebaseUser | null> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (err: any) {
    console.error('Firebase Google Sign-In Error:', err);
    throw err;
  }
}

export async function signOutFirebase(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Firestore Realtime Collections Subscriptions
export function subscribeToProducts(
  onData: (products: Product[]) => void,
  onError?: (err: any) => void
) {
  const path = 'products';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Product);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export function subscribeToTransactions(
  onData: (transactions: Transaction[]) => void,
  onError?: (err: any) => void
) {
  const path = 'transactions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Transaction);
      });
      // Sort newest first
      items.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export function subscribeToCashFlow(
  onData: (records: CashFlowRecord[]) => void,
  onError?: (err: any) => void
) {
  const path = 'cashFlowRecords';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: CashFlowRecord[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as CashFlowRecord);
      });
      items.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export function subscribeToShifts(
  onData: (shifts: CashierShift[]) => void,
  onError?: (err: any) => void
) {
  const path = 'shifts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: CashierShift[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as CashierShift);
      });
      items.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

// Write helpers with standard handleFirestoreError
export async function saveProductToFirestore(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    await setDoc(doc(db, 'products', product.id), product);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTransactionToFirestore(transaction: Transaction): Promise<void> {
  const path = `transactions/${transaction.id}`;
  try {
    await setDoc(doc(db, 'transactions', transaction.id), transaction);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  const path = `transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCashFlowToFirestore(record: CashFlowRecord): Promise<void> {
  const path = `cashFlowRecords/${record.id}`;
  try {
    await setDoc(doc(db, 'cashFlowRecords', record.id), record);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveShiftToFirestore(shift: CashierShift): Promise<void> {
  const path = `shifts/${shift.id}`;
  try {
    await setDoc(doc(db, 'shifts', shift.id), shift);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Kaos Stocks Subscription
export function subscribeToKaosStocks(
  onData: (stocks: KaosStockItem[]) => void,
  onError?: (err: any) => void
) {
  const path = 'kaosStocks';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: KaosStockItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as KaosStockItem);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export function subscribeToCustomers(
  onData: (customers: Customer[]) => void,
  onError?: (err: any) => void
) {
  const path = 'customers';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: Customer[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as Customer);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export async function saveKaosStockToFirestore(item: KaosStockItem): Promise<void> {
  const path = `kaosStocks/${item.id}`;
  try {
    await setDoc(doc(db, 'kaosStocks', item.id), item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleKaosStocksToFirestore(items: KaosStockItem[]): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    batch.set(doc(db, 'kaosStocks', item.id), item);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-kaos-save');
  }
}

export async function saveMultipleProductsToFirestore(products: Product[]): Promise<void> {
  const batch = writeBatch(db);
  for (const product of products) {
    batch.set(doc(db, 'products', product.id), product);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-products-save');
  }
}

export async function saveCustomerToFirestore(customer: Customer): Promise<void> {
  const path = `customers/${customer.id}`;
  try {
    await setDoc(doc(db, 'customers', customer.id), customer);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToStockMovements(
  onData: (movements: StockMovement[]) => void,
  onError?: (err: any) => void
) {
  const path = 'stockMovements';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: StockMovement[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as StockMovement);
      });
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export async function saveStockMovementToFirestore(movement: StockMovement): Promise<void> {
  const path = `stockMovements/${movement.id}`;
  try {
    await setDoc(doc(db, 'stockMovements', movement.id), movement);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleStockMovementsToFirestore(movements: StockMovement[]): Promise<void> {
  const batch = writeBatch(db);
  for (const m of movements.slice(0, 100)) {
    batch.set(doc(db, 'stockMovements', m.id), m);
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'batch-movements-save');
  }
}

export function subscribeToUsers(
  onData: (users: User[]) => void,
  onError?: (err: any) => void
) {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const items: User[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as User);
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (e) {
        if (onError) onError(e);
      }
    }
  );
}

export async function saveUserToFirestore(user: User): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Fetch all collections from Firestore
export async function fetchAllDataFromFirestore(): Promise<{
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
  kaosStocks: KaosStockItem[];
  customers: Customer[];
  users: User[];
  stockMovements: StockMovement[];
}> {
  const results = {
    products: [] as Product[],
    transactions: [] as Transaction[],
    cashFlowRecords: [] as CashFlowRecord[],
    shifts: [] as CashierShift[],
    kaosStocks: [] as KaosStockItem[],
    customers: [] as Customer[],
    users: [] as User[],
    stockMovements: [] as StockMovement[]
  };

  try {
    const prodSnap = await getDocs(collection(db, 'products'));
    prodSnap.forEach((d) => results.products.push(d.data() as Product));

    const txSnap = await getDocs(collection(db, 'transactions'));
    txSnap.forEach((d) => results.transactions.push(d.data() as Transaction));
    results.transactions.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

    const cfSnap = await getDocs(collection(db, 'cashFlowRecords'));
    cfSnap.forEach((d) => results.cashFlowRecords.push(d.data() as CashFlowRecord));
    results.cashFlowRecords.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());

    const shiftSnap = await getDocs(collection(db, 'shifts'));
    shiftSnap.forEach((d) => results.shifts.push(d.data() as CashierShift));

    const kaosSnap = await getDocs(collection(db, 'kaosStocks'));
    kaosSnap.forEach((d) => results.kaosStocks.push(d.data() as KaosStockItem));

    const custSnap = await getDocs(collection(db, 'customers'));
    custSnap.forEach((d) => results.customers.push(d.data() as Customer));

    const userSnap = await getDocs(collection(db, 'users'));
    userSnap.forEach((d) => results.users.push(d.data() as User));

    const smSnap = await getDocs(collection(db, 'stockMovements'));
    smSnap.forEach((d) => results.stockMovements.push(d.data() as StockMovement));
    results.stockMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'batch-fetch');
  }

  return results;
}

// Batch Sync Local Data to Firestore (Chunked in max 250 operations per batch to prevent limits)
export async function syncAllLocalDataToFirestore(data: {
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
  kaosStocks?: KaosStockItem[];
  customers?: Customer[];
  users?: User[];
  stockMovements?: StockMovement[];
}): Promise<{ productsCount: number; transactionsCount: number; cashFlowCount: number; kaosCount: number }> {
  // Collect all writes as array of [collectionName, docId, data]
  const writes: Array<{ col: string; id: string; val: any }> = [];

  for (const p of data.products) {
    if (p && p.id) writes.push({ col: 'products', id: p.id, val: p });
  }

  for (const t of data.transactions) {
    if (t && t.id) writes.push({ col: 'transactions', id: t.id, val: t });
  }

  for (const c of data.cashFlowRecords) {
    if (c && c.id) writes.push({ col: 'cashFlowRecords', id: c.id, val: c });
  }

  for (const s of data.shifts) {
    if (s && s.id) writes.push({ col: 'shifts', id: s.id, val: s });
  }

  if (data.kaosStocks) {
    for (const k of data.kaosStocks) {
      if (k && k.id) writes.push({ col: 'kaosStocks', id: k.id, val: k });
    }
  }

  if (data.customers) {
    for (const cust of data.customers) {
      if (cust && cust.id) writes.push({ col: 'customers', id: cust.id, val: cust });
    }
  }

  if (data.users) {
    for (const u of data.users) {
      if (u && u.id) writes.push({ col: 'users', id: u.id, val: u });
    }
  }

  if (data.stockMovements) {
    for (const m of data.stockMovements) {
      if (m && m.id) writes.push({ col: 'stockMovements', id: m.id, val: m });
    }
  }

  // Commit in chunks of 200 items (Firestore limit is 500 per batch)
  const CHUNK_SIZE = 200;
  for (let i = 0; i < writes.length; i += CHUNK_SIZE) {
    const chunk = writes.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const w of chunk) {
      batch.set(doc(db, w.col, w.id), w.val);
    }
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `batch-sync-chunk-${i}`);
    }
  }

  return {
    productsCount: data.products.length,
    transactionsCount: data.transactions.length,
    cashFlowCount: data.cashFlowRecords.length,
    kaosCount: data.kaosStocks ? data.kaosStocks.length : 0
  };
}

// 14-Day Cloud Backup Snapshots for Firestore
export interface CloudBackupSnapshotMeta {
  id: string;
  createdAt: string;
  timestamp: number;
  expiresAt: string;
  expiresTimestamp: number;
  retentionDays: number;
  savedBy: string;
  source: string;
  stats: {
    transactionsCount: number;
    productsCount: number;
    shiftsCount: number;
    cashFlowCount: number;
    customersCount: number;
  };
}

export const CLOUD_BACKUP_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 Hari

// Helper: Prune snapshots in Firestore that are older than 14 days
export async function cleanExpiredBackupsFirestore(): Promise<number> {
  let cleaned = 0;
  try {
    const snap = await getDocs(collection(db, 'databaseBackups'));
    const now = Date.now();
    const batch = writeBatch(db);
    let count = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const isExpired =
        (data.expiresTimestamp && now > data.expiresTimestamp) ||
        (data.timestamp && now - data.timestamp > CLOUD_BACKUP_RETENTION_MS);

      if (isExpired) {
        batch.delete(docSnap.ref);
        count++;
        cleaned++;
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Cleaned ${cleaned} expired 14-day snapshots from Firestore databaseBackups`);
    }
  } catch (err) {
    console.warn('Error cleaning expired Firestore backups:', err);
  }
  return cleaned;
}

// Save complete cloud backup snapshot in Firestore with 14-day retention
export async function saveCloudBackupSnapshot(
  data: any,
  savedBy: string = 'Kasir Logout',
  source: string = 'logout'
): Promise<string> {
  const now = Date.now();
  const backupId = `backup_${now}`;
  const path = `databaseBackups/${backupId}`;

  const snapshotDoc = {
    id: backupId,
    createdAt: new Date(now).toISOString(),
    timestamp: now,
    expiresAt: new Date(now + CLOUD_BACKUP_RETENTION_MS).toISOString(),
    expiresTimestamp: now + CLOUD_BACKUP_RETENTION_MS,
    retentionDays: 14,
    savedBy,
    source,
    stats: {
      transactionsCount: data.transactions?.length || 0,
      productsCount: data.products?.length || 0,
      shiftsCount: data.shiftHistory?.length || data.shifts?.length || 0,
      cashFlowCount: data.cashFlowRecords?.length || 0,
      customersCount: data.customers?.length || 0
    },
    data
  };

  try {
    await setDoc(doc(db, 'databaseBackups', backupId), snapshotDoc);
    // Background cleanup of expired snapshots
    cleanExpiredBackupsFirestore().catch(() => {});
    return backupId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return backupId;
  }
}

// Fetch list of cloud backup snapshots currently active in Firestore (within 14-day window)
export async function fetchCloudBackupSnapshots(): Promise<CloudBackupSnapshotMeta[]> {
  const results: CloudBackupSnapshotMeta[] = [];
  try {
    const snap = await getDocs(collection(db, 'databaseBackups'));
    const now = Date.now();

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (!d.expiresTimestamp || d.expiresTimestamp > now) {
        results.push({
          id: d.id || docSnap.id,
          createdAt: d.createdAt,
          timestamp: d.timestamp,
          expiresAt: d.expiresAt,
          expiresTimestamp: d.expiresTimestamp,
          retentionDays: d.retentionDays || 14,
          savedBy: d.savedBy || 'Kasir',
          source: d.source || 'sync',
          stats: d.stats || {
            transactionsCount: 0,
            productsCount: 0,
            shiftsCount: 0,
            cashFlowCount: 0,
            customersCount: 0
          }
        });
      }
    });

    results.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.warn('Failed to fetch cloud backup snapshots from Firestore:', error);
  }
  return results;
}

// Fetch a specific snapshot by ID
export async function getCloudBackupSnapshotById(backupId: string): Promise<any | null> {
  try {
    const snap = await getDocs(collection(db, 'databaseBackups'));
    let found: any = null;
    snap.forEach((docSnap) => {
      if (docSnap.id === backupId || docSnap.data().id === backupId) {
        found = docSnap.data().data;
      }
    });
    return found;
  } catch (err) {
    console.warn('Error fetching cloud backup by id:', err);
    return null;
  }
}
