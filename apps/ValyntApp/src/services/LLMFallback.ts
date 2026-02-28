/**
 * LLM Service with Circuit Breaker
 *
 * Implements circuit breaker pattern for Together.ai with resilience against service outages and rate limits.
 * Together AI is the only supported LLM provider.
 */

import { getEnvVar } from "../lib/env";
import { logger } from "../utils/logger";

import { costGovernance } from "./CostGovernanceService";
import { ExternalCircuitBreaker } from "./ExternalCircuitBreaker";
import { llmCache } from "./LLMCache";
import { llmCostTracker } from "./LLMCostTracker";

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
  circuitBreakers: Record<string, ReturnType<ExternalCircuitBreaker["getMetrics"]>>;
  cache: { hits: number; misses: number };
  costGovernance: ReturnType<typeof costGovernance.getSummary>;
};

export class LLMFallbackService {
  private readonly circuitBreaker: ExternalCircuitBreaker;
  private readonly togetherChatBreakerKey = "external:together_ai:chat";
  private readonly togetherStreamBreakerKey = "external:together_ai:stream";
  private readonly breakerConfig = {
    minimumSamples: 1,
    failureRateThreshold: 0.5,
    latencyThresholdMs: 20000,
  };
  private stats = {
    togetherAI: { calls: 0, failures: 0 },
    cache: { hits: 0, misses: 0 },
  };

  constructor() {
    this.circuitBreaker = new ExternalCircuitBreaker("together_ai");
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

      const usageDealId = request.dealId ?? request.sessionId;
      costGovernance.recordUsage({
        ...(request.tenantId ? { tenantId: request.tenantId } : {}),
        ...(usageDealId ? { dealId: usageDealId } : {}),
        tokens: result.totalTokens,
        cost: result.cost,
        userId: request.userId,
        model: request.model,
      });

      // Track usage
      await llmCostTracker.trackUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        ...(request.sessionId ? { sessionId: request.sessionId } : {}),
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
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(request.prompt);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    costGovernance.checkRequest({
      ...(request.tenantId ? { tenantId: request.tenantId } : {}),
      ...(dealId ? { dealId } : {}),
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

    // Call Together.ai with circuit breaker
    return this.circuitBreaker.execute(
      this.togetherChatBreakerKey,
      () => this.callTogetherAI(request),
      {
        config: this.breakerConfig,
        fallback: (error, state) => {
          logger.error("Together.ai request failed", error, {
            breakerState: state,
            breakerKey: this.togetherChatBreakerKey,
          });
          throw new Error("LLM provider unavailable. Please try again later.");
        },
      }
    );
  }

  /**
   * Stream LLM request
   */
  async *streamRequest(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    // Skip cache for streaming requests for now
    this.stats.cache.misses++;
    const dealId = request.dealId ?? request.sessionId;
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(request.prompt);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    costGovernance.checkRequest({
      ...(request.tenantId ? { tenantId: request.tenantId } : {}),
      ...(dealId ? { dealId } : {}),
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

    try {
      const chunks = await this.circuitBreaker.execute(
        this.togetherStreamBreakerKey,
        async () => {
          const streamed: string[] = [];
          for await (const chunk of this.callTogetherAIStream(request)) {
            streamed.push(chunk);
          }
          return streamed;
        },
        {
          config: this.breakerConfig,
          fallback: async () => {
            logger.warn("Circuit breaker fallback to non-streaming LLM response", {
              model: request.model,
              userId: request.userId,
              breakerKey: this.togetherStreamBreakerKey,
            });
            const response = await this.processRequest({ ...request, stream: false });
            return [response.content];
          },
        }
      );

      for (const chunk of chunks) {
        yield chunk;
      }
    } finally {
      costGovernance.recordUsage({
        ...(request.tenantId ? { tenantId: request.tenantId } : {}),
        ...(dealId ? { dealId } : {}),
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
    const chatMetrics = this.circuitBreaker.getMetrics(this.togetherChatBreakerKey);
    const streamMetrics = this.circuitBreaker.getMetrics(this.togetherStreamBreakerKey);

    return {
      togetherAI: {
        state:
          chatMetrics.state === "half_open"
            ? "half-open"
            : chatMetrics.state,
        failures: chatMetrics.failedRequests,
        successes: chatMetrics.successfulRequests,
        fallbacks: 0,
        rejects: 0,
        fires: chatMetrics.totalRequests,
        calls: this.stats.togetherAI.calls,
      },
      circuitBreakers: {
        [this.togetherChatBreakerKey]: chatMetrics,
        [this.togetherStreamBreakerKey]: streamMetrics,
      },
      cache: this.stats.cache,
      costGovernance: costGovernance.getSummary(),
    };
  }

  /**
   * Reset circuit breaker (admin function)
   */
  reset(): void {
    this.circuitBreaker.reset(this.togetherChatBreakerKey);
    this.circuitBreaker.reset(this.togetherStreamBreakerKey);
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
        healthy: this.circuitBreaker.getState(this.togetherChatBreakerKey) !== "open",
        state:
          this.circuitBreaker.getState(this.togetherChatBreakerKey) === "half_open"
            ? "half-open"
            : this.circuitBreaker.getState(this.togetherChatBreakerKey),
      },
    };
  }
}

// Export singleton instance
export const llmFallback = new LLMFallbackService();
