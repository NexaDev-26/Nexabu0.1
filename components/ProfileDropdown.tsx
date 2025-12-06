import React from 'react';
import { User, UserRole } from '../types';
import { Settings, LogOut, UserCircle } from 'lucide-react';

interface ProfileDropdownProps {
  user: User;
  onManageAccount: () => void;
  onCustomerProfile?: () => void;
  onLogout: () => void;
}

const getInitials = (name?: string): string => {
  if (!name) return 'U';
  const names = name.split(' ');
  return names.length > 1 ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
};

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, onManageAccount, onCustomerProfile, onLogout }) => {
  return (
    <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl animate-fade-in z-50">
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold">
          {user?.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover rounded-full" /> : <span>{getInitials(user?.name)}</span>}
        </div>
        <div>
          <p className="text-sm font-bold text-neutral-900 dark:text-white truncate">{user?.name || 'User'}</p>
          <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
        </div>
      </div>
      <div className="p-2">
        {user.role === UserRole.CUSTOMER && onCustomerProfile && (
          <button onClick={onCustomerProfile} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
            <UserCircle className="w-4 h-4 text-neutral-500" />
            <span>Customer Profile</span>
          </button>
        )}
        <button onClick={onManageAccount} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
          <Settings className="w-4 h-4 text-neutral-500" />
          <span>Manage Account</span>
        </button>
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
