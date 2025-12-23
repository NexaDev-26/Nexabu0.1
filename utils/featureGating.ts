/**
 * Feature Gating Utility
 * Controls access to app features based on subscription status and payment verification
 */

import { User, UserRole } from '../types';

/**
 * Check if user has active subscription with verified payment
 */
export function hasActiveSubscription(user: User | null): boolean {
  if (!user) return false;
  
  // Starter plan is always active (free)
  if (user.subscriptionPlan === 'Starter') return true;
  
  // For paid plans, check if status is Active
  return user.status === 'Active' && !!user.subscriptionPlan;
}

/**
 * Check if user can access a specific feature based on subscription
 */
export function canAccessFeature(
  user: User | null,
  feature: string
): boolean {
  if (!user) return false;
  
  // Admin always has access
  if (user.role === UserRole.ADMIN) return true;
  
  // Check if user has active subscription
  if (!hasActiveSubscription(user)) {
    return false;
  }
  
  // Feature-specific checks based on subscription plan
  const plan = user.subscriptionPlan || 'Starter';
  
  switch (feature) {
    case 'unlimited_products':
      return plan !== 'Starter';
    
    case 'ai_smartbot':
      return plan === 'Premium' || plan === 'Enterprise';
    
    case 'advanced_analytics':
      return plan === 'Premium' || plan === 'Enterprise';
    
    case 'multi_branch':
      return plan === 'Enterprise';
    
    case 'escrow_wallet':
      return plan === 'Premium' || plan === 'Enterprise';
    
    case 'insurance_integration':
      return plan === 'Enterprise';
    
    case 'instant_payouts':
      return plan === 'Enterprise';
    
    case '2fa_settings':
      return plan === 'Premium' || plan === 'Enterprise';
    
    case 'notifications_settings':
      return plan === 'Premium' || plan === 'Enterprise';
    
    default:
      return true; // Default to allowing access
  }
}

/**
 * Get subscription status message
 */
export function getSubscriptionStatusMessage(user: User | null): string {
  if (!user) return 'Not logged in';
  
  if (user.status === 'Active') {
    return `Active ${user.subscriptionPlan || 'Starter'} subscription`;
  }
  
  if (user.status === 'Pending Payment Verification') {
    return 'Payment pending verification. Access will be granted after admin approval.';
  }
  
  if (user.status === 'Payment Rejected') {
    return 'Payment was rejected. Please contact support or try again.';
  }
  
  return 'Subscription inactive';
}

/**
 * Check if user needs to verify payment
 */
export function needsPaymentVerification(user: User | null): boolean {
  if (!user) return false;
  
  // Starter plan doesn't need verification
  if (user.subscriptionPlan === 'Starter') return false;
  
  // Check if payment is pending
  return user.status === 'Pending Payment Verification';
}

