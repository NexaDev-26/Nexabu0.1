/**
 * Shop Builder Component
 * One-page shop creation and management
 */

import React, { useState, useEffect } from 'react';
import { Store, Palette, Link, Share2, Copy, Check, QrCode, Eye, Save, X, Upload, Globe, Facebook, Instagram, Twitter, Phone, Mail, MapPin } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { UserRole } from '../types';
import { 
  ShopPage,
  createShopPage, 
  getUserShopPages, 
  updateShopPage, 
  toggleShopPagePublish,
  generateShopQRCode,
  shareToSocialMedia,
  copyShopLink
} from '../services/shopBuilderService';
import { useLoading } from '../hooks/useLoading';
import { ErrorHandler } from '../utils/errorHandler';

export const ShopBuilder: React.FC = () => {
  const { user, products, showNotification } = useAppContext();
  const loading = useLoading();
  const [shopPages, setShopPages] = useState<ShopPage[]>([]);
  const [selectedShop, setSelectedShop] = useState<ShopPage | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit' | 'preview'>('list');
  
  const [shopForm, setShopForm] = useState<Partial<ShopPage>>({
    shopName: user?.storeName || '',
    shopDescription: '',
    theme: 'default',
    primaryColor: '#f97316',
    isPublished: false,
    products: [],
    contactInfo: {},
    socialLinks: {}
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    if (user?.uid) {
      loadShopPages();
    }
  }, [user]);

  const loadShopPages = async () => {
    if (!user?.uid) return;
    
    loading.startLoading();
    try {
      const pages = await getUserShopPages(user.uid);
      setShopPages(pages);
      if (pages.length > 0 && !selectedShop) {
        setSelectedShop(pages[0]);
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, 'Load Shop Pages');
      showNotification(ErrorHandler.formatForUser(appError), 'error');
    } finally {
      loading.stopLoading();
    }
  };

  const handleCreateShop = async () => {
    if (!user?.uid || !shopForm.shopName) {
      showNotification('Shop name is required', 'error');
      return;
    }

    loading.startLoading();
    try {
      const shopId = await createShopPage({
        uid: user.uid,
        shopName: shopForm.shopName,
        shopDescription: shopForm.shopDescription,
        shopLogo: shopForm.shopLogo,
        shopCoverImage: shopForm.shopCoverImage,
        theme: shopForm.theme || 'default',
        primaryColor: shopForm.primaryColor,
        customDomain: shopForm.customDomain,
        isPublished: shopForm.isPublished || false,
        products: shopForm.products || [],
        contactInfo: shopForm.contactInfo || {},
        socialLinks: shopForm.socialLinks || {}
      });

      if (shopId) {
        showNotification('Shop page created successfully', 'success');
        await loadShopPages();
        setViewMode('list');
        setShopForm({
          shopName: user.storeName || '',
          shopDescription: '',
          theme: 'default',
          primaryColor: '#f97316',
          isPublished: false,
          products: [],
          contactInfo: {
            phone: user?.phone || '',
            email: user?.email || '',
            address: user?.location || ''
          },
          socialLinks: {}
        });
        setProductSearch('');
      } else {
        throw new Error('Failed to create shop page');
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, 'Create Shop Page');
      showNotification(ErrorHandler.formatForUser(appError), 'error');
    } finally {
      loading.stopLoading();
    }
  };

  const handleUpdateShop = async () => {
    if (!selectedShop) return;

    loading.startLoading();
    try {
      const success = await updateShopPage(selectedShop.id, shopForm);
      if (success) {
        showNotification('Shop page updated successfully', 'success');
        await loadShopPages();
        setViewMode('list');
      } else {
        throw new Error('Failed to update shop page');
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, 'Update Shop Page');
      showNotification(ErrorHandler.formatForUser(appError), 'error');
    } finally {
      loading.stopLoading();
    }
  };

  const handleTogglePublish = async (shopId: string, currentStatus: boolean) => {
    loading.startLoading();
    try {
      const success = await toggleShopPagePublish(shopId, !currentStatus);
      if (success) {
        showNotification(
          currentStatus ? 'Shop page unpublished' : 'Shop page published',
          'success'
        );
        await loadShopPages();
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      ErrorHandler.logError(appError, 'Toggle Publish');
      showNotification(ErrorHandler.formatForUser(appError), 'error');
    } finally {
      loading.stopLoading();
    }
  };

  const handleCopyLink = async (link: string) => {
    const success = await copyShopLink(link);
    if (success) {
      setCopiedLink(true);
      showNotification('Link copied to clipboard', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      showNotification('Failed to copy link', 'error');
    }
  };

  if (viewMode === 'create' || (viewMode === 'edit' && selectedShop)) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
            {viewMode === 'create' ? 'Create Shop Page' : 'Edit Shop Page'}
          </h2>
          <button
            onClick={() => {
              setViewMode('list');
              setIsEditing(false);
            }}
            className="px-4 py-2 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium mb-2">Shop Name *</label>
            <input
              type="text"
              value={shopForm.shopName || ''}
              onChange={(e) => setShopForm({ ...shopForm, shopName: e.target.value })}
              className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700"
              placeholder="My Awesome Shop"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={shopForm.shopDescription || ''}
              onChange={(e) => setShopForm({ ...shopForm, shopDescription: e.target.value })}
              className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 h-24"
              placeholder="Describe your shop..."
            />
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="grid grid-cols-4 gap-3">
              {['default', 'minimal', 'modern', 'classic'].map((theme) => (
                <button
                  key={theme}
                  onClick={() => setShopForm({ ...shopForm, theme: theme as any })}
                  className={`p-4 border rounded-lg capitalize ${
                    shopForm.theme === theme
                      ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                  }`}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          {/* Products Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Products to Display</label>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white text-sm"
              />
            </div>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
              {products
                .filter(p => {
                  const targetUid = user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY ? user?.uid : user?.employerId;
                  return p.uid === targetUid;
                })
                .filter(p => {
                  return !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
                })
                .map((product) => (
                  <label key={product.id} className="flex items-center gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shopForm.products?.includes(product.id) || false}
                      onChange={(e) => {
                        const currentProducts = shopForm.products || [];
                        if (e.target.checked) {
                          setShopForm({ ...shopForm, products: [...currentProducts, product.id] });
                        } else {
                          setShopForm({ ...shopForm, products: currentProducts.filter(id => id !== product.id) });
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <div className="flex-1 flex items-center gap-2">
                      {product.image && (
                        <img src={product.image} alt={product.name} className="w-8 h-8 rounded object-cover" />
                      )}
                      <div className="flex-1">
                        <span className="text-sm font-medium dark:text-white">{product.name}</span>
                        <span className="text-xs text-neutral-500 ml-2">TZS {product.price?.toLocaleString()}</span>
                      </div>
                    </div>
                  </label>
                ))}
              {products.filter(p => {
                const targetUid = user?.role === 'VENDOR' || user?.role === 'PHARMACY' ? user?.uid : user?.employerId;
                return p.uid === targetUid;
              }).length === 0 && (
                <p className="text-sm text-neutral-500 text-center py-4">No products available. Add products in Inventory first.</p>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <label className="block text-sm font-medium mb-2">Contact Information</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Phone</label>
                <input
                  type="text"
                  placeholder="+255 700 000 000"
                  value={shopForm.contactInfo?.phone || user?.phone || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    contactInfo: { ...shopForm.contactInfo, phone: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="shop@example.com"
                  value={shopForm.contactInfo?.email || user?.email || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    contactInfo: { ...shopForm.contactInfo, email: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">WhatsApp</label>
                <input
                  type="text"
                  placeholder="+255 700 000 000"
                  value={shopForm.contactInfo?.whatsapp || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    contactInfo: { ...shopForm.contactInfo, whatsapp: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Store location"
                  value={shopForm.contactInfo?.address || user?.location || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    contactInfo: { ...shopForm.contactInfo, address: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-sm font-medium mb-2">Social Media Links (Optional)</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1 flex items-center gap-2">
                  <Facebook className="w-4 h-4" /> Facebook
                </label>
                <input
                  type="url"
                  placeholder="https://facebook.com/yourpage"
                  value={shopForm.socialLinks?.facebook || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    socialLinks: { ...shopForm.socialLinks, facebook: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1 flex items-center gap-2">
                  <Instagram className="w-4 h-4" /> Instagram
                </label>
                <input
                  type="url"
                  placeholder="https://instagram.com/yourpage"
                  value={shopForm.socialLinks?.instagram || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    socialLinks: { ...shopForm.socialLinks, instagram: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1 flex items-center gap-2">
                  <Twitter className="w-4 h-4" /> Twitter
                </label>
                <input
                  type="url"
                  placeholder="https://twitter.com/yourpage"
                  value={shopForm.socialLinks?.twitter || ''}
                  onChange={(e) => setShopForm({
                    ...shopForm,
                    socialLinks: { ...shopForm.socialLinks, twitter: e.target.value }
                  })}
                  className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <button
            onClick={viewMode === 'create' ? handleCreateShop : handleUpdateShop}
            disabled={loading.isLoading}
            className="w-full py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-500 disabled:opacity-50"
          >
            {loading.isLoading ? 'Saving...' : viewMode === 'create' ? 'Create Shop Page' : 'Update Shop Page'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Shop Builder</h2>
          <p className="text-sm text-neutral-500">Create and manage your one-page shop</p>
        </div>
        <button
          onClick={() => {
            setShopForm({
              shopName: user?.storeName || '',
              shopDescription: '',
              theme: 'default',
              primaryColor: '#f97316',
              isPublished: false,
              products: [],
              contactInfo: {
                phone: user?.phone || '',
                email: user?.email || '',
                address: user?.location || ''
              },
              socialLinks: {}
            });
            setProductSearch('');
            setViewMode('create');
          }}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 flex items-center gap-2"
        >
          <Store className="w-4 h-4" /> Create New Shop
        </button>
      </div>

      {loading.isLoading && (
        <div className="text-center py-8 text-neutral-500">Loading...</div>
      )}

      {shopPages.length === 0 && !loading.isLoading && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-12 text-center">
          <Store className="w-16 h-16 mx-auto text-neutral-400 mb-4" />
          <h3 className="text-xl font-bold mb-2">No Shop Pages Yet</h3>
          <p className="text-neutral-500 mb-6">Create your first one-page shop to get started</p>
          <button
            onClick={() => setViewMode('create')}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-500"
          >
            Create Shop Page
          </button>
        </div>
      )}

      {shopPages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shopPages.map((shop) => (
            <div
              key={shop.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{shop.shopName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    shop.isPublished
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {shop.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>

              <p className="text-sm text-neutral-500 line-clamp-2">{shop.shopDescription}</p>

              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <Link className="w-4 h-4" />
                <span className="truncate flex-1">{shop.shareableLink}</span>
                <button
                  onClick={() => handleCopyLink(shop.shareableLink)}
                  className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedShop(shop);
                    setShopForm(shop);
                    setViewMode('edit');
                  }}
                  className="flex-1 px-3 py-2 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleTogglePublish(shop.id, shop.isPublished)}
                  className="flex-1 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 text-sm"
                >
                  {shop.isPublished ? 'Unpublish' : 'Publish'}
                </button>
              </div>

              {shop.isPublished && (
                <div className="flex gap-2 pt-2 border-t">
                  <button
                    onClick={() => shareToSocialMedia('whatsapp', shop.shareableLink, shop.shopName)}
                    className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button
                    onClick={() => window.open(shop.shareableLink, '_blank')}
                    className="px-3 py-2 border rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

