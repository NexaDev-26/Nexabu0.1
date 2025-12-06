
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { X, Camera, Save, Lock, User as UserIcon, Loader2, Eye, EyeOff, Phone, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { auth, db, isFirebaseEnabled } from '../firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, updateProfile } from 'firebase/auth';

interface ProfileSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    name: user.name || '',
    phone: user.phone || '',
    photoURL: user.photoURL || ''
  });
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync form data with user prop when modal opens/user updates
  useEffect(() => {
    setFormData({
      name: user.name || '',
      phone: user.phone || '',
      photoURL: user.photoURL || ''
    });
  }, [user]);

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
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (isFirebaseEnabled && auth && auth.currentUser && db) {
         const currentUser = auth.currentUser;
         
         // 1. Update Auth Profile (Display Name Only to avoid Base64 limits on photoURL)
         try {
             await updateProfile(currentUser, {
                displayName: formData.name
                // Note: We skip photoURL here because Firebase Auth doesn't support large Base64 strings well.
                // We rely on Firestore for the image storage in this implementation.
             });
         } catch (authErr) {
             console.warn("Auth profile update warning:", authErr);
             // Continue to Firestore update even if Auth update has minor issues
         }

         // 2. Update Firestore Document (Source of Truth)
         const userRef = doc(db, "users", user.uid);
         const updates = {
            name: formData.name,
            phone: formData.phone || null,
            photoURL: formData.photoURL || null
         };
         
         await updateDoc(userRef, updates);

         // 3. Update Local State
         onUpdate({ ...user, ...updates } as User);
         
         setSuccessMsg("Profile updated successfully!");
         
         // Close after a short delay to show success message
         setTimeout(() => {
             onClose();
         }, 1000);
      } else {
         setErrorMsg("Unable to update profile. System is offline or not configured.");
      }
    } catch (error: any) {
      console.error("Profile Update Error:", error);
      setErrorMsg("Failed to update profile: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isFirebaseEnabled && auth && auth.currentUser) {
        const currentUser = auth.currentUser;
        await updatePassword(currentUser, newPassword);
        setSuccessMsg("Password updated successfully!");
        setNewPassword('');
        setConfirmPassword('');
        // Optional: Close on password update too?
        // setTimeout(onClose, 1500); 
      } else {
        setErrorMsg("Password update unavailable. System is offline.");
      }
    } catch (error: any) {
       console.error("Password Update Error:", error);
       if (error.code === 'auth/requires-recent-login') {
         setErrorMsg("Security Check: Please log out and log in again before changing your password.");
       } else {
         setErrorMsg(error.message);
       }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50 dark:bg-neutral-950">
           <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Account Settings</h3>
           <button onClick={onClose} className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-full transition-colors text-neutral-500">
              <X className="w-5 h-5" />
           </button>
        </div>

        <div className="flex border-b border-neutral-200 dark:border-neutral-800">
           <button onClick={() => { setActiveTab('profile'); setErrorMsg(''); setSuccessMsg(''); }} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'profile' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50 dark:bg-orange-900/10' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Profile Details</button>
           <button onClick={() => { setActiveTab('security'); setErrorMsg(''); setSuccessMsg(''); }} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50 dark:bg-orange-900/10' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'}`}>Security & Password</button>
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

           {activeTab === 'profile' ? (
              <div className="space-y-6">
                  <div className="flex flex-col items-center gap-3">
                      <div className="relative group">
                          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-neutral-100 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800">
                              {formData.photoURL ? <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-neutral-400"><UserIcon className="w-10 h-10" /></div>}
                          </div>
                          <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 bg-orange-600 text-white p-2 rounded-full shadow-lg hover:bg-orange-500 transition-colors">
                              <Camera className="w-4 h-4" />
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </div>
                      <p className="text-xs text-neutral-500">Click camera icon to upload</p>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Name</label>
                          <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" placeholder="Enter your name" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email Address</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input type="email" value={user.email} disabled className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-sm cursor-not-allowed outline-none" />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Phone Number</label>
                          <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+255..." className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" />
                          </div>
                      </div>
                  </div>
                  <button onClick={handleSaveProfile} disabled={isLoading} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2 shadow-lg shadow-orange-900/20">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
              </div>
           ) : (
              <div className="space-y-6">
                 {user.role === 'STAFF' ? (
                     <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl text-center">
                         <Lock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                         <h4 className="font-bold text-blue-900 dark:text-blue-200">Managed Account</h4>
                         <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">Your password is managed by your Store Admin. Please contact them to reset your credentials.</p>
                     </div>
                 ) : (
                     <form onSubmit={(e) => { e.preventDefault(); handleUpdatePassword(); }} className="space-y-4">
                         {/* Hidden username field helps password managers associate the password with the account */}
                         <input type="text" name="username" value={user.email} autoComplete="username" className="hidden" readOnly />
                         
                         <div className="p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-800/30">
                             <p className="text-xs text-orange-800 dark:text-orange-300"><span className="font-bold">Note:</span> You will need to log in again after changing your password.</p>
                         </div>
                         <div>
                             <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">New Password</label>
                             <div className="relative">
                                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                 <input name="new-password" type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" placeholder="Min 6 characters" autoComplete="new-password" />
                                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                                     {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                 </button>
                             </div>
                         </div>
                         <div>
                             <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Confirm Password</label>
                             <div className="relative">
                                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                 <input name="confirm-password" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full pl-10 pr-10 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white" autoComplete="new-password" />
                             </div>
                         </div>
                         <button type="submit" disabled={isLoading || !newPassword || !confirmPassword} className="w-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-3 rounded-xl font-bold hover:opacity-90 transition-all flex justify-center items-center gap-2">
                             {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                         </button>
                     </form>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};
