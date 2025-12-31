/**
 * Task #020: ValueMetricsTracker
 * 
 * Tracks and measures value delivered to users across the platform
 */

import { supabase } from '../lib/supabase';
import { analyticsClient } from '../lib/analyticsClient';

export interface ValueMetric {
  id: string;
  user_id: string;
  organization_id?: string;
  metric_type: 
    | 'time_saved'
    | 'revenue_identified'
    | 'cost_reduced'
    | 'risk_mitigated'
    | 'cases_created'
    | 'insights_generated'
    | 'decisions_made'
    | 'stakeholders_aligned';
  metric_value: number;
  unit: string;
  context?: Record<string, any>;
  case_id?: string;
  timestamp: string;
}

export interface ValueSummary {
  user_id: string;
  total_time_saved_hours: number;
  total_revenue_identified: number;
  total_cost_reduced: number;
  total_risk_mitigated: number;
  cases_created: number;
  insights_generated: number;
  first_value_timestamp?: string;
  latest_value_timestamp?: string;
  value_trend: 'increasing' | 'stable' | 'decreasing';
}

export class ValueMetricsTracker {
  /**
   * Track a value metric
   */
  async trackValue(metric: Omit<ValueMetric, 'id' | 'timestamp'>): Promise<void> {
    try {
      const { error } = await supabase.from('value_metrics').insert({
        ...metric,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      // Track in analytics for real-time monitoring
      analyticsClient.trackWorkflowEvent('value_delivered', 'value_tracking', {
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        unit: metric.unit,
        case_id: metric.case_id,
        ...metric.context,
      });
    } catch (error) {
      console.error('Failed to track value metric:', error);
    }
  }

  /**
   * Track time saved by automation or AI assistance
   */
  async trackTimeSaved(params: {
    user_id: string;
    hours_saved: number;
    context: { activity: string; case_id?: string };
  }): Promise<void> {
    await this.trackValue({
      user_id: params.user_id,
      metric_type: 'time_saved',
      metric_value: params.hours_saved,
      unit: 'hours',
      context: params.context,
      case_id: params.context.case_id,
    });
  }

  /**
   * Track revenue opportunity identified
   */
  async trackRevenueIdentified(params: {
    user_id: string;
    organization_id?: string;
    amount: number;
    context: { source: string; case_id?: string };
  }): Promise<void> {
    await this.trackValue({
      user_id: params.user_id,
      organization_id: params.organization_id,
      metric_type: 'revenue_identified',
      metric_value: params.amount,
      unit: 'USD',
      context: params.context,
      case_id: params.context.case_id,
    });
  }

  /**
   * Track cost reduction identified
   */
  async trackCostReduced(params: {
    user_id: string;
    organization_id?: string;
    amount: number;
    context: { category: string; case_id?: string };
  }): Promise<void> {
    await this.trackValue({
      user_id: params.user_id,
      organization_id: params.organization_id,
      metric_type: 'cost_reduced',
      metric_value: params.amount,
      unit: 'USD',
      context: params.context,
      case_id: params.context.case_id,
    });
  }

  /**
   * Track insight generation
   */
  async trackInsightGenerated(params: {
    user_id: string;
    insight_type: string;
    case_id?: string;
  }): Promise<void> {
    await this.trackValue({
      user_id: params.user_id,
      metric_type: 'insights_generated',
      metric_value: 1,
      unit: 'count',
      context: { insight_type: params.insight_type },
      case_id: params.case_id,
    });
  }

  /**
   * Get value summary for user
   */
  async getValueSummary(userId: string, timeframe?: { start: Date; end: Date }): Promise<ValueSummary> {
    try {
      let query = supabase
        .from('value_metrics')
        .select('*')
        .eq('user_id', userId);

      if (timeframe) {
        query = query
          .gte('timestamp', timeframe.start.toISOString())
          .lte('timestamp', timeframe.end.toISOString());
      }

      const { data: metrics, error } = await query;

      if (error) throw error;

      return this.calculateSummary(userId, metrics || []);
    } catch (error) {
      console.error('Failed to get value summary:', error);
      return this.getEmptySummary(userId);
    }
  }

  /**
   * Calculate summary from metrics
   */
  private calculateSummary(userId: string, metrics: ValueMetric[]): ValueSummary {
    const timeSaved = metrics
      .filter((m) => m.metric_type === 'time_saved')
      .reduce((sum, m) => sum + m.metric_value, 0);

    const revenueIdentified = metrics
      .filter((m) => m.metric_type === 'revenue_identified')
      .reduce((sum, m) => sum + m.metric_value, 0);

    const costReduced = metrics
      .filter((m) => m.metric_type === 'cost_reduced')
      .reduce((sum, m) => sum + m.metric_value, 0);

    const riskMitigated = metrics
      .filter((m) => m.metric_type === 'risk_mitigated')
      .reduce((sum, m) => sum + m.metric_value, 0);

    const casesCreated = metrics.filter((m) => m.metric_type === 'cases_created').length;

    const insightsGenerated = metrics.filter((m) => m.metric_type === 'insights_generated').length;

    const timestamps = metrics.map((m) => new Date(m.timestamp).getTime()).sort((a, b) => a - b);

    const firstValue = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : undefined;
    const latestValue = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : undefined;

    // Calculate trend (simple: compare first half vs second half)
    let trend: ValueSummary['value_trend'] = 'stable';
    if (metrics.length >= 4) {
      const mid = Math.floor(metrics.length / 2);
      const firstHalf = metrics.slice(0, mid);
      const secondHalf = metrics.slice(mid);

      const firstHalfValue = firstHalf.reduce((sum, m) => sum + m.metric_value, 0);
      const secondHalfValue = secondHalf.reduce((sum, m) => sum + m.metric_value, 0);

      if (secondHalfValue > firstHalfValue * 1.2) {
        trend = 'increasing';
      } else if (secondHalfValue < firstHalfValue * 0.8) {
        trend = 'decreasing';
      }
    }

    return {
      user_id: userId,
      total_time_saved_hours: timeSaved,
      total_revenue_identified: revenueIdentified,
      total_cost_reduced: costReduced,
      total_risk_mitigated: riskMitigated,
      cases_created: casesCreated,
      insights_generated: insightsGenerated,
      first_value_timestamp: firstValue,
      latest_value_timestamp: latestValue,
      value_trend: trend,
    };
  }

  /**
   * Get empty summary
   */
  private getEmptySummary(userId: string): ValueSummary {
    return {
      user_id: userId,
      total_time_saved_hours: 0,
      total_revenue_identified: 0,
      total_cost_reduced: 0,
      total_risk_mitigated: 0,
      cases_created: 0,
      insights_generated: 0,
      value_trend: 'stable',
    };
  }

  /**
   * Get leaderboard of value created
   */
  async getValueLeaderboard(limit = 10): Promise<Array<ValueSummary & { rank: number }>> {
    try {
      const { data: users, error } = await supabase
        .from('value_metrics')
        .select('user_id')
        .order('metric_value', { ascending: false })
        .limit(limit * 10); // Get more to dedupe

      if (error) throw error;

      // Get unique users
      const uniqueUsers = [...new Set(users?.map((u) => u.user_id) || [])];

      // Get summaries for top users
      const summaries = await Promise.all(
        uniqueUsers.slice(0, limit).map(async (userId) => {
          const summary = await this.getValueSummary(userId);
          return summary;
        })
      );

      // Calculate total value score for ranking
      const scored = summaries.map((s) => ({
        ...s,
        score:
          s.total_revenue_identified +
          s.total_cost_reduced +
          s.total_time_saved_hours * 100 + // $100/hour value
          s.insights_generated * 50, // $50 per insight
      }));

      // Sort by score
      scored.sort((a, b) => b.score - a.score);

      // Add rank
      return scored.map((s, idx) => ({
        ...s,
        rank: idx + 1,
      }));
    } catch (error) {
      console.error('Failed to get value leaderboard:', error);
      return [];
    }
  }

  /**
   * Get value metrics over time for charting
   */
  async getValueTimeSeries(
    userId: string,
    metricType: ValueMetric['metric_type'],
    days = 30
  ): Promise<Array<{ date: string; value: number }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: metrics, error } = await supabase
        .from('value_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('metric_type', metricType)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = new Map<string, number>();
      metrics?.forEach((m) => {
        const date = new Date(m.timestamp).toISOString().split('T')[0];
        grouped.set(date, (grouped.get(date) || 0) + m.metric_value);
      });

      return Array.from(grouped.entries()).map(([date, value]) => ({
        date,
        value,
      }));
    } catch (error) {
      console.error('Failed to get value time series:', error);
      return [];
    }
  }
}

export const valueMetricsTracker = new ValueMetricsTracker();
