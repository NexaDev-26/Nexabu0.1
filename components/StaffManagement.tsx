
import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../types';
import { Users, Plus, Trash2, Edit2, Save, X, ShieldCheck, Mail, User as UserIcon, Briefcase } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, where, onSnapshot } from 'firebase/firestore';

export const StaffManagement: React.FC = () => {
  const { user } = useAppContext();
  const [staffList, setStaffList] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [formData, setFormData] = useState<{ name: string; email: string; role: UserRole }>({ 
    name: '', 
    email: '', 
    role: UserRole.SELLER 
  });

  useEffect(() => {
    if (isFirebaseEnabled && user && db) {
      const targetUid = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
      if (targetUid) {
        const handleError = (e: any) => console.warn("Staff sync error:", e.code);
        const q = query(collection(db, "users"), where("employerId", "==", targetUid));
        const unsubscribe = onSnapshot(
            q, 
            (snapshot) => setStaffList(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as User))),
            handleError
        );
        return () => unsubscribe();
      }
    }
  }, [isFirebaseEnabled, user]);

  const handleSave = async () => {
    if (!formData.name || !formData.email || !user) {
        alert("Please fill in all fields.");
        return;
    }
    
    const employerId = user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY ? user.uid : user.employerId;
    const staffData = { 
        ...formData, 
        employerId,
        employerRole: user.role, // Pass down the employer's role (e.g., PHARMACY) so staff inherit view logic
        storeName: user.storeName, // Inherit store name
        createdAt: new Date().toISOString(),
        status: 'Active' 
    };
    
    if (isFirebaseEnabled && db) {
      try {
        if (editingStaff) {
          await updateDoc(doc(db, "users", editingStaff.uid), staffData);
        } else {
          // Create a pending staff entry. 
          // In a real app, this would trigger an email invite or Cloud Function to create Auth user.
          await addDoc(collection(db, "pending_staff"), { 
              ...staffData, 
              defaultPassword: "password123", // Temporary default
              isDefaultPassword: true 
          });
          alert(`Staff invitation created for ${formData.email}. Default password: password123`);
        }
      } catch (e) { console.error(e); }
    } else {
        alert("Database connection is unavailable.");
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (uid: string) => {
      if (confirm("Are you sure you want to remove this staff member?")) {
          if (isFirebaseEnabled && db) {
              try { await deleteDoc(doc(db, "users", uid)); } catch(e) { console.error(e); }
          }
      }
  };
  
  const openAddModal = () => { 
      setEditingStaff(null); 
      setFormData({ name: '', email: '', role: UserRole.SELLER }); 
      setIsModalOpen(true); 
  };

  const openEditModal = (staff: User) => {
      setEditingStaff(staff);
      setFormData({ name: staff.name, email: staff.email, role: staff.role });
      setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Staff & Sellers</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage access and roles for your team.</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors shadow-lg shadow-orange-900/20">
            <Plus className="w-4 h-4" /> 
            <span>Add New Staff</span>
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400">
                    <tr>
                        <th className="p-4 font-medium">Name</th>
                        <th className="p-4 font-medium">Role</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {staffList.length > 0 ? staffList.map(staff => (
                        <tr key={staff.uid} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-neutral-900 dark:text-white">{staff.name}</div>
                                        <div className="text-xs text-neutral-500">{staff.email}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    staff.role === UserRole.MANAGER ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300' :
                                    staff.role === UserRole.PHARMACIST ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' :
                                    'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                                }`}>
                                    <ShieldCheck className="w-3 h-3" />
                                    {staff.role}
                                </span>
                            </td>
                            <td className="p-4">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                                    staff.status === 'Active' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                                }`}>
                                    {staff.status || 'Active'}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => openEditModal(staff)} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-orange-600 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDelete(staff.uid)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-neutral-500 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={4} className="p-8 text-center text-neutral-400">No staff members found. Click "Add New Staff" to get started.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
              <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-200 dark:border-neutral-800">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-neutral-900 dark:text-white">{editingStaff ? 'Edit Profile' : 'Add New Team Member'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                          <X className="w-5 h-5"/>
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Full Name</label>
                          <div className="relative">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input 
                                type="text" 
                                placeholder="e.g. Juma Ali" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                              />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Email Address</label>
                          <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <input 
                                type="email" 
                                placeholder="e.g. juma@nexabu.com" 
                                value={formData.email} 
                                onChange={e => setFormData({...formData, email: e.target.value})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                disabled={!!editingStaff} // Prevent email edit for simplicity
                              />
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Role & Permissions</label>
                          <div className="relative">
                              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                              <select 
                                value={formData.role} 
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})} 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl bg-neutral-50 dark:bg-neutral-800 text-sm outline-none focus:ring-2 focus:ring-orange-500 dark:text-white appearance-none"
                              >
                                  <option value={UserRole.SELLER}>Seller (POS & Orders)</option>
                                  <option value={UserRole.MANAGER}>Manager (Full Access)</option>
                                  <option value={UserRole.PHARMACIST}>Pharmacist (Prescriptions)</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  <div className="flex gap-3 mt-8">
                      <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="flex-1 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleSave} 
                        className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-orange-900/20 flex justify-center items-center gap-2"
                      >
                          <Save className="w-4 h-4" />
                          {editingStaff ? 'Update Changes' : 'Save Staff'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
