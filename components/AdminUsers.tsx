import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2 } from 'lucide-react';
import { User, UserRole } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db } from '../firebaseConfig';
import { doc, deleteDoc } from 'firebase/firestore';

export const AdminUsers: React.FC = () => {
  const { allUsers } = useAppContext(); // Changed from `users` to `allUsers` to reflect context
  const [searchTerm, setSearchTerm] = useState('');

  const handleDelete = async (uid: string) => {
    if (window.confirm('Delete this user?') && db) {
      try {
        await deleteDoc(doc(db, "users", uid));
      } catch(e) { console.error(e); }
    }
  };
  
  const filteredUsers = allUsers.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="p-2 border rounded dark:bg-neutral-800" />
          <button className="p-2 bg-orange-600 text-white rounded"><Plus /></button>
        </div>
      </div>
      <div className="bg-white dark:bg-neutral-900 border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800"><tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4"></th></tr></thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.uid} className="border-b dark:border-neutral-800">
                <td className="p-4">{user.name}</td>
                <td className="p-4">{user.email}</td>
                <td className="p-4">{user.role}</td>
                <td className="p-4 text-right">
                  <button className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"><Edit2 size={16}/></button>
                  <button onClick={() => handleDelete(user.uid)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500"><Trash2 size={16}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
