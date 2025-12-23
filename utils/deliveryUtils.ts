/**
 * Delivery Utilities
 * OTP generation and escrow release logic
 */

/**
 * Generate a random 4-digit delivery OTP
 */
export function generateDeliveryOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Calculate escrow release amounts
 * @param totalAmount Total order amount
 * @param commissionRate Commission rate (default 5% = 0.05)
 * @returns Object with vendor amount and commission
 */
export function calculateEscrowRelease(
  totalAmount: number,
  commissionRate: number = 0.05
): { vendorAmount: number; commission: number } {
  const commission = totalAmount * commissionRate;
  const vendorAmount = totalAmount - commission;
  
  return {
    vendorAmount: Math.round(vendorAmount * 100) / 100, // Round to 2 decimals
    commission: Math.round(commission * 100) / 100
  };
}

/**
 * Validate delivery OTP format
 */
export function isValidOtp(otp: string): boolean {
  return /^\d{4}$/.test(otp);
}

