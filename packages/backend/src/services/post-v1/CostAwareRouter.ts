/**
 * Cost-Aware Routing Service
 *
 * Routes LLM requests based on cost constraints, model availability,
 * and tenant budget limits. Implements intelligent model selection
 * and fallback strategies.
 */

import { logger } from "../../lib/logger.js";

import { FallbackAIService } from "./FallbackAIService.js";
import { LLMCostTracker } from "./LLMCostTracker.js";

export interface RoutingDecision {
  useModel: string;
  provider: "openai" | "anthropic" | "gemini" | "custom";
  fallbackToBasic: boolean;
  reason: string;
  estimatedCost: number;
}

export interface RoutingContext {
  tenantId: string;
  agentType: string;
  priority: "critical" | "high" | "medium" | "low";
  tokenEstimate: number;
  sessionId?: string;
}

// TTL cache entry for monthly token counts. 60s staleness is acceptable
// for budget enforcement — avoids a DB round-trip on every LLM call.
interface BudgetCacheEntry {
  monthlyTokens: number;
  expiresAt: number;
}

const BUDGET_CACHE_TTL_MS = 60_000;

export class CostAwareRouter {
  private costTracker: LLMCostTracker;
  private readonly SOFT_CAP_THRESHOLD = 0.9; // 90%
  private readonly MONTHLY_BUDGET_DEFAULT = 1000000; // 1M tokens
  private readonly budgetCache = new Map<string, BudgetCacheEntry>();

  // Model hierarchy by cost-efficiency
  private readonly MODEL_HIERARCHY = {
    critical: ["claude-3-opus", "gpt-4", "claude-3-sonnet"],
    high: ["claude-3-sonnet", "gpt-4-turbo", "claude-3-haiku"],
    medium: ["gpt-4o", "claude-3-haiku", "gpt-4o-mini"],
    low: ["gpt-4o-mini", "claude-3-haiku", "meta-llama-3.1-8b"],
  };

  constructor(costTracker: LLMCostTracker) {
    this.costTracker = costTracker;
  }

  /**
   * Route LLM request based on cost constraints
   */
  async routeRequest(context: RoutingContext): Promise<RoutingDecision> {
    const { tenantId, agentType, priority, tokenEstimate } = context;

    // Check tenant budget status
    const budgetStatus = await this.checkTenantBudget(tenantId);

    // Determine if fallback is needed
    if (this.shouldUseFallback(budgetStatus, agentType, priority)) {
      return {
        useModel: "fallback",
        provider: "custom",
        fallbackToBasic: true,
        reason: `Budget limit reached (${(budgetStatus.usageRatio * 100).toFixed(1)}% used)`,
        estimatedCost: 0,
      };
    }

    // Select appropriate model based on priority and budget
    const selectedModel = this.selectModel(priority, budgetStatus);

    // Estimate cost
    const estimatedCost = this.estimateCost(selectedModel, tokenEstimate);

    return {
      useModel: selectedModel,
      provider: this.getProviderForModel(selectedModel),
      fallbackToBasic: false,
      reason: `Selected ${selectedModel} for ${priority} priority (${(budgetStatus.usageRatio * 100).toFixed(1)}% budget used)`,
      estimatedCost,
    };
  }

  /**
   * Check tenant's current budget status.
   * Monthly token counts are cached for 60s to avoid a DB query on every LLM call.
   */
  private async checkTenantBudget(tenantId: string): Promise<{
    usageRatio: number;
    monthlyTokens: number;
    monthlyBudget: number;
  }> {
    const now = Date.now();
    const cached = this.budgetCache.get(tenantId);

    let monthlyTokens: number;
    if (cached && cached.expiresAt > now) {
      monthlyTokens = cached.monthlyTokens;
    } else {
      monthlyTokens = await this.costTracker.getMonthlyTokensByTenant(tenantId);
      this.budgetCache.set(tenantId, { monthlyTokens, expiresAt: now + BUDGET_CACHE_TTL_MS });
    }

    const monthlyBudget = parseInt(
      process.env[`LLM_BUDGET_${tenantId}`] || this.MONTHLY_BUDGET_DEFAULT.toString()
    );

    return {
      usageRatio: monthlyTokens / monthlyBudget,
      monthlyTokens,
      monthlyBudget,
    };
  }

  /**
   * Determine if fallback should be used
   */
  private shouldUseFallback(
    budgetStatus: { usageRatio: number },
    agentType: string,
    priority: string
  ): boolean {
    // Always allow critical requests
    if (priority === "critical") return false;

    // Use fallback if over soft cap and not critical agent
    if (budgetStatus.usageRatio >= this.SOFT_CAP_THRESHOLD) {
      const nonCriticalAgents = ["NarrativeAgent", "ExpansionAgent", "AnalysisAgent"];
      return nonCriticalAgents.includes(agentType);
    }

    return false;
  }

  /**
   * Select appropriate model based on priority and budget status
   */
  private selectModel(priority: string, budgetStatus: { usageRatio: number }): string {
    const models =
      this.MODEL_HIERARCHY[priority as keyof typeof this.MODEL_HIERARCHY] ||
      this.MODEL_HIERARCHY.medium;

    // If budget is tight, prefer cheaper models
    if (budgetStatus.usageRatio > 0.7) {
      return models[models.length - 1]; // Cheapest model
    } else if (budgetStatus.usageRatio > 0.5) {
      return models[Math.floor(models.length / 2)]; // Middle model
    } else {
      return models[0]; // Best model
    }
  }

  /**
   * Get provider for a model
   */
  private getProviderForModel(model: string): "openai" | "anthropic" | "gemini" | "custom" {
    if (model.startsWith("gpt-")) return "openai";
    if (model.startsWith("claude-")) return "anthropic";
    if (model.startsWith("gemini-")) return "gemini";
    if (model.startsWith("meta-llama")) return "custom"; // Together.ai
    return "custom";
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(model: string, tokenEstimate: number): number {
    // Simplified cost estimation
    const costPerToken = this.getCostPerToken(model);
    return tokenEstimate * costPerToken;
  }

  /**
   * Get cost per token for a model (simplified)
   */
  private getCostPerToken(model: string): number {
    const costs: Record<string, number> = {
      "claude-3-opus": 0.000015,
      "gpt-4": 0.00003,
      "claude-3-sonnet": 0.000003,
      "gpt-4-turbo": 0.00001,
      "claude-3-haiku": 0.00000025,
      "gpt-4o": 0.000005,
      "gpt-4o-mini": 0.00000015,
      "meta-llama-3.1-8b": 0.00000018,
    };

    return costs[model] || 0.000005; // Default
  }

  /**
   * Execute routed request
   */
  async executeRoutedRequest(
    decision: RoutingDecision,
    prompt: string,
    context: RoutingContext
  ): Promise<unknown> {
    if (decision.fallbackToBasic) {
      logger.info("Using fallback AI service", {
        tenantId: context.tenantId,
        reason: decision.reason,
      });
      return FallbackAIService.generateFallbackAnalysis(prompt);
    }

    // Here you would call the actual LLM with the selected model
    logger.info("Routing to LLM", {
      model: decision.useModel,
      provider: decision.provider,
      estimatedCost: decision.estimatedCost,
      tenantId: context.tenantId,
    });

    // Placeholder - integrate with actual LLM gateway
    return {
      response: `Response from ${decision.useModel}`,
      model: decision.useModel,
      cost: decision.estimatedCost,
    };
  }
}

// Factory function
export function createCostAwareRouter(costTracker: LLMCostTracker): CostAwareRouter {
  return new CostAwareRouter(costTracker);
}
