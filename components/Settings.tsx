
import React, { useState, useEffect, useRef } from 'react';
import { Store, MapPin, Save, Crosshair, Loader2, Plus, Trash2, Database, AlertTriangle, Phone, Mail, Globe, Flag, Building, CheckCircle, Upload } from 'lucide-react';
import { Branch, User } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { doc, updateDoc, addDoc, deleteDoc, collection, query, where, onSnapshot } from 'firebase/firestore';

export const Settings: React.FC = () => {
  const { user, setUser, showNotification, seedDatabase } = useAppContext();
  
  // Store Profile State
  const [profile, setProfile] = useState<Partial<User>>({});
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Branch State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({ status: 'Active' });
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  useEffect(() => {
    if(user) { setProfile(user); }
    if(user?.uid && db) {
        const q = query(collection(db, 'branches'), where('uid', '==', user.uid));
        const unsub = onSnapshot(q, s => setBranches(s.docs.map(d => ({...d.data(), id: d.id} as Branch))), (error) => {
             if (error.code !== 'permission-denied') {
                console.error("Branches listener error:", error);
            }
        });
        return () => unsub();
    }
  }, [user]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!user?.uid || !db) return;
    setIsSaving(true);
    try {
        await updateDoc(doc(db, "users", user.uid), profile);
        setUser({ ...user, ...profile } as User);
        showNotification("Store Profile updated!", "success");
    } catch (e: any) { showNotification("Update failed.", "error"); } finally { setIsSaving(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setProfile(p => ({ ...p, storeLogo: reader.result as string }));
          reader.readAsDataURL(file);
      }
  };
  
  const handleSaveBranch = async () => {
    if(!newBranch.name || !user?.uid) return;
    try {
      await addDoc(collection(db, 'branches'), { ...newBranch, uid: user.uid, status: newBranch.status || 'Active' });
      setNewBranch({ status: 'Active' });
      setIsBranchModalOpen(false);
      showNotification("Branch added!", "success");
    } catch (e) { showNotification("Failed to add branch", "error"); }
  };

  const handleDeleteBranch = async (branchId: string) => {
    if(window.confirm("Delete this branch?") && db) {
      await deleteDoc(doc(db, "branches", branchId));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto pb-10">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Store Settings</h2>
      
      {/* STORE INFORMATION */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6">
        <h3 className="font-bold text-lg mb-6 text-neutral-900 dark:text-white flex items-center gap-2"><Store className="w-5 h-5 text-orange-600"/> Store Information</h3>
        <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Logo Section */}
          <div className="flex flex-col items-center space-y-3">
              <div 
                className="w-32 h-32 rounded-xl bg-neutral-100 dark:bg-neutral-800 border-2 border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center cursor-pointer hover:border-orange-500 overflow-hidden relative group"
                onClick={() => logoInputRef.current?.click()}
              >
                  {profile.storeLogo ? <img src={profile.storeLogo} className="w-full h-full object-cover"/> : <Upload className="text-neutral-400"/>}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">Change Logo</div>
              </div>
              <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
              <span className="text-xs text-neutral-500">Upload Store Logo</span>
          </div>

          {/* Fields */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Store Name</label><input className="input" value={profile.storeName || ''} onChange={e => setProfile({...profile, storeName: e.target.value})} /></div>
              <div><label className="label">Business Type</label><select className="input" value={profile.businessType || ''} onChange={e => setProfile({...profile, businessType: e.target.value})}><option>Retail</option><option>Pharmacy</option><option>Wholesale</option></select></div>
              <div><label className="label">Phone Number</label><input className="input" value={profile.phone || ''} onChange={e => setProfile({...profile, phone: e.target.value})} /></div>
              <div><label className="label">Email Address</label><input className="input" value={profile.email || ''} onChange={e => setProfile({...profile, email: e.target.value})} /></div>
              <div className="sm:col-span-2"><label className="label">Store Address</label><input className="input" value={profile.storeAddress || ''} onChange={e => setProfile({...profile, storeAddress: e.target.value})} /></div>
              <div><label className="label">Country</label><input className="input" value={profile.country || 'Tanzania'} onChange={e => setProfile({...profile, country: e.target.value})} /></div>
              <div><label className="label">Currency</label><input className="input" value={profile.currency || 'TZS'} onChange={e => setProfile({...profile, currency: e.target.value})} /></div>
              <div className="sm:col-span-2"><label className="label">Website</label><input className="input" value={profile.website || ''} onChange={e => setProfile({...profile, website: e.target.value})} placeholder="https://..." /></div>
          </div>
          
          <div className="md:col-span-3 flex justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button type="button" className="px-6 py-2 border rounded-lg text-sm font-medium dark:border-neutral-700">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-500 flex items-center gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Save & Close
              </button>
          </div>
        </form>
      </div>

      {/* BRANCH MANAGEMENT */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-2"><Building className="w-5 h-5 text-blue-600"/> Branch Management</h3>
              <button onClick={() => setIsBranchModalOpen(true)} className="px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> Add Branch</button>
          </div>
          
          <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500">
                      <tr><th className="p-3">Branch Name</th><th className="p-3">Location</th><th className="p-3">Phone</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {branches.map(b => (
                          <tr key={b.id}>
                              <td className="p-3 font-medium">{b.name}</td>
                              <td className="p-3">{b.location}</td>
                              <td className="p-3">{b.phone || '-'}</td>
                              <td className="p-3"><span className={`px-2 py-1 rounded text-xs ${b.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.status}</span></td>
                              <td className="p-3 text-right"><button onClick={() => handleDeleteBranch(b.id)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Add Branch Modal */}
      {isBranchModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-xl p-6 shadow-xl border border-neutral-200 dark:border-neutral-800">
                  <h3 className="font-bold text-lg mb-4">Add New Branch</h3>
                  <div className="space-y-3">
                      <input placeholder="Branch Name" className="input" value={newBranch.name || ''} onChange={e => setNewBranch({...newBranch, name: e.target.value})} />
                      <input placeholder="Location" className="input" value={newBranch.location || ''} onChange={e => setNewBranch({...newBranch, location: e.target.value})} />
                      <input placeholder="Phone" className="input" value={newBranch.phone || ''} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} />
                      <input placeholder="Email" className="input" value={newBranch.email || ''} onChange={e => setNewBranch({...newBranch, email: e.target.value})} />
                      <select className="input" value={newBranch.status} onChange={e => setNewBranch({...newBranch, status: e.target.value as any})}><option>Active</option><option>Inactive</option></select>
                      <div className="flex justify-end gap-3 pt-2">
                          <button onClick={() => setIsBranchModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                          <button onClick={handleSaveBranch} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Save Branch</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
