
import React, { useState } from 'react';
import { Check, Crown, Zap, ShieldCheck, X, Copy, CheckCircle, Loader2, Mail, ArrowRight, Calendar, Clock, CreditCard } from 'lucide-react';
import { useAppContext } from '../hooks/useAppContext';

interface SubscriptionProps {
    adminPaymentDetails?: {
        phone: string;
        name: string;
        network: string;
    };
}

export const Subscription: React.FC<SubscriptionProps> = ({ adminPaymentDetails }) => {
  const { user } = useAppContext();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [userEmail, setUserEmail] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

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
      features: ['Up to 20 Products', 'Basic Sales Dashboard', '1 User Account', 'Mobile App Access'],
      cta: 'Current Plan',
      active: planName === 'Starter'
    },
    {
      name: 'Premium',
      price: '25,000 TZS',
      amount: 25000,
      period: '/ month',
      description: 'Supercharge your business with AI.',
      features: ['Unlimited Products', 'AI SmartBot Assistant', 'WhatsApp Auto-Ordering', 'Advanced Analytics', 'Priority Support'],
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
      features: ['Multi-Branch Management', 'Dedicated Account Manager', 'Custom API Integrations', 'Audit Logs & Security', 'White-label Options'],
      cta: 'Contact Sales',
      icon: <ShieldCheck className="w-5 h-5" />,
      active: planName === 'Enterprise'
    }
  ];

  const handleUpgradeClick = (plan: any) => {
      if (plan.active) return;
      setSelectedPlan(plan);
      setStep('details');
      setGeneratedToken(null);
      setIsCheckoutOpen(true);
  };

  const handleConfirmPayment = () => {
      if (!userEmail) return alert("Email required.");
      setStep('processing');
      setTimeout(() => {
          const token = `NEXA-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          setGeneratedToken(token);
          setStep('success');
      }, 2000);
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
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">{feature}</span>
                </div>
              ))}
            </div>
            <button onClick={() => handleUpgradeClick(plan)} className={`w-full py-3 rounded-xl font-bold ${plan.active ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'}`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* CHECKOUT MODAL (Simplified for brevity) */}
      {isCheckoutOpen && selectedPlan && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md p-6 border dark:border-neutral-800">
                  <div className="flex justify-between mb-4"><h3 className="font-bold text-lg dark:text-white">Upgrade to {selectedPlan.name}</h3><button onClick={()=>setIsCheckoutOpen(false)}><X/></button></div>
                  {step === 'details' && (
                      <div className="space-y-4">
                          <input type="email" placeholder="Email for License Token" className="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:text-white" value={userEmail} onChange={e=>setUserEmail(e.target.value)}/>
                          <button onClick={handleConfirmPayment} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold">Confirm Payment</button>
                      </div>
                  )}
                  {step === 'processing' && <div className="text-center py-8"><Loader2 className="w-10 h-10 animate-spin mx-auto text-orange-600"/></div>}
                  {step === 'success' && (
                      <div className="text-center">
                          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2"/>
                          <h4 className="font-bold text-lg dark:text-white">Success!</h4>
                          <div className="bg-neutral-100 dark:bg-neutral-800 p-3 rounded mt-4 font-mono font-bold">{generatedToken}</div>
                          <button onClick={()=>setIsCheckoutOpen(false)} className="w-full bg-neutral-900 text-white py-2 rounded-lg mt-4">Close</button>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};
