import { GoogleGenAI } from '@google/genai';

/**
 * Creates a GoogleGenAI instance.
 * In a non-studio environment, it uses an API key from localStorage.
 * In the AI Studio environment, it relies on the automatically provided process.env.API_KEY.
 */
export const getGoogleGenAI = () => {
  const userApiKey = localStorage.getItem('userApiKey');
  if (userApiKey) {
    return new GoogleGenAI({ apiKey: userApiKey });
  }
  // Fallback for AI Studio environment or if key is not set manually
  return new GoogleGenAI({ apiKey: process.env.API_KEY! });
};
