import React, { useState } from 'react';
import { FileText, Check, X, Eye, AlertCircle, Sparkles, Upload } from 'lucide-react';
import { chatWithGemini } from '../services/geminiService';

interface Prescription {
  id: string;
  patientName: string;
  date: string;
  items: string[];
  status: 'Pending' | 'Verified' | 'Rejected';
  imageUrl?: string;
}

const MOCK_PRESCRIPTIONS: Prescription[] = [
    { id: 'RX-1001', patientName: 'Michael J.', date: '2024-03-15', items: ['Amoxicillin 500mg', 'Panadol Extra'], status: 'Pending' },
    { id: 'RX-1002', patientName: 'Sarah Connor', date: '2024-03-14', items: ['Insulin', 'Metformin'], status: 'Verified' },
];

export const Prescriptions: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(MOCK_PRESCRIPTIONS);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{id: string, text: string} | null>(null);

  const handleVerifyAI = async (rx: Prescription) => {
    setAnalyzingId(rx.id);
    try {
        // Using thinking mode to double check interactions or validity
        const prompt = `Act as a pharmacist assistant. Analyze this prescription request for: ${rx.items.join(', ')}. 
        Check for common drug interactions or warnings. 
        Verify if these are standard dosages. Return a brief 2-sentence safety report.`;
        
        const response = await chatWithGemini(prompt, [], true);
        setAiAnalysis({ id: rx.id, text: response.text || 'No analysis returned.' });
    } catch (e) {
        console.error(e);
    } finally {
        setAnalyzingId(null);
    }
  };

  const updateStatus = (id: string, status: Prescription['status']) => {
    setPrescriptions(prev => prev.map(rx => rx.id === id ? { ...rx, status } : rx));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Prescription Management</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Verify and process patient prescriptions securely.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors text-sm">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload New</span>
        </button>
      </div>

      <div className="grid gap-4">
        {prescriptions.map((rx) => (
            <div key={rx.id} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-neutral-900 dark:text-white">{rx.patientName}</h3>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mb-2">ID: {rx.id} • {rx.date}</p>
                            <div className="flex flex-wrap gap-2">
                                {rx.items.map((item, i) => (
                                    <span key={i} className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-1 rounded text-xs font-medium">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-3 mt-4 md:mt-0">
                         <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            rx.status === 'Verified' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            rx.status === 'Rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                         }`}>
                            {rx.status}
                         </div>
                         
                         <div className="flex items-center gap-2">
                            <button 
                                onClick={() => handleVerifyAI(rx)}
                                disabled={analyzingId === rx.id}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 text-xs font-medium transition-colors whitespace-nowrap"
                            >
                                <Sparkles className={`w-3 h-3 ${analyzingId === rx.id ? 'animate-spin' : ''}`} />
                                AI Check
                            </button>
                            <button onClick={() => updateStatus(rx.id, 'Verified')} className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded" title="Approve">
                                <Check className="w-5 h-5" />
                            </button>
                            <button onClick={() => updateStatus(rx.id, 'Rejected')} className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="Reject">
                                <X className="w-5 h-5" />
                            </button>
                         </div>
                    </div>
                </div>

                {/* AI Analysis Result */}
                {aiAnalysis?.id === rx.id && (
                    <div className="mt-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-lg p-3 flex items-start gap-3 animate-fade-in">
                        <AlertCircle className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-purple-900 dark:text-purple-200 uppercase mb-1">AI Safety Report</h4>
                            <p className="text-sm text-purple-800 dark:text-purple-300">{aiAnalysis.text}</p>
                        </div>
                        <button onClick={() => setAiAnalysis(null)} className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"><X className="w-4 h-4" /></button>
                    </div>
                )}
            </div>
        ))}
      </div>
    </div>
  );
};