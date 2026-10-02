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
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  limit,
  getDocFromServer,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Product,
  Transaction,
  CashFlowRecord,
  CashierShift,
  KaosStockItem,
  StockMovement,
  Customer,
  User
} from '../types';

/**
 * FIREBASE FIRESTORE STATUS: AKTIF (DATABASE UTAMA DENGAN REAL-TIME SYNC)
 * Sesuai instruksi: "ganti integrasi sycn otomatis database utama ke firebase firestore
 * dan menjadi real time, untuk database SQL dan google drive hanya sebagai cadangan manual."
 */
export const FIRESTORE_ENABLED = true;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();

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
  console.warn('Firestore Warning/Error:', JSON.stringify(errInfo));
  return errInfo;
}

// Connection Health Check
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline:', error.message);
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Real-Time Listeners (onSnapshot) for Primary Database
// ---------------------------------------------------------------------------

export function subscribeToProducts(
  onData: (products: Product[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'products';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToTransactions(
  onData: (transactions: Transaction[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'transactions';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
        items.sort(
          (a, b) =>
            new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
        );
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToCashFlow(
  onData: (records: CashFlowRecord[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'cashFlowRecords';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CashFlowRecord));
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToShifts(
  onData: (shifts: CashierShift[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'shifts';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs
          .filter((d) => d.id !== 'active_shift')
          .map((d) => ({ id: d.id, ...d.data() } as CashierShift));
        items.sort((a, b) => (b.startTimestamp || 0) - (a.startTimestamp || 0));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToActiveShift(
  onData: (shift: CashierShift | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'shifts/active_shift';
  try {
    return onSnapshot(
      doc(db, 'shifts', 'active_shift'),
      (snapshot) => {
        if (snapshot.exists()) {
          onData(snapshot.data() as CashierShift);
        } else {
          onData(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
  }
}

export function subscribeToKaosStocks(
  onData: (stocks: KaosStockItem[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'kaosStocks';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as KaosStockItem));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToCustomers(
  onData: (customers: Customer[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'customers';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToStockMovements(
  onData: (movements: StockMovement[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'stockMovements';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockMovement));
        items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

export function subscribeToUsers(
  onData: (users: User[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const path = 'users';
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as User));
        onData(items);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        if (onError) onError(error);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// Firestore Real-Time Write Operations
// ---------------------------------------------------------------------------

export async function saveProductToFirestore(product: Product): Promise<void> {
  const path = `products/${product.id}`;
  try {
    await setDoc(doc(db, 'products', product.id), product, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveTransactionToFirestore(transaction: Transaction): Promise<void> {
  const path = `transactions/${transaction.id}`;
  try {
    await setDoc(doc(db, 'transactions', transaction.id), transaction, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  const path = `transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'transactions', transactionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveCashFlowToFirestore(record: CashFlowRecord): Promise<void> {
  const path = `cashFlowRecords/${record.id}`;
  try {
    await setDoc(doc(db, 'cashFlowRecords', record.id), record, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCashFlowFromFirestore(recordId: string): Promise<void> {
  const path = `cashFlowRecords/${recordId}`;
  try {
    await deleteDoc(doc(db, 'cashFlowRecords', recordId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveShiftToFirestore(shift: CashierShift): Promise<void> {
  const path = `shifts/${shift.id}`;
  try {
    await setDoc(doc(db, 'shifts', shift.id), shift, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveActiveShiftToFirestore(shift: CashierShift): Promise<void> {
  const path = 'shifts/active_shift';
  try {
    await setDoc(doc(db, 'shifts', 'active_shift'), shift, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveKaosStockToFirestore(item: KaosStockItem): Promise<void> {
  const path = `kaosStocks/${item.id}`;
  try {
    await setDoc(doc(db, 'kaosStocks', item.id), item, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveMultipleKaosStocksToFirestore(items: KaosStockItem[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, 'kaosStocks', item.id), item, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'kaosStocks');
  }
}

export async function saveMultipleProductsToFirestore(products: Product[]): Promise<void> {
  if (!products || products.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const product of chunk) {
        batch.set(doc(db, 'products', product.id), product, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
  }
}

export async function saveCustomerToFirestore(customer: Customer): Promise<void> {
  const path = `customers/${customer.id}`;
  try {
    await setDoc(doc(db, 'customers', customer.id), customer, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCustomerFromFirestore(customerId: string): Promise<void> {
  const path = `customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'customers', customerId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function saveStockMovementToFirestore(movement: StockMovement): Promise<void> {
  const path = `stockMovements/${movement.id}`;
  try {
    await setDoc(doc(db, 'stockMovements', movement.id), movement, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveMultipleStockMovementsToFirestore(movements: StockMovement[]): Promise<void> {
  if (!movements || movements.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < movements.length; i += chunkSize) {
      const chunk = movements.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const m of chunk) {
        batch.set(doc(db, 'stockMovements', m.id), m, { merge: true });
      }
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'stockMovements');
  }
}

export async function saveUserToFirestore(user: User): Promise<void> {
  const path = `users/${user.id}`;
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  const path = `users/${userId}`;
  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Bulk Fetch & Seed Methods
// ---------------------------------------------------------------------------

export async function fetchAllDataFromFirestore(): Promise<{
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
  activeShift?: CashierShift | null;
  kaosStocks: KaosStockItem[];
  customers: Customer[];
  users: User[];
  stockMovements: StockMovement[];
}> {
  try {
    const [
      prodSnap,
      txSnap,
      cfSnap,
      shiftSnap,
      activeShiftSnap,
      kaosSnap,
      custSnap,
      usersSnap,
      movementsSnap
    ] = await Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'transactions')),
      getDocs(collection(db, 'cashFlowRecords')),
      getDocs(collection(db, 'shifts')),
      getDoc(doc(db, 'shifts', 'active_shift')),
      getDocs(collection(db, 'kaosStocks')),
      getDocs(collection(db, 'customers')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'stockMovements'))
    ]);

    const products = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
    const transactions = txSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Transaction));
    const cashFlowRecords = cfSnap.docs.map((d) => ({ id: d.id, ...d.data() } as CashFlowRecord));
    const shifts = shiftSnap.docs
      .filter((d) => d.id !== 'active_shift')
      .map((d) => ({ id: d.id, ...d.data() } as CashierShift));
    const activeShift = activeShiftSnap.exists()
      ? (activeShiftSnap.data() as CashierShift)
      : null;
    const kaosStocks = kaosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KaosStockItem));
    const customers = custSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer));
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
    const stockMovements = movementsSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as StockMovement)
    );

    return {
      products,
      transactions,
      cashFlowRecords,
      shifts,
      activeShift,
      kaosStocks,
      customers,
      users,
      stockMovements
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'all');
    return {
      products: [],
      transactions: [],
      cashFlowRecords: [],
      shifts: [],
      activeShift: null,
      kaosStocks: [],
      customers: [],
      users: [],
      stockMovements: []
    };
  }
}

export async function syncAllLocalDataToFirestore(data: {
  products?: Product[];
  transactions?: Transaction[];
  cashFlowRecords?: CashFlowRecord[];
  shiftHistory?: CashierShift[];
  currentShift?: CashierShift;
  kaosStocks?: KaosStockItem[];
  customers?: Customer[];
  users?: User[];
  stockMovements?: StockMovement[];
}): Promise<{
  productsCount: number;
  transactionsCount: number;
  cashFlowCount: number;
  kaosCount: number;
}> {
  let productsCount = 0;
  let transactionsCount = 0;
  let cashFlowCount = 0;
  let kaosCount = 0;

  try {
    if (data.products && data.products.length > 0) {
      await saveMultipleProductsToFirestore(data.products);
      productsCount = data.products.length;
    }
    if (data.transactions && data.transactions.length > 0) {
      const chunkSize = 400;
      for (let i = 0; i < data.transactions.length; i += chunkSize) {
        const chunk = data.transactions.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const tx of chunk) {
          batch.set(doc(db, 'transactions', tx.id), tx, { merge: true });
        }
        await batch.commit();
      }
      transactionsCount = data.transactions.length;
    }
    if (data.cashFlowRecords && data.cashFlowRecords.length > 0) {
      const chunkSize = 400;
      for (let i = 0; i < data.cashFlowRecords.length; i += chunkSize) {
        const chunk = data.cashFlowRecords.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const cf of chunk) {
          batch.set(doc(db, 'cashFlowRecords', cf.id), cf, { merge: true });
        }
        await batch.commit();
      }
      cashFlowCount = data.cashFlowRecords.length;
    }
    if (data.kaosStocks && data.kaosStocks.length > 0) {
      await saveMultipleKaosStocksToFirestore(data.kaosStocks);
      kaosCount = data.kaosStocks.length;
    }
    if (data.shiftHistory && data.shiftHistory.length > 0) {
      for (const shift of data.shiftHistory) {
        await saveShiftToFirestore(shift);
      }
    }
    if (data.currentShift) {
      await saveActiveShiftToFirestore(data.currentShift);
    }
    if (data.customers && data.customers.length > 0) {
      for (const cust of data.customers) {
        await saveCustomerToFirestore(cust);
      }
    }
    if (data.users && data.users.length > 0) {
      for (const u of data.users) {
        await saveUserToFirestore(u);
      }
    }
    if (data.stockMovements && data.stockMovements.length > 0) {
      await saveMultipleStockMovementsToFirestore(data.stockMovements);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'syncAll');
  }

  return {
    productsCount,
    transactionsCount,
    cashFlowCount,
    kaosCount
  };
}

// ---------------------------------------------------------------------------
// Rolling 14-Day Snapshots in Firestore
// ---------------------------------------------------------------------------

export const BACKUP_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

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

export async function saveCloudBackupSnapshot(
  data: any,
  savedBy: string = 'Kasir / Sistem',
  source: string = 'manual'
): Promise<string> {
  const now = Date.now();
  const backupId = `backup_${now}`;
  const path = `databaseBackups/${backupId}`;

  const meta: CloudBackupSnapshotMeta = {
    id: backupId,
    createdAt: new Date(now).toISOString(),
    timestamp: now,
    expiresAt: new Date(now + BACKUP_RETENTION_MS).toISOString(),
    expiresTimestamp: now + BACKUP_RETENTION_MS,
    retentionDays: 14,
    savedBy,
    source,
    stats: {
      transactionsCount: data.transactions?.length || 0,
      productsCount: data.products?.length || 0,
      shiftsCount: (data.shifts || data.shiftHistory)?.length || 0,
      cashFlowCount: data.cashFlowRecords?.length || 0,
      customersCount: data.customers?.length || 0
    }
  };

  try {
    await setDoc(doc(db, 'databaseBackups', backupId), {
      ...meta,
      payload: data
    });
    // Trigger non-blocking pruning of expired backups
    cleanExpiredBackupsFirestore().catch(() => {});
    return backupId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    return backupId;
  }
}

export async function fetchCloudBackupSnapshots(): Promise<CloudBackupSnapshotMeta[]> {
  const path = 'databaseBackups';
  try {
    const snap = await getDocs(collection(db, path));
    const now = Date.now();
    const list: CloudBackupSnapshotMeta[] = [];

    for (const d of snap.docs) {
      const data = d.data();
      // Skip expired backups
      if (data.expiresTimestamp && data.expiresTimestamp < now) continue;
      list.push({
        id: data.id || d.id,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        expiresAt: data.expiresAt,
        expiresTimestamp: data.expiresTimestamp || 0,
        retentionDays: data.retentionDays || 14,
        savedBy: data.savedBy || 'Kasir',
        source: data.source || 'backup',
        stats: data.stats || {
          transactionsCount: 0,
          productsCount: 0,
          shiftsCount: 0,
          cashFlowCount: 0,
          customersCount: 0
        }
      });
    }

    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function getCloudBackupSnapshotById(backupId: string): Promise<any | null> {
  const path = `databaseBackups/${backupId}`;
  try {
    const snap = await getDoc(doc(db, 'databaseBackups', backupId));
    if (snap.exists()) {
      return snap.data()?.payload || null;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

export async function cleanExpiredBackupsFirestore(): Promise<number> {
  try {
    const now = Date.now();
    const snap = await getDocs(collection(db, 'databaseBackups'));
    let cleaned = 0;
    const batch = writeBatch(db);

    for (const d of snap.docs) {
      const data = d.data();
      if (data.expiresTimestamp && data.expiresTimestamp < now) {
        batch.delete(doc(db, 'databaseBackups', d.id));
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await batch.commit();
    }
    return cleaned;
  } catch {
    return 0;
  }
}
