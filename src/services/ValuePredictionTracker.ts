/**
 * Value Prediction Tracker
 * 
 * Tracks value predictions and compares them against actual outcomes
 * to measure prediction accuracy over time.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { getMetricsCollector } from './MetricsCollector';

export interface ValuePrediction {
  id: string;
  predictionType: string;
  predictedValue: number;
  confidence: number;
  sessionId: string;
  agentId: string;
  metadata?: Record\u003cstring, any\u003e;
}

export interface ActualOutcome {
  predictionId: string;
  actualValue: number;
  measurementDate: Date;
  notes?: string;
}

export interface PredictionAccuracy {
  predictionId: string;
  predictionType: string;
  predictedValue: number;
  actualValue: number;
  errorValue: number;
  errorPercent: number;
  confidence: number;
}

/**
 * Value Prediction Tracker Service
 */
export class ValuePredictionTracker {
  private supabase: SupabaseClient;
  private metricsCollector = getMetricsCollector();

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Record a value prediction
   */
  async recordPrediction(prediction: ValuePrediction): Promise\u003cstring\u003e {
    try {
      const { data, error } = await this.supabase
        .from('agent_predictions')
        .insert({
          id: prediction.id,
          session_id: prediction.sessionId,
          agent_id: prediction.agentId,
          agent_type: 'value_prediction',
          prediction: {
            type: prediction.predictionType,
            value: prediction.predictedValue,
            confidence: prediction.confidence
          },
          confidence_score: prediction.confidence,
          metadata: prediction.metadata || {},
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) throw error;

      // Record in metrics
      this.metricsCollector.recordValuePrediction(
        prediction.predictionType,
        prediction.predictedValue
      );

      logger.info('Value prediction recorded', {
        predictionId: data.id,
        type: prediction.predictionType,
        value: prediction.predictedValue
      });

      return data.id;

    } catch (error) {
      logger.error('Failed to record value prediction', error as Error, {
        predictionType: prediction.predictionType
      });
      throw error;
    }
  }

  /**
   * Record actual outcome for a prediction
   */
  async recordActualOutcome(outcome: ActualOutcome): Promise\u003cvoid\u003e {
    try {
      // Get the original prediction
      const { data: prediction, error: predError } = await this.supabase
        .from('agent_predictions')
        .select('*')
        .eq('id', outcome.predictionId)
        .single();

      if (predError) throw predError;
      if (!prediction) throw new Error('Prediction not found');

      const predictedValue = prediction.prediction?.value || 0;
      const errorValue = Math.abs(predictedValue - outcome.actualValue);
      const errorPercent = (errorValue / outcome.actualValue) * 100;

      // Insert accuracy record
      const { error: insertError } = await this.supabase
        .from('value_prediction_accuracy')
        .insert({
          prediction_id: outcome.predictionId,
          prediction_type: prediction.prediction?.type || 'unknown',
          predicted_value: predictedValue,
          actual_value: outcome.actualValue,
          error_value: errorValue,
          error_percent: errorPercent,
          measurement_date: outcome.measurementDate.toISOString(),
          notes: outcome.notes,
          created_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      // Record in metrics
      this.metricsCollector.recordValuePrediction(
        prediction.prediction?.type || 'unknown',
        predictedValue,
        outcome.actualValue
      );

      logger.info('Actual outcome recorded', {
        predictionId: outcome.predictionId,
        predictedValue,
        actualValue: outcome.actualValue,
        errorPercent: errorPercent.toFixed(2)
      });

    } catch (error) {
      logger.error('Failed to record actual outcome', error as Error, {
        predictionId: outcome.predictionId
      });
      throw error;
    }
  }

  /**
   * Get prediction accuracy for a specific prediction
   */
  async getPredictionAccuracy(predictionId: string): Promise\u003cPredictionAccuracy | null\u003e {
    try {
      const { data, error } = await this.supabase
        .from('value_prediction_accuracy')
        .select(`
          *,
          agent_predictions!inner(
            confidence_score
          )
        `)
        .eq('prediction_id', predictionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return {
        predictionId: data.prediction_id,
        predictionType: data.prediction_type,
        predictedValue: data.predicted_value,
        actualValue: data.actual_value,
        errorValue: data.error_value,
        errorPercent: data.error_percent,
        confidence: data.agent_predictions.confidence_score
      };

    } catch (error) {
      logger.error('Failed to get prediction accuracy', error as Error, {
        predictionId
      });
      throw error;
    }
  }

  /**
   * Get accuracy statistics for a prediction type
   */
  async getAccuracyStatistics(
    predictionType: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise\u003c{
    totalPredictions: number;
    predictionsWithActuals: number;
    avgErrorPercent: number;
    medianErrorPercent: number;
    accuracy: number;
    trend: 'improving' | 'stable' | 'declining';
  }\u003e {
    const periodDays = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };

    const since = new Date();
    since.setDate(since.getDate() - periodDays[period]);

    try {
      // Get all predictions with actuals
      const { data: accuracyData, error } = await this.supabase
        .from('value_prediction_accuracy')
        .select('error_percent, created_at')
        .eq('prediction_type', predictionType)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const totalPredictions = accuracyData?.length || 0;
      
      if (totalPredictions === 0) {
        return {
          totalPredictions: 0,
          predictionsWithActuals: 0,
          avgErrorPercent: 0,
          medianErrorPercent: 0,
          accuracy: 0,
          trend: 'stable'
        };
      }

      // Calculate statistics
      const errors = accuracyData.map(d =\u003e d.error_percent).sort((a, b) =\u003e a - b);
      const avgErrorPercent = errors.reduce((sum, e) =\u003e sum + e, 0) / errors.length;
      const medianErrorPercent = errors[Math.floor(errors.length / 2)];
      const accuracy = 1 - (avgErrorPercent / 100);

      // Calculate trend (compare first half vs second half)
      const midpoint = Math.floor(errors.length / 2);
      const firstHalfAvg = errors.slice(0, midpoint).reduce((sum, e) =\u003e sum + e, 0) / midpoint;
      const secondHalfAvg = errors.slice(midpoint).reduce((sum, e) =\u003e sum + e, 0) / (errors.length - midpoint);
      
      let trend: 'improving' | 'stable' | 'declining';
      if (secondHalfAvg \u003c firstHalfAvg * 0.9) {
        trend = 'improving'; // Error decreased by \u003e10%
      } else if (secondHalfAvg \u003e firstHalfAvg * 1.1) {
        trend = 'declining'; // Error increased by \u003e10%
      } else {
        trend = 'stable';
      }

      return {
        totalPredictions,
        predictionsWithActuals: totalPredictions,
        avgErrorPercent,
        medianErrorPercent,
        accuracy,
        trend
      };

    } catch (error) {
      logger.error('Failed to get accuracy statistics', error as Error, {
        predictionType,
        period
      });
      throw error;
    }
  }

  /**
   * Get predictions awaiting actual outcomes
   */
  async getPendingPredictions(
    predictionType?: string,
    olderThanDays: number = 30
  ): Promise\u003cArray\u003c{
    id: string;
    predictionType: string;
    predictedValue: number;
    createdAt: Date;
    daysOld: number;
  }\u003e\u003e {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      let query = this.supabase
        .from('agent_predictions')
        .select('id, prediction, created_at')
        .lte('created_at', cutoffDate.toISOString())
        .not('id', 'in', 
          this.supabase
            .from('value_prediction_accuracy')
            .select('prediction_id')
        );

      if (predictionType) {
        query = query.eq('prediction-\u003e\u003etype', predictionType);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map(p =\u003e {
        const createdAt = new Date(p.created_at);
        const daysOld = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: p.id,
          predictionType: p.prediction?.type || 'unknown',
          predictedValue: p.prediction?.value || 0,
          createdAt,
          daysOld
        };
      });

    } catch (error) {
      logger.error('Failed to get pending predictions', error as Error, {
        predictionType,
        olderThanDays
      });
      throw error;
    }
  }

  /**
   * Get accuracy trend over time
   */
  async getAccuracyTrend(
    predictionType: string,
    days: number = 30
  ): Promise\u003cArray\u003c{
    date: string;
    avgErrorPercent: number;
    predictionCount: number;
  }\u003e\u003e {
    const trend: Array\u003c{ date: string; avgErrorPercent: number; predictionCount: number }\u003e = [];

    for (let i = days - 1; i \u003e= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data } = await this.supabase
        .from('value_prediction_accuracy')
        .select('error_percent')
        .eq('prediction_type', predictionType)
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const count = data?.length || 0;
      const avgErrorPercent = count \u003e 0
        ? data.reduce((sum, d) =\u003e sum + d.error_percent, 0) / count
        : 0;

      trend.push({
        date: date.toISOString().split('T')[0],
        avgErrorPercent,
        predictionCount: count
      });
    }

    return trend;
  }
}

/**
 * Singleton instance
 */
let trackerInstance: ValuePredictionTracker | null = null;

/**
 * Get or create tracker instance
 */
export function getValuePredictionTracker(supabase: SupabaseClient): ValuePredictionTracker {
  if (!trackerInstance) {
    trackerInstance = new ValuePredictionTracker(supabase);
  }
  return trackerInstance;
}

/**
 * Reset tracker (for testing)
 */
export function resetValuePredictionTracker(): void {
  trackerInstance = null;
}
