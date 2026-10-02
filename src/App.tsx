import React, { useState, useEffect, useRef } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_TRANSACTIONS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_USERS,
  INITIAL_SHIFT,
  INITIAL_SALES,
  INITIAL_KAOS_STOCK
} from './data/mockData';
import {
  Product,
  Customer,
  Transaction,
  StockMovement,
  User,
  CashierShift,
  OrderStatus,
  OrderItem,
  CashFlowRecord,
  KaosStockItem,
  PaymentMethod
} from './types';
import { formatCurrency } from './utils/exportUtils';
import { deductKaosStock, restoreMultipleKaosStock } from './utils/kaosStockUtils';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Header } from './components/Header';
import { PosView } from './components/PosView';
import { StockManagementView } from './components/StockManagementView';
import { DailyReportsView } from './components/DailyReportsView';
import { ProductionOrdersView } from './components/ProductionOrdersView';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginScreen } from './components/LoginScreen';
import { UserLoginModal } from './components/UserLoginModal';
import { PaymentSuccessModal } from './components/PaymentSuccessModal';
import { ShiftModal } from './components/ShiftModal';
import { CustomProductModal } from './components/CustomProductModal';
import { ReviseInvoiceModal } from './components/ReviseInvoiceModal';
import { DeleteInvoiceModal } from './components/DeleteInvoiceModal';
import { PayPiutangModal } from './components/PayPiutangModal';
import { ParsedImportProduct } from './components/ImportProductsModal';
import { UserManagementModal } from './components/UserManagementModal';
import { GoogleDriveView } from './components/GoogleDriveView';
import { KaosStockManagementView } from './components/KaosStockManagementView';
import { CloudSqlSyncModal } from './components/CloudSqlSyncModal';
import { CloudUpload, CheckCircle2 } from 'lucide-react';
import { calculateProfit } from './utils/profitUtils';
import {
  subscribeToAuth,
  saveProductToFirestore,
  deleteProductFromFirestore,
  saveMultipleProductsToFirestore,
  saveTransactionToFirestore,
  deleteTransactionFromFirestore,
  saveCashFlowToFirestore,
  deleteCashFlowFromFirestore,
  saveShiftToFirestore,
  saveActiveShiftToFirestore,
  saveKaosStockToFirestore,
  saveMultipleKaosStocksToFirestore,
  saveCustomerToFirestore,
  saveUserToFirestore,
  deleteUserFromFirestore,
  saveStockMovementToFirestore,
  saveMultipleStockMovementsToFirestore
} from './services/firebase';
import {
  fetchServerDatabase,
  fetchCurrentShiftFromServer,
  saveServerDatabase,
  saveServerBackupSnapshot,
  subscribeToServerEvents,
  startLiveShiftSync,
  syncShiftToServer,
  isRealUserData,
  AppDatabasePayload
} from './services/serverSync';
import { User as FirebaseUser } from 'firebase/auth';
import {
  isPageRefreshed,
  clearAllCookies,
  clearAllCachesAndCookies,
  markPageForRefresh,
  clearRefreshMark
} from './utils/sessionCleaner';

// Helper to check if incoming remote shift has real-time changes
// CRITICAL: Apabila operator kasir/admin belum menutup kasir maka kasir TIDAK tertutup!
const shouldApplyRemoteShift = (remoteShift: CashierShift, prevShift: CashierShift): boolean => {
  if (!remoteShift) return false;
  // Ignore dummy test shift from legacy/mock files
  if (remoteShift.id === 'shift-test') return false;
  if (!prevShift) return true;

  // RULE 1: If remote shift is OPEN and local shift is NOT open,
  // ALWAYS apply it immediately! The cashier has been opened in another browser.
  if (remoteShift.isOpen && !prevShift.isOpen) {
    console.log('Real-Time Sync: Remote shift is OPEN, transitioning local cashier to OPEN');
    return true;
  }

  // RULE 2: If local cashier is currently OPEN (prevShift.isOpen === true),
  // NEVER close it automatically unless the remote shift has an EXPLICIT closure with endTime
  if (prevShift.isOpen && !remoteShift.isOpen) {
    const isExplicitClose = Boolean(remoteShift.endTime) && (
      remoteShift.id === prevShift.id ||
      (Boolean(remoteShift.endTimestamp) && Boolean(prevShift.startTimestamp) && Number(remoteShift.endTimestamp) >= Number(prevShift.startTimestamp))
    );
    if (!isExplicitClose) {
      console.log('Real-Time Protection: Ignored remote shift closure because local cashier is still OPEN and operator/admin has not closed it.');
      return false;
    }
  }

  // If local shift is already open, do not overwrite with an older shift
  if (prevShift.isOpen && remoteShift.isOpen) {
    if (remoteShift.startTimestamp && prevShift.startTimestamp && remoteShift.startTimestamp < prevShift.startTimestamp) {
      return false;
    }
  }

  if (remoteShift.id !== prevShift.id) return true;
  if (remoteShift.isOpen !== prevShift.isOpen) return true;
  if (remoteShift.startTime !== prevShift.startTime) return true;
  if (remoteShift.startTimestamp !== prevShift.startTimestamp) return true;
  if (remoteShift.cashierName !== prevShift.cashierName) return true;
  if (remoteShift.startingCash !== prevShift.startingCash) return true;
  if (remoteShift.expectedCash !== prevShift.expectedCash) return true;
  if (remoteShift.actualCash !== prevShift.actualCash) return true;
  if (remoteShift.endTime !== prevShift.endTime) return true;
  if (remoteShift.totalSales !== prevShift.totalSales) return true;
  if (remoteShift.cashSales !== prevShift.cashSales) return true;
  if (remoteShift.nonCashSales !== prevShift.nonCashSales) return true;
  if (remoteShift.totalTransactions !== prevShift.totalTransactions) return true;
  if (remoteShift.unpaidCount !== prevShift.unpaidCount) return true;
  if (remoteShift.unpaidAmount !== prevShift.unpaidAmount) return true;
  if (remoteShift.notes !== prevShift.notes) return true;
  return false;
};

export default function App() {
  // Persistence via localStorage
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('athree_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOld = parsed.some((u: any) => u.name === 'Dian Octaviani' || u.name === 'Ahmad Rizky (Owner)');
        if (!hasOld && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_USERS;
  });

  useEffect(() => {
    localStorage.setItem('athree_users', JSON.stringify(users));
  }, [users]);
  
  // 1 Hour Inactivity / Unopened Timeout (1 Jam = 3.600.000 ms)
  const ONE_HOUR_TIMEOUT_MS = 60 * 60 * 1000;

  // Clear refresh mark once mounted
  useEffect(() => {
    clearRefreshMark();
  }, []);

  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(() => {
    return localStorage.getItem('athree_timeout_notice') || null;
  });

  const clearSessionTimeoutNotice = () => {
    setSessionTimeoutNotice(null);
    localStorage.removeItem('athree_timeout_notice');
  };

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const isAuth = localStorage.getItem('athree_is_authenticated') === 'true';
    if (!isAuth) return false;

    const lastActive = Number(localStorage.getItem('athree_last_active_time') || 0);
    if (lastActive > 0 && Date.now() - lastActive >= ONE_HOUR_TIMEOUT_MS) {
      // Lebih dari 1 jam tidak dibuka / tidak aktif -> otomatis logout
      localStorage.setItem('athree_is_authenticated', 'false');
      sessionStorage.removeItem('athree_session_active');
      const notice = 'Sesi Anda telah keluar otomatis karena aplikasi tidak dibuka / tidak aktif selama lebih dari 1 jam. Seluruh database penjualan telah otomatis tersimpan aman di Cloud & Server.';
      localStorage.setItem('athree_timeout_notice', notice);
      clearAllCachesAndCookies().catch(() => {});
      return false;
    }
    // Set active session marker for current browser session
    try {
      sessionStorage.setItem('athree_session_active', 'true');
    } catch {}
    return true;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('athree_current_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name === 'Dian Octaviani') {
          return INITIAL_USERS[0]; // DIMAS (kasir)
        }
        if (parsed.name === 'Ahmad Rizky (Owner)') {
          return INITIAL_USERS[1]; // ATHREE(Owner) (admin)
        }
        return parsed;
      } catch {}
    }
    return INITIAL_USERS[1]; // Default: ATHREE(Owner)
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('athree_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('athree_categories');
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('athree_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('athree_transactions') || localStorage.getItem('athree_transactions_persistent_backup');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_TRANSACTIONS;
  });

  useEffect(() => {
    localStorage.setItem('athree_transactions', JSON.stringify(transactions));
    if (transactions.length > 0) {
      localStorage.setItem('athree_transactions_persistent_backup', JSON.stringify(transactions));
    }
  }, [transactions]);

  const [kaosStocks, setKaosStocks] = useState<KaosStockItem[]>(() => {
    const saved = localStorage.getItem('athree_kaos_stocks');
    return saved ? JSON.parse(saved) : INITIAL_KAOS_STOCK;
  });

  useEffect(() => {
    localStorage.setItem('athree_kaos_stocks', JSON.stringify(kaosStocks));
  }, [kaosStocks]);

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    const saved = localStorage.getItem('athree_stock_movements');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_MOVEMENTS;
  });

  useEffect(() => {
    localStorage.setItem('athree_stock_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  const [salesList, setSalesList] = useState<string[]>(() => {
    const saved = localStorage.getItem('athree_sales_list');
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  useEffect(() => {
    localStorage.setItem('athree_sales_list', JSON.stringify(salesList));
  }, [salesList]);

  const handleAddSales = (newSalesName: string) => {
    const trimmed = newSalesName.trim();
    if (!trimmed) return;
    if (!salesList.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSalesList((prev) => [...prev, trimmed]);
    }
  };

  const handleDeleteSales = (salesName: string) => {
    if (salesName === 'Kasir (Dimas)' || salesName === 'Admin (DEAZBAR)') return;
    setSalesList((prev) => prev.filter((s) => s !== salesName));
  };

  const [shift, setShift] = useState<CashierShift>(() => {
    const saved = localStorage.getItem('athree_shift') || localStorage.getItem('athree_shift_active_persistent');
    const todayFormatted = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    if (saved) {
      try {
        const parsed: CashierShift = JSON.parse(saved);
        // Manual & Real-time: Pertahankan status buka/tutup kasir (isOpen) apa adanya tanpa reset otomatis saat refresh
        if (parsed && typeof parsed.isOpen === 'boolean') {
          return parsed;
        }
      } catch {}
    }
    return {
      id: `shift-active`,
      shiftNumber: 1,
      outletName: 'Athree Studio Jayapura',
      cashierName: 'DIMAS',
      startTime: '-',
      startTimestamp: 0,
      startingCash: 500000,
      cashSales: 0,
      nonCashSales: 0,
      totalSales: 0,
      expectedCash: 500000,
      isOpen: false,
      notes: `Kasir Harian - ${todayFormatted}`
    };
  });

  const [shiftHistory, setShiftHistory] = useState<CashierShift[]>(() => {
    const saved = localStorage.getItem('athree_shift_history');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'shift-1',
            shiftNumber: 1,
            outletName: 'Default Outlet',
            cashierName: 'DIMAS',
            startTime: '16 Sep 2026, 08:00',
            endTime: '16 Sep 2026, 17:00',
            startingCash: 500000,
            cashSales: 1250000,
            nonCashSales: 1800000,
            totalSales: 3050000,
            expectedCash: 1750000,
            actualCash: 1750000,
            difference: 0,
            isOpen: false,
            notes: 'Shift #1 ditutup balance 100%',
            totalTransactions: 6,
            totalDiscount: 25000,
            unpaidCount: 0,
            unpaidAmount: 0,
            paymentMethodBreakdown: {
              cash: 1250000,
              transfer: 1000000,
              qris: 800000,
              other: 0
            }
          }
        ];
  });

  const [cashFlowRecords, setCashFlowRecords] = useState<CashFlowRecord[]>(() => {
    const saved = localStorage.getItem('athree_cash_flow');
    if (saved) {
      try {
        const parsed: CashFlowRecord[] = JSON.parse(saved);
        const cleaned = parsed.filter(
          (r) => r.id !== 'cf-1' && r.id !== 'cf-2' && !r.id.startsWith('cf-179006656569')
        );
        return cleaned;
      } catch {
        return [];
      }
    }
    return [];
  });

  // Navigation and UI states
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    return currentUser.role === 'admin' ? 'dashboard' : 'pos';
  });
  const [reportsSubTab, setReportsSubTab] = useState<'daily_sales' | 'sales_profit'>('daily_sales');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Role permissions: Allow cashier access to Google Drive
  const [allowCashierDrive, setAllowCashierDrive] = useState<boolean>(() => {
    return localStorage.getItem('athree_allow_cashier_drive') === 'true';
  });

  const handleToggleAllowCashierDrive = (allowed: boolean) => {
    setAllowCashierDrive(allowed);
    localStorage.setItem('athree_allow_cashier_drive', allowed ? 'true' : 'false');
  };

  // If currently on drive tab but user is non-admin and cashier access is disabled, redirect to pos
  useEffect(() => {
    if (activeTab === 'drive' && currentUser.role !== 'admin' && !allowCashierDrive) {
      setActiveTab('pos');
    }
  }, [currentUser.role, activeTab, allowCashierDrive]);

  // Modals
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [shiftModalMode, setShiftModalMode] = useState<
    'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history' | undefined
  >(undefined);

  const handleOpenShiftModal = (
    mode?: 'overview' | 'reconcile' | 'closed_summary' | 'open_shift' | 'history'
  ) => {
    setShiftModalMode(mode);
    setIsShiftModalOpen(true);
  };

  const [isCustomProductModalOpen, setIsCustomProductModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [successTx, setSuccessTx] = useState<Transaction | null>(null);
  const [revisingTx, setRevisingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [payingPiutangTx, setPayingPiutangTx] = useState<Transaction | null>(null);

  // Firebase & Server Cloud Sync State
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Maintain latest state reference to avoid stale closures during sync
  const latestStateRef = useRef({
    products,
    categories,
    transactions,
    cashFlowRecords,
    shiftHistory,
    shift,
    kaosStocks,
    stockMovements,
    customers,
    users,
    salesList
  });

  useEffect(() => {
    latestStateRef.current = {
      products,
      categories,
      transactions,
      cashFlowRecords,
      shiftHistory,
      shift,
      kaosStocks,
      stockMovements,
      customers,
      users,
      salesList
    };
  }, [products, categories, transactions, cashFlowRecords, shiftHistory, shift, kaosStocks, stockMovements, customers, users, salesList]);

  // Set up Central Server & Cloud Synchronization
  const isApplyingRemoteRef = useRef(false);

  const applyFullDatabasePayload = (payload: AppDatabasePayload) => {
    isApplyingRemoteRef.current = true;
    try {
      if (payload.products && Array.isArray(payload.products) && payload.products.length > 0) {
        setProducts(payload.products);
        localStorage.setItem('athree_products', JSON.stringify(payload.products));
      }
      if (payload.categories && Array.isArray(payload.categories) && payload.categories.length > 0) {
        setCategories(payload.categories);
        localStorage.setItem('athree_categories', JSON.stringify(payload.categories));
      }
      if (payload.transactions && Array.isArray(payload.transactions) && payload.transactions.length > 0) {
        setTransactions((prev) => {
          const map = new Map<string, Transaction>();
          for (const tx of prev) {
            map.set(tx.id, tx);
          }
          for (const tx of payload.transactions) {
            map.set(tx.id, tx);
          }
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()
          );
          localStorage.setItem('athree_transactions', JSON.stringify(merged));
          localStorage.setItem('athree_transactions_persistent_backup', JSON.stringify(merged));
          return merged;
        });
      }
      if (payload.cashFlowRecords && Array.isArray(payload.cashFlowRecords)) {
        const cleaned = payload.cashFlowRecords.filter(
          (r) => r.id !== 'cf-1' && r.id !== 'cf-2' && !r.id.startsWith('cf-179006656569')
        );
        setCashFlowRecords(cleaned);
        localStorage.setItem('athree_cash_flow', JSON.stringify(cleaned));
      }
      if (payload.shiftHistory && Array.isArray(payload.shiftHistory)) {
        setShiftHistory(payload.shiftHistory);
        localStorage.setItem('athree_shift_history', JSON.stringify(payload.shiftHistory));
      }
      // Apply active shift state from server / remote browser in real-time
      if (payload.currentShift) {
        const remoteShift = payload.currentShift;
        setShift((prevShift) => {
          if (shouldApplyRemoteShift(remoteShift, prevShift)) {
            console.log('Real-Time Sync: Updating active shift from central database:', {
              isOpen: remoteShift.isOpen,
              startTime: remoteShift.startTime,
              cashierName: remoteShift.cashierName
            });
            localStorage.setItem('athree_shift', JSON.stringify(remoteShift));
            return remoteShift;
          }
          return prevShift;
        });
      }
      if (payload.kaosStocks && Array.isArray(payload.kaosStocks) && payload.kaosStocks.length > 0) {
        setKaosStocks(payload.kaosStocks);
        localStorage.setItem('athree_kaos_stocks', JSON.stringify(payload.kaosStocks));
      }
      if (payload.stockMovements && Array.isArray(payload.stockMovements)) {
        setStockMovements(payload.stockMovements);
        localStorage.setItem('athree_stock_movements', JSON.stringify(payload.stockMovements));
      }
      if (payload.customers && Array.isArray(payload.customers) && payload.customers.length > 0) {
        setCustomers(payload.customers);
        localStorage.setItem('athree_customers', JSON.stringify(payload.customers));
      }
      if (payload.users && Array.isArray(payload.users) && payload.users.length > 0) {
        setUsers(payload.users);
        localStorage.setItem('athree_users', JSON.stringify(payload.users));
        // Keep currentUser synchronized with the server's user data
        setCurrentUser((prev) => {
          const match = payload.users?.find(
            (u) => u.id === prev.id || u.username === prev.username || u.name.toLowerCase() === prev.name.toLowerCase()
          );
          if (match) {
            localStorage.setItem('athree_current_user', JSON.stringify(match));
            return match;
          }
          return prev;
        });
      }
      if (payload.salesList && Array.isArray(payload.salesList) && payload.salesList.length > 0) {
        setSalesList(payload.salesList);
        localStorage.setItem('athree_sales_list', JSON.stringify(payload.salesList));
      }
      localStorage.setItem('athree_last_save_time', String(Date.now()));
    } finally {
      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 500);
    }
  };

  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const syncCurrentStateToServer = (immediate = false) => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const performSync = () => {
      const currentState = latestStateRef.current;
      saveServerDatabase({
        products: currentState.products,
        categories: currentState.categories,
        transactions: currentState.transactions,
        cashFlowRecords: currentState.cashFlowRecords,
        shiftHistory: currentState.shiftHistory,
        currentShift: currentState.shift,
        kaosStocks: currentState.kaosStocks,
        stockMovements: currentState.stockMovements,
        customers: currentState.customers,
        users: currentState.users,
        salesList: currentState.salesList,
        isRealData: isRealUserData(currentState.transactions)
      }).catch((err) => console.warn('Sync to central server error:', err));
    };

    if (immediate) {
      performSync();
    } else {
      syncTimerRef.current = setTimeout(performSync, 300);
    }
  };

  // Set up Automatic Cloud Synchronization
  useEffect(() => {
    let isSubscribed = true;

    // A. Central Server Real-Time Sync (Cross-browser automatic hydration)
    const checkAndSyncCentralServer = async () => {
      try {
        const serverRes = await fetchServerDatabase();
        if (!isSubscribed) return;

        const currentTransactions = latestStateRef.current.transactions;
        const localHasRealData = isRealUserData(currentTransactions);

        if (serverRes.success && serverRes.data) {
          if (serverRes.isRealData) {
            if (!localHasRealData || serverRes.data.transactions.length >= currentTransactions.length) {
              console.log('Central Server: Hydrating state from master server database...');
              applyFullDatabasePayload(serverRes.data);
            } else if (localHasRealData && currentTransactions.length > serverRes.data.transactions.length) {
              console.log('Central Server: Local browser has more transactions, updating server...');
              syncCurrentStateToServer(true);
            }
          } else {
            if (localHasRealData) {
              console.log('Central Server: Seeding master data from current browser to server...');
              syncCurrentStateToServer(true);
            } else if (serverRes.data.transactions && serverRes.data.transactions.length > 0) {
              applyFullDatabasePayload(serverRes.data);
            }
          }
        } else {
          // Server has no data stored yet, initialize server with current browser data
          console.log('Central Server: Initializing master data from current browser to server...');
          syncCurrentStateToServer(true);
        }
      } catch (err) {
        console.warn('Central server sync init error:', err);
      }
    };

    checkAndSyncCentralServer();

    // Reusable handler to apply remote shift changes across all sync mechanisms
    const applyShiftUpdate = (remoteShift: CashierShift) => {
      if (!isSubscribed || !remoteShift) return;
      setShift((prevShift) => {
        if (shouldApplyRemoteShift(remoteShift, prevShift)) {
          console.log('Real-Time Live Shift: Syncing active shift from central server:', {
            isOpen: remoteShift.isOpen,
            startTime: remoteShift.startTime,
            cashierName: remoteShift.cashierName
          });
          localStorage.setItem('athree_shift', JSON.stringify(remoteShift));
          if (remoteShift.isOpen) {
            localStorage.setItem('athree_shift_active_persistent', JSON.stringify(remoteShift));
          } else {
            localStorage.removeItem('athree_shift_active_persistent');
          }
          latestStateRef.current.shift = remoteShift;
          return remoteShift;
        } else if (prevShift.isOpen && (!remoteShift.isOpen || remoteShift.id !== prevShift.id)) {
          // Local browser has open cashier, ensure server knows about this active open shift
          syncShiftToServer(prevShift, `${currentUser.name} (Buka Kasir Aktif)`).catch(() => {});
        }
        return prevShift;
      });
    };

    // Fast-fetch active live shift from central server for instant cross-browser agreement
    fetchCurrentShiftFromServer().then((remoteShift) => {
      if (remoteShift) applyShiftUpdate(remoteShift);
    }).catch(() => {});

    // Ultra-fast dedicated live shift synchronizer (1.5s heartbeat)
    const unsubLiveShift = startLiveShiftSync((liveShift) => {
      applyShiftUpdate(liveShift);
    });

    const unsubServer = subscribeToServerEvents(
      (remoteData) => {
        if (!isSubscribed) return;
        applyFullDatabasePayload(remoteData);
      },
      (liveShift) => {
        applyShiftUpdate(liveShift);
      }
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncCentralServer();
        fetchCurrentShiftFromServer().then((remoteShift) => {
          if (remoteShift) applyShiftUpdate(remoteShift);
        }).catch(() => {});
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkAndSyncCentralServer);

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'athree_shift' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed.isOpen === 'boolean') {
            applyShiftUpdate(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('athree_cross_tab_sync');
      bc.onmessage = (event) => {
        if (!isSubscribed) return;
        if (event.data && event.data.payload) {
          applyFullDatabasePayload(event.data.payload);
        }
        if (event.data && event.data.currentShift) {
          const remoteShift = event.data.currentShift;
          setShift((prevShift) => {
            if (shouldApplyRemoteShift(remoteShift, prevShift)) {
              localStorage.setItem('athree_shift', JSON.stringify(remoteShift));
              return remoteShift;
            }
            return prevShift;
          });
        }
      };
    } catch {}

    // Cloud SQL Real-Time Sync is active by default
    setIsFirebaseConnected(true);

    const unsubAuth = subscribeToAuth((user) => {
      if (isSubscribed) setFirebaseUser(user);
    });

    return () => {
      isSubscribed = false;
      unsubLiveShift();
      unsubServer();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkAndSyncCentralServer);
      window.removeEventListener('storage', handleStorageEvent);
      if (bc) bc.close();
      unsubAuth();
    };
  }, []);

  // 2. Debounced automatic push to central server whenever state changes
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isApplyingRemoteRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      syncCurrentStateToServer();
      localStorage.setItem('athree_last_save_time', String(Date.now()));
      try {
        const bc = new BroadcastChannel('athree_cross_tab_sync');
        bc.postMessage({
          payload: {
            products,
            categories,
            transactions,
            cashFlowRecords,
            shiftHistory,
            currentShift: shift,
            kaosStocks,
            stockMovements,
            customers,
            users,
            salesList,
            lastUpdated: new Date().toISOString(),
            isRealData: isRealUserData(transactions)
          }
        });
        bc.close();
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [products, categories, transactions, cashFlowRecords, shiftHistory, shift, kaosStocks, stockMovements, customers, users, salesList]);

  // Tangkap refresh & unload browser: tandai refresh dan simpan snapshot via sendBeacon agar tidak ada data hilang
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        markPageForRefresh();
        const currentState = latestStateRef.current;
        if (currentState && currentState.transactions) {
          const payload = {
            products: currentState.products,
            categories: currentState.categories,
            transactions: currentState.transactions,
            cashFlowRecords: currentState.cashFlowRecords,
            shiftHistory: currentState.shiftHistory,
            currentShift: currentState.shift,
            kaosStocks: currentState.kaosStocks,
            stockMovements: currentState.stockMovements,
            customers: currentState.customers,
            users: currentState.users,
            salesList: currentState.salesList,
            lastUpdated: new Date().toISOString(),
            isRealData: isRealUserData(currentState.transactions),
            savedBy: 'Auto-Save (Page Refresh / Unload)',
            source: 'page_refresh'
          };
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/database/save-all', blob);
          }
        }
      } catch (err) {
        console.warn('Beacon save error during unload:', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleApplyCloudData = (cloudData: {
    products: Product[];
    transactions: Transaction[];
    cashFlowRecords: CashFlowRecord[];
    shifts: CashierShift[];
    kaosStocks?: KaosStockItem[];
    customers?: Customer[];
    users?: User[];
  }) => {
    if (cloudData.products && cloudData.products.length > 0) {
      setProducts(cloudData.products);
      localStorage.setItem('athree_products', JSON.stringify(cloudData.products));
    }
    if (cloudData.transactions && cloudData.transactions.length > 0) {
      setTransactions(cloudData.transactions);
      localStorage.setItem('athree_transactions', JSON.stringify(cloudData.transactions));
    }
    if (cloudData.cashFlowRecords && cloudData.cashFlowRecords.length > 0) {
      const cleaned = cloudData.cashFlowRecords.filter(
        (r) => r.id !== 'cf-1' && r.id !== 'cf-2' && !r.id.startsWith('cf-179006656569')
      );
      setCashFlowRecords(cleaned);
      localStorage.setItem('athree_cash_flow', JSON.stringify(cleaned));
    }
    if (cloudData.shifts && cloudData.shifts.length > 0) {
      setShiftHistory(cloudData.shifts);
      localStorage.setItem('athree_shift_history', JSON.stringify(cloudData.shifts));
    }
    if (cloudData.kaosStocks && cloudData.kaosStocks.length > 0) {
      setKaosStocks(cloudData.kaosStocks);
      localStorage.setItem('athree_kaos_stocks', JSON.stringify(cloudData.kaosStocks));
    }
    if (cloudData.customers && cloudData.customers.length > 0) {
      setCustomers(cloudData.customers);
      localStorage.setItem('athree_customers', JSON.stringify(cloudData.customers));
    }
    if (cloudData.users && cloudData.users.length > 0) {
      setUsers(cloudData.users);
      localStorage.setItem('athree_users', JSON.stringify(cloudData.users));
    }
  };

  // User management handlers
  const handleUpdateUser = (updatedUser: User) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
    );
    saveUserToFirestore(updatedUser).catch(() => {});
    // If updating current logged in user, also update currentUser
    if (currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem('athree_current_user', JSON.stringify(updatedUser));
    }
    // Also update shift.cashierName if it was this user
    setShift((prev) => {
      const oldUser = users.find((u) => u.id === updatedUser.id);
      if (oldUser && prev.cashierName.toLowerCase() === oldUser.name.toLowerCase()) {
        return {
          ...prev,
          cashierName: updatedUser.name
        };
      }
      return prev;
    });
  };

  const handleAddUser = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
    saveUserToFirestore(newUser).catch(() => {});
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === currentUser.id) {
      alert('Tidak dapat menghapus akun yang sedang Anda gunakan saat ini.');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    deleteUserFromFirestore(userId).catch(() => {});
  };

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('athree_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('athree_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('athree_customers', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('athree_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('athree_stock_movements', JSON.stringify(stockMovements));
  }, [stockMovements]);

  useEffect(() => {
    localStorage.setItem('athree_shift', JSON.stringify(shift));
  }, [shift]);

  useEffect(() => {
    localStorage.setItem('athree_shift_history', JSON.stringify(shiftHistory));
  }, [shiftHistory]);

  const handleUpdateShift = (updatedShift: CashierShift) => {
    setShift(updatedShift);
    localStorage.setItem('athree_shift', JSON.stringify(updatedShift));
    if (updatedShift.isOpen) {
      localStorage.setItem('athree_shift_active_persistent', JSON.stringify(updatedShift));
    } else {
      localStorage.removeItem('athree_shift_active_persistent');
    }
    latestStateRef.current.shift = updatedShift;

    // 1. Instantly push to Firestore realtime collection so all internet browsers get onSnapshot
    saveActiveShiftToFirestore(updatedShift).catch((err) =>
      console.warn('Realtime Firestore active shift error:', err)
    );

    // 2. Instantly fast-sync to server which notifies all connected browsers via SSE
    syncShiftToServer(
      updatedShift,
      `${currentUser.name} (${updatedShift.isOpen ? 'Buka Kasir' : 'Tutup Kasir'})`
    ).catch((err) => console.warn('Server shift update error:', err));

    // 3. Update master server database
    const currentState = latestStateRef.current;
    saveServerDatabase(
      {
        products: currentState.products,
        categories: currentState.categories,
        transactions: currentState.transactions,
        cashFlowRecords: currentState.cashFlowRecords,
        shiftHistory: currentState.shiftHistory,
        currentShift: updatedShift,
        kaosStocks: currentState.kaosStocks,
        stockMovements: currentState.stockMovements,
        customers: currentState.customers,
        users: currentState.users,
        salesList: currentState.salesList,
        isRealData: isRealUserData(currentState.transactions)
      },
      {
        savedBy: `${currentUser.name} (${updatedShift.isOpen ? 'Buka Kasir' : 'Tutup Kasir'})`,
        source: 'shift-update'
      }
    ).catch(() => {});

    // 4. Instantly broadcast to other tabs on the same device
    try {
      const bc = new BroadcastChannel('athree_cross_tab_sync');
      bc.postMessage({
        type: 'SHIFT_UPDATE',
        currentShift: updatedShift,
        sender: 'shift-handler'
      });
      bc.close();
    } catch {}
  };

  const handleSaveShiftToHistory = (closedShift: CashierShift) => {
    setShiftHistory((prev) => {
      const exists = prev.some((s) => s.id === closedShift.id && s.endTime);
      if (exists) return prev;
      return [closedShift, ...prev];
    });
    // Immediately synchronize closed shift state across all browsers
    handleUpdateShift(closedShift);
    saveShiftToFirestore(closedShift).catch((err) => console.warn('Sync shift error:', err));
  };

  useEffect(() => {
    localStorage.setItem('athree_cash_flow', JSON.stringify(cashFlowRecords));
  }, [cashFlowRecords]);

  // Handler: Add cash flow (income / expense)
  const handleAddCashFlow = (newRecord: Omit<CashFlowRecord, 'id'>) => {
    const cfId = `cf-${Date.now()}`;
    let linkedTxId: string | undefined = undefined;

    // Untuk Pendapatan Lain (INCOME):
    // Dicatat di daftar transaksi penjualan.
    // Jika Transfer: tercatat di daftar transaksi penjualan & omset, tapi TIDAK ditambahkan ke kas laci.
    // Jika Tunai: ditambahkan ke saldo kas toko per hari tgl input & tercatat di daftar transaksi penjualan.
    if (newRecord.type === 'INCOME') {
      const isTransfer = newRecord.paymentMethod === 'TRANSFER';
      const txId = `tx-pl-${Date.now()}`;
      linkedTxId = txId;
      const datePart = newRecord.date
        ? newRecord.date.replace(/[^0-9]/g, '').slice(2, 8)
        : new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const invoiceNo = `PL-${datePart}-${Math.floor(100 + Math.random() * 900)}`;

      const newTx: Transaction = {
        id: txId,
        invoiceNo,
        date: newRecord.date || new Date().toISOString().slice(0, 16).replace('T', ' '),
        dueDate: newRecord.date ? newRecord.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        customer: {
          id: `cust-pl-${Date.now()}`,
          name: `Pendapatan Lain (${newRecord.category})`,
          phone: '-'
        },
        orderType: 'Pendapatan Lain',
        items: [
          {
            productId: `prod-pl-${Date.now()}`,
            name: `${newRecord.category}${newRecord.description ? ' - ' + newRecord.description : ''}`,
            sku: 'PL',
            price: newRecord.amount,
            quantity: 1,
            subtotal: newRecord.amount
          }
        ],
        subtotal: newRecord.amount,
        discount: 0,
        tax: 0,
        total: newRecord.amount,
        amountPaid: newRecord.amount,
        change: 0,
        paymentMethod: isTransfer ? 'Transfer Bank' : 'Tunai',
        status: 'Selesai',
        paymentStatus: 'LUNAS',
        cashierName: newRecord.recordedBy || currentUser.name,
        cashierId: currentUser.id,
        notes: `[Pendapatan Lain] ${newRecord.category}: ${newRecord.description || '-'}`,
        createdAt: new Date().toISOString(),
        shiftId: shift?.id
      };

      setTransactions((prev) => [newTx, ...prev]);
      saveTransactionToFirestore(newTx).catch((err) => console.warn('Sync tx error:', err));
    }

    const rec: CashFlowRecord = {
      ...newRecord,
      id: cfId,
      transactionId: linkedTxId,
      shiftId: shift?.id,
      createdAt: new Date().toISOString()
    };
    setCashFlowRecords((prev) => [rec, ...prev]);
    saveCashFlowToFirestore(rec).catch((err) => console.warn('Sync cashflow error:', err));
    syncCurrentStateToServer();
  };

  // Handler: Update / Revisi cash flow (income / expense)
  const handleUpdateCashFlow = (updatedRecord: CashFlowRecord) => {
    setCashFlowRecords((prev) =>
      prev.map((c) =>
        c.id === updatedRecord.id
          ? {
              ...updatedRecord,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser.name
            }
          : c
      )
    );
    saveCashFlowToFirestore(updatedRecord).catch((err) =>
      console.warn('Sync cashflow update error:', err)
    );

    // If it's an INCOME record, sync changes with linked transaction
    if (updatedRecord.type === 'INCOME') {
      const isTransfer = updatedRecord.paymentMethod === 'TRANSFER';
      if (updatedRecord.transactionId) {
        setTransactions((prev) =>
          prev.map((tx) => {
            if (tx.id === updatedRecord.transactionId) {
              const updatedTx: Transaction = {
                ...tx,
                date: updatedRecord.date || tx.date,
                dueDate: updatedRecord.date ? updatedRecord.date.slice(0, 10) : tx.dueDate,
                customer: {
                  ...tx.customer,
                  name: `Pendapatan Lain (${updatedRecord.category})`
                },
                items: [
                  {
                    ...(tx.items[0] || { productId: 'prod-pl', sku: 'PL', quantity: 1 }),
                    name: `${updatedRecord.category}${
                      updatedRecord.description ? ' - ' + updatedRecord.description : ''
                    }`,
                    price: updatedRecord.amount,
                    subtotal: updatedRecord.amount
                  }
                ],
                subtotal: updatedRecord.amount,
                total: updatedRecord.amount,
                amountPaid: updatedRecord.amount,
                paymentMethod: isTransfer ? 'Transfer Bank' : 'Tunai',
                notes: `[Pendapatan Lain] ${updatedRecord.category}: ${
                  updatedRecord.description || '-'
                }`
              };
              saveTransactionToFirestore(updatedTx).catch((err) =>
                console.warn('Sync updated tx error:', err)
              );
              return updatedTx;
            }
            return tx;
          })
        );
      } else {
        // Create new linked transaction if legacy record lacked one
        const txId = `tx-pl-${Date.now()}`;
        const datePart = updatedRecord.date
          ? updatedRecord.date.replace(/[^0-9]/g, '').slice(2, 8)
          : new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const invoiceNo = `PL-${datePart}-${Math.floor(100 + Math.random() * 900)}`;

        const newTx: Transaction = {
          id: txId,
          invoiceNo,
          date: updatedRecord.date || new Date().toISOString().slice(0, 16).replace('T', ' '),
          dueDate: updatedRecord.date ? updatedRecord.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          customer: {
            id: `cust-pl-${Date.now()}`,
            name: `Pendapatan Lain (${updatedRecord.category})`,
            phone: '-'
          },
          orderType: 'Pendapatan Lain',
          items: [
            {
              productId: `prod-pl-${Date.now()}`,
              name: `${updatedRecord.category}${
                updatedRecord.description ? ' - ' + updatedRecord.description : ''
              }`,
              sku: 'PL',
              price: updatedRecord.amount,
              quantity: 1,
              subtotal: updatedRecord.amount
            }
          ],
          subtotal: updatedRecord.amount,
          discount: 0,
          tax: 0,
          total: updatedRecord.amount,
          amountPaid: updatedRecord.amount,
          change: 0,
          paymentMethod: isTransfer ? 'Transfer Bank' : 'Tunai',
          status: 'Selesai',
          paymentStatus: 'LUNAS',
          cashierName: updatedRecord.recordedBy || currentUser.name,
          cashierId: currentUser.id,
          notes: `[Pendapatan Lain] ${updatedRecord.category}: ${
            updatedRecord.description || '-'
          }`,
          createdAt: new Date().toISOString(),
          shiftId: shift?.id
        };

        updatedRecord.transactionId = txId;
        setTransactions((prev) => [newTx, ...prev]);
        saveTransactionToFirestore(newTx).catch((err) => console.warn('Sync tx error:', err));
        saveCashFlowToFirestore(updatedRecord).catch((err) => console.warn('Sync cf error:', err));
      }
    }

    syncCurrentStateToServer();
  };

  // Handler: Hapus cash flow record (income / expense)
  const handleDeleteCashFlow = (id: string) => {
    const target = cashFlowRecords.find((c) => c.id === id);
    if (!target) return;

    setCashFlowRecords((prev) => prev.filter((c) => c.id !== id));
    deleteCashFlowFromFirestore(id).catch((err) =>
      console.warn('Delete cashflow error:', err)
    );

    if (target.transactionId) {
      setTransactions((prev) => prev.filter((t) => t.id !== target.transactionId));
      deleteTransactionFromFirestore(target.transactionId).catch((err) =>
        console.warn('Delete linked tx error:', err)
      );
    }

    syncCurrentStateToServer();
  };

  // Handler: Full Login (from LoginScreen)
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('athree_is_authenticated', 'true');
    sessionStorage.setItem('athree_session_active', 'true');
    localStorage.setItem('athree_current_user', JSON.stringify(user));
    localStorage.setItem('athree_last_active_time', String(Date.now()));
    localStorage.removeItem('athree_timeout_notice');
    setSessionTimeoutNotice(null);
    if (user.role === 'admin') {
      setActiveTab('dashboard');
    } else if (user.role === 'kasir') {
      setActiveTab('pos');
    } else {
      setActiveTab('orders');
    }
  };

  // Logout & Cloud Auto-Save state
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [logoutStep, setLogoutStep] = useState<string>('Menyimpan Data ke Cloud...');
  const [logoutSuccess, setLogoutSuccess] = useState<boolean>(false);

  // Helper: Simpan seluruh database ke Cloud Firestore & Server (Snapshot retensi 14 hari)
  const executeFullCloudDatabaseSave = async (
    savedBy: string,
    source: string,
    onStep?: (step: string) => void,
    overrideShift?: CashierShift
  ) => {
    const currentState = latestStateRef.current;
    const shiftToSave = overrideShift || currentState.shift;

    if (onStep) onStep('Menyimpan data penjualan ke Server & Cloud...');

    // 1. Parallel save to Server Master and Server Snapshot (ultra fast)
    const serverSavePromise = saveServerDatabase(
      {
        products: currentState.products,
        categories: currentState.categories,
        transactions: currentState.transactions,
        cashFlowRecords: currentState.cashFlowRecords,
        shiftHistory: currentState.shiftHistory,
        currentShift: shiftToSave,
        kaosStocks: currentState.kaosStocks,
        stockMovements: currentState.stockMovements,
        customers: currentState.customers,
        users: currentState.users,
        salesList: currentState.salesList,
        isRealData: true
      },
      { savedBy, source }
    ).catch((err) => console.warn('Server save warning:', err));

    const serverBackupPromise = saveServerBackupSnapshot(
      {
        products: currentState.products,
        transactions: currentState.transactions,
        cashFlowRecords: currentState.cashFlowRecords,
        shiftHistory: currentState.shiftHistory,
        kaosStocks: currentState.kaosStocks,
        stockMovements: currentState.stockMovements,
        customers: currentState.customers,
        users: currentState.users,
        salesList: currentState.salesList
      },
      savedBy,
      source
    ).catch((err) => console.warn('Server backup warning:', err));

    // Wait for critical saves with safety timeout (max 1200ms)
    const timeout = new Promise((resolve) => setTimeout(resolve, 1200));
    await Promise.race([
      Promise.all([serverSavePromise, serverBackupPromise]),
      timeout
    ]);

    // Ensure local backup is stored
    try {
      localStorage.setItem('athree_transactions_persistent_backup', JSON.stringify(currentState.transactions));
    } catch {}
  };

  // Handler: Logout Manual oleh Kasir / Admin
  const handleLogout = async () => {
    setIsLoggingOut(true);
    setLogoutSuccess(false);
    setLogoutStep('Menyimpan data & logout...');

    const currentOperator = currentUser?.name || 'Kasir';

    try {
      const savePromise = executeFullCloudDatabaseSave(
        `${currentOperator} (Logout)`,
        'logout',
        (step) => setLogoutStep(step),
        latestStateRef.current.shift
      );

      // Max 1.5s total wait to guarantee logout is instant and never gets stuck
      const safetyTimeout = new Promise((resolve) => setTimeout(resolve, 1500));
      await Promise.race([savePromise, safetyTimeout]);

      setLogoutSuccess(true);
      setLogoutStep('Database Berhasil Disimpan Aman!');
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.warn('Logout cloud save warning:', err);
    } finally {
      // Synchronously clear authentication markers so the user is immediately taken to LoginScreen
      try {
        localStorage.setItem('athree_is_authenticated', 'false');
        localStorage.removeItem('athree_session_active');
        sessionStorage.removeItem('athree_session_active');
        sessionStorage.clear();
      } catch {}

      try {
        clearAllCookies();
      } catch {}

      setIsAuthenticated(false);
      setIsLoginModalOpen(false);
      setIsShiftModalOpen(false);
      setIsCustomProductModalOpen(false);
      setIsLoggingOut(false);
      setLogoutSuccess(false);

      fetch('/api/clear-session', { method: 'POST' }).catch(() => {});
    }
  };

  // Handler: Auto-Save & Auto-Logout jika aplikasi tidak dibuka atau tidak ada aktivitas selama 1 Jam
  const isAutoLoggingOutRef = useRef(false);
  const handleAutoInactivityLogout = async () => {
    if (isAutoLoggingOutRef.current) return;
    isAutoLoggingOutRef.current = true;

    setIsLoggingOut(true);
    setLogoutSuccess(false);
    setLogoutStep('Aplikasi tidak aktif 1 jam: Menyimpan otomatis ke Cloud...');

    const currentOperator = currentUser?.name || 'Kasir';
    try {
      await executeFullCloudDatabaseSave(
        `${currentOperator} (Auto-Save 1 Jam)`,
        'auto_timeout_1_hour',
        (step) => setLogoutStep(step)
      );
      setLogoutSuccess(true);
      setLogoutStep('Database Otomatis Disimpan Aman di Cloud (14 Hari)!');
      await new Promise((r) => setTimeout(r, 650));
    } catch (err) {
      console.warn('Auto timeout save warning:', err);
    } finally {
      await clearAllCachesAndCookies().catch(() => {});
      setIsAuthenticated(false);
      localStorage.setItem('athree_is_authenticated', 'false');
      const notice = 'Sesi Anda telah keluar otomatis karena aplikasi tidak dibuka / tidak ada aktivitas selama 1 jam. Seluruh database penjualan telah otomatis tersimpan aman di Cloud Firestore & Server Pusat.';
      localStorage.setItem('athree_timeout_notice', notice);
      setSessionTimeoutNotice(notice);
      setIsLoginModalOpen(false);
      setIsShiftModalOpen(false);
      setIsCustomProductModalOpen(false);
      setIsLoggingOut(false);
      setLogoutSuccess(false);
      isAutoLoggingOutRef.current = false;
    }
  };

  // Handler: Manual Refresh & Bersihkan Cache & Cookies (Auto-Logout)
  const handleRefreshAndClearCache = async () => {
    setIsLoggingOut(true);
    setLogoutSuccess(false);
    setLogoutStep('Menyimpan data penjualan sebelum refresh...');

    try {
      markPageForRefresh();
      await executeFullCloudDatabaseSave(
        `${currentUser?.name || 'Kasir'} (Refresh & Hapus Cache)`,
        'manual_refresh_clear_cache',
        (step) => setLogoutStep(step)
      );
      setLogoutSuccess(true);
      setLogoutStep('Membersihkan cache & cookies browser...');
      await new Promise((r) => setTimeout(r, 400));
      await clearAllCachesAndCookies();
      localStorage.setItem('athree_is_authenticated', 'false');
      localStorage.setItem(
        'athree_timeout_notice',
        'Aplikasi baru saja di-refresh. Anda telah otomatis terlogout demi keamanan kasir, serta seluruh cache dan cookies browser telah dibersihkan.'
      );
    } catch (err) {
      console.warn('Error during manual refresh and clear cache:', err);
    } finally {
      window.location.reload();
    }
  };

  // Effect: Pantau aktivitas pengguna & deteksi jika aplikasi tidak terbuka / tidak aktif selama 1 Jam
  useEffect(() => {
    if (!isAuthenticated) return;

    const ONE_HOUR_MS = 60 * 60 * 1000; // 1 Jam

    const checkInactivityTimeout = () => {
      const lastActiveStr = localStorage.getItem('athree_last_active_time');
      const now = Date.now();
      if (!lastActiveStr) {
        localStorage.setItem('athree_last_active_time', String(now));
        return;
      }

      const lastActive = Number(lastActiveStr);
      if (now - lastActive >= ONE_HOUR_MS) {
        console.log('Aplikasi tidak terbuka / tidak aktif >= 1 jam. Menjalankan auto-save dan auto-logout...');
        handleAutoInactivityLogout();
      }
    };

    // Cek langsung saat komponen aktif
    checkInactivityTimeout();

    // Rekam aktivitas pengguna (mouse, klik, ketik, sentuh, scroll) secara throttled per 10 detik
    let lastRecordedActivity = Date.now();
    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastRecordedActivity > 10000) {
        lastRecordedActivity = now;
        localStorage.setItem('athree_last_active_time', String(now));
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Cek secara berkala tiap 15 detik
    const timer = setInterval(checkInactivityTimeout, 15000);

    // Cek saat pengguna membuka kembali tab yang sebelumnya terminimalkan atau tidak terbuka
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityTimeout();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkInactivityTimeout);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', checkInactivityTimeout);
    };
  }, [isAuthenticated]);

  // Handler: User selection
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('dashboard');
    } else if (user.role === 'kasir') {
      setActiveTab('pos');
    } else {
      setActiveTab('orders');
    }
  };

  // Handler: Add customer
  const handleAddCustomer = (newCust: Customer) => {
    setCustomers((prev) => [newCust, ...prev]);
    saveCustomerToFirestore(newCust).catch((err) => console.warn('Sync customer error:', err));
  };

  // Handler: Complete Payment
  const handleCompletePayment = (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}`,
      shiftId: shift?.id,
      createdAt: new Date().toISOString()
    };

    // 1. Deduct Stock for each master product & record Stock Movement
    const newMovements: StockMovement[] = [];
    setProducts((prevProducts) => {
      return prevProducts.map((prod) => {
        const itemSold = newTx.items.find((i) => i.productId === prod.id);
        if (itemSold) {
          const newQty = Math.max(0, prod.stock - itemSold.quantity);
          newMovements.push({
            id: `sm-${Date.now()}-${prod.id}`,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'SALE',
            qty: itemSold.quantity,
            prevStock: prod.stock,
            newStock: newQty,
            date: newTx.date,
            reason: `Penjualan Kasir ${newTx.invoiceNo}`,
            operatorName: currentUser.name,
            referenceNo: newTx.invoiceNo
          });
          const updatedProd = { ...prod, stock: newQty };
          saveProductToFirestore(updatedProd).catch(() => {});
          return updatedProd;
        }
        return prod;
      });
    });

    // 2. Deduct Kaos Polos stock for items with color & size
    setKaosStocks((prevKaos) => {
      const { updatedStocks, movements } = deductKaosStock(
        prevKaos,
        newTx.items,
        newTx.invoiceNo,
        currentUser.name,
        'Penjualan'
      );
      if (movements.length > 0) {
        newMovements.push(...movements);
      }
      if (updatedStocks && updatedStocks.length > 0) {
        saveMultipleKaosStocksToFirestore(updatedStocks).catch(() => {});
      }
      return updatedStocks;
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    // 3. Add to transactions list & Firestore
    setTransactions((prev) => [newTx, ...prev]);
    saveTransactionToFirestore(newTx).catch((err) => console.warn('Sync transaction error:', err));

    // 4. Update shift balances (only actual amount received enters the cash drawer)
    const actualReceived = newTx.amountPaid;
    const isReceivable = Boolean(newTx.remainingAmount && newTx.remainingAmount > 0);

    setShift((prev) => ({
      ...prev,
      cashSales:
        newTx.paymentMethod === 'Tunai'
          ? prev.cashSales + actualReceived
          : prev.cashSales,
      nonCashSales:
        newTx.paymentMethod !== 'Tunai'
          ? prev.nonCashSales + actualReceived
          : prev.nonCashSales,
      totalSales: prev.totalSales + newTx.total,
      expectedCash:
        newTx.paymentMethod === 'Tunai'
          ? prev.expectedCash + actualReceived
          : prev.expectedCash,
      unpaidAmount: prev.unpaidAmount + (newTx.remainingAmount || 0),
      unpaidCount: isReceivable ? prev.unpaidCount + 1 : prev.unpaidCount,
      totalTransactions: prev.totalTransactions + 1
    }));

    // 5. Show success & receipt modal
    setSuccessTx(newTx);
  };

  // Handler: Save as pending order (Antrean produksi)
  const handleSaveAsPendingOrder = (newTxData: Omit<Transaction, 'id'>) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}`,
      shiftId: shift?.id,
      createdAt: new Date().toISOString()
    };

    // Deduct stock if physical inventory
    const newMovements: StockMovement[] = [];
    setProducts((prevProducts) => {
      return prevProducts.map((prod) => {
        const itemSold = newTx.items.find((i) => i.productId === prod.id);
        if (itemSold) {
          const newQty = Math.max(0, prod.stock - itemSold.quantity);
          newMovements.push({
            id: `sm-${Date.now()}-${prod.id}`,
            productId: prod.id,
            productName: prod.name,
            sku: prod.sku,
            type: 'SALE',
            qty: itemSold.quantity,
            prevStock: prod.stock,
            newStock: newQty,
            date: newTx.date,
            reason: `Antrean Produksi ${newTx.invoiceNo} (Jatuh Tempo: ${newTx.dueDate})`,
            operatorName: currentUser.name,
            referenceNo: newTx.invoiceNo
          });
          const updatedProd = { ...prod, stock: newQty };
          saveProductToFirestore(updatedProd).catch(() => {});
          return updatedProd;
        }
        return prod;
      });
    });

    // Deduct Kaos Polos stock
    setKaosStocks((prevKaos) => {
      const { updatedStocks, movements } = deductKaosStock(
        prevKaos,
        newTx.items,
        newTx.invoiceNo,
        currentUser.name,
        'Pesanan Dikerjakan'
      );
      if (movements.length > 0) {
        newMovements.push(...movements);
      }
      if (updatedStocks && updatedStocks.length > 0) {
        saveMultipleKaosStocksToFirestore(updatedStocks).catch(() => {});
      }
      return updatedStocks;
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    setTransactions((prev) => [newTx, ...prev]);
    saveTransactionToFirestore(newTx).catch((err) => console.warn('Sync pending transaction error:', err));
  };

  // Handler: Save Revision of Transaction Invoice (Accessible by Admin and Cashier)
  const handleSaveRevisionInvoice = (updatedTransaction: Transaction, oldTransaction: Transaction) => {
    // 1. Update transactions & Firestore
    setTransactions((prev) =>
      prev.map((t) => (t.id === updatedTransaction.id ? updatedTransaction : t))
    );
    saveTransactionToFirestore(updatedTransaction).catch((err) => console.warn('Sync revise invoice error:', err));

    // 2. Adjust inventory stock based on quantity differences
    const oldQtyMap = new Map<string, number>();
    oldTransaction.items.forEach((it) => {
      oldQtyMap.set(it.productId, (oldQtyMap.get(it.productId) || 0) + it.quantity);
    });

    const newQtyMap = new Map<string, number>();
    updatedTransaction.items.forEach((it) => {
      newQtyMap.set(it.productId, (newQtyMap.get(it.productId) || 0) + it.quantity);
    });

    const newMovements: StockMovement[] = [];

    setProducts((prevProducts) => {
      return prevProducts.map((p) => {
        const oldQ = oldQtyMap.get(p.id) || 0;
        const newQ = newQtyMap.get(p.id) || 0;
        const diff = newQ - oldQ; // positive means more sold (reduce stock), negative means less sold (return to stock)
        if (diff === 0) return p;

        const updatedStock = Math.max(0, p.stock - diff);
        newMovements.push({
          id: `sm-rev-${Date.now()}-${p.id}`,
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          type: diff > 0 ? 'OUT' : 'IN',
          qty: Math.abs(diff),
          prevStock: p.stock,
          newStock: updatedStock,
          date: new Date().toISOString().slice(0, 16).replace('T', ' '),
          reason: `Revisi Faktur ${updatedTransaction.invoiceNo} (${diff > 0 ? '-' : '+'}${Math.abs(diff)} unit)`,
          operatorName: currentUser.name,
          referenceNo: updatedTransaction.invoiceNo
        });

        const updatedProd = { ...p, stock: updatedStock };
        saveProductToFirestore(updatedProd).catch(() => {});
        return updatedProd;
      });
    });

    // 3. Adjust Kaos stock for revision
    setKaosStocks((prevKaos) => {
      const restored = restoreMultipleKaosStock(
        prevKaos,
        oldTransaction.items,
        oldTransaction.invoiceNo,
        currentUser.name,
        'Revisi Faktur (Kembalikan)'
      );
      if (restored.movements.length > 0) {
        newMovements.push(...restored.movements);
      }

      const deducted = deductKaosStock(
        restored.updatedStocks,
        updatedTransaction.items,
        updatedTransaction.invoiceNo,
        currentUser.name,
        'Revisi Faktur (Pengurangan)'
      );
      if (deducted.movements.length > 0) {
        newMovements.push(...deducted.movements);
      }
      if (deducted.updatedStocks && deducted.updatedStocks.length > 0) {
        saveMultipleKaosStocksToFirestore(deducted.updatedStocks).catch(() => {});
      }
      return deducted.updatedStocks;
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
    }

    // If successTx is currently displaying this transaction, refresh it
    if (successTx && successTx.id === updatedTransaction.id) {
      setSuccessTx(updatedTransaction);
    }
  };

  // Handler: Delete Invoice (Accessible ONLY by Admin)
  const handleConfirmDeleteInvoice = (
    transactionId: string,
    restoreStock: boolean,
    deleteReason: string
  ) => {
    if (currentUser.role !== 'admin') {
      alert('Akses Ditolak: Hanya akun Administrator yang memiliki hak akses untuk menghapus faktur/invoice.');
      return;
    }

    const txToDelete = transactions.find((t) => t.id === transactionId);
    if (!txToDelete) return;

    // Restore inventory stock if requested
    if (restoreStock && txToDelete.items.length > 0) {
      const qtyToRestore = new Map<string, number>();
      txToDelete.items.forEach((it) => {
        qtyToRestore.set(it.productId, (qtyToRestore.get(it.productId) || 0) + it.quantity);
      });

      const newMovements: StockMovement[] = [];

      setProducts((prevProducts) => {
        return prevProducts.map((p) => {
          const qty = qtyToRestore.get(p.id);
          if (!qty || qty <= 0) return p;

          const updatedStock = p.stock + qty;
          newMovements.push({
            id: `sm-del-${Date.now()}-${p.id}`,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            type: 'IN',
            qty: qty,
            prevStock: p.stock,
            newStock: updatedStock,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            reason: `Pembatalan/Hapus Faktur ${txToDelete.invoiceNo} (${deleteReason || 'Dihapus Admin'})`,
            operatorName: currentUser.name,
            referenceNo: txToDelete.invoiceNo
          });

          const updatedProd = { ...p, stock: updatedStock };
          saveProductToFirestore(updatedProd).catch(() => {});
          return updatedProd;
        });
      });

      // Restore Kaos stock
      setKaosStocks((prevKaos) => {
        const { updatedStocks, movements } = restoreMultipleKaosStock(
          prevKaos,
          txToDelete.items,
          txToDelete.invoiceNo,
          currentUser.name,
          'Hapus Faktur'
        );
        if (movements.length > 0) {
          newMovements.push(...movements);
        }
        if (updatedStocks && updatedStocks.length > 0) {
          saveMultipleKaosStocksToFirestore(updatedStocks).catch(() => {});
        }
        return updatedStocks;
      });

      if (newMovements.length > 0) {
        setStockMovements((prev) => [...newMovements, ...prev]);
      }
    }

    // Remove from transactions state and delete from Firestore
    const updatedTransactions = transactions.filter((t) => t.id !== transactionId);
    setTransactions(updatedTransactions);
    localStorage.setItem('athree_transactions', JSON.stringify(updatedTransactions));
    localStorage.setItem('athree_transactions_persistent_backup', JSON.stringify(updatedTransactions));
    deleteTransactionFromFirestore(transactionId).catch((err) => console.warn('Sync delete invoice error:', err));

    // Save to central server with explicit deletedTransactionIds so it's not restored by merge
    saveServerDatabase(
      {
        products,
        categories,
        transactions: updatedTransactions,
        cashFlowRecords,
        shiftHistory,
        kaosStocks,
        stockMovements,
        customers,
        users,
        salesList,
        isRealData: true
      },
      {
        deletedTransactionIds: [transactionId],
        savedBy: `${currentUser.name} (Hapus Faktur)`,
        source: 'delete-invoice'
      }
    ).catch(() => {});

    // Reset modals if they were viewing this transaction
    if (successTx && successTx.id === transactionId) {
      setSuccessTx(null);
    }
    if (revisingTx && revisingTx.id === transactionId) {
      setRevisingTx(null);
    }
    if (payingPiutangTx && payingPiutangTx.id === transactionId) {
      setPayingPiutangTx(null);
    }
    setDeletingTx(null);
  };

  // Handler: Catat Pembayaran / Pelunasan Sisa Piutang
  const handleSavePiutangPayment = (
    transactionId: string,
    paymentData: {
      amount: number;
      date: string;
      paymentMethod: PaymentMethod;
      notes: string;
    }
  ) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return;

    const currentRem = Math.max(0, tx.remainingAmount ?? (tx.total - tx.amountPaid));
    const payAmt = Math.min(currentRem, paymentData.amount);
    const newRemaining = Math.max(0, currentRem - payAmt);
    const newAmountPaid = (tx.amountPaid || 0) + payAmt;
    const newStatus = newRemaining <= 0 ? 'LUNAS' : (newAmountPaid > 0 ? 'DP' : 'PIUTANG');

    const newPaymentRecord = {
      id: `pp-${Date.now()}`,
      date: paymentData.date,
      amount: payAmt,
      paymentMethod: paymentData.paymentMethod,
      notes: paymentData.notes || 'Pembayaran sisa piutang',
      recordedBy: currentUser.name,
      createdAt: new Date().toISOString()
    };

    const updatedPayments = [...(tx.piutangPayments || []), newPaymentRecord];
    const auditNote = `[Pelunasan Piutang: ${formatCurrency(payAmt)} via ${paymentData.paymentMethod} pd ${paymentData.date} oleh ${currentUser.name}]`;

    const updatedTx: Transaction = {
      ...tx,
      amountPaid: newAmountPaid,
      remainingAmount: newRemaining,
      paymentStatus: newStatus,
      piutangPaidDate: paymentData.date,
      piutangPayments: updatedPayments,
      notes: tx.notes ? `${tx.notes}\n${auditNote}` : auditNote
    };

    // 1. Update transactions state & Firestore
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? updatedTx : t))
    );
    saveTransactionToFirestore(updatedTx).catch((err) =>
      console.warn('Sync piutang payment error:', err)
    );

    // 2. Update cash drawer in active shift
    if (paymentData.paymentMethod === 'Tunai') {
      setShift((prev) => ({
        ...prev,
        cashSales: prev.cashSales + payAmt,
        expectedCash: prev.expectedCash + payAmt,
        unpaidAmount: Math.max(0, prev.unpaidAmount - payAmt),
        unpaidCount: newRemaining <= 0 ? Math.max(0, prev.unpaidCount - 1) : prev.unpaidCount
      }));
    } else {
      setShift((prev) => ({
        ...prev,
        nonCashSales: prev.nonCashSales + payAmt,
        unpaidAmount: Math.max(0, prev.unpaidAmount - payAmt),
        unpaidCount: newRemaining <= 0 ? Math.max(0, prev.unpaidCount - 1) : prev.unpaidCount
      }));
    }

    // 3. Catat ke Arus Kas
    const newCashFlow: CashFlowRecord = {
      id: `cf-piutang-${Date.now()}`,
      date: paymentData.date.slice(0, 10),
      type: 'INCOME',
      category: 'Pelunasan Piutang',
      description: `Pelunasan Piutang Faktur ${tx.invoiceNo} (${tx.customer.name}) - ${paymentData.paymentMethod} (${paymentData.notes || 'Pelunasan Piutang'})`,
      amount: payAmt,
      recordedBy: currentUser.name,
      createdAt: new Date().toISOString()
    };
    setCashFlowRecords((prev) => [newCashFlow, ...prev]);
    saveCashFlowToFirestore(newCashFlow).catch(() => {});

    // Refresh modal if viewing
    if (successTx && successTx.id === transactionId) {
      setSuccessTx(updatedTx);
    }
    setPayingPiutangTx(null);
  };

  // Handler: Update order status (Selesai, Sedang Dikerjakan, etc.)
  const handleUpdateOrderStatus = (transactionId: string, status: OrderStatus) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId) {
          const updated = { ...t, status };
          saveTransactionToFirestore(updated).catch(() => {});
          return updated;
        }
        return t;
      })
    );
  };

  // Handler: Update due date
  const handleUpdateDueDate = (transactionId: string, newDueDate: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId) {
          const updated = { ...t, dueDate: newDueDate };
          saveTransactionToFirestore(updated).catch(() => {});
          return updated;
        }
        return t;
      })
    );
  };

  // Handler: Update vendor cost & shipping cost (Keuntungan otomatis dihitung ulang)
  const handleUpdateCosts = (transactionId: string, vendorCost: number, shippingCost: number, vendorName?: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === transactionId) {
          const safeVendor = Math.max(0, Number(vendorCost) || 0);
          const safeShipping = Math.max(0, Number(shippingCost) || 0);
          const profit = calculateProfit(t.total, safeVendor, safeShipping);
          const updated: Transaction = {
            ...t,
            vendorCost: safeVendor,
            shippingCost: safeShipping,
            vendorName: vendorName !== undefined ? (vendorName.trim() || undefined) : t.vendorName,
            profit
          };
          saveTransactionToFirestore(updated).catch((err) => console.warn('Sync update costs error:', err));
          return updated;
        }
        return t;
      })
    );
  };

  // Handler: Master Product Add/Update/Delete
  const handleAddProduct = (newProductData: Omit<Product, 'id'>) => {
    const newProd: Product = {
      ...newProductData,
      id: `p-${Date.now()}`
    };
    setProducts((prev) => [newProd, ...prev]);
    saveProductToFirestore(newProd).catch((err) => console.warn('Sync add product error:', err));
    // Log movement
    const movement: StockMovement = {
      id: `sm-${Date.now()}`,
      productId: newProd.id,
      productName: newProd.name,
      sku: newProd.sku,
      type: 'IN',
      qty: newProd.stock,
      prevStock: 0,
      newStock: newProd.stock,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: 'Pencatatan Produk Baru Master',
      operatorName: currentUser.name
    };
    setStockMovements((prev) => [movement, ...prev]);
    saveStockMovementToFirestore(movement).catch(() => {});
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
    saveProductToFirestore(updatedProduct).catch((err) => console.warn('Sync update product error:', err));
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    deleteProductFromFirestore(productId).catch((err) => console.warn('Sync delete product error:', err));
  };

  // Handler: Stock adjustment
  const handleAdjustStock = (
    productId: string,
    type: 'IN' | 'OUT' | 'ADJUST',
    qty: number,
    reason: string
  ) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          const prevStock = p.stock;
          let newStock = prevStock;
          if (type === 'IN') newStock += qty;
          else if (type === 'OUT') newStock = Math.max(0, prevStock - qty);
          else if (type === 'ADJUST') newStock = qty;

          const movement: StockMovement = {
            id: `sm-${Date.now()}`,
            productId: p.id,
            productName: p.name,
            sku: p.sku,
            type,
            qty,
            prevStock,
            newStock,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            reason,
            operatorName: currentUser.name
          };
          setStockMovements((sm) => [movement, ...sm]);
          saveStockMovementToFirestore(movement).catch(() => {});

          const updatedProd = { ...p, stock: newStock };
          saveProductToFirestore(updatedProd).catch(() => {});
          return updatedProd;
        }
        return p;
      })
    );
  };

  // Handler: Kaos stock adjustment
  const handleAdjustKaosStock = (
    color: string,
    size: string,
    type: 'IN' | 'OUT' | 'ADJUST',
    qty: number,
    reason: string
  ) => {
    setKaosStocks((prev) => {
      const idx = prev.findIndex(
        (k) => k.color.toLowerCase() === color.toLowerCase() && k.size.toUpperCase() === size.toUpperCase()
      );
      if (idx === -1) return prev;
      const item = prev[idx];
      const prevStock = item.stock;
      let newStock = prevStock;
      if (type === 'IN') newStock += qty;
      else if (type === 'OUT') newStock = Math.max(0, prevStock - qty);
      else if (type === 'ADJUST') newStock = qty;

      const updatedItem = { ...item, stock: newStock };
      const updated = [...prev];
      updated[idx] = updatedItem;
      saveKaosStockToFirestore(updatedItem).catch(() => {});
      return updated;
    });

    const movement: StockMovement = {
      id: `sm-kaos-${Date.now()}`,
      productId: `kaos_${color.toLowerCase()}_${size.toLowerCase()}`,
      productName: `Kaos Polos ${color} (${size})`,
      sku: `KAOS-${color.toUpperCase()}-${size.toUpperCase()}`,
      type,
      qty,
      prevStock: 0,
      newStock: 0,
      date: new Date().toISOString().slice(0, 16).replace('T', ' '),
      reason: reason || `Penyesuaian Stok Kaos ${color} ${size}`,
      operatorName: currentUser.name
    };
    setStockMovements((sm) => [movement, ...sm]);
  };

  // Handler: Batch Import Products from CSV / Excel
  const handleImportProducts = (
    incomingList: ParsedImportProduct[],
    duplicateStrategy: 'update' | 'skip' | 'new_sku'
  ) => {
    const newMovements: StockMovement[] = [];
    const timestamp = Date.now();
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const colorPalettes = [
      'bg-rose-100 text-rose-700 border-rose-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200'
    ];

    setProducts((prevProducts) => {
      const existingSkuMap = new Map<string, Product>();
      prevProducts.forEach((p) => existingSkuMap.set(p.sku.toLowerCase().trim(), p));

      const updatedList = [...prevProducts];

      incomingList.forEach((item, idx) => {
        if (!item.isValid) return;

        const skuKey = item.sku.toLowerCase().trim();
        const existing = existingSkuMap.get(skuKey);

        const words = item.name.trim().split(' ');
        const initials =
          words.length >= 2
            ? (words[0][0] + words[1][0]).toUpperCase()
            : item.name.trim().substring(0, 2).toUpperCase();

        const badge = colorPalettes[(idx + prevProducts.length) % colorPalettes.length];

        if (existing) {
          if (duplicateStrategy === 'skip') {
            skippedCount++;
            return;
          } else if (duplicateStrategy === 'update') {
            const index = updatedList.findIndex((p) => p.id === existing.id);
            if (index !== -1) {
              const prevStock = existing.stock;
              const newStock = item.stock;

              updatedList[index] = {
                ...existing,
                name: item.name || existing.name,
                category: item.category || existing.category,
                price: item.price > 0 ? item.price : existing.price,
                costPrice: item.costPrice > 0 ? item.costPrice : existing.costPrice,
                stock: newStock,
                minStock: item.minStock > 0 ? item.minStock : existing.minStock,
                unit: item.unit || existing.unit
              };
              updatedCount++;

              if (newStock !== prevStock) {
                newMovements.push({
                  id: `sm-imp-${timestamp}-${idx}`,
                  productId: existing.id,
                  productName: existing.name,
                  sku: existing.sku,
                  type: newStock > prevStock ? 'IN' : 'ADJUST',
                  qty: Math.abs(newStock - prevStock),
                  prevStock,
                  newStock,
                  date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                  reason: 'Update Stok Massal (Impor Excel/CSV)',
                  operatorName: currentUser.name
                });
              }
            }
          } else {
            // new_sku
            const newSku = `${item.sku}-${Math.floor(100 + Math.random() * 900)}`;
            const newProd: Product = {
              id: `p-${timestamp}-${idx}`,
              name: item.name,
              sku: newSku,
              category: item.category,
              price: item.price,
              costPrice: item.costPrice,
              stock: item.stock,
              minStock: item.minStock,
              unit: item.unit,
              colorBadge: badge,
              initials,
              isFavorite: false
            };
            updatedList.push(newProd);
            addedCount++;

            newMovements.push({
              id: `sm-imp-${timestamp}-${idx}`,
              productId: newProd.id,
              productName: newProd.name,
              sku: newProd.sku,
              type: 'IN',
              qty: newProd.stock,
              prevStock: 0,
              newStock: newProd.stock,
              date: new Date().toISOString().slice(0, 16).replace('T', ' '),
              reason: 'Impor Produk Baru (Excel/CSV)',
              operatorName: currentUser.name
            });
          }
        } else {
          // brand new product
          const newProd: Product = {
            id: `p-${timestamp}-${idx}`,
            name: item.name,
            sku: item.sku,
            category: item.category,
            price: item.price,
            costPrice: item.costPrice,
            stock: item.stock,
            minStock: item.minStock,
            unit: item.unit,
            colorBadge: badge,
            initials,
            isFavorite: false
          };
          updatedList.push(newProd);
          existingSkuMap.set(skuKey, newProd);
          addedCount++;

          newMovements.push({
            id: `sm-imp-${timestamp}-${idx}`,
            productId: newProd.id,
            productName: newProd.name,
            sku: newProd.sku,
            type: 'IN',
            qty: newProd.stock,
            prevStock: 0,
            newStock: newProd.stock,
            date: new Date().toISOString().slice(0, 16).replace('T', ' '),
            reason: 'Impor Produk Baru (Excel/CSV)',
            operatorName: currentUser.name
          });
        }
      });

      saveMultipleProductsToFirestore(updatedList).catch((err) => console.warn('Sync imported products error:', err));
      return updatedList;
    });

    if (newMovements.length > 0) {
      setStockMovements((prev) => [...newMovements, ...prev]);
      saveMultipleStockMovementsToFirestore(newMovements).catch(() => {});
    }

    return { addedCount, updatedCount, skippedCount };
  };

  // Barcode scanner simulator
  const handleBarcodePrompt = () => {
    const sku = prompt(
      'Simulasi Scanner Barcode:\nMasukkan atau scan SKU produk (misal: SKU/00006, SKU/00007, SKU/00012):'
    );
    if (sku) {
      const found = products.find(
        (p) => p.sku.toLowerCase() === sku.toLowerCase().trim()
      );
      if (found) {
        setSearchQuery(found.sku);
        setActiveTab('pos');
      } else {
        alert(`Produk dengan SKU "${sku}" tidak ditemukan.`);
      }
    }
  };

  // Counts for sidebar badges
  const pendingOrdersCount = transactions.filter(
    (t) => t.status === 'Sedang Dikerjakan' || t.status === 'Menunggu'
  ).length;

  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const lowKaosStockCount = kaosStocks.filter((k) => k.stock <= k.minStock).length;

  const handleRestoreDataFromDrive = (data: {
    transactions?: Transaction[];
    products?: Product[];
    cashFlowRecords?: CashFlowRecord[];
    kaosStocks?: KaosStockItem[];
    shifts?: CashierShift[];
    customers?: Customer[];
    stockMovements?: StockMovement[];
    users?: User[];
    salesList?: string[];
    categories?: string[];
  }) => {
    const newTx = data.transactions && Array.isArray(data.transactions) ? data.transactions : transactions;
    const newProd = data.products && Array.isArray(data.products) ? data.products : products;
    const newCf = data.cashFlowRecords && Array.isArray(data.cashFlowRecords) ? data.cashFlowRecords : cashFlowRecords;
    const newKaos = data.kaosStocks && Array.isArray(data.kaosStocks) ? data.kaosStocks : kaosStocks;
    const newShifts = data.shifts && Array.isArray(data.shifts) ? data.shifts : shiftHistory;
    const newCust = data.customers && Array.isArray(data.customers) ? data.customers : customers;
    const newSm = data.stockMovements && Array.isArray(data.stockMovements) ? data.stockMovements : stockMovements;
    const newUsers = data.users && Array.isArray(data.users) ? data.users : users;
    const newSales = data.salesList && Array.isArray(data.salesList) ? data.salesList : salesList;
    const newCats = data.categories && Array.isArray(data.categories) ? data.categories : categories;

    if (data.transactions) {
      setTransactions(newTx);
      localStorage.setItem('athree_transactions', JSON.stringify(newTx));
      localStorage.setItem('athree_transactions_persistent_backup', JSON.stringify(newTx));
    }
    if (data.products) {
      setProducts(newProd);
      localStorage.setItem('athree_products', JSON.stringify(newProd));
    }
    if (data.cashFlowRecords) {
      setCashFlowRecords(newCf);
      localStorage.setItem('athree_cash_flow', JSON.stringify(newCf));
    }
    if (data.kaosStocks) {
      setKaosStocks(newKaos);
      localStorage.setItem('athree_kaos_stocks', JSON.stringify(newKaos));
    }
    if (data.shifts) {
      setShiftHistory(newShifts);
      localStorage.setItem('athree_shift_history', JSON.stringify(newShifts));
    }
    if (data.customers) {
      setCustomers(newCust);
      localStorage.setItem('athree_customers', JSON.stringify(newCust));
    }
    if (data.stockMovements) {
      setStockMovements(newSm);
      localStorage.setItem('athree_stock_movements', JSON.stringify(newSm));
    }
    if (data.users) {
      setUsers(newUsers);
      localStorage.setItem('athree_users', JSON.stringify(newUsers));
    }
    if (data.salesList) {
      setSalesList(newSales);
      localStorage.setItem('athree_sales_list', JSON.stringify(newSales));
    }
    if (data.categories) {
      setCategories(newCats);
      localStorage.setItem('athree_categories', JSON.stringify(newCats));
    }

    // Push restored state to the single integrated Cloud SQL / Server database
    saveServerDatabase({
      products: newProd,
      categories: newCats,
      transactions: newTx,
      cashFlowRecords: newCf,
      shiftHistory: newShifts,
      kaosStocks: newKaos,
      stockMovements: newSm,
      customers: newCust,
      users: newUsers,
      salesList: newSales,
      isRealData: true
    }, {
      savedBy: `${currentUser.name} (Pulihkan dari Google Drive)`,
      source: 'google-drive-restore'
    }).catch((err) => console.warn('Sync restored data to server error:', err));
  };

  // 0. INITIAL SCREEN: LOGIN SCREEN (Matches uploaded fluid wave image)
  if (!isAuthenticated) {
    return (
      <LoginScreen
        users={users}
        onLogin={handleLogin}
        sessionTimeoutNotice={sessionTimeoutNotice}
        onClearTimeoutNotice={clearSessionTimeoutNotice}
      />
    );
  }

  // 1. ADMIN PORTAL VIEW (Matches screenshot when logged in as Admin/Pemilik)
  if (currentUser.role === 'admin' && activeTab === 'dashboard') {
    return (
      <div className="flex h-screen w-screen bg-slate-900 overflow-hidden font-sans text-slate-800 antialiased select-none">
        <AdminDashboard
          currentUser={currentUser}
          users={users}
          onUpdateUser={handleUpdateUser}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
          onNavigate={(tab, subTab) => {
            setActiveTab(tab);
            if (subTab) setReportsSubTab(subTab);
          }}
          onSwitchUser={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          transactions={transactions}
          shift={shift}
          cashFlowRecords={cashFlowRecords}
          onAddCashFlow={handleAddCashFlow}
          onUpdateCashFlow={handleUpdateCashFlow}
          onDeleteCashFlow={handleDeleteCashFlow}
          onViewReceipt={(tx) => setSuccessTx(tx)}
          onUpdateShift={handleUpdateShift}
          onOpenShiftModal={handleOpenShiftModal}
          onReviseInvoice={(tx) => setRevisingTx(tx)}
          onDeleteInvoice={(tx) => setDeletingTx(tx)}
          salesList={salesList}
          onAddSales={handleAddSales}
          onDeleteSales={handleDeleteSales}
          allowCashierDrive={allowCashierDrive}
          onToggleAllowCashierDrive={handleToggleAllowCashierDrive}
        />

        {/* Modals accessible from Admin Portal */}
        <UserLoginModal
          users={users}
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogout={handleLogout}
          onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        />

        <ShiftModal
          shift={shift}
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          onUpdateShift={handleUpdateShift}
          activeCashierName={currentUser.name}
          currentUser={currentUser}
          transactions={transactions}
          cashFlowRecords={cashFlowRecords}
          shiftHistory={shiftHistory}
          onSaveToHistory={handleSaveShiftToHistory}
          initialViewMode={shiftModalMode}
          onLogout={handleLogout}
          users={users}
          onUpdateUser={handleUpdateUser}
          onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        />

        <PaymentSuccessModal
          transaction={successTx}
          onClose={() => setSuccessTx(null)}
          onRevise={(tx) => setRevisingTx(tx)}
          onDelete={(tx) => setDeletingTx(tx)}
          isAdmin={currentUser.role === 'admin'}
          currentUser={currentUser}
          userRole={currentUser.role}
        />

        <ReviseInvoiceModal
          transaction={revisingTx}
          isOpen={!!revisingTx}
          onClose={() => setRevisingTx(null)}
          onSaveRevision={handleSaveRevisionInvoice}
          availableProducts={products}
          currentUserRole={currentUser.role}
          currentUserName={currentUser.name}
          onDeleteInvoice={(tx) => setDeletingTx(tx)}
          salesList={salesList}
          onAddSales={handleAddSales}
          onDeleteSales={handleDeleteSales}
        />

        <DeleteInvoiceModal
          transaction={deletingTx}
          isOpen={!!deletingTx}
          onClose={() => setDeletingTx(null)}
          onConfirmDelete={handleConfirmDeleteInvoice}
          currentUserRole={currentUser.role}
        />

        <PayPiutangModal
          isOpen={!!payingPiutangTx}
          transaction={payingPiutangTx}
          onClose={() => setPayingPiutangTx(null)}
          onSavePayment={handleSavePiutangPayment}
          currentUserName={currentUser.name}
        />

        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          users={users}
          currentUser={currentUser}
          onUpdateUser={handleUpdateUser}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
        />

        {/* Logout Cloud Database Saving Overlay for Admin Portal */}
        {isLoggingOut && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg transition-all duration-300 ${
                logoutSuccess ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105' : 'bg-emerald-50 text-[#00871f] shadow-slate-100'
              }`}>
                {logoutSuccess ? (
                  <CheckCircle2 className="w-9 h-9" />
                ) : (
                  <CloudUpload className="w-9 h-9 animate-pulse text-[#00871f]" />
                )}
              </div>
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">
                  {logoutSuccess ? 'Database Berhasil Disimpan Aman!' : 'Menyimpan Database ke Cloud'}
                </h3>
                <p className="text-xs text-slate-500">
                  Menyimpan data penjualan, kas, dan shift ke Cloud Firestore & Server sebelum keluar aplikasi.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-center gap-2.5">
                {!logoutSuccess && (
                  <div className="w-4 h-4 border-2 border-[#00871f] border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <span className="text-xs font-semibold text-emerald-900">{logoutStep}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. STANDARD / OPERATIONAL VIEW (POS, Orders, Reports, Stock)
  return (
    <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans text-slate-800 antialiased select-none">
      {/* 1. Left Icon Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onSwitchUser={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        pendingOrdersCount={pendingOrdersCount}
        lowStockCount={lowStockCount}
        lowKaosStockCount={lowKaosStockCount}
        allowCashierDrive={allowCashierDrive}
        isCashierOpen={shift?.isOpen ?? false}
      />

      {/* 2. Main Work Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentUser={currentUser}
          onOpenShiftModal={handleOpenShiftModal}
          onSwitchUser={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          onRefreshAndClearCache={handleRefreshAndClearCache}
          shift={shift}
          onScanBarcodePrompt={handleBarcodePrompt}
          onGoToAdminDashboard={() => setActiveTab('dashboard')}
          onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
          onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
          isFirebaseConnected={isFirebaseConnected}
          firebaseUser={firebaseUser}
        />

        {/* Dynamic Views */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'pos' && (
            <PosView
              products={products}
              categories={categories}
              customers={customers}
              onAddCustomer={handleAddCustomer}
              onOpenCustomProductModal={() => setIsCustomProductModalOpen(true)}
              onCompletePayment={handleCompletePayment}
              onSaveAsPendingOrder={handleSaveAsPendingOrder}
              cashierName={currentUser.name}
              cashierId={currentUser.id}
              searchQuery={searchQuery}
              recentTransactions={transactions}
              onReviseInvoice={(tx) => setRevisingTx(tx)}
              salesList={salesList}
              onAddSales={handleAddSales}
              onDeleteSales={handleDeleteSales}
              isAdmin={currentUser.role === 'admin'}
              currentUser={currentUser}
              userRole={currentUser.role}
              shift={shift}
              onOpenShiftModal={handleOpenShiftModal}
            />
          )}

          {activeTab === 'orders' && (
            <ProductionOrdersView
              transactions={transactions}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateDueDate={handleUpdateDueDate}
              onUpdateCosts={handleUpdateCosts}
              onViewReceipt={(tx) => setSuccessTx(tx)}
              onReviseInvoice={(tx) => setRevisingTx(tx)}
              onDeleteInvoice={(tx) => setDeletingTx(tx)}
              onPayPiutang={(tx) => setPayingPiutangTx(tx)}
              isAdmin={currentUser.role === 'admin'}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'reports' && (
            <DailyReportsView
              transactions={transactions}
              currentUser={currentUser}
              onViewReceipt={(tx) => setSuccessTx(tx)}
              onReviseInvoice={(tx) => setRevisingTx(tx)}
              onDeleteInvoice={(tx) => setDeletingTx(tx)}
              onPayPiutang={(tx) => setPayingPiutangTx(tx)}
              shift={shift}
              onUpdateShift={handleUpdateShift}
              cashFlowRecords={cashFlowRecords}
              onAddCashFlow={handleAddCashFlow}
              onUpdateCashFlow={handleUpdateCashFlow}
              onDeleteCashFlow={handleDeleteCashFlow}
              salesList={salesList}
              initialSubTab={reportsSubTab}
            />
          )}

          {activeTab === 'stock' && (
            <StockManagementView
              products={products}
              categories={categories}
              stockMovements={stockMovements}
              currentUser={currentUser}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
              onImportProducts={handleImportProducts}
              onOpenKaosStock={() => setActiveTab('kaos-stock')}
            />
          )}

          {activeTab === 'kaos-stock' && (
            <KaosStockManagementView
              kaosStocks={kaosStocks}
              stockMovements={stockMovements}
              currentUser={currentUser}
              onUpdateKaosStocks={(newStocks, movements) => {
                setKaosStocks(newStocks);
                localStorage.setItem('athree_kaos_stocks', JSON.stringify(newStocks));
                saveMultipleKaosStocksToFirestore(newStocks).catch((err) => console.warn('Sync kaos error:', err));
                if (movements && movements.length > 0) {
                  setStockMovements((prev) => {
                    const updated = [...movements, ...prev];
                    localStorage.setItem('athree_stock_movements', JSON.stringify(updated));
                    return updated;
                  });
                }
              }}
              onOpenRegularStock={() => setActiveTab('stock')}
            />
          )}

          {activeTab === 'drive' && (
            <GoogleDriveView
              transactions={transactions}
              products={products}
              cashFlowRecords={cashFlowRecords}
              shifts={shiftHistory}
              kaosStocks={kaosStocks}
              stockMovements={stockMovements}
              customers={customers}
              users={users}
              salesList={salesList}
              categories={categories}
              currentStartingCash={shift?.startingCash}
              currentUser={currentUser}
              allowCashierDrive={allowCashierDrive}
              onSwitchToAdmin={() => setIsLoginModalOpen(true)}
              onRestoreData={handleRestoreDataFromDrive}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <UserLoginModal
        users={users}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
      />

      <ShiftModal
        shift={shift}
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        onUpdateShift={handleUpdateShift}
        activeCashierName={currentUser.name}
        currentUser={currentUser}
        transactions={transactions}
        cashFlowRecords={cashFlowRecords}
        shiftHistory={shiftHistory}
        onSaveToHistory={handleSaveShiftToHistory}
        initialViewMode={shiftModalMode}
        onLogout={handleLogout}
        users={users}
        onUpdateUser={handleUpdateUser}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
      />

      <CustomProductModal
        isOpen={isCustomProductModalOpen}
        onClose={() => setIsCustomProductModalOpen(false)}
        onAddCustomItem={(item: OrderItem) => {
          // Add custom product into catalog and notify
          const customProd: Product = {
            id: item.productId,
            name: item.name,
            sku: item.sku,
            category: 'CUSTOM MERCHANDISE',
            price: item.price,
            costPrice: item.costPrice,
            stock: 999,
            minStock: 1,
            unit: 'Pcs',
            colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            initials: item.name.substring(0, 2),
            isFavorite: false
          };
          setProducts((prev) => [customProd, ...prev]);
          saveProductToFirestore(customProd).catch(() => {});
        }}
      />

      <PaymentSuccessModal
        transaction={successTx}
        onClose={() => setSuccessTx(null)}
        onRevise={(tx) => setRevisingTx(tx)}
        onDelete={(tx) => setDeletingTx(tx)}
        isAdmin={currentUser.role === 'admin'}
        currentUser={currentUser}
        userRole={currentUser.role}
      />

      <ReviseInvoiceModal
        transaction={revisingTx}
        isOpen={!!revisingTx}
        onClose={() => setRevisingTx(null)}
        onSaveRevision={handleSaveRevisionInvoice}
        availableProducts={products}
        currentUserRole={currentUser.role}
        currentUserName={currentUser.name}
        onDeleteInvoice={(tx) => setDeletingTx(tx)}
        salesList={salesList}
        onAddSales={handleAddSales}
        onDeleteSales={handleDeleteSales}
      />

      <DeleteInvoiceModal
        transaction={deletingTx}
        isOpen={!!deletingTx}
        onClose={() => setDeletingTx(null)}
        onConfirmDelete={handleConfirmDeleteInvoice}
        currentUserRole={currentUser.role}
      />

      <PayPiutangModal
        isOpen={!!payingPiutangTx}
        transaction={payingPiutangTx}
        onClose={() => setPayingPiutangTx(null)}
        onSavePayment={handleSavePiutangPayment}
        currentUserName={currentUser.name}
      />

      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onUpdateUser={handleUpdateUser}
        onAddUser={handleAddUser}
        onDeleteUser={handleDeleteUser}
      />

      <CloudSqlSyncModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        products={products}
        transactions={transactions}
        cashFlowRecords={cashFlowRecords}
        shifts={shiftHistory}
        currentShift={shift}
        kaosStocks={kaosStocks}
        customers={customers}
        users={users}
        stockMovements={stockMovements}
        salesList={salesList}
        onManualSyncSuccess={() => {}}
        onApplyDatabasePayload={applyFullDatabasePayload}
      />

      {/* Logout Cloud Database Saving Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-100 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg transition-all duration-300 ${
              logoutSuccess ? 'bg-emerald-600 text-white shadow-emerald-200 scale-105' : 'bg-emerald-50 text-[#00871f] shadow-slate-100'
            }`}>
              {logoutSuccess ? (
                <CheckCircle2 className="w-9 h-9" />
              ) : (
                <CloudUpload className="w-9 h-9 animate-pulse text-[#00871f]" />
              )}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                {logoutSuccess ? 'Database Berhasil Disimpan Aman!' : 'Menyimpan Database ke Cloud SQL'}
              </h3>
              <p className="text-xs text-slate-500">
                Menyimpan seluruh data penjualan, produk, kas, dan shift ke Cloud SQL Database secara Real-Time sebelum keluar aplikasi.
              </p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-center gap-2.5">
              {!logoutSuccess && (
                <div className="w-4 h-4 border-2 border-[#00871f] border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <span className="text-xs font-semibold text-emerald-900">{logoutStep}</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-2.5 text-[11px] text-slate-500 border border-slate-100 flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
              <span>Snapshot database tersimpan selama <strong>14 Hari</strong> agar database tidak menumpuk.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
