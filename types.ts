// User Role Enum
export enum UserRole {
  ADMIN = 'ADMIN',
  VENDOR = 'VENDOR',
  PHARMACY = 'PHARMACY',
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
  PHARMACIST = 'PHARMACIST',
  SALES_REP = 'SALES_REP'
}

// Staff Permissions Interface
export interface StaffPermissions {
  // Core Features
  canAccessDashboard?: boolean;
  canAccessOrders?: boolean;
  canAccessCustomers?: boolean;
  canAccessInventory?: boolean;
  canAccessInvoices?: boolean;
  canAccessDelivery?: boolean;
  canAccessExpenses?: boolean;
  canAccessPOS?: boolean; // POS/Storefront
  
  // Management Features
  canAccessStaff?: boolean;
  canAccessProcurement?: boolean;
  canAccessTransfers?: boolean;
  canAccessBills?: boolean;
  canAccessWallet?: boolean;
  canAccessMarketing?: boolean;
  canAccessShopBuilder?: boolean;
  canAccessPrescriptions?: boolean; // For pharmacies
  
  // Actions
  canCreateOrders?: boolean;
  canEditOrders?: boolean;
  canDeleteOrders?: boolean;
  canCreateProducts?: boolean;
  canEditProducts?: boolean;
  canDeleteProducts?: boolean;
  canCreateCustomers?: boolean;
  canEditCustomers?: boolean;
  canDeleteCustomers?: boolean;
  canCreateInvoices?: boolean;
  canEditInvoices?: boolean;
  canDeleteInvoices?: boolean;
  canViewReports?: boolean;
  canManageSettings?: boolean;
}

// User Interface
export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string | null;
  phone?: string;
  storeName?: string;
  location?: string;
  packageId?: string;
  createdAt: string;
  status?: string;
  employerId?: string; // For staff/manager/seller/pharmacist
  storeLogo?: string;
  businessType?: string;
  storeAddress?: string;
  country?: string;
  currency?: string;
  website?: string;
  whatsappNumber?: string;
  permissions?: StaffPermissions; // Permissions for staff members
  commissionRate?: number; // Commission percentage for sales reps (0-100)
}

// Product Interface
export interface Product {
  id: string;
  uid: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category?: string;
  barcode?: string;
  buyingPrice?: number;
  description?: string;
  expiryDate?: string;
  isPrescriptionRequired?: boolean;
  createdAt?: string;
  status?: string;
  trackInventory?: boolean;
  unit?: string;
}

// Customer Interface
export interface Customer {
  id?: string;
  uid: string;
  fullName: string;
  phone: string;
  email?: string;
  city?: string;
  district?: string;
  ward?: string;
  street?: string;
  residentAddress?: string;
  occupation?: string;
  type?: string;
  openingBalance?: number;
  dateAdded?: string;
  status?: string;
  photo?: string;
}

// Order Interface
export interface Order {
  id: string;
  sellerId: string;
  customerId?: string;
  customerName: string;
  date: string;
  status: string;
  total: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    productId?: string;
  }>;
  createdAt?: string;
  deliveryAddress?: string;
  paymentMethod?: string;
  salesRepId?: string; // Sales representative who made the sale
  salesRepName?: string;
  commission?: number; // Commission amount for this order
  branchId?: string; // Outlet/branch identifier
  channel?: string; // POS / Online / Field
  tax?: number;
  discount?: number;
  refund?: number;
  voided?: boolean;
}

// Branch Interface
export interface Branch {
  id: string;
  uid: string;
  name: string;
  location?: string;
  phone?: string;
  managerId?: string;
  createdAt?: string;
}

// Payment Methods Interface
export interface PaymentMethods {
  mpesa: string;
  tigopesa: string;
  airtel: string;
  halopesa: string;
}

// Invoice Interface
export interface Invoice {
  id: string;
  uid: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax?: number;
  total: number;
  status: string;
  createdAt?: string;
}

// Inventory Types
export interface InventoryAdjustment {
  id: string;
  uid: string;
  productId: string;
  productName: string;
  type: 'add' | 'remove' | 'set';
  quantity: number;
  reason?: string;
  date: string;
  createdAt?: string;
}

export interface ItemGroup {
  id: string;
  uid: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface ItemCategory {
  id: string;
  uid: string;
  name: string;
  description?: string;
  createdAt?: string;
}

export interface ItemUnit {
  id: string;
  uid: string;
  name: string;
  abbreviation?: string;
  createdAt?: string;
}

export interface UnitConversion {
  id: string;
  uid: string;
  fromUnitId: string;
  toUnitId: string;
  conversionFactor: number;
  createdAt?: string;
}

// New types added for recent features

export interface StaffTask {
  id: string;
  uid: string; // Store owner UID
  title: string;
  description?: string;
  assignedTo?: string; // Staff UID (optional - if null, assigned to all staff)
  assignedToName?: string;
  dueDate?: string;
  completed: boolean;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
  points?: number; // Points awarded for completion
  createdAt: string;
  createdBy: string;
  createdByName?: string;
}

export interface StaffPerformance {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  totalPoints: number;
  completedTasks: number;
  streak: number; // Consecutive days with completed tasks
  lastActiveDate?: string;
}

export interface UserNotificationSettings {
  uid: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  securityAlerts: boolean;
}

export interface TwoFactorAuth {
  uid: string;
  enabled: boolean;
  method: 'email' | 'phone' | null;
  phoneNumber?: string;
  emailAddress?: string;
  verified: boolean;
  secret?: string; // For TOTP (if implemented later)
}