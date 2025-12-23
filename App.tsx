import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { UserRole, User, Product, StaffPermissions } from './types';
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
  LayoutDashboard, Store, Pill, LogOut, Menu,
  ShoppingBag, Users, Truck, ShoppingCart, X, Briefcase, Wallet as WalletIcon,
  Moon, Sun, Bell, Sparkles, Package, Globe, ChevronDown, FileText, UserCircle,
  Receipt, DollarSign, Calendar, BarChart3, ArrowRightLeft, Trophy
} from 'lucide-react';
import { auth, db, isFirebaseEnabled } from './firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, where, Unsubscribe, DocumentData, Query, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { initOfflineDB } from './services/offlineService';
import { setupAutoSync } from './services/syncService';
import { OfflineIndicator } from './components/OfflineIndicator';

const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
};

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-orange-600 text-white shadow-lg' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}>
    {icon}
    <span className="font-medium text-sm">{label}</span>
  </button>
);

export const App: React.FC = () => {
  const { 
    isAuthenticated, user, role, cart, notification,
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
  const [adminPaymentDetails, setAdminPaymentDetails] = useState({ phone: '0700000000', name: 'NexaNova Admin', network: 'M-PESA' });

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
              console.log("Profile auto-created successfully.");
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
      } else if (targetUid) {
        safeSubscribe(query(collection(db, "products"), where("uid", "==", targetUid)), (s) => setProducts(s.docs.map(d => ({ ...d.data(), id: d.id } as Product))));
        safeSubscribe(query(collection(db, "orders"), where("sellerId", "==", targetUid)), (s) => setOrders(s.docs.map(d => ({ ...d.data(), id: d.id } as any))));
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
            <AdminPackages adminPaymentDetails={adminPaymentDetails} setAdminPaymentDetails={setAdminPaymentDetails} />
          </Suspense>
        );
      case 'subscription': 
        return (
          <Suspense fallback={<LoadingFallback />}>
            <Subscription adminPaymentDetails={adminPaymentDetails} />
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
        {notification && <div className={`fixed top-4 right-4 z-[100] p-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}><Bell className="w-4 h-4" />{notification.message}</div>}
        {isAuthenticated && <OfflineIndicator />}
        
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed lg:static z-30 w-64 bg-neutral-950 border-r border-neutral-800 text-white flex flex-col transition-transform duration-300 shadow-2xl lg:shadow-none h-full`}>
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-xl">N</div><h1 className="font-display font-bold text-xl">NexaNova</h1></div><button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-neutral-800 rounded-lg"><X size={20} /></button></div>
          <div className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            {/* Helper function to check permissions */}
            {(() => {
              const hasPermission = (permission: keyof StaffPermissions) => {
                // Owners (VENDOR, PHARMACY) and ADMIN always have access
                if (role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.ADMIN) {
                  return true;
                }
                // Managers have full access
                if (role === UserRole.MANAGER) {
                  return true;
                }
                // For staff, check permissions
                if (user?.permissions) {
                  return user.permissions[permission] === true;
                }
                // Default: allow access if no permissions set (backward compatibility)
                return true;
              };

              return (
                <>
                  {/* Dashboard - Show for customers and staff, or as Dashboard & Analytics for vendors/pharmacies/managers */}
                  {role === UserRole.CUSTOMER && <>
                    <SidebarItem icon={<Store size={20} />} label="Marketplace" active={view === 'storefront'} onClick={() => navigate('storefront')} />
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="My Dashboard" active={view === 'dashboard'} onClick={() => navigate('dashboard')} />
                  </>}
                  {[UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF].includes(role) && hasPermission('canAccessDashboard') && (
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === 'dashboard'} onClick={() => navigate('dashboard')} />
                  )}
                  {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && <>
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={view === 'dashboard' || view === 'analytics'} onClick={() => navigate('dashboard')} />
                    {hasPermission('canAccessOrders') && (
                      <SidebarItem icon={<ShoppingBag size={20} />} label="Orders" active={view === 'orders'} onClick={() => navigate('orders')} />
                    )}
                    {hasPermission('canAccessCustomers') && (
                      <SidebarItem icon={<UserCircle size={20} />} label="Customers" active={view === 'customers'} onClick={() => navigate('customers')} />
                    )}
                    {hasPermission('canAccessInventory') && (
                      <SidebarItem icon={<Store size={20} />} label="Inventory" active={view === 'inventory'} onClick={() => navigate('inventory')} />
                    )}
                    {hasPermission('canAccessInvoices') && (
                      <SidebarItem icon={<Receipt size={20} />} label="Invoices" active={view === 'invoices'} onClick={() => navigate('invoices')} />
                    )}
                    {hasPermission('canViewReports') && (
                      <SidebarItem icon={<BarChart3 size={20} />} label="Daily Reports" active={view === 'daily-reports'} onClick={() => navigate('daily-reports')} />
                    )}
                    {hasPermission('canAccessDelivery') && (
                      <SidebarItem icon={<Truck size={20} />} label="Delivery" active={view === 'delivery'} onClick={() => navigate('delivery')} />
                    )}
                    {hasPermission('canAccessExpenses') && (
                      <SidebarItem icon={<DollarSign size={20} />} label="Expenses" active={view === 'expenses'} onClick={() => navigate('expenses')} />
                    )}
                  </>}
                  {[UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF].includes(role) && <>
                    {hasPermission('canAccessPOS') && (
                      <SidebarItem icon={<ShoppingBag size={20} />} label="POS / Storefront" active={view === 'storefront'} onClick={() => navigate('storefront')} />
                    )}
                    {hasPermission('canAccessOrders') && (
                      <SidebarItem icon={<Receipt size={20} />} label="Orders" active={view === 'orders'} onClick={() => navigate('orders')} />
                    )}
                  </>}
                  {(role === UserRole.VENDOR || role === UserRole.PHARMACY) && <>
                    {hasPermission('canAccessStaff') && (
                      <SidebarItem icon={<Briefcase size={20} />} label="Staff & Sellers" active={view === 'staff'} onClick={() => navigate('staff')} />
                    )}
                    <SidebarItem icon={<Trophy size={20} />} label="Sales Reps" active={view === 'sales-reps'} onClick={() => navigate('sales-reps')} />
                    {hasPermission('canAccessProcurement') && (
                      <SidebarItem icon={<FileText size={20} />} label="Procurement" active={view === 'procurement'} onClick={() => navigate('procurement')} />
                    )}
                    {hasPermission('canAccessTransfers') && (
                      <SidebarItem icon={<ArrowRightLeft size={20} />} label="Transfers" active={view === 'warehouse-transfers' || view === 'transfers'} onClick={() => navigate('warehouse-transfers')} />
                    )}
                    {hasPermission('canAccessBills') && (
                      <SidebarItem icon={<Calendar size={20} />} label="Bills" active={view === 'bills'} onClick={() => navigate('bills')} />
                    )}
                    {hasPermission('canAccessWallet') && (
                      <SidebarItem icon={<WalletIcon size={20} />} label="Wallet" active={view === 'wallet'} onClick={() => navigate('wallet')} />
                    )}
                    {hasPermission('canAccessMarketing') && (
                      <SidebarItem icon={<Sparkles size={20} />} label="Marketing" active={view === 'marketing'} onClick={() => navigate('marketing')} />
                    )}
                    {hasPermission('canAccessShopBuilder') && (
                      <SidebarItem icon={<Globe size={20} />} label="Shop Builder" active={view === 'shop'} onClick={() => navigate('shop')} />
                    )}
                  </>}
                  {role === UserRole.MANAGER && <SidebarItem icon={<Briefcase size={20} />} label="Staff Analytics" active={view === 'staff'} onClick={() => navigate('staff')} />}
                  {(role === UserRole.PHARMACY || (role === UserRole.MANAGER && user?.employerRole === UserRole.PHARMACY)) && hasPermission('canAccessPrescriptions') && (
                    <SidebarItem icon={<Pill size={20} />} label="Prescriptions" active={view === 'prescriptions'} onClick={() => navigate('prescriptions')} />
                  )}
                  {role === UserRole.ADMIN && <>
                    <SidebarItem icon={<Users size={20} />} label="User Management" active={view === 'users'} onClick={() => navigate('users')} />
                    <SidebarItem icon={<Package size={20} />} label="Manage Packages" active={view === 'packages'} onClick={() => navigate('packages')} />
                  </>}
                </>
              );
            })()}
          </div>
          <div className="p-4 border-t border-neutral-800 space-y-4">
            {/* Store Details Section - Show for vendors, pharmacies, and managers */}
            {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && user && (
              <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {user.storeLogo ? (
                      <img src={user.storeLogo} alt={user.storeName || 'Store'} className="w-full h-full object-cover" />
                    ) : (
                      <Store className="w-6 h-6 text-orange-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.storeName || 'Store'}</p>
                    <p className="text-xs text-neutral-400 truncate">{user.name || 'Admin'}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between px-4"><span className="text-xs text-neutral-500 font-medium">Theme</span><button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-orange-500">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button></div>
            <button onClick={localLogout} className="w-full flex items-center gap-3 px-4 py-3 text-neutral-400 hover:bg-neutral-800 hover:text-red-500 rounded-lg mt-2"><LogOut size={20} /><span className="font-medium text-sm">Sign Out</span></button>
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <header className="bg-white dark:bg-neutral-900 h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4"><button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"><Menu size={24} /></button><h2 className="text-lg font-semibold capitalize truncate">{view.replace('-', ' ')}</h2></div>
            <div className="flex items-center gap-4">
              {role === UserRole.VENDOR || role === UserRole.PHARMACY && <button onClick={() => navigate('subscription')} className="hidden sm:block bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-lg text-sm font-medium">Upgrade</button>}
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
              <div className="relative flex items-center gap-3 pl-4 border-l border-neutral-200 dark:border-neutral-800">
                <button 
                  onClick={() => setIsProfileDropdownOpen(p => !p)} 
                  className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg px-2 py-1.5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-200 dark:border-orange-800 relative">
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-neutral-50 dark:bg-neutral-950 pb-20 lg:pb-6">{renderContent()}</div>
          {/* NeBu Bot - positioned in right corner */}
          <div className="fixed bottom-4 right-4 z-40"><SmartBot /></div>
        </main>
      </div>
    </div>
  );
};
