/**
 * LLM Fallback Service with OpenTelemetry Tracing
 * 
 * Enhanced version of LLMFallback with distributed tracing
 */

import { LLMFallbackService, LLMRequest, LLMResponse } from './LLMFallback';
import {
  traceLLMOperation,
  addSpanAttributes,
  addSpanEvent,
  metrics,
  getTraceContextForLogging
} from '../config/telemetry';
import { logger } from '../utils/logger';

export class LLMFallbackServiceWithTracing extends LLMFallbackService {
  /**
   * Process LLM request with tracing
   */
  async processRequest(request: LLMRequest): Promise<LLMResponse> {
    return traceLLMOperation(
      'process_request',
      {
        provider: 'together_ai', // Initial provider
        model: request.model,
        userId: request.userId,
        promptLength: request.prompt.length
      },
      async (span) => {
        const startTime = Date.now();

        try {
          // Add request details to span
          addSpanAttributes({
            'llm.max_tokens': request.maxTokens || 1000,
            'llm.temperature': request.temperature || 0.7,
            'llm.session_id': request.sessionId || 'none'
          });

          addSpanEvent('llm.request.started', {
            prompt_length: request.prompt.length
          });

          // Call parent implementation
          const response = await super.processRequest(request);

          // Add response details to span
          addSpanAttributes({
            'llm.provider_used': response.provider,
            'llm.model_used': response.model,
            'llm.prompt_tokens': response.promptTokens,
            'llm.completion_tokens': response.completionTokens,
            'llm.total_tokens': response.totalTokens,
            'llm.cost_usd': response.cost,
            'llm.latency_ms': response.latency,
            'llm.cached': response.cached
          });

          addSpanEvent('llm.request.completed', {
            provider: response.provider,
            cached: response.cached,
            cost: response.cost
          });

          // Record metrics
          metrics.llmRequestsTotal.add(1, {
            provider: response.provider,
            model: response.model,
            cached: response.cached.toString(),
            tenant_id: request.tenantId || request.userId,
          });

          metrics.llmRequestDuration.record(response.latency, {
            provider: response.provider,
            model: response.model,
            tenant_id: request.tenantId || request.userId,
          });

          if (!response.cached) {
            metrics.llmCostTotal.add(response.cost, {
              provider: response.provider,
              model: response.model,
              tenant_id: request.tenantId || request.userId,
            });

            metrics.llmTokensTotal.add(response.totalTokens, {
              provider: response.provider,
              model: response.model,
              type: 'total',
              tenant_id: request.tenantId || request.userId,
            });

            metrics.llmTokensTotal.add(response.promptTokens, {
              provider: response.provider,
              model: response.model,
              type: 'prompt',
              tenant_id: request.tenantId || request.userId,
            });

            metrics.llmTokensTotal.add(response.completionTokens, {
              provider: response.provider,
              model: response.model,
              type: 'completion',
              tenant_id: request.tenantId || request.userId,
            });
          }

          // Record cache metrics
          if (response.cached) {
            metrics.cacheHitsTotal.add(1, {
              model: response.model
            });
          } else {
            metrics.cacheMissesTotal.add(1, {
              model: response.model
            });
          }

          // Log with trace context
          logger.llm('LLM request completed', {
            ...getTraceContextForLogging(),
            provider: response.provider,
            model: response.model,
            cost: response.cost,
            latency: response.latency,
            cached: response.cached,
            userId: request.userId
          });

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;

          addSpanEvent('llm.request.failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            duration_ms: duration
          });

          // Record failure metrics
          metrics.llmRequestsTotal.add(1, {
            provider: 'unknown',
            model: request.model,
            status: 'failed',
            tenant_id: request.tenantId || request.userId,
          });

          logger.error('LLM request failed', {
            ...getTraceContextForLogging(),
            error: error instanceof Error ? error.message : 'Unknown error',
            model: request.model,
            userId: request.userId,
            duration
          });

          throw error;
        }
      }
    );
  }

  /**
   * Get circuit breaker statistics with tracing
   */
  getStats() {
    const stats = super.getStats();

    // Update circuit breaker metric
    const togetherAIState = stats.togetherAI.state;
    const stateValue = 
      togetherAIState === 'open' ? 1 :
      togetherAIState === 'half-open' ? 2 :
      0;

    // This would be better implemented with a proper gauge callback
    // but for now we'll just log it
    logger.info('Circuit breaker state', {
      ...getTraceContextForLogging(),
      state: togetherAIState,
      stateValue
    });

    return stats;
  }
}

// Export singleton instance with tracing
export const llmFallbackWithTracing = new LLMFallbackServiceWithTracing();
