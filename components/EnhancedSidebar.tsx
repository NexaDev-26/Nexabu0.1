/**
 * Enhanced Sidebar Component
 * Improved sidebar with grouping, search, badges, and better UX
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  LayoutDashboard, Store, Pill, LogOut, Menu, ShoppingBag, Users, Truck,
  ShoppingCart, X, Briefcase, Wallet as WalletIcon, Moon, Sun, Bell, Sparkles,
  Package, Globe, ChevronDown, FileText, UserCircle, Receipt, DollarSign,
  Calendar, BarChart3, ArrowRightLeft, Trophy, Search, ChevronRight, Star,
  Clock, Zap, Settings, HelpCircle, Keyboard
} from 'lucide-react';
import { UserRole, User, StaffPermissions } from '../types';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';
import { KeyboardShortcut, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: string;
  category?: string;
  badge?: number | string;
  shortcut?: string;
  permission?: keyof StaffPermissions;
  roles?: UserRole[];
  isFavorite?: boolean;
}

interface SidebarSection {
  id: string;
  label: string;
  items: SidebarItem[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

interface EnhancedSidebarProps {
  view: string;
  role: UserRole;
  user: User | null;
  cart: any[];
  orders: any[];
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const EnhancedSidebar: React.FC<EnhancedSidebarProps> = ({
  view,
  role,
  user,
  cart,
  orders,
  darkMode,
  setDarkMode,
  onNavigate,
  onLogout,
  sidebarOpen,
  setSidebarOpen
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['favorites', 'recent', 'sales', 'inventory', 'finance-operations-management', 'admin']));
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('sidebarFavorites');
    return saved ? new Set(JSON.parse(saved)) : new Set(['dashboard', 'inventory', 'orders']);
  });
  const [recentViews, setRecentViews] = useState<string[]>(() => {
    const saved = localStorage.getItem('sidebarRecent');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Track recent views
  React.useEffect(() => {
    if (view && !recentViews.includes(view)) {
      const updated = [view, ...recentViews.filter(v => v !== view)].slice(0, 5);
      setRecentViews(updated);
      localStorage.setItem('sidebarRecent', JSON.stringify(updated));
    }
  }, [view]);

  // Save favorites
  React.useEffect(() => {
    localStorage.setItem('sidebarFavorites', JSON.stringify(Array.from(favorites)));
  }, [favorites]);

  const toggleFavorite = (itemId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const hasPermission = useCallback((permission?: keyof StaffPermissions): boolean => {
    if (!permission) return true;
    if (role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.ADMIN) {
      return true;
    }
    if (role === UserRole.MANAGER) {
      return true;
    }
    if (user?.permissions) {
      return user.permissions[permission] === true;
    }
    return true;
  }, [role, user?.permissions]);

  // Get pending orders count
  const pendingOrdersCount = useMemo(() => {
    return orders?.filter((o: any) => o.status === 'pending' || o.status === 'processing').length || 0;
  }, [orders]);

  // Define all menu items
  const allItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [
      // Core Navigation
      { id: 'dashboard', label: role === UserRole.CUSTOMER ? 'My Dashboard' : 'Dashboard', icon: <LayoutDashboard size={20} />, view: 'dashboard', category: 'core', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER, UserRole.CUSTOMER, UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF], shortcut: 'Ctrl+D' },
    ];

    // Add storefront/marketplace based on role
    if (role === UserRole.CUSTOMER) {
      items.push({ id: 'storefront', label: 'Marketplace', icon: <Store size={20} />, view: 'storefront', category: 'core', roles: [UserRole.CUSTOMER] });
    } else if ([UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF].includes(role)) {
      // For staff, add POS/Storefront if they have permission
      if (hasPermission('canAccessPOS')) {
        items.push({ id: 'pos-storefront', label: 'POS / Storefront', icon: <ShoppingBag size={20} />, view: 'storefront', category: 'core', permission: 'canAccessPOS', roles: [UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF] });
      }
      items.push({ id: 'storefront', label: 'Storefront', icon: <Store size={20} />, view: 'storefront', category: 'core', roles: [UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF] });
    } else {
      items.push({ id: 'storefront', label: 'Storefront', icon: <Store size={20} />, view: 'storefront', category: 'core', roles: [UserRole.VENDOR, UserRole.PHARMACY] });
    }

    return items.concat([
    
    // Sales & Orders
    { id: 'orders', label: 'Orders', icon: <ShoppingBag size={20} />, view: 'orders', category: 'sales', badge: pendingOrdersCount, permission: 'canAccessOrders', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER, UserRole.SELLER, UserRole.PHARMACIST, UserRole.STAFF], shortcut: 'Ctrl+O' },
    { id: 'customers', label: 'Customers', icon: <UserCircle size={20} />, view: 'customers', category: 'sales', permission: 'canAccessCustomers', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'sales-reps', label: 'Sales Reps', icon: <Trophy size={20} />, view: 'sales-reps', category: 'sales', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    
    // Inventory
    { id: 'inventory', label: 'Inventory', icon: <Store size={20} />, view: 'inventory', category: 'inventory', permission: 'canAccessInventory', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER], shortcut: 'Ctrl+I' },
    { id: 'procurement', label: 'Procurement', icon: <FileText size={20} />, view: 'procurement', category: 'inventory', permission: 'canAccessProcurement', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    { id: 'warehouse-transfers', label: 'Transfers', icon: <ArrowRightLeft size={20} />, view: 'warehouse-transfers', category: 'inventory', permission: 'canAccessTransfers', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    
    // Finance
    { id: 'invoices', label: 'Invoices', icon: <Receipt size={20} />, view: 'invoices', category: 'finance', permission: 'canAccessInvoices', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'bills', label: 'Bills', icon: <Calendar size={20} />, view: 'bills', category: 'finance', permission: 'canAccessBills', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    { id: 'expenses', label: 'Expenses', icon: <DollarSign size={20} />, view: 'expenses', category: 'finance', permission: 'canAccessExpenses', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'wallet', label: 'Wallet', icon: <WalletIcon size={20} />, view: 'wallet', category: 'finance', permission: 'canAccessWallet', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    
    // Operations
    { id: 'delivery', label: 'Delivery', icon: <Truck size={20} />, view: 'delivery', category: 'operations', permission: 'canAccessDelivery', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'prescriptions', label: 'Prescriptions', icon: <Pill size={20} />, view: 'prescriptions', category: 'operations', permission: 'canAccessPrescriptions', roles: [UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'daily-reports', label: 'Daily Reports', icon: <BarChart3 size={20} />, view: 'daily-reports', category: 'operations', permission: 'canViewReports', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    
    // Management
    { id: 'staff', label: 'Staff & Sellers', icon: <Briefcase size={20} />, view: 'staff', category: 'management', permission: 'canAccessStaff', roles: [UserRole.VENDOR, UserRole.PHARMACY, UserRole.MANAGER] },
    { id: 'marketing', label: 'Marketing', icon: <Sparkles size={20} />, view: 'marketing', category: 'management', permission: 'canAccessMarketing', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    { id: 'shop-builder', label: 'Shop Builder', icon: <Globe size={20} />, view: 'shop', category: 'management', permission: 'canAccessShopBuilder', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    
    // Admin
    { id: 'users', label: 'User Management', icon: <Users size={20} />, view: 'users', category: 'admin', roles: [UserRole.ADMIN] },
    { id: 'packages', label: 'Manage Packages', icon: <Package size={20} />, view: 'packages', category: 'admin', roles: [UserRole.ADMIN] },
    { id: 'payment-verification', label: 'Payment Verification', icon: <DollarSign size={20} />, view: 'payment-verification', category: 'admin', roles: [UserRole.ADMIN] },
    { id: 'order-verification', label: 'Order Payments', icon: <DollarSign size={20} />, view: 'order-verification', category: 'admin', roles: [UserRole.VENDOR, UserRole.PHARMACY] },
    ]);
  }, [role, pendingOrdersCount, hasPermission, user?.permissions]);

  // Filter items by role and permissions
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (item.roles && !item.roles.includes(role)) return false;
      if (item.permission && !hasPermission(item.permission)) return false;
      return true;
    });
  }, [allItems, role, hasPermission, user?.permissions]);

  // Group items by category
  const groupedSections: SidebarSection[] = useMemo(() => {
    const categories: Record<string, SidebarItem[]> = {
      favorites: [],
      recent: [],
      core: [],
      sales: [],
      inventory: [],
      finance: [],
      operations: [],
      management: [],
      admin: []
    };

    filteredItems.forEach(item => {
      // Add to favorites if favorited
      if (favorites.has(item.id)) {
        categories.favorites.push(item);
      }
      // Add to recent if in recent views
      if (recentViews.includes(item.view)) {
        categories.recent.push(item);
      }
      // Add to category
      const cat = item.category || 'core';
      if (categories[cat]) {
        categories[cat].push(item);
      }
    });

    const sections: SidebarSection[] = [];

    // 1. Core - Essential navigation (Dashboard, Storefront) - Always visible, expanded by default
    if (categories.core.length > 0) {
      sections.push({ id: 'core', label: 'Core', items: categories.core, collapsible: true, defaultCollapsed: false });
    }

    // 2. Favorites - User's favorite items (collapsed by default)
    if (categories.favorites.length > 0 && !searchQuery) {
      sections.push({ id: 'favorites', label: 'Favorites', items: categories.favorites, collapsible: true, defaultCollapsed: true });
    }

    // 3. Recent - Recently accessed items (collapsed by default)
    if (categories.recent.length > 0 && !searchQuery) {
      sections.push({ id: 'recent', label: 'Recent', items: categories.recent, collapsible: true, defaultCollapsed: true });
    }

    // 4. Sales & Orders - Sales related items (collapsed by default)
    if (categories.sales.length > 0) {
      sections.push({ id: 'sales', label: 'Sales & Orders', items: categories.sales, collapsible: true, defaultCollapsed: true });
    }

    // 5. Inventory - Inventory management (collapsed by default)
    if (categories.inventory.length > 0) {
      sections.push({ id: 'inventory', label: 'Inventory', items: categories.inventory, collapsible: true, defaultCollapsed: true });
    }

    // 6. Finance, Operations & Management - Combined section (collapsed by default)
    const financeOperationsManagementItems = [...categories.finance, ...categories.operations, ...categories.management];
    if (financeOperationsManagementItems.length > 0) {
      sections.push({ id: 'finance-operations-management', label: 'Finance, Operations & Management', items: financeOperationsManagementItems, collapsible: true, defaultCollapsed: true });
    }

    // 7. Admin - Admin only items (collapsed by default, only visible to admins)
    if (categories.admin.length > 0) {
      sections.push({ id: 'admin', label: 'Administration', items: categories.admin, collapsible: true, defaultCollapsed: true });
    }

    return sections;
  }, [filteredItems, favorites, recentViews, searchQuery]);

  // Filter by search query
  const searchFilteredSections = useMemo(() => {
    if (!searchQuery) return groupedSections;

    const query = searchQuery.toLowerCase();
    return groupedSections.map(section => ({
      ...section,
      items: section.items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        item.view.toLowerCase().includes(query)
      )
    })).filter(section => section.items.length > 0);
  }, [groupedSections, searchQuery]);

  const SidebarItemComponent: React.FC<{ item: SidebarItem }> = ({ item }) => {
    const isActive = view === item.view;
    const isFavorite = favorites.has(item.id);

    return (
      <button
        onClick={() => {
          onNavigate(item.view);
          setSidebarOpen(false);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative ${
          isActive
            ? 'bg-orange-600 text-white shadow-lg'
            : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
        }`}
        title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
      >
        <div className="flex-shrink-0">{item.icon}</div>
        {!isCollapsed && (
          <>
            <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
            <div className="flex items-center gap-2">
              {item.badge && (
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-orange-600 text-white'
                }`}>
                  {item.badge}
                </span>
              )}
              {item.shortcut && (
                <kbd className="hidden group-hover:inline-flex px-1.5 py-0.5 text-xs bg-neutral-800 rounded text-neutral-400">
                  {item.shortcut}
                </kbd>
              )}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFavorite(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`p-1 rounded hover:bg-white/10 transition-colors cursor-pointer ${
                  isFavorite ? 'text-yellow-400' : 'text-neutral-500 hover:text-yellow-400'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={14} className={isFavorite ? 'fill-current' : ''} />
              </div>
            </div>
          </>
        )}
        {isCollapsed && item.badge && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-600 rounded-full"></span>
        )}
      </button>
    );
  };

  // Define keyboard shortcuts for navigation
  const shortcuts: KeyboardShortcut[] = [
    { key: 'd', ctrlKey: true, action: () => onNavigate('dashboard'), description: 'Go to Dashboard' },
    { key: 'o', ctrlKey: true, action: () => onNavigate('orders'), description: 'Go to Orders' },
    { key: 'i', ctrlKey: true, action: () => onNavigate('inventory'), description: 'Go to Inventory' },
    { key: 'k', ctrlKey: true, action: () => {
      const searchInput = document.querySelector('input[placeholder="Search menu..."]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    }, description: 'Focus search' },
    { key: '/', ctrlKey: true, action: () => setShowShortcuts(true), description: 'Show keyboard shortcuts' },
  ];

  // Enable keyboard shortcuts
  useKeyboardShortcuts(shortcuts, true);

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          onTouchStart={(e) => {
            // Prevent sidebar interaction when touching overlay
            e.stopPropagation();
          }}
        />
      )}
      
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'w-20' : 'w-64 sm:w-72'
        } fixed lg:static z-50 bg-neutral-950 border-r border-neutral-800 text-white flex flex-col transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none h-full`}
        style={{ willChange: 'transform' }}
        onTouchStart={(e) => {
          // Allow touch events inside sidebar
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-xl">
                N
              </div>
              <h1 className="font-display font-bold text-xl">Nexabu</h1>
            </div>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-xl mx-auto">
              N
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-neutral-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-3 sm:p-4 border-b border-neutral-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-600"
              />
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="flex-1 p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto custom-scrollbar overscroll-contain">
          {searchFilteredSections.map((section) => {
            const sectionCollapsed = collapsedSections.has(section.id);
            const shouldShow = !section.collapsible || !sectionCollapsed;

            return (
              <div key={section.id} className="space-y-2">
                {!isCollapsed && section.collapsible && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-neutral-300 transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${sectionCollapsed ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}
                {!isCollapsed && !section.collapsible && (
                  <div className="px-2 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    {section.label}
                  </div>
                )}
                {shouldShow && (
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <SidebarItemComponent key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 space-y-4">
          {/* Store Details */}
          {!isCollapsed && (role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && user && (
            <div className="bg-neutral-900 rounded-lg p-3 border border-neutral-800">
              <div className="flex items-center gap-3">
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

          {/* Quick Actions */}
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowShortcuts(true)}
                  className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-orange-500 transition-colors"
                  title="Keyboard Shortcuts"
                >
                  <Keyboard size={16} />
                </button>
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg bg-neutral-900 text-neutral-400 hover:text-orange-500 transition-colors"
                  title="Toggle Theme"
                >
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-neutral-400 hover:bg-neutral-800 hover:text-red-500 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="font-medium text-sm">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcutsHelp
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          shortcuts={shortcuts}
        />
      )}
    </>
  );
};
