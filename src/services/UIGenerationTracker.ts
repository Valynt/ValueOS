/**
 * UI Generation Tracker
 * 
 * Tracks UI generation trajectories, user interactions, and calculates effectiveness metrics.
 */

import { logger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import type {
  UIGenerationTrajectory,
  UIInteractionEvent,
  UIGenerationMetrics,
  UIGenerationFeedback,
  ComponentUsageStats,
} from '../types/UIGenerationMetrics';

export class UIGenerationTracker {
  /**
   * Track a UI generation trajectory
   */
  async trackGeneration(trajectory: Omit<UIGenerationTrajectory, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await supabase
      .from('ui_generation_trajectories')
      .insert({
        ...trajectory,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update component usage stats
    for (const component of trajectory.components_selected) {
      await this.updateComponentStats(
        component,
        trajectory.validation_passed,
        trajectory.generation_time_ms,
        trajectory.layout_chosen
      );
    }

    return data.id;
  }

  /**
   * Track a user interaction event
   */
  async trackInteraction(
    trajectoryId: string,
    event: Omit<UIInteractionEvent, 'id' | 'trajectory_id' | 'created_at'>
  ): Promise<void> {
    const { error } = await supabase
      .from('ui_interaction_events')
      .insert({
        trajectory_id: trajectoryId,
        ...event,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;

    // Metrics will be auto-calculated by trigger
  }

  /**
   * Get metrics for a trajectory
   */
  async getMetrics(trajectoryId: string): Promise<UIGenerationMetrics | null> {
    const { data, error } = await supabase
      .from('ui_generation_metrics')
      .select('*')
      .eq('trajectory_id', trajectoryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as UIGenerationMetrics;
  }

  /**
   * Add feedback for a trajectory
   */
  async addFeedback(
    trajectoryId: string,
    feedback: Omit<UIGenerationFeedback, 'id' | 'trajectory_id' | 'created_at'>
  ): Promise<void> {
    const { error } = await supabase
      .from('ui_generation_feedback')
      .insert({
        trajectory_id: trajectoryId,
        ...feedback,
        created_at: new Date().toISOString(),
      });

    if (error) throw error;
  }

  /**
   * Get component usage statistics
   */
  async getComponentStats(componentName: string): Promise<ComponentUsageStats | null> {
    const { data, error } = await supabase
      .from('component_usage_stats')
      .select('*')
      .eq('component_name', componentName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as ComponentUsageStats;
  }

  /**
   * Get all component statistics
   */
  async getAllComponentStats(): Promise<ComponentUsageStats[]> {
    const { data, error } = await supabase
      .from('component_usage_stats')
      .select('*')
      .order('success_rate', { ascending: false });

    if (error) throw error;
    return (data || []) as ComponentUsageStats[];
  }

  /**
   * Get top performing components
   */
  async getTopComponents(limit: number = 10): Promise<ComponentUsageStats[]> {
    const { data, error } = await supabase
      .from('component_usage_stats')
      .select('*')
      .order('success_rate', { ascending: false })
      .order('total_uses', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ComponentUsageStats[];
  }

  /**
   * Get trajectories with low quality scores
   */
  async getLowQualityTrajectories(threshold: number = 50, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('ui_generation_metrics')
      .select(`
        *,
        trajectory:ui_generation_trajectories(*)
      `)
      .lt('overall_quality_score', threshold)
      .order('overall_quality_score', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get successful trajectories for learning
   */
  async getSuccessfulTrajectories(limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('ui_generation_metrics')
      .select(`
        *,
        trajectory:ui_generation_trajectories(*)
      `)
      .eq('task_success', true)
      .gte('overall_quality_score', 80)
      .order('overall_quality_score', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Calculate aggregate statistics
   */
  async getAggregateStats(): Promise<{
    total_generations: number;
    dynamic_generations: number;
    static_generations: number;
    average_quality_score: number;
    average_task_success_rate: number;
    average_generation_time_ms: number;
    total_tokens_used: number;
  }> {
    const { data: trajectories } = await supabase
      .from('ui_generation_trajectories')
      .select('generation_method, generation_time_ms, tokens_used');

    const { data: metrics } = await supabase
      .from('ui_generation_metrics')
      .select('overall_quality_score, task_success');

    const total = trajectories?.length || 0;
    const dynamic = trajectories?.filter((t) => t.generation_method === 'dynamic').length || 0;
    const static_ = trajectories?.filter((t) => t.generation_method === 'static').length || 0;

    const avgQuality =
      metrics?.reduce((sum, m) => sum + (m.overall_quality_score || 0), 0) / (metrics?.length || 1) || 0;

    const successRate =
      metrics?.filter((m) => m.task_success).length / (metrics?.length || 1) || 0;

    const avgTime =
      trajectories?.reduce((sum, t) => sum + t.generation_time_ms, 0) / total || 0;

    const totalTokens =
      trajectories?.reduce((sum, t) => sum + (t.tokens_used || 0), 0) || 0;

    return {
      total_generations: total,
      dynamic_generations: dynamic,
      static_generations: static_,
      average_quality_score: avgQuality,
      average_task_success_rate: successRate,
      average_generation_time_ms: avgTime,
      total_tokens_used: totalTokens,
    };
  }

  /**
   * Get layout effectiveness
   */
  async getLayoutEffectiveness(layoutType: string): Promise<any> {
    const { data, error } = await supabase
      .from('layout_effectiveness')
      .select('*')
      .eq('layout_type', layoutType)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  /**
   * Compare generation methods
   */
  async compareGenerationMethods(): Promise<{
    dynamic: { avg_quality: number; avg_time: number; success_rate: number };
    static: { avg_quality: number; avg_time: number; success_rate: number };
  }> {
    const { data: dynamicMetrics } = await supabase
      .from('ui_generation_metrics')
      .select(`
        overall_quality_score,
        task_success,
        generation_time_ms,
        trajectory:ui_generation_trajectories!inner(generation_method)
      `)
      .eq('trajectory.generation_method', 'dynamic');

    const { data: staticMetrics } = await supabase
      .from('ui_generation_metrics')
      .select(`
        overall_quality_score,
        task_success,
        generation_time_ms,
        trajectory:ui_generation_trajectories!inner(generation_method)
      `)
      .eq('trajectory.generation_method', 'static');

    const calcStats = (metrics: any[]) => {
      if (!metrics || metrics.length === 0) {
        return { avg_quality: 0, avg_time: 0, success_rate: 0 };
      }

      return {
        avg_quality:
          metrics.reduce((sum, m) => sum + (m.overall_quality_score || 0), 0) / metrics.length,
        avg_time:
          metrics.reduce((sum, m) => sum + (m.generation_time_ms || 0), 0) / metrics.length,
        success_rate: metrics.filter((m) => m.task_success).length / metrics.length,
      };
    };

    return {
      dynamic: calcStats(dynamicMetrics || []),
      static: calcStats(staticMetrics || []),
    };
  }

  // Private helper methods

  private async updateComponentStats(
    componentName: string,
    success: boolean,
    generationTimeMs: number,
    layout: string
  ): Promise<void> {
    try {
      await supabase.rpc('update_component_usage_stats', {
        p_component_name: componentName,
        p_success: success,
        p_generation_time_ms: generationTimeMs,
        p_layout: layout,
      });
    } catch (error) {
      logger.error('Failed to update component stats', error instanceof Error ? error : undefined);
    }
  }
}

// Singleton instance
let trackerInstance: UIGenerationTracker | null = null;

export function getUIGenerationTracker(): UIGenerationTracker {
  if (!trackerInstance) {
    trackerInstance = new UIGenerationTracker();
  }
  return trackerInstance;
}

export default UIGenerationTracker;
