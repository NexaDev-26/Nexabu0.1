
import { db } from '../firebaseConfig';
import { collection, doc, setDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { UserRole } from '../types';

// Schema-compliant Mock Data

export const USERS = [
  {
    // Specific Admin UID from request
    uid: 'eNsizZmKaobzDHEJYm3lriYSdUD2',
    name: 'Super Admin',
    email: 'admin@nexabu.com',
    role: UserRole.ADMIN,
    createdAt: new Date().toISOString(),
    status: 'Active'
  },
  {
    uid: 'admin_user', // Fallback admin
    name: 'System Admin',
    email: 'system@nexabu.com',
    role: UserRole.ADMIN,
    createdAt: new Date().toISOString(),
    status: 'Active'
  },
  {
    uid: 'vendor_user',
    name: 'John Vendor',
    email: 'vendor@nexabu.com',
    role: UserRole.VENDOR,
    storeName: 'Nexabu Tech Store',
    phone: '+255 700 123 456',
    location: 'Sinza, Dar es Salaam',
    packageId: 'Premium',
    createdAt: new Date().toISOString(),
    status: 'Active'
  },
  {
    uid: 'pharmacy_user',
    name: 'Sarah Pharmacist',
    email: 'pharma@nexabu.com',
    role: UserRole.PHARMACY,
    storeName: 'City Health Pharmacy',
    phone: '+255 655 987 654',
    location: 'Posta, Dar es Salaam',
    packageId: 'Enterprise',
    createdAt: new Date().toISOString(),
    status: 'Active'
  },
  {
    uid: 'customer_user',
    name: 'Alice Customer',
    email: 'alice@gmail.com',
    role: UserRole.CUSTOMER,
    phone: '+255 712 333 444',
    createdAt: new Date().toISOString(),
    status: 'Active'
  }
];

export const PRODUCTS = [
  {
    id: 'prod_1',
    uid: 'vendor_user', // Belongs to Vendor
    name: 'Wireless Headphones',
    category: 'Electronics',
    price: 45000,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'prod_2',
    uid: 'vendor_user',
    name: 'Smart Watch Series 5',
    category: 'Wearables',
    price: 85000,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date().toISOString()
  },
  {
    id: 'med_1',
    uid: 'pharmacy_user', // Belongs to Pharmacy
    name: 'Amoxicillin 500mg',
    category: 'Antibiotics',
    price: 5000,
    stock: 100,
    expiryDate: '2025-12-01',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=300&q=80',
    isPrescriptionRequired: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'med_2',
    uid: 'pharmacy_user',
    name: 'Paracetamol Syrup',
    category: 'Pain Relief',
    price: 3500,
    stock: 50,
    expiryDate: '2026-06-15',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=300&q=80',
    createdAt: new Date().toISOString()
  }
];

export const ORDERS = [
  {
    id: 'ord_1',
    sellerId: 'vendor_user',
    customerId: 'customer_user',
    customerName: 'Alice Customer',
    date: new Date().toISOString().split('T')[0],
    status: 'Processing',
    total: 45000,
    items: [
      { name: 'Wireless Headphones', price: 45000, quantity: 1 }
    ]
  },
  {
    id: 'ord_2',
    sellerId: 'pharmacy_user',
    customerId: 'customer_user',
    customerName: 'Alice Customer',
    date: new Date().toISOString().split('T')[0],
    status: 'Delivered',
    total: 8500,
    items: [
      { name: 'Amoxicillin', price: 5000, quantity: 1 },
      { name: 'Paracetamol', price: 3500, quantity: 1 }
    ]
  }
];

export const seedDatabase = async (): Promise<void> => {
  if (!db) {
      console.warn("Database seeding skipped: Firebase is not initialized (Demo Mode).");
      return;
  }
  console.log("Starting Database Seed...");
  try {
      const batch = writeBatch(db);

      // 1. Seed Users
      for (const user of USERS) {
        const ref = doc(db, 'users', user.uid);
        batch.set(ref, user);
      }

      // 2. Seed Products
      for (const prod of PRODUCTS) {
        const ref = doc(db, 'products', prod.id);
        batch.set(ref, prod);
      }

      // 3. Seed Orders
      for (const ord of ORDERS) {
        const ref = doc(db, 'orders', ord.id);
        batch.set(ref, ord);
      }

      // 4. Seed Branches
      const branchRef = doc(db, 'branches', 'br_1');
      batch.set(branchRef, {
          id: 'br_1',
          uid: 'vendor_user',
          name: 'Main Street Branch',
          location: 'Sinza Mapambano',
          manager: 'Manager Mike'
      });

      await batch.commit();
      console.log("Database Seeding Complete!");
  } catch (e) {
      console.error("Database Seeding Failed:", e);
      throw e;
  }
};

export const clearCollection = async (collectionName: string) => {
    if (!db) return;
    const q = collection(db, collectionName);
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, collectionName, d.id)));
    await Promise.all(deletePromises);
};
