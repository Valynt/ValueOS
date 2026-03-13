/**
 * Cost-Based Throttling Middleware
 *
 * Implements usage-based throttling for LLM costs per tenant.
 * Automatically downgrades non-critical agents to fallback service when budget limits are reached.
 */

import { NextFunction, Request, Response } from "express";

import { logger } from "../lib/logger.js";
import { FallbackAIService } from "../services/llm/FallbackAIService.js";
import { LLMCostTracker } from "../services/llm/LLMCostTracker.js";

interface ExtendedRequest extends Request {
  tenantId?: string;
  organizationId?: string;
  agentType?: string;
  useFallback?: boolean;
}

const SOFT_CAP_THRESHOLD = 0.9; // 90%
const NON_CRITICAL_AGENTS = ["NarrativeAgent", "ExpansionAgent"]; // Agents that can be downgraded

export class CostThrottlingMiddleware {
  private costTracker: LLMCostTracker;

  constructor(costTracker: LLMCostTracker) {
    this.costTracker = costTracker;
  }

  /**
   * Middleware to check tenant token budget and set fallback flag
   */
  async checkBudget(req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> {
    const tenantId = req.tenantId || req.organizationId;

    if (!tenantId) {
      logger.warn("No tenant ID found for cost throttling check");
      return next();
    }

    try {
      // Get monthly token usage
      const monthlyTokens = await this.costTracker.getMonthlyTokensByTenant(tenantId);

      // Assume a monthly budget of 1M tokens (configurable)
      const monthlyBudget = parseInt(process.env.LLM_MONTHLY_TOKEN_BUDGET || "1000000");

      const usageRatio = monthlyTokens / monthlyBudget;

      if (usageRatio >= SOFT_CAP_THRESHOLD) {
        logger.warn("Tenant approaching token budget limit", {
          tenantId,
          usageRatio: usageRatio.toFixed(2),
          monthlyTokens,
          monthlyBudget,
        });

        // Check if this is a non-critical agent request
        const agentType = req.agentType || this.extractAgentType(req);
        if (NON_CRITICAL_AGENTS.includes(agentType)) {
          req.useFallback = true;
          logger.info("Downgrading agent to fallback service due to budget limits", {
            tenantId,
            agentType,
            usageRatio: usageRatio.toFixed(2),
          });
        }
      }
    } catch (error) {
      logger.error("Failed to check token budget", { error, tenantId });
      // Continue without throttling on error
    }

    next();
  }

  /**
   * Extract agent type from request (placeholder implementation)
   */
  private extractAgentType(req: ExtendedRequest): string {
    // Extract from URL path or headers
    const path = req.path;
    if (path.includes("narrative")) return "NarrativeAgent";
    if (path.includes("expansion")) return "ExpansionAgent";
    if (path.includes("opportunity")) return "OpportunityAgent";
    if (path.includes("target")) return "TargetAgent";
    if (path.includes("realization")) return "RealizationAgent";
    if (path.includes("integrity")) return "IntegrityAgent";

    return "Unknown";
  }

  /**
   * Route to fallback service if flag is set
   */
  async routeToFallback(req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> {
    if (req.useFallback) {
      const query = req.body?.query || req.query?.query || "No query provided";

      try {
        const fallbackResponse = FallbackAIService.generateFallbackAnalysis(query, req.body);
        res.json(fallbackResponse);
        return;
      } catch (error) {
        logger.error("Fallback service failed", { error });
        res.status(500).json({ error: "Service temporarily unavailable" });
        return;
      }
    }

    next();
  }
}

// Factory function
export function createCostThrottlingMiddleware(
  costTracker: LLMCostTracker
): CostThrottlingMiddleware {
  return new CostThrottlingMiddleware(costTracker);
}

// Express middleware functions
export function costThrottlingMiddleware(costTracker: LLMCostTracker) {
  const middleware = createCostThrottlingMiddleware(costTracker);

  return [middleware.checkBudget.bind(middleware), middleware.routeToFallback.bind(middleware)];
}
