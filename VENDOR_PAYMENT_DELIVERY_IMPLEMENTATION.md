# Vendor-Driven Payment and Delivery Ecosystem - Implementation Guide

## Overview
This document outlines the implementation of a comprehensive vendor-driven payment and delivery ecosystem for the Nexabu app.

## ✅ Completed

### 1. Data Model Updates
- ✅ Added `PaymentConfig` interface to `types.ts`
- ✅ Added `deliveryRequested`, `deliveryFee`, `deliveryType` fields to `Order` interface
- ✅ Payment config includes: M-Pesa, Tigo Pesa, Airtel Money, Bank Transfer

### 2. Payment Methods Management (Partial)
- ✅ Added Payment Methods section structure in ManageProfile
- ✅ Added state management for payment config
- ✅ Added copy-to-clipboard functionality

## 🔄 Remaining Implementation

### 1. Complete Payment Methods Management in ManageProfile
**Location**: `components/ManageProfile.tsx` (around line 895, before "Save Button")

**What to add**:
- Payment Methods Configuration section with toggle switches
- Input fields for merchant numbers and account names
- Copy-to-clipboard buttons for each payment number
- Save payment config to Firestore when saving store details

### 2. Update Storefront Checkout
**Location**: `components/Storefront.tsx`

**Changes needed**:
- Add delivery type selection (Self-Pickup vs Home Delivery)
- Calculate delivery fee (flat fee or distance-based)
- Pass delivery info to order creation
- Update order total to include delivery fee

### 3. Enhance PaymentModal
**Location**: `components/PaymentModal.tsx`

**Changes needed**:
- Fetch vendor's payment config from Firestore
- Display vendor-specific payment numbers based on selected payment method
- Show copy-to-clipboard buttons for payment numbers
- Display account name for each payment method

### 4. Update OrderManagement for Auto-Dispatch
**Location**: `components/OrderManagement.tsx`

**Changes needed**:
- After "Verify & Accept", check if `deliveryRequested === true`
- If delivery requested, automatically create delivery task
- Push delivery task to 'Available Deliveries' pool
- Update order status to PAID and PROCESSING

### 5. Create Progress Stepper Component
**New File**: `components/OrderProgressStepper.tsx`

**Features**:
- Show order progress: Payment Pending → Verifying → Preparing → Out for Delivery → Delivered
- Visual stepper with icons
- Status-based styling

### 6. Update Order Display
**Location**: `components/Orders.tsx`

**Changes needed**:
- Show delivery type (Self-Pickup/Home Delivery)
- Show delivery fee if applicable
- Display progress stepper for orders

## Implementation Priority

1. **High Priority**: Complete Payment Methods Management (enables vendor configuration)
2. **High Priority**: Update Storefront Checkout (enables delivery selection)
3. **High Priority**: Enhance PaymentModal (shows vendor payment numbers)
4. **Medium Priority**: Auto-dispatch in OrderManagement
5. **Medium Priority**: Progress Stepper Component
6. **Low Priority**: Order display enhancements

## Database Schema

The `paymentConfig` is stored in the `users` collection as a nested object:
```typescript
{
  paymentConfig: {
    mpesa: {
      enabled: boolean,
      merchantNumber: string,
      accountName: string
    },
    tigoPesa: { ... },
    airtelMoney: { ... },
    bankTransfer: { ... }
  }
}
```

## Key Functions Needed

1. `calculateDeliveryFee(deliveryType, distance?)` - Calculate delivery fee
2. `getVendorPaymentConfig(vendorId)` - Fetch vendor payment config
3. `createDeliveryTaskFromOrder(order)` - Auto-create delivery task
4. `getOrderProgressStatus(order)` - Determine current progress step

