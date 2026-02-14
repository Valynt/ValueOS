/**
 * LLM Service with Circuit Breaker
 *
 * Implements circuit breaker pattern for Together.ai with resilience against service outages and rate limits.
 * Together AI is the only supported LLM provider.
 */

import { logger } from "../utils/logger.js"
import { getEnvVar } from "@shared/lib/env";
import { llmCache } from "./LLMCache.js"
import { llmCostTracker } from "./LLMCostTracker.js"
import { costGovernance } from "./CostGovernanceService.js"
import { ExternalCircuitBreaker } from "./ExternalCircuitBreaker.js"
import { assertModelAllowed } from '../config/models.js'

export interface LLMRequest {
  prompt: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  sessionId?: string;
  tenantId?: string;
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
  costGovernance: Awaited<ReturnType<typeof costGovernance.getSummary>>;
};

export class LLMFallbackService {
  private readonly circuitBreaker: ExternalCircuitBreaker;
  private readonly togetherChatBreakerKey = "external:together_ai:chat";
  private readonly togetherStreamBreakerKey = "external:together_ai:stream";
  private readonly breakerConfig = {
    windowMs: 10000,
    failureRateThreshold: 0.5,
    latencyThresholdMs: 30000,
    minimumSamples: 10,
    timeoutMs: 60000,
    halfOpenMaxProbes: 1,
  };
  private stats = {
    togetherAI: { calls: 0, failures: 0, fallbacks: 0 },
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
      if (!togetherApiKey)
        throw new Error("Together.ai API key not configured");

      const response = await fetch(
        "https://api.together.ai/v1/chat/completions",
        {
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
        }
      );

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

      await costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId: request.dealId ?? request.sessionId,
        tokens: result.totalTokens,
        cost: result.cost,
        userId: request.userId,
        model: request.model,
      });

      // Track usage
      await llmCostTracker.trackUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        provider: "together_ai",
        model: request.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        caller: "LLMFallback.callTogetherAI",
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
   * Process LLM request with circuit breaker
   */
  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    // Default model to configured Together primary if caller omitted it
    if (!request.model) {
      request.model = (getEnvVar('TOGETHER_PRIMARY_MODEL_NAME') as string) || request.model || 'gpt-4o-mini';
    }

    assertModelAllowed('together_ai', request.model);

    // Check cache first
    const cached = await llmCache.get(request.prompt, request.model);
    if (cached) {
      this.stats.cache.hits++;

      logger.cache(
        "hit",
        `${request.model}:${request.prompt.substring(0, 50)}`
      );

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
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(
      request.prompt
    );
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    await costGovernance.checkRequest({
      tenantId: request.tenantId,
      dealId,
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

    // Primary retry + optional secondary fallback
    const primaryModel = request.model;
    const primaryMaxRetries = Number(getEnvVar('LLM_FALLBACK_MAX_ATTEMPTS') || '1');
    const retryBackoffMs = Number(getEnvVar('LLM_RETRY_BACKOFF_MS') || '200');
    const fallbackEnabled = getEnvVar('LLM_FALLBACK_ENABLED', { defaultValue: 'true' }) !== 'false';
    const secondaryModel = getEnvVar('TOGETHER_SECONDARY_MODEL_NAME');

    let lastError: any = null;

    const isTransient = (err: any) => {
      const msg = err instanceof Error ? err.message : String(err);
      return /timeout|ETIMEDOUT|429|5\d{2}|rate limit/i.test(msg);
    };

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // Try primary with retries
    for (let attempt = 0; attempt <= primaryMaxRetries; attempt++) {
      try {
        const resp = await this.circuitBreaker.execute(
          this.togetherChatBreakerKey,
          () => this.callTogetherAI(request),
          { config: this.breakerConfig }
        );

        // annotate metadata
        resp.metadata = { ...(resp.metadata || {}), retry_attempts: attempt, model_used: request.model, fallback_triggered: false };
        return resp;
      } catch (err) {
        lastError = err;
        // if non-transient or we've exhausted attempts, break to fallback logic
        if (!isTransient(err) || attempt === primaryMaxRetries) break;
        const jitter = Math.floor(Math.random() * retryBackoffMs);
        await sleep(retryBackoffMs + jitter);
      }
    }

    // Primary exhausted — attempt secondary if enabled/configured
    if (fallbackEnabled && secondaryModel) {
      try {
        assertModelAllowed('together_ai', String(secondaryModel));
        const secondaryReq = { ...request, model: String(secondaryModel) };
        const secResp = await this.circuitBreaker.execute(
          this.togetherChatBreakerKey,
          () => this.callTogetherAI(secondaryReq),
          { config: this.breakerConfig }
        );

        // Track fallback usage
        this.stats.togetherAI.fallbacks = (this.stats.togetherAI.fallbacks || 0) + 1;

        secResp.metadata = {
          ...(secResp.metadata || {}),
          fallback_triggered: true,
          fallback_reason: lastError instanceof Error ? lastError.message : String(lastError),
          model_used: secondaryReq.model,
          retry_attempts: primaryMaxRetries,
        };

        logger.warn('LLMFallback used secondary model after primary failures', {
          primary: primaryModel,
          secondary: secondaryReq.model,
          fallback_reason: secResp.metadata?.fallback_reason,
        });

        return secResp;
      } catch (secErr) {
        logger.error('Together.ai secondary fallback failed', secErr as Error);
        throw new Error('LLM provider unavailable. Please try again later.');
      }
    }

    logger.error('Together.ai request failed (primary exhausted, no fallback available)', lastError as Error);
    throw new Error('LLM provider unavailable. Please try again later.');
  }
  }

  /**
   * Process LLM request with streaming
   */
  async *streamRequest(
    request: LLMRequest
  ): AsyncGenerator<{ content: string; done: boolean }> {
    assertModelAllowed('together_ai', request.model);

    // Check cache first
    const cached = await llmCache.get(request.prompt, request.model);
    if (cached) {
      this.stats.cache.hits++;
      logger.cache(
        "hit",
        `${request.model}:${request.prompt.substring(0, 50)}`
      );

      yield { content: cached.response, done: true };
      return;
    }

    this.stats.cache.misses++;
    const dealId = request.dealId ?? request.sessionId;
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(
      request.prompt
    );
    const estimatedCompletionTokens = request.maxTokens || 1000;
    const estimatedCost = llmCostTracker.calculateCost(
      request.model,
      estimatedPromptTokens,
      estimatedCompletionTokens
    );
    await costGovernance.checkRequest({
      tenantId: request.tenantId,
      dealId,
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost,
      userId: request.userId,
      model: request.model,
    });

    try {
      const chunks = await this.circuitBreaker.execute(
        this.togetherStreamBreakerKey,
        async () => {
          const streamed: { content: string; done: boolean }[] = [];
          for await (const chunk of this.callTogetherAIStream(request)) {
            streamed.push(chunk);
          }
          return streamed;
        },
        { config: this.breakerConfig }
      );

      for (const chunk of chunks) {
        yield chunk;
      }
    } catch (error) {
      logger.error("Together.ai stream failed", error as Error);
      throw new Error("LLM provider unavailable. Please try again later.");
    }
  }

  /**
   * Call Together.ai API with streaming
   */
  private async *callTogetherAIStream(
    request: LLMRequest
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      const togetherApiKey = getEnvVar("TOGETHER_API_KEY");
      if (!togetherApiKey)
        throw new Error("Together.ai API key not configured");

      const response = await fetch(
        "https://api.together.ai/v1/chat/completions",
        {
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
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Together.ai API error: ${response.status} - ${error}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let buffer = "";
      let usage: any = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the last incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.substring(6); // Remove 'data: '
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);

              // Together AI sends usage in the last chunk or separate chunk
              if (data.usage) {
                usage = data.usage;
              }

              const content = data.choices?.[0]?.delta?.content || "";
              if (content) {
                accumulatedContent += content;
                yield { content, done: false };
              }
            } catch (e) {
              // Ignore parse errors for partial lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Final yield to signal done
      yield { content: "", done: true };

      // Calculate stats and cache
      const latency = Date.now() - startTime;

      const promptTokens = usage?.prompt_tokens || 0;
      const completionTokens = usage?.completion_tokens || 0;

      const cost = llmCostTracker.calculateCost(
        request.model,
        promptTokens,
        completionTokens
      );

      await costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId: request.dealId ?? request.sessionId,
        tokens: promptTokens + completionTokens,
        cost,
        userId: request.userId,
        model: request.model,
      });

      // Track usage
      await llmCostTracker.trackUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        provider: "together_ai",
        model: request.model,
        promptTokens,
        completionTokens,
        caller: "LLMFallback.streamTogetherAI",
        endpoint: "/api/llm/chat",
        success: true,
        latencyMs: latency,
      });

      // Cache response
      await llmCache.set(request.prompt, request.model, accumulatedContent, {
        promptTokens,
        completionTokens,
        cost,
      });

      logger.llm("Together.ai stream succeeded", {
        provider: "together_ai",
        model: request.model,
        latency,
        success: true,
      });
    } catch (error) {
      this.stats.togetherAI.failures++;
      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   */
  async getStats(): Promise<LLMFallbackStats> {
    const chatMetrics = this.circuitBreaker.getMetrics(
      this.togetherChatBreakerKey
    );
    const streamMetrics = this.circuitBreaker.getMetrics(
      this.togetherStreamBreakerKey
    );

    return {
      togetherAI: {
        state:
          chatMetrics.state === "half_open"
            ? "half-open"
            : chatMetrics.state,
        failures: chatMetrics.failedRequests,
        successes: chatMetrics.successfulRequests,
        fallbacks: this.stats.togetherAI.fallbacks || 0,
        rejects: 0,
        fires: chatMetrics.totalRequests,
        calls: this.stats.togetherAI.calls,
      },
      circuitBreakers: {
        [this.togetherChatBreakerKey]: chatMetrics,
        [this.togetherStreamBreakerKey]: streamMetrics,
      },
      cache: this.stats.cache,
      costGovernance: await costGovernance.getSummary(),
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
        healthy:
          this.circuitBreaker.getState(this.togetherChatBreakerKey) !== "open",
        state:
          this.circuitBreaker.getState(this.togetherChatBreakerKey) ===
          "half_open"
            ? "half-open"
            : this.circuitBreaker.getState(this.togetherChatBreakerKey),
      },
    };
  }
}

// Export singleton instance
export const llmFallback = new LLMFallbackService();
