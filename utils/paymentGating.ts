/**
 * Payment Method Gating Utility
 * Determines which payment methods are available based on subscription tier
 */

import { PaymentProvider, PaymentFeatures } from '../types';

export type SubscriptionTier = 'Starter' | 'Premium' | 'Enterprise';

/**
 * Get available payment methods for a subscription tier
 */
export function getAvailablePaymentMethods(tier: SubscriptionTier): PaymentProvider[] {
  const baseMethods: PaymentProvider[] = ['MPESA', 'TIGO_PESA', 'AIRTEL_MONEY', 'HALO_PESA', 'CASH'];
  
  switch (tier) {
    case 'Starter':
      // Basic Plan: Only Mobile Money
      return baseMethods;
    
    case 'Premium':
      // Professional Plan: Adds Bank Transfers and Escrow Wallet
      return [...baseMethods, 'BANK_TRANSFER', 'ESCROW_WALLET'];
    
    case 'Enterprise':
      // Enterprise Plan: Adds Insurance Claims
      return [...baseMethods, 'BANK_TRANSFER', 'ESCROW_WALLET', 'NHIF', 'PRIVATE_INSURANCE', 'CREDIT_CARD'];
    
    default:
      return baseMethods;
  }
}

/**
 * Get payment features configuration for a subscription tier
 */
export function getPaymentFeatures(tier: SubscriptionTier): PaymentFeatures {
  switch (tier) {
    case 'Starter':
      return {
        mobileMoney: true,
        bankSettlement: false,
        escrowSecurity: false,
        insurance: false,
        payoutSpeed: '48_HOURS',
        reporting: 'BASIC'
      };
    
    case 'Premium':
      return {
        mobileMoney: true,
        bankSettlement: true,
        escrowSecurity: true,
        insurance: false,
        payoutSpeed: '24_HOURS',
        reporting: 'PDF_RECEIPTS'
      };
    
    case 'Enterprise':
      return {
        mobileMoney: true,
        bankSettlement: true,
        escrowSecurity: true,
        insurance: true,
        payoutSpeed: 'INSTANT',
        reporting: 'ADVANCED_AUDIT'
      };
    
    default:
      return {
        mobileMoney: true,
        bankSettlement: false,
        escrowSecurity: false,
        insurance: false,
        payoutSpeed: '48_HOURS',
        reporting: 'BASIC'
      };
  }
}

/**
 * Check if a specific payment provider is available for a tier
 */
export function isPaymentMethodAvailable(provider: PaymentProvider, tier: SubscriptionTier): boolean {
  const availableMethods = getAvailablePaymentMethods(tier);
  return availableMethods.includes(provider);
}

/**
 * Get payout speed description
 */
export function getPayoutSpeedDescription(speed: PaymentFeatures['payoutSpeed']): string {
  switch (speed) {
    case '48_HOURS':
      return '48 Hours';
    case '24_HOURS':
      return '24 Hours';
    case 'INSTANT':
      return 'Instant';
    default:
      return '48 Hours';
  }
}

/**
 * Get reporting level description
 */
export function getReportingDescription(level: PaymentFeatures['reporting']): string {
  switch (level) {
    case 'BASIC':
      return 'Basic Transaction History';
    case 'PDF_RECEIPTS':
      return 'PDF Receipts & Reports';
    case 'ADVANCED_AUDIT':
      return 'Advanced Financial Audit';
    default:
      return 'Basic Transaction History';
  }
}

