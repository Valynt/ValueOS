/**
 * Cost-Aware Routing Service
 *
 * Combines LLMCostTracker, FallbackAIService, and agent criticality
 * for intelligent request routing.
 */

import { CostAwareRouter } from './CostAwareRouter.js';
import { FallbackAIService } from './FallbackAIService.js';
import { LLMCostTracker } from './LLMCostTracker.js';

export interface RoutingRequest {
  tenantId: string;
  agentType: string;
  input: string;
  context?: Record<string, unknown>;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}

export interface RoutingResponse {
  response: string;
  usedFallback: boolean;
  cost: number;
  model?: string;
  tokens?: number;
}

export class CostAwareRoutingService {
  private costTracker: LLMCostTracker;
  private fallbackService: FallbackAIService;
  private costRouter: CostAwareRouter;

  constructor() {
    this.costTracker = new LLMCostTracker();
    this.fallbackService = new FallbackAIService();
    this.costRouter = new CostAwareRouter(this.costTracker);
  }

  async routeRequest(request: RoutingRequest): Promise<RoutingResponse> {
    const { tenantId, agentType, input, context, priority = 'medium' } = request;

    const routingDecision = await this.costRouter.routeRequest({
      tenantId,
      agentType,
      priority,
      tokenEstimate: this.estimateTokens(input),
    });

    if (routingDecision.fallbackToBasic) {
      const response = await this.fallbackService.generateFallbackAnalysis(input, context);
      return {
        response,
        usedFallback: true,
        cost: 0,
      };
    }

    // For normal routing, delegate to LLM gateway
    // This would integrate with the LLM gateway for actual model selection
    return {
      response: 'Normal LLM response would go here',
      usedFallback: false,
      cost: routingDecision.estimatedCost,
      model: routingDecision.useModel,
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  async getTenantBudgetStatus(tenantId: string): Promise<{
    usageRatio: number;
    monthlyTokens: number;
    monthlyBudget: number;
  }> {
    return await this.costRouter.checkTenantBudget(tenantId);
  }
}

export function createCostAwareRoutingService(): CostAwareRoutingService {
  return new CostAwareRoutingService();
}
