# Order Data Population Implementation Guide

## Overview
This guide provides exact code changes to populate `branchId`, `channel`, `tax`, `discount`, and `refund` fields when creating orders.

---

## 1. Storefront.tsx Updates

### A. Add State Variables (around line 55)

```typescript
const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
const [selectedChannel, setSelectedChannel] = useState<string>('POS');
```

### B. Add Branch Loading (around line 29, after vendors)

```typescript
// Get branches for current user (vendor/pharmacy)
const userBranches = useMemo(() => {
  if (!user) return [];
  const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) 
    ? user.uid 
    : user.employerId;
  if (!targetUid) return [];
  // TODO: Load branches from Firestore branches collection
  // For now, return empty array - can be populated from ManageProfile branches
  return [];
}, [user]);
```

### C. Update Tax Calculation (around line 230, after subtotal calculation)

```typescript
// Calculate tax (18% VAT in Tanzania)
const taxRate = 0.18; // 18% VAT
const taxAmount = (subtotal - discountAmount) * taxRate;
const totalAmount = Math.max(0, subtotal - discountAmount + deliveryFee + taxAmount);
```

### D. Update Order Creation (around line 325, in orderData)

```typescript
const orderData: any = {
  customerName: customerDetails.name.trim(),
  date: new Date().toISOString(),
  status: 'Pending',
  paymentStatus: 'PENDING_VERIFICATION',
  total: totalAmount,
  items: orderItems,
  sellerId: sellerId,
  deliveryOtp: deliveryOtp,
  deliveryType: deliveryType,
  deliveryRequested: deliveryType === 'home-delivery',
  createdAt: new Date().toISOString(),
  // Tax, Discount, Refund fields
  tax: taxAmount,
  discount: discountAmount,
  refund: 0, // Default to 0, can be updated later if refunded
  // Branch and Channel fields
  channel: selectedChannel || 'POS'
};

// ... existing optional fields ...

// Add branchId if selected (not 'all')
if (selectedBranchId && selectedBranchId !== 'all') {
  orderData.branchId = selectedBranchId;
}
```

### E. Add Branch/Channel Selection UI (around line 878, before Delivery Type Selection)

```typescript
{/* Branch and Channel Selection */}
{(role === UserRole.VENDOR || role === UserRole.PHARMACY || role === UserRole.MANAGER) && (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Branch</h4>
      <select
        value={selectedBranchId}
        onChange={(e) => setSelectedBranchId(e.target.value)}
        className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
      >
        <option value="all">All Branches / Main</option>
        {userBranches.map(branch => (
          <option key={branch.id} value={branch.id}>{branch.name}</option>
        ))}
      </select>
    </div>
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Channel</h4>
      <select
        value={selectedChannel}
        onChange={(e) => setSelectedChannel(e.target.value)}
        className="w-full p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
      >
        <option value="POS">POS / In-Store</option>
        <option value="Online">Online</option>
        <option value="Field">Field Sales</option>
        <option value="WhatsApp">WhatsApp</option>
        <option value="Phone">Phone Order</option>
      </select>
    </div>
  </div>
)}
```

### F. Add Tax Display in Summary (around line 948, after discount)

```typescript
{taxAmount > 0 && (
  <div className="flex justify-between text-sm mb-1">
    <span className="text-neutral-600 dark:text-neutral-400">Tax (18% VAT)</span>
    <span className="font-medium text-neutral-900 dark:text-white">TZS {taxAmount.toLocaleString()}</span>
  </div>
)}
```

---

## 2. QuickSale.tsx Updates

### A. Update Tax Calculation (around line 42)

```typescript
const subtotal = quickCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
const taxRate = 0.18; // 18% VAT
const taxAmount = subtotal * taxRate;
const total = subtotal + taxAmount;
```

### B. Update Order Data (around line 48)

```typescript
const orderData: any = {
  sellerId: sellerId || '',
  customerName: 'Walk-in Customer',
  date: new Date().toISOString(),
  status: 'Completed',
  total,
  items: quickCart.map(item => ({
    productId: item.product.id,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity
  })),
  createdAt: new Date().toISOString(),
  paymentMethod: 'Cash',
  // Tax, Discount, Refund fields
  tax: taxAmount,
  discount: 0, // Quick sale typically no discount
  refund: 0, // Default to 0
  // Branch and Channel fields
  channel: 'POS' // Quick sale is always POS/in-store
};
```

---

## 3. Load Branches from Firestore (Optional Enhancement)

### In Storefront.tsx, add useEffect to load branches:

```typescript
const [userBranches, setUserBranches] = useState<Branch[]>([]);

useEffect(() => {
  if (!user || !isFirebaseEnabled || !db) return;
  
  const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) 
    ? user.uid 
    : user.employerId;
  if (!targetUid) return;

  const q = query(collection(db, 'branches'), where('uid', '==', targetUid));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    setUserBranches(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Branch)));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('Error loading branches:', error);
    }
  });

  return () => unsubscribe();
}, [user, isFirebaseEnabled, db]);
```

**Add imports:**
```typescript
import { query, collection, where, onSnapshot } from 'firebase/firestore';
import { Branch } from '../types';
```

---

## 4. Summary of Changes

### Fields Added to Orders:
- ✅ `tax`: Calculated as 18% VAT on (subtotal - discount)
- ✅ `discount`: Already calculated, now saved to order
- ✅ `refund`: Default 0, can be updated later
- ✅ `branchId`: Selected branch ID (or omitted if 'all')
- ✅ `channel`: Selected channel (POS, Online, Field, WhatsApp, Phone)

### Tax Calculation:
- **Storefront**: Tax = (subtotal - discount) × 18%
- **QuickSale**: Tax = subtotal × 18%
- **Total**: subtotal - discount + tax + deliveryFee

### Default Values:
- `channel`: 'POS' (for QuickSale and default)
- `branchId`: Omitted if 'all' selected
- `refund`: 0 (can be updated later via refund process)
- `discount`: Calculated from discount code or 0

---

## 5. Testing Checklist

- [ ] Tax is calculated correctly (18% of subtotal - discount)
- [ ] Tax is displayed in checkout summary
- [ ] Branch selection works (if branches exist)
- [ ] Channel selection works
- [ ] Order includes tax, discount, refund, branchId, channel
- [ ] QuickSale includes tax and channel
- [ ] DailySalesReport shows tax/discount/refund analytics
- [ ] Branch/Channel filters work in DailySalesReport

---

## 6. Next Steps

1. **Implement branch loading**: Connect to Firestore branches collection
2. **Add refund functionality**: Create UI to update refund field on orders
3. **Tax configuration**: Make tax rate configurable per user/org
4. **Channel auto-detection**: Auto-set channel based on order source

---

## Files Modified

1. `components/Storefront.tsx` - Main checkout flow
2. `components/QuickSale.tsx` - Quick sale flow
3. (Optional) Other order creation points in:
   - `components/Ordering/QuickOrderModal.tsx`
   - `components/Customers.tsx`
   - `components/Procurement.tsx`

---

**Status**: Implementation guide ready. Apply changes to populate order fields.

