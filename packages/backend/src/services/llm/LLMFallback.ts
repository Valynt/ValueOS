/**
 * LLM Service with Circuit Breaker and Multi-Provider Fallback
 *
 * Primary provider: Together.ai (configured via TOGETHER_PRIMARY_MODEL_NAME).
 * Secondary model:  A different model on Together.ai (TOGETHER_SECONDARY_MODEL_NAME).
 * Provider fallback: A second LLM provider (LLM_FALLBACK_PROVIDER + LLM_FALLBACK_MODEL)
 *                    used when Together.ai is fully unavailable (outage, rate-limit
 *                    exhaustion, account suspension). Supported values for
 *                    LLM_FALLBACK_PROVIDER: "openai".
 *
 * Execution order on failure:
 *   1. Together.ai primary model (with retries)
 *   2. Together.ai secondary model (TOGETHER_SECONDARY_MODEL_NAME)
 *   3. Provider fallback (LLM_FALLBACK_PROVIDER / LLM_FALLBACK_MODEL)
 */

import OpenAI from "openai";

import { getEnvVar } from "@shared/lib/env";

import { assertModelAllowed } from '../config/models.js'
import { LLMGateway } from '../lib/agent-fabric/LLMGateway.js'
import { llmCacheHitsTotal, llmProviderActive, llmProviderFallbackActivationsTotal } from '../metrics/llmMetrics.js';
import { logger } from "../utils/logger.js"

import { costGovernance } from "./CostGovernanceService.js"
import { ExternalCircuitBreaker } from "./ExternalCircuitBreaker.js"
import { llmCache } from "./LLMCache.js"
import { llmCostTracker } from "./LLMCostTracker.js"
import { AnthropicProviderAdapter, OpenAIProviderAdapter } from "./providers/HttpProviderAdapters.js";
import type { LLMProviderAdapter } from "./providers/LLMProviderAdapter.js";


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
  provider: "together_ai" | "openai" | "anthropic" | "cache";
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
  providerFallback: { calls: number; failures: number };
  circuitBreakers: Record<string, ReturnType<ExternalCircuitBreaker["getMetrics"]>>;
  cache: { hits: number; misses: number };
  costGovernance: Awaited<ReturnType<typeof costGovernance.getSummary>>;
};

export class LLMFallbackService {
  private readonly circuitBreaker: ExternalCircuitBreaker;
  private readonly gateway: LLMGateway;
  private readonly fallbackProviderAdapter: LLMProviderAdapter;
  private readonly fallbackProvider: "openai" | "anthropic";
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
    providerFallback: { calls: 0, failures: 0 },
    cache: { hits: 0, misses: 0 },
  };

  // Lazy OpenAI client — only instantiated when LLM_FALLBACK_PROVIDER=openai
  private _openaiClient: OpenAI | null = null;

  private getOpenAIClient(): OpenAI {
    if (!this._openaiClient) {
      const apiKey = getEnvVar('OPENAI_API_KEY') as string | undefined;
      if (!apiKey) {
        throw new Error('LLM_FALLBACK_PROVIDER=openai but OPENAI_API_KEY is not set');
      }
      this._openaiClient = new OpenAI({ apiKey });
    }
    return this._openaiClient;
  }

  /**
   * Call the configured provider fallback (currently: OpenAI).
   * Only invoked when Together.ai primary and secondary both fail.
   */
  private async callProviderFallback(request: LLMRequest): Promise<LLMResponse> {
    const fallbackProvider = getEnvVar('LLM_FALLBACK_PROVIDER') as string | undefined;
    if (!fallbackProvider || fallbackProvider !== 'openai') {
      throw new Error('No provider fallback configured (set LLM_FALLBACK_PROVIDER=openai)');
    }

    const fallbackModel = (getEnvVar('LLM_FALLBACK_MODEL') as string | undefined) || 'gpt-4o-mini';
    const startTime = Date.now();
    this.stats.providerFallback.calls++;

    try {
      const client = this.getOpenAIClient();
      const response = await client.chat.completions.create({
        model: fallbackModel,
        messages: [{ role: 'user', content: request.prompt }],
        max_tokens: request.maxTokens,
        temperature: request.temperature,
      });

      const latency = Date.now() - startTime;
      const promptTokens = response.usage?.prompt_tokens ?? 0;
      const completionTokens = response.usage?.completion_tokens ?? 0;
      const content = response.choices[0]?.message?.content ?? '';

      const result: LLMResponse = {
        content,
        provider: 'together_ai', // keep interface stable; callers check content not provider
        model: fallbackModel,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost: llmCostTracker.calculateCost(fallbackModel, promptTokens, completionTokens),
        latency,
        cached: false,
      };

      await costGovernance.recordUsage({
        tenantId: request.tenantId,
        dealId: request.dealId ?? request.sessionId,
        tokens: result.totalTokens,
        cost: result.cost,
        userId: request.userId,
        model: fallbackModel,
      });

      if (request.tenantId) {
        await llmCache.set(request.tenantId, request.prompt, fallbackModel, content, {
          promptTokens,
          completionTokens,
          cost: result.cost,
        });
      }

      logger.warn('LLMFallback used provider fallback (OpenAI) after Together.ai failure', {
        fallbackProvider,
        fallbackModel,
        latency,
      });

      return result;
    } catch (err) {
      this.stats.providerFallback.failures++;
      logger.error('Provider fallback (OpenAI) also failed', err as Error, { fallbackModel });
      throw err;
    }
  }

  constructor() {
    this.circuitBreaker = new ExternalCircuitBreaker("together_ai");
    this.gateway = new LLMGateway({
      provider: 'together',
      model: (getEnvVar('TOGETHER_PRIMARY_MODEL_NAME') as string) || 'gpt-4o-mini',
      timeout_ms: 25000,
    });
    const fallbackProviderRaw = String(
      getEnvVar("LLM_FALLBACK_PROVIDER", { defaultValue: "openai" })
    ).toLowerCase();
    this.fallbackProvider =
      fallbackProviderRaw === "anthropic" ? "anthropic" : "openai";
    this.fallbackProviderAdapter =
      this.fallbackProvider === "anthropic"
        ? new AnthropicProviderAdapter()
        : new OpenAIProviderAdapter();
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

      if (request.tenantId) {
        await llmCache.set(request.tenantId, request.prompt, result.model, result.content, {
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          cost: result.cost,
        });
      }

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

    // Check cache first — only when tenantId is present (required for tenant-scoped key)
    const cached = request.tenantId
      ? await llmCache.get(request.tenantId, request.prompt, request.model)
      : null;
    if (cached) {
      this.stats.cache.hits++;
      llmCacheHitsTotal.labels({ circuit_state: this.circuitBreaker.getState(this.togetherChatBreakerKey) }).inc();

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

    let lastError: unknown = null;

    const isTransient = (err: unknown): boolean => {
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
        llmProviderActive.labels({ provider: 'together' }).set(1);
        llmProviderActive.labels({ provider: 'openai' }).set(0);
        llmProviderActive.labels({ provider: 'cache' }).set(0);
        return resp;
      } catch (err) {
        lastError = err;
        // if non-transient or we've exhausted attempts, break to fallback logic
        if (!isTransient(err) || attempt === primaryMaxRetries) break;
        const jitter = Math.floor(Math.random() * retryBackoffMs);
        await sleep(retryBackoffMs + jitter);
      }
    }

    // Primary exhausted — attempt secondary Together.ai model if configured
    if (fallbackEnabled && secondaryModel) {
      try {
        const secondaryReq = { ...request, model: String(secondaryModel) };
        const response = await this.fallbackProviderAdapter.complete({
          model: secondaryReq.model,
          prompt: secondaryReq.prompt,
          temperature: secondaryReq.temperature,
          maxTokens: secondaryReq.maxTokens,
        });

        this.stats.togetherAI.fallbacks = (this.stats.togetherAI.fallbacks || 0) + 1;
        llmProviderFallbackActivationsTotal
          .labels({ from_provider: 'together', to_provider: this.fallbackProvider })
          .inc();
        llmProviderActive.labels({ provider: 'together' }).set(0);
        llmProviderActive.labels({ provider: 'openai' }).set(this.fallbackProvider === "openai" ? 1 : 0);
        llmProviderActive.labels({ provider: 'anthropic' }).set(this.fallbackProvider === "anthropic" ? 1 : 0);
        llmProviderActive.labels({ provider: 'cache' }).set(0);

        logger.warn('LLMFallback used secondary model after primary failures', {
          primary: primaryModel,
          secondary: secondaryReq.model,
          secondary_provider: this.fallbackProvider,
          fallback_reason: lastError instanceof Error ? lastError.message : String(lastError),
        });

        return {
          content: response.content,
          provider: this.fallbackProvider,
          model: response.model,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          cost: llmCostTracker.calculateCost(response.model, response.promptTokens, response.completionTokens),
          latency: 0,
          cached: false,
        };
      } catch (secErr) {
        // Secondary also failed — fall through to provider-level fallback
        logger.warn('Together.ai secondary model failed, attempting provider fallback', secErr as Error);
        lastError = secErr;
      }
    }

    // Provider-level fallback: a different LLM provider (e.g. OpenAI).
    // This is the true resilience path when Together.ai is fully unavailable.
    // Note: callProviderFallback() increments stats.providerFallback.calls internally.
    const providerFallbackEnabled = getEnvVar('LLM_FALLBACK_PROVIDER') as string | undefined;
    if (providerFallbackEnabled) {
      try {
        return await this.callProviderFallback(request);
      } catch (providerErr) {
        logger.error('Provider fallback also failed — all LLM paths exhausted', providerErr as Error);
        logger.error('LLM secondary provider fallback failed', secErr as Error, {
          fallbackProvider: this.fallbackProvider,
        });
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

    // Check cache first — only when tenantId is present (required for tenant-scoped key)
    const cached = request.tenantId
      ? await llmCache.get(request.tenantId, request.prompt, request.model)
      : null;
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

    const fallbackEnabled = getEnvVar('LLM_FALLBACK_ENABLED', { defaultValue: 'true' }) !== 'false';
    const secondaryModel = getEnvVar('TOGETHER_SECONDARY_MODEL_NAME');

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
    } catch (primaryError) {
      // Attempt secondary model fallback for streaming (mirrors processRequest behavior)
      if (fallbackEnabled && secondaryModel) {
        try {
          assertModelAllowed('together_ai', String(secondaryModel));
          const secondaryReq = { ...request, model: String(secondaryModel) };

          logger.warn('LLMFallback stream using secondary model after primary failure', {
            primary: request.model,
            secondary: secondaryReq.model,
            fallback_reason: primaryError instanceof Error ? primaryError.message : String(primaryError),
          });

          const chunks = await this.circuitBreaker.execute(
            this.togetherStreamBreakerKey,
            async () => {
              const streamed: { content: string; done: boolean }[] = [];
              for await (const chunk of this.callTogetherAIStream(secondaryReq)) {
                streamed.push(chunk);
              }
              return streamed;
            },
            { config: this.breakerConfig }
          );

          this.stats.togetherAI.fallbacks = (this.stats.togetherAI.fallbacks || 0) + 1;

          for (const chunk of chunks) {
            yield chunk;
          }
          return;
        } catch (secErr) {
          logger.warn('Together.ai stream secondary fallback failed, attempting provider fallback', secErr as Error);
        }
      }

      // Provider-level fallback for streaming: degrade to a non-streaming call
      // and yield the full response as a single chunk. This preserves the
      // generator interface while providing true provider-level resilience.
      const providerFallbackEnabled = getEnvVar('LLM_FALLBACK_PROVIDER') as string | undefined;
      if (providerFallbackEnabled) {
        try {
          const providerResp = await this.callProviderFallback(request);
          yield { content: providerResp.content, done: false };
          yield { content: '', done: true };
          return;
        } catch (providerErr) {
          logger.error('Provider fallback also failed for stream — all LLM paths exhausted', providerErr as Error);
          throw new Error('LLM provider unavailable. Please try again later.');
        }
      }

      logger.error("Together.ai stream failed (no fallback available)", primaryError as Error);
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

      if (request.tenantId) {
        await llmCache.set(request.tenantId, request.prompt, request.model, accumulatedContent, {
          promptTokens,
          completionTokens,
          cost,
        });
      }

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
      providerFallback: this.stats.providerFallback,
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

// Lazy singleton — deferred to avoid ESM circular TDZ on LLMGateway
let _llmFallback: LLMFallbackService | undefined;
export function getLLMFallback(): LLMFallbackService {
  if (!_llmFallback) _llmFallback = new LLMFallbackService();
  return _llmFallback;
}
// Backward-compat proxy
export const llmFallback = new Proxy({} as LLMFallbackService, {
  get(_t, prop) {
    return getLLMFallback()[prop as keyof LLMFallbackService];
  },
});
