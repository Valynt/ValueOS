/**
 * LLM Cost Tracker
 * 
 * Tracks and monitors LLM usage costs across the application.
 * Provides cost analytics, alerts, and optimization recommendations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { getEnvVar, getLLMCostTrackerConfig } from '../lib/env';

const TOKENS_PER_MILLION = 1_000_000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_MONTH = 30;
const MILLIS_PER_SECOND = 1_000;
const ONE_HOUR_MS = MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLIS_PER_SECOND;
const ONE_DAY_MS = HOURS_PER_DAY * ONE_HOUR_MS;
const ONE_MONTH_MS = DAYS_PER_MONTH * ONE_DAY_MS;

type PricingRate = { input: number; output: number };

/**
 * Together.ai pricing (as of 2024)
 * Prices are per 1M tokens
 */
const TOGETHER_AI_PRICING: Record<string, PricingRate> = {
  // Meta Llama models
  'meta-llama/Llama-3-70b-chat-hf': {
    input: 0.90,  // $0.90 per 1M input tokens
    output: 0.90  // $0.90 per 1M output tokens
  },
  'meta-llama/Llama-3-8b-chat-hf': {
    input: 0.20,
    output: 0.20
  },
  // Mixtral models
  'mistralai/Mixtral-8x7B-Instruct-v0.1': {
    input: 0.60,
    output: 0.60
  },
  // Default pricing for unknown models
  'default': {
    input: 1.00,
    output: 1.00
  }
};

const DEFAULT_PRICING_KEY = 'default';

const resolvePricing = (model: string): PricingRate => {
  return (TOGETHER_AI_PRICING[model] ?? TOGETHER_AI_PRICING[DEFAULT_PRICING_KEY]) as PricingRate;
};

/**
 * Cost thresholds for alerts
 */
// Cost thresholds for alerts (configurable via environment variables)
const COST_THRESHOLDS = {
  hourly: {
    warning: parseFloat(getEnvVar('LLM_COST_HOURLY_WARNING', { defaultValue: '10' }) || '10'),
    critical: parseFloat(getEnvVar('LLM_COST_HOURLY_CRITICAL', { defaultValue: '50' }) || '50')
  },
  daily: {
    warning: parseFloat(getEnvVar('LLM_COST_DAILY_WARNING', { defaultValue: '100' }) || '100'),
    critical: parseFloat(getEnvVar('LLM_COST_DAILY_CRITICAL', { defaultValue: '500' }) || '500')
  },
  monthly: {
    warning: parseFloat(getEnvVar('LLM_COST_MONTHLY_WARNING', { defaultValue: '1000' }) || '1000'),
    critical: parseFloat(getEnvVar('LLM_COST_MONTHLY_CRITICAL', { defaultValue: '5000' }) || '5000')
  },
  perUser: {
    daily: parseFloat(getEnvVar('LLM_COST_PER_USER_DAILY', { defaultValue: '10' }) || '10'),
    monthly: parseFloat(getEnvVar('LLM_COST_PER_USER_MONTHLY', { defaultValue: '100' }) || '100')
  }
};

export interface LLMUsageRecord {
  tenant_id?: string;
  user_id: string;
  session_id?: string;
  provider: 'together_ai' | 'openai' | 'anthropic' | 'replicate';
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  endpoint: string;
  success: boolean;
  error_message?: string;
  latency_ms: number;
  timestamp: string;
}

export interface CostAlert {
  level: 'warning' | 'critical';
  period: 'hourly' | 'daily' | 'monthly';
  threshold: number;
  actual: number;
  message: string;
}

export class LLMCostTracker {
  private supabase?: SupabaseClient;
  private enabled = false;
  private static warnedMissingConfig = false;
  
  constructor() {
    const { supabaseUrl, supabaseServiceRoleKey } = getLLMCostTrackerConfig();

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      if (!LLMCostTracker.warnedMissingConfig) {
        logger.warn('LLMCostTracker disabled: missing Supabase configuration');
        LLMCostTracker.warnedMissingConfig = true;
      }
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    this.enabled = true;
  }

  private isEnabled(): boolean {
    return this.enabled && Boolean(this.supabase);
  }
  
  /**
   * Calculate cost for a Together.ai API call
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = resolvePricing(model);
    
    const inputCost = (promptTokens / TOKENS_PER_MILLION) * pricing.input;
    const outputCost = (completionTokens / TOKENS_PER_MILLION) * pricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Track LLM usage and cost
   */
  async trackUsage(params: {
    tenantId?: string;
    userId: string;
    sessionId?: string;
    provider: 'together_ai' | 'openai' | 'anthropic' | 'replicate';
    model: string;
    promptTokens: number;
    completionTokens: number;
    endpoint: string;
    success: boolean;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    if (!this.isEnabled() || !this.supabase) return;

    const cost = this.calculateCost(
      params.model,
      params.promptTokens,
      params.completionTokens
    );
    
    const record: LLMUsageRecord = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      session_id: params.sessionId,
      provider: params.provider,
      model: params.model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: params.promptTokens + params.completionTokens,
      estimated_cost: cost,
      endpoint: params.endpoint,
      success: params.success,
      error_message: params.errorMessage,
      latency_ms: params.latencyMs,
      timestamp: new Date().toISOString()
    };
    
    // Store in database
    const { error } = await this.supabase
      .from('llm_usage')
      .insert(record);
    if (error) {
      logger.error('Failed to track LLM usage', error);
    }
    // Fire and forget, do not await
    void this.checkCostThresholds();
  }
  
  /**
   * Get cost for a specific time period
   */
  async getCostForPeriod(
    startTime: Date,
    endTime: Date,
    userId?: string
  ): Promise<number> {
    if (!this.isEnabled() || !this.supabase) return 0;

    let query = this.supabase
      .from('llm_usage')
      .select('estimated_cost')
      .gte('timestamp', startTime.toISOString())
      .lte('timestamp', endTime.toISOString());
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data, error } = await query;
    if (error) {
      logger.error('Failed to get cost for period', error);
      return 0;
    }
    return (data?.reduce((sum: number, record: { estimated_cost: number }) => sum + record.estimated_cost, 0)) || 0;
  }
  
  /**
   * Get hourly cost
   */
  async getHourlyCost(): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - ONE_HOUR_MS);
    return this.getCostForPeriod(oneHourAgo, now);
  }
  
  /**
   * Get daily cost
   */
  async getDailyCost(userId?: string): Promise<number> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
    return this.getCostForPeriod(oneDayAgo, now, userId);
  }
  
  /**
   * Get monthly cost
   */
  async getMonthlyCost(): Promise<number> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - ONE_MONTH_MS);
    return this.getCostForPeriod(oneMonthAgo, now);
  }

  /**
   * Get monthly tokens for a tenant
   */
  async getMonthlyTokensByTenant(tenantId: string): Promise<number> {
    if (!this.isEnabled() || !this.supabase) return 0;

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data, error } = await this.supabase
      .from('llm_usage')
      .select('total_tokens')
      .eq('tenant_id', tenantId)
      .gte('timestamp', periodStart.toISOString())
      .lte('timestamp', now.toISOString());

    if (error) {
      logger.error('Failed to get monthly tokens for tenant', error);
      return 0;
    }

    return (data?.reduce((sum: number, record: { total_tokens: number }) => sum + record.total_tokens, 0)) || 0;
  }
  
  /**
   * Check if cost thresholds are exceeded
   */
  async checkCostThresholds(): Promise<CostAlert[]> {
    if (!this.isEnabled()) return [];

    const alerts: CostAlert[] = [];
    
    // Check hourly threshold
    const hourlyCost = await this.getHourlyCost();
    if (hourlyCost >= COST_THRESHOLDS.hourly.critical) {
      alerts.push({
        level: 'critical',
        period: 'hourly',
        threshold: COST_THRESHOLDS.hourly.critical,
        actual: hourlyCost,
        message: `CRITICAL: Hourly LLM cost ($${hourlyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.hourly.critical})`
      });
    } else if (hourlyCost >= COST_THRESHOLDS.hourly.warning) {
      alerts.push({
        level: 'warning',
        period: 'hourly',
        threshold: COST_THRESHOLDS.hourly.warning,
        actual: hourlyCost,
        message: `WARNING: Hourly LLM cost ($${hourlyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.hourly.warning})`
      });
    }
    
    // Check daily threshold
    const dailyCost = await this.getDailyCost();
    if (dailyCost >= COST_THRESHOLDS.daily.critical) {
      alerts.push({
        level: 'critical',
        period: 'daily',
        threshold: COST_THRESHOLDS.daily.critical,
        actual: dailyCost,
        message: `CRITICAL: Daily LLM cost ($${dailyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.daily.critical})`
      });
    } else if (dailyCost >= COST_THRESHOLDS.daily.warning) {
      alerts.push({
        level: 'warning',
        period: 'daily',
        threshold: COST_THRESHOLDS.daily.warning,
        actual: dailyCost,
        message: `WARNING: Daily LLM cost ($${dailyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.daily.warning})`
      });
    }
    
    // Check monthly threshold
    const monthlyCost = await this.getMonthlyCost();
    if (monthlyCost >= COST_THRESHOLDS.monthly.critical) {
      alerts.push({
        level: 'critical',
        period: 'monthly',
        threshold: COST_THRESHOLDS.monthly.critical,
        actual: monthlyCost,
        message: `CRITICAL: Monthly LLM cost ($${monthlyCost.toFixed(2)}) exceeded critical threshold ($${COST_THRESHOLDS.monthly.critical})`
      });
    } else if (monthlyCost >= COST_THRESHOLDS.monthly.warning) {
      alerts.push({
        level: 'warning',
        period: 'monthly',
        threshold: COST_THRESHOLDS.monthly.warning,
        actual: monthlyCost,
        message: `WARNING: Monthly LLM cost ($${monthlyCost.toFixed(2)}) exceeded warning threshold ($${COST_THRESHOLDS.monthly.warning})`
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
    
    return alerts;
  }
  
  /**
   * Send cost alert
   */
  private async sendAlert(alert: CostAlert): Promise<void> {
    if (!this.isEnabled() || !this.supabase) return;

    // Check for duplicate alerts within 1 hour using database
    const alertKey = `${alert.period}-${alert.level}`;
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
    
    const { data: existingAlerts, error: checkError } = await this.supabase
      .from('cost_alerts')
      .select('id')
      .eq('level', alert.level)
      .eq('period', alert.period)
      .gte('created_at', oneHourAgo)
      .limit(1);
    
    if (checkError) {
      logger.error('Failed to check for duplicate alerts', checkError);
      // Continue with sending alert despite check failure
    } else if ((existingAlerts?.length ?? 0) > 0) {
      return;
    }
    
    logger.warn('LLM COST ALERT', { alert });
    
    // Store alert in database
    await this.supabase.from('cost_alerts').insert({
      level: alert.level,
      period: alert.period,
      threshold: alert.threshold,
      actual_cost: alert.actual,
      message: alert.message,
      created_at: new Date().toISOString()
    });
    
    // Send to monitoring service (e.g., Slack, PagerDuty)
    const { slackWebhookUrl, alertEmail } = getLLMCostTrackerConfig();
    if (slackWebhookUrl) {
      void this.sendSlackAlert(alert);
    }
    // For critical alerts, also send email
    if (alert.level === 'critical' && alertEmail) {
      void this.sendEmailAlert(alert);
    }
  }
  
  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: CostAlert): Promise<void> {
    try {
      const color = alert.level === 'critical' ? 'danger' : 'warning';
      const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
      
      const { slackWebhookUrl } = getLLMCostTrackerConfig();
      if (!slackWebhookUrl) {
        throw new Error('Slack webhook URL is not configured');
      }
      await fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} LLM Cost Alert`,
          attachments: [{
            color,
            title: alert.message,
            fields: [
              {
                title: 'Period',
                value: alert.period,
                short: true
              },
              {
                title: 'Threshold',
                value: `$${alert.threshold}`,
                short: true
              },
              {
                title: 'Actual Cost',
                value: `$${alert.actual.toFixed(2)}`,
                short: true
              },
              {
                title: 'Overage',
                value: `$${(alert.actual - alert.threshold).toFixed(2)}`,
                short: true
              }
            ],
            footer: 'ValueCanvas LLM Cost Tracker',
            ts: Math.floor(Date.now() / MILLIS_PER_SECOND)
          }]
        })
      });
    } catch (error) {
      logger.error('Failed to send Slack alert', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: CostAlert): Promise<void> {
    // Implement email sending (e.g., using SendGrid, AWS SES)
    logger.info('Email alert would be sent', { alert });
  }
  
  /**
   * Get cost analytics
   */
  async getCostAnalytics(startDate: Date, endDate: Date): Promise<{
    totalCost: number;
    costByModel: Record<string, number>;
    costByUser: Record<string, number>;
    costByEndpoint: Record<string, number>;
    totalTokens: number;
    averageCostPerRequest: number;
    requestCount: number;
  }> {
    if (!this.isEnabled() || !this.supabase) {
      return {
        totalCost: 0,
        costByModel: {},
        costByUser: {},
        costByEndpoint: {},
        totalTokens: 0,
        averageCostPerRequest: 0,
        requestCount: 0
      };
    }

    const { data, error } = await this.supabase
      .from('llm_usage')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());
    
    if (error || !data) {
      throw new Error(`Failed to get cost analytics: ${error?.message}`);
    }
    
    const analytics = {
      totalCost: 0,
      costByModel: {} as Record<string, number>,
      costByUser: {} as Record<string, number>,
      costByEndpoint: {} as Record<string, number>,
      totalTokens: 0,
      averageCostPerRequest: 0,
      requestCount: data.length
    };
    
    for (const record of data) {
      analytics.totalCost += record.estimated_cost;
      analytics.totalTokens += record.total_tokens;
      
      // By model
      analytics.costByModel[record.model] = 
        (analytics.costByModel[record.model] || 0) + record.estimated_cost;
      
      // By user
      analytics.costByUser[record.user_id] = 
        (analytics.costByUser[record.user_id] || 0) + record.estimated_cost;
      
      // By endpoint
      analytics.costByEndpoint[record.endpoint] = 
        (analytics.costByEndpoint[record.endpoint] || 0) + record.estimated_cost;
    }
    
    analytics.averageCostPerRequest = 
      analytics.requestCount > 0 ? analytics.totalCost / analytics.requestCount : 0;
    
    return analytics;
  }
  
  /**
   * Get top cost users
   */
  async getTopCostUsers(limit: number = 10): Promise<Array<{
    userId: string;
    totalCost: number;
    requestCount: number;
  }>> {
    if (!this.isEnabled() || !this.supabase) {
      return [];
    }

    const { data, error } = await this.supabase
      .from('llm_usage')
      .select('user_id, estimated_cost')
      .gte('timestamp', new Date(Date.now() - ONE_DAY_MS).toISOString());
    
    if (error || !data) {
      return [];
    }
    
    const userCosts = new Map<string, { cost: number; count: number }>();
    
    for (const record of data) {
      const current = userCosts.get(record.user_id) || { cost: 0, count: 0 };
      userCosts.set(record.user_id, {
        cost: current.cost + record.estimated_cost,
        count: current.count + 1
      });
    }
    
    return Array.from(userCosts.entries())
      .map(([userId, stats]) => ({
        userId,
        totalCost: stats.cost,
        requestCount: stats.count
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }
}

// Export a singleton for convenience and for modules/tests that expect a shared instance
export const llmCostTracker = new LLMCostTracker();
