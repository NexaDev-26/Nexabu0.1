/**
 * Shop Builder Service
 * Handles one-page shop creation, sharing, and management
 */

import { Product, User } from '../types';
import { ApiService } from './apiService';
import { ErrorHandler } from '../utils/errorHandler';

export interface ShopPage {
  id: string;
  uid: string;
  shopName: string;
  shopDescription?: string;
  shopLogo?: string;
  shopCoverImage?: string;
  theme: 'default' | 'minimal' | 'modern' | 'classic';
  primaryColor?: string;
  customDomain?: string;
  shareableLink: string;
  isPublished: boolean;
  products: string[]; // Product IDs
  contactInfo: {
    phone?: string;
    email?: string;
    address?: string;
    whatsapp?: string;
  };
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Generate unique shareable link
 */
export function generateShareableLink(shopId: string, customDomain?: string): string {
  if (customDomain) {
    return `https://${customDomain}`;
  }
  // In production, this would use your actual domain
  return `${window.location.origin}/shop/${shopId}`;
}

/**
 * Create a new shop page
 */
export async function createShopPage(
  shopData: Omit<ShopPage, 'id' | 'shareableLink' | 'createdAt' | 'updatedAt'>
): Promise<string | null> {
  try {
    const shopId = `shop_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const shareableLink = generateShareableLink(shopId, shopData.customDomain);

    const shopPage: Omit<ShopPage, 'id'> = {
      ...shopData,
      shareableLink,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const response = await ApiService.createDocument<ShopPage>('shop_pages', shopPage);
    
    if (response.success && response.data) {
      return response.data.id;
    }
    
    return null;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Create Shop Page');
    return null;
  }
}

/**
 * Get shop page by ID or shareable link
 */
export async function getShopPage(shopIdOrLink: string): Promise<ShopPage | null> {
  try {
    // Try by ID first
    const byIdResponse = await ApiService.getDocument<ShopPage>('shop_pages', shopIdOrLink);
    if (byIdResponse.success && byIdResponse.data) {
      return byIdResponse.data;
    }

    // Try by shareable link
    const byLinkResponse = await ApiService.getDocuments<ShopPage>('shop_pages', {
      whereClauses: [{ field: 'shareableLink', operator: '==', value: shopIdOrLink }],
      limitCount: 1
    });

    if (byLinkResponse.success && byLinkResponse.data && byLinkResponse.data.length > 0) {
      return byLinkResponse.data[0];
    }

    return null;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get Shop Page');
    return null;
  }
}

/**
 * Get all shop pages for a user
 */
export async function getUserShopPages(uid: string): Promise<ShopPage[]> {
  try {
    const response = await ApiService.getDocuments<ShopPage>('shop_pages', {
      whereClauses: [{ field: 'uid', operator: '==', value: uid }],
      orderByClause: { field: 'updatedAt', direction: 'desc' }
    });

    return response.data || [];
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Get User Shop Pages');
    return [];
  }
}

/**
 * Update shop page
 */
export async function updateShopPage(
  shopId: string,
  updates: Partial<ShopPage>
): Promise<boolean> {
  try {
    const response = await ApiService.updateDocument<ShopPage>(
      'shop_pages',
      shopId,
      {
        ...updates,
        updatedAt: new Date().toISOString()
      }
    );

    return response.success;
  } catch (error: any) {
    const appError = ErrorHandler.handleApiError(error);
    ErrorHandler.logError(appError, 'Update Shop Page');
    return false;
  }
}

/**
 * Publish/unpublish shop page
 */
export async function toggleShopPagePublish(shopId: string, isPublished: boolean): Promise<boolean> {
  return await updateShopPage(shopId, { isPublished });
}

/**
 * Generate QR code for shop page
 */
export function generateShopQRCode(shareableLink: string): string {
  // In production, use a QR code library like qrcode
  // For now, return a placeholder
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareableLink)}`;
}

/**
 * Share shop page to social media
 */
export function shareToSocialMedia(platform: 'facebook' | 'twitter' | 'whatsapp', shareableLink: string, shopName: string): void {
  const message = `Check out ${shopName}: ${shareableLink}`;
  
  const urls: { [key: string]: string } = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableLink)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareableLink)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`
  };

  window.open(urls[platform], '_blank', 'width=600,height=400');
}

/**
 * Copy shop link to clipboard
 */
export async function copyShopLink(shareableLink: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(shareableLink);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareableLink;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

