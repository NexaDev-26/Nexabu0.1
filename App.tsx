

import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User, Product } from './types';
import { Dashboard } from './components/Dashboard';
import { CustomerDashboard } from './components/CustomerDashboard';
import { SmartBot } from './components/SmartBot';
import { Inventory } from './components/Inventory';
import { Orders } from './components/Orders';
import { Settings } from './components/Settings';
import { Storefront } from './components/Storefront';
import { Prescriptions } from './components/Prescriptions';
import { AdminUsers } from './components/AdminUsers';
import { AdminPackages } from './components/AdminPackages'; 
import { Subscription } from './components/Subscription'; 
import { Delivery } from './components/Delivery';
import { StaffManagement } from './components/StaffManagement';
import { Wallet } from './components/Wallet';
import { Auth } from './components/Auth';
import { LandingPage } from './components/LandingPage';
import { Marketing } from './components/Marketing';
import { Procurement } from './components/Procurement';
import { ProfileSettings } from './components/ProfileSettings';
import { ProfileDropdown } from './components/ProfileDropdown';
import { Customers } from './components/Customers';
import { CustomerProfileSettings } from './components/CustomerProfileSettings';
import { useAppContext } from './hooks/useAppContext';
import { 
  LayoutDashboard, Store, Pill, Settings as SettingsIcon, LogOut, Menu,
  ShoppingBag, Users, Truck, ShoppingCart, X, Briefcase, Wallet as WalletIcon,
  Moon, Sun, Bell, Sparkles, Package, Globe, ChevronDown, FileText, UserCircle
} from 'lucide-react';
import { auth, db, isFirebaseEnabled } from './firebaseConfig';
import { doc, getDoc, collection, onSnapshot, query, where, Unsubscribe, DocumentData, Query, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

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

  // Close profile modals when navigating to Settings page
  useEffect(() => {
    if (view === 'settings') {
      setIsProfileSettingsOpen(false);
      setIsCustomerProfileSettingsOpen(false);
    }
  }, [view]);

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
      case 'dashboard': return role === UserRole.CUSTOMER ? <CustomerDashboard /> : <Dashboard />;
      case 'inventory': return <Inventory />;
      case 'prescriptions': return <Prescriptions />;
      case 'orders': return <Orders />;
      case 'delivery': return <Delivery />;
      case 'customers': return <Customers />;
      case 'users': return <AdminUsers />;
      case 'packages': return <AdminPackages adminPaymentDetails={adminPaymentDetails} setAdminPaymentDetails={setAdminPaymentDetails} />;
      case 'subscription': return <Subscription adminPaymentDetails={adminPaymentDetails} />;
      case 'staff': return <StaffManagement />;
      case 'wallet': return <Wallet />;
      case 'marketing': return <Marketing />;
      case 'procurement': return <Procurement />;
      case 'storefront': return <Storefront onOpenCustomerProfile={role === UserRole.CUSTOMER ? () => setIsCustomerProfileSettingsOpen(true) : undefined} />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
      <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex font-sans text-neutral-900 dark:text-neutral-50 transition-colors duration-300">
        {user && <ProfileSettings isOpen={isProfileSettingsOpen} onClose={() => setIsProfileSettingsOpen(false)} user={user} onUpdate={setUser} />}
        {user && role === UserRole.CUSTOMER && <CustomerProfileSettings isOpen={isCustomerProfileSettingsOpen} onClose={() => setIsCustomerProfileSettingsOpen(false)} />}
        {notification && <div className={`fixed top-4 right-4 z-[100] p-3 rounded-xl shadow-2xl border flex items-center gap-3 animate-fade-in ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}><Bell className="w-4 h-4" />{notification.message}</div>}
        
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
            {role !== UserRole.ADMIN && <SidebarItem icon={<LayoutDashboard size={20} />} label={isSubAccount && role !== UserRole.MANAGER ? "My Dashboard" : "Dashboard"} active={view === 'dashboard'} onClick={() => navigate('dashboard')} />}
            {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && <>
              <SidebarItem icon={<Store size={20} />} label="Inventory" active={view === 'inventory'} onClick={() => navigate('inventory')} />
              <SidebarItem icon={<ShoppingBag size={20} />} label="Orders" active={view === 'orders'} onClick={() => navigate('orders')} />
              <SidebarItem icon={<UserCircle size={20} />} label="Customers" active={view === 'customers'} onClick={() => navigate('customers')} />
              <SidebarItem icon={<FileText size={20} />} label="Procurement & Restock" active={view === 'procurement'} onClick={() => navigate('procurement')} />
              <SidebarItem icon={<Truck size={20} />} label="Delivery" active={view === 'delivery'} onClick={() => navigate('delivery')} />
            </>}
            {[UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF].includes(role) && <>
              <SidebarItem icon={<ShoppingBag size={20} />} label="POS / Storefront" active={view === 'storefront'} onClick={() => navigate('storefront')} />
              <SidebarItem icon={<ShoppingBag size={20} />} label="Orders" active={view === 'orders'} onClick={() => navigate('orders')} />
            </>}
            {(role === UserRole.VENDOR || role === UserRole.PHARMACY) && <>
              <SidebarItem icon={<Sparkles size={20} />} label="AI Marketing" active={view === 'marketing'} onClick={() => navigate('marketing')} />
              <SidebarItem icon={<Briefcase size={20} />} label="Staff & Sellers" active={view === 'staff'} onClick={() => navigate('staff')} />
              <SidebarItem icon={<WalletIcon size={20} />} label="Wallet & Finance" active={view === 'wallet'} onClick={() => navigate('wallet')} />
              <SidebarItem icon={<Globe size={20} />} label="Marketplace" active={view === 'storefront'} onClick={() => navigate('storefront')} />
            </>}
            {role === UserRole.MANAGER && <SidebarItem icon={<Briefcase size={20} />} label="Staff Analytics" active={view === 'staff'} onClick={() => navigate('staff')} />}
            {(role === UserRole.PHARMACY || (role === UserRole.MANAGER && user?.employerRole === UserRole.PHARMACY)) && <SidebarItem icon={<Pill size={20} />} label="Prescriptions" active={view === 'prescriptions'} onClick={() => navigate('prescriptions')} />}
            {role === UserRole.ADMIN && <>
              <SidebarItem icon={<Users size={20} />} label="User Management" active={view === 'users'} onClick={() => navigate('users')} />
              <SidebarItem icon={<Package size={20} />} label="Manage Packages" active={view === 'packages'} onClick={() => navigate('packages')} />
            </>}
          </div>
          <div className="p-4 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-4 px-4"><span className="text-xs text-neutral-500 font-medium">Theme</span><button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-neutral-900 text-neutral-400 hover:text-orange-500">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button></div>
            {(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.ADMIN) && <SidebarItem icon={<SettingsIcon size={20} />} label="Settings" active={view === 'settings'} onClick={() => navigate('settings')} />}
            <button onClick={localLogout} className="w-full flex items-center gap-3 px-4 py-3 text-neutral-400 hover:bg-neutral-800 hover:text-red-500 rounded-lg mt-2"><LogOut size={20} /><span className="font-medium text-sm">Sign Out</span></button>
          </div>
        </aside>
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          <header className="bg-white dark:bg-neutral-900 h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 flex-shrink-0">
            <div className="flex items-center gap-4"><button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"><Menu size={24} /></button><h2 className="text-lg font-semibold capitalize truncate">{view.replace('-', ' ')}</h2></div>
            <div className="flex items-center gap-4">
              {role === UserRole.VENDOR || role === UserRole.PHARMACY && <button onClick={() => navigate('subscription')} className="hidden sm:block bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-lg text-sm font-medium">Upgrade</button>}
              {(role === UserRole.CUSTOMER || view === 'storefront') && <button className="relative p-2" onClick={() => navigate('storefront')}><ShoppingCart /><span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full"></span></button>}
              <div className="relative flex items-center gap-2 pl-4 border-l border-neutral-200 dark:border-neutral-800">
                <button onClick={() => setIsProfileDropdownOpen(p => !p)} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">{user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover rounded-full" /> : getInitials(user?.name)}</div>
                  <span className="text-sm font-medium hidden sm:block">{user?.name || 'Profile'}</span>
                  <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:block" />
                </button>
                {isProfileDropdownOpen && (
                  <ProfileDropdown 
                    user={user!} 
                    onManageAccount={() => { setIsProfileDropdownOpen(false); setIsProfileSettingsOpen(true); }} 
                    onCustomerProfile={role === UserRole.CUSTOMER ? () => { setIsProfileDropdownOpen(false); setIsCustomerProfileSettingsOpen(true); } : undefined}
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
