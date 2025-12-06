import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
// FIX: Import `decode` and use the updated `decodeAudioData` function signature.
import { decode, decodeAudioData, float32ArrayToBase64 } from '../utils/audioUtils';
import { Mic, MicOff, Radio, Loader2 } from 'lucide-react';

export const LiveVoice: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('Ready to connect');
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
        return process.env.API_KEY;
    }
    return '';
  };

  const startSession = async () => {
    try {
      setStatus('Connecting...');
      const apiKey = getApiKey();
      if (!apiKey) {
          setStatus('Error: Missing API Key');
          return;
      }
      const ai = new GoogleGenAI({ apiKey });
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are the voice assistant for NexaBusy. Help the user check stock, sales, or find pharmacy items. Speak clearly and concisely.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          }
        },
        callbacks: {
          onopen: () => {
            setStatus('Connected. Listening...');
            setIsActive(true);
            
            // Setup Audio Input Streaming
            const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const base64Data = float32ArrayToBase64(inputData);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
            
            inputSourceRef.current = source;
            processorRef.current = processor;
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current) {
              const ctx = audioContextRef.current;
              // FIX: Call the refactored `decodeAudioData` with decoded bytes and correct parameters.
              const audioBuffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              
              const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
              source.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
            }
            
            if (msg.serverContent?.turnComplete) {
               // Turn complete logic if needed
            }
          },
          onclose: () => {
            setStatus('Disconnected');
            setIsActive(false);
          },
          onerror: (err) => {
            console.error(err);
            setStatus('Error occurred');
            setIsActive(false);
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e) {
      console.error(e);
      setStatus('Failed to start');
    }
  };

  const stopSession = async () => {
    if (inputSourceRef.current) inputSourceRef.current.disconnect();
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
    }
    
    setIsActive(false);
    setStatus('Stopped');
  };

  return (
    <div className="p-4 bg-neutral-950 text-white rounded-xl shadow-lg border border-neutral-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className={`w-5 h-5 ${isActive ? 'text-red-500 animate-pulse' : 'text-neutral-400'}`} />
          <h3 className="font-display font-semibold text-lg">NeBu Voice</h3>
        </div>
        <div className="text-xs font-mono text-neutral-400">{status}</div>
      </div>

      <div className="flex-1 flex items-center justify-center mb-4">
        {isActive ? (
          <div className="relative">
            <div className="w-24 h-24 bg-orange-600 rounded-full flex items-center justify-center animate-pulse">
               <Mic className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 border-4 border-orange-500/30 rounded-full animate-ping"></div>
          </div>
        ) : (
          <div className="w-24 h-24 bg-neutral-800 rounded-full flex items-center justify-center">
             <MicOff className="w-10 h-10 text-neutral-500" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {!isActive ? (
            <button 
                onClick={startSession} 
                className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
                <Mic className="w-5 h-5" /> Start Voice
            </button>
        ) : (
            <button 
                onClick={stopSession} 
                className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
                <MicOff className="w-5 h-5" /> Stop Session
            </button>
        )}
      </div>
    </div>
  );
};