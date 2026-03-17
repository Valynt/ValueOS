/**
 * Adaptive Refinement Middleware
 *
 * Scores agent output via ReflectionEngine after execution.
 * If below threshold, re-invokes the agent with an upgraded model
 * and the refinement plan. Tracks cost delta via LLMCostTracker.
 */

import { logger } from '../../lib/logger.js';
import type { AgentMiddleware, AgentMiddlewareContext, AgentResponse } from '../../types/orchestration.js';
import type { AgentAPI } from '../AgentAPI.js';
import type { CostAwareRouter, RoutingDecision } from '../CostAwareRouter.js';
import type { LLMCostTracker } from '../LLMCostTracker.js';
import type { ReflectionEngine, ReflectionResult } from '../post-v1/ReflectionEngine.js';

import type { RefinementMetadata } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

export interface AdaptiveRefinementConfig {
  /** Quality threshold. Default uses ReflectionEngine's 7.0. */
  qualityThreshold?: number;
  /** Whether the middleware is enabled. Default true. */
  enabled?: boolean;
}

// ============================================================================
// AdaptiveRefinementMiddleware
// ============================================================================

export class AdaptiveRefinementMiddleware implements AgentMiddleware {
  public readonly name = 'adaptive_refinement';

  private readonly reflectionEngine: ReflectionEngine;
  private readonly costAwareRouter: CostAwareRouter;
  private readonly costTracker: LLMCostTracker;
  private readonly agentAPI: AgentAPI;
  private readonly qualityThreshold: number;
  private readonly enabled: boolean;

  constructor(
    reflectionEngine: ReflectionEngine,
    costAwareRouter: CostAwareRouter,
    costTracker: LLMCostTracker,
    agentAPI: AgentAPI,
    config: AdaptiveRefinementConfig = {}
  ) {
    this.reflectionEngine = reflectionEngine;
    this.costAwareRouter = costAwareRouter;
    this.costTracker = costTracker;
    this.agentAPI = agentAPI;
    this.qualityThreshold = config.qualityThreshold ?? 7.0;
    this.enabled = config.enabled ?? true;
  }

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    // Execute core pipeline first
    const response = await next();

    if (!this.enabled) return response;

    // Pass through errors and clarification responses
    if (
      (response.type as string) === 'clarification_needed' ||
      (response.payload && (response.payload as Record<string, unknown>).error)
    ) {
      return response;
    }

    // Evaluate the response
    let reflectionResult: ReflectionResult;
    try {
      reflectionResult = await this.reflectionEngine.evaluate(response.payload, {
        query: context.query,
        agentType: context.agentType,
        userId: context.userId,
        organizationId: context.envelope.organizationId,
      });
    } catch (error: unknown) {
      logger.warn('AdaptiveRefinementMiddleware: reflection evaluation failed, passing through', {
        traceId: context.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return response;
    }

    // If passes threshold, return as-is with metadata
    if (reflectionResult.passesThreshold) {
      return this.attachRefinementMetadata(response, {
        wasRefined: false,
        originalScore: reflectionResult.overallScore,
        originalModel: this.getCurrentModel(context),
      });
    }

    // Below threshold — attempt refinement with upgraded model
    logger.info('AdaptiveRefinementMiddleware: score below threshold, attempting refinement', {
      traceId: context.traceId,
      score: reflectionResult.overallScore,
      threshold: this.qualityThreshold,
    });

    try {
      const refinementResult = await this.attemptRefinement(context, reflectionResult);

      if (refinementResult) {
        return refinementResult;
      }
    } catch (error: unknown) {
      logger.warn('AdaptiveRefinementMiddleware: refinement attempt failed', {
        traceId: context.traceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Refinement failed or didn't improve — return original with warning
    return this.attachRefinementMetadata(response, {
      wasRefined: false,
      originalScore: reflectionResult.overallScore,
      originalModel: this.getCurrentModel(context),
      refinementPlan: reflectionResult.refinementPlan,
    });
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async attemptRefinement(
    context: AgentMiddlewareContext,
    originalReflection: ReflectionResult
  ): Promise<AgentResponse | null> {
    const startTime = Date.now();
    const originalModel = this.getCurrentModel(context);

    // Select an upgraded model via CostAwareRouter (force high priority)
    const routingDecision: RoutingDecision = await this.costAwareRouter.routeRequest({
      tenantId: context.envelope.organizationId,
      agentType: context.agentType,
      priority: 'high',
      tokenEstimate: 4096,
      sessionId: context.sessionId,
    });

    const upgradedModel = routingDecision.useModel;

    // Build refinement prompt
    const refinementPlan = originalReflection.refinementPlan?.join('\n- ') ?? '';
    const refinementQuery = `${context.query}\n\nREFINEMENT INSTRUCTIONS:\nThe previous response scored ${originalReflection.overallScore.toFixed(1)}/10. Please improve based on:\n- ${refinementPlan || 'General quality improvement needed.'}`;

    // Re-invoke agent with upgraded model
    const agentResponse = await this.agentAPI.invokeAgent({
      agent: context.agentType,
      query: refinementQuery,
      context: {
        userId: context.userId,
        sessionId: context.sessionId,
        organizationId: context.envelope.organizationId,
        metadata: {
          ...((context.envelope as { metadata?: Record<string, unknown> }).metadata ?? {}),
          refinement: true,
          model: upgradedModel,
        },
      },
    });

    const latencyMs = Date.now() - startTime;

    // Track cost
    void this.costTracker.trackUsage({
      tenantId: context.envelope.organizationId,
      userId: context.userId,
      sessionId: context.sessionId,
      provider: this.resolveProvider(upgradedModel),
      model: upgradedModel,
      promptTokens: agentResponse.metadata?.tokens?.prompt ?? 0,
      completionTokens: agentResponse.metadata?.tokens?.completion ?? 0,
      caller: 'AdaptiveRefinementMiddleware',
      endpoint: 'adaptive_refinement',
      success: agentResponse.success,
      latencyMs,
    });

    if (!agentResponse.success) {
      return null;
    }

    // Re-evaluate refined output
    const refinedReflection = await this.reflectionEngine.evaluate(agentResponse.data, {
      query: context.query,
      agentType: context.agentType,
      userId: context.userId,
      organizationId: context.envelope.organizationId,
    });

    const costIncrease = routingDecision.estimatedCost;

    const metadata: RefinementMetadata = {
      wasRefined: true,
      originalScore: originalReflection.overallScore,
      refinedScore: refinedReflection.overallScore,
      originalModel,
      refinedModel: upgradedModel,
      costIncrease,
      refinementPlan: originalReflection.refinementPlan,
    };

    // Return the better-scoring output
    if (refinedReflection.passesThreshold || refinedReflection.overallScore > originalReflection.overallScore) {
      const refinedResponse: AgentResponse = {
        type: 'message',
        payload: {
          message: typeof agentResponse.data === 'string'
            ? agentResponse.data
            : JSON.stringify(agentResponse.data),
        },
      };
      return this.attachRefinementMetadata(refinedResponse, metadata);
    }

    // Refined output didn't improve — return null to signal caller to use original
    return null;
  }

  private getCurrentModel(context: AgentMiddlewareContext): string {
    return (context as { metadata?: { model?: string } }).metadata?.model ?? (context.envelope as { metadata?: { model?: string } })?.metadata?.model ?? 'unknown';
  }

  private resolveProvider(model: string): 'openai' | 'anthropic' | 'gemini' | 'custom' | 'together_ai' {
    if (model.startsWith('gpt-')) return 'openai';
    if (model.startsWith('claude-')) return 'anthropic';
    if (model.startsWith('gemini-')) return 'gemini';
    return 'custom';
  }

  private attachRefinementMetadata(
    response: AgentResponse,
    metadata: RefinementMetadata
  ): AgentResponse {
    return {
      ...response,
      metadata: {
        ...(response.metadata ?? {}),
        refinement: metadata,
      } as Record<string, unknown>,
    };
  }
}