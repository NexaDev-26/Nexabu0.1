import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { UserRole, User, Product, StaffPermissions, PaymentConfig } from './types';
import { Loader2 } from 'lucide-react';

// Critical components - loaded immediately (auth, landing, small components)
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { ProfileSettings } from './components/ProfileSettings';
import { CustomerProfileSettings } from './components/CustomerProfileSettings';
import { ManageProfile } from './components/ManageProfile';
import { ProfileDropdown } from './components/ProfileDropdown';

// Lazy load heavy components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const CustomerDashboard = lazy(() => import('./components/CustomerDashboard').then(m => ({ default: m.CustomerDashboard })));
const DailySalesReport = lazy(() => import('./components/DailySalesReport').then(m => ({ default: m.DailySalesReport })));
const SmartBot = lazy(() => import('./components/SmartBot').then(m => ({ default: m.SmartBot })));
const Inventory = lazy(() => import('./components/Inventory').then(m => ({ default: m.Inventory })));
const Orders = lazy(() => import('./components/Orders').then(m => ({ default: m.Orders })));
const Storefront = lazy(() => import('./components/Storefront').then(m => ({ default: m.Storefront })));
const Prescriptions = lazy(() => import('./components/Prescriptions').then(m => ({ default: m.Prescriptions })));
const AdminUsers = lazy(() => import('./components/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminPackages = lazy(() => import('./components/AdminPackages').then(m => ({ default: m.AdminPackages })));
const Subscription = lazy(() => import('./components/Subscription').then(m => ({ default: m.Subscription })));
const SubscriptionPaymentVerification = lazy(() => import('./components/SubscriptionPaymentVerification').then(m => ({ default: m.SubscriptionPaymentVerification })));
const OrderManagement = lazy(() => import('./components/OrderManagement').then(m => ({ default: m.OrderManagement })));
const Delivery = lazy(() => import('./components/Delivery').then(m => ({ default: m.Delivery })));
const StaffManagement = lazy(() => import('./components/StaffManagement').then(m => ({ default: m.StaffManagement })));
const SalesRepDashboard = lazy(() => import('./components/SalesRepDashboard').then(m => ({ default: m.SalesRepDashboard })));
const Wallet = lazy(() => import('./components/Wallet').then(m => ({ default: m.Wallet })));
const Marketing = lazy(() => import('./components/Marketing').then(m => ({ default: m.Marketing })));
const Procurement = lazy(() => import('./components/Procurement').then(m => ({ default: m.Procurement })));
const Customers = lazy(() => import('./components/Customers').then(m => ({ default: m.Customers })));
const Expenses = lazy(() => import('./components/Expenses').then(m => ({ default: m.Expenses })));
const Invoices = lazy(() => import('./components/Invoices').then(m => ({ default: m.Invoices })));
const Bills = lazy(() => import('./components/Bills').then(m => ({ default: m.Bills })));
const ShopBuilder = lazy(() => import('./components/ShopBuilder').then(m => ({ default: m.ShopBuilder })));
const WarehouseTransfers = lazy(() => import('./components/WarehouseTransfers').then(m => ({ default: m.WarehouseTransfers })));

// Loading fallback component
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      <p className="text-sm text-neutral-500">Loading...</p>
    </div>
  </div>
);
import { useAppContext } from './hooks/useAppContext';
import { 
  Menu, ShoppingCart, Bell, X, ChevronDown, Moon, Sun
} from 'lucide-react';
import { auth, db, isFirebaseEnabled } from './firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, where, Unsubscribe, DocumentData, Query, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { initOfflineDB } from './services/offlineService';
import { setupAutoSync } from './services/syncService';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SubscriptionStatusBanner } from './components/SubscriptionStatusBanner';
import { EnhancedSidebar } from './components/EnhancedSidebar';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
};

export const App: React.FC = () => {
  const { 
    isAuthenticated, user, role, cart, orders, notification,
    setIsAuthenticated, setUser, setRole, setProducts, setOrders, setBranches, setAllUsers, showNotification, handleLogout 
  } = useAppContext();

  const [showLanding, setShowLanding] = useState(true);
  const [initialAuthView, setInitialAuthView] = useState<'login' | 'signup'>('login');
  const [view, setView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Use refs to track listener status to prevent rapid re-attachments
  const listenersRef = useRef<Unsubscribe[]>([]);
  const authInitializedRef = useRef(false);
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme ? savedTheme === 'dark' : true;
    }
    return true;
  });
  
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isCustomerProfileSettingsOpen, setIsCustomerProfileSettingsOpen] = useState(false);
  const [isManageProfileOpen, setIsManageProfileOpen] = useState(false);
  const [adminPaymentConfig, setAdminPaymentConfig] = useState<PaymentConfig | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (isFirebaseEnabled && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          try {
            if (!db) throw new Error("Database not initialized");
            const userRef = doc(db, "users", currentUser.uid);
            const userDoc = await getDoc(userRef);
            
            let userData: User;

            if (userDoc.exists()) {
              userData = { ...userDoc.data(), uid: currentUser.uid } as User;
            } else {
              // SELF-HEALING: User exists in Auth but not in DB. Create profile now.
              console.warn("User profile missing in DB. Auto-creating profile...");
              
              // Force ADMIN role for specific UID, otherwise default to VENDOR
              const forcedRole = currentUser.uid === 'eNsizZmKaobzDHEJYm3lriYSdUD2' ? UserRole.ADMIN : UserRole.VENDOR;
              
              userData = {
                uid: currentUser.uid,
                name: currentUser.displayName || 'User',
                email: currentUser.email || '',
                role: forcedRole,
                storeName: forcedRole === UserRole.ADMIN ? 'Nexabu Admin' : 'New Store',
                photoURL: currentUser.photoURL || null,
                createdAt: new Date().toISOString(),
                status: 'Active'
              };
              
              await setDoc(userRef, userData);
            }
            
            setRole(userData.role);
            setUser(userData);
            setIsAuthenticated(true);
            setShowLanding(false);
            
            if (!authInitializedRef.current) {
                // Initialize offline functionality
                initOfflineDB().catch(console.error);
                setupAutoSync();
                setView(userData.role === UserRole.CUSTOMER ? 'storefront' : userData.role === UserRole.ADMIN ? 'users' : 'dashboard');
                authInitializedRef.current = true;
            }
          } catch (e: any) {
            console.error("Auth fetch/create error", e);
            // Only sign out if it's a critical failure not related to missing doc (since we handle that)
            setIsAuthenticated(false);
            setUser(null);
            setShowLanding(true);
            authInitializedRef.current = false;
          }
        } else {
          setIsAuthenticated(false);
          setUser(null);
          authInitializedRef.current = false;
        }
      });
      return () => unsubscribe();
    }
  }, [isFirebaseEnabled, setRole, setUser, setIsAuthenticated]);

  useEffect(() => {
    listenersRef.current.forEach(unsub => unsub());
    listenersRef.current = [];

    if (isFirebaseEnabled && isAuthenticated && user?.uid && db) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;

      const safeSubscribe = (q: Query<DocumentData>, callback: (snapshot: any) => void) => {
        try {
          const unsub = onSnapshot(q, callback, (err) => {
             if (err.code !== 'permission-denied') console.error("Snapshot error:", err);
          });
          listenersRef.current.push(unsub);
        } catch (e) { console.error("Failed to subscribe to query:", e); }
      };

      if (view === 'storefront') {
        safeSubscribe(query(collection(db, "products")), (s) => setProducts(s.docs.map(d => ({ ...d.data(), id: d.id } as Product))));
        safeSubscribe(query(collection(db, "users"), where("role", "in", ["VENDOR", "PHARMACY"])), (s) => setAllUsers(s.docs.map(d => d.data() as User)));
        // Load all branches for vendors/pharmacies
        safeSubscribe(query(collection(db, "branches")), (s) => setBranches(s.docs.map(d => ({ ...d.data(), id: d.id } as any))));
      } else if (targetUid) {
        safeSubscribe(query(collection(db, "products"), where("uid", "==", targetUid)), (s) => setProducts(s.docs.map(d => ({ ...d.data(), id: d.id } as Product))));
        // Set up orders query with better error handling to prevent Firestore internal assertion errors
        if (targetUid && typeof targetUid === 'string' && targetUid.trim() !== '') {
          try {
            const ordersQuery = query(collection(db, "orders"), where("sellerId", "==", targetUid));
            const unsubOrders = onSnapshot(
              ordersQuery,
              (s) => {
                try {
                  setOrders(s.docs.map(d => ({ ...d.data(), id: d.id } as any)));
                } catch (err) {
                  console.error("Error processing orders snapshot:", err);
                }
              },
              (err) => {
                if (err.code !== 'permission-denied') {
                  console.error("Orders snapshot error:", err);
                }
              }
            );
            listenersRef.current.push(unsubOrders);
          } catch (err) {
            console.error("Error setting up orders query:", err);
          }
        }
        safeSubscribe(query(collection(db, "branches"), where("uid", "==", targetUid)), (s) => setBranches(s.docs.map(d => ({ ...d.data(), id: d.id } as any))));
      }
      
      if (user.role === UserRole.ADMIN && view === 'users') {
        safeSubscribe(query(collection(db, "users")), (s) => setAllUsers(s.docs.map(d => d.data() as User)));
      }
    }

    return () => {
      listenersRef.current.forEach(unsub => unsub());
      listenersRef.current = [];
    };
  }, [isFirebaseEnabled, isAuthenticated, user?.uid, user?.role, user?.employerId, view]);

  const localLogout = () => {
    handleLogout().then(() => {
        setShowLanding(true);
        authInitializedRef.current = false;
    });
  };

  const navigate = (newView: string) => {
    setView(newView);
    setSidebarOpen(false);
    // Close profile modals when navigating to a different page
    setIsProfileSettingsOpen(false);
    setIsCustomerProfileSettingsOpen(false);
  };

  // Keyboard shortcuts for navigation
  useKeyboardShortcuts([
    { key: 'd', ctrlKey: true, action: () => navigate('dashboard'), description: 'Go to Dashboard' },
    { key: 'o', ctrlKey: true, action: () => navigate('orders'), description: 'Go to Orders' },
    { key: 'i', ctrlKey: true, action: () => navigate('inventory'), description: 'Go to Inventory' },
    { key: 's', ctrlKey: true, action: () => navigate('storefront'), description: 'Go to Storefront' },
  ], isAuthenticated);

  const handleShowAuth = (type: 'login' | 'signup') => {
    setInitialAuthView(type);
    setShowLanding(false);
  };
  
  const handleLogin = (userRole: UserRole, userData: User) => {
    setUser(userData);
    setRole(userRole);
    setIsAuthenticated(true);
    setShowLanding(false);
    setView(userRole === UserRole.CUSTOMER ? 'storefront' : userRole === UserRole.ADMIN ? 'users' : 'dashboard');
    authInitializedRef.current = true;
  };

  if (!isAuthenticated) {
    if (showLanding) return <LandingPage onLoginClick={() => handleShowAuth('login')} onSignupClick={() => handleShowAuth('signup')} />;
    return <Auth onLogin={handleLogin} onBack={() => setShowLanding(true)} initialView={initialAuthView} />;
  }
  
  const isSubAccount = [UserRole.STAFF, UserRole.MANAGER, UserRole.SELLER, UserRole.PHARMACIST].includes(role);

  const renderContent = () => {
    switch(view) {
      case 'dashboard': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            {role === UserRole.CUSTOMER ? <CustomerDashboard /> : <Dashboard />}
          </Suspense>
        );
      case 'inventory': return <Suspense fallback={<LoadingFallback />}><Inventory /></Suspense>;
      case 'warehouse-transfers':
      case 'transfers': return <Suspense fallback={<LoadingFallback />}><WarehouseTransfers /></Suspense>;
      case 'prescriptions': return <Suspense fallback={<LoadingFallback />}><Prescriptions /></Suspense>;
      case 'orders': return <Suspense fallback={<LoadingFallback />}><Orders /></Suspense>;
      case 'delivery': return <Suspense fallback={<LoadingFallback />}><Delivery /></Suspense>;
      case 'customers': return <Suspense fallback={<LoadingFallback />}><Customers /></Suspense>;
      case 'users': return <Suspense fallback={<LoadingFallback />}><AdminUsers /></Suspense>;
      case 'packages': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <AdminPackages adminPaymentConfig={adminPaymentConfig} setAdminPaymentConfig={setAdminPaymentConfig} />
          </Suspense>
        );
      case 'payment-verification':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SubscriptionPaymentVerification />
          </Suspense>
        );
      case 'order-verification':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <OrderManagement />
          </Suspense>
        );
      case 'subscription': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Subscription adminPaymentConfig={adminPaymentConfig} />
          </Suspense>
        );
      case 'staff': return <Suspense fallback={<LoadingFallback />}><StaffManagement /></Suspense>;
      case 'wallet': return <Suspense fallback={<LoadingFallback />}><Wallet /></Suspense>;
      case 'marketing': return <Suspense fallback={<LoadingFallback />}><Marketing /></Suspense>;
      case 'procurement': return <Suspense fallback={<LoadingFallback />}><Procurement /></Suspense>;
      case 'expenses': return <Suspense fallback={<LoadingFallback />}><Expenses /></Suspense>;
      case 'invoices': return <Suspense fallback={<LoadingFallback />}><Invoices /></Suspense>;
      case 'bills': return <Suspense fallback={<LoadingFallback />}><Bills /></Suspense>;
      case 'analytics': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        );
      case 'daily-reports':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <DailySalesReport />
          </Suspense>
        );
      case 'sales-reps':
        return (
          <Suspense fallback={<LoadingFallback />}>
            <SalesRepDashboard />
          </Suspense>
        );
      case 'shop': 
      case 'shop-builder': 
        return <Suspense fallback={<LoadingFallback />}><ShopBuilder /></Suspense>;
      case 'storefront': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Storefront />
          </Suspense>
        );
      case 'settings': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        );
      default: 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        );
    }
  };

  return (
      <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex font-sans text-neutral-900 dark:text-neutral-50 transition-colors duration-300">
        {/* ProfileSettings only for staff roles (they don't have store details in ManageProfile) */}
        {user && [UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF].includes(role) && (
          <ProfileSettings isOpen={isProfileSettingsOpen} onClose={() => setIsProfileSettingsOpen(false)} user={user} onUpdate={setUser} />
        )}
        {user && role === UserRole.CUSTOMER && <CustomerProfileSettings isOpen={isCustomerProfileSettingsOpen} onClose={() => setIsCustomerProfileSettingsOpen(false)} />}
        {user && (role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.ADMIN || role === UserRole.MANAGER) && (
          <ManageProfile isOpen={isManageProfileOpen} onClose={() => setIsManageProfileOpen(false)} />
        )}
        {notification && (
          <div className={`fixed top-16 sm:top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] p-3 sm:p-3 rounded-xl shadow-2xl border flex items-center gap-2 sm:gap-3 animate-fade-in max-w-[calc(100vw-2rem)] sm:max-w-md ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            <Bell className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm sm:text-base truncate">{notification.message}</span>
          </div>
        )}
        {isAuthenticated && <OfflineIndicator />}
        
        {/* Enhanced Sidebar */}
        {isAuthenticated && (
          <EnhancedSidebar
            view={view}
            role={role}
            user={user}
            cart={cart}
            orders={orders}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onNavigate={navigate}
            onLogout={localLogout}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
          />
        )}
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <header className="bg-white dark:bg-neutral-900 h-14 sm:h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-3 sm:px-4 md:px-6 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button 
                onClick={() => setSidebarOpen(true)} 
                className="lg:hidden p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg flex-shrink-0"
                aria-label="Open menu"
              >
                <Menu size={20} className="sm:w-6 sm:h-6" />
              </button>
              <h2 className="text-base sm:text-lg font-semibold capitalize truncate">{view.replace('-', ' ')}</h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {(role === UserRole.VENDOR || role === UserRole.PHARMACY) && (
                <button 
                  onClick={() => navigate('subscription')} 
                  className="hidden sm:block bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap"
                >
                  Upgrade
                </button>
              )}
              {(role === UserRole.CUSTOMER || view === 'storefront') && (
                <button 
                  className="relative p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors" 
                  onClick={() => {
                    navigate('storefront');
                    // Scroll to cart section after navigation if on storefront
                    setTimeout(() => {
                      const cartSection = document.querySelector('[data-cart-section]');
                      if (cartSection) {
                        cartSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }
                    }, 100);
                  }}
                  title="View Cart"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cart.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full"></span>}
                </button>
              )}
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
                title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                ) : (
                  <Moon className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                )}
              </button>
              <div className="relative flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-neutral-200 dark:border-neutral-800">
                <button 
                  onClick={() => setIsProfileDropdownOpen(p => !p)} 
                  className="flex items-center gap-1.5 sm:gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-200 dark:border-orange-800 relative">
                    {user?.photoURL && user.photoURL.trim() !== '' ? (
                      <img 
                        src={user.photoURL} 
                        className="w-full h-full object-cover" 
                        alt={user?.name || 'Profile'}
                        onError={(e) => {
                          // Hide broken image
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent && !parent.querySelector('span.fallback-initials')) {
                            const span = document.createElement('span');
                            span.className = 'text-sm font-bold text-orange-600 dark:text-orange-400 fallback-initials';
                            span.textContent = getInitials(user?.name);
                            parent.appendChild(span);
                          }
                        }}
                      />
                    ) : (
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{getInitials(user?.name)}</span>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-start">
                    <span className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight">
                      {user?.name || 'User'}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-tight">
                      {(() => {
                        switch (role) {
                          case UserRole.VENDOR: return 'Vendor';
                          case UserRole.PHARMACY: return 'Pharmacy';
                          case UserRole.ADMIN: return 'Admin';
                          case UserRole.MANAGER: return 'Manager';
                          case UserRole.SELLER: return 'Seller';
                          case UserRole.PHARMACIST: return 'Pharmacist';
                          case UserRole.STAFF: return 'Staff';
                          case UserRole.CUSTOMER: return 'Customer';
                          default: return 'User';
                        }
                      })()}
                    </span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-neutral-400 hidden sm:block transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {isProfileDropdownOpen && (
                  <ProfileDropdown 
                    user={user!} 
                    onManageAccount={() => { 
                      setIsProfileDropdownOpen(false); 
                      // Use CustomerProfileSettings for customers, ManageProfile for vendors/pharmacies/managers, ProfileSettings for staff
                      if (role === UserRole.CUSTOMER) {
                        setIsCustomerProfileSettingsOpen(true);
                      } else if (role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.ADMIN || role === UserRole.MANAGER) {
                        setIsManageProfileOpen(true);
                      } else {
                        setIsProfileSettingsOpen(true);
                      }
                    }}
                    onLogout={localLogout} 
                  />
                )}
              </div>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-neutral-50 dark:bg-neutral-950 pb-20 lg:pb-6">
            <SubscriptionStatusBanner />
            {renderContent()}
          </div>
          {/* NeBu Bot - positioned in right corner */}
          <div className="fixed bottom-4 right-4 z-40 hidden sm:block"><SmartBot /></div>
          <div className="fixed bottom-16 right-4 z-40 sm:hidden"><SmartBot /></div>
        </main>
      </div>
    </div>
  );
};
