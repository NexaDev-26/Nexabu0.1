import React, { useState } from 'react';
import { SubscriptionPackage, Service } from '../types';
import { Package, Plus, Trash2, Check, X, Edit2, Save, CreditCard, KeyRound, Bell, Smartphone, Building2, Shield, Heart, Zap, FileText } from 'lucide-react';

const DEFAULT_SERVICES: Service[] = [
  { id: 's1', name: 'Unlimited Products', description: 'Add as many items as you want', isEnabled: true },
  { id: 's2', name: 'AI SmartBot', description: 'Access to Gemini AI assistant', isEnabled: false },
  { id: 's3', name: 'WhatsApp Auto-Order', description: 'Direct checkout integration', isEnabled: true },
  { id: 's4', name: 'Advanced Analytics', description: 'Charts and forecasting', isEnabled: false },
  { id: 's5', name: 'Multi-Branch', description: 'Manage multiple locations', isEnabled: false },
  { id: 's6', name: 'Priority Support', description: '24/7 dedicated help', isEnabled: false },
  { id: 's7', name: '2FA Settings', description: 'Two-factor authentication for enhanced security', isEnabled: false },
  { id: 's8', name: 'Notifications Settings', description: 'Customize email, push, and SMS notifications', isEnabled: false },
  // Payment Features
  { id: 's9', name: 'Mobile Money (STK Push)', description: 'M-Pesa, Tigo Pesa, Airtel Money with integrated STK Push', isEnabled: true },
  { id: 's10', name: 'Auto-Bank Payouts', description: 'Automated bank transfers and real-time settlement', isEnabled: false },
  { id: 's11', name: 'Nexa-Shield Escrow', description: 'Secure funds held until service completion', isEnabled: false },
  { id: 's12', name: 'Insurance Integration', description: 'NHIF & Private Insurance (Jubilee, Strategis) claims', isEnabled: false },
  { id: 's13', name: 'Instant Payouts', description: 'Real-time fund settlement (vs 24-48hr standard)', isEnabled: false },
  { id: 's14', name: 'Advanced Financial Audit', description: 'Comprehensive reporting & transaction analytics', isEnabled: false },
];

const INITIAL_PACKAGES: SubscriptionPackage[] = [
  { 
    id: 'p1', 
    name: 'Starter', 
    price: 0, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: ['s1', 's3', 's9'].includes(s.id)})), // Basic + Mobile Money
    color: 'bg-neutral-800'
  },
  { 
    id: 'p2', 
    name: 'Premium', 
    price: 25000, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: ['s1', 's2', 's3', 's4', 's7', 's8', 's9', 's10', 's11'].includes(s.id)})), // Adds Bank Payouts & Escrow
    isPopular: true,
    color: 'bg-orange-600'
  },
  { 
    id: 'p3', 
    name: 'Enterprise', 
    price: 150000, 
    period: 'Monthly', 
    services: DEFAULT_SERVICES.map(s => ({...s, isEnabled: true})), // All features including Insurance & Instant Payouts
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
              {/* Payment Methods Section */}
              <div className="mb-4 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-2 uppercase tracking-wide">
                  Available Payment Methods
                </p>
                <div className="flex flex-wrap gap-2">
                  {pkg.id === 'p1' && (
                    <>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">M-Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Tigo Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Airtel Money</span>
                    </>
                  )}
                  {pkg.id === 'p2' && (
                    <>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">M-Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Tigo Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Airtel Money</span>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">Bank Transfer</span>
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs">Escrow Wallet</span>
                    </>
                  )}
                  {pkg.id === 'p3' && (
                    <>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">M-Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Tigo Pesa</span>
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs">Airtel Money</span>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-xs">Bank Transfer</span>
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs">Escrow Wallet</span>
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-xs">NHIF</span>
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded text-xs">Private Insurance</span>
                      <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-xs">Credit Card</span>
                    </>
                  )}
                </div>
              </div>

              {/* Services */}
              {pkg.services.map((service) => {
                // Get icon for specific services
                const getServiceIcon = () => {
                  if (service.id === 's7') return <KeyRound className="w-4 h-4 text-orange-600" />;
                  if (service.id === 's8') return <Bell className="w-4 h-4 text-orange-600" />;
                  if (service.id === 's9') return <Smartphone className="w-4 h-4 text-green-600" />;
                  if (service.id === 's10') return <Building2 className="w-4 h-4 text-blue-600" />;
                  if (service.id === 's11') return <Shield className="w-4 h-4 text-purple-600" />;
                  if (service.id === 's12') return <Heart className="w-4 h-4 text-red-600" />;
                  if (service.id === 's13') return <Zap className="w-4 h-4 text-yellow-600" />;
                  if (service.id === 's14') return <FileText className="w-4 h-4 text-indigo-600" />;
                  return null;
                };
                
                return (
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
                     <div className="flex-1 flex items-start gap-2">
                        {getServiceIcon() && <div className="mt-0.5">{getServiceIcon()}</div>}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${service.isEnabled ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>{service.name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-500">{service.description}</p>
                        </div>
                     </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};