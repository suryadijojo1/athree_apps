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
  enableMultiTabIndexedDbPersistence,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  getDocsFromCache,
  getDocFromServer,
  getDocFromCache,
  deleteDoc,
  onSnapshot,
  writeBatch,
  runTransaction,
  query,
  orderBy,
  limit,
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
 * Sesuai instruksi:
 * 1. Gunakan onSnapshot (Real-time Listener) Bukan getDocs
 * 2. Atur Sumber Data Secara Eksplisit (getDocsFromCache vs getDocsFromServer)
 * 3. Gunakan fungsi enableMultiTabIndexedDbPersistence saat inisialisasi Firebase
 * 4. Lakukan signOut(auth) di salah satu browser jika salah satu browser login
 */
export const FIRESTORE_ENABLED = true;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleAuthProvider = new GoogleAuthProvider();

// 3. Gunakan fungsi enableMultiTabIndexedDbPersistence saat inisialisasi Firebase
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore multi-tab persistence: multiple tabs open.', err.message);
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore multi-tab persistence not supported in this browser.', err.message);
    } else {
      console.warn('Firestore persistence warning:', err);
    }
  });
}

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

// ---------------------------------------------------------------------------
// 2. Firestore Transactions (Wajib untuk Data Bersama - ACID Multi-Client Synchronization)
// ---------------------------------------------------------------------------

export interface CheckoutTransactionInput {
  transaction: Transaction;
  items: Array<{
    productId: string;
    quantity: number;
    kaosColor?: string;
    kaosSize?: string;
  }>;
  isCashPayment: boolean;
  cashAmountReceived: number;
  stockMovements?: StockMovement[];
}

/**
 * Atomic Firestore Transaction for Checkout:
 * - Reads product stocks and active shift concurrently.
 * - Atomically decrements product & kaos variant stock.
 * - Atomically increments active shift cash balance.
 * - Creates transaction & stock movements in a single ACID commit.
 */
export async function runFirestoreCheckoutTransaction(input: CheckoutTransactionInput): Promise<{
  success: boolean;
  transaction: Transaction;
}> {
  const { transaction: txData, items, isCashPayment, cashAmountReceived, stockMovements } = input;
  const path = `transactions/${txData.id}`;

  try {
    await runTransaction(db, async (txn) => {
      // PHASE 1: ALL READS FIRST (Mandatory in Firestore runTransaction)
      // 1. Read each unique product document
      const productDocs: Map<string, any> = new Map();
      const uniqueProductIds = Array.from(new Set(items.map((i) => i.productId)));
      for (const pId of uniqueProductIds) {
        const pRef = doc(db, 'products', pId);
        const pSnap = await txn.get(pRef);
        if (pSnap.exists()) {
          productDocs.set(pId, pSnap.data());
        }
      }

      // 2. Read active shift document if present
      const shiftRef = doc(db, 'shifts', 'active_shift');
      const shiftSnap = await txn.get(shiftRef);
      const activeShiftData = shiftSnap.exists() ? (shiftSnap.data() as CashierShift) : null;

      // PHASE 2: CALCULATIONS & ATOMIC WRITES
      // 1. Write the new transaction document
      const txRef = doc(db, 'transactions', txData.id);
      txn.set(txRef, txData, { merge: true });

      // 2. Decrement stock for standard products
      for (const pId of uniqueProductIds) {
        const currentPData = productDocs.get(pId);
        if (currentPData) {
          const qtySold = items
            .filter((i) => i.productId === pId)
            .reduce((sum, i) => sum + i.quantity, 0);
          const prevStock = typeof currentPData.stock === 'number' ? currentPData.stock : 0;
          const nextStock = Math.max(0, prevStock - qtySold);
          const pRef = doc(db, 'products', pId);
          txn.update(pRef, { stock: nextStock });
        }
      }

      // 3. Update active shift balances atomically
      if (activeShiftData && activeShiftData.isOpen) {
        const additionalCash = isCashPayment ? cashAmountReceived : 0;
        const currentTxCount = activeShiftData.totalTransactions || 0;
        const currentSales = activeShiftData.cashSales || 0;
        const currentExpected =
          activeShiftData.expectedCash || activeShiftData.startingCash || 0;

        txn.update(shiftRef, {
          totalTransactions: currentTxCount + 1,
          cashSales: currentSales + additionalCash,
          expectedCash: currentExpected + additionalCash
        });
      }

      // 4. Append stock movements atomically
      if (stockMovements && stockMovements.length > 0) {
        for (const m of stockMovements) {
          const mRef = doc(db, 'stockMovements', m.id);
          txn.set(mRef, m, { merge: true });
        }
      }
    });

    return { success: true, transaction: txData };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Atomic Firestore Transaction for Cash Flow (Arus Kas / Mutasi Kas):
 * - Reads active shift.
 * - Atomically updates expected cash.
 * - Writes cash flow record doc in a single transaction.
 */
export async function runFirestoreCashFlowTransaction(record: CashFlowRecord): Promise<void> {
  const path = `cashFlowRecords/${record.id}`;
  try {
    await runTransaction(db, async (txn) => {
      // 1. Read active shift
      const shiftRef = doc(db, 'shifts', 'active_shift');
      const shiftSnap = await txn.get(shiftRef);
      const activeShiftData = shiftSnap.exists() ? (shiftSnap.data() as CashierShift) : null;

      // 2. Write cash flow record
      const recordRef = doc(db, 'cashFlowRecords', record.id);
      txn.set(recordRef, record, { merge: true });

      // 3. Atomically update expected cash on active shift if Tunai
      if (activeShiftData && activeShiftData.isOpen && record.paymentMethod === 'TUNAI') {
        const isCashIn = record.type === 'INCOME';
        const amount = Number(record.amount) || 0;
        const currentExpected =
          activeShiftData.expectedCash || activeShiftData.startingCash || 0;

        const newExpected = isCashIn ? currentExpected + amount : currentExpected - amount;

        txn.update(shiftRef, {
          expectedCash: newExpected
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
  }
}

/**
 * Atomic Firestore Transaction for Shift Open / Close:
 * - Reads active shift.
 * - Writes historical shift entry and updates active_shift doc.
 */
export async function runFirestoreShiftTransaction(
  shift: CashierShift,
  isClosing: boolean
): Promise<void> {
  const path = 'shifts/active_shift';
  try {
    await runTransaction(db, async (txn) => {
      const activeShiftRef = doc(db, 'shifts', 'active_shift');
      // Read active shift first
      await txn.get(activeShiftRef);

      // Write to archive doc `shifts/{shift.id}`
      const historyRef = doc(db, 'shifts', shift.id);
      txn.set(historyRef, shift, { merge: true });

      // Update `shifts/active_shift`
      if (isClosing) {
        txn.set(activeShiftRef, { ...shift, isOpen: false }, { merge: true });
      } else {
        txn.set(activeShiftRef, shift, { merge: true });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
    throw err;
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
// 2. Atur Sumber Data Secara Eksplisit (getDocsFromCache vs getDocsFromServer)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Explicit Data Fetching Helpers with Fast-Timeout Fallback
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout of ${ms}ms exceeded`)), ms)
    )
  ]);
}

export async function getDocsExplicit<T = any>(
  colRef: any,
  source: 'server' | 'cache' | 'server-first' = 'server-first'
): Promise<T[]> {
  if (source === 'server') {
    try {
      const snap = await withTimeout(getDocsFromServer(colRef), 2500);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
    } catch {
      const snap = await getDocs(colRef);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
    }
  }
  if (source === 'cache') {
    try {
      const snap = await getDocsFromCache(colRef);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
    } catch {
      const snap = await getDocs(colRef);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
    }
  }
  // server-first with fast 1.5s fallback to cache / local
  try {
    const snap = await withTimeout(getDocsFromServer(colRef), 1500);
    return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
  } catch (err) {
    try {
      const snap = await getDocsFromCache(colRef);
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
    } catch {
      try {
        const snap = await getDocs(colRef);
        return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T));
      } catch {
        return [];
      }
    }
  }
}

export async function getDocExplicit<T = any>(
  docRef: any,
  source: 'server' | 'cache' | 'server-first' = 'server-first'
): Promise<T | null> {
  if (source === 'server') {
    try {
      const snap = await withTimeout(getDocFromServer(docRef), 2500);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
    } catch {
      const snap = await getDoc(docRef);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
    }
  }
  if (source === 'cache') {
    try {
      const snap = await getDocFromCache(docRef);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
    } catch {
      const snap = await getDoc(docRef);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
    }
  }
  // server-first with fast 1.5s fallback to cache / local
  try {
    const snap = await withTimeout(getDocFromServer(docRef), 1500);
    return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
  } catch (err) {
    try {
      const snap = await getDocFromCache(docRef);
      return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
    } catch {
      try {
        const snap = await getDoc(docRef);
        return snap.exists() ? ({ id: snap.id, ...(snap.data() as any) } as T) : null;
      } catch {
        return null;
      }
    }
  }
}

export async function fetchAllDataFromFirestore(
  source: 'server' | 'cache' | 'server-first' = 'server-first'
): Promise<{
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
      products,
      transactions,
      cashFlowRecords,
      shiftDocs,
      activeShift,
      kaosStocks,
      customers,
      users,
      stockMovements
    ] = await Promise.all([
      getDocsExplicit<Product>(collection(db, 'products'), source),
      getDocsExplicit<Transaction>(collection(db, 'transactions'), source),
      getDocsExplicit<CashFlowRecord>(collection(db, 'cashFlowRecords'), source),
      getDocsExplicit<CashierShift>(collection(db, 'shifts'), source),
      getDocExplicit<CashierShift>(doc(db, 'shifts', 'active_shift'), source),
      getDocsExplicit<KaosStockItem>(collection(db, 'kaosStocks'), source),
      getDocsExplicit<Customer>(collection(db, 'customers'), source),
      getDocsExplicit<User>(collection(db, 'users'), source),
      getDocsExplicit<StockMovement>(collection(db, 'stockMovements'), source)
    ]);

    const shifts = shiftDocs.filter((s) => s.id !== 'active_shift');

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

// ---------------------------------------------------------------------------
// Single Active Session / Multi-Browser Mutual Logout
// 4. Lakukan signOut(auth) di salah satu browser jika salah satu browser login
// ---------------------------------------------------------------------------

export interface ActiveSessionData {
  sessionId: string;
  userId: string;
  userName: string;
  role: string;
  loggedInAt: number;
}

export async function recordActiveSession(
  userId: string,
  userName: string,
  role: string
): Promise<string> {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  localStorage.setItem('athree_active_session_id', sessionId);

  try {
    await setDoc(
      doc(db, 'meta', 'activeSession'),
      {
        sessionId,
        userId,
        userName,
        role,
        loggedInAt: Date.now()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to record active session in Firestore:', err);
  }

  return sessionId;
}

export function subscribeToActiveSession(
  onDisplaced: (remoteSession: ActiveSessionData) => void
): Unsubscribe {
  const path = 'meta/activeSession';
  try {
    return onSnapshot(
      doc(db, 'meta', 'activeSession'),
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as ActiveSessionData;
        if (!data || !data.sessionId) return;

        const localSessionId = localStorage.getItem('athree_active_session_id');
        const isAuth = localStorage.getItem('athree_is_authenticated') === 'true';

        // If this browser is logged in, but another browser registered a newer/different session ID
        if (isAuth && localSessionId && data.sessionId !== localSessionId) {
          console.warn('[Session Security] Akun login di browser lain. Melakukan signOut(auth) otomatis...');
          onDisplaced(data);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return () => {};
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
// Rolling 3-Day Maximum Snapshots in Firestore (Agar Database Lama Tidak Menumpuk)
// ---------------------------------------------------------------------------

export const BACKUP_RETENTION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days maximum

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
    retentionDays: 3,
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
    // Trigger non-blocking pruning of expired backups (> 3 days)
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
    // Non-blocking prune of expired snapshots (> 3 days)
    cleanExpiredBackupsFirestore().catch(() => {});

    const snap = await getDocs(collection(db, path));
    const now = Date.now();
    const list: CloudBackupSnapshotMeta[] = [];

    for (const d of snap.docs) {
      const data = d.data();
      const age = now - (data.timestamp || 0);
      // Skip expired backups older than 3 days
      if ((data.expiresTimestamp && data.expiresTimestamp < now) || age > BACKUP_RETENTION_MS) continue;
      list.push({
        id: data.id || d.id,
        createdAt: data.createdAt,
        timestamp: data.timestamp || 0,
        expiresAt: data.expiresAt,
        expiresTimestamp: data.expiresTimestamp || (data.timestamp ? data.timestamp + BACKUP_RETENTION_MS : now + BACKUP_RETENTION_MS),
        retentionDays: data.retentionDays || 3,
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

export async function getLatestCloudBackupSnapshot(): Promise<{
  id: string;
  timestamp: number;
  createdAt: string;
  savedBy: string;
  payload: any;
} | null> {
  try {
    const list = await fetchCloudBackupSnapshots();
    if (list && list.length > 0) {
      const latest = list[0];
      const payload = await getCloudBackupSnapshotById(latest.id);
      if (payload) {
        return {
          id: latest.id,
          timestamp: latest.timestamp,
          createdAt: latest.createdAt,
          savedBy: latest.savedBy,
          payload
        };
      }
    }
  } catch (err) {
    console.warn('Failed to get latest cloud backup snapshot:', err);
  }
  return null;
}

export async function cleanExpiredBackupsFirestore(): Promise<number> {
  try {
    const now = Date.now();
    const snap = await getDocs(collection(db, 'databaseBackups'));
    let cleaned = 0;
    const batch = writeBatch(db);

    for (const d of snap.docs) {
      const data = d.data();
      const age = now - (data.timestamp || 0);
      const isExpired = (data.expiresTimestamp && data.expiresTimestamp < now) || age > BACKUP_RETENTION_MS;
      if (isExpired) {
        batch.delete(doc(db, 'databaseBackups', d.id));
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await batch.commit();
      console.log(`[Firestore Clean] Berhasil menghapus ${cleaned} snapshot kadaluarsa (> 3 hari) agar database tidak menumpuk.`);
    }
    return cleaned;
  } catch (err) {
    console.warn('Gagal membersihkan snapshot kadaluarsa di Firestore:', err);
    return 0;
  }
}

export async function deleteCloudBackupSnapshot(backupId: string): Promise<boolean> {
  const path = `databaseBackups/${backupId}`;
  try {
    // 1. Direct delete by ID
    await deleteDoc(doc(db, 'databaseBackups', backupId));
    return true;
  } catch {
    // 2. Fallback: Search matching document in collection
    try {
      const snap = await getDocs(collection(db, 'databaseBackups'));
      for (const d of snap.docs) {
        if (d.id === backupId || d.data().id === backupId || d.id.includes(backupId) || backupId.includes(d.id)) {
          await deleteDoc(doc(db, 'databaseBackups', d.id));
          return true;
        }
      }
    } catch (innerErr) {
      handleFirestoreError(innerErr, OperationType.DELETE, path);
    }
    return false;
  }
}

export async function deleteAllCloudBackupSnapshots(): Promise<number> {
  try {
    const snap = await getDocs(collection(db, 'databaseBackups'));
    let count = 0;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.delete(doc(db, 'databaseBackups', d.id));
      count++;
    }
    if (count > 0) {
      await batch.commit();
    }
    return count;
  } catch (err) {
    console.warn('Failed to delete all cloud backup snapshots:', err);
    return 0;
  }
}
