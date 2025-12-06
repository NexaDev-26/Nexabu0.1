import React, { useState } from 'react';
import { SubscriptionPackage, Service } from '../types';
import { Package, Plus, Trash2, Check, X, Edit2, Save, CreditCard } from 'lucide-react';

const DEFAULT_SERVICES: Service[] = [
  { id: 's1', name: 'Unlimited Products', description: 'Add as many items as you want', isEnabled: true },
  { id: 's2', name: 'AI SmartBot', description: 'Access to Gemini AI assistant', isEnabled: false },
  { id: 's3', name: 'WhatsApp Auto-Order', description: 'Direct checkout integration', isEnabled: true },
  { id: 's4', name: 'Advanced Analytics', description: 'Charts and forecasting', isEnabled: false },
  { id: 's5', name: 'Multi-Branch', description: 'Manage multiple locations', isEnabled: false },
  { id: 's6', name: 'Priority Support', description: '24/7 dedicated help', isEnabled: false },
];

const INITIAL_PACKAGES: SubscriptionPackage[] = [
  { 
    id: 'p1', 
    name: 'Starter', 
    price: 0, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: ['s1', 's3'].includes(s.id)})),
    color: 'bg-neutral-800'
  },
  { 
    id: 'p2', 
    name: 'Premium', 
    price: 25000, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: ['s1', 's2', 's3', 's4'].includes(s.id)})),
    isPopular: true,
    color: 'bg-orange-600'
  },
  { 
    id: 'p3', 
    name: 'Enterprise', 
    price: 150000, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: true})),
    color: 'bg-purple-600'
  }
];

interface AdminPackagesProps {
  adminPaymentDetails?: {
    phone: string;
    name: string;
    network: string;
  };
  setAdminPaymentDetails?: React.Dispatch<React.SetStateAction<{
    phone: string;
    name: string;
    network: string;
  }>>;
}

export const AdminPackages: React.FC<AdminPackagesProps> = ({ adminPaymentDetails, setAdminPaymentDetails }) => {
  const [packages, setPackages] = useState<SubscriptionPackage[]>(INITIAL_PACKAGES);
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleService = (pkgId: string, serviceId: string) => {
    if (editingId !== pkgId) return;
    setPackages(prev => prev.map(pkg => {
      if (pkg.id === pkgId) {
        return {
          ...pkg,
          services: pkg.services.map(s => s.id === serviceId ? { ...s, isEnabled: !s.isEnabled } : s)
        };
      }
      return pkg;
    }));
  };

  const updatePrice = (pkgId: string, newPrice: number) => {
    setPackages(prev => prev.map(p => p.id === pkgId ? { ...p, price: newPrice } : p));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Subscription Packages</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Manage plans and available services for vendors.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg hover:opacity-90 transition-opacity text-sm font-medium">
          <Plus className="w-4 h-4" /> Create Package
        </button>
      </div>

      {adminPaymentDetails && setAdminPaymentDetails && (
        <div className="bg-white dark:bg-neutral-900 p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-600" />
                Global Payment Receiver Config
            </h3>
            <p className="text-sm text-neutral-500 mb-4">These details will be shown to vendors when they upgrade their plan.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Network</label>
                    <select 
                        className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={adminPaymentDetails.network}
                        onChange={(e) => setAdminPaymentDetails({...adminPaymentDetails, network: e.target.value})}
                    >
                        <option>M-PESA</option>
                        <option>TIGO PESA</option>
                        <option>AIRTEL MONEY</option>
                        <option>HALOPESA</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Phone Number</label>
                    <input 
                        type="text"
                        className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={adminPaymentDetails.phone}
                        onChange={(e) => setAdminPaymentDetails({...adminPaymentDetails, phone: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Account Name</label>
                    <input 
                        type="text"
                        className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                        value={adminPaymentDetails.name}
                        onChange={(e) => setAdminPaymentDetails({...adminPaymentDetails, name: e.target.value})}
                    />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-500 transition-colors">
                    <Save className="w-4 h-4" /> Save Settings
                </button>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className={`p-4 ${pkg.color} text-white flex justify-between items-center`}>
              <div>
                <h3 className="font-bold text-lg">{pkg.name}</h3>
                <div className="text-sm opacity-90">
                  {editingId === pkg.id ? (
                    <input 
                      type="number" 
                      value={pkg.price}
                      onChange={(e) => updatePrice(pkg.id, Number(e.target.value))}
                      className="w-24 px-2 py-1 rounded text-black text-xs"
                    />
                  ) : (
                    `TZS ${pkg.price.toLocaleString()}`
                  )}
                   / mo
                </div>
              </div>
              <button 
                onClick={() => setEditingId(editingId === pkg.id ? null : pkg.id)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {editingId === pkg.id ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
              </button>
            </div>
            <div className="p-4 space-y-3">
              {pkg.services.map((service) => (
                <div key={service.id} className="flex items-start gap-3 p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                   <button 
                      disabled={editingId !== pkg.id}
                      onClick={() => toggleService(pkg.id, service.id)}
                      className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        service.isEnabled 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-neutral-300 dark:border-neutral-600 text-transparent'
                      } ${editingId === pkg.id ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                   >
                      <Check className="w-3 h-3" />
                   </button>
                   <div>
                      <p className={`text-sm font-medium ${service.isEnabled ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>{service.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-500">{service.description}</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};