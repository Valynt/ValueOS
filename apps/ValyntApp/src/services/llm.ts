/**
 * LLM Service Client
 * 
 * Client-side service to interact with the LLM API.
 * Uses Together.ai via the backend /api/llm endpoints.
 */

import { CircuitBreakerManager } from './CircuitBreaker';
import { ExternalCircuitBreaker } from './ExternalCircuitBreaker';

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

// Together.ai direct API (for client-side calls when backend not available)
const TOGETHER_API_URL = 'https://api.together.xyz/v1';
const TOGETHER_API_KEY = import.meta.env.VITE_TOGETHER_API_KEY || '';

const TOGETHER_BREAKER_KEY = 'external:together_ai:chat';

type TogetherRetryPolicy = {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterFactor: number;
};

// Mirrors AgentRetryManager#getDefaultRetryOptions() exponential backoff defaults.
const DEFAULT_TOGETHER_RETRY_POLICY: TogetherRetryPolicy = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

type LLMServiceDeps = {
  togetherCircuitBreaker?: ExternalCircuitBreaker;
  retryPolicy?: Partial<TogetherRetryPolicy>;
  sleep?: (ms: number) => Promise<void>;
};

class TogetherOperationError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'TogetherOperationError';
  }
}

/**
 * LLM Service for client-side usage
 */
class LLMService {
  private baseUrl: string;
  private togetherApiKey: string;
  private togetherCircuitBreaker: ExternalCircuitBreaker;
  private retryPolicy: TogetherRetryPolicy;
  private sleep: (ms: number) => Promise<void>;

  constructor(baseUrl: string = API_BASE_URL, togetherApiKey: string = TOGETHER_API_KEY, deps: LLMServiceDeps = {}) {
    this.baseUrl = baseUrl;
    this.togetherApiKey = togetherApiKey;
    this.togetherCircuitBreaker = deps.togetherCircuitBreaker ?? new ExternalCircuitBreaker('together_ai', new CircuitBreakerManager());
    this.retryPolicy = {
      ...DEFAULT_TOGETHER_RETRY_POLICY,
      ...deps.retryPolicy,
    };
    this.sleep = deps.sleep ?? ((ms) => new Promise(resolve => setTimeout(resolve, ms)));
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
   * Send a chat completion request directly to Together.ai
   */
  async chatDirect(request: LLMChatRequest): Promise<LLMChatResponse> {
    if (!this.togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }

    return this.executeTogetherOperation(TOGETHER_BREAKER_KEY, async () => {
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
        throw new TogetherOperationError(`Together.ai API error: ${response.status} - ${error}`, response.status);
      }

      const data = await response.json();
      if (!data?.choices?.[0]?.message?.content) {
        throw new Error('Together.ai response schema invalid');
      }

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
    });
  }

  /**
   * Stream a chat completion
   */
  async *streamChat(
    request: LLMChatRequest,
    onChunk?: (chunk: LLMStreamChunk) => void
  ): AsyncGenerator<LLMStreamChunk> {
    // Try direct Together.ai API first if available
    if (this.hasDirectAccess()) {
      yield* this.streamChatDirect(request, onChunk);
      return;
    }

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
   * Stream a chat completion directly to Together.ai
   */
  async *streamChatDirect(
    request: LLMChatRequest,
    onChunk?: (chunk: LLMStreamChunk) => void
  ): AsyncGenerator<LLMStreamChunk> {
    if (!this.togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }

    const model = request.model || DEFAULT_MODEL;

    const response = await this.executeTogetherOperation(TOGETHER_BREAKER_KEY, async () => {
      const streamResponse = await fetch(`${TOGETHER_API_URL}/chat/completions`, {
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
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        const error = await streamResponse.text();
        throw new TogetherOperationError(
          `Together.ai API error: ${streamResponse.status} - ${error}`,
          streamResponse.status
        );
      }

      return streamResponse;
    });

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
        if (dataStr === '[DONE]') {
          const chunk = { content: '', done: true };
          onChunk?.(chunk);
          yield chunk;
          return;
        }

        try {
          const data = JSON.parse(dataStr);
          const content = data.choices?.[0]?.delta?.content || '';

          if (content) {
            const chunk = { content, done: false };
            onChunk?.(chunk);
            yield chunk;
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // Ensure we yield done if we exit loop without [DONE] (e.g. network close)
    const chunk = { content: '', done: true };
    onChunk?.(chunk);
    yield chunk;
  }

  private async executeTogetherOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
    return this.togetherCircuitBreaker.execute(key, async () => {
      return this.executeWithRetry(operation);
    });
  }

  private async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (attempt <= this.retryPolicy.maxRetries) {
      try {
        return await operation();
      } catch (error) {
        if (!this.isRetryableTogetherError(error) || attempt >= this.retryPolicy.maxRetries) {
          throw error;
        }

        attempt += 1;
        const delay = this.calculateRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw new Error('Unexpected Together.ai retry exhaustion');
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.retryPolicy.baseDelay * Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1);
    const jitter = baseDelay * this.retryPolicy.jitterFactor * Math.random();
    return Math.floor(Math.min(baseDelay + jitter, this.retryPolicy.maxDelay));
  }

  private isRetryableTogetherError(error: unknown): boolean {
    if (error instanceof TogetherOperationError) {
      if (error.status === 429) {
        return true;
      }

      if (typeof error.status === 'number' && error.status >= 500) {
        return true;
      }

      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    return /(timeout|timed out|network|connection|failed to fetch|abort)/i.test(message);
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
