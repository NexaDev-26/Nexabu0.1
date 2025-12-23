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
  subscriptionPlan?: string; // Package name (e.g., 'Starter', 'Premium', 'Enterprise')
  subscriptionExpiry?: string; // ISO date string
  activationDate?: string; // ISO date string
  supportForumCode?: string; // Support forum access code
  paymentConfig?: PaymentConfig; // Vendor-specific payment methods configuration
}

// Vendor Payment Configuration
export interface PaymentConfig {
  mpesa?: {
    enabled: boolean;
    merchantNumber: string;
    accountName: string;
  };
  tigoPesa?: {
    enabled: boolean;
    merchantNumber: string;
    accountName: string;
  };
  airtelMoney?: {
    enabled: boolean;
    merchantNumber: string;
    accountName: string;
  };
  bankTransfer?: {
    enabled: boolean;
    accountNumber: string;
    accountName: string;
    bankName: string;
    branchName?: string;
  };
}

// Product Interface
export interface Product {
  id: string;
  uid: string;
  name: string;
  price: number; // Selling price (vendor -> customer)
  discountPrice?: number; // Final price after discount
  stock: number;
  image?: string;
  category?: string;
  barcode?: string;
  buyingPrice?: number; // Cost (supplier -> vendor)
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

// Order Status Types
export type OrderStatus = 
  | 'Pending' 
  | 'Processing' 
  | 'Paid' 
  | 'DISPATCHED' 
  | 'In Transit' 
  | 'Delivered' 
  | 'Cancelled' 
  | 'PAYMENT_FAILED';

export type PaymentStatus = 
  | 'PENDING' 
  | 'PENDING_VERIFICATION' 
  | 'PAID' 
  | 'FAILED' 
  | 'REFUNDED' 
  | 'ESCROW_HELD';

// Order Interface
export interface Order {
  id: string;
  sellerId: string;
  customerId?: string;
  customerName: string;
  date: string;
  status: OrderStatus;
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
  paymentStatus?: PaymentStatus; // Payment verification status
  transactionRef?: string; // Transaction reference code from customer
  deliveryOtp?: string; // 4-digit OTP for delivery verification
  courierId?: string; // Assigned courier/driver ID
  courierName?: string; // Assigned courier/driver name
  salesRepId?: string; // Sales representative who made the sale
  salesRepName?: string;
  commission?: number; // Commission amount for this order
  branchId?: string; // Outlet/branch identifier
  channel?: string; // POS / Online / Field
  tax?: number;
  deliveryRequested?: boolean; // Whether customer requested home delivery
  deliveryFee?: number; // Delivery fee amount
  deliveryType?: 'self-pickup' | 'home-delivery'; // Delivery type selected by customer
  discount?: number;
  refund?: number;
  voided?: boolean;
  escrowReleaseDate?: string; // When funds were released from escrow
  paymentRejectionReason?: string; // Reason if payment was rejected
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

// Payment Provider Types
export type PaymentProvider = 
  | 'MPESA' 
  | 'TIGO_PESA' 
  | 'AIRTEL_MONEY' 
  | 'HALO_PESA'
  | 'BANK_TRANSFER'
  | 'ESCROW_WALLET'
  | 'NHIF'
  | 'PRIVATE_INSURANCE'
  | 'CASH'
  | 'CREDIT_CARD';

// Transaction Status
export type TransactionStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'ESCROW_HELD' 
  | 'RELEASED' 
  | 'REFUNDED';

// Transaction Interface
export interface Transaction {
  id: string;
  userId: string;
  vendorId?: string; // Vendor/Pharmacy ID for multi-vendor orders
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: TransactionStatus;
  referenceId?: string;
  orderId?: string;
  vendorOrderId?: string; // Sub-order ID for multi-vendor orders
  paymentMethod?: 'STK_PUSH' | 'MANUAL_MOBILE' | 'MANUAL_BANK'; // Payment method type
  escrowReleaseDate?: string;
  commission?: number; // System commission (5%)
  createdAt: string;
  completedAt?: string;
  description?: string;
  type?: 'Deposit' | 'Withdrawal' | 'Payment' | 'Refund' | 'Commission' | 'Escrow';
}

// Multi-Vendor Order Structure
export interface MultiVendorOrder {
  id: string;
  customerId?: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  total: number; // Total across all vendors
  vendorOrders: VendorOrder[]; // Sub-orders grouped by vendor
  createdAt: string;
  deliveryAddress?: string;
  deliveryType?: 'self-pickup' | 'home-delivery';
  deliveryFee?: number;
  deliveryRequested?: boolean;
  deliveryOtp?: string;
  tax?: number;
  discount?: number;
  refund?: number;
  channel?: string;
  branchId?: string;
  mainOrderId?: string; // Reference to main order if this is a sub-order
}

// Individual Vendor Order (Sub-order)
export interface VendorOrder {
  id: string;
  vendorId: string; // Vendor/Pharmacy ID
  vendorName: string;
  customerId?: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  total: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    productId?: string;
  }>;
  transactionRef?: string; // Transaction reference code for this vendor
  paymentMethod?: PaymentProvider;
  paymentMethodType?: 'STK_PUSH' | 'MANUAL_MOBILE' | 'MANUAL_BANK';
  createdAt: string;
  deliveryAddress?: string;
  tax?: number;
  discount?: number;
  refund?: number;
  mainOrderId?: string; // Reference to main multi-vendor order
}

// Payment Feature Gating
export interface PaymentFeatures {
  mobileMoney: boolean; // M-Pesa, Tigo, Airtel
  bankSettlement: boolean; // Bank transfers & auto-payouts
  escrowSecurity: boolean; // Nexa-Shield Escrow
  insurance: boolean; // NHIF & Private Insurance
  payoutSpeed: '48_HOURS' | '24_HOURS' | 'INSTANT';
  reporting: 'BASIC' | 'PDF_RECEIPTS' | 'ADVANCED_AUDIT';
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

// Subscription Package Types
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
  color?: string;
  isPopular?: boolean;
}

// Payment Confirmation Interface
export interface PaymentConfirmation {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  packageId: string;
  packageName: string;
  paymentCode: string;
  amount: number;
  paymentMethod: string;
  status: 'pending' | 'confirmed' | 'rejected';
  confirmedBy?: string; // Admin UID
  confirmedAt?: string;
  createdAt: string;
}