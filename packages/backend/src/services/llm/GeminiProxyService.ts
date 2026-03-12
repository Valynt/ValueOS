/**
 * Gemini API Proxy Service
 *
 * Secure backend proxy for Gemini API calls.
 * Removes API key exposure from client-side code.
 */

import { logger } from '../../lib/logger.js'

interface GeminiRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    responseMimeType?: string;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

export class GeminiProxyService {
  private baseUrl: string;

  constructor() {
    // Use relative URL to go through our backend proxy
    this.baseUrl = '/api/ai/gemini';
  }

  /**
   * Call Gemini API through secure backend proxy
   */
  async generateContent(request: GeminiRequest): Promise<string> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
      }

      const result: GeminiResponse = await response.json();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('No content in Gemini response');
      }

      return textResponse;
    } catch (error) {
      logger.error('Gemini proxy service error', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Health check for the proxy service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      logger.error('Gemini proxy health check failed', error instanceof Error ? error : undefined);
      return false;
    }
  }
}

export const geminiProxyService = new GeminiProxyService();
