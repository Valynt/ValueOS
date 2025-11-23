/**
 * LLM Fallback Service with Circuit Breaker
 * 
 * Implements circuit breaker pattern for Together.ai with automatic fallback to OpenAI.
 * Provides resilience against LLM service outages and rate limits.
 */

import CircuitBreaker from 'opossum';
import { logger } from '../utils/logger';
import { llmCache } from './LLMCache';
import { llmCostTracker } from './LLMCostTracker';

export interface LLMRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  sessionId?: string;
}

export interface LLMResponse {
  content: string;
  provider: 'together_ai' | 'openai' | 'cache';
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latency: number;
  cached: boolean;
}

export interface CircuitBreakerStats {
  state: 'open' | 'half-open' | 'closed';
  failures: number;
  successes: number;
  fallbacks: number;
  rejects: number;
  fires: number;
}

export class LLMFallbackService {
  private togetherAIBreaker: CircuitBreaker;
  private openAIBreaker: CircuitBreaker;
  private stats = {
    togetherAI: { calls: 0, failures: 0, fallbacks: 0 },
    openAI: { calls: 0, failures: 0 },
    cache: { hits: 0, misses: 0 }
  };
  
  constructor() {
    // Circuit breaker for Together.ai
    this.togetherAIBreaker = new CircuitBreaker(
      this.callTogetherAI.bind(this),
      {
        timeout: 30000, // 30 seconds
        errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
        resetTimeout: 60000, // Try again after 1 minute
        rollingCountTimeout: 10000, // 10 second window
        rollingCountBuckets: 10,
        name: 'together-ai'
      }
    );
    
    // Circuit breaker for OpenAI (fallback)
    this.openAIBreaker = new CircuitBreaker(
      this.callOpenAI.bind(this),
      {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 60000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        name: 'openai'
      }
    );
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up circuit breaker event listeners
   */
  private setupEventListeners(): void {
    // Together.ai events
    this.togetherAIBreaker.on('open', () => {
      logger.warn('Together.ai circuit breaker opened', {
        stats: this.togetherAIBreaker.stats
      });
    });
    
    this.togetherAIBreaker.on('halfOpen', () => {
      logger.info('Together.ai circuit breaker half-open (testing)');
    });
    
    this.togetherAIBreaker.on('close', () => {
      logger.info('Together.ai circuit breaker closed (recovered)');
    });
    
    this.togetherAIBreaker.on('fallback', () => {
      this.stats.togetherAI.fallbacks++;
      logger.warn('Together.ai fallback triggered, using OpenAI');
    });
    
    // OpenAI events
    this.openAIBreaker.on('open', () => {
      logger.error('OpenAI circuit breaker opened - both LLM providers down!', {
        stats: this.openAIBreaker.stats
      });
    });
    
    this.openAIBreaker.on('close', () => {
      logger.info('OpenAI circuit breaker closed (recovered)');
    });
  }
  
  /**
   * Call Together.ai API
   */
  private async callTogetherAI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;
    
    try {
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7
        }),
        signal: AbortSignal.timeout(25000) // 25 second timeout
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Together.ai API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      const result: LLMResponse = {
        content: data.choices[0].message.content,
        provider: 'together_ai',
        model: request.model,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        cost: llmCostTracker.calculateCost(
          request.model,
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        ),
        latency,
        cached: false
      };
      
      // Track usage
      await llmCostTracker.trackUsage({
        userId: request.userId,
        sessionId: request.sessionId,
        provider: 'together_ai',
        model: request.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        endpoint: '/api/llm/chat',
        success: true,
        latencyMs: latency
      });
      
      // Cache response
      await llmCache.set(
        request.prompt,
        request.model,
        result.content,
        {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          cost: result.cost
        }
      );
      
      logger.llm('Together.ai call succeeded', {
        provider: 'together_ai',
        model: request.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
        latency,
        success: true
      });
      
      return result;
    } catch (error) {
      this.stats.togetherAI.failures++;
      
      logger.llm('Together.ai call failed', {
        provider: 'together_ai',
        model: request.model,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  /**
   * Call OpenAI API (fallback)
   */
  private async callOpenAI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.stats.openAI.calls++;
    
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured - no fallback available');
    }
    
    try {
      // Map Together.ai model to OpenAI equivalent
      const openAIModel = this.mapToOpenAIModel(request.model);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: openAIModel,
          messages: [{ role: 'user', content: request.prompt }],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7
        }),
        signal: AbortSignal.timeout(25000)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      const latency = Date.now() - startTime;
      
      const result: LLMResponse = {
        content: data.choices[0].message.content,
        provider: 'openai',
        model: openAIModel,
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        cost: this.calculateOpenAICost(
          openAIModel,
          data.usage.prompt_tokens,
          data.usage.completion_tokens
        ),
        latency,
        cached: false
      };
      
      // Track usage
      await llmCostTracker.trackUsage({
        userId: request.userId,
        sessionId: request.sessionId,
        provider: 'openai',
        model: openAIModel,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        endpoint: '/api/llm/chat',
        success: true,
        latencyMs: latency
      });
      
      logger.llm('OpenAI fallback succeeded', {
        provider: 'openai',
        model: openAIModel,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
        latency,
        success: true
      });
      
      return result;
    } catch (error) {
      this.stats.openAI.failures++;
      
      logger.llm('OpenAI fallback failed', {
        provider: 'openai',
        model: request.model,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime
      });
      
      throw error;
    }
  }
  
  /**
   * Map Together.ai model to OpenAI equivalent
   */
  private mapToOpenAIModel(togetherModel: string): string {
    const modelMap: Record<string, string> = {
      'meta-llama/Llama-3-70b-chat-hf': 'gpt-4',
      'meta-llama/Llama-3-8b-chat-hf': 'gpt-3.5-turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1': 'gpt-4'
    };
    
    return modelMap[togetherModel] || 'gpt-3.5-turbo';
  }
  
  /**
   * Calculate OpenAI cost
   */
  private calculateOpenAICost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4': { input: 30, output: 60 }, // per 1M tokens
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 }
    };
    
    const price = pricing[model] || pricing['gpt-3.5-turbo'];
    
    return (
      (promptTokens / 1_000_000) * price.input +
      (completionTokens / 1_000_000) * price.output
    );
  }
  
  /**
   * Process LLM request with fallback
   */
  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    // Check cache first
    const cached = await llmCache.get(request.prompt, request.model);
    if (cached) {
      this.stats.cache.hits++;
      
      logger.cache('hit', `${request.model}:${request.prompt.substring(0, 50)}`);
      
      return {
        content: cached.response,
        provider: 'cache',
        model: cached.model,
        promptTokens: cached.promptTokens,
        completionTokens: cached.completionTokens,
        totalTokens: cached.promptTokens + cached.completionTokens,
        cost: 0, // No cost for cached responses
        latency: 0,
        cached: true
      };
    }
    
    this.stats.cache.misses++;
    
    // Try Together.ai with circuit breaker
    try {
      const response = await this.togetherAIBreaker.fire(request);
      return response;
    } catch (error) {
      logger.warn('Together.ai failed, attempting OpenAI fallback', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      // Fallback to OpenAI
      try {
        const response = await this.openAIBreaker.fire(request);
        return response;
      } catch (fallbackError) {
        logger.error('Both LLM providers failed', fallbackError as Error);
        throw new Error('All LLM providers unavailable. Please try again later.');
      }
    }
  }
  
  /**
   * Get circuit breaker statistics
   */
  getStats(): {
    togetherAI: CircuitBreakerStats & typeof this.stats.togetherAI;
    openAI: CircuitBreakerStats & typeof this.stats.openAI;
    cache: typeof this.stats.cache;
  } {
    return {
      togetherAI: {
        ...this.togetherAIBreaker.stats,
        ...this.stats.togetherAI
      },
      openAI: {
        ...this.openAIBreaker.stats,
        ...this.stats.openAI
      },
      cache: this.stats.cache
    };
  }
  
  /**
   * Reset circuit breakers (admin function)
   */
  reset(): void {
    this.togetherAIBreaker.close();
    this.openAIBreaker.close();
    logger.info('Circuit breakers reset');
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<{
    togetherAI: { healthy: boolean; state: string };
    openAI: { healthy: boolean; state: string };
  }> {
    return {
      togetherAI: {
        healthy: !this.togetherAIBreaker.opened,
        state: this.togetherAIBreaker.opened ? 'open' : 
               this.togetherAIBreaker.halfOpen ? 'half-open' : 'closed'
      },
      openAI: {
        healthy: !this.openAIBreaker.opened,
        state: this.openAIBreaker.opened ? 'open' : 
               this.openAIBreaker.halfOpen ? 'half-open' : 'closed'
      }
    };
  }
}

// Export singleton instance
export const llmFallback = new LLMFallbackService();
