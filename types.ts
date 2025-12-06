

export enum UserRole {
  ADMIN = 'ADMIN',
  // Business Owners
  VENDOR = 'VENDOR',
  PHARMACY = 'PHARMACY',
  // Staff Roles
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
  PHARMACIST = 'PHARMACIST',
  STAFF = 'STAFF', // Deprecated/Generic
  // End Users
  CUSTOMER = 'CUSTOMER',
}

export interface User {
  uid: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  phone?: string;
  whatsappNumber?: string;
  storeName?: string;
  employerId?: string;
  employerRole?: UserRole;
  branchId?: string;
  isDefaultPassword?: boolean;
  defaultPassword?: string;
  status?: 'Active' | 'Pending' | 'Suspended';
  createdAt?: string;
  packageId?: string;
  location?: string;
  // Financials
  creditLimit?: number;
  creditScore?: number;
  walletBalance?: number;
  // Extended Store Info
  businessType?: string;
  country?: string;
  currency?: string;
  website?: string;
  storeAddress?: string;
  storeLogo?: string;
  // Subscription Info
  subscriptionPlan?: string;
  subscriptionDate?: string;
  subscriptionExpiry?: string;
  activationDate?: string;
  supportForumCode?: string;
  // Access Control
  permissions?: string[];
}

export interface Customer {
  id: string;
  uid: string; // Tenant owner ID
  fullName: string;
  type: 'Customer' | 'Supplier' | 'Guarantor' | 'Other';
  email: string;
  phone: string;
  occupation?: string;
  openingBalance: number;
  dateAdded: string;
  status: 'Active' | 'Inactive';
  photo?: string;
  // Location Hierarchy
  city?: string;
  district?: string;
  ward?: string;
  village?: string;
  street?: string;
  residentAddress?: string;
  // Attachments
  nationalIdUrl?: string;
  documentUrl?: string;
}

export interface Branch {
  id: string;
  uid: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  location: string;
  status: 'Active' | 'Inactive';
  manager?: string;
}

// --- INVENTORY EXTENSIONS ---

export interface ItemGroup {
  id: string;
  uid: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface ItemCategory {
  id: string;
  uid: string;
  name: string;
  type?: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface ItemUnit {
  id: string;
  uid: string;
  name: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface UnitConversion {
  id: string;
  uid: string;
  itemName: string;
  equivalentUnit: string;
  smallestUnit: string;
  description?: string;
  status: 'Active' | 'Inactive';
}

export interface InventoryAdjustment {
  id: string;
  uid: string;
  itemId: string;
  itemName: string;
  type: 'Add' | 'Remove';
  quantity: number;
  date: string;
  description?: string;
  user?: string;
}

export interface Product {
  id: string;
  uid: string; // Owner ID
  name: string;
  description?: string;
  price: number; // Selling Price
  buyingPrice?: number;
  stock: number; // On Hand
  openingStock?: number;
  
  // Relations
  groupId?: string;
  categoryId?: string;
  category?: string; // Main Category Name
  unit?: string; // Unit Name
  
  // Accounting
  incomeAccount?: string;
  expenseAccount?: string;
  
  // Tracking
  trackInventory?: boolean;
  status?: 'Active' | 'Inactive';
  barcode?: string; // NEW: Barcode
  
  // Visuals
  image: string;
  
  // Pharmacy Specifics
  expiryDate?: string;
  batchNumber?: string;
  isPrescriptionRequired?: boolean;
  document?: string;
  
  variants?: Variant[];
  createdAt?: string;
}

export interface Variant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  uid: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: 'Draft' | 'Ordered' | 'Received' | 'Cancelled';
  items: { name: string; quantity: number; cost: number; productId?: string }[];
  totalCost: number;
  dateIssued: string;
  expectedDate?: string;
  uid: string;
  note?: string;
}

export interface Order {
  id: string;
  customerName: string;
  total: number;
  status: 'Pending' | 'Processing' | 'Delivered' | 'Cancelled';
  date: string;
  items: { name: string; price: number; quantity: number }[] | Product[];
  sellerId?: string;
  customerId?: string;
  receiptNumber?: string;
  tax?: number;
  orderType?: 'WhatsApp' | 'Direct';
}

export interface WholesaleOrder {
  id: string;
  supplier: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: 'Pending' | 'Approved' | 'Shipped' | 'Delivered';
  paymentMethod: 'Cash' | 'Credit' | 'Wallet';
  date: string;
  uid: string;
}

export interface CreditApplication {
  id: string;
  uid: string;
  businessName: string;
  tinNumber: string;
  monthlyRevenue: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestedLimit: number;
  date: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  isLoading?: boolean;
  groundingMetadata?: any;
}

export interface PaymentMethods {
  mpesa: string;
  tigopesa: string;
  airtel: string;
  halopesa: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
}

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  period: 'Monthly' | 'Yearly';
  services: Service[];
  isPopular?: boolean;
  color: string;
}

export interface Transaction {
  id: string;
  type: 'Deposit' | 'Withdrawal' | 'Payment';
  amount: number;
  provider: 'M-PESA' | 'TIGO PESA' | 'AIRTEL MONEY' | 'BANK' | 'Wallet';
  date: string;
  status: 'Completed' | 'Pending' | 'Failed';
  phone?: string;
  uid: string;
}

export interface DeliveryTask {
  id: string;
  orderId: string;
  customer: string;
  address: string;
  driver?: string;
  status: 'Unassigned' | 'In Transit' | 'Delivered';
  eta?: string;
  uid: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  plateNumber: string;
  status: 'Available' | 'Busy';
  uid: string;
}

export interface WholesaleItem {
  id: string;
  name: string;
  supplier: string;
  price: number;
  moq: number;
  unit: string;
  image: string;
  category: string;
  discount?: number;
}

// Analytics Types
export interface DailyStat {
  date: string;
  income: number;
  expenses: number;
  profit: number;
}
