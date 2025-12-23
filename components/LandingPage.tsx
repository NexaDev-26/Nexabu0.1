
import React from 'react';
import { CheckCircle, Store, MessageCircle, BarChart3, Pill, Zap, Layout, Smartphone, Users, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
  onSignupClick: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl hover:border-orange-900/50 transition-colors text-left">
    <div className="w-12 h-12 bg-neutral-800 rounded-xl flex items-center justify-center text-orange-500 mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
    <p className="text-neutral-400 text-sm leading-relaxed">{description}</p>
  </div>
);

const PriceTier: React.FC<{ name: string; description: string; price: string; period: string; features: string[]; highlight?: boolean; onSelect: () => void }> = ({ name, description, price, period, features, highlight, onSelect }) => (
    <div className={`relative p-8 rounded-2xl flex flex-col ${highlight ? 'bg-neutral-900 border border-orange-600 shadow-2xl shadow-orange-900/20 z-10 scale-105' : 'bg-neutral-900 border border-neutral-800 shadow-xl'}`}>
        {highlight && <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-3 py-1 rounded-b-lg text-xs font-bold uppercase tracking-wide">Most Popular</div>}
        <h3 className="font-bold text-xl mb-2 text-white">{name}</h3>
        <p className="text-sm text-neutral-400 mb-6 min-h-[40px]">{description}</p>
        <div className="mb-6">
          <span className="text-4xl font-bold text-white">{price}</span>
          <span className="text-sm text-neutral-400">{period}</span>
        </div>
        <ul className="space-y-4 mb-8 flex-1 border-t border-neutral-800 pt-6">
          {features.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <CheckCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${highlight ? 'text-orange-500' : 'text-neutral-500'}`} />
              <span className="text-sm text-neutral-300">{f}</span>
            </li>
          ))}
        </ul>
        <button onClick={onSelect} className={`w-full py-4 rounded-xl font-bold text-white transition-all ${highlight ? 'bg-orange-600 hover:bg-orange-500' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
          Get Started
        </button>
    </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onSignupClick }) => {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-white overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-display font-bold text-2xl shadow-lg shadow-orange-600/20">N</div>
            <span className="font-display font-bold text-xl tracking-tight">Nexabu</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-neutral-400">
            <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Features</button>
            <button onClick={() => scrollToSection('pharmacies')} className="hover:text-white transition-colors">Pharmacies</button>
            <button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Pricing</button>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={onLoginClick} className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">Log In</button>
            <button onClick={onSignupClick} className="px-5 py-2.5 bg-white text-neutral-950 rounded-full text-sm font-bold hover:bg-neutral-200 transition-colors">Get Started</button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-40 pb-32 px-6 text-center relative">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-orange-600/20 rounded-full blur-[120px] -z-10 opacity-50"></div>
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-medium text-orange-400 mb-4">
                <Zap className="w-3 h-3" /> New: AI SmartBot for WhatsApp
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-tight tracking-tight">
                Run your business on <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">Autopilot</span>
            </h1>
            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto">
                The all-in-one platform for Tanzanian retailers and pharmacies. Manage inventory, track sales, and grow with AI-powered insights.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                <button onClick={onSignupClick} className="px-8 py-4 bg-orange-600 rounded-full font-bold text-lg hover:bg-orange-500 transition-all shadow-lg shadow-orange-900/50 flex items-center gap-2">
                    Start Free Trial <ArrowRight className="w-5 h-5" />
                </button>
                <button className="px-8 py-4 bg-neutral-900 border border-neutral-800 rounded-full font-bold text-lg hover:bg-neutral-800 transition-all">
                    View Demo
                </button>
            </div>
        </div>
      </main>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6 bg-neutral-950 relative">
        <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to grow</h2>
                <p className="text-neutral-400 max-w-2xl mx-auto">Replacing your notebook, calculator, and excel sheets with one intelligent system.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
                <FeatureCard 
                    icon={<Store className="w-6 h-6" />}
                    title="Inventory Management"
                    description="Track stock in real-time. Get low stock alerts and manage multiple branches from one account."
                />
                <FeatureCard 
                    icon={<MessageCircle className="w-6 h-6" />}
                    title="AI SmartBot"
                    description="Your 24/7 business assistant. Ask about sales, generate marketing captions, and more."
                />
                <FeatureCard 
                    icon={<BarChart3 className="w-6 h-6" />}
                    title="Sales Analytics"
                    description="Visual reports on your revenue, profit margins, and best-selling products."
                />
                <FeatureCard 
                    icon={<Smartphone className="w-6 h-6" />}
                    title="Mobile POS"
                    description="Sell from anywhere using your phone. Digital receipts sent via WhatsApp."
                />
                <FeatureCard 
                    icon={<Users className="w-6 h-6" />}
                    title="Staff & Permissions"
                    description="Assign roles to your team. Control what sellers and managers can see and do."
                />
                <FeatureCard 
                    icon={<Layout className="w-6 h-6" />}
                    title="Online Storefront"
                    description="Get a free website for your shop where customers can browse and order."
                />
            </div>
        </div>
      </section>

      {/* Pharmacy Section */}
      <section id="pharmacies" className="py-24 px-6 bg-neutral-950 border-t border-neutral-800">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1 space-y-8">
                <div className="inline-block px-3 py-1 rounded-full bg-blue-900/30 text-blue-400 text-xs font-bold uppercase tracking-wide">
                    Specialized Industry Solution
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">Built for Pharmacies</h2>
                <p className="text-neutral-400 text-lg">
                    Nexabu includes specialized tools compliant with TFDA regulations, helping you manage prescriptions and expiry dates effortlessly.
                </p>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center text-blue-500"><Pill className="w-5 h-5" /></div>
                        <div><h4 className="font-bold text-white">Drug Expiry Tracking</h4><p className="text-sm text-neutral-400">Automated alerts before medicines expire.</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center text-blue-500"><BarChart3 className="w-5 h-5" /></div>
                        <div><h4 className="font-bold text-white">Prescription Management</h4><p className="text-sm text-neutral-400">Digitally store and verify patient prescriptions.</p></div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center text-blue-500"><CheckCircle className="w-5 h-5" /></div>
                        <div><h4 className="font-bold text-white">Compliance Reporting</h4><p className="text-sm text-neutral-400">Generate reports for health inspectors in one click.</p></div>
                    </div>
                </div>
            </div>
            <div className="flex-1 relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full"></div>
                <div className="relative bg-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                        <Pill className="w-6 h-6 text-blue-500" />
                        <span className="font-bold">Pharmacy Dashboard</span>
                    </div>
                    <div className="space-y-3">
                        <div className="bg-neutral-900 p-3 rounded-lg flex justify-between items-center border border-neutral-800">
                            <span className="text-sm">Amoxicillin 500mg</span>
                            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-900">Expiring Soon</span>
                        </div>
                        <div className="bg-neutral-900 p-3 rounded-lg flex justify-between items-center border border-neutral-800">
                            <span className="text-sm">Paracetamol</span>
                            <span className="text-xs text-neutral-500">120 Units</span>
                        </div>
                        <div className="bg-neutral-900 p-3 rounded-lg flex justify-between items-center border border-neutral-800">
                            <span className="text-sm">Insulin R</span>
                            <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded border border-green-900">Stock OK</span>
                        </div>
                    </div>
                </div>
            </div>
         </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 bg-neutral-950 border-t border-neutral-900">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
        <p className="text-neutral-400 text-center mb-16 max-w-xl mx-auto">Start for free and upgrade as you grow. No hidden fees.</p>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <PriceTier 
            name="Starter" 
            description="For small shops and startups just getting started." 
            price="Free" 
            period="Forever" 
            features={['Up to 20 Products', 'Basic Dashboard', '1 User Account', 'Mobile Money (M-Pesa/Tigo/Airtel)', '48-Hour Payouts', 'Basic History', 'Community Support']} 
            onSelect={onSignupClick} 
          />
          <PriceTier 
            name="Premium" 
            description="For growing businesses needing AI & automation." 
            price="25,000" 
            period="TZS / month" 
            features={['Unlimited Products', 'AI SmartBot Assistant', 'WhatsApp Auto-Ordering', 'Advanced Analytics', '2FA Settings', 'Notifications Settings', 'Mobile Money (STK Push)', 'Auto-Bank Payouts', 'Nexa-Shield Escrow', '24-Hour Payouts', 'PDF Receipts', 'Priority Support']} 
            highlight 
            onSelect={onSignupClick} 
          />
          <PriceTier 
            name="Enterprise" 
            description="For pharmacy chains and large retailers." 
            price="Custom" 
            period="Contact Us" 
            features={['Multi-Branch Management', 'Custom API Integrations', 'Dedicated Account Manager', '2FA Settings', 'Notifications Settings', 'Mobile Money (STK Push)', 'Real-time Bank Settlement', 'Nexa-Shield Escrow', 'Insurance Integration (NHIF/Private)', 'Instant Payouts', 'Advanced Financial Audit', 'SLA & Contracts', 'White-label Options']} 
            onSelect={onSignupClick} 
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-neutral-900 bg-neutral-950 text-neutral-500 text-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-neutral-800 rounded flex items-center justify-center font-bold text-xs text-white">N</div>
                <span className="font-bold text-white">Nexabu</span>
            </div>
            <div className="flex gap-6">
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p>© 2024 Nexabu Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
