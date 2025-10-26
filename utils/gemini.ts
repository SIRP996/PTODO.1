
import { GoogleGenAI } from '@google/genai';

/**
 * Creates a GoogleGenAI instance.
 * It uses an 'active' API key from localStorage, which is managed by the App component.
 * This allows the key to be user-specific without this utility needing to know about the user.
 * It falls back to the AI Studio environment key if available.
 * Returns null if no key can be found.
 */
export const getGoogleGenAI = () => {
  const apiKey = localStorage.getItem('active_genai_api_key') || process.env.API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({ apiKey });
};
