/**
 * LLM Gateway
 *
 * Centralized gateway for LLM interactions with circuit breaker,
 * caching, telemetry, and multi-provider support.
 */

import { logger } from '../logger.js';
import { LLMCostTracker } from '../../services/LLMCostTracker.js';
import { CostAwareRouter } from '../../services/CostAwareRouter.js';

export interface LLMGatewayConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  model: string;
  temperature?: number;
  max_tokens?: number;
  timeout_ms?: number;
  enable_caching?: boolean;
  enable_telemetry?: boolean;
}

type TenantMetadata =
  | {
      tenantId: string;
      tenant_id?: never;
      organizationId?: never;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id: string;
      organizationId?: never;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id?: never;
      organizationId: string;
      organization_id?: never;
    }
  | {
      tenantId?: never;
      tenant_id?: never;
      organizationId?: never;
      organization_id: string;
    };

export type LLMRequestMetadata = TenantMetadata & {
  userId?: string;
  user_id?: string;
  sessionId?: string;
  session_id?: string;
  [key: string]: unknown;
};

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  metadata: LLMRequestMetadata;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  id: string;
  model: string;
  content: string;
  finish_reason: 'stop' | 'length' | 'content_filter' | 'error';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  metadata?: Record<string, any>;
}

export class LLMGateway {
  private config: LLMGatewayConfig;
  private costTracker: LLMCostTracker;
  private costAwareRouter: CostAwareRouter;

  constructor(config: LLMGatewayConfig | string, costTracker?: LLMCostTracker) {
    if (typeof config === 'string') {
      // Backward compatibility: config is provider string
      this.config = {
        provider: config as 'openai' | 'anthropic' | 'gemini' | 'custom',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4096,
      };
    } else {
      this.config = config;
    }
    this.costTracker = costTracker || new LLMCostTracker();
    this.costAwareRouter = new CostAwareRouter(this.costTracker);
  }


  protected async executeCompletion(
    request: LLMRequest,
    startTime: number
  ): Promise<LLMResponse> {
    return {
      id: `llm_${Date.now()}`,
      model: request.model || this.config.model,
      content: 'LLM Gateway placeholder response',
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
      metadata: {
        ...(request.metadata || {}),
        duration_ms: Date.now() - startTime,
      },
    };
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const model = request.model || this.config.model;
    const metadata = request.metadata ?? {};
    const userId = metadata.userId ?? metadata.user_id ?? 'system';
    const tenantId =
      metadata.tenantId ??
      metadata.tenant_id ??
      metadata.organizationId ??
      metadata.organization_id;
    const sessionId = metadata.sessionId ?? metadata.session_id;

    if (!tenantId) {
      const error = new Error(
        'LLMGateway.complete requires tenant metadata (tenantId, tenant_id, organizationId, or organization_id).'
      );
      logger.error('LLM request missing tenant context', {
        endpoint: 'llm-gateway.complete',
        metadata_keys: Object.keys(metadata),
      });
      throw error;
    }

    try {
      // Get routing decision
      const routingDecision = await this.costAwareRouter.routeRequest({
        tenantId,
        agentType: (metadata as any).agentType || 'unknown',
        priority: (metadata as any).priority || 'medium',
        tokenEstimate: this.estimateTokens(request.messages),
        sessionId,
      });

      if (routingDecision.fallbackToBasic) {
        // Use FallbackAIService
        const { FallbackAIService } = await import('../../services/FallbackAIService.js');
        const fallbackResponse = FallbackAIService.generateFallbackResponse(
          request.messages.map(m => m.content).join(' ')
        );

        return {
          id: `fallback_${Date.now()}`,
          model: 'fallback',
          content: fallbackResponse,
          finish_reason: 'stop',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          metadata: { ...metadata, fallback: true },
        };
      }

      logger.info('LLM request initiated', {
        provider: this.config.provider,
        model,
        message_count: request.messages.length,
        tenant_id: tenantId,
      });

      const response = await this.executeCompletion(request, startTime);

      const latencyMs = Date.now() - startTime;
      void this.costTracker.trackUsage({
        userId,
        tenantId,
        sessionId,
        provider: this.config.provider,
        model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        caller: 'LLMGateway.complete',
        endpoint: 'llm-gateway.complete',
        success: true,
        latencyMs,
      });

      logger.info('LLM request completed', {
        duration_ms: response.metadata?.duration_ms,
        tokens: response.usage?.total_tokens,
        tenant_id: tenantId,
      });

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      void this.costTracker.trackUsage({
        userId,
        tenantId,
        sessionId,
        provider: this.config.provider,
        model,
        promptTokens: 0,
        completionTokens: 0,
        caller: 'LLMGateway.complete',
        endpoint: 'llm-gateway.complete',
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        latencyMs,
      });

      logger.error('LLM request failed', {
        error,
        tenant_id: tenantId,
        duration_ms: latencyMs,
      });
      throw error;
    }
  }

  async stream(
    request: LLMRequest,
    callback: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Placeholder for streaming implementation
    logger.info('LLM stream request', { provider: this.config.provider });

    const fullResponse = await this.complete(request);
    callback(fullResponse.content);

    return fullResponse;
  }

  private estimateTokens(messages: LLMMessage[]): number {
    // Rough estimation: ~4 characters per token
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Generate method for backward compatibility
   */
  async generate(prompt: string): Promise<string> {
    const response = await this.complete({
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content;
  }
}

export function createLLMGateway(config: LLMGatewayConfig): LLMGateway {
  return new LLMGateway(config);
}
