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
  KaosStockItem
} from './types';
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
import { ParsedImportProduct } from './components/ImportProductsModal';
import { UserManagementModal } from './components/UserManagementModal';
import { GoogleDriveView } from './components/GoogleDriveView';
import { KaosStockManagementView } from './components/KaosStockManagementView';
import { FirebaseSyncModal } from './components/FirebaseSyncModal';
import {
  subscribeToAuth,
  testConnection,
  subscribeToProducts,
  subscribeToTransactions,
  subscribeToKaosStocks,
  subscribeToCashFlow,
  subscribeToCustomers,
  subscribeToShifts,
  saveProductToFirestore,
  deleteProductFromFirestore,
  saveMultipleProductsToFirestore,
  saveTransactionToFirestore,
  deleteTransactionFromFirestore,
  saveCashFlowToFirestore,
  saveShiftToFirestore,
  saveKaosStockToFirestore,
  saveMultipleKaosStocksToFirestore,
  saveCustomerToFirestore,
  subscribeToUsers,
  saveUserToFirestore,
  deleteUserFromFirestore,
  fetchAllDataFromFirestore,
  syncAllLocalDataToFirestore
} from './services/firebase';
import {
  fetchServerDatabase,
  saveServerDatabase,
  subscribeToServerEvents,
  isRealUserData,
  AppDatabasePayload
} from './services/serverSync';
import { User as FirebaseUser } from 'firebase/auth';

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
  
  // Authentication state (Default to false so user sees login screen as requested)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('athree_is_authenticated') === 'true';
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
    const saved = localStorage.getItem('athree_transactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (isRealUserData(parsed)) {
          return parsed;
        }
      } catch {}
    }
    return INITIAL_TRANSACTIONS;
  });

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
    const saved = localStorage.getItem('athree_shift');
    return saved ? JSON.parse(saved) : INITIAL_SHIFT;
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
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'cf-1',
            type: 'INCOME',
            category: 'Jasa Desain Tambahan',
            amount: 150000,
            description: 'Jasa redesign logo jersey futsal',
            date: '2026-09-17 10:15',
            recordedBy: 'ATHREE(Owner)'
          },
          {
            id: 'cf-2',
            type: 'EXPENSE',
            category: 'Bahan Baku & Tinta',
            amount: 85000,
            description: 'Beli lakban packing & cutter',
            date: '2026-09-17 11:30',
            recordedBy: 'ATHREE(Owner)'
          }
        ];
  });

  // Navigation and UI states
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    return currentUser.role === 'admin' ? 'dashboard' : 'pos';
  });
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
      kaosStocks,
      stockMovements,
      customers,
      users,
      salesList
    };
  }, [products, categories, transactions, cashFlowRecords, shiftHistory, kaosStocks, stockMovements, customers, users, salesList]);

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
        setTransactions(payload.transactions);
        localStorage.setItem('athree_transactions', JSON.stringify(payload.transactions));
      }
      if (payload.cashFlowRecords && Array.isArray(payload.cashFlowRecords)) {
        setCashFlowRecords(payload.cashFlowRecords);
        localStorage.setItem('athree_cash_flow', JSON.stringify(payload.cashFlowRecords));
      }
      if (payload.shiftHistory && Array.isArray(payload.shiftHistory)) {
        setShiftHistory(payload.shiftHistory);
        localStorage.setItem('athree_shift_history', JSON.stringify(payload.shiftHistory));
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

  const syncCurrentStateToServer = () => {
    const currentState = latestStateRef.current;
    saveServerDatabase({
      products: currentState.products,
      categories: currentState.categories,
      transactions: currentState.transactions,
      cashFlowRecords: currentState.cashFlowRecords,
      shiftHistory: currentState.shiftHistory,
      kaosStocks: currentState.kaosStocks,
      stockMovements: currentState.stockMovements,
      customers: currentState.customers,
      users: currentState.users,
      salesList: currentState.salesList,
      isRealData: isRealUserData(currentState.transactions)
    }).catch((err) => console.warn('Sync to central server error:', err));
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
              syncCurrentStateToServer();
            }
          } else {
            if (localHasRealData) {
              console.log('Central Server: Seeding master data from current browser to server...');
              syncCurrentStateToServer();
            } else if (serverRes.data.transactions && serverRes.data.transactions.length > 0) {
              applyFullDatabasePayload(serverRes.data);
            }
          }
        } else {
          // Server has no data stored yet, initialize server with current browser data
          console.log('Central Server: Initializing master data from current browser to server...');
          syncCurrentStateToServer();
        }
      } catch (err) {
        console.warn('Central server sync init error:', err);
      }
    };

    checkAndSyncCentralServer();

    const unsubServer = subscribeToServerEvents((remoteData) => {
      if (!isSubscribed) return;
      console.log('Central Server: Received real-time live update from another browser');
      applyFullDatabasePayload(remoteData);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncCentralServer();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkAndSyncCentralServer);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('athree_cross_tab_sync');
      bc.onmessage = (event) => {
        if (!isSubscribed) return;
        if (event.data && event.data.payload) {
          applyFullDatabasePayload(event.data.payload);
        }
      };
    } catch {}

    // 1. Initial Connection & Seed Check
    testConnection().then(async (connected) => {
      if (!isSubscribed) return;
      setIsFirebaseConnected(connected);

      if (connected) {
        try {
          const cloudData = await fetchAllDataFromFirestore();
          if (!isSubscribed) return;

          const hasCloudData = cloudData.products.length > 0 || cloudData.transactions.length > 0;
          if (hasCloudData) {
            // Cloud has data -> synchronize to current browser
            if (cloudData.products.length > 0) {
              setProducts(cloudData.products);
              localStorage.setItem('athree_products', JSON.stringify(cloudData.products));
            }
            if (cloudData.transactions.length > 0) {
              setTransactions(cloudData.transactions);
              localStorage.setItem('athree_transactions', JSON.stringify(cloudData.transactions));
            }
            if (cloudData.cashFlowRecords.length > 0) {
              setCashFlowRecords(cloudData.cashFlowRecords);
              localStorage.setItem('athree_cash_flow', JSON.stringify(cloudData.cashFlowRecords));
            }
            if (cloudData.shifts.length > 0) {
              setShiftHistory(cloudData.shifts);
              localStorage.setItem('athree_shift_history', JSON.stringify(cloudData.shifts));
            }
            if (cloudData.kaosStocks.length > 0) {
              setKaosStocks(cloudData.kaosStocks);
              localStorage.setItem('athree_kaos_stocks', JSON.stringify(cloudData.kaosStocks));
            }
            if (cloudData.customers.length > 0) {
              setCustomers(cloudData.customers);
              localStorage.setItem('athree_customers', JSON.stringify(cloudData.customers));
            }
            if (cloudData.users && cloudData.users.length > 0) {
              setUsers(cloudData.users);
              localStorage.setItem('athree_users', JSON.stringify(cloudData.users));
            }
          } else {
            // First time ever on cloud -> upload current local master data to cloud so other browsers can immediately receive it
            syncAllLocalDataToFirestore({
              products,
              transactions,
              cashFlowRecords,
              shifts: shiftHistory,
              kaosStocks,
              customers,
              users
            }).catch((err) => console.warn('Cloud auto-seed error:', err));
          }
        } catch (err) {
          console.warn('Initial cloud synchronization fetch:', err);
        }
      }
    });

    // 2. Real-time Listeners across all browser tabs, windows, and devices
    const unsubProducts = subscribeToProducts((remoteProducts) => {
      if (remoteProducts && remoteProducts.length > 0) {
        setProducts(remoteProducts);
        localStorage.setItem('athree_products', JSON.stringify(remoteProducts));
      }
    });

    const unsubTransactions = subscribeToTransactions((remoteTransactions) => {
      if (remoteTransactions && remoteTransactions.length > 0) {
        setTransactions(remoteTransactions);
        localStorage.setItem('athree_transactions', JSON.stringify(remoteTransactions));
      }
    });

    const unsubKaos = subscribeToKaosStocks((remoteKaos) => {
      if (remoteKaos && remoteKaos.length > 0) {
        setKaosStocks(remoteKaos);
        localStorage.setItem('athree_kaos_stocks', JSON.stringify(remoteKaos));
      }
    });

    const unsubCashFlow = subscribeToCashFlow((remoteCashFlow) => {
      if (remoteCashFlow && remoteCashFlow.length > 0) {
        setCashFlowRecords(remoteCashFlow);
        localStorage.setItem('athree_cash_flow', JSON.stringify(remoteCashFlow));
      }
    });

    const unsubCustomers = subscribeToCustomers((remoteCustomers) => {
      if (remoteCustomers && remoteCustomers.length > 0) {
        setCustomers(remoteCustomers);
        localStorage.setItem('athree_customers', JSON.stringify(remoteCustomers));
      }
    });

    const unsubShifts = subscribeToShifts((remoteShifts) => {
      if (remoteShifts && remoteShifts.length > 0) {
        setShiftHistory(remoteShifts);
        localStorage.setItem('athree_shift_history', JSON.stringify(remoteShifts));
      }
    });

    const unsubUsers = subscribeToUsers((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        setUsers(remoteUsers);
        localStorage.setItem('athree_users', JSON.stringify(remoteUsers));
      }
    });

    const unsubAuth = subscribeToAuth((user) => {
      if (isSubscribed) setFirebaseUser(user);
    });

    return () => {
      isSubscribed = false;
      unsubServer();
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkAndSyncCentralServer);
      if (bc) bc.close();
      unsubProducts();
      unsubTransactions();
      unsubKaos();
      unsubCashFlow();
      unsubCustomers();
      unsubShifts();
      unsubUsers();
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
  }, [products, categories, transactions, cashFlowRecords, shiftHistory, kaosStocks, stockMovements, customers, users, salesList]);

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
      setCashFlowRecords(cloudData.cashFlowRecords);
      localStorage.setItem('athree_cash_flow', JSON.stringify(cloudData.cashFlowRecords));
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

  const handleSaveShiftToHistory = (closedShift: CashierShift) => {
    setShiftHistory((prev) => [closedShift, ...prev]);
    saveShiftToFirestore(closedShift).catch((err) => console.warn('Sync shift error:', err));
  };

  useEffect(() => {
    localStorage.setItem('athree_cash_flow', JSON.stringify(cashFlowRecords));
  }, [cashFlowRecords]);

  // Handler: Add cash flow (income / expense)
  const handleAddCashFlow = (newRecord: Omit<CashFlowRecord, 'id'>) => {
    const rec: CashFlowRecord = {
      ...newRecord,
      id: `cf-${Date.now()}`
    };
    setCashFlowRecords((prev) => [rec, ...prev]);
    saveCashFlowToFirestore(rec).catch((err) => console.warn('Sync cashflow error:', err));
  };

  // Handler: Full Login (from LoginScreen)
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    localStorage.setItem('athree_is_authenticated', 'true');
    localStorage.setItem('athree_current_user', JSON.stringify(user));
    if (user.role === 'admin') {
      setActiveTab('dashboard');
    } else if (user.role === 'kasir') {
      setActiveTab('pos');
    } else {
      setActiveTab('orders');
    }
  };

  // Handler: Logout (return to LoginScreen)
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.setItem('athree_is_authenticated', 'false');
    setIsLoginModalOpen(false);
    setIsShiftModalOpen(false);
    setIsCustomProductModalOpen(false);
  };

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
      id: `tx-${Date.now()}`
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
      id: `tx-${Date.now()}`
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
    setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    deleteTransactionFromFirestore(transactionId).catch((err) => console.warn('Sync delete invoice error:', err));

    // Reset modals if they were viewing this transaction
    if (successTx && successTx.id === transactionId) {
      setSuccessTx(null);
    }
    if (revisingTx && revisingTx.id === transactionId) {
      setRevisingTx(null);
    }
    setDeletingTx(null);
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
  }) => {
    if (data.transactions && Array.isArray(data.transactions)) {
      setTransactions(data.transactions);
      localStorage.setItem('athree_transactions', JSON.stringify(data.transactions));
    }
    if (data.products && Array.isArray(data.products)) {
      setProducts(data.products);
      localStorage.setItem('athree_products', JSON.stringify(data.products));
    }
    if (data.cashFlowRecords && Array.isArray(data.cashFlowRecords)) {
      setCashFlowRecords(data.cashFlowRecords);
      localStorage.setItem('athree_cash_flow', JSON.stringify(data.cashFlowRecords));
    }
    if (data.kaosStocks && Array.isArray(data.kaosStocks)) {
      setKaosStocks(data.kaosStocks);
      localStorage.setItem('athree_kaos_stocks', JSON.stringify(data.kaosStocks));
    }
  };

  // 0. INITIAL SCREEN: LOGIN SCREEN (Matches uploaded fluid wave image)
  if (!isAuthenticated) {
    return <LoginScreen users={users} onLogin={handleLogin} />;
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
          onNavigate={(tab) => setActiveTab(tab)}
          onSwitchUser={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
          transactions={transactions}
          shift={shift}
          cashFlowRecords={cashFlowRecords}
          onAddCashFlow={handleAddCashFlow}
          onViewReceipt={(tx) => setSuccessTx(tx)}
          onUpdateShift={(s) => setShift(s)}
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
          onUpdateShift={(s) => setShift(s)}
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

        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          users={users}
          currentUser={currentUser}
          onUpdateUser={handleUpdateUser}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
        />
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
              shift={shift}
              onOpenShiftModal={handleOpenShiftModal}
            />
          )}

          {activeTab === 'orders' && (
            <ProductionOrdersView
              transactions={transactions}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onUpdateDueDate={handleUpdateDueDate}
              onViewReceipt={(tx) => setSuccessTx(tx)}
              onReviseInvoice={(tx) => setRevisingTx(tx)}
              onDeleteInvoice={(tx) => setDeletingTx(tx)}
              isAdmin={currentUser.role === 'admin'}
            />
          )}

          {activeTab === 'reports' && (
            <DailyReportsView
              transactions={transactions}
              currentUser={currentUser}
              onViewReceipt={(tx) => setSuccessTx(tx)}
              onReviseInvoice={(tx) => setRevisingTx(tx)}
              onDeleteInvoice={(tx) => setDeletingTx(tx)}
              shift={shift}
              onUpdateShift={(s) => setShift(s)}
              cashFlowRecords={cashFlowRecords}
              onAddCashFlow={handleAddCashFlow}
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
        onUpdateShift={(s) => setShift(s)}
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

      <UserManagementModal
        isOpen={isUserManagementModalOpen}
        onClose={() => setIsUserManagementModalOpen(false)}
        users={users}
        currentUser={currentUser}
        onUpdateUser={handleUpdateUser}
        onAddUser={handleAddUser}
        onDeleteUser={handleDeleteUser}
      />

      <FirebaseSyncModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        firebaseUser={firebaseUser}
        isConnected={isFirebaseConnected}
        isSyncing={isSyncing}
        products={products}
        transactions={transactions}
        cashFlowRecords={cashFlowRecords}
        shifts={shiftHistory}
        kaosStocks={kaosStocks}
        customers={customers}
        onManualSyncSuccess={() => {}}
        onApplyCloudData={handleApplyCloudData}
      />
    </div>
  );
}
