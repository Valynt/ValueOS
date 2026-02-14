/**
 * LLM Service with Circuit Breaker
 *
 * Delegates provider invocation to LLMGateway provider adapters so this service
 * remains orchestration-only (cache/cost-governance/fallback metadata).
 */

import { logger } from '../utils/logger.js';
import { getEnvVar } from '@shared/lib/env';
import { llmCache } from './LLMCache.js';
import { llmCostTracker } from './LLMCostTracker.js';
import { costGovernance } from './CostGovernanceService.js';
import { ExternalCircuitBreaker } from './ExternalCircuitBreaker.js';
import { LLMGateway, type LLMRequest as GatewayRequest } from '../lib/agent-fabric/LLMGateway.js';

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
  provider: 'together_ai' | 'cache';
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

type LLMFallbackStats = {
  togetherAI: CircuitBreakerStats & { calls: number; failures: number };
  circuitBreakers: Record<string, ReturnType<ExternalCircuitBreaker['getMetrics']>>;
  cache: { hits: number; misses: number };
  costGovernance: Awaited<ReturnType<typeof costGovernance.getSummary>>;
};

export class LLMFallbackService {
  private readonly circuitBreaker: ExternalCircuitBreaker;
  private readonly togetherChatBreakerKey = 'external:together_ai:chat';
  private readonly togetherStreamBreakerKey = 'external:together_ai:stream';
  private readonly breakerConfig = {
    windowMs: 10000,
    failureRateThreshold: 0.5,
    latencyThresholdMs: 30000,
    minimumSamples: 10,
    timeoutMs: 60000,
    halfOpenMaxProbes: 1,
  };

  private readonly togetherGateway = new LLMGateway({
    provider: 'together',
    model: (getEnvVar('TOGETHER_PRIMARY_MODEL_NAME') as string) || 'gpt-4o-mini',
    timeout_ms: 25000,
  });

  private stats = {
    togetherAI: { calls: 0, failures: 0, fallbacks: 0 },
    cache: { hits: 0, misses: 0 },
  };

  constructor() {
    this.circuitBreaker = new ExternalCircuitBreaker('together_ai');
  }

  private toGatewayRequest(request: LLMRequest): GatewayRequest {
    return {
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: [{ role: 'user', content: request.prompt }],
      metadata: {
        userId: request.userId,
        sessionId: request.sessionId,
        tenantId: request.tenantId || 'default-tenant',
      },
    };
  }

  private async callTogetherAI(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    this.stats.togetherAI.calls++;

    try {
      const response = await this.togetherGateway.complete(this.toGatewayRequest(request));
      const latency = Date.now() - startTime;
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const totalTokens = response.usage?.total_tokens || promptTokens + completionTokens;

      const result: LLMResponse = {
        content: response.content,
        provider: 'together_ai',
        model: response.model || request.model,
        promptTokens,
        completionTokens,
        totalTokens,
        cost: llmCostTracker.calculateCost(
          response.model || request.model,
          promptTokens,
          completionTokens
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

      return result;
    } catch (error) {
      this.stats.togetherAI.failures++;
      throw error;
    }
  }

  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    if (!request.model) {
      request.model =
        (getEnvVar('TOGETHER_PRIMARY_MODEL_NAME') as string) || 'gpt-4o-mini';
    }

    const cached = await llmCache.get(request.prompt, request.model);
    if (cached) {
      this.stats.cache.hits++;
      return {
        content: cached.response,
        provider: 'cache',
        model: cached.model,
        promptTokens: cached.promptTokens,
        completionTokens: cached.completionTokens,
        totalTokens: cached.promptTokens + cached.completionTokens,
        cost: 0,
        latency: 0,
        cached: true,
      };
    }

    this.stats.cache.misses++;
    const dealId = request.dealId ?? request.sessionId;
    const estimatedPromptTokens = costGovernance.estimatePromptTokens(request.prompt);
    const estimatedCompletionTokens = request.maxTokens || 1000;

    await costGovernance.checkRequest({
      tenantId: request.tenantId,
      dealId,
      estimatedTokens: estimatedPromptTokens + estimatedCompletionTokens,
      estimatedCost: llmCostTracker.calculateCost(
        request.model,
        estimatedPromptTokens,
        estimatedCompletionTokens
      ),
      userId: request.userId,
      model: request.model,
    });

    try {
      return await this.circuitBreaker.execute(
        this.togetherChatBreakerKey,
        () => this.callTogetherAI(request),
        { config: this.breakerConfig }
      );
    } catch (error) {
      logger.error('LLM provider unavailable', error as Error);
      throw new Error('LLM provider unavailable. Please try again later.');
    }
  }

  async *streamRequest(
    request: LLMRequest
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const response = await this.processRequest(request);
    yield { content: response.content, done: false };
    yield { content: '', done: true };
  }

  async getStats(): Promise<LLMFallbackStats> {
    const chatMetrics = this.circuitBreaker.getMetrics(this.togetherChatBreakerKey);
    const streamMetrics = this.circuitBreaker.getMetrics(this.togetherStreamBreakerKey);

    return {
      togetherAI: {
        state: chatMetrics.state === 'half_open' ? 'half-open' : chatMetrics.state,
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

  reset(): void {
    this.circuitBreaker.reset(this.togetherChatBreakerKey);
    this.circuitBreaker.reset(this.togetherStreamBreakerKey);
    logger.info('Circuit breaker reset');
  }

  async healthCheck(): Promise<{
    togetherAI: { healthy: boolean; state: string };
  }> {
    return {
      togetherAI: {
        healthy: this.circuitBreaker.getState(this.togetherChatBreakerKey) !== 'open',
        state:
          this.circuitBreaker.getState(this.togetherChatBreakerKey) === 'half_open'
            ? 'half-open'
            : this.circuitBreaker.getState(this.togetherChatBreakerKey),
      },
    };
  }
}

export const llmFallback = new LLMFallbackService();
