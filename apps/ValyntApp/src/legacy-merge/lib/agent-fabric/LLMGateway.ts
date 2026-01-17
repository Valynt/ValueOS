/**
 * LLM Gateway
 *
 * Provides abstraction layer for LLM providers with unified interface,
 * rate limiting, circuit breaking, and cost tracking.
 */

import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Provider Types
// ============================================================================

export type LLMProvider = "openai" | "anthropic" | "together" | "replicate";

export interface LLMRequest {
  id?: string;
  provider: LLMProvider;
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  provider: LLMProvider;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "content_filter";
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  metadata?: Record<string, unknown>;
}

export interface LLMProviderConfig {
  apiKey: string;
  baseUrl?: string;
  maxRequestsPerSecond: number;
  maxTokensPerMinute: number;
  timeoutMs: number;
  retryAttempts: number;
  pricing: {
    inputTokenCost: number;
    outputTokenCost: number;
  };
}

// ============================================================================
// Provider Implementations
// ============================================================================

abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected requestCount = 0;
  protected tokenCount = 0;
  protected lastResetTime = Date.now();

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  abstract execute(request: Omit<LLMRequest, "id" | "provider">): Promise<LLMResponse>;

  protected checkRateLimits(): void {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counters every minute
    if (timeSinceReset > 60000) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.lastResetTime = now;
    }

    if (this.requestCount >= this.config.maxRequestsPerSecond * 60) {
      throw new Error(`Rate limit exceeded: ${this.requestCount} requests in the last minute`);
    }
  }

  protected calculateCost(inputTokens: number, outputTokens: number): number {
    return (
      inputTokens * this.config.pricing.inputTokenCost +
      outputTokens * this.config.pricing.outputTokenCost
    );
  }

  protected updateCounters(inputTokens: number, outputTokens: number): void {
    this.requestCount++;
    this.tokenCount += inputTokens + outputTokens;
  }
}

class OpenAIProvider extends BaseLLMProvider {
  async execute(request: Omit<LLMRequest, "id" | "provider">): Promise<LLMResponse> {
    this.checkRateLimits();

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 1000,
          stop: request.stopSequences,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices[0];
      const usage = data.usage;

      const inputTokens = usage.prompt_tokens;
      const outputTokens = usage.completion_tokens;
      const totalTokens = usage.total_tokens;

      this.updateCounters(inputTokens, outputTokens);

      const llmResponse: LLMResponse = {
        id: data.id,
        requestId,
        provider: "openai",
        model: request.model,
        content: choice.message.content,
        finishReason: choice.finish_reason,
        tokenUsage: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        cost: this.calculateCost(inputTokens, outputTokens),
        latency: Date.now() - startTime,
        metadata: {
          created: data.created,
          systemFingerprint: data.system_fingerprint,
        },
      };

      logger.debug("OpenAI request completed", {
        requestId,
        model: request.model,
        inputTokens,
        outputTokens,
        cost: llmResponse.cost,
        latency: llmResponse.latency,
      });

      return llmResponse;
    } catch (error) {
      logger.error("OpenAI request failed", error as Error, {
        model: request.model,
      });
      throw error;
    }
  }
}

class AnthropicProvider extends BaseLLMProvider {
  async execute(request: Omit<LLMRequest, "id" | "provider">): Promise<LLMResponse> {
    this.checkRateLimits();

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.config.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
          stop_sequences: request.stopSequences,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const usage = data.usage;

      const inputTokens = usage.input_tokens;
      const outputTokens = usage.output_tokens;

      this.updateCounters(inputTokens, outputTokens);

      const llmResponse: LLMResponse = {
        id: data.id,
        requestId,
        provider: "anthropic",
        model: request.model,
        content: data.content[0].text,
        finishReason: data.stop_reason === "end_turn" ? "stop" : "length",
        tokenUsage: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
        cost: this.calculateCost(inputTokens, outputTokens),
        latency: Date.now() - startTime,
        metadata: {
          stopReason: data.stop_reason,
          stopSequence: data.stop_sequence,
        },
      };

      logger.debug("Anthropic request completed", {
        requestId,
        model: request.model,
        inputTokens,
        outputTokens,
        cost: llmResponse.cost,
        latency: llmResponse.latency,
      });

      return llmResponse;
    } catch (error) {
      logger.error("Anthropic request failed", error as Error, {
        model: request.model,
      });
      throw error;
    }
  }
}

// ============================================================================
// LLM Gateway Implementation
// ============================================================================

export class LLMGateway {
  private providers: Map<LLMProvider, BaseLLMProvider> = new Map();
  private defaultProvider: LLMProvider = "openai";

  constructor(configs: Record<LLMProvider, LLMProviderConfig>) {
    // Initialize providers
    if (configs.openai) {
      this.providers.set("openai", new OpenAIProvider(configs.openai));
    }
    if (configs.anthropic) {
      this.providers.set("anthropic", new AnthropicProvider(configs.anthropic));
    }
    // Add other providers as needed

    logger.info("LLM Gateway initialized", {
      providers: Array.from(this.providers.keys()),
      defaultProvider: this.defaultProvider,
    });
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const enrichedRequest: LLMRequest = {
      id: uuidv4(),
      ...request,
    };

    const provider = this.providers.get(request.provider);
    if (!provider) {
      throw new Error(`Unsupported LLM provider: ${request.provider}`);
    }

    logger.info("Executing LLM request", {
      requestId: enrichedRequest.id,
      provider: request.provider,
      model: request.model,
      messageCount: request.messages.length,
    });

    try {
      const response = await provider.execute(request);

      logger.info("LLM request completed successfully", {
        requestId: enrichedRequest.id,
        provider: request.provider,
        model: request.model,
        cost: response.cost,
        latency: response.latency,
      });

      return response;
    } catch (error) {
      logger.error("LLM request failed", error as Error, {
        requestId: enrichedRequest.id,
        provider: request.provider,
        model: request.model,
      });
      throw error;
    }
  }

  setDefaultProvider(provider: LLMProvider): void {
    if (!this.providers.has(provider)) {
      throw new Error(`Cannot set default provider: ${provider} not configured`);
    }
    this.defaultProvider = provider;
    logger.info("Default LLM provider changed", { provider });
  }

  getSupportedProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }

  getProviderStats(provider: LLMProvider):
    | {
        requestsPerMinute: number;
        tokensPerMinute: number;
      }
    | undefined {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return undefined;

    // Access protected properties through type assertion
    const instance = providerInstance as any;
    return {
      requestsPerMinute: instance.requestCount || 0,
      tokensPerMinute: instance.tokenCount || 0,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLLMGateway(): LLMGateway {
  // Default configuration - in production, these would come from environment variables
  const configs: Record<LLMProvider, LLMProviderConfig> = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      maxRequestsPerSecond: 10,
      maxTokensPerMinute: 100000,
      timeoutMs: 30000,
      retryAttempts: 3,
      pricing: {
        inputTokenCost: 0.000001, // $0.001 per 1K tokens
        outputTokenCost: 0.000002, // $0.002 per 1K tokens
      },
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      maxRequestsPerSecond: 5,
      maxTokensPerMinute: 50000,
      timeoutMs: 45000,
      retryAttempts: 3,
      pricing: {
        inputTokenCost: 0.000003, // $0.003 per 1K tokens
        outputTokenCost: 0.000015, // $0.015 per 1K tokens
      },
    },
    // Add other providers as needed
    together: {
      apiKey: process.env.TOGETHER_API_KEY || "",
      maxRequestsPerSecond: 20,
      maxTokensPerMinute: 200000,
      timeoutMs: 30000,
      retryAttempts: 3,
      pricing: {
        inputTokenCost: 0.0000005,
        outputTokenCost: 0.000001,
      },
    },
    replicate: {
      apiKey: process.env.REPLICATE_API_KEY || "",
      maxRequestsPerSecond: 10,
      maxTokensPerMinute: 100000,
      timeoutMs: 60000,
      retryAttempts: 3,
      pricing: {
        inputTokenCost: 0.0000008,
        outputTokenCost: 0.000002,
      },
    },
  };

  return new LLMGateway(configs);
}
