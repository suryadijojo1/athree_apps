import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Transaction, CashFlowRecord, CashierShift, KaosStockItem, StockMovement, Customer, User } from '../types';

/**
 * FIREBASE FIRESTORE STATUS: DISABLED
 * Sesuai instruksi: "disable kan Firebase Firestore, database yang digunakan adalah Cloud SQL dengan Real-time Sync".
 * Firebase Auth tetap dipertahankan untuk login akun & token verifikasi jika diperlukan.
 */
export const FIRESTORE_ENABLED = false;

// Initialize Firebase App for Auth
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();

// Firestore connection test: Always returns false because Firestore is disabled
export async function testConnection(): Promise<boolean> {
  console.info('[Firebase] Firestore is disabled. Active database is Cloud SQL PostgreSQL with Real-time Sync.');
  return false;
}

// Auth functions (retained)
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
// Firestore Realtime Collections Subscriptions (DISABLED - NO-OP)
// Real-time synchronization is handled directly by Cloud SQL & Server-Sent Events (SSE).
// ---------------------------------------------------------------------------

const NOOP_UNSUBSCRIBE = () => {};

export function subscribeToProducts(
  _onData: (products: Product[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToTransactions(
  _onData: (transactions: Transaction[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToCashFlow(
  _onData: (records: CashFlowRecord[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToShifts(
  _onData: (shifts: CashierShift[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToActiveShift(
  _onData: (shift: CashierShift | null) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToKaosStocks(
  _onData: (stocks: KaosStockItem[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToCustomers(
  _onData: (customers: Customer[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToStockMovements(
  _onData: (movements: StockMovement[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

export function subscribeToUsers(
  _onData: (users: User[]) => void,
  _onError?: (err: any) => void
) {
  return NOOP_UNSUBSCRIBE;
}

// ---------------------------------------------------------------------------
// Firestore Write helpers (DISABLED - NO-OP)
// Writes are routed to Cloud SQL via /api/database & /api/shift endpoints.
// ---------------------------------------------------------------------------

export async function saveProductToFirestore(_product: Product): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function deleteProductFromFirestore(_productId: string): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveTransactionToFirestore(_transaction: Transaction): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function deleteTransactionFromFirestore(_transactionId: string): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveCashFlowToFirestore(_record: CashFlowRecord): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function deleteCashFlowFromFirestore(_recordId: string): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveShiftToFirestore(_shift: CashierShift): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveActiveShiftToFirestore(_shift: CashierShift): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveKaosStockToFirestore(_item: KaosStockItem): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveMultipleKaosStocksToFirestore(_items: KaosStockItem[]): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveMultipleProductsToFirestore(_products: Product[]): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveCustomerToFirestore(_customer: Customer): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function deleteCustomerFromFirestore(_customerId: string): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveStockMovementToFirestore(_movement: StockMovement): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveMultipleStockMovementsToFirestore(_movements: StockMovement[]): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function saveUserToFirestore(_user: User): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

export async function deleteUserFromFirestore(_userId: string): Promise<void> {
  // Firestore disabled - handled by Cloud SQL
}

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

export async function syncAllLocalDataToFirestore(_data: any): Promise<{
  productsCount: number;
  transactionsCount: number;
  cashFlowCount: number;
  kaosCount: number;
}> {
  return {
    productsCount: 0,
    transactionsCount: 0,
    cashFlowCount: 0,
    kaosCount: 0
  };
}

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

export async function cleanExpiredBackupsFirestore(): Promise<number> {
  return 0;
}

export async function saveCloudBackupSnapshot(
  _data: any,
  _savedBy: string = 'Kasir Logout',
  _source: string = 'logout'
): Promise<string> {
  return `backup_${Date.now()}`;
}

export async function fetchCloudBackupSnapshots(): Promise<CloudBackupSnapshotMeta[]> {
  return [];
}

export async function getCloudBackupSnapshotById(_backupId: string): Promise<any | null> {
  return null;
}
