
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { Lock, Mail, Store, Pill, Users, User, ShieldCheck, ArrowRight, Loader2, AlertCircle, X, Eye, EyeOff, Globe, Check } from 'lucide-react';
import { auth, db, isFirebaseEnabled, googleProvider } from '../firebaseConfig';
import { doc, setDoc, getDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, updatePassword, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

interface AuthProps {
  onLogin: (role: UserRole, userData?: any) => void;
  onBack?: () => void;
  initialView?: 'login' | 'signup';
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onBack, initialView = 'login' }) => {
  const [isLoginView, setIsLoginView] = useState(initialView !== 'signup');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.VENDOR);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeName, setStoreName] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [currentUserForUpdate, setCurrentUserForUpdate] = useState<any>(null);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('nexabu_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleUserFetch = async (uid: string) => {
      try {
        if (!db) throw new Error("Firebase DB is not available.");
        const userRef = doc(db, "users", uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.isDefaultPassword) {
               setCurrentUserForUpdate(userData);
               setIsChangePasswordOpen(true);
               setIsLoading(false);
               return;
          }
          onLogin(userData.role as UserRole, userData);
        } else {
          // AUTO-HEALING: If doc is missing but user is authed, recreate it
          console.warn("User authenticated but missing DB profile. Recreating...");
          
          // Check for Admin UID
          const isSpecificAdmin = uid === 'eNsizZmKaobzDHEJYm3lriYSdUD2';
          
          const newUserData = {
              uid: uid,
              name: auth.currentUser?.displayName || 'Recovered User',
              email: auth.currentUser?.email || '',
              role: isSpecificAdmin ? UserRole.ADMIN : UserRole.VENDOR, // Default fallback
              storeName: isSpecificAdmin ? 'Nexabu Admin' : 'Recovered Store',
              createdAt: new Date().toISOString(),
              status: 'Active'
          };
          
          await setDoc(userRef, newUserData);
          onLogin(newUserData.role as UserRole, newUserData);
        }
      } catch (e) {
        console.warn("Failed to fetch user profile", e);
        setError("Connection to database failed. Please check internet.");
      }
  };

  const handleGoogleLogin = async () => {
    if (!isFirebaseEnabled || !auth) {
        setError("Authentication is currently unavailable. Please check system configuration.");
        return;
    }
    setIsLoading(true);
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user exists in Firestore
        if (db) {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                await handleUserFetch(user.uid);
            } else {
                // FORCE ADMIN Check for Google Login too
                const isSpecificAdmin = user.uid === 'eNsizZmKaobzDHEJYm3lriYSdUD2';
                const finalRole = isSpecificAdmin ? UserRole.ADMIN : selectedRole;
                
                // Create new user document
                const userData = {
                    uid: user.uid,
                    name: user.displayName || 'Google User',
                    email: user.email || '',
                    role: finalRole,
                    storeName: finalRole === UserRole.CUSTOMER ? '' : `${user.displayName}'s Store`,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString(),
                    status: 'Active'
                };
                await setDoc(userRef, userData);
                onLogin(finalRole, userData);
            }
        }
    } catch (e: any) {
        console.error("Google Sign-In Error:", e);
        setError("Failed to sign in with Google.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    if (!auth) return;
    try {
      await sendPasswordResetEmail(auth, email);
      setInfoMessage("Password reset email sent. Check your inbox.");
      setError("");
    } catch (e: any) {
      setError(e.message);
      setInfoMessage("");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setIsLoading(true);
    const normalizedEmail = email.toLowerCase().trim();

    // Handle Remember Me
    if (isLoginView) {
        if (rememberMe) {
            localStorage.setItem('nexabu_remembered_email', normalizedEmail);
        } else {
            localStorage.removeItem('nexabu_remembered_email');
        }
    }

    try {
      if (!isFirebaseEnabled) {
        throw new Error("Authentication service is not connected.");
      }

      if (isLoginView) {
        try {
            if (!auth) throw new Error("Firebase Auth is not available.");
            const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
            if (!userCredential.user?.uid) throw new Error("User ID missing");
            await handleUserFetch(userCredential.user.uid);
        } catch (loginError: any) {
            if (loginError.code === 'auth/user-not-found' || loginError.code === 'auth/invalid-credential') {
                 try {
                     // Check for pending staff invite
                     if (!db) throw loginError;
                     const q = query(collection(db, 'pending_staff'), where('email', '==', normalizedEmail));
                     const snapshot = await getDocs(q);
                     
                     if (!snapshot.empty) {
                        const pendingDoc = snapshot.docs[0];
                        const pendingData = pendingDoc.data();
                        
                        if (pendingData.defaultPassword === password) {
                             if (!auth) throw new Error("Firebase Auth is not available.");
                             const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
                             const uid = userCredential.user.uid;

                             const userData = { 
                                 ...pendingData, 
                                 uid: uid, 
                                 status: 'Active',
                                 isDefaultPassword: true, 
                                 defaultPassword: null 
                             };
                             
                             if (!db) throw new Error("Firebase DB is not available.");
                             await setDoc(doc(db, 'users', uid), userData);
                             try { await deleteDoc(doc(db, 'pending_staff', pendingDoc.id)); } catch(e) { console.warn("Cleanup failed", e); }
                             await handleUserFetch(uid);
                             return; 
                        }
                     }
                 } catch (shadowErr) {}
            }
            throw loginError; 
        }
      } else {
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        if (!auth) throw new Error("Firebase Auth is not available.");
        const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        const user = userCredential.user;

        if (user) {
             try { await updateProfile(user, { displayName: fullName }); } catch (profileErr) {}
             
             let finalRole = selectedRole;
             let finalStoreName = storeName;
             
             // Check for hardcoded Admin Email or UID mismatch (though UID is not known until creation)
             if (normalizedEmail === 'admin@nexabu.com') {
                 finalRole = UserRole.ADMIN;
                 finalStoreName = 'Nexabu HQ';
             } else if (selectedRole === UserRole.CUSTOMER) {
                 finalStoreName = ''; 
             } else {
                 finalStoreName = storeName || `${fullName}'s Store`;
             }
             
             const userData = {
              uid: user.uid, name: fullName, email: normalizedEmail, role: finalRole, storeName: finalStoreName,
              createdAt: new Date().toISOString(), status: 'Active'
            };
    
            if (!db) throw new Error("Firebase DB is not available.");
            await setDoc(doc(db, "users", user.uid), userData);
            onLogin(finalRole, userData);
        }
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Authentication failed.';
      setError(errorMessage.replace('Firebase: ', '').replace('Error ', '').trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
      setIsLoading(true);
      try {
          const user = auth?.currentUser;
          if (user && currentUserForUpdate) {
              await updatePassword(user, newPassword);
              try {
                if (db) await setDoc(doc(db, "users", user.uid), { ...currentUserForUpdate, isDefaultPassword: false }, { merge: true });
              } catch (dbErr) {}
              setIsChangePasswordOpen(false);
              onLogin(currentUserForUpdate.role as UserRole, currentUserForUpdate);
          }
      } catch (e: any) { setError("Failed to update password."); } finally { setIsLoading(false); }
  };

  const roles = [
    { id: UserRole.VENDOR, label: 'Vendor', icon: <Store className="w-5 h-5" /> },
    { id: UserRole.PHARMACY, label: 'Pharmacy', icon: <Pill className="w-5 h-5" /> },
    { id: UserRole.CUSTOMER, label: 'Customer', icon: <User className="w-5 h-5" /> },
  ];
  
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 font-sans">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-orange-600/10 rounded-full mix-blend-screen filter blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-orange-900/10 rounded-full mix-blend-screen filter blur-[100px] translate-x-1/2 translate-y-1/2"></div>
      </div>

      <div className="relative bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-4xl flex overflow-hidden animate-fade-in border border-neutral-200 dark:border-neutral-800">
        <div className="hidden md:flex flex-col justify-between w-1/2 bg-neutral-950 p-12 text-white relative">
          <div className="relative z-10">
            <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-6 shadow-lg shadow-orange-900/50">N</div>
            <h1 className="text-3xl font-display font-bold mb-2">Nexabu</h1>
            <p className="text-neutral-400 text-sm">The All-in-One SaaS for Tanzanian Business.</p>
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 group"><div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg group-hover:border-orange-900 transition-colors"><Store className="w-6 h-6 text-orange-500" /></div><div><h3 className="font-bold">Inventory & Sales</h3><p className="text-xs text-neutral-500">Track stock and manage orders.</p></div></div>
            <div className="flex items-center gap-4 group"><div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg group-hover:border-orange-900 transition-colors"><ShieldCheck className="w-6 h-6 text-orange-500" /></div><div><h3 className="font-bold">AI SmartBot</h3><p className="text-xs text-neutral-500">Automated forecasts & insights.</p></div></div>
          </div>
          <div className="relative z-10 text-xs text-neutral-600 mt-12">© 2024 Nexabu Inc.</div>
        </div>

        <div className="w-full md:w-1/2 p-8 md:p-12 bg-white dark:bg-neutral-900 overflow-y-auto max-h-[90vh] relative">
            {onBack && !isChangePasswordOpen && <button onClick={onBack} className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 z-10" title="Back to Home"><X className="w-6 h-6" /></button>}

            {isChangePasswordOpen ? (
                <div className="space-y-6">
                    <div className="text-center mb-6"><div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-6 h-6 text-orange-600" /></div><h2 className="text-xl font-bold text-neutral-900 dark:text-white">Update Password</h2><p className="text-sm text-neutral-500">Please set a new secure password to continue.</p></div>
                    {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600">{error}</div>}
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        {/* Hidden username field for password manager association */}
                        <input type="text" name="username" value={currentUserForUpdate?.email || ''} autoComplete="username" className="hidden" readOnly />
                        <div className="relative group"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" /><input name="new-password" type={showPassword ? "text" : "password"} placeholder="New Password (min 6 chars)" required autoComplete="new-password" className="w-full pl-10 pr-12 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
                        <button type="submit" disabled={isLoading} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Set Password & Login'}</button>
                    </form>
                </div>
            ) : (
                <>
                    <div className="flex justify-between items-center mb-2"><h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{isLoginView ? 'Welcome Back' : 'Create Account'}</h2></div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">{isLoginView ? 'Sign in to access your dashboard' : 'Join thousands of businesses growing with AI'}</p>
                    
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex flex-col gap-2 text-xs text-red-600 dark:text-red-400 animate-fade-in">
                            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{error}</span></div>
                            {error.includes('already registered') && <button onClick={() => { setIsLoginView(true); setError(''); setSelectedRole(UserRole.VENDOR); }} className="self-start text-xs font-bold underline hover:text-red-800 dark:hover:text-red-200">Switch to Sign In</button>}
                        </div>
                    )}
                    {infoMessage && (
                        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 animate-fade-in">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span>{infoMessage}</span>
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        {!isLoginView && <div className="mb-6"><label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Select Your Role</label><div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">{roles.map(role => <button key={role.id} type="button" onClick={() => setSelectedRole(role.id)} className={`flex items-center p-3 rounded-xl border transition-all ${selectedRole === role.id ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-900 dark:text-orange-100 ring-1 ring-orange-600' : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 hover:border-orange-300 dark:hover:border-orange-800'}`}><div className={`p-2 rounded-lg mr-3 ${selectedRole === role.id ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-100' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>{role.icon}</div><div className="text-left"><div className="font-bold text-sm">{role.label}</div></div><div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedRole === role.id ? 'border-orange-600' : 'border-neutral-300 dark:border-neutral-600'}`}>{selectedRole === role.id && <div className="w-2 h-2 bg-orange-600 rounded-full" />}</div></button>)}</div></div>}
                        {!isLoginView && (
                            <>
                                <div className="relative group"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 group-focus-within:text-orange-500 transition-colors" /><input name="displayName" autoComplete="name" type="text" placeholder="Full Name" required className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none dark:text-white transition-all" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                                {(selectedRole === UserRole.VENDOR || selectedRole === UserRole.PHARMACY) && <div className="relative group"><Store className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 group-focus-within:text-orange-500 transition-colors" /><input name="storeName" autoComplete="organization" type="text" placeholder="Store / Pharmacy Name" required className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none dark:text-white transition-all" value={storeName} onChange={(e) => setStoreName(e.target.value)} /></div>}
                            </>
                        )}
                        <div className="space-y-3">
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
                                <input 
                                    name="email"
                                    type="email" 
                                    placeholder="Email address" 
                                    required 
                                    autoComplete="email"
                                    className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none dark:text-white transition-all" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4 group-focus-within:text-orange-500 transition-colors" />
                                <input 
                                    name="password"
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="Password" 
                                    required 
                                    autoComplete={isLoginView ? "current-password" : "new-password"}
                                    className="w-full pl-10 pr-12 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none dark:text-white transition-all" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 p-1">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password Row */}
                        {isLoginView && (
                            <div className="flex items-center justify-between mt-1">
                                <label className="flex items-center gap-2 cursor-pointer group select-none">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 group-hover:border-orange-500'}`}>
                                        {rememberMe && <Check className="w-3 h-3" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Remember me</span>
                                </label>
                                <button type="button" onClick={handleForgotPassword} className="text-xs text-orange-600 hover:text-orange-500 font-bold transition-colors">Forgot Password?</button>
                            </div>
                        )}

                        <button type="submit" disabled={isLoading} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 shadow-lg shadow-orange-600/20 transition-all flex justify-center items-center gap-2 mt-4">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isLoginView ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4" /></>}</button>
                        
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200 dark:border-neutral-700"></div></div>
                            <div className="relative flex justify-center text-xs"><span className="px-2 bg-white dark:bg-neutral-900 text-neutral-500">Or continue with</span></div>
                        </div>

                        <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 py-3 rounded-xl font-bold hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-all flex justify-center items-center gap-2">
                            <Globe className="w-4 h-4" /> {isLoginView ? 'Sign in with Google' : 'Sign up with Google'}
                        </button>

                        <div className="text-center mt-4">
                            <button type="button" onClick={() => { setIsLoginView(!isLoginView); setError(''); setInfoMessage(''); if(isLoginView) setSelectedRole(UserRole.VENDOR); }} className="text-sm font-medium text-neutral-500 hover:text-orange-600 dark:text-neutral-400 dark:hover:text-orange-400 transition-colors">
                                {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
      </div>
    </div>
  );
};
