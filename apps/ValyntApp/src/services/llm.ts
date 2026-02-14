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
  dealId?: string;
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

/**
 * LLM Service for client-side usage
 */
class LLMService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a chat completion request via backend API
   */
  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
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
        dealId: request.dealId,
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
   * Stream a chat completion
   */
  async *streamChat(
    request: LLMChatRequest,
    onChunk?: (chunk: LLMStreamChunk) => void
  ): AsyncGenerator<LLMStreamChunk> {
    try {
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
          dealId: request.dealId,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `LLM request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.substring(6);
          try {
            const data = JSON.parse(dataStr);
            if (data.error) {
              throw new Error(data.error);
            }

            const chunk: LLMStreamChunk = {
              content: data.content || '',
              done: data.done || false
            };

            onChunk?.(chunk);
            yield chunk;

            if (data.done) return;
          } catch (e) {
            console.error('Failed to parse SSE', e);
          }
        }
      }
    } catch (error) {
      console.error('Stream chat error', error);
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
