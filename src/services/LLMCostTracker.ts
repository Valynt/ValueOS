/**
 * LLM Cost Tracking and Alert System
 * 
 * Tracks Together.ai API usage and costs, sends alerts when thresholds are exceeded.
 * Provides analytics and cost optimization insights.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Together.ai pricing (as of 2024)
 * Prices are per 1M tokens
 */
const TOGETHER_AI_PRICING = {
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

/**
 * Cost thresholds for alerts
 */
const COST_THRESHOLDS = {
  hourly: {
    warning: 10,   // $10/hour
    critical: 50   // $50/hour
  },
  daily: {
    warning: 100,  // $100/day
    critical: 500  // $500/day
  },
  monthly: {
    warning: 1000,  // $1000/month
    critical: 5000  // $5000/month
  },
  perUser: {
    daily: 10,     // $10/day per user
    monthly: 100   // $100/month per user
  }
};

export interface LLMUsageRecord {
  user_id: string;
  session_id?: string;
  provider: 'together_ai' | 'openai';
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
  private supabase: SupabaseClient;
  private alertsSent: Set<string> = new Set();
  
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
  }
  
  /**
   * Calculate cost for a Together.ai API call
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = TOGETHER_AI_PRICING[model] || TOGETHER_AI_PRICING['default'];
    
    const inputCost = (promptTokens / 1_000_000) * pricing.input;
    const outputCost = (completionTokens / 1_000_000) * pricing.output;
    
    return inputCost + outputCost;
  }
  
  /**
   * Track LLM usage and cost
   */
  async trackUsage(params: {
    userId: string;
    sessionId?: string;
    provider: 'together_ai' | 'openai';
    model: string;
    promptTokens: number;
    completionTokens: number;
    endpoint: string;
    success: boolean;
    errorMessage?: string;
    latencyMs: number;
  }): Promise<void> {
    const cost = this.calculateCost(
      params.model,
      params.promptTokens,
      params.completionTokens
    );
    
    const record: LLMUsageRecord = {
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
      console.error('Failed to track LLM usage:', error);
    }
    
    // Check for cost threshold violations
    await this.checkCostThresholds();
  }
  
  /**
   * Get cost for a specific time period
   */
  async getCostForPeriod(
    startTime: Date,
    endTime: Date,
    userId?: string
  ): Promise<number> {
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
      console.error('Failed to get cost for period:', error);
      return 0;
    }
    
    return data?.reduce((sum, record) => sum + record.estimated_cost, 0) || 0;
  }
  
  /**
   * Get hourly cost
   */
  async getHourlyCost(): Promise<number> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    return await this.getCostForPeriod(oneHourAgo, now);
  }
  
  /**
   * Get daily cost
   */
  async getDailyCost(userId?: string): Promise<number> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return await this.getCostForPeriod(oneDayAgo, now, userId);
  }
  
  /**
   * Get monthly cost
   */
  async getMonthlyCost(): Promise<number> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return await this.getCostForPeriod(oneMonthAgo, now);
  }
  
  /**
   * Check if cost thresholds are exceeded
   */
  async checkCostThresholds(): Promise<CostAlert[]> {
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
    // Prevent duplicate alerts within 1 hour
    const alertKey = `${alert.period}-${alert.level}`;
    if (this.alertsSent.has(alertKey)) {
      return;
    }
    
    this.alertsSent.add(alertKey);
    setTimeout(() => this.alertsSent.delete(alertKey), 60 * 60 * 1000);
    
    console.error('LLM COST ALERT:', alert);
    
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
    if (process.env.SLACK_WEBHOOK_URL) {
      await this.sendSlackAlert(alert);
    }
    
    // For critical alerts, also send email
    if (alert.level === 'critical' && process.env.ALERT_EMAIL) {
      await this.sendEmailAlert(alert);
    }
  }
  
  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: CostAlert): Promise<void> {
    try {
      const color = alert.level === 'critical' ? 'danger' : 'warning';
      const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
      
      await fetch(process.env.SLACK_WEBHOOK_URL!, {
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
            ts: Math.floor(Date.now() / 1000)
          }]
        })
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }
  
  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: CostAlert): Promise<void> {
    // Implement email sending (e.g., using SendGrid, AWS SES)
    console.log('Email alert would be sent:', alert);
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
    const { data, error } = await this.supabase
      .from('llm_usage')
      .select('user_id, estimated_cost')
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    
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

// Export singleton instance
export const llmCostTracker = new LLMCostTracker();
