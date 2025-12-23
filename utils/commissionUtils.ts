/**
 * Commission Utilities
 * Calculate commissions for sales representatives
 */

import { Order, User } from '../types';
import { UserRole } from '../types';

/**
 * Calculate commission for an order
 */
export function calculateCommission(orderTotal: number, commissionRate: number): number {
  if (!commissionRate || commissionRate <= 0) return 0;
  if (commissionRate > 100) return orderTotal; // Cap at 100%
  
  return (orderTotal * commissionRate) / 100;
}

/**
 * Get commission rate for a user
 */
export function getCommissionRate(user: User | null | undefined): number {
  if (!user) return 0;
  if (user.role === UserRole.SALES_REP) {
    return user.commissionRate || 0;
  }
  return 0;
}

/**
 * Calculate commission for an order with sales rep
 */
export function calculateOrderCommission(order: Order, salesRep: User | null | undefined): number {
  if (!salesRep || salesRep.role !== UserRole.SALES_REP) return 0;
  
  const rate = salesRep.commissionRate || 0;
  return calculateCommission(order.total, rate);
}

/**
 * Format commission for display
 */
export function formatCommission(amount: number): string {
  return `TZS ${amount.toLocaleString()}`;
}

