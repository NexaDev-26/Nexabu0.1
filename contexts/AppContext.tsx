import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, Product, Order, Branch, User, PaymentMethods } from '../types';
import { auth, db, isFirebaseEnabled } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { seedDatabase, USERS as MOCK_USERS, PRODUCTS as MOCK_PRODUCTS } from '../utils/dbSeeder';

interface AppContextType {
  // State
  isAuthenticated: boolean;
  user: User | null;
  role: UserRole;
  products: Product[];
  orders: Order[];
  cart: { product: Product; quantity: number }[];
  branches: Branch[];
  allUsers: User[];
  paymentMethods: PaymentMethods;
  notification: { message: string; type: 'success' | 'info' | 'error' } | null;

  // Setters
  setUser: (user: User | null) => void;
  setRole: (role: UserRole) => void;
  setIsAuthenticated: (auth: boolean) => void;
  setProducts: (products: Product[] | ((prev: Product[]) => Product[])) => void;
  setOrders: (orders: Order[]) => void;
  setCart: (cart: { product: Product; quantity: number }[] | ((prev: { product: Product; quantity: number }[]) => { product: Product; quantity: number }[])) => void;
  setBranches: (branches: Branch[]) => void;
  setAllUsers: (users: User[]) => void;
  showNotification: (message: string, type?: 'success' | 'info' | 'error') => void;
  handleLogout: () => Promise<void>;
  seedDatabase: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(UserRole.VENDOR);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethods>({ mpesa: '', tigopesa: '', airtel: '', halopesa: '' });
  
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotification({ message, type });
  };

  const handleLogout = async () => {
    if (isFirebaseEnabled && auth) {
      await auth.signOut();
    }
    setIsAuthenticated(false);
    setUser(null);
    setRole(UserRole.VENDOR);
  };
  
  // Notification Timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <AppContext.Provider value={{
      isAuthenticated,
      user,
      role,
      products,
      orders,
      cart,
      branches,
      allUsers,
      paymentMethods,
      notification,
      setIsAuthenticated,
      setUser,
      setRole,
      setProducts,
      setOrders,
      setCart,
      setBranches,
      setAllUsers,
      showNotification,
      handleLogout,
      seedDatabase
    }}>
      {children}
    </AppContext.Provider>
  );
};
