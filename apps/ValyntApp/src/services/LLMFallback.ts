/**
 * LLM Service with Circuit Breaker
 *
 * Implements circuit breaker pattern for Together.ai with resilience against service outages and rate limits.
 * Together AI is the only supported LLM provider.
 */

import CircuitBreaker from "opossum";
import { logger } from "../utils/logger";
import { getEnvVar } from "../lib/env";
import { llmCache } from "./LLMCache";
import { llmCostTracker } from "./LLMCostTracker";
import { costGovernance } from "./CostGovernanceService";

export interface LLMRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  sessionId?: string;
  tenantId?: string;
  stream?: boolean;
  dealId?: string;
}

export interface LLMResponse {
  content: string;
  provider: "together_ai" | "cache";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latency: number;
  cached: boolean;
}

export interface CircuitBreakerStats {
  state: "open" | "half-open" | "closed";
  failures: number;
  successes: number;
  fallbacks: number;
  rejects: number;
  fires: number;
}

type LLMFallbackStats = {
  togetherAI: CircuitBreakerStats & { calls: number; failures: number };
  cache: { hits: number; misses: number };
  costGovernance: ReturnType<typeof costGovernance.getSummary>;
};

export class LLMFallbackService {
  private togetherAIBreaker: CircuitBreaker;
  private stats = {
    togetherAI: { calls: 0, failures: 0 },
    cache: { hits: 0, misses: 0 },
  };

  constructor() {
    // Circuit breaker for Together.ai
    this.togetherAIBreaker = new CircuitBreaker(this.callTogetherAI.bind(this), {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
      resetTimeout: 60000, // Try again after 1 minute
      rollingCountTimeout: 10000, // 10 second window
      rollingCountBuckets: 10,
      name: "together-ai",
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up circuit breaker event listeners
   */
  private setupEventListeners(): void {
    this.togetherAIBreaker.on("open", () => {
      logger.warn("Together.ai circuit breaker opened", {
        stats: this.togetherAIBreaker.stats,
      });
    });

    this.togetherAIBreaker.on("halfOpen", () => {
      logger.info("Together.ai circuit breaker half-open (testing)");
    });

    this.togetherAIBreaker.on("close", () => {
      logger.info("Together.ai circuit breaker closed (recovered)");
    });
  }

  /**
   * Call Together.ai API
   */
  private async callTogetherAI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      const togetherApiKey = getEnvVar("TOGETHER_API_KEY");
      if (!togetherApiKey) throw new Error("Together.ai API key not configured");

      const response = await fetch("https://api.together.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${togetherApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: "user", content: request.prompt }],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        }),
        signal: AbortSignal.timeout(25000), // 25 second timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Together.ai API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const result: LLMResponse = {
        content: data.choices[0].message.content,
        provider: "together_ai",
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
        cached: false,
      };

      costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId: request.dealId ?? request.sessionId,
        tokens: result.totalTokens,
        cost: result.cost,
        userId: request.userId,
        model: request.model,
      });

      // Track usage
      await llmCostTracker.trackUsage({
        userId: request.userId,
        sessionId: request.sessionId,
        provider: "together_ai",
        model: request.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        endpoint: "/api/llm/chat",
        success: true,
        latencyMs: latency,
      });

      // Cache response
      await llmCache.set(request.prompt, request.model, result.content, {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
      });

      logger.llm("Together.ai call succeeded", {
        provider: "together_ai",
        model: request.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
        latency,
        success: true,
      });

      return result;
    } catch (error) {
      this.stats.togetherAI.failures++;

      logger.llm("Together.ai call failed", {
        provider: "together_ai",
        model: request.model,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        latency: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Call Together.ai API with streaming
   */
  private async *callTogetherAIStream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      const togetherApiKey = getEnvVar("TOGETHER_API_KEY");
      if (!togetherApiKey) throw new Error("Together.ai API key not configured");

      const response = await fetch("https://api.together.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${togetherApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          messages: [{ role: "user", content: request.prompt }],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
          stream: true,
        }),
        // Increase timeout for streaming connections
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Together.ai API error: ${response.status} - ${error}`);
      }

      if (!response.body) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      // @ts-ignore - response.body is iterable in Node environment
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk as BufferSource, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (trimmed.startsWith("data: ")) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const content = data.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              logger.warn("Error parsing SSE data", { line: trimmed, error: e });
            }
          }
        }
      }

      // Handle any remaining buffer
      if (buffer.trim() && buffer.trim() !== "data: [DONE]") {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const content = data.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            logger.warn("Error parsing SSE data", { line: trimmed, error: e });
          }
        }
      }

      logger.llm("Together.ai stream completed", {
        provider: "together_ai",
        model: request.model,
        success: true,
        latency: Date.now() - startTime,
      });
    } catch (error) {
      this.stats.togetherAI.failures++;

      logger.llm("Together.ai stream failed", {
        provider: "together_ai",
        model: request.model,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        latency: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Process LLM request with circuit breaker
   */
  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    // Check cache first
    const cached = await llmCache.get(request.prompt, request.model);
    if (cached) {
      this.stats.cache.hits++;

      logger.cache("hit", `${request.model}:${request.prompt.substring(0, 50)}`);

      return {
        content: cached.response,
        provider: "cache",
        model: cached.model,
        promptTokens: cached.promptTokens,
        completionTokens: cached.completionTokens,
        totalTokens: cached.promptTokens + cached.completionTokens,
        cost: 0, // No cost for cached responses
        latency: 0,
        cached: true,
      };
    }

    this.stats.cache.misses++;
    const dealId = request.dealId ?? request.sessionId;
<<<<<<< ours
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(request.prompt);
=======
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(
      request.prompt
    );
>>>>>>> theirs
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    costGovernance.checkRequest({
      tenantId: request.tenantId,
      dealId,
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

    // Call Together.ai with circuit breaker
    try {
      const response = await this.togetherAIBreaker.fire(request);
      return response;
    } catch (error) {
      logger.error("Together.ai request failed", error as Error);
      throw new Error("LLM provider unavailable. Please try again later.");
    }
  }

  /**
   * Stream LLM request
   */
  async *streamRequest(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    // Check circuit breaker state
    if (this.togetherAIBreaker.opened) {
      logger.warn("Circuit breaker open, falling back to non-streaming for LLM request", {
        model: request.model,
        userId: request.userId,
      });
      // Fallback to non-streaming response
      const response = await this.processRequest({ ...request, stream: false });
      yield response.content;
      return;
    }

    // Skip cache for streaming requests for now
    this.stats.cache.misses++;
    const dealId = request.dealId ?? request.sessionId;
<<<<<<< ours
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(request.prompt);
=======
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(
      request.prompt
    );
>>>>>>> theirs
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    costGovernance.checkRequest({
      tenantId: request.tenantId,
      dealId,
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

<<<<<<< ours
=======
    // TODO: Implement circuit breaker for streaming
    // Currently bypassing breaker for streaming to support AsyncGenerator return type
>>>>>>> theirs
    try {
      for await (const chunk of this.callTogetherAIStream(request)) {
        yield chunk;
      }
    } finally {
      costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId,
        tokens: estimatedPromptTokens + estimatedCompletionTokens,
        cost: estimatedCost,
        userId: request.userId,
        model: request.model,
      });
    }
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): LLMFallbackStats {
    return {
      togetherAI: {
        ...this.togetherAIBreaker.stats,
        ...this.stats.togetherAI,
      },
      cache: this.stats.cache,
      costGovernance: costGovernance.getSummary(),
    };
  }

  /**
   * Reset circuit breaker (admin function)
   */
  reset(): void {
    this.togetherAIBreaker.close();
    logger.info("Circuit breaker reset");
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    togetherAI: { healthy: boolean; state: string };
  }> {
    return {
      togetherAI: {
        healthy: !this.togetherAIBreaker.opened,
        state: this.togetherAIBreaker.opened
          ? "open"
          : this.togetherAIBreaker.halfOpen
            ? "half-open"
            : "closed",
      },
    };
  }
}

// Export singleton instance
export const llmFallback = new LLMFallbackService();
