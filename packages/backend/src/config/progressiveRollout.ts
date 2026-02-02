/**
 * Progressive Feature Rollout System
 * 
 * Enables gradual feature rollout with automatic rollback on errors
 * 
 * Usage:
 *   const rollout = new ProgressiveRollout('new-ui-redesign');
 *   if (await rollout.isEnabledForUser(userId)) {
 *     // Show new feature
 *   }
 */

import { logger } from '../lib/logger.js'
import { supabase } from '../lib/supabase.js'

export interface RolloutConfig {
  featureName: string;
  percentage: number;
  targetGroups?: string[];
  excludeGroups?: string[];
  startDate?: Date;
  endDate?: Date;
  autoRollback?: boolean;
  errorThreshold?: number; // Percentage of errors before rollback
}

export interface RolloutMetrics {
  totalUsers: number;
  enabledUsers: number;
  errors: number;
  errorRate: number;
  lastUpdated: Date;
}

export class ProgressiveRollout {
  private featureName: string;
  private config: RolloutConfig | null = null;
  private metrics: RolloutMetrics | null = null;

  // Static buffer for batching usage tracking
  private static usageBuffer: {
    feature_name: string;
    user_id: string;
    enabled: boolean;
    timestamp: string;
  }[] = [];

  private static flushInterval: NodeJS.Timeout | null = null;
  private static readonly FLUSH_DELAY_MS = 5000;
  private static readonly BUFFER_LIMIT = 100;

  constructor(featureName: string) {
    this.featureName = featureName;
  }

  /**
   * Flush usage buffer to database
   */
  static async flushBuffer(): Promise<void> {
    if (this.usageBuffer.length === 0) return;

    const batch = [...this.usageBuffer];
    this.usageBuffer = []; // Clear buffer immediately

    try {
      const { error } = await supabase.from('feature_usage').insert(batch);

      if (error) {
        logger.error('Failed to flush feature usage buffer', { error, count: batch.length });
        // Since we already cleared the buffer, these metrics are lost.
        // We accept this trade-off for performance.
      }
    } catch (error) {
      logger.error('Error flushing feature usage buffer', { error, count: batch.length });
    }
  }

  /**
   * Start flush interval if not running
   */
  private static startFlushInterval(): void {
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        this.flushBuffer().catch(err => {
          logger.error('Error in flush interval', { error: err });
        });
      }, this.FLUSH_DELAY_MS);

      // Ensure the interval doesn't prevent the process from exiting
      if (this.flushInterval.unref) {
        this.flushInterval.unref();
      }
    }
  }

  /**
   * Load rollout configuration from database
   */
  async loadConfig(): Promise<RolloutConfig | null> {
    try {
      const { data, error } = await supabase
        .from('feature_rollouts')
        .select('*')
        .eq('feature_name', this.featureName)
        .eq('active', true)
        .single();

      if (error) {
        logger.warn('Failed to load rollout config', { feature: this.featureName, error });
        return null;
      }

      this.config = {
        featureName: data.feature_name,
        percentage: data.percentage,
        targetGroups: data.target_groups,
        excludeGroups: data.exclude_groups,
        startDate: data.start_date ? new Date(data.start_date) : undefined,
        endDate: data.end_date ? new Date(data.end_date) : undefined,
        autoRollback: data.auto_rollback ?? true,
        errorThreshold: data.error_threshold ?? 5.0,
      };

      return this.config;
    } catch (error) {
      logger.error('Error loading rollout config', { feature: this.featureName, error });
      return null;
    }
  }

  /**
   * Check if feature is enabled for a specific user
   */
  async isEnabledForUser(userId: string, userGroups?: string[]): Promise<boolean> {
    // Load config if not already loaded
    if (!this.config) {
      await this.loadConfig();
    }

    // If no config, feature is disabled
    if (!this.config) {
      return false;
    }

    // Check date range
    const now = new Date();
    if (this.config.startDate && now < this.config.startDate) {
      return false;
    }
    if (this.config.endDate && now > this.config.endDate) {
      return false;
    }

    // Check exclude groups
    if (this.config.excludeGroups && userGroups) {
      const hasExcludedGroup = userGroups.some(group => 
        this.config!.excludeGroups!.includes(group)
      );
      if (hasExcludedGroup) {
        return false;
      }
    }

    // Check target groups (if specified, user must be in one)
    if (this.config.targetGroups && this.config.targetGroups.length > 0) {
      if (!userGroups) {
        return false;
      }
      const hasTargetGroup = userGroups.some(group => 
        this.config!.targetGroups!.includes(group)
      );
      if (!hasTargetGroup) {
        return false;
      }
    }

    // Check percentage rollout (deterministic hash-based)
    const isInRollout = this.isUserInPercentage(userId, this.config.percentage);

    // Track usage
    this.trackUsage(userId, isInRollout).catch(err => {
      logger.error('Failed to track usage', { feature: this.featureName, error: err });
    });

    return isInRollout;
  }

  /**
   * Deterministic hash-based percentage check
   */
  private isUserInPercentage(userId: string, percentage: number): boolean {
    if (percentage >= 100) return true;
    if (percentage <= 0) return false;

    // Hash user ID to get consistent result
    const hash = this.hashString(userId + this.featureName);
    return (hash % 100) < percentage;
  }

  /**
   * Simple hash function for deterministic rollout
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Track feature usage
   */
  private async trackUsage(userId: string, enabled: boolean): Promise<void> {
    try {
      ProgressiveRollout.usageBuffer.push({
        feature_name: this.featureName,
        user_id: userId,
        enabled,
        timestamp: new Date().toISOString(),
      });

      ProgressiveRollout.startFlushInterval();

      if (ProgressiveRollout.usageBuffer.length >= ProgressiveRollout.BUFFER_LIMIT) {
        // Flush asynchronously to not block
        ProgressiveRollout.flushBuffer().catch(err => {
          logger.error('Failed to flush usage buffer on limit', { error: err });
        });
      }
    } catch (error) {
      // Don't fail if tracking fails
      logger.warn('Failed to track feature usage', { feature: this.featureName, error });
    }
  }

  /**
   * Track feature error
   */
  async trackError(userId: string, error: Error): Promise<void> {
    try {
      await supabase.from('feature_errors').insert({
        feature_name: this.featureName,
        user_id: userId,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      // Check if we should auto-rollback
      await this.checkAutoRollback();
    } catch (err) {
      logger.error('Failed to track feature error', { feature: this.featureName, error: err });
    }
  }

  /**
   * Get current rollout metrics
   */
  async getMetrics(): Promise<RolloutMetrics> {
    try {
      const timestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours

      const [
        { data: usageData, error: usageError },
        { data: errorData, error: errorError }
      ] = await Promise.all([
        supabase
          .from('feature_usage')
          .select('enabled')
          .eq('feature_name', this.featureName)
          .gte('timestamp', timestamp),
        supabase
          .from('feature_errors')
          .select('id')
          .eq('feature_name', this.featureName)
          .gte('timestamp', timestamp)
      ]);

      if (usageError) throw usageError;
      if (errorError) throw errorError;

      const totalUsers = usageData.length;
      const enabledUsers = usageData.filter(u => u.enabled).length;

      const errors = errorData.length;
      const errorRate = enabledUsers > 0 ? (errors / enabledUsers) * 100 : 0;

      this.metrics = {
        totalUsers,
        enabledUsers,
        errors,
        errorRate,
        lastUpdated: new Date(),
      };

      return this.metrics;
    } catch (error) {
      logger.error('Failed to get rollout metrics', { feature: this.featureName, error });
      throw error;
    }
  }

  /**
   * Check if auto-rollback should be triggered
   */
  private async checkAutoRollback(): Promise<void> {
    if (!this.config?.autoRollback) {
      return;
    }

    const metrics = await this.getMetrics();

    if (metrics.errorRate > (this.config.errorThreshold ?? 5.0)) {
      logger.error('Auto-rollback triggered', {
        feature: this.featureName,
        errorRate: metrics.errorRate,
        threshold: this.config.errorThreshold,
      });

      await this.rollback('Auto-rollback due to high error rate');
    }
  }

  /**
   * Manually rollback feature
   */
  async rollback(reason: string): Promise<void> {
    try {
      await supabase
        .from('feature_rollouts')
        .update({
          active: false,
          rollback_reason: reason,
          rollback_at: new Date().toISOString(),
        })
        .eq('feature_name', this.featureName);

      logger.info('Feature rolled back', { feature: this.featureName, reason });

      // Send alert
      await this.sendRollbackAlert(reason);
    } catch (error) {
      logger.error('Failed to rollback feature', { feature: this.featureName, error });
      throw error;
    }
  }

  /**
   * Gradually increase rollout percentage
   */
  async increasePercentage(newPercentage: number): Promise<void> {
    if (newPercentage < 0 || newPercentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    try {
      await supabase
        .from('feature_rollouts')
        .update({
          percentage: newPercentage,
          updated_at: new Date().toISOString(),
        })
        .eq('feature_name', this.featureName);

      logger.info('Rollout percentage increased', {
        feature: this.featureName,
        percentage: newPercentage,
      });

      // Reload config
      await this.loadConfig();
    } catch (error) {
      logger.error('Failed to increase rollout percentage', {
        feature: this.featureName,
        error,
      });
      throw error;
    }
  }

  /**
   * Send rollback alert
   */
  private async sendRollbackAlert(reason: string): Promise<void> {
    // Send to monitoring system
    try {
      await fetch(import.meta.env.VITE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'feature_rollback',
          feature: this.featureName,
          reason,
          metrics: this.metrics,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('Failed to send rollback alert', { feature: this.featureName, error });
    }
  }
}

/**
 * Progressive rollout manager
 */
export class RolloutManager {
  private rollouts: Map<string, ProgressiveRollout> = new Map();

  /**
   * Get or create rollout instance
   */
  getRollout(featureName: string): ProgressiveRollout {
    if (!this.rollouts.has(featureName)) {
      this.rollouts.set(featureName, new ProgressiveRollout(featureName));
    }
    return this.rollouts.get(featureName)!;
  }

  /**
   * Check if feature is enabled for user
   */
  async isEnabled(
    featureName: string,
    userId: string,
    userGroups?: string[]
  ): Promise<boolean> {
    const rollout = this.getRollout(featureName);
    return rollout.isEnabledForUser(userId, userGroups);
  }

  /**
   * Track error for feature
   */
  async trackError(featureName: string, userId: string, error: Error): Promise<void> {
    const rollout = this.getRollout(featureName);
    await rollout.trackError(userId, error);
  }

  /**
   * Get metrics for all active rollouts
   */
  async getAllMetrics(): Promise<Map<string, RolloutMetrics>> {
    const metrics = new Map<string, RolloutMetrics>();

    await Promise.all(
      Array.from(this.rollouts.entries()).map(async ([featureName, rollout]) => {
        try {
          const rolloutMetrics = await rollout.getMetrics();
          metrics.set(featureName, rolloutMetrics);
        } catch (error) {
          logger.error('Failed to get metrics for rollout', { featureName, error });
        }
      })
    );

    return metrics;
  }
}

/**
 * Global rollout manager instance
 */
export const rolloutManager = new RolloutManager();

/**
 * React hook for feature flags with progressive rollout
 */
export function useFeatureRollout(featureName: string, userId: string, userGroups?: string[]) {
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    async function checkFeature() {
      try {
        const isEnabled = await rolloutManager.isEnabled(featureName, userId, userGroups);
        if (mounted) {
          setEnabled(isEnabled);
          setLoading(false);
        }
      } catch (error) {
        logger.error('Failed to check feature rollout', { featureName, error });
        if (mounted) {
          setEnabled(false);
          setLoading(false);
        }
      }
    }

    checkFeature();

    return () => {
      mounted = false;
    };
  }, [featureName, userId, userGroups]);

  return { enabled, loading };
}
