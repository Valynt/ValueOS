/**
 * Task #013: Demo Analytics Service
 * 
 * Tracks demo completion rates and identifies drop-off points
 */

import { supabase } from '../lib/supabase';
import { analyticsClient } from '../lib/analyticsClient';

export interface DemoEvent {
  id: string;
  user_id: string;
  demo_type: 'five_minute_value' | 'interface_tour' | 'hello_world';
  event_type: 'started' | 'step_completed' | 'completed' | 'skipped' | 'abandoned';
  step_id?: string;
  step_number?: number;
  time_spent_seconds?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface DemoAnalytics {
  demo_type: string;
  total_starts: number;
  total_completions: number;
  completion_rate: number;
  average_completion_time: number;
  drop_off_points: Array<{
    step_id: string;
    step_number: number;
    drop_off_count: number;
    drop_off_rate: number;
  }>;
  skip_rate: number;
  time_to_complete_percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
}

export class DemoAnalyticsService {
  /**
   * Track demo event
   */
  async trackDemoEvent(event: Omit<DemoEvent, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase.from('demo_events').insert({
        ...event,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Also track in analytics client for real-time dashboards
      analyticsClient.trackWorkflowEvent(event.event_type, 'demo_analytics', {
        demo_type: event.demo_type,
        step_id: event.step_id,
        step_number: event.step_number,
        time_spent_seconds: event.time_spent_seconds,
        ...event.metadata,
      });
    } catch (error) {
      console.error('Failed to track demo event:', error);
      // Don't throw - analytics failures shouldn't break user flow
    }
  }

  /**
   * Get analytics for specific demo type
   */
  async getDemoAnalytics(demoType: string, timeframe?: { start: Date; end: Date }): Promise<DemoAnalytics> {
    try {
      let query = supabase
        .from('demo_events')
        .select('*')
        .eq('demo_type', demoType);

      if (timeframe) {
        query = query
          .gte('created_at', timeframe.start.toISOString())
          .lte('created_at', timeframe.end.toISOString());
      }

      const { data: events, error } = await query;

      if (error) throw error;

      return this.calculateAnalytics(events || [], demoType);
    } catch (error) {
      console.error('Failed to get demo analytics:', error);
      return this.getEmptyAnalytics(demoType);
    }
  }

  /**
   * Calculate analytics from events
   */
  private calculateAnalytics(events: DemoEvent[], demoType: string): DemoAnalytics {
    const starts = events.filter((e) => e.event_type === 'started');
    const completions = events.filter((e) => e.event_type === 'completed');
    const skips = events.filter((e) => e.event_type === 'skipped');

    const totalStarts = starts.length;
    const totalCompletions = completions.length;
    const completionRate = totalStarts > 0 ? totalCompletions / totalStarts : 0;
    const skipRate = totalStarts > 0 ? skips.length / totalStarts : 0;

    // Calculate average completion time
    const completionTimes = completions
      .map((e) => e.time_spent_seconds)
      .filter((t): t is number => t !== undefined);
    const averageCompletionTime =
      completionTimes.length > 0
        ? completionTimes.reduce((sum, t) => sum + t, 0) / completionTimes.length
        : 0;

    // Calculate percentiles
    const sorted = [...completionTimes].sort((a, b) => a - b);
    const timeToCompletePercentiles = {
      p50: this.percentile(sorted, 50),
      p75: this.percentile(sorted, 75),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
    };

    // Identify drop-off points
    const stepCompletions = new Map<string, number>();
    events
      .filter((e) => e.event_type === 'step_completed' && e.step_id)
      .forEach((e) => {
        const count = stepCompletions.get(e.step_id!) || 0;
        stepCompletions.set(e.step_id!, count + 1);
      });

    const stepStarts = new Map<string, number>();
    events
      .filter((e) => e.event_type === 'started')
      .forEach((start) => {
        // All steps start with initial start count
        const metadata = start.metadata as any;
        const totalSteps = metadata?.total_steps || 5;
        for (let i = 1; i <= totalSteps; i++) {
          stepStarts.set(`step-${i}`, (stepStarts.get(`step-${i}`) || 0) + 1);
        }
      });

    const dropOffPoints: DemoAnalytics['drop_off_points'] = [];
    stepStarts.forEach((starts, stepId) => {
      const completions = stepCompletions.get(stepId) || 0;
      const dropOffs = starts - completions;
      
      if (dropOffs > 0) {
        dropOffPoints.push({
          step_id: stepId,
          step_number: parseInt(stepId.split('-')[1]) || 0,
          drop_off_count: dropOffs,
          drop_off_rate: dropOffs / starts,
        });
      }
    });

    // Sort by drop-off rate descending
    dropOffPoints.sort((a, b) => b.drop_off_rate - a.drop_off_rate);

    return {
      demo_type: demoType,
      total_starts: totalStarts,
      total_completions: totalCompletions,
      completion_rate: completionRate,
      average_completion_time: averageCompletionTime,
      drop_off_points: dropOffPoints,
      skip_rate: skipRate,
      time_to_complete_percentiles: timeToCompletePercentiles,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get empty analytics structure
   */
  private getEmptyAnalytics(demoType: string): DemoAnalytics {
    return {
      demo_type: demoType,
      total_starts: 0,
      total_completions: 0,
      completion_rate: 0,
      average_completion_time: 0,
      drop_off_points: [],
      skip_rate: 0,
      time_to_complete_percentiles: {
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
      },
    };
  }

  /**
   * Get drop-off funnel data for visualization
   */
  async getDropOffFunnel(demoType: string): Promise<Array<{ step: string; users: number; dropOffRate: number }>> {
    const analytics = await this.getDemoAnalytics(demoType);
    
    const funnel: Array<{ step: string; users: number; dropOffRate: number }> = [
      {
        step: 'Started',
        users: analytics.total_starts,
        dropOffRate: 0,
      },
    ];

    let remainingUsers = analytics.total_starts;
    analytics.drop_off_points.forEach((dropOff) => {
      remainingUsers -= dropOff.drop_off_count;
      funnel.push({
        step: `Step ${dropOff.step_number}`,
        users: remainingUsers,
        dropOffRate: dropOff.drop_off_rate,
      });
    });

    funnel.push({
      step: 'Completed',
      users: analytics.total_completions,
      dropOffRate: 1 - analytics.completion_rate,
    });

    return funnel;
  }

  /**
   * Get recommended improvements based on analytics
   */
  async getImprovementRecommendations(demoType: string): Promise<string[]> {
    const analytics = await this.getDemoAnalytics(demoType);
    const recommendations: string[] = [];

    // Low completion rate
    if (analytics.completion_rate < 0.5) {
      recommendations.push('⚠️ Completion rate is below 50%. Consider simplifying the demo or adding skip options.');
    }

    // High skip rate
    if (analytics.skip_rate > 0.3) {
      recommendations.push('⚠️ High skip rate detected. Users may find the demo too long or not relevant.');
    }

    // Long completion time
    if (analytics.average_completion_time > 360) {
      // 6 minutes
      recommendations.push('⏱️ Average completion time exceeds 6 minutes. Consider breaking into smaller chunks.');
    }

    // Identify worst drop-off step
    if (analytics.drop_off_points.length > 0) {
      const worstStep = analytics.drop_off_points[0];
      if (worstStep.drop_off_rate > 0.2) {
        recommendations.push(
          `🚨 ${(worstStep.drop_off_rate * 100).toFixed(0)}% drop-off at Step ${worstStep.step_number}. Review this step for clarity and value.`
        );
      }
    }

    // Good performance
    if (analytics.completion_rate > 0.7 && analytics.average_completion_time < 300) {
      recommendations.push('✅ Demo performing well! High completion rate and optimal timing.');
    }

    return recommendations;
  }
}

export const demoAnalyticsService = new DemoAnalyticsService();
