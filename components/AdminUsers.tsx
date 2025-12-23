import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2, Loader2, AlertTriangle } from 'lucide-react';
import { User, UserRole } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { deleteUserAccount, getUserDataCount } from '../services/userDeletionService';
import { ErrorHandler } from '../utils/errorHandler';

export const AdminUsers: React.FC = () => {
  const { allUsers, showNotification } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const handleDelete = async (user: User) => {
    if (!window.confirm(`⚠️ WARNING: This will permanently delete ALL data associated with ${user.name || user.email}.\n\nThis includes:\n- All products\n- All orders\n- All customers\n- All invoices and bills\n- All expenses\n- All inventory data\n- All staff accounts\n\nThis action CANNOT be undone!\n\nAre you sure you want to proceed?`)) {
      return;
    }

    // Get data count for confirmation
    try {
      const counts = await getUserDataCount(user.uid);
      const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
      
      if (totalItems > 0) {
        const confirmMessage = `This account has ${totalItems} data entries across multiple collections.\n\nAre you absolutely sure you want to delete everything?`;
        if (!window.confirm(confirmMessage)) {
          return;
        }
      }
    } catch (error) {
      console.error('Error getting data count:', error);
    }

    setDeletingUserId(user.uid);
    try {
      const result = await deleteUserAccount(user.uid);
      
      if (result.success) {
        showNotification(`Successfully deleted account and ${result.deletedCount} related data entries.`, 'success');
      } else {
        const errorMsg = result.errors.length > 0 
          ? `Deleted ${result.deletedCount} items, but some errors occurred: ${result.errors.slice(0, 3).join(', ')}`
          : 'Failed to delete account completely.';
        showNotification(errorMsg, 'error');
        console.error('Deletion errors:', result.errors);
      }
    } catch (error: any) {
      const appError = ErrorHandler.handleApiError(error);
      showNotification(`Error deleting account: ${appError.message}`, 'error');
      ErrorHandler.logError(appError, 'Delete User Account');
    } finally {
      setDeletingUserId(null);
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
                  <button 
                    onClick={() => handleDelete(user)} 
                    disabled={deletingUserId === user.uid}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg text-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    title="Delete user and all associated data"
                  >
                    {deletingUserId === user.uid ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16}/>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
