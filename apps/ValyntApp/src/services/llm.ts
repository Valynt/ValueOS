/**
 * LLM Service Client
 * 
 * Client-side service to interact with the LLM API.
 * Uses Together.ai via the backend /api/llm endpoints.
 */

export interface LLMChatRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMChatResponse {
  content: string;
  provider: 'together_ai' | 'cache';
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  latency: number;
  cached: boolean;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

// Default model - Mixtral for complex reasoning
const DEFAULT_MODEL = 'mistralai/Mixtral-8x7B-Instruct-v0.1';

// API base URL - use environment variable or default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Together.ai direct API (for client-side calls when backend not available)
const TOGETHER_API_URL = 'https://api.together.xyz/v1';
const TOGETHER_API_KEY = import.meta.env.VITE_TOGETHER_API_KEY || '';

/**
 * LLM Service for client-side usage
 */
class LLMService {
  private baseUrl: string;
  private togetherApiKey: string;

  constructor(baseUrl: string = API_BASE_URL, togetherApiKey: string = TOGETHER_API_KEY) {
    this.baseUrl = baseUrl;
    this.togetherApiKey = togetherApiKey;
  }

  /**
   * Check if direct Together.ai API is available
   */
  hasDirectAccess(): boolean {
    return !!this.togetherApiKey;
  }

  /**
   * Send a chat completion request via backend API
   */
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    // Try direct Together.ai API first if available
    if (this.hasDirectAccess()) {
      return this.chatDirect(request);
    }

    // Fall back to backend API
    const response = await fetch(`${this.baseUrl}/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || DEFAULT_MODEL,
        maxTokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `LLM request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'LLM request failed');
    }

    return data.data;
  }

  /**
   * Send a chat completion request directly to Together.ai
   */
  async chatDirect(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || DEFAULT_MODEL;

    const response = await fetch(`${TOGETHER_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.togetherApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Together.ai API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    return {
      content: data.choices[0].message.content,
      provider: 'together_ai',
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      cost: 0, // Cost tracking not available in direct mode
      latency,
      cached: false,
    };
  }

  /**
   * Stream a chat completion (if supported by backend)
   * Falls back to regular chat if streaming not available
   */
  async *streamChat(
    request: LLMChatRequest,
    onChunk?: (chunk: LLMStreamChunk) => void
  ): AsyncGenerator<LLMStreamChunk> {
    // For now, use regular chat and simulate streaming
    // TODO: Implement real streaming when backend supports it
    try {
      const response = await this.chat(request);
      
      // Simulate streaming by yielding words
      const words = response.content.split(' ');
      let accumulated = '';
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '');
        accumulated += word;
        
        const chunk: LLMStreamChunk = {
          content: word,
          done: i === words.length - 1,
        };
        
        onChunk?.(chunk);
        yield chunk;
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get LLM service statistics
   */
  async getStats(): Promise<{
    togetherAI: {
      state: string;
      calls: number;
      failures: number;
    };
    cache: {
      hits: number;
      misses: number;
    };
  }> {
    const response = await fetch(`${this.baseUrl}/llm/stats`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to get LLM stats: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  }

  /**
   * Check LLM service health
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    togetherAI: {
      healthy: boolean;
      state: string;
    };
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/llm/health`, {
        credentials: 'include',
      });

      const data = await response.json();
      
      return {
        healthy: response.ok && data.success,
        togetherAI: data.data?.togetherAI || { healthy: false, state: 'unknown' },
      };
    } catch {
      return {
        healthy: false,
        togetherAI: { healthy: false, state: 'unreachable' },
      };
    }
  }
}

// Export singleton instance
export const llmService = new LLMService();

// Export for custom instances
export { LLMService };

// Available models
export const AVAILABLE_MODELS = {
  // Mixtral - best for complex reasoning
  MIXTRAL_8X7B: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  
  // Llama 3 - good balance of speed and quality
  LLAMA_3_70B: 'meta-llama/Llama-3-70b-chat-hf',
  LLAMA_3_8B: 'meta-llama/Llama-3-8b-chat-hf',
  
  // Code-specific
  CODELLAMA_34B: 'codellama/CodeLlama-34b-Instruct-hf',
  
  // Fast/cheap for simple tasks
  MISTRAL_7B: 'mistralai/Mistral-7B-Instruct-v0.2',
} as const;

export type AvailableModel = typeof AVAILABLE_MODELS[keyof typeof AVAILABLE_MODELS];
