import React, { useState, useEffect } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, History, Smartphone, CreditCard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Transaction, UserRole } from '../types';
import { useAppContext } from '../hooks/useAppContext';
import { db, isFirebaseEnabled } from '../firebaseConfig';
import { collection, addDoc, query, where, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';

export const Wallet: React.FC = () => {
  const { user, setUser } = useAppContext();
  const [balance, setBalance] = useState(user?.walletBalance || 0);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [selectedProvider, setSelectedProvider] = useState<'MPESA' | 'TIGO' | 'AIRTEL' | null>(null);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (user?.walletBalance !== undefined) {
      setBalance(user.walletBalance);
    }
  }, [user?.walletBalance]);

  useEffect(() => {
    if (isFirebaseEnabled && db && user?.uid) {
      const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
      const handleError = (e: any) => { if(e.code !== 'permission-denied') console.warn("Wallet sync error:", e.code); };
      
      const q = query(collection(db, 'transactions'), where('uid', '==', targetUid), orderBy('date', 'desc'));
      const unsubscribe = onSnapshot(
          q, 
          (snapshot) => setTransactions(snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Transaction))),
          handleError
      );
      return () => unsubscribe();
    }
  }, [isFirebaseEnabled, user?.uid, user?.role, user?.employerId]);

  const providers = [
    { id: 'MPESA', name: 'M-Pesa (Lipa Namba)', color: 'bg-red-600', textColor: 'text-red-600 dark:text-red-400', logo: 'M' },
    { id: 'TIGO', name: 'Tigo Pesa', color: 'bg-blue-500', textColor: 'text-blue-500 dark:text-blue-400', logo: 'T' },
    { id: 'AIRTEL', name: 'Airtel Money', color: 'bg-red-500', textColor: 'text-red-500 dark:text-red-400', logo: 'A' },
  ];

  const handleTransaction = async () => {
    if (!amount || !phoneNumber || !selectedProvider || !user?.uid) return;
    
    setIsProcessing(true);
    const numAmount = Number(amount);
    const targetUid = (user.role === UserRole.VENDOR || user.role === UserRole.PHARMACY) ? user.uid : user.employerId;
    
    // Check balance for withdrawal
    if (activeTab === 'withdraw' && numAmount > balance) {
        alert("Insufficient balance.");
        setIsProcessing(false);
        return;
    }

    try {
      const newTxn: Partial<Transaction> = {
        type: activeTab === 'deposit' ? 'Deposit' : 'Withdrawal',
        amount: numAmount,
        provider: selectedProvider === 'MPESA' ? 'M-PESA' : selectedProvider === 'TIGO' ? 'TIGO PESA' : 'AIRTEL MONEY',
        date: new Date().toLocaleString(),
        status: 'Completed',
        phone: phoneNumber,
        uid: targetUid
      };

      if (isFirebaseEnabled && db) {
        // 1. Record Transaction
        await addDoc(collection(db, 'transactions'), newTxn);
        
        // 2. Update User Balance if target is valid
        if (targetUid) {
            const balanceChange = activeTab === 'deposit' ? numAmount : -numAmount;
            await updateDoc(doc(db, 'users', targetUid), {
              walletBalance: increment(balanceChange)
            });
            // Optimistic Update if user is owner
            if (user.uid === targetUid) {
                setUser({ ...user, walletBalance: (user.walletBalance || 0) + balanceChange });
            }
        }
      } else {
        alert("Transaction Service Unavailable.");
        setIsProcessing(false);
        return;
      }
      
      setAmount('');
      setPhoneNumber('');
      alert(`Transaction Successful!\n\n${activeTab === 'deposit' ? 'Received' : 'Sent'}: TZS ${numAmount.toLocaleString()}\nVia: ${newTxn.provider}`);

    } catch (e) {
      console.error("Transaction failed", e);
      alert("Transaction failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Balance Card */}
        <div className="flex-1 bg-neutral-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-neutral-800">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full mix-blend-screen filter blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-neutral-400 mb-1">
                    <WalletIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Total Balance</span>
                </div>
                <h2 className="text-4xl font-bold font-mono tracking-tight">TZS {balance.toLocaleString()}</h2>
                <div className="mt-6 flex gap-4">
                    <div className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg flex items-center gap-2">
                        <ArrowUpRight className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-neutral-300">Available for Ghala & Bills</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Actions Card */}
        <div className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg mb-6">
                <button 
                    onClick={() => setActiveTab('deposit')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'deposit' ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white'}`}
                >
                    Top Up (Deposit)
                </button>
                <button 
                    onClick={() => setActiveTab('withdraw')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'withdraw' ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-400 shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-white'}`}
                >
                    Withdraw
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">Select Provider</label>
                    <div className="grid grid-cols-3 gap-3">
                        {providers.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedProvider(p.id as any)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                                    selectedProvider === p.id 
                                    ? `border-${p.color.replace('bg-', '')} bg-neutral-50 dark:bg-neutral-800` 
                                    : 'border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full ${p.color} text-white flex items-center justify-center font-bold text-lg mb-2`}>
                                    {p.logo}
                                </div>
                                <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400 text-center leading-tight">{p.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Phone Number</label>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                            <input 
                                type="text" 
                                placeholder="07..." 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Amount (TZS)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs font-bold">TZS</span>
                            <input 
                                type="number" 
                                placeholder="0.00" 
                                className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 dark:border-neutral-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleTransaction}
                    disabled={!selectedProvider || !amount || !phoneNumber || isProcessing}
                    className="w-full bg-orange-600 text-white py-3 rounded-xl font-medium hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-900/20"
                >
                    {isProcessing ? (
                        <>
                           <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                        </>
                    ) : (
                        <>
                           {activeTab === 'deposit' ? 'Confirm Payment' : 'Confirm Withdrawal'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 bg-neutral-50 dark:bg-neutral-950">
            <History className="w-4 h-4 text-neutral-500" />
            <h3 className="font-medium text-neutral-900 dark:text-white">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 font-medium border-b border-neutral-100 dark:border-neutral-800">
                    <tr>
                        <th className="px-6 py-3">Reference</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Provider</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
                    {transactions.length > 0 ? transactions.map((txn) => (
                        <tr key={txn.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50">
                            <td className="px-6 py-4 font-mono text-xs text-neutral-500 dark:text-neutral-400">{txn.id.substring(0, 8).toUpperCase()}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 rounded-full ${txn.type === 'Deposit' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                        {txn.type === 'Deposit' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                                    </div>
                                    <span className="font-medium text-neutral-700 dark:text-neutral-300">{txn.type}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`text-xs font-bold px-2 py-1 rounded ${
                                    txn.provider.includes('M-PESA') ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' :
                                    txn.provider.includes('TIGO') ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' :
                                    'bg-neutral-50 dark:bg-neutral-900/20 text-neutral-600 dark:text-neutral-400'
                                }`}>
                                    {txn.provider}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400 text-xs">{txn.date}</td>
                            <td className="px-6 py-4 text-neutral-500 dark:text-neutral-400 font-mono text-xs">{txn.phone}</td>
                            <td className={`px-6 py-4 text-right font-mono font-medium ${txn.type === 'Deposit' ? 'text-green-600 dark:text-green-400' : 'text-neutral-900 dark:text-white'}`}>
                                {txn.type === 'Deposit' ? '+' : '-'} {txn.amount.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 uppercase">
                                    <CheckCircle className="w-3 h-3" /> {txn.status}
                                </span>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-neutral-400 italic">No transactions found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};