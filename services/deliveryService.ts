/**
 * Delivery Service
 * Enhanced delivery tracking and management
 */

import { DeliveryTask, Order, Driver } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  address: string;
  timestamp: string;
}

export interface DeliveryTracking {
  deliveryId: string;
  orderId: string;
  status: DeliveryTask['status'];
  driverId?: string;
  driverName?: string;
  currentLocation?: DeliveryLocation;
  route: DeliveryLocation[];
  estimatedArrival?: string;
  actualArrival?: string;
  deliveryNotes?: string;
  customerSignature?: string;
  photoProof?: string;
}

/**
 * Create delivery task from order
 */
export async function createDeliveryTask(
  order: Order,
  uid: string
): Promise<string | null> {
  try {
    const deliveryData: Omit<DeliveryTask, 'id'> = {
      orderId: order.id,
      customer: order.customerName,
      address: '', // Should come from customer data
      status: 'Unassigned',
      uid,
      eta: undefined
    };

    const response = await ApiService.createDocument<DeliveryTask>('deliveries', deliveryData);
    
    if (response.success && response.data) {
      return response.data.id;
    }
    
    return null;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Create Delivery Task');
    return null;
  }
}

/**
 * Assign driver to delivery
 */
export async function assignDriver(
  deliveryId: string,
  driverId: string,
  driverName?: string
): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<DeliveryTask>(
      'deliveries',
      deliveryId,
      {
        driver: driverId,
        driverName,
        status: 'In Transit'
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Assign Driver');
    return false;
  }
}

/**
 * Update delivery location (for real-time tracking)
 */
export async function updateDeliveryLocation(
  deliveryId: string,
  location: DeliveryLocation
): Promise<boolean> {
  try {
    // Get existing delivery
    const deliveryResponse = await ApiService.getDocument<DeliveryTask>('deliveries', deliveryId);
    
    if (!deliveryResponse.data) {
      throw new Error('Delivery not found');
    }

    // Get or create tracking document
    const trackingResponse = await ApiService.getDocuments<DeliveryTracking>('delivery_tracking', {
      whereClauses: [{ field: 'deliveryId', operator: '==', value: deliveryId }],
      limitCount: 1
    });

    let tracking: DeliveryTracking;
    
    if (trackingResponse.data && trackingResponse.data.length > 0) {
      tracking = trackingResponse.data[0];
      tracking.currentLocation = location;
      tracking.route.push(location);

      // Update existing tracking
      const updateResponse = await ApiService.updateDocument<DeliveryTracking>(
        'delivery_tracking',
        tracking.id,
        tracking
      );
      return updateResponse.success;
    } else {
      // Create new tracking
      tracking = {
        deliveryId,
        orderId: deliveryResponse.data.orderId,
        status: deliveryResponse.data.status,
        driverId: deliveryResponse.data.driver,
        route: [location],
        currentLocation: location
      };

      const createResponse = await ApiService.createDocument<DeliveryTracking>(
        'delivery_tracking',
        tracking
      );
      return createResponse.success || false;
    }
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Update Delivery Location');
    return false;
  }
}

/**
 * Mark delivery as completed
 */
export async function completeDelivery(
  deliveryId: string,
  notes?: string,
  signature?: string,
  photoProof?: string
): Promise<boolean> {
  try {
    // Update delivery task
    const deliveryUpdate = await ApiService.updateDocument<DeliveryTask>(
      'deliveries',
      deliveryId,
      {
        status: 'Delivered'
      }
    );

    if (!deliveryUpdate.success) {
      return false;
    }

    // Update tracking
    const trackingResponse = await ApiService.getDocuments<DeliveryTracking>('delivery_tracking', {
      whereClauses: [{ field: 'deliveryId', operator: '==', value: deliveryId }],
      limitCount: 1
    });

    if (trackingResponse.data && trackingResponse.data.length > 0) {
      const tracking = trackingResponse.data[0];
      await ApiService.updateDocument<DeliveryTracking>(
        'delivery_tracking',
        tracking.id,
        {
          status: 'Delivered',
          actualArrival: new Date().toISOString(),
          deliveryNotes: notes,
          customerSignature: signature,
          photoProof
        }
      );
    }

    return true;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Complete Delivery');
    return false;
  }
}

/**
 * Get delivery tracking information
 */
export async function getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking | null> {
  try {
    const response = await ApiService.getDocuments<DeliveryTracking>('delivery_tracking', {
      whereClauses: [{ field: 'deliveryId', operator: '==', value: deliveryId }],
      limitCount: 1
    });

    return response.data && response.data.length > 0 ? response.data[0] : null;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Delivery Tracking');
    return null;
  }
}

/**
 * Get active deliveries for a driver
 */
export async function getDriverDeliveries(driverId: string): Promise<DeliveryTask[]> {
  try {
    // Get all deliveries for driver, filter client-side for status
    const response = await ApiService.getDocuments<DeliveryTask>('deliveries', {
      whereClauses: [
        { field: 'driver', operator: '==', value: driverId }
      ]
    });

    if (!response.data) return [];

    // Filter for active statuses client-side
    const activeDeliveries = response.data.filter(
      d => d.status === 'In Transit' || d.status === 'Unassigned'
    );

    // Sort by ETA
    activeDeliveries.sort((a, b) => {
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return a.eta.localeCompare(b.eta);
    });

    return activeDeliveries;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Driver Deliveries');
    return [];
  }
}

/**
 * Calculate estimated time of arrival
 */
export function calculateETA(
  currentLocation: DeliveryLocation,
  destination: DeliveryLocation,
  averageSpeed: number = 30 // km/h
): number {
  // Calculate distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(destination.latitude - currentLocation.latitude);
  const dLon = toRadians(destination.longitude - currentLocation.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(currentLocation.latitude)) *
    Math.cos(toRadians(destination.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  
  // Estimate time in minutes (add 10 minutes buffer for city driving)
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = timeInHours * 60 + 10;
  
  return Math.round(timeInMinutes);
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Update ETA for delivery
 */
export async function updateDeliveryETA(deliveryId: string, etaMinutes: number): Promise<boolean> {
  try {
    const etaDate = new Date();
    etaDate.setMinutes(etaDate.getMinutes() + etaMinutes);
    
    const response = await ApiService.updateDocument<DeliveryTask>(
      'deliveries',
      deliveryId,
      {
        eta: etaDate.toISOString()
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Update Delivery ETA');
    return false;
  }
}

/**
 * Get delivery statistics
 */
export async function getDeliveryStats(uid: string, startDate?: string, endDate?: string): Promise<{
  total: number;
  completed: number;
  inTransit: number;
  unassigned: number;
  averageDeliveryTime: number;
}> {
  try {
    const whereClauses: Array<{ field: string; operator: any; value: any }> = [
      { field: 'uid', operator: '==', value: uid }
    ];

    const response = await ApiService.getDocuments<DeliveryTask>('deliveries', {
      whereClauses
    });

    if (!response.data) {
      return {
        total: 0,
        completed: 0,
        inTransit: 0,
        unassigned: 0,
        averageDeliveryTime: 0
      };
    }

    let deliveries = response.data;

    // Filter by date range if provided
    if (startDate || endDate) {
      deliveries = deliveries.filter(d => {
        // Assuming deliveries have a created date or status change date
        // This would need to be adjusted based on actual data structure
        return true; // Placeholder
      });
    }

    const completed = deliveries.filter(d => d.status === 'Delivered').length;
    const inTransit = deliveries.filter(d => d.status === 'In Transit').length;
    const unassigned = deliveries.filter(d => d.status === 'Unassigned').length;

    // Calculate average delivery time (would need to track start/end times)
    const averageDeliveryTime = 0; // Placeholder

    return {
      total: deliveries.length,
      completed,
      inTransit,
      unassigned,
      averageDeliveryTime
    };
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Delivery Stats');
    return {
      total: 0,
      completed: 0,
      inTransit: 0,
      unassigned: 0,
      averageDeliveryTime: 0
    };
  }
}

