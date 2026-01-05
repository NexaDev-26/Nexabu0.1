
import React, { useState } from 'react';
import { Check, Crown, Zap, ShieldCheck, X, Copy, CheckCircle, Loader2, Mail, ArrowRight, Calendar, Clock, CreditCard, KeyRound, Bell, Smartphone, Building2, Shield, Heart } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';
import { SubscriptionPaymentModal } from './SubscriptionPaymentModal';
import { PaymentProvider, PaymentConfig } from '../types';

interface SubscriptionProps {
    adminPaymentConfig?: PaymentConfig | null;
}

export const Subscription: React.FC<SubscriptionProps> = ({ adminPaymentConfig }) => {
  const { user } = useAppContext();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  // Derive subscription data
  const planName = user?.subscriptionPlan || 'Starter';
  const isActive = user?.status === 'Active';
  const daysLeft = user?.subscriptionExpiry 
      ? Math.ceil((new Date(user.subscriptionExpiry).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
      : 0;

  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      amount: 0,
      description: 'Perfect for small shops just getting started.',
      features: ['Up to 20 Products', 'Basic Sales Dashboard', '1 User Account', 'Mobile App Access', 'Mobile Money (M-Pesa/Tigo/Airtel)', 'Manual Bank Settlement', '48-Hour Payouts', 'Basic Transaction History'],
      cta: 'Current Plan',
      active: planName === 'Starter'
    },
    {
      name: 'Premium',
      price: '25,000 TZS',
      amount: 25000,
      period: '/ month',
      description: 'Supercharge your business with AI.',
      features: ['Unlimited Products', 'AI SmartBot Assistant', 'WhatsApp Auto-Ordering', 'Advanced Analytics', '2FA Settings', 'Notifications Settings', 'Mobile Money (STK Push)', 'Auto-Bank Payouts', 'Nexa-Shield Escrow', '24-Hour Payouts', 'PDF Receipts', 'Priority Support'],
      cta: 'Upgrade Now',
      highlight: true,
      icon: <Zap className="w-5 h-5" />,
      active: planName === 'Premium'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      amount: 150000,
      description: 'For pharmacy chains and large retailers.',
      features: ['Multi-Branch Management', 'Dedicated Account Manager', 'Custom API Integrations', 'Audit Logs & Security', '2FA Settings', 'Notifications Settings', 'Mobile Money (STK Push)', 'Real-time Bank Settlement', 'Nexa-Shield Escrow', 'Insurance Integration (NHIF/Private)', 'Instant Payouts', 'Advanced Financial Audit', 'White-label Options'],
      cta: 'Contact Sales',
      icon: <ShieldCheck className="w-5 h-5" />,
      active: planName === 'Enterprise'
    }
  ];

  const handleUpgradeClick = (plan: any) => {
      if (plan.active || plan.amount === 0) return;
      setSelectedPlan(plan);
      setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmitted = async (transactionRef: string, paymentMethod: PaymentProvider) => {
      // Payment submitted - user will wait for admin verification
      setIsPaymentModalOpen(false);
      setSelectedPlan(null);
  };

  // Determine user tier for payment method availability
  const getUserTier = (): 'Starter' | 'Premium' | 'Enterprise' => {
      if (planName === 'Premium') return 'Premium';
      if (planName === 'Enterprise') return 'Enterprise';
      return 'Starter';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      
      {/* SUBSCRIPTION STATUS CARD */}
      <div className="bg-neutral-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8">
              <div>
                  <div className="inline-flex items-center gap-2 bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide mb-4">
                      {isActive ? 'Active Subscription' : 'Inactive'}
                  </div>
                  <h2 className="text-3xl font-bold mb-2">{planName} Plan</h2>
                  <p className="text-neutral-400">Your next billing date is <span className="text-white font-mono">{user?.subscriptionExpiry || 'N/A'}</span></p>
                  
                  <div className="flex gap-4 mt-6">
                       <div className="bg-neutral-800 p-3 rounded-lg min-w-[120px]">
                           <div className="text-xs text-neutral-400 mb-1">Days Remaining</div>
                           <div className="text-2xl font-bold">{daysLeft > 0 ? daysLeft : 0}</div>
                       </div>
                       <div className="bg-neutral-800 p-3 rounded-lg min-w-[120px]">
                           <div className="text-xs text-neutral-400 mb-1">Activation Date</div>
                           <div className="text-sm font-bold">{user?.activationDate || 'N/A'}</div>
                       </div>
                  </div>
              </div>
              
              <div className="bg-white/10 p-6 rounded-xl border border-white/10 backdrop-blur-sm min-w-[300px]">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5"/> Support Forum ID</h3>
                  <div className="bg-black/30 p-3 rounded-lg font-mono text-center text-lg tracking-widest text-orange-400 mb-2">
                      {user?.supportForumCode || 'GEN-XYZ-123'}
                  </div>
                  <p className="text-xs text-neutral-400 text-center">Use this code for priority support access.</p>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        {plans.map((plan, idx) => (
          <div key={idx} className={`relative rounded-2xl p-8 flex flex-col transition-transform hover:-translate-y-1 duration-300 ${plan.highlight ? 'bg-white dark:bg-neutral-800 border-2 border-orange-500 shadow-xl' : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800'}`}>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{plan.name}</h3>
                {plan.icon && <div className="text-orange-600">{plan.icon}</div>}
              </div>
              <p className="text-sm text-neutral-500">{plan.description}</p>
            </div>
            <div className="mb-8">
              <span className="text-4xl font-bold text-neutral-900 dark:text-white">{plan.price}</span>
            </div>
            <div className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature, i) => {
                const is2FA = feature.includes('2FA');
                const isNotifications = feature.includes('Notifications');
                const isMobileMoney = feature.includes('Mobile Money') || feature.includes('M-Pesa') || feature.includes('STK Push');
                const isBank = feature.includes('Bank') || feature.includes('Payout');
                const isEscrow = feature.includes('Escrow') || feature.includes('Nexa-Shield');
                const isInsurance = feature.includes('Insurance') || feature.includes('NHIF');
                return (
                  <div key={i} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div className="flex items-center gap-2 flex-1">
                      {is2FA && <KeyRound className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
                      {isNotifications && <Bell className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}
                      {isMobileMoney && <Smartphone className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                      {isBank && <Building2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                      {isEscrow && <Shield className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />}
                      {isInsurance && <Heart className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">{feature}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => handleUpgradeClick(plan)} className={`w-full py-3 rounded-xl font-bold ${plan.active ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && selectedPlan && (
        <SubscriptionPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPlan(null);
          }}
          packageId={`pkg_${selectedPlan.name.toLowerCase()}`}
          packageName={selectedPlan.name}
          amount={selectedPlan.amount}
          userTier={getUserTier()}
          adminPaymentConfig={adminPaymentConfig}
          onPaymentSubmitted={handlePaymentSubmitted}
        />
      )}
    </div>
  );
};
