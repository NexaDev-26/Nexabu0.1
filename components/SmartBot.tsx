import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import { chatWithGemini, searchNearby, analyzeImage, quickGenerate } from '../services/geminiService';
import { Send, MapPin, Image as ImageIcon, Loader2, BrainCircuit, X, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LiveVoice } from './LiveVoice';

export const SmartBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', text: 'Hello! I am your NeBu SmartBot. How can I help your business today?', timestamp: Date.now() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!inputValue.trim() && !attachment) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputValue,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      let responseText = '';
      let groundingData = null;

      if (attachment) {
        // Image Analysis
        responseText = await analyzeImage(attachment, inputValue || "Analyze this image");
        setAttachment(null);
      } else if (inputValue.toLowerCase().includes('near') || inputValue.toLowerCase().includes('location') || inputValue.toLowerCase().includes('map')) {
        // Maps Grounding
        const lat = -6.7924; // Mock Dar es Salaam
        const lng = 39.2083; 
        const result = await searchNearby(inputValue, lat, lng);
        responseText = result.text || "I found some locations.";
        groundingData = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
      } else {
        // General Chat + Thinking
        const result = await chatWithGemini(inputValue, [], isThinking);
        responseText = result.text || "I'm not sure how to respond.";
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now(),
        groundingMetadata: groundingData
      };
      
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "Sorry, I encountered an error processing your request.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setAttachment(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 bg-orange-600 hover:bg-orange-500 text-white p-4 rounded-full shadow-xl transition-transform hover:scale-105 ${isOpen ? 'hidden md:flex' : 'flex'}`}
      >
        {isOpen ? <X className="w-8 h-8" /> : <BrainCircuit className="w-8 h-8" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 z-50 w-full md:w-96 h-full md:h-[600px] bg-white dark:bg-neutral-900 md:rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-neutral-950 p-4 text-white flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-neutral-800 p-2 rounded-lg border border-neutral-700">
                 <BrainCircuit className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-display font-bold">NeBu SmartBot</h3>
                <p className="text-xs text-neutral-400">AI Business Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
                    <button 
                        onClick={() => setMode('chat')}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${mode === 'chat' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                        Chat
                    </button>
                    <button 
                        onClick={() => setMode('voice')}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${mode === 'voice' ? 'bg-orange-600 text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                        Voice
                    </button>
                </div>
                <button onClick={() => setIsOpen(false)} className="md:hidden p-1 text-neutral-400 hover:text-white">
                    <Minimize2 className="w-6 h-6" />
                </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto bg-neutral-50 dark:bg-neutral-950 relative custom-scrollbar">
            {mode === 'voice' ? (
              <div className="h-full flex flex-col justify-center p-4">
                <LiveVoice />
              </div>
            ) : (
              <div className="p-4 space-y-4 pb-20">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-orange-600 text-white rounded-br-none shadow-md' 
                        : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 rounded-bl-none shadow-sm'
                    }`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                      
                      {/* Grounding Chips (Maps) */}
                      {msg.groundingMetadata && (
                        <div className="mt-2 space-y-2">
                          {msg.groundingMetadata.map((chunk: any, i: number) => (
                            chunk.web?.uri ? (
                                <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 dark:text-blue-400 underline truncate bg-blue-50 dark:bg-blue-900/30 p-1 rounded">
                                  {chunk.web.title || chunk.web.uri}
                                </a>
                            ) : chunk.map?.uri ? ( 
                                <div key={i} className="text-xs bg-green-50 dark:bg-green-900/30 p-1 rounded text-green-700 dark:text-green-400 flex items-center gap-1">
                                   <MapPin className="w-3 h-3"/> Found Location
                                </div>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl p-3 rounded-bl-none shadow-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          {mode === 'chat' && (
            <div className="p-4 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex-shrink-0">
              {attachment && (
                <div className="mb-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded flex justify-between items-center">
                   <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Image attached</span>
                   <button onClick={() => setAttachment(null)} className="text-red-500 font-bold p-1"><X className="w-3 h-3"/></button>
                </div>
              )}
              <div className="flex items-center gap-2 mb-2">
                 <label className="flex items-center gap-1 text-xs cursor-pointer select-none group">
                    <input 
                      type="checkbox" 
                      checked={isThinking} 
                      onChange={(e) => setIsThinking(e.target.checked)} 
                      className="w-3 h-3 accent-orange-600"
                    />
                    <span className={`transition-colors ${isThinking ? 'text-orange-600 font-semibold' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`}>Thinking Mode</span>
                 </label>
              </div>
              <div className="flex items-center gap-2">
                <button 
                   onClick={() => fileInputRef.current?.click()}
                   className="p-2 text-neutral-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors bg-neutral-100 dark:bg-neutral-800 rounded-full hover:bg-orange-50 dark:hover:bg-orange-900/20"
                   title="Upload Image"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleFileChange}
                />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isThinking ? "Ask complex question..." : "Ask anything..."}
                  className="flex-1 bg-neutral-100 dark:bg-neutral-800 border-none rounded-full px-4 py-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-shadow text-neutral-900 dark:text-white placeholder-neutral-400"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!inputValue && !attachment)}
                  className="p-2.5 bg-orange-600 text-white rounded-full hover:bg-orange-500 disabled:opacity-50 transition-colors shadow-md"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};