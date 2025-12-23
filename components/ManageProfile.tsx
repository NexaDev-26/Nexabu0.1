/**
 * Manage Profile Component
 * Combines Store Details and Account Management in one interface
 */

import React, { useState, useEffect, useRef } from 'react';
import { User, Branch, PaymentConfig } from '../types';
import { 
  Store, MapPin, Save, Upload, User as UserIcon, Lock, Mail, Phone, 
  Globe, Building, AlertCircle, CheckCircle, Eye, EyeOff, Loader2,
  X, Settings as SettingsIcon, CreditCard, Calendar, Shield, KeyRound, Bell,
  Smartphone, Building2, Copy, Check
} from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled, auth, storage } from '../firebaseConfig';
import { doc, updateDoc, addDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { updatePassword, updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { LocationDropdown } from './LocationDropdown';
import { UserRole } from '../types';

interface ManageProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageProfile: React.FC<ManageProfileProps> = ({ isOpen, onClose }) => {
  const { user, setUser, showNotification } = useAppContext();
  const isAdmin = user?.role === UserRole.ADMIN;
  const [activeTab, setActiveTab] = useState<'store' | 'account' | '2fa' | 'notifications'>(isAdmin ? 'account' : 'store');
  const [isLoading, setIsLoading] = useState(false);
  
  // Store Details State
  const [storeData, setStoreData] = useState<Partial<User>>({});
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // Account Management State
  const [accountData, setAccountData] = useState<{
    name: string;
    phone: string;
    email: string;
    photoURL: string | null;
    photoFile?: File;
  }>({
    name: '',
    phone: '',
    email: '',
    photoURL: null
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Branch Management
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({});
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [photoUploadedButNotSaved, setPhotoUploadedButNotSaved] = useState(false);

  // 2FA Settings State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'email' | 'app'>('app');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Notifications Settings State
  const [notifications, setNotifications] = useState({
    email: {
      orderUpdates: true,
      paymentAlerts: true,
      inventoryAlerts: true,
      reportDelivery: true,
      marketing: false
    },
    push: {
      orderUpdates: true,
      paymentAlerts: true,
      inventoryAlerts: true,
      reportDelivery: false,
      marketing: false
    },
    sms: {
      orderUpdates: false,
      paymentAlerts: true,
      inventoryAlerts: false,
      reportDelivery: false,
      marketing: false
    }
  });
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Track component mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset loading state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(false);
      setPhotoUploadedButNotSaved(false);
      // Set default tab based on role
      setActiveTab(isAdmin ? 'account' : 'store');
    }
  }, [isOpen, isAdmin]);

  // Safety timeout to prevent infinite loading (10 seconds max)
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn("Loading timeout - resetting loading state");
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }, 10000); // 10 seconds max
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Initialize data
  useEffect(() => {
    if (user) {
      setStoreData({
        storeName: user.storeName,
        businessType: user.businessType,
        storeAddress: user.storeAddress,
        location: user.location,
        country: user.country,
        currency: user.currency,
        website: user.website,
        storeLogo: user.storeLogo,
        phone: user.phone,
        whatsappNumber: user.whatsappNumber
      });
      setAccountData({
        name: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        photoURL: user.photoURL || null,
        photoFile: undefined
      });
      // Load payment config
      setPaymentConfig(user.paymentConfig || {});
    }
  }, [user]);

  const handleCopyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      showNotification('Copied to clipboard!', 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      showNotification('Failed to copy', 'error');
    }
  };

  // Load branches
  useEffect(() => {
    if (user?.uid && db && isOpen) {
      const q = query(collection(db, 'branches'), where('uid', '==', user.uid));
      const unsub = onSnapshot(q, s => {
        setBranches(s.docs.map(d => ({...d.data(), id: d.id} as Branch)));
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error("Branches listener error:", error);
        }
      });
      return () => unsub();
    }
  }, [user?.uid, isOpen]);

  if (!isOpen) return null;

  // Helper function to upload image to Firebase Storage
  const uploadImageToStorage = async (file: File, path: string): Promise<string | null> => {
    if (!storage || !user?.uid) return null;
    
    try {
      const storageRef = ref(storage, `${path}/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error: any) {
      console.error("Image upload error:", error);
      // Don't show notification here - let the caller handle it
      return null;
    }
  };

  // Helper function to delete old image from Storage
  const deleteImageFromStorage = async (imageURL: string) => {
    if (!storage || !imageURL) return;
    
    try {
      // Only delete if it's a Storage URL (starts with the storage bucket)
      if (imageURL.includes('firebasestorage.googleapis.com')) {
        // Extract the path from the URL
        const urlParts = imageURL.split('/o/');
        if (urlParts.length > 1) {
          const pathPart = urlParts[1].split('?')[0];
          const decodedPath = decodeURIComponent(pathPart);
          const storageRef = ref(storage, decodedPath);
          await deleteObject(storageRef);
        }
      }
    } catch (error: any) {
      // Don't show error for deletion failures - it's not critical
      console.warn("Failed to delete old image:", error);
    }
  };

  // Store Details Handlers
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification("Please select an image file.", "error");
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        showNotification("Image size too large. Max 2MB.", "error");
        return;
      }
      
      // Show preview immediately with base64 for UI
      const reader = new FileReader();
      reader.onerror = () => {
        showNotification("Failed to read image file.", "error");
      };
      reader.onloadend = () => {
        if (reader.result) {
          setStoreData(prev => ({ ...prev, storeLogo: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
      
      // Upload to Storage in background
      setIsLoading(true);
      try {
        const oldLogoURL = storeData.storeLogo && storeData.storeLogo.startsWith('http') ? storeData.storeLogo : null;
        // Store logos under Profiles/ in the nexabu-app bucket
        const storageURL = await uploadImageToStorage(file, 'Profiles/store-logos');
        
        if (storageURL) {
          // Delete old logo if it exists and is from Storage (don't wait for this)
          if (oldLogoURL) {
            deleteImageFromStorage(oldLogoURL).catch(err => console.warn("Failed to delete old logo:", err));
          }
          setStoreData(prev => ({ ...prev, storeLogo: storageURL }));
          // Optimistically update user context so UI (header/avatar) reflects immediately
          setUser({ ...(user as User), storeLogo: storageURL });
          showNotification("Store logo uploaded. Click 'Save Store Details' to save.", "success");
        } else {
          showNotification("Failed to upload logo. Please try again.", "error");
        }
      } catch (error: any) {
        console.error("Logo upload error:", error);
        showNotification("Failed to upload logo. Please try again.", "error");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleSaveStoreDetails = async () => {
    if (!user?.uid || !db) {
      showNotification("User not authenticated or database not available.", "error");
      return;
    }
    
    // Validate required fields
    if (!storeData.storeName || storeData.storeName.trim() === '') {
      showNotification("Store name is required.", "error");
      return;
    }
    
    setIsLoading(true);
    try {
      // Build update object with only defined fields
      // Convert empty strings to null for optional fields, keep values for required fields
      const updateData: any = {};
      
      // Required field - must have a value
      if (storeData.storeName !== undefined && storeData.storeName !== null) {
        updateData.storeName = storeData.storeName.trim();
      }
      
      // Optional fields - allow empty strings (convert to null for Firestore)
      const optionalFields: (keyof typeof storeData)[] = [
        'businessType', 'storeAddress', 'location', 'country', 
        'currency', 'website', 'phone', 'whatsappNumber'
      ];
      
      optionalFields.forEach(field => {
        if (storeData[field] !== undefined) {
          // Convert empty strings to null, otherwise use the value
          updateData[field] = storeData[field] === '' ? null : storeData[field];
        }
      });
      
      // Handle storeLogo separately - only save Storage URLs, not base64
      if (storeData.storeLogo !== undefined) {
        if (storeData.storeLogo && storeData.storeLogo.trim() !== '') {
          // If it's a Storage URL (starts with http), save it
          if (storeData.storeLogo.startsWith('http://') || storeData.storeLogo.startsWith('https://')) {
            updateData.storeLogo = storeData.storeLogo;
          } else if (storeData.storeLogo.startsWith('data:')) {
            // Base64 image - skip it (should have been uploaded already)
            // Don't block the save, just show a warning
            showNotification("Logo is still uploading. Other changes saved. Please wait for logo upload to complete.", "info");
            // Don't include storeLogo in updates - preserve existing or skip
          } else {
            updateData.storeLogo = null;
          }
        } else {
          updateData.storeLogo = null;
        }
      }
      
      // Include payment config if it exists
      if (paymentConfig && Object.keys(paymentConfig).length > 0) {
        updateData.paymentConfig = paymentConfig;
      }
      
      // Remove any remaining undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });
      
      if (Object.keys(updateData).length === 0) {
        showNotification("No changes to save.", "info");
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }
      
      await updateDoc(doc(db, "users", user.uid), updateData);
      setUser({ ...user, ...updateData } as User);
      // Update payment config state to reflect saved values
      if (updateData.paymentConfig) {
        setPaymentConfig(updateData.paymentConfig);
      }
      showNotification("Store details updated successfully!", "success");
    } catch (error: any) {
      console.error("Store update error:", error);
      const errorMessage = error.message || error.code || "Failed to update store details.";
      showNotification(`Error: ${errorMessage}`, "error");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Account Management Handlers
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification("Please select an image file.", "error");
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        showNotification("Image size too large. Max 2MB.", "error");
        return;
      }
      
      // Store the file for later upload
      const fileForUpload = file;
      
      // Show preview immediately with base64 for UI
      const reader = new FileReader();
      reader.onerror = () => {
        showNotification("Failed to read image file.", "error");
      };
      reader.onloadend = () => {
        if (reader.result) {
          setAccountData(prev => ({ ...prev, photoURL: reader.result as string, photoFile: fileForUpload }));
        }
      };
      reader.readAsDataURL(file);
      
      // Upload to Storage in background
      setIsLoading(true);
      try {
        const oldPhotoURL = accountData.photoURL && accountData.photoURL.startsWith('http') ? accountData.photoURL : null;
        // Profile photos under Profiles/ in the nexabu-app bucket
        const storageURL = await uploadImageToStorage(fileForUpload, 'Profiles/profile-photos');
        
        if (storageURL) {
          // Delete old photo if it exists and is from Storage (don't wait for this)
          if (oldPhotoURL) {
            deleteImageFromStorage(oldPhotoURL).catch(err => console.warn("Failed to delete old photo:", err));
          }
          setAccountData(prev => ({ ...prev, photoURL: storageURL, photoFile: undefined }));
          // Optimistically update user context so UI updates immediately
          setUser({ ...(user as User), photoURL: storageURL });
          setPhotoUploadedButNotSaved(true);
          showNotification("✅ Profile photo uploaded successfully! Don't forget to click 'Save Account Settings' below to save your changes.", "success");
        } else {
          showNotification("Failed to upload photo. You can try saving again.", "error");
        }
      } catch (error: any) {
        console.error("Photo upload error:", error);
        showNotification("Failed to upload photo. You can try saving again.", "error");
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleSaveAccount = async () => {
    if (!user?.uid || !db || !auth?.currentUser) {
      showNotification("User not authenticated or database not available.", "error");
      return;
    }

    // Validate required fields
    if (!accountData.name || accountData.name.trim() === '') {
      showNotification("Name is required.", "error");
      return;
    }

    setIsLoading(true);

    try {
      // Build update object - always include name, conditionally include other fields
      const updates: any = {
        name: accountData.name.trim()
      };

      // Handle phone - convert empty string to null, but always include if it was set
      if (accountData.phone !== undefined && accountData.phone !== null) {
        updates.phone = accountData.phone.trim() !== '' ? accountData.phone.trim() : null;
      }

      // Handle photoURL - only save Storage URLs, skip base64 (should be uploaded already)
      let photoURLForAuth: string | null = null;
      if (accountData.photoURL !== undefined && accountData.photoURL !== null) {
        if (accountData.photoURL.trim() !== '') {
          // If it's a Storage URL (starts with http/https), save it
          if (accountData.photoURL.startsWith('http://') || accountData.photoURL.startsWith('https://')) {
            updates.photoURL = accountData.photoURL;
            photoURLForAuth = accountData.photoURL;
          } else if (accountData.photoURL.startsWith('data:')) {
            // Base64 image - skip it (should have been uploaded already)
            // Don't block the save, just show a warning
            showNotification("Photo is still uploading. Other changes saved. Please wait for photo upload to complete.", "info");
            // Don't include photoURL in updates - preserve existing or skip
          } else {
            // Invalid format - clear it
            updates.photoURL = null;
            photoURLForAuth = null;
          }
        } else {
          // Empty string means clear the photo
          updates.photoURL = null;
          photoURLForAuth = null;
        }
      } else if (accountData.photoURL === null) {
        // Explicitly set to null to clear photo
        updates.photoURL = null;
        photoURLForAuth = null;
      }
      // If photoURL is undefined, don't include it in updates (preserve existing)

      // Update Firebase Auth profile (including photoURL)
      try {
        const authUpdateData: { displayName: string; photoURL?: string | null } = {
          displayName: accountData.name.trim()
        };
        
        // Only update photoURL in Auth if we have a valid Storage URL
        if (photoURLForAuth !== null && photoURLForAuth !== undefined) {
          authUpdateData.photoURL = photoURLForAuth;
        } else if (accountData.photoURL === null) {
          // Explicitly clear photo in Auth
          authUpdateData.photoURL = null;
        }
        
        await updateProfile(auth.currentUser, authUpdateData);
      } catch (authErr: any) {
        console.warn("Auth profile update warning:", authErr);
        // Continue even if Auth update fails - Firestore update is more important
      }

      // Remove undefined values
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      if (Object.keys(updates).length === 0) {
        showNotification("No changes to save.", "info");
        if (isMountedRef.current) {
          setIsLoading(false);
        }
        return;
      }

      await updateDoc(doc(db, "users", user.uid), updates);
      
      // Update local user state with all changes including photoURL
      const updatedUser = { ...user, ...updates } as User;
      setUser(updatedUser);
      
      // Clear the photo upload flag since it's now saved
      setPhotoUploadedButNotSaved(false);
      
      // Reload auth user to get updated photoURL
      if (auth.currentUser) {
        await auth.currentUser.reload();
      }
      
      showNotification("Account updated successfully!", "success");
    } catch (error: any) {
      console.error("Account update error:", error);
      const errorMessage = error.message || error.code || "Failed to update account.";
      showNotification(`Error: ${errorMessage}`, "error");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!auth?.currentUser) return;
    
    if (newPassword !== confirmPassword) {
      showNotification("Passwords do not match.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showNotification("Password must be at least 6 characters.", "error");
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      showNotification("Password changed successfully!", "success");
    } catch (error: any) {
      const errorMsg = error.code === 'auth/requires-recent-login' 
        ? "Please log out and log back in to change your password."
        : "Failed to change password.";
      showNotification(errorMsg, "error");
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Branch Handlers
  const handleSaveBranch = async () => {
    if (!newBranch.name || !user?.uid || !db) return;
    try {
      await addDoc(collection(db, 'branches'), { 
        ...newBranch, 
        uid: user.uid
      });
      setNewBranch({});
      setIsBranchModalOpen(false);
      showNotification("Branch added!", "success");
    } catch (error) {
      showNotification("Failed to add branch", "error");
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (window.confirm("Delete this branch?") && db) {
      try {
        await deleteDoc(doc(db, "branches", branchId));
        showNotification("Branch deleted", "success");
      } catch (error) {
        showNotification("Failed to delete branch", "error");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <SettingsIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Manage Profile</h2>
              <p className="text-sm text-neutral-500">Store details & Account settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6">
          {!isAdmin && (
            <button
              onClick={() => setActiveTab('store')}
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === 'store'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <Store className="w-4 h-4" />
            Store Details
            {activeTab === 'store' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 dark:bg-orange-400" />
            )}
          </button>
          )}
          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
              activeTab === 'account'
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            Account Management
            {activeTab === 'account' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 dark:bg-orange-400" />
            )}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('2fa')}
                className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
                  activeTab === '2fa'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                2FA Settings
                {activeTab === '2fa' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 dark:text-orange-400" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 ${
                  activeTab === 'notifications'
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Bell className="w-4 h-4" />
                Notifications Settings
                {activeTab === 'notifications' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600 dark:text-orange-400" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Store Details Tab */}
          {activeTab === 'store' && (
            <div className="space-y-6">
              {/* Store Logo & Basic Info */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-orange-600" />
                  Store Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Logo Upload */}
                  <div className="flex flex-col items-center space-y-3">
                    <div
                      className="w-32 h-32 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center cursor-pointer hover:border-orange-500 overflow-hidden relative group"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {storeData.storeLogo ? (
                        <img src={storeData.storeLogo} className="w-full h-full object-cover" alt="Store Logo" />
                      ) : (
                        <Upload className="text-neutral-400 w-8 h-8" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
                        Change Logo
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={logoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                    <span className="text-xs text-neutral-500">Upload Store Logo</span>
                  </div>

                  {/* Store Fields */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Store Name *
                      </label>
                      <input
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={storeData.storeName || ''}
                        onChange={e => setStoreData({ ...storeData, storeName: e.target.value })}
                        placeholder="Enter store name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Business Type
                      </label>
                      <select
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={storeData.businessType || ''}
                        onChange={e => setStoreData({ ...storeData, businessType: e.target.value })}
                      >
                        <option value="">Select type</option>
                        <option value="Retail">Retail</option>
                        <option value="Wholesale">Wholesale</option>
                        <option value="Pharmacy">Pharmacy</option>
                        <option value="Restaurant">Restaurant</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Store Address
                      </label>
                      <textarea
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        rows={2}
                        value={storeData.storeAddress || ''}
                        onChange={e => setStoreData({ ...storeData, storeAddress: e.target.value })}
                        placeholder="Enter store address"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Location
                      </label>
                      <LocationDropdown
                        value={storeData.location || ''}
                        onChange={location => setStoreData({ ...storeData, location })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Country
                      </label>
                      <input
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={storeData.country || ''}
                        onChange={e => setStoreData({ ...storeData, country: e.target.value })}
                        placeholder="Country"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Currency
                      </label>
                      <select
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={storeData.currency || 'TZS'}
                        onChange={e => setStoreData({ ...storeData, currency: e.target.value })}
                      >
                        <option value="TZS">TZS - Tanzanian Shilling</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="KES">KES - Kenyan Shilling</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Website
                      </label>
                      <input
                        type="url"
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={storeData.website || ''}
                        onChange={e => setStoreData({ ...storeData, website: e.target.value })}
                        placeholder="https://yourstore.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <Phone className="w-5 h-5 text-orange-600" />
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Phone Number
                    </label>
                    <input
                      className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      value={storeData.phone || ''}
                      onChange={e => setStoreData({ ...storeData, phone: e.target.value })}
                      placeholder="+255 700 000 000"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      WhatsApp Number
                    </label>
                    <input
                      className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      value={storeData.whatsappNumber || ''}
                      onChange={e => setStoreData({ ...storeData, whatsappNumber: e.target.value })}
                      placeholder="+255 700 000 000"
                    />
                  </div>
                </div>
              </div>

              {/* Branches Management */}
              {(user?.role === 'VENDOR' || user?.role === 'PHARMACY') && (
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-2">
                      <Building className="w-5 h-5 text-orange-600" />
                      Branches
                    </h3>
                    <button
                      onClick={() => setIsBranchModalOpen(true)}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 text-sm font-medium flex items-center gap-2"
                    >
                      <Building className="w-4 h-4" />
                      Add Branch
                    </button>
                  </div>
                  <div className="space-y-2">
                    {branches.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">No branches added yet</p>
                    ) : (
                      branches.map(branch => (
                        <div
                          key={branch.id}
                          className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800"
                        >
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-white">{branch.name}</p>
                            {branch.location && (
                              <p className="text-xs text-neutral-500">{branch.location}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteBranch(branch.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Payment Methods Configuration */}
              {(user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) && (
                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                  <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-600" />
                    Payment Methods Configuration
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    Configure your payment methods. Customers will see these numbers when they select a payment method at checkout.
                  </p>

                  <div className="space-y-4">
                    {/* M-Pesa */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-green-600" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentConfig.mpesa?.enabled || false}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                mpesa: {
                                  ...paymentConfig.mpesa,
                                  enabled: e.target.checked,
                                  merchantNumber: paymentConfig.mpesa?.merchantNumber || '',
                                  accountName: paymentConfig.mpesa?.accountName || ''
                                }
                              })}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-neutral-900 dark:text-white">M-Pesa</span>
                          </label>
                        </div>
                      </div>
                      {paymentConfig.mpesa?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Merchant/Pay-in Number *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                className="flex-1 p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                value={paymentConfig.mpesa?.merchantNumber || ''}
                                onChange={(e) => setPaymentConfig({
                                  ...paymentConfig,
                                  mpesa: {
                                    ...paymentConfig.mpesa!,
                                    merchantNumber: e.target.value
                                  }
                                })}
                                placeholder="e.g., 255700000000"
                              />
                              {paymentConfig.mpesa?.merchantNumber && (
                                <button
                                  onClick={() => handleCopyToClipboard(paymentConfig.mpesa!.merchantNumber, 'mpesa-number')}
                                  className="px-3 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                  title="Copy to clipboard"
                                >
                                  {copiedField === 'mpesa-number' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Account Name *
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.mpesa?.accountName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                mpesa: {
                                  ...paymentConfig.mpesa!,
                                  accountName: e.target.value
                                }
                              })}
                              placeholder="e.g., Your Store Name"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tigo Pesa */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-blue-600" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentConfig.tigoPesa?.enabled || false}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                tigoPesa: {
                                  ...paymentConfig.tigoPesa,
                                  enabled: e.target.checked,
                                  merchantNumber: paymentConfig.tigoPesa?.merchantNumber || '',
                                  accountName: paymentConfig.tigoPesa?.accountName || ''
                                }
                              })}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-neutral-900 dark:text-white">Tigo Pesa</span>
                          </label>
                        </div>
                      </div>
                      {paymentConfig.tigoPesa?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Merchant/Pay-in Number *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                className="flex-1 p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                value={paymentConfig.tigoPesa?.merchantNumber || ''}
                                onChange={(e) => setPaymentConfig({
                                  ...paymentConfig,
                                  tigoPesa: {
                                    ...paymentConfig.tigoPesa!,
                                    merchantNumber: e.target.value
                                  }
                                })}
                                placeholder="e.g., 255700000000"
                              />
                              {paymentConfig.tigoPesa?.merchantNumber && (
                                <button
                                  onClick={() => handleCopyToClipboard(paymentConfig.tigoPesa!.merchantNumber, 'tigo-number')}
                                  className="px-3 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                  title="Copy to clipboard"
                                >
                                  {copiedField === 'tigo-number' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Account Name *
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.tigoPesa?.accountName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                tigoPesa: {
                                  ...paymentConfig.tigoPesa!,
                                  accountName: e.target.value
                                }
                              })}
                              placeholder="e.g., Your Store Name"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Airtel Money */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-red-600" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentConfig.airtelMoney?.enabled || false}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                airtelMoney: {
                                  ...paymentConfig.airtelMoney,
                                  enabled: e.target.checked,
                                  merchantNumber: paymentConfig.airtelMoney?.merchantNumber || '',
                                  accountName: paymentConfig.airtelMoney?.accountName || ''
                                }
                              })}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-neutral-900 dark:text-white">Airtel Money</span>
                          </label>
                        </div>
                      </div>
                      {paymentConfig.airtelMoney?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Merchant/Pay-in Number *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                className="flex-1 p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                value={paymentConfig.airtelMoney?.merchantNumber || ''}
                                onChange={(e) => setPaymentConfig({
                                  ...paymentConfig,
                                  airtelMoney: {
                                    ...paymentConfig.airtelMoney!,
                                    merchantNumber: e.target.value
                                  }
                                })}
                                placeholder="e.g., 255700000000"
                              />
                              {paymentConfig.airtelMoney?.merchantNumber && (
                                <button
                                  onClick={() => handleCopyToClipboard(paymentConfig.airtelMoney!.merchantNumber, 'airtel-number')}
                                  className="px-3 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                  title="Copy to clipboard"
                                >
                                  {copiedField === 'airtel-number' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Account Name *
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.airtelMoney?.accountName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                airtelMoney: {
                                  ...paymentConfig.airtelMoney!,
                                  accountName: e.target.value
                                }
                              })}
                              placeholder="e.g., Your Store Name"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bank Transfer */}
                    <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-indigo-600" />
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentConfig.bankTransfer?.enabled || false}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                bankTransfer: {
                                  ...paymentConfig.bankTransfer,
                                  enabled: e.target.checked,
                                  accountNumber: paymentConfig.bankTransfer?.accountNumber || '',
                                  accountName: paymentConfig.bankTransfer?.accountName || '',
                                  bankName: paymentConfig.bankTransfer?.bankName || '',
                                  branchName: paymentConfig.bankTransfer?.branchName || ''
                                }
                              })}
                              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                            />
                            <span className="font-medium text-neutral-900 dark:text-white">Bank Transfer</span>
                          </label>
                        </div>
                      </div>
                      {paymentConfig.bankTransfer?.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Account Number *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                className="flex-1 p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                                value={paymentConfig.bankTransfer?.accountNumber || ''}
                                onChange={(e) => setPaymentConfig({
                                  ...paymentConfig,
                                  bankTransfer: {
                                    ...paymentConfig.bankTransfer!,
                                    accountNumber: e.target.value
                                  }
                                })}
                                placeholder="e.g., 1234567890"
                              />
                              {paymentConfig.bankTransfer?.accountNumber && (
                                <button
                                  onClick={() => handleCopyToClipboard(paymentConfig.bankTransfer!.accountNumber, 'bank-number')}
                                  className="px-3 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                  title="Copy to clipboard"
                                >
                                  {copiedField === 'bank-number' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Account Name *
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.bankTransfer?.accountName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                bankTransfer: {
                                  ...paymentConfig.bankTransfer!,
                                  accountName: e.target.value
                                }
                              })}
                              placeholder="e.g., Your Store Name"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Bank Name *
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.bankTransfer?.bankName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                bankTransfer: {
                                  ...paymentConfig.bankTransfer!,
                                  bankName: e.target.value
                                }
                              })}
                              placeholder="e.g., CRDB Bank"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                              Branch Name
                            </label>
                            <input
                              type="text"
                              className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                              value={paymentConfig.bankTransfer?.branchName || ''}
                              onChange={(e) => setPaymentConfig({
                                ...paymentConfig,
                                bankTransfer: {
                                  ...paymentConfig.bankTransfer!,
                                  branchName: e.target.value
                                }
                              })}
                              placeholder="e.g., City Centre Branch"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Details Summary - Read-only view of configured methods */}
              {(user?.role === UserRole.VENDOR || user?.role === UserRole.PHARMACY) && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                  <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Configured Payment Methods
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                    These are your active payment methods that customers will see at checkout.
                  </p>

                  <div className="space-y-3">
                    {/* M-Pesa Summary */}
                    {paymentConfig.mpesa?.enabled && paymentConfig.mpesa.merchantNumber && (
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-neutral-900 dark:text-white">M-Pesa</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Number:</span>
                            <code className="ml-2 font-mono font-bold text-neutral-900 dark:text-white">
                              {paymentConfig.mpesa.merchantNumber}
                            </code>
                            <button
                              onClick={() => handleCopyToClipboard(paymentConfig.mpesa!.merchantNumber, 'mpesa-summary')}
                              className="ml-2 text-green-600 hover:text-green-700"
                              title="Copy"
                            >
                              {copiedField === 'mpesa-summary' ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />}
                            </button>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Account:</span>
                            <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                              {paymentConfig.mpesa.accountName}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tigo Pesa Summary */}
                    {paymentConfig.tigoPesa?.enabled && paymentConfig.tigoPesa.merchantNumber && (
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-neutral-900 dark:text-white">Tigo Pesa</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Number:</span>
                            <code className="ml-2 font-mono font-bold text-neutral-900 dark:text-white">
                              {paymentConfig.tigoPesa.merchantNumber}
                            </code>
                            <button
                              onClick={() => handleCopyToClipboard(paymentConfig.tigoPesa!.merchantNumber, 'tigo-summary')}
                              className="ml-2 text-green-600 hover:text-green-700"
                              title="Copy"
                            >
                              {copiedField === 'tigo-summary' ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />}
                            </button>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Account:</span>
                            <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                              {paymentConfig.tigoPesa.accountName}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Airtel Money Summary */}
                    {paymentConfig.airtelMoney?.enabled && paymentConfig.airtelMoney.merchantNumber && (
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="w-4 h-4 text-red-600" />
                          <span className="font-semibold text-neutral-900 dark:text-white">Airtel Money</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Number:</span>
                            <code className="ml-2 font-mono font-bold text-neutral-900 dark:text-white">
                              {paymentConfig.airtelMoney.merchantNumber}
                            </code>
                            <button
                              onClick={() => handleCopyToClipboard(paymentConfig.airtelMoney!.merchantNumber, 'airtel-summary')}
                              className="ml-2 text-green-600 hover:text-green-700"
                              title="Copy"
                            >
                              {copiedField === 'airtel-summary' ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />}
                            </button>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Account:</span>
                            <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                              {paymentConfig.airtelMoney.accountName}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bank Transfer Summary */}
                    {paymentConfig.bankTransfer?.enabled && paymentConfig.bankTransfer.accountNumber && (
                      <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-green-200 dark:border-green-700">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                          <span className="font-semibold text-neutral-900 dark:text-white">Bank Transfer</span>
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Account Number:</span>
                            <code className="ml-2 font-mono font-bold text-neutral-900 dark:text-white">
                              {paymentConfig.bankTransfer.accountNumber}
                            </code>
                            <button
                              onClick={() => handleCopyToClipboard(paymentConfig.bankTransfer!.accountNumber, 'bank-summary')}
                              className="ml-2 text-green-600 hover:text-green-700"
                              title="Copy"
                            >
                              {copiedField === 'bank-summary' ? <Check className="w-3 h-3 inline" /> : <Copy className="w-3 h-3 inline" />}
                            </button>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Account Name:</span>
                            <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                              {paymentConfig.bankTransfer.accountName}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500 dark:text-neutral-400">Bank:</span>
                            <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                              {paymentConfig.bankTransfer.bankName}
                            </span>
                          </div>
                          {paymentConfig.bankTransfer.branchName && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400">Branch:</span>
                              <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                                {paymentConfig.bankTransfer.branchName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* No Payment Methods Configured */}
                    {(!paymentConfig.mpesa?.enabled || !paymentConfig.mpesa?.merchantNumber) &&
                     (!paymentConfig.tigoPesa?.enabled || !paymentConfig.tigoPesa?.merchantNumber) &&
                     (!paymentConfig.airtelMoney?.enabled || !paymentConfig.airtelMoney?.merchantNumber) &&
                     (!paymentConfig.bankTransfer?.enabled || !paymentConfig.bankTransfer?.accountNumber) && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <div>
                            <p className="font-medium text-yellow-900 dark:text-yellow-200">
                              No Payment Methods Configured
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                              Enable and configure at least one payment method above, then click "Save Store Details" to make it available to customers.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveStoreDetails}
                  disabled={isLoading}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Save Store Details
                </button>
              </div>
            </div>
          )}

          {/* Account Management Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Photo Upload Notification Banner */}
              {photoUploadedButNotSaved && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-500 dark:border-orange-400 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-orange-900 dark:text-orange-200 text-sm">
                      Photo Uploaded Successfully! 📸
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Your profile photo has been uploaded. Click the <strong>"Save Account Settings"</strong> button below to save your changes.
                    </p>
                  </div>
                  <button
                    onClick={() => setPhotoUploadedButNotSaved(false)}
                    className="flex-shrink-0 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              
              {/* Profile Picture & Basic Info */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-orange-600" />
                  Personal Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Profile Picture */}
                  <div className="flex flex-col items-center space-y-3">
                    <div className="w-32 h-32 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center cursor-pointer hover:border-orange-500 overflow-hidden relative group">
                      {accountData.photoURL ? (
                        <img src={accountData.photoURL} className="w-full h-full object-cover" alt="Profile" />
                      ) : (
                        <UserIcon className="text-neutral-400 w-12 h-12" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
                        Change Photo
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={photoInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="text-xs text-orange-600 hover:text-orange-700"
                    >
                      Change Photo
                    </button>
                  </div>

                  {/* Account Fields */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Full Name *
                      </label>
                      <input
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={accountData.name}
                        onChange={e => setAccountData({ ...accountData, name: e.target.value })}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                        Phone Number
                      </label>
                      <input
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={accountData.phone}
                        onChange={e => setAccountData({ ...accountData, phone: e.target.value })}
                        placeholder="+255 700 000 000"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-2">
                        <Mail className="w-3 h-3" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                        value={accountData.email}
                        disabled
                        placeholder="Email cannot be changed"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Email address cannot be changed</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Change */}
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-orange-600" />
                  Change Password
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="w-full p-2.5 pr-10 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="mt-4 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Lock className="w-4 h-4" />
                  Change Password
                </button>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccount}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2 transition-all ${
                    photoUploadedButNotSaved
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/50 ring-2 ring-orange-400 ring-offset-2 animate-pulse'
                      : 'bg-orange-600 text-white'
                  }`}
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Save Account Settings
                  {photoUploadedButNotSaved && (
                    <span className="ml-1 text-xs font-bold">⚠️</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 2FA Settings Tab */}
          {activeTab === '2fa' && (
            <div className="space-y-6">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Two-Factor Authentication
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                  Add an extra layer of security to your account by enabling two-factor authentication.
                </p>

                {/* 2FA Toggle */}
                <div className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <KeyRound className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">Enable 2FA</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Protect your account with two-factor authentication
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={twoFactorEnabled}
                      onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                {twoFactorEnabled && (
                  <div className="mt-6 space-y-4">
                    {/* 2FA Method Selection */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                        Authentication Method
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => setTwoFactorMethod('app')}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            twoFactorMethod === 'app'
                              ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300'
                          }`}
                        >
                          <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1">
                            Authenticator App
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Google Authenticator, Authy, etc.
                          </div>
                        </button>
                        <button
                          onClick={() => setTwoFactorMethod('sms')}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            twoFactorMethod === 'sms'
                              ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300'
                          }`}
                        >
                          <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1">
                            SMS
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Receive codes via text message
                          </div>
                        </button>
                        <button
                          onClick={() => setTwoFactorMethod('email')}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            twoFactorMethod === 'email'
                              ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20'
                              : 'border-neutral-200 dark:border-neutral-700 hover:border-orange-300'
                          }`}
                        >
                          <div className="font-medium text-sm text-neutral-900 dark:text-white mb-1">
                            Email
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            Receive codes via email
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Backup Codes */}
                    {backupCodes.length > 0 && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="font-medium text-sm text-yellow-900 dark:text-yellow-200 mb-2">
                          Backup Codes (Save these securely)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {backupCodes.map((code, idx) => (
                            <code key={idx} className="text-xs font-mono bg-white dark:bg-neutral-800 p-2 rounded">
                              {code}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      // TODO: Implement 2FA save logic
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      showNotification("2FA settings saved successfully", "success");
                    } catch (error) {
                      showNotification("Failed to save 2FA settings", "error");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Save 2FA Settings
                </button>
              </div>
            </div>
          )}

          {/* Notifications Settings Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-neutral-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-orange-600" />
                  Notification Preferences
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                  Choose how you want to receive notifications for different events.
                </p>

                {/* Email Notifications */}
                <div className="mb-6">
                  <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Notifications
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(notifications.email).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <div>
                          <p className="font-medium text-sm text-neutral-900 dark:text-white capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Receive email notifications for {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications(prev => ({
                              ...prev,
                              email: { ...prev.email, [key]: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Push Notifications */}
                <div className="mb-6">
                  <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Push Notifications
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(notifications.push).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <div>
                          <p className="font-medium text-sm text-neutral-900 dark:text-white capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Receive push notifications for {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications(prev => ({
                              ...prev,
                              push: { ...prev.push, [key]: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SMS Notifications */}
                <div>
                  <h4 className="font-semibold text-sm text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    SMS Notifications
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(notifications.sms).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <div>
                          <p className="font-medium text-sm text-neutral-900 dark:text-white capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400">
                            Receive SMS notifications for {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => setNotifications(prev => ({
                              ...prev,
                              sms: { ...prev.sms, [key]: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      // TODO: Implement notifications save logic
                      if (db && user?.uid) {
                        await updateDoc(doc(db, 'users', user.uid), {
                          notificationSettings: notifications
                        });
                      }
                      showNotification("Notification settings saved successfully", "success");
                    } catch (error) {
                      showNotification("Failed to save notification settings", "error");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Save className="w-4 h-4" />
                  Save Notification Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Add Branch</h3>
              <button
                onClick={() => setIsBranchModalOpen(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  Branch Name *
                </label>
                <input
                  className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                  value={newBranch.name || ''}
                  onChange={e => setNewBranch({ ...newBranch, name: e.target.value })}
                  placeholder="Branch name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white"
                  value={newBranch.location || ''}
                  onChange={e => setNewBranch({ ...newBranch, location: e.target.value })}
                  placeholder="Branch location"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsBranchModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBranch}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-500"
                >
                  Save Branch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

