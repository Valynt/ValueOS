/**
 * LLM Gating Policy
 * 
 * Implements the gating policy as specified in the technical specification.
 * Provides economic guardrails, model routing, and manifesto alignment.
 */

import { logger } from '../logger';
import { TenantBudgetStatus } from './types';

/**
 * Task types for model routing
 */
export type TaskType = 
  | 'REASONING'      // Complex reasoning, requires GPT-4/Claude 3.5
  | 'EXTRACTION'     // Data extraction, can use Llama 3
  | 'SUMMARY'        // Summarization, can use Llama 3
  | 'CLASSIFICATION' // Classification, can use smaller models
  | 'GENERATION'     // Content generation
  | 'ANALYSIS'       // Data analysis
  | 'TRANSLATION';   // Language translation

/**
 * Routing rule for task-to-model mapping
 */
export interface RoutingRule {
  taskType: TaskType;
  preferredModel: string;
  maxTokens: number;
  fallbackModel?: string;
  costTier: number; // 0-4, where 0 is cheapest
}

/**
 * Manifesto enforcement configuration
 */
export interface ManifestoEnforcement {
  /** Enable strict mode (blocks non-compliant requests) */
  strictMode: boolean;
  /** Enable hallucination detection */
  hallucinationCheck: boolean;
  /** Enable conservative quantification check */
  conservativeQuantification: boolean;
  /** Enable value-first principle check */
  valueFirstCheck: boolean;
}

/**
 * LLM Gating Policy
 * 
 * Configuration for tenant-specific LLM usage policies
 */
export interface LLMGatingPolicy {
  /** Tenant/Organization ID */
  tenantId: string;
  
  /** Monthly budget limit in USD */
  monthlyBudgetLimit: number;
  
  /** Hard stop threshold (0-1, e.g., 0.95 = 95%) */
  hardStopThreshold: number;
  
  /** Default model to use */
  defaultModel: string;
  
  /** Routing rules for different task types */
  routingRules: RoutingRule[];
  
  /** Manifesto enforcement configuration */
  manifestoEnforcement: ManifestoEnforcement;
  
  /** Enable automatic model downgrade on budget pressure */
  enableAutoDowngrade: boolean;
  
  /** Grace period in hours after hitting hard stop */
  gracePeriodHours?: number;
  
  /** Per-request cost limit in USD */
  perRequestLimit?: number;
  
  /** Priority tier (affects queue priority when rate limited) */
  priorityTier?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Default routing rules based on task complexity
 */
export const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    taskType: 'REASONING',
    preferredModel: 'together-gpt-4',
    maxTokens: 4096,
    fallbackModel: 'together-claude-3-5-sonnet',
    costTier: 4,
  },
  {
    taskType: 'EXTRACTION',
    preferredModel: 'together-llama-3-70b',
    maxTokens: 2048,
    fallbackModel: 'together-llama-3-8b',
    costTier: 1,
  },
  {
    taskType: 'SUMMARY',
    preferredModel: 'together-llama-3-70b',
    maxTokens: 1024,
    fallbackModel: 'together-llama-3-8b',
    costTier: 1,
  },
  {
    taskType: 'CLASSIFICATION',
    preferredModel: 'together-llama-3-8b',
    maxTokens: 512,
    fallbackModel: 'together-llama-3-8b',
    costTier: 0,
  },
  {
    taskType: 'GENERATION',
    preferredModel: 'together-llama-3-70b',
    maxTokens: 2048,
    fallbackModel: 'together-llama-3-8b',
    costTier: 2,
  },
  {
    taskType: 'ANALYSIS',
    preferredModel: 'together-claude-3-5-sonnet',
    maxTokens: 4096,
    fallbackModel: 'together-llama-3-70b',
    costTier: 3,
  },
  {
    taskType: 'TRANSLATION',
    preferredModel: 'together-llama-3-70b',
    maxTokens: 2048,
    fallbackModel: 'together-llama-3-8b',
    costTier: 1,
  },
];

/**
 * Default gating policy for new tenants
 */
export const DEFAULT_GATING_POLICY: Omit<LLMGatingPolicy, 'tenantId'> = {
  monthlyBudgetLimit: 1000, // $1000/month default
  hardStopThreshold: 0.95,  // Stop at 95%
  defaultModel: 'together-llama-3-70b',
  routingRules: DEFAULT_ROUTING_RULES,
  manifestoEnforcement: {
    strictMode: true,
    hallucinationCheck: true,
    conservativeQuantification: true,
    valueFirstCheck: true,
  },
  enableAutoDowngrade: true,
  gracePeriodHours: 24,
  perRequestLimit: 10.0, // $10 per request max
  priorityTier: 'medium',
};

/**
 * Gating Policy Manager
 * 
 * Manages gating policies for tenants
 */
export class GatingPolicyManager {
  private policies: Map<string, LLMGatingPolicy> = new Map();
  
  /**
   * Get policy for tenant
   */
  async getPolicy(tenantId: string): Promise<LLMGatingPolicy> {
    // Check cache first
    let policy = this.policies.get(tenantId);
    
    if (!policy) {
      // Load from database
      policy = await this.loadPolicyFromDatabase(tenantId);
      
      if (!policy) {
        // Create default policy
        policy = {
          ...DEFAULT_GATING_POLICY,
          tenantId,
        };
        
        logger.info('Using default gating policy for tenant', { tenantId });
      }
      
      // Cache it
      this.policies.set(tenantId, policy);
    }
    
    return policy;
  }
  
  /**
   * Update policy for tenant
   */
  async updatePolicy(policy: LLMGatingPolicy): Promise<void> {
    // Validate policy
    this.validatePolicy(policy);
    
    // Save to database
    await this.savePolicyToDatabase(policy);
    
    // Update cache
    this.policies.set(policy.tenantId, policy);
    
    logger.info('Updated gating policy', {
      tenantId: policy.tenantId,
      budgetLimit: policy.monthlyBudgetLimit,
    });
  }
  
  /**
   * Get routing rule for task type
   */
  getRoutingRule(policy: LLMGatingPolicy, taskType: TaskType): RoutingRule | undefined {
    return policy.routingRules.find(rule => rule.taskType === taskType);
  }
  
  /**
   * Get model for task with budget consideration
   */
  async getModelForTask(
    tenantId: string,
    taskType: TaskType,
    budgetStatus: TenantBudgetStatus
  ): Promise<string> {
    const policy = await this.getPolicy(tenantId);
    const rule = this.getRoutingRule(policy, taskType);
    
    if (!rule) {
      logger.warn('No routing rule found for task type, using default', {
        tenantId,
        taskType,
        defaultModel: policy.defaultModel,
      });
      return policy.defaultModel;
    }
    
    // Check if we need to downgrade due to budget
    if (policy.enableAutoDowngrade && budgetStatus.usagePercentage > 80) {
      if (rule.fallbackModel) {
        logger.info('Downgrading model due to budget pressure', {
          tenantId,
          taskType,
          originalModel: rule.preferredModel,
          fallbackModel: rule.fallbackModel,
          usagePercentage: budgetStatus.usagePercentage,
        });
        return rule.fallbackModel;
      }
    }
    
    return rule.preferredModel;
  }
  
  /**
   * Check if request should be blocked due to budget
   */
  shouldBlockRequest(
    policy: LLMGatingPolicy,
    budgetStatus: TenantBudgetStatus,
    estimatedCost: number
  ): { blocked: boolean; reason?: string } {
    // Check hard stop threshold
    if (budgetStatus.usagePercentage >= policy.hardStopThreshold * 100) {
      // Check if in grace period
      if (policy.gracePeriodHours && budgetStatus.inGracePeriod) {
        logger.warn('Request allowed in grace period', {
          tenantId: policy.tenantId,
          usagePercentage: budgetStatus.usagePercentage,
          gracePeriodRemaining: budgetStatus.gracePeriodRemainingHours,
        });
        return { blocked: false };
      }
      
      return {
        blocked: true,
        reason: `Budget limit reached (${budgetStatus.usagePercentage.toFixed(1)}% of ${policy.monthlyBudgetLimit} USD)`,
      };
    }
    
    // Check if this request would exceed budget
    const projectedTotal = budgetStatus.usedAmount + estimatedCost;
    if (projectedTotal > policy.monthlyBudgetLimit) {
      return {
        blocked: true,
        reason: `Request would exceed budget limit (projected: ${projectedTotal.toFixed(2)} USD, limit: ${policy.monthlyBudgetLimit} USD)`,
      };
    }
    
    // Check per-request limit
    if (policy.perRequestLimit && estimatedCost > policy.perRequestLimit) {
      return {
        blocked: true,
        reason: `Request cost (${estimatedCost.toFixed(2)} USD) exceeds per-request limit (${policy.perRequestLimit} USD)`,
      };
    }
    
    return { blocked: false };
  }
  
  /**
   * Validate policy configuration
   */
  private validatePolicy(policy: LLMGatingPolicy): void {
    if (policy.monthlyBudgetLimit <= 0) {
      throw new Error('Monthly budget limit must be positive');
    }
    
    if (policy.hardStopThreshold < 0 || policy.hardStopThreshold > 1) {
      throw new Error('Hard stop threshold must be between 0 and 1');
    }
    
    if (policy.routingRules.length === 0) {
      throw new Error('At least one routing rule is required');
    }
    
    if (policy.perRequestLimit && policy.perRequestLimit <= 0) {
      throw new Error('Per-request limit must be positive');
    }
  }
  
  /**
   * Load policy from database
   */
  private async loadPolicyFromDatabase(tenantId: string): Promise<LLMGatingPolicy | null> {
    try {
      const { supabase } = await import('../supabase');
      
      const { data, error } = await supabase
        .from('llm_gating_policies')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return {
        tenantId: data.tenant_id,
        monthlyBudgetLimit: data.monthly_budget_limit,
        hardStopThreshold: data.hard_stop_threshold,
        defaultModel: data.default_model,
        routingRules: data.routing_rules,
        manifestoEnforcement: data.manifesto_enforcement,
        enableAutoDowngrade: data.enable_auto_downgrade,
        gracePeriodHours: data.grace_period_hours,
        perRequestLimit: data.per_request_limit,
        priorityTier: data.priority_tier,
      };
    } catch (error) {
      logger.error('Failed to load gating policy from database', error instanceof Error ? error : undefined, {
        tenantId,
      });
      return null;
    }
  }
  
  /**
   * Save policy to database
   */
  private async savePolicyToDatabase(policy: LLMGatingPolicy): Promise<void> {
    try {
      const { supabase } = await import('../supabase');
      
      const { error } = await supabase
        .from('llm_gating_policies')
        .upsert({
          tenant_id: policy.tenantId,
          monthly_budget_limit: policy.monthlyBudgetLimit,
          hard_stop_threshold: policy.hardStopThreshold,
          default_model: policy.defaultModel,
          routing_rules: policy.routingRules,
          manifesto_enforcement: policy.manifestoEnforcement,
          enable_auto_downgrade: policy.enableAutoDowngrade,
          grace_period_hours: policy.gracePeriodHours,
          per_request_limit: policy.perRequestLimit,
          priority_tier: policy.priorityTier,
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to save gating policy to database', error instanceof Error ? error : undefined, {
        tenantId: policy.tenantId,
      });
      throw error;
    }
  }
  
  /**
   * Clear policy cache
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      this.policies.delete(tenantId);
    } else {
      this.policies.clear();
    }
  }
}

/**
 * Singleton instance
 */
export const gatingPolicyManager = new GatingPolicyManager();
