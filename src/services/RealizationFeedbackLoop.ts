/**
 * Realization Feedback Loop with Compensation
 * 
 * Records actual outcomes, calculates variance, and triggers agent retraining
 * when prediction accuracy degrades.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

export type LifecycleStage = 'opportunity' | 'target' | 'expansion' | 'integrity' | 'realization';

export interface ActualOutcome {
  actual_value: number;
  notes?: string;
  recorded_date: Date;
  evidence?: string[];
}

export interface FeedbackContext {
  userId: string;
  organizationId?: string;
  sessionId?: string;
}

export interface VarianceAnalysis {
  absolute: number;
  percentage: number;
  direction: 'over' | 'under';
  magnitude: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  type: 'review_assumptions' | 'adjust_targets' | 'validate_data' | 'check_methodology';
  priority: 'low' | 'medium' | 'high';
  message: string;
  actions: string[];
}

export interface FeedbackLoopResult {
  success: boolean;
  feedbackId: string;
  variance: VarianceAnalysis;
  accuracy: number;
  recommendations: Recommendation[];
}

export interface ValueCommit {
  id: string;
  predicted_value: number;
  agent_type: LifecycleStage;
  value_tree_id?: string;
  created_at: string;
}

export class FeedbackLoopError extends Error {
  constructor(
    public valueCommitId: string,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'FeedbackLoopError';
  }
}

export class RealizationFeedbackLoop {
  private compensations: Map<string, (() => Promise<void>)[]> = new Map();
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseClient: ReturnType<typeof createClient>) {
    this.supabase = supabaseClient;
  }

  async recordActualOutcome(
    valueCommitId: string,
    actualOutcome: ActualOutcome,
    context: FeedbackContext
  ): Promise<FeedbackLoopResult> {
    const loopId = `feedback-${Date.now()}-${valueCommitId}`;
    this.compensations.set(loopId, []);

    try {
      // Step 1: Validate value commit exists
      const valueCommit = await this.getValueCommit(valueCommitId);
      this.compensations.get(loopId)!.push(() =>
        this.revertValueCommit(valueCommitId)
      );

      // Step 2: Calculate variance
      const variance = this.calculateVariance(
        valueCommit.predicted_value,
        actualOutcome.actual_value
      );

      // Step 3: Record feedback
      const { data: feedback, error } = await this.supabase
        .from('feedback_loops')
        .insert({
          value_commit_id: valueCommitId,
          predicted_value: valueCommit.predicted_value,
          actual_value: actualOutcome.actual_value,
          variance_percentage: variance.percentage,
          variance_absolute: variance.absolute,
          recorded_at: new Date().toISOString(),
          recorded_by: context.userId,
          notes: actualOutcome.notes
        })
        .select()
        .single();

      if (error) throw error;

      this.compensations.get(loopId)!.push(() =>
        this.deleteFeedback(feedback.id)
      );

      // Step 4: Update agent accuracy metrics
      await this.updateAgentAccuracy(
        valueCommit.agent_type,
        variance,
        context
      );

      // Step 5: Trigger retraining if accuracy drops
      if (await this.shouldRetrain(valueCommit.agent_type)) {
        await this.scheduleAgentRetraining(valueCommit.agent_type);
      }

      // Step 6: Update value tree with actuals
      if (valueCommit.value_tree_id) {
        await this.updateValueTreeActuals(
          valueCommit.value_tree_id,
          actualOutcome,
          context
        );
      }

      return {
        success: true,
        feedbackId: feedback.id,
        variance,
        accuracy: this.calculateAccuracy(variance),
        recommendations: await this.generateRecommendations(variance, valueCommit)
      };

    } catch (error) {
      // Execute compensating transactions
      const compensations = this.compensations.get(loopId) || [];
      for (const compensate of compensations.reverse()) {
        await compensate().catch(e =>
          logger.error('Feedback compensation failed', { loopId, error: e })
        );
      }

      throw new FeedbackLoopError(
        valueCommitId,
        `Feedback recording failed: ${error.message}`,
        error
      );

    } finally {
      this.compensations.delete(loopId);
    }
  }

  private async getValueCommit(valueCommitId: string): Promise<ValueCommit> {
    const { data, error } = await this.supabase
      .from('value_commits')
      .select('*')
      .eq('id', valueCommitId)
      .single();

    if (error) throw new Error(`Value commit not found: ${error.message}`);

    return data;
  }

  private async revertValueCommit(valueCommitId: string): Promise<void> {
    logger.info('Compensating: reverting value commit', { valueCommitId });
    // Implementation would revert any changes made to the value commit
  }

  private async deleteFeedback(feedbackId: string): Promise<void> {
    logger.info('Compensating: deleting feedback', { feedbackId });
    await this.supabase
      .from('feedback_loops')
      .delete()
      .eq('id', feedbackId);
  }

  private calculateVariance(
    predicted: number,
    actual: number
  ): VarianceAnalysis {
    const absolute = actual - predicted;
    const percentage = predicted !== 0
      ? (absolute / predicted) * 100
      : 0;

    return {
      absolute,
      percentage,
      direction: absolute > 0 ? 'over' : 'under',
      magnitude: Math.abs(percentage) < 10 ? 'low'
        : Math.abs(percentage) < 25 ? 'medium'
        : 'high'
    };
  }

  private calculateAccuracy(variance: VarianceAnalysis): number {
    // Accuracy is inverse of variance percentage
    const absVariance = Math.abs(variance.percentage);
    return Math.max(0, 100 - absVariance);
  }

  private async updateAgentAccuracy(
    agentType: LifecycleStage,
    variance: VarianceAnalysis,
    context: FeedbackContext
  ): Promise<void> {
    logger.info('Updating agent accuracy metrics', {
      agentType,
      variance: variance.percentage
    });

    await this.supabase
      .from('agent_accuracy_metrics')
      .insert({
        agent_type: agentType,
        variance_percentage: variance.percentage,
        variance_absolute: variance.absolute,
        recorded_at: new Date().toISOString(),
        organization_id: context.organizationId
      });
  }

  private async shouldRetrain(agentType: LifecycleStage): Promise<boolean> {
    // Get recent accuracy for this agent
    const { data: recentFeedback } = await this.supabase
      .from('feedback_loops')
      .select('variance_percentage')
      .eq('agent_type', agentType)
      .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (!recentFeedback || recentFeedback.length < 10) {
      return false; // Not enough data
    }

    // Calculate average accuracy
    const avgVariance = recentFeedback.reduce(
      (sum, f) => sum + Math.abs(f.variance_percentage), 0
    ) / recentFeedback.length;

    // Retrain if average variance > 25%
    return avgVariance > 25;
  }

  private async scheduleAgentRetraining(agentType: LifecycleStage): Promise<void> {
    logger.warn('Scheduling agent retraining due to accuracy degradation', {
      agentType
    });

    await this.supabase
      .from('agent_retraining_queue')
      .insert({
        agent_type: agentType,
        scheduled_at: new Date().toISOString(),
        status: 'pending',
        reason: 'accuracy_degradation'
      });
  }

  private async updateValueTreeActuals(
    valueTreeId: string,
    actualOutcome: ActualOutcome,
    context: FeedbackContext
  ): Promise<void> {
    logger.info('Updating value tree with actuals', {
      valueTreeId,
      actualValue: actualOutcome.actual_value
    });

    // Implementation would update the value tree nodes with actual values
  }

  private async generateRecommendations(
    variance: VarianceAnalysis,
    valueCommit: ValueCommit
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    if (variance.magnitude === 'high') {
      recommendations.push({
        type: 'review_assumptions',
        priority: 'high',
        message: `Large variance detected (${variance.percentage.toFixed(1)}%). Review assumptions used in ${valueCommit.agent_type} stage.`,
        actions: [
          'Review input data quality',
          'Validate calculation methodology',
          'Check for external factors'
        ]
      });
    }

    if (variance.direction === 'under' && variance.magnitude !== 'low') {
      recommendations.push({
        type: 'adjust_targets',
        priority: 'medium',
        message: 'Actual value underperformed prediction. Consider adjusting future targets.',
        actions: [
          'Apply conservative multiplier to future predictions',
          'Increase contingency buffers',
          'Review risk factors'
        ]
      });
    }

    if (variance.magnitude === 'medium' || variance.magnitude === 'high') {
      recommendations.push({
        type: 'validate_data',
        priority: 'medium',
        message: 'Significant variance detected. Validate input data quality.',
        actions: [
          'Verify data sources',
          'Check for data entry errors',
          'Review data collection process'
        ]
      });
    }

    return recommendations;
  }
}
