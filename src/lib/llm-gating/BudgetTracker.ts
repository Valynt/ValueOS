/**
 * LLM Budget Tracker
 * 
 * Tracks LLM usage and costs per tenant with Redis caching.
 * Implements the cost calculation formula from the technical specification:
 * 
 * C_total = ((T_in * P_in) + (T_out * P_out)) / 1000
 * 
 * Where:
 * - C_total: Total cost in USD
 * - T_in: Input tokens
 * - T_out: Output tokens
 * - P_in: Price per 1k input tokens
 * - P_out: Price per 1k output tokens
 */

import { logger } from '../logger';
import { getCache, incrementCache, setCache } from '../redis';
import { TenantBudgetStatus } from './types';

/**
 * Model pricing information (per 1k tokens)
 */
export interface ModelPricing {
  model: string;
  inputPricePer1k: number;  // USD per 1k input tokens
  outputPricePer1k: number; // USD per 1k output tokens
  provider: string;
}

/**
 * Model pricing registry
 * Prices as of 2024 (update regularly)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // GPT-4 models
  'together-gpt-4': {
    model: 'gpt-4',
    inputPricePer1k: 0.03,
    outputPricePer1k: 0.06,
    provider: 'together',
  },
  'together-gpt-4-turbo': {
    model: 'gpt-4-turbo',
    inputPricePer1k: 0.01,
    outputPricePer1k: 0.03,
    provider: 'together',
  },
  
  // Claude models
  'together-claude-3-5-sonnet': {
    model: 'claude-3-5-sonnet',
    inputPricePer1k: 0.003,
    outputPricePer1k: 0.015,
    provider: 'together',
  },
  'together-claude-3-opus': {
    model: 'claude-3-opus',
    inputPricePer1k: 0.015,
    outputPricePer1k: 0.075,
    provider: 'together',
  },
  
  // Llama models
  'together-llama-3-70b': {
    model: 'llama-3-70b',
    inputPricePer1k: 0.0009,
    outputPricePer1k: 0.0009,
    provider: 'together',
  },
  'together-llama-3-8b': {
    model: 'llama-3-8b',
    inputPricePer1k: 0.0002,
    outputPricePer1k: 0.0002,
    provider: 'together',
  },
  
  // Mixtral models
  'together-mixtral-8x7b': {
    model: 'mixtral-8x7b',
    inputPricePer1k: 0.0006,
    outputPricePer1k: 0.0006,
    provider: 'together',
  },
  'together-mixtral-8x22b': {
    model: 'mixtral-8x22b',
    inputPricePer1k: 0.0012,
    outputPricePer1k: 0.0012,
    provider: 'together',
  },
};

/**
 * Usage record for a single LLM call
 */
export interface UsageRecord {
  tenantId: string;
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  taskType?: string;
  agentId?: string;
  sessionId?: string;
  traceId?: string;
}

/**
 * Budget Tracker
 * 
 * Tracks LLM usage and enforces budget limits
 */
export class BudgetTracker {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BUDGET_PERIOD_DAYS = 30; // Monthly budget
  
  /**
   * Calculate cost for a request
   * 
   * Formula: C_total = ((T_in * P_in) + (T_out * P_out)) / 1000
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = MODEL_PRICING[model];
    
    if (!pricing) {
      logger.warn('No pricing found for model, using default', { model });
      // Default to GPT-4 pricing (conservative estimate)
      return ((inputTokens * 0.03) + (outputTokens * 0.06)) / 1000;
    }
    
    const cost = (
      (inputTokens * pricing.inputPricePer1k) +
      (outputTokens * pricing.outputPricePer1k)
    ) / 1000;
    
    return Math.max(0, cost); // Ensure non-negative
  }
  
  /**
   * Estimate cost before making request
   */
  estimateCost(
    model: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number
  ): number {
    return this.calculateCost(model, estimatedInputTokens, estimatedOutputTokens);
  }
  
  /**
   * Get current budget status for tenant
   */
  async getBudgetStatus(
    tenantId: string,
    budgetLimit: number
  ): Promise<TenantBudgetStatus> {
    // Try to get from cache first
    const cacheKey = `budget:${tenantId}`;
    const cached = await getCache<TenantBudgetStatus>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    // Calculate from database
    const status = await this.calculateBudgetStatus(tenantId, budgetLimit);
    
    // Cache for 5 minutes
    await setCache(cacheKey, status, 300);
    
    return status;
  }
  
  /**
   * Calculate budget status from database
   */
  private async calculateBudgetStatus(
    tenantId: string,
    budgetLimit: number
  ): Promise<TenantBudgetStatus> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - this.BUDGET_PERIOD_DAYS);
    
    try {
      const { supabase } = await import('../supabase');
      
      // Query usage for current period
      const { data, error } = await supabase
        .from('llm_usage')
        .select('cost')
        .eq('tenant_id', tenantId)
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', now.toISOString());
      
      if (error) {
        throw error;
      }
      
      const usedAmount = data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0;
      const remainingBudget = Math.max(0, budgetLimit - usedAmount);
      const usagePercentage = (usedAmount / budgetLimit) * 100;
      
      // Calculate grace period
      const hardLimit = budgetLimit * 1.1; // 10% grace
      const inGracePeriod = usedAmount > budgetLimit && usedAmount < hardLimit;
      const gracePeriodRemainingHours = inGracePeriod
        ? Math.max(0, 24 - ((usedAmount - budgetLimit) / (hardLimit - budgetLimit)) * 24)
        : undefined;
      
      return {
        organizationId: tenantId,
        period: {
          start: periodStart,
          end: now,
        },
        budgetLimit,
        usedAmount,
        remainingBudget,
        usagePercentage,
        inGracePeriod,
        gracePeriodRemainingHours,
        hardLimit,
      };
    } catch (error) {
      logger.error('Failed to calculate budget status', error instanceof Error ? error : undefined, {
        tenantId,
      });
      
      // Return safe default
      return {
        organizationId: tenantId,
        period: {
          start: periodStart,
          end: now,
        },
        budgetLimit,
        usedAmount: 0,
        remainingBudget: budgetLimit,
        usagePercentage: 0,
        inGracePeriod: false,
        hardLimit: budgetLimit * 1.1,
      };
    }
  }
  
  /**
   * Record usage for a request
   */
  async recordUsage(record: UsageRecord): Promise<void> {
    try {
      // Save to database
      await this.saveUsageToDatabase(record);
      
      // Update Redis cache
      await this.updateCachedBudget(record.tenantId, record.cost);
      
      // Increment usage counter
      const counterKey = `usage:${record.tenantId}:${new Date().toISOString().slice(0, 7)}`; // YYYY-MM
      await incrementCache(counterKey, 1);
      
      logger.info('Recorded LLM usage', {
        tenantId: record.tenantId,
        model: record.model,
        cost: record.cost.toFixed(4),
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
      });
    } catch (error) {
      logger.error('Failed to record usage', error instanceof Error ? error : undefined, {
        tenantId: record.tenantId,
      });
      // Don't throw - usage recording failure shouldn't block the response
    }
  }
  
  /**
   * Save usage record to database
   */
  private async saveUsageToDatabase(record: UsageRecord): Promise<void> {
    try {
      const { supabase } = await import('../supabase');
      
      const { error } = await supabase
        .from('llm_usage')
        .insert({
          tenant_id: record.tenantId,
          user_id: record.userId,
          model: record.model,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          cost: record.cost,
          task_type: record.taskType,
          agent_id: record.agentId,
          session_id: record.sessionId,
          trace_id: record.traceId,
          created_at: record.timestamp.toISOString(),
        });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save usage to database', error instanceof Error ? error : undefined);
      throw error;
    }
  }
  
  /**
   * Update cached budget with new usage
   */
  private async updateCachedBudget(tenantId: string, cost: number): Promise<void> {
    const cacheKey = `budget:${tenantId}`;
    const cached = await getCache<TenantBudgetStatus>(cacheKey);
    
    if (cached) {
      // Update cached values
      cached.usedAmount += cost;
      cached.remainingBudget = Math.max(0, cached.budgetLimit - cached.usedAmount);
      cached.usagePercentage = (cached.usedAmount / cached.budgetLimit) * 100;
      cached.inGracePeriod = cached.usedAmount > cached.budgetLimit && cached.usedAmount < cached.hardLimit;
      
      // Save updated cache
      await setCache(cacheKey, cached, 300);
    }
  }
  
  /**
   * Get usage statistics for tenant
   */
  async getUsageStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCost: number;
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    byModel: Record<string, { cost: number; requests: number }>;
    byTaskType: Record<string, { cost: number; requests: number }>;
  }> {
    try {
      const { supabase } = await import('../supabase');
      
      const { data, error } = await supabase
        .from('llm_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (error) {
        throw error;
      }
      
      const stats = {
        totalCost: 0,
        totalRequests: data?.length || 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        byModel: {} as Record<string, { cost: number; requests: number }>,
        byTaskType: {} as Record<string, { cost: number; requests: number }>,
      };
      
      data?.forEach(record => {
        stats.totalCost += record.cost || 0;
        stats.totalInputTokens += record.input_tokens || 0;
        stats.totalOutputTokens += record.output_tokens || 0;
        
        // By model
        if (!stats.byModel[record.model]) {
          stats.byModel[record.model] = { cost: 0, requests: 0 };
        }
        stats.byModel[record.model].cost += record.cost || 0;
        stats.byModel[record.model].requests += 1;
        
        // By task type
        if (record.task_type) {
          if (!stats.byTaskType[record.task_type]) {
            stats.byTaskType[record.task_type] = { cost: 0, requests: 0 };
          }
          stats.byTaskType[record.task_type].cost += record.cost || 0;
          stats.byTaskType[record.task_type].requests += 1;
        }
      });
      
      return stats;
    } catch (error) {
      logger.error('Failed to get usage stats', error instanceof Error ? error : undefined, {
        tenantId,
      });
      throw error;
    }
  }
  
  /**
   * Clear budget cache for tenant
   */
  async clearCache(tenantId: string): Promise<void> {
    const cacheKey = `budget:${tenantId}`;
    const { deleteCache } = await import('../redis');
    await deleteCache(cacheKey);
  }
  
  /**
   * Get model pricing
   */
  getModelPricing(model: string): ModelPricing | null {
    return MODEL_PRICING[model] || null;
  }
  
  /**
   * Update model pricing (admin only)
   */
  updateModelPricing(model: string, pricing: ModelPricing): void {
    MODEL_PRICING[model] = pricing;
    logger.info('Updated model pricing', { model, pricing });
  }
}

/**
 * Singleton instance
 */
export const budgetTracker = new BudgetTracker();
