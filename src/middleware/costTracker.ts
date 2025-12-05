/**
 * Cost Estimation Middleware
 * Local development cost tracking for LLM token usage
 * Logs estimated costs to console for visibility during development
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../lib/logger';

const logger = createLogger({ component: 'CostTracker' });

/**
 * Token pricing per 1M tokens (as of Dec 2024)
 * Update these based on current provider pricing
 */
const TOKEN_PRICING = {
  // OpenAI GPT-4
  'gpt-4': { input: 30.0, output: 60.0 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  'gpt-4o': { input: 5.0, output: 15.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  
  // OpenAI GPT-3.5
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 3.0, output: 4.0 },
  
  // Anthropic Claude
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-2.1': { input: 8.0, output: 24.0 },
  
  // Default fallback
  'default': { input: 5.0, output: 15.0 },
} as const;

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  model?: string;
  agentType?: string;
}

interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  model: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Calculate cost estimation for token usage
 */
export function calculateCost(usage: TokenUsage): CostEstimate {
  const modelKey = (usage.model || 'default') as keyof typeof TOKEN_PRICING;
  const pricing = TOKEN_PRICING[modelKey] || TOKEN_PRICING.default;
  
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;
  
  return {
    inputCost: parseFloat(inputCost.toFixed(6)),
    outputCost: parseFloat(outputCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
    currency: 'USD',
    model: usage.model || 'unknown',
    tokens: {
      input: usage.inputTokens,
      output: usage.outputTokens,
      total: usage.inputTokens + usage.outputTokens,
    },
  };
}

/**
 * Middleware to track and log LLM costs in development
 * Attaches a cost tracking function to the request object
 */
export function costTrackerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only enable detailed logging in development
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Attach cost tracking helper to request
  (req as any).trackLLMCost = (usage: TokenUsage) => {
    const estimate = calculateCost(usage);
    
    if (isDevelopment) {
      // Console output for development visibility
      console.log('\n' + '='.repeat(70));
      console.log('💰 LLM COST ESTIMATE');
      console.log('='.repeat(70));
      console.log(`Model:          ${estimate.model}`);
      if (usage.agentType) {
        console.log(`Agent Type:     ${usage.agentType}`);
      }
      console.log(`Tokens:         ${estimate.tokens.input.toLocaleString()} in / ${estimate.tokens.output.toLocaleString()} out`);
      console.log(`Total Tokens:   ${estimate.tokens.total.toLocaleString()}`);
      console.log(`Input Cost:     $${estimate.inputCost.toFixed(6)}`);
      console.log(`Output Cost:    $${estimate.outputCost.toFixed(6)}`);
      console.log(`Total Cost:     $${estimate.totalCost.toFixed(6)}`);
      console.log('='.repeat(70) + '\n');
    }
    
    // Also log via structured logger for observability
    logger.info('LLM cost estimate', {
      requestId: req.headers['x-request-id'],
      tenantId: (req as any).tenantId,
      agentType: usage.agentType,
      model: estimate.model,
      tokens: estimate.tokens,
      cost: {
        input: estimate.inputCost,
        output: estimate.outputCost,
        total: estimate.totalCost,
        currency: estimate.currency,
      },
    });
    
    return estimate;
  };
  
  next();
}

/**
 * Accumulator for session-level cost tracking
 */
class SessionCostAccumulator {
  private sessionCosts: Map<string, CostEstimate[]> = new Map();
  
  addCost(sessionId: string, estimate: CostEstimate) {
    const existing = this.sessionCosts.get(sessionId) || [];
    existing.push(estimate);
    this.sessionCosts.set(sessionId, existing);
  }
  
  getSessionTotal(sessionId: string): number {
    const costs = this.sessionCosts.get(sessionId) || [];
    return costs.reduce((sum, cost) => sum + cost.totalCost, 0);
  }
  
  getSessionStats(sessionId: string) {
    const costs = this.sessionCosts.get(sessionId) || [];
    const totalCost = costs.reduce((sum, cost) => sum + cost.totalCost, 0);
    const totalTokens = costs.reduce((sum, cost) => sum + cost.tokens.total, 0);
    const callCount = costs.length;
    
    return {
      sessionId,
      totalCost: parseFloat(totalCost.toFixed(6)),
      totalTokens,
      callCount,
      averageCostPerCall: callCount > 0 ? parseFloat((totalCost / callCount).toFixed(6)) : 0,
      models: [...new Set(costs.map(c => c.model))],
    };
  }
  
  clearSession(sessionId: string) {
    this.sessionCosts.delete(sessionId);
  }
  
  getAllSessions() {
    return Array.from(this.sessionCosts.keys()).map(sessionId => 
      this.getSessionStats(sessionId)
    );
  }
}

export const sessionCostAccumulator = new SessionCostAccumulator();

/**
 * Express middleware to track session-level costs
 */
export function sessionCostTracker(req: Request, res: Response, next: NextFunction) {
  const sessionId = (req as any).sessionId || req.headers['x-session-id'] as string;
  
  if (sessionId) {
    // Override trackLLMCost to also accumulate session costs
    const originalTrack = (req as any).trackLLMCost;
    
    (req as any).trackLLMCost = (usage: TokenUsage) => {
      const estimate = originalTrack ? originalTrack(usage) : calculateCost(usage);
      sessionCostAccumulator.addCost(sessionId, estimate);
      return estimate;
    };
    
    // Attach session stats getter
    (req as any).getSessionCostStats = () => {
      return sessionCostAccumulator.getSessionStats(sessionId);
    };
  }
  
  next();
}

export default {
  costTrackerMiddleware,
  sessionCostTracker,
  calculateCost,
  sessionCostAccumulator,
};
