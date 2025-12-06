import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

// BEST PRACTICE: Use environment variables exclusively.
// Helper to safely access process.env
function getApiKey(): string | null {
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return null;
}

// Lazy initialization for the AI client
function getAI(): GoogleGenAI | null {
  if (ai) return ai;
  const apiKey = getApiKey();
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    return ai;
  }
  return null;
}

export const geminiModels = {
  smartBot: 'gemini-2.5-flash',
  fastBot: 'gemini-2.5-flash', 
  vision: 'gemini-2.5-flash', 
  live: 'gemini-2.5-flash-native-audio-preview-09-2025',
  maps: 'gemini-2.5-flash',
  imageGen: 'imagen-4.0-generate-001',
  imageEdit: 'gemini-2.5-flash-image',
  videoGen: 'veo-3.1-fast-generate-preview',
};

const handleGeminiError = (error: any): string => {
  const msg = error?.toString() || '';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
    console.warn("Gemini API Quota Exceeded");
    return "⚠️ AI usage limit reached. Please try again in a few minutes.";
  }
  if (msg.includes('API key') || msg.includes('403')) {
    console.warn("Gemini API Key Error");
    return "⚠️ AI configuration error. Please check API key.";
  }
  console.error("Gemini API Error:", error);
  return "I'm having trouble connecting to the AI service right now.";
};

export const chatWithGemini = async (message: string, history: any[], useThinking: boolean = false) => {
  const client = getAI();
  if (!client) throw new Error("AI Service Unavailable: Missing API Key");
  try {
    const chat = client.chats.create({ model: geminiModels.smartBot, config: { systemInstruction: "You are NeBu SmartBot, an AI assistant for businesses in Tanzania." } });
    const response = await chat.sendMessage({ message });
    if (!response || !response.text) throw new Error("Empty response");
    return response;
  } catch (error) {
    return { text: handleGeminiError(error) };
  }
};

export const quickGenerate = async (prompt: string) => {
  const client = getAI();
  if (!client) return "";
  try {
    const response = await client.models.generateContent({ model: geminiModels.fastBot, contents: prompt });
    return response.text || "";
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota') || error.status === 429) {
        console.warn("Quick Gen: AI Quota Exceeded");
        return "⚠️ AI Limit Reached";
    }
    console.error("Quick Gen Error:", error);
    return "";
  }
};

export const analyzeImage = async (base64Image: string, prompt: string) => {
  const client = getAI();
  if (!client) return "AI Vision Unavailable";
  try {
    const response = await client.models.generateContent({
        model: geminiModels.vision,
        contents: { parts: [{ inlineData: { mimeType: 'image/png', data: base64Image } }, { text: prompt }] }
    });
    return response.text || "Analysis complete.";
  } catch (error) {
    return handleGeminiError(error);
  }
};

export const searchNearby = async (query: string, lat: number, lng: number) => {
  const client = getAI();
  if (!client) return { text: "Maps service unavailable.", candidates: [] };
  try {
    return await client.models.generateContent({
        model: geminiModels.maps,
        contents: query,
        config: { tools: [{ googleMaps: {} }], toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } } }
    });
  } catch (error) {
    console.error("Maps API Error:", error);
    return { text: handleGeminiError(error), candidates: [] };
  }
};

export const generateMarketingImage = async (prompt: string, aspectRatio: string = '1:1') => {
  const client = getAI();
  if (!client) return "";
  try {
    const response = await client.models.generateImages({
        model: geminiModels.imageGen, prompt, config: { numberOfImages: 1, aspectRatio, outputMimeType: 'image/jpeg' },
    });
    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64ImageBytes) return `data:image/jpeg;base64,${base64ImageBytes}`;
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const editMarketingImage = async (base64Image: string, prompt: string) => {
  const client = getAI();
  if (!client) return base64Image;
  try {
    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const response = await client.models.generateContent({
        model: geminiModels.imageEdit,
        contents: { parts: [{ inlineData: { data: cleanBase64, mimeType: 'image/png' } }, { text: prompt }] },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Image Edit Error:", error);
    return base64Image;
  }
};

export const generateMarketingVideo = async (prompt: string) => {
  const client = getAI();
  const apiKey = getApiKey();
  if (!client || !apiKey) return "";
  try {
    let operation = await client.models.generateVideos({
        model: geminiModels.videoGen, prompt, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
    });
    let retry = 0;
    while (!operation.done && retry < 20) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await client.operations.getVideosOperation({ operation });
        retry++;
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        const response = await fetch(`${videoUri}&key=${apiKey}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }
    throw new Error("Video generation timed out or failed");
  } catch (error) {
    console.error("Video Gen Error:", error);
    throw error;
  }
};