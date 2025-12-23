# Database Optimization Guide

## Overview

This document outlines Firestore database optimization strategies, index recommendations, and query performance best practices for the Nexabu application.

## Index Recommendations

### Composite Indexes Required

Firestore requires composite indexes for queries that filter or order by multiple fields. Add these indexes in the Firebase Console:


#### Orders Collection
```javascript
// Orders by status and date
orders: status (ASC), date (DESC)

// Orders by user and date
orders: uid (ASC), date (DESC)

// Orders by customer and status
orders: customerId (ASC), status (ASC), date (DESC)
```

#### Products Collection
```javascript
// Products by store and category
products: uid (ASC), category (ASC), name (ASC)

// Products by store and stock status
products: uid (ASC), stock (ASC), name (ASC)

// Low stock products
products: uid (ASC), stock (ASC) [where stock < threshold]
```

#### Inventory Adjustments
```javascript
// Adjustments by store and date
inventory_adjustments: uid (ASC), date (DESC)

// Adjustments by product and date
inventory_adjustments: productId (ASC), date (DESC)
```

#### Expenses Collection
```javascript
// Expenses by store and date
expenses: uid (ASC), date (DESC)

// Expenses by category and date
expenses: uid (ASC), category (ASC), date (DESC)
```

#### Audit Logs
```javascript
// Audit logs by user and timestamp
audit_logs: userId (ASC), timestamp (DESC)

// Audit logs by resource
audit_logs: resourceType (ASC), resourceId (ASC), timestamp (DESC)

// Audit logs by action
audit_logs: action (ASC), timestamp (DESC)
```

#### Customers Collection
```javascript
// Customers by store
customers: uid (ASC), name (ASC)

// Customers by email
customers: uid (ASC), email (ASC)
```

#### Branches Collection
```javascript
// Branches by store
branches: uid (ASC), name (ASC)
```

### How to Create Indexes

1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Enter collection name
4. Add fields with sorting order
5. Set query scope (Collection or Collection Group)
6. Create index

Alternatively, indexes can be created automatically when queries run (they'll appear in the console with a link to create).

## Query Optimization Strategies

### 1. Client-Side Sorting (Current Approach)

Since we're using client-side sorting in `ApiService`, we can reduce index requirements. However, this has limitations:

**Pros:**
- Fewer indexes needed
- More flexible sorting
- Works well for small to medium datasets

**Cons:**
- Less efficient for large datasets
- Downloads all documents before sorting
- Higher bandwidth usage

**Best For:** Datasets < 1000 documents

### 2. Server-Side Sorting (Recommended for Large Datasets)

Use Firestore `orderBy()` for better performance on large datasets:

```typescript
// Instead of client-side sorting
const q = query(
  collection(db, 'orders'),
  where('uid', '==', userId),
  orderBy('date', 'desc'),  // Server-side sort
  limit(50)
);
```

**Best For:** Datasets > 1000 documents

### 3. Pagination

Implement cursor-based pagination for large datasets:

```typescript
// First page
const firstPage = query(
  collection(db, 'orders'),
  where('uid', '==', userId),
  orderBy('date', 'desc'),
  limit(20)
);

// Next page (using last document as cursor)
const lastDoc = snapshot.docs[snapshot.docs.length - 1];
const nextPage = query(
  collection(db, 'orders'),
  where('uid', '==', userId),
  orderBy('date', 'desc'),
  startAfter(lastDoc),
  limit(20)
);
```


### 4. Data Denormalization

Store frequently accessed data together to reduce queries:

```typescript
// Instead of joining users and orders
order: {
  customerId: 'user123',
  customerName: 'John Doe',  // Denormalized
  customerEmail: 'john@example.com',  // Denormalized
  // ... other fields
}
```

### 5. Limit Query Results

Always use `limit()` to prevent downloading excessive data:

```typescript
const q = query(
  collection(db, 'products'),
  where('uid', '==', userId),
  limit(100)  // Important!
);
```

## Collection Structure Recommendations

### Use Subcollections for Hierarchical Data

```
stores/{storeId}
  ├── products/{productId}
  ├── orders/{orderId}
  │   └── items/{itemId}
  └── customers/{customerId}
```

**Pros:**
- Better organization
- Easier access control
- Natural grouping

**Cons:**
- Can't query across subcollections easily
- More complex queries

### Use Root Collections for Cross-Store Queries

If you need to query across stores, use root collections:

```
products/{productId}  // uid field stores storeId
orders/{orderId}      // uid field stores storeId
```

**Current Approach:** Root collections with `uid` field (recommended for this app)

## Data Archiving Strategy

### Archive Old Data

Create an archive collection for old records:

```typescript
// Archive orders older than 2 years
const archiveOrders = async () => {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  const q = query(
    collection(db, 'orders'),
    where('date', '<', twoYearsAgo),
    limit(500)
  );
  
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach(doc => {
    // Move to archive
    const archiveRef = doc(db, 'orders_archive', doc.id);
    batch.set(archiveRef, doc.data());
    batch.delete(doc.ref);
  });
  
  await batch.commit();
};
```

### Data Retention Policy

- **Active Orders:** Keep last 6 months
- **Archived Orders:** Keep indefinitely (for accounting)
- **Audit Logs:** Keep last 2 years
- **Products:** Keep all (unless deleted)
- **Customers:** Keep all (unless deleted)

## Performance Monitoring

### Firestore Usage Metrics

Monitor in Firebase Console:
- Read operations
- Write operations
- Storage usage
- Network egress

### Query Performance

Use Firestore Profiler or Cloud Monitoring:
- Slow query identification
- Index usage
- Document size monitoring

## Security Rules Optimization

Optimize security rules for better performance:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Efficient: Check user once
    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }
    
    // Use resource.data when possible (more efficient)
    match /orders/{orderId} {
      allow read: if isOwner(resource.data.uid);
      allow write: if isOwner(request.resource.data.uid);
    }
  }
}
```

## Caching Strategy

### Client-Side Caching

Firestore SDK caches automatically. Control cache behavior:

```typescript
// Enable offline persistence (web)
import { enableIndexedDbPersistence } from 'firebase/firestore';
enableIndexedDbPersistence(db);

// Cache mode options
const q = query(collection(db, 'products'));
const snapshot = await getDocs(q, {
  source: 'cache'  // 'default' | 'cache' | 'server'
});
```

### Application-Level Caching

Use React Query or SWR for application-level caching:

```typescript
// Example with React Query
const { data } = useQuery(['products', userId], () => 
  getProducts(userId),
  { staleTime: 5 * 60 * 1000 }  // Cache for 5 minutes
);
```

## Migration Checklist

- [ ] Create all recommended composite indexes
- [ ] Review and optimize slow queries
- [ ] Implement pagination for large collections
- [ ] Set up data archiving process
- [ ] Monitor Firestore usage metrics
- [ ] Optimize security rules
- [ ] Implement application-level caching
- [ ] Document query patterns
- [ ] Set up performance alerts

## Additional Resources

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Pricing](https://firebase.google.com/pricing)
- [Query Performance](https://firebase.google.com/docs/firestore/query-data/queries)
- [Index Management](https://firebase.google.com/docs/firestore/query-data/indexing)

