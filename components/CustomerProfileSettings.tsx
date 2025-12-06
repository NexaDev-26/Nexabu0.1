import React, { useState, useRef, useEffect } from 'react';
import { Customer } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { X, Camera, Save, User, MapPin, Phone, Mail, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { LocationDropdown } from './LocationDropdown';

interface CustomerProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerProfileSettings: React.FC<CustomerProfileSettingsProps> = ({ isOpen, onClose }) => {
  const { user, showNotification } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  useEffect(() => {
    if (isOpen && user) {
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
    }
  }, [isOpen, user]);

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Customer Profile Settings</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
            <X className="w-5 h-5" />
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
        </div>
      </div>
    </div>
  );
};

