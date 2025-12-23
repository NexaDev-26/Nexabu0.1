import React, { useState, useRef, useEffect } from 'react';
import { Customer, UserNotificationSettings, TwoFactorAuth } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { X, Camera, Save, User, MapPin, Phone, Mail, AlertCircle, CheckCircle, Loader2, Bell, Shield, Lock, Eye, EyeOff, ChevronRight, MessageCircle } from 'lucide-react';
import { db, isFirebaseEnabled, auth } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, query, where, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { LocationDropdown } from './LocationDropdown';

interface CustomerProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerProfileSettings: React.FC<CustomerProfileSettingsProps> = ({ isOpen, onClose }) => {
  const { user, showNotification } = useAppContext();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Profile data
  const [formData, setFormData] = useState<Partial<Customer>>({
    fullName: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    city: '',
    district: '',
    ward: '',
    street: '',
    residentAddress: '',
    occupation: '',
    type: 'Customer',
    status: 'Active',
    openingBalance: 0
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<UserNotificationSettings>({
    uid: user?.uid || '',
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
    orderUpdates: true,
    promotions: true,
    securityAlerts: true
  });

  // 2FA settings
  const [twoFactorAuth, setTwoFactorAuth] = useState<TwoFactorAuth>({
    uid: user?.uid || '',
    enabled: false,
    method: null,
    verified: false
  });
  const [verificationStep, setVerificationStep] = useState<'choose' | 'verify'>('choose');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);

  // Password reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Load settings on open
  useEffect(() => {
    if (isOpen && user?.uid) {
      setFormData({
        fullName: user.name || '',
        phone: user.phone || '',
        email: user.email || '',
        city: '',
        district: '',
        ward: '',
        street: '',
        residentAddress: '',
        occupation: '',
        type: 'Customer',
        status: 'Active',
        openingBalance: 0
      });

      // Load notification settings
      const loadNotificationSettings = async () => {
        if (db) {
          try {
            const settingsDoc = await getDoc(doc(db, 'user_notification_settings', user.uid));
            if (settingsDoc.exists()) {
              setNotificationSettings(settingsDoc.data() as UserNotificationSettings);
            }
          } catch (error) {
            console.error('Error loading notification settings:', error);
          }
        }
      };

      // Load 2FA settings
      const load2FASettings = async () => {
        if (db) {
          try {
            const twoFADoc = await getDoc(doc(db, 'two_factor_auth', user.uid));
            if (twoFADoc.exists()) {
              setTwoFactorAuth(twoFADoc.data() as TwoFactorAuth);
            }
          } catch (error) {
            console.error('Error loading 2FA settings:', error);
          }
        }
      };

      loadNotificationSettings();
      load2FASettings();
    }
  }, [isOpen, user]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg("Image size too large. Max 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.phone) {
      setErrorMsg("Name and Phone are required.");
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isFirebaseEnabled && db && user) {
        // Check if customer profile already exists for this user
        const customerQuery = query(
          collection(db, 'customers'),
          where('phone', '==', formData.phone)
        );
        const existingDocs = await getDocs(customerQuery);
        
        const customerData: Partial<Customer> = {
          ...formData,
          uid: user.uid, // Store customer's own UID for reference
          dateAdded: new Date().toISOString(),
          status: formData.status || 'Active',
          openingBalance: Number(formData.openingBalance) || 0,
          type: formData.type || 'Customer'
        };

        if (existingDocs.empty) {
          // Create new customer profile
          await addDoc(collection(db, 'customers'), customerData);
          setSuccessMsg("Profile saved successfully!");
        } else {
          // Update existing profile
          const existingDoc = existingDocs.docs[0];
          await updateDoc(doc(db, 'customers', existingDoc.id), customerData);
          setSuccessMsg("Profile updated successfully!");
        }

        showNotification("Customer profile saved successfully", "success");
        
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg("Unable to save profile. System is offline or not configured.");
      }
    } catch (error: any) {
      console.error("Profile Save Error:", error);
      setErrorMsg("Failed to save profile: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Save notification settings
  const handleSaveNotifications = async () => {
    if (!user?.uid || !db) return;
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await setDoc(doc(db, 'user_notification_settings', user.uid), {
        ...notificationSettings,
        uid: user.uid
      }, { merge: true });
      setSuccessMsg('Notification settings saved successfully!');
      showNotification('Notification settings updated', 'success');
    } catch (error: any) {
      setErrorMsg('Failed to save notification settings: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle password reset
  const handlePasswordReset = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setIsResettingPassword(true);
    try {
      if (auth?.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setSuccessMsg('Password updated successfully!');
        setNewPassword('');
        setConfirmPassword('');
        showNotification('Password changed successfully', 'success');
      } else {
        setErrorMsg('Please log in to change your password.');
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setErrorMsg('Security check: Please log out and log back in before changing your password.');
      } else {
        setErrorMsg('Failed to update password: ' + error.message);
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Initiate 2FA setup
  const handleInitiate2FA = async (method: 'email' | 'phone') => {
    if (!user?.uid || !db) return;
    
    setIsVerifying(true);
    setErrorMsg('');

    try {
      // In a real implementation, this would send a verification code
      // For now, we'll simulate it
      const new2FA: TwoFactorAuth = {
        uid: user.uid,
        enabled: false,
        method,
        phoneNumber: method === 'phone' ? user.phone : undefined,
        emailAddress: method === 'email' ? user.email : undefined,
        verified: false
      };

      await setDoc(doc(db, 'two_factor_auth', user.uid), new2FA, { merge: true });
      setTwoFactorAuth(new2FA);
      setVerificationStep('verify');
      setResendTimer(60); // 60 second timer
      setSuccessMsg(`Verification code sent to your ${method}`);
    } catch (error: any) {
      setErrorMsg('Failed to initiate 2FA: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Verify 2FA code
  const handleVerify2FA = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // In a real implementation, verify the code with your backend
      // For now, we'll accept any 6-digit code as valid
      const updated2FA: TwoFactorAuth = {
        ...twoFactorAuth,
        enabled: true,
        verified: true
      };

      if (db && user?.uid) {
        await setDoc(doc(db, 'two_factor_auth', user.uid), updated2FA, { merge: true });
        setTwoFactorAuth(updated2FA);
        setVerificationStep('choose');
        setVerificationCode(['', '', '', '', '', '']);
        setSuccessMsg('2FA enabled successfully!');
        showNotification('Two-factor authentication enabled', 'success');
      }
    } catch (error: any) {
      setErrorMsg('Verification failed: ' + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (!user?.uid || !db) return;
    
    if (!confirm('Are you sure you want to disable two-factor authentication?')) {
      return;
    }

    try {
      const disabled2FA: TwoFactorAuth = {
        uid: user.uid,
        enabled: false,
        method: null,
        verified: false
      };
      await setDoc(doc(db, 'two_factor_auth', user.uid), disabled2FA, { merge: true });
      setTwoFactorAuth(disabled2FA);
      setSuccessMsg('2FA disabled successfully.');
      showNotification('Two-factor authentication disabled', 'success');
    } catch (error: any) {
      setErrorMsg('Failed to disable 2FA: ' + error.message);
    }
  };

  // Handle verification code input
  const handleCodeInput = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  // Handle code paste
  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newCode = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setVerificationCode(newCode);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Account Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => { setActiveTab('profile'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'text-orange-600 border-orange-600 bg-orange-50/50 dark:bg-orange-900/10'
                : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => { setActiveTab('notifications'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'notifications'
                ? 'text-orange-600 border-orange-600 bg-orange-50/50 dark:bg-orange-900/10'
                : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </div>
          </button>
          <button
            onClick={() => { setActiveTab('security'); setErrorMsg(''); setSuccessMsg(''); }}
            className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'text-orange-600 border-orange-600 bg-orange-50/50 dark:bg-orange-900/10'
                : 'text-neutral-500 border-transparent hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </div>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> {successMsg}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Col: Photo & Basics */}
            <div className="space-y-6">
              <div className="flex flex-col items-center">
                <div className="w-32 h-32 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mb-4 border-4 border-white dark:border-neutral-700 shadow-lg relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  {formData.photo ? <img src={formData.photo} className="w-full h-full object-cover" alt="Profile" /> : <User className="w-12 h-12 text-neutral-300 m-auto mt-8" />}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                <p className="text-xs text-neutral-500 text-center">Click to upload photo</p>
              </div>
            </div>

            {/* Middle & Right Col: Details */}
            <div className="md:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Full Name *</label>
                  <input 
                    type="text" 
                    value={formData.fullName || ''} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" 
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Phone Number *</label>
                  <input 
                    type="text" 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" 
                    placeholder="+255..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={formData.email || ''} 
                    onChange={e => setFormData({...formData, email: e.target.value})} 
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" 
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">Occupation</label>
                  <input 
                    type="text" 
                    value={formData.occupation || ''} 
                    onChange={e => setFormData({...formData, occupation: e.target.value})} 
                    className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" 
                    placeholder="Your occupation"
                  />
                </div>
              </div>

              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-100 dark:border-neutral-800">
                <h4 className="text-sm font-bold mb-3 text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <MapPin className="w-4 h-4"/> Location Details
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">City / Region</label>
                    <LocationDropdown
                      value={formData.city || ''}
                      onChange={(value) => setFormData({...formData, city: value})}
                      placeholder="Select Region"
                      showFullLocation={false}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">District</label>
                    <LocationDropdown
                      value={formData.district || ''}
                      onChange={(value) => setFormData({...formData, district: value})}
                      placeholder="Select District"
                      showFullLocation={true}
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Ward" 
                    value={formData.ward || ''} 
                    onChange={e => setFormData({...formData, ward: e.target.value})} 
                    className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" 
                  />
                  <input 
                    type="text" 
                    placeholder="Street / Village" 
                    value={formData.street || ''} 
                    onChange={e => setFormData({...formData, street: e.target.value})} 
                    className="p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" 
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Full Residential Address / Landmarks" 
                  value={formData.residentAddress || ''} 
                  onChange={e => setFormData({...formData, residentAddress: e.target.value})} 
                  className="w-full p-2 border rounded text-sm dark:bg-neutral-900 dark:border-neutral-700 dark:text-white" 
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={onClose} 
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave} 
                  disabled={isLoading}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Profile</>}
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Notification Preferences</h4>
                <p className="text-sm text-neutral-500">Choose how you want to receive notifications</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">Email Notifications</p>
                      <p className="text-xs text-neutral-500">Receive notifications via email</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.emailNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">SMS Notifications</p>
                      <p className="text-xs text-neutral-500">Receive notifications via SMS</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.smsNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, smsNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-white">WhatsApp Notifications</p>
                      <p className="text-xs text-neutral-500">Receive notifications via WhatsApp</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notificationSettings.whatsappNotifications}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappNotifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
                  <h5 className="font-medium text-neutral-900 dark:text-white mb-4">Notification Types</h5>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Order Updates</p>
                        <p className="text-xs text-neutral-500">Get notified about your order status</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.orderUpdates}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, orderUpdates: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Promotions & Offers</p>
                        <p className="text-xs text-neutral-500">Receive special offers and discounts</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.promotions}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, promotions: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Security Alerts</p>
                        <p className="text-xs text-neutral-500">Important security notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.securityAlerts}
                          onChange={(e) => setNotificationSettings({ ...notificationSettings, securityAlerts: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-orange-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNotifications}
                  disabled={isLoading}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-500 font-bold shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Settings</>}
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Security Settings</h4>
                <p className="text-sm text-neutral-500">Manage your password and two-factor authentication</p>
              </div>

              {/* Password Reset Section */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <h5 className="font-medium text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Change Password
                </h5>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-2.5 pr-10 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                        placeholder="Enter new password"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 mb-1">Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2.5 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <button
                    onClick={handlePasswordReset}
                    disabled={isResettingPassword || !newPassword || !confirmPassword}
                    className="w-full py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isResettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Update Password</>}
                  </button>
                </div>
              </div>

              {/* 2FA Section */}
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="font-medium text-neutral-900 dark:text-white flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Two-Factor Authentication
                    </h5>
                    <p className="text-xs text-neutral-500 mt-1">Add an extra layer of security to your account</p>
                  </div>
                  {twoFactorAuth.enabled && (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                      Enabled
                    </span>
                  )}
                </div>

                {!twoFactorAuth.enabled ? (
                  verificationStep === 'choose' ? (
                    <div className="space-y-3">
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">Choose how you'd like to verify your profile</p>
                      <button
                        onClick={() => handleInitiate2FA('email')}
                        disabled={isVerifying}
                        className="w-full p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-orange-500 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                            <Mail className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-neutral-900 dark:text-white">Email</p>
                            <p className="text-xs text-neutral-500">We'll send a verification code to your email address.</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-orange-600" />
                      </button>
                      <button
                        onClick={() => handleInitiate2FA('phone')}
                        disabled={isVerifying}
                        className="w-full p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl hover:border-orange-500 transition-all flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                            <Phone className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-neutral-900 dark:text-white">Phone</p>
                            <p className="text-xs text-neutral-500">We'll send an SMS with a verification to your phone.</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:text-orange-600" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                          Enter the 6-digit verification code sent to {twoFactorAuth.method === 'email' ? twoFactorAuth.emailAddress : (twoFactorAuth.phoneNumber ? `+${twoFactorAuth.phoneNumber.slice(0, -4)}****${twoFactorAuth.phoneNumber.slice(-4)}` : 'your phone')}
                        </p>
                        <div className="flex gap-2 justify-center" onPaste={handleCodePaste}>
                          {verificationCode.map((digit, index) => (
                            <input
                              key={index}
                              id={`code-${index}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleCodeInput(index, e.target.value.replace(/\D/g, ''))}
                              className="w-12 h-12 text-center text-lg font-mono border-2 border-neutral-300 dark:border-neutral-600 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none bg-white dark:bg-neutral-900 dark:text-white"
                            />
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={handleVerify2FA}
                        disabled={isVerifying || verificationCode.join('').length !== 6}
                        className="w-full py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                      </button>
                      {resendTimer > 0 ? (
                        <p className="text-xs text-center text-neutral-500">Resend code in {String(Math.floor(resendTimer / 60)).padStart(2, '0')}:{String(resendTimer % 60).padStart(2, '0')}</p>
                      ) : (
                        <button
                          onClick={() => twoFactorAuth.method && handleInitiate2FA(twoFactorAuth.method)}
                          className="w-full text-xs text-orange-600 hover:text-orange-700 dark:hover:text-orange-500"
                        >
                          Resend code
                        </button>
                      )}
                      <button
                        onClick={() => { setVerificationStep('choose'); setVerificationCode(['', '', '', '', '', '']); }}
                        className="w-full text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                      >
                        Back
                      </button>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Two-factor authentication is enabled via {twoFactorAuth.method === 'email' ? 'Email' : 'Phone'}
                      </p>
                    </div>
                    <button
                      onClick={handleDisable2FA}
                      className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 font-medium"
                    >
                      Disable 2FA
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

