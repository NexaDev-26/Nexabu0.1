/**
 * Delivery Fee Calculator
 * Calculates delivery fees based on delivery type and distance
 */

export interface DeliveryFeeConfig {
  selfPickupFee: number; // Usually 0
  homeDeliveryFlatFee: number; // Flat fee for home delivery
  homeDeliveryPerKm?: number; // Per kilometer charge (optional)
  maxDeliveryFee?: number; // Maximum delivery fee cap
}

const DEFAULT_CONFIG: DeliveryFeeConfig = {
  selfPickupFee: 0,
  homeDeliveryFlatFee: 5000, // 5,000 TZS default
  homeDeliveryPerKm: 500, // 500 TZS per km
  maxDeliveryFee: 15000 // Max 15,000 TZS
};

/**
 * Calculate delivery fee based on type and distance
 */
export function calculateDeliveryFee(
  deliveryType: 'self-pickup' | 'home-delivery',
  distanceKm?: number,
  config: DeliveryFeeConfig = DEFAULT_CONFIG
): number {
  if (deliveryType === 'self-pickup') {
    return config.selfPickupFee;
  }

  if (deliveryType === 'home-delivery') {
    let fee = config.homeDeliveryFlatFee;

    // Add distance-based fee if distance is provided
    if (distanceKm && config.homeDeliveryPerKm) {
      fee += distanceKm * config.homeDeliveryPerKm;
    }

    // Apply maximum cap if configured
    if (config.maxDeliveryFee && fee > config.maxDeliveryFee) {
      fee = config.maxDeliveryFee;
    }

    return fee;
  }

  return 0;
}

/**
 * Get delivery fee description
 */
export function getDeliveryFeeDescription(
  deliveryType: 'self-pickup' | 'home-delivery',
  fee: number
): string {
  if (deliveryType === 'self-pickup') {
    return 'Free (Self-Pickup)';
  }
  return `TZS ${fee.toLocaleString()} (Home Delivery)`;
}

