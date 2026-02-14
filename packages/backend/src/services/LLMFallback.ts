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
import { LLMGateway } from '../lib/agent-fabric/LLMGateway.js'

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
  private readonly gateway: LLMGateway;
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
    this.gateway = new LLMGateway({
      provider: 'together',
      model: (getEnvVar('TOGETHER_PRIMARY_MODEL_NAME') as string) || 'gpt-4o-mini',
      timeout_ms: 25000,
    });
  }

  /**
   * Call Together.ai API through the centralized LLM gateway.
   */
  private async callTogetherAI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      const response = await this.gateway.completeRaw({
        model: request.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        metadata: {
          tenantId: request.tenantId ?? 'unknown',
          userId: request.userId,
          sessionId: request.sessionId,
          dealId: request.dealId,
        },
      });

      const latency = Date.now() - startTime;
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

      const result: LLMResponse = {
        content: response.content,
        provider: 'together_ai',
        model: response.model,
        promptTokens,
        completionTokens,
        totalTokens,
        cost: llmCostTracker.calculateCost(response.model, promptTokens, completionTokens),
        latency,
        cached: false,
      };

      await costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId: request.dealId ?? request.sessionId,
        tokens: result.totalTokens,
        cost: result.cost,
        userId: request.userId,
        model: result.model,
      });

      await llmCostTracker.trackUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        provider: 'together_ai',
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        caller: 'LLMFallback.callTogetherAI',
        endpoint: '/api/llm/chat',
        success: true,
        latencyMs: latency,
      });

      await llmCache.set(request.prompt, result.model, result.content, {
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
      });

      logger.llm('Together.ai call succeeded', {
        provider: 'together_ai',
        model: result.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        cost: result.cost,
        latency,
        success: true,
      });

      return result;
    } catch (error) {
      this.stats.togetherAI.failures++;

      logger.llm('Together.ai call failed', {
        provider: 'together_ai',
        model: request.model,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

        logger.warn('LLMFallback used secondary model after primary failures', {
          primary: primaryModel,
          secondary: secondaryReq.model,
          fallback_reason: lastError instanceof Error ? lastError.message : String(lastError),
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
   * Call Together.ai API with streaming through the centralized LLM gateway.
   */
  private async *callTogetherAIStream(
    request: LLMRequest
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      let accumulatedContent = '';
      let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;

      for await (const chunk of this.gateway.completeRawStream({
        model: request.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        metadata: {
          tenantId: request.tenantId ?? 'unknown',
          userId: request.userId,
          sessionId: request.sessionId,
          dealId: request.dealId,
        },
      })) {
        if (chunk.done) {
          usage = chunk.usage;
          continue;
        }

        accumulatedContent += chunk.content;
        yield { content: chunk.content, done: false };
      }

      yield { content: '', done: true };

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

      await llmCostTracker.trackUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
        provider: 'together_ai',
        model: request.model,
        promptTokens,
        completionTokens,
        caller: 'LLMFallback.streamTogetherAI',
        endpoint: '/api/llm/chat',
        success: true,
        latencyMs: latency,
      });

      await llmCache.set(request.prompt, request.model, accumulatedContent, {
        promptTokens,
        completionTokens,
        cost,
      });

      logger.llm('Together.ai stream succeeded', {
        provider: 'together_ai',
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
