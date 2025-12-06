
import React, { useState, useRef } from 'react';
import { Sparkles, Instagram, Facebook, Mail, Copy, Check, Share2, MessageCircle, Smartphone, Wand2, Upload, X, ImageIcon, Video, Paintbrush, Aperture, Loader2 } from 'lucide-react';
import { quickGenerate, analyzeImage, generateMarketingImage, editMarketingImage, generateMarketingVideo } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

export const Marketing: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'text' | 'image-gen' | 'image-edit' | 'video'>('text');
  
  // Text Gen State
  const [platform, setPlatform] = useState<'instagram' | 'whatsapp' | 'email'>('instagram');
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('Exciting');
  const [generatedContent, setGeneratedContent] = useState('');
  
  // Image/Video State
  const [imagePrompt, setImagePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedMedia, setGeneratedMedia] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        alert("Image size too large. Max 4MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setGeneratedMedia(null); // Reset output
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTextGenerate = async () => {
    setIsLoading(true);
    setGeneratedContent('');
    
    let prompt = '';
    if (platform === 'instagram') prompt = `Write a catchy Instagram caption for a business in Tanzania`;
    else if (platform === 'whatsapp') prompt = `Write a short, engaging WhatsApp promotional message`;
    else prompt = `Write a professional email subject line and body`;

    prompt += ` about: "${topic}". Tone: ${tone}.`;
    if (platform === 'whatsapp') prompt += ` Use bullet points and emojis. Keep it under 100 words.`;

    try {
      const text = await quickGenerate(prompt);
      setGeneratedContent(text || "Failed to generate content.");
    } catch (error) {
      console.error(error);
      setGeneratedContent("Error generating content.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMediaGenerate = async () => {
    if (!imagePrompt && activeTab !== 'image-edit') return;
    setIsLoading(true);
    setGeneratedMedia(null);

    try {
      if (activeTab === 'image-gen') {
        const result = await generateMarketingImage(imagePrompt, aspectRatio);
        setGeneratedMedia(result);
      } else if (activeTab === 'image-edit') {
        if (!uploadedImage) return;
        const result = await editMarketingImage(uploadedImage, imagePrompt || "Enhance this image for marketing");
        setGeneratedMedia(result);
      } else if (activeTab === 'video') {
        const result = await generateMarketingVideo(imagePrompt);
        setGeneratedMedia(result);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to process media. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-orange-600" />
            AI Marketing Studio
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Generate text, images, and videos for your campaigns.</p>
        </div>
        
        {/* Tools Navigation */}
        <div className="flex bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto max-w-full">
            {[
                { id: 'text', label: 'Captions', icon: <MessageCircle className="w-4 h-4" /> },
                { id: 'image-gen', label: 'Create Image', icon: <Aperture className="w-4 h-4" /> },
                { id: 'image-edit', label: 'Edit Ad', icon: <Paintbrush className="w-4 h-4" /> },
                { id: 'video', label: 'Video Maker', icon: <Video className="w-4 h-4" /> }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                        activeTab === tab.id 
                        ? 'bg-white dark:bg-neutral-700 text-orange-600 dark:text-orange-400 shadow-sm' 
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                >
                    {tab.icon} {tab.label}
                </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Controls */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm h-fit">
           
           {/* TEXT CAPTION MODE */}
           {activeTab === 'text' && (
               <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Select Platform</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['instagram', 'whatsapp', 'email'].map(p => (
                          <button 
                            key={p}
                            onClick={() => setPlatform(p as any)}
                            className={`capitalize flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${platform === p ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'}`}
                          >
                            <span className="text-xs font-medium">{p}</span>
                          </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Topic</label>
                    <textarea 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. 50% off sale on smartphones..."
                      className="w-full h-24 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Tone</label>
                    <select 
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    >
                      <option>Exciting</option>
                      <option>Professional</option>
                      <option>Urgent</option>
                      <option>Funny</option>
                    </select>
                  </div>
                  <button 
                    onClick={handleTextGenerate}
                    disabled={isLoading || !topic}
                    className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                    Generate Content
                  </button>
               </div>
           )}

           {/* IMAGE GEN MODE */}
           {activeTab === 'image-gen' && (
               <div className="space-y-6">
                   <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Image Prompt</label>
                        <textarea 
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="e.g. A modern pharmacy counter with bright lighting, high resolution..."
                            className="w-full h-32 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none dark:text-white"
                        />
                   </div>
                   <div>
                       <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Aspect Ratio</label>
                       <div className="flex gap-3">
                           {['1:1', '16:9', '9:16'].map(ratio => (
                               <button
                                  key={ratio}
                                  onClick={() => setAspectRatio(ratio)}
                                  className={`flex-1 py-2 border rounded-lg text-sm ${aspectRatio === ratio ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600' : 'border-neutral-200 dark:border-neutral-800'}`}
                               >
                                   {ratio}
                               </button>
                           ))}
                       </div>
                   </div>
                   <button 
                        onClick={handleMediaGenerate}
                        disabled={isLoading || !imagePrompt}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                        Create Image (Imagen 3)
                    </button>
               </div>
           )}

           {/* IMAGE EDIT MODE */}
           {activeTab === 'image-edit' && (
               <div className="space-y-6">
                   <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Upload Source Image</label>
                        {uploadedImage ? (
                            <div className="relative h-40 rounded-xl overflow-hidden group">
                                <img src={uploadedImage} className="w-full h-full object-contain bg-black/50" />
                                <button onClick={() => setUploadedImage(null)} className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"><X className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-6 h-40 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all"
                            >
                                <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                                <span className="text-xs text-neutral-500">Click to upload photo</span>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </div>
                        )}
                   </div>
                   <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Edit Instructions</label>
                        <input 
                            type="text" 
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="e.g. Add a 'Sale' sticker, Change background to beach..."
                            className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                        />
                   </div>
                   <button 
                        onClick={handleMediaGenerate}
                        disabled={isLoading || !uploadedImage || !imagePrompt}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paintbrush className="w-5 h-5" />}
                        Edit Image
                    </button>
               </div>
           )}

           {/* VIDEO GEN MODE */}
           {activeTab === 'video' && (
               <div className="space-y-6">
                   <div>
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Video Prompt</label>
                        <textarea 
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="e.g. A cinematic drone shot of a pharmacy store front in Dar es Salaam..."
                            className="w-full h-32 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none dark:text-white"
                        />
                        <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1"><Video className="w-3 h-3"/> Generates 720p video (Veo)</p>
                   </div>
                   <button 
                        onClick={handleMediaGenerate}
                        disabled={isLoading || !imagePrompt}
                        className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-500 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Video className="w-5 h-5" />}
                        Generate Video
                    </button>
               </div>
           )}

        </div>

        {/* Right Column: Output */}
        <div className="flex flex-col h-full">
           <div className="flex-1 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 relative overflow-hidden flex flex-col min-h-[400px]">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> Result Preview
                </h3>
                {(generatedContent || generatedMedia) && (
                  <div className="flex gap-2">
                    {generatedContent && <button onClick={copyToClipboard} className="p-2 bg-white dark:bg-neutral-800 rounded-lg" title="Copy"><Copy className="w-4 h-4" /></button>}
                    <button className="p-2 bg-white dark:bg-neutral-800 rounded-lg" title="Download/Share"><Share2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              {activeTab === 'text' ? (
                  generatedContent ? (
                    <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl shadow-sm whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">
                        <ReactMarkdown>{generatedContent}</ReactMarkdown>
                    </div>
                  ) : (
                    <EmptyState icon={<MessageCircle className="w-12 h-12 opacity-20" />} text="AI Caption will appear here" />
                  )
              ) : (
                  generatedMedia ? (
                      <div className="flex-1 flex items-center justify-center bg-black/90 rounded-xl overflow-hidden">
                          {activeTab === 'video' ? (
                              <video src={generatedMedia} controls autoPlay loop className="max-h-[400px] max-w-full" />
                          ) : (
                              <img src={generatedMedia} alt="Generated" className="max-h-[400px] max-w-full object-contain" />
                          )}
                      </div>
                  ) : (
                    <EmptyState 
                        icon={activeTab === 'video' ? <Video className="w-12 h-12 opacity-20" /> : <ImageIcon className="w-12 h-12 opacity-20" />} 
                        text={isLoading ? "Generating... This may take a moment." : "Media output will appear here"} 
                    />
                  )
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{icon: React.ReactNode, text: string}> = ({ icon, text }) => (
    <div className="flex-1 flex flex-col items-center justify-center text-neutral-400">
        <div className="w-20 h-20 bg-neutral-200 dark:bg-neutral-900 rounded-full flex items-center justify-center mb-4">
            {icon}
        </div>
        <p className="text-sm font-medium">{text}</p>
    </div>
);
