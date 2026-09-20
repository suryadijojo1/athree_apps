import { initializeApp } from 'firebase/app';
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
import { Product, Transaction, CashFlowRecord, CashierShift } from '../types';

// Initialize Firebase with exact config and database ID
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
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

// Batch Sync Local Data to Firestore
export async function syncAllLocalDataToFirestore(data: {
  products: Product[];
  transactions: Transaction[];
  cashFlowRecords: CashFlowRecord[];
  shifts: CashierShift[];
}): Promise<{ productsCount: number; transactionsCount: number; cashFlowCount: number }> {
  const batch = writeBatch(db);

  // Add products (up to batch limit)
  let count = 0;
  for (const p of data.products.slice(0, 100)) {
    batch.set(doc(db, 'products', p.id), p);
    count++;
  }

  for (const t of data.transactions.slice(0, 100)) {
    batch.set(doc(db, 'transactions', t.id), t);
    count++;
  }

  for (const c of data.cashFlowRecords.slice(0, 100)) {
    batch.set(doc(db, 'cashFlowRecords', c.id), c);
    count++;
  }

  for (const s of data.shifts.slice(0, 50)) {
    batch.set(doc(db, 'shifts', s.id), s);
    count++;
  }

  if (count > 0) {
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'batch-sync');
    }
  }

  return {
    productsCount: data.products.length,
    transactionsCount: data.transactions.length,
    cashFlowCount: data.cashFlowRecords.length
  };
}
