/**
 * Metrics Collection Service
 * 
 * Tracks agent performance metrics:
 * - Agent success rates
 * - Value prediction accuracy
 * - Response times (p50, p95, p99)
 * - Error rates
 * - Business metrics
 */

import { createCounter, createHistogram, createObservableGauge } from '../lib/observability';
import { logger } from '../lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentMetrics {
  agentType: string;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  successRate: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  avgConfidenceScore: number;
  hallucinationRate: number;
}

export interface ValuePredictionMetrics {
  predictionType: string;
  totalPredictions: number;
  avgPredictedValue: number;
  avgActualValue: number;
  avgError: number;
  avgErrorPercent: number;
  accuracy: number;
}

export interface SystemMetrics {
  totalAgentInvocations: number;
  totalLLMCalls: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  cacheHitRate: number;
  avgLLMLatency: number;
  totalCost: number;
}

/**
 * Metrics Collector Service
 */
export class MetricsCollector {
  private supabase: SupabaseClient | null;
  
  // OpenTelemetry metrics
  private agentInvocationsCounter = createCounter(
    'agent.invocations.total',
    'Total number of agent invocations'
  );
  
  private agentSuccessCounter = createCounter(
    'agent.invocations.success',
    'Number of successful agent invocations'
  );
  
  private agentFailureCounter = createCounter(
    'agent.invocations.failure',
    'Number of failed agent invocations'
  );
  
  private agentResponseTimeHistogram = createHistogram(
    'agent.response_time',
    'Agent response time in milliseconds'
  );
  
  private agentConfidenceHistogram = createHistogram(
    'agent.confidence_score',
    'Agent confidence score (0-1)'
  );
  
  private valuePredictionCounter = createCounter(
    'value.predictions.total',
    'Total number of value predictions'
  );
  
  private valuePredictionErrorHistogram = createHistogram(
    'value.prediction_error',
    'Value prediction error percentage'
  );
  
  private hallucinationCounter = createCounter(
    'agent.hallucinations.total',
    'Total number of detected hallucinations'
  );
  
  private llmCallsCounter = createCounter(
    'llm.calls.total',
    'Total number of LLM calls'
  );
  
  private llmLatencyHistogram = createHistogram(
    'llm.latency',
    'LLM call latency in milliseconds'
  );
  
  private llmCostCounter = createCounter(
    'llm.cost.total',
    'Total LLM cost in USD'
  );
  
  private cacheHitsCounter = createCounter(
    'cache.hits.total',
    'Total number of cache hits'
  );
  
  private cacheMissesCounter = createCounter(
    'cache.misses.total',
    'Total number of cache misses'
  );

  constructor(supabaseClient?: SupabaseClient | null) {
    this.supabase = supabaseClient || null;
  }

  /**
   * Record agent invocation
   */
  recordAgentInvocation(
    agentType: string,
    success: boolean,
    responseTime: number,
    confidenceScore?: number,
    hallucinationDetected?: boolean
  ): void {
    try {
      // Increment counters
      this.agentInvocationsCounter.add(1, {
        'agent.type': agentType,
        'agent.success': success
      });
      
      if (success) {
        this.agentSuccessCounter.add(1, { 'agent.type': agentType });
      } else {
        this.agentFailureCounter.add(1, { 'agent.type': agentType });
      }
      
      // Record response time
      this.agentResponseTimeHistogram.record(responseTime, {
        'agent.type': agentType
      });
      
      // Record confidence score
      if (confidenceScore !== undefined) {
        this.agentConfidenceHistogram.record(confidenceScore, {
          'agent.type': agentType
        });
      }
      
      // Record hallucination
      if (hallucinationDetected) {
        this.hallucinationCounter.add(1, { 'agent.type': agentType });
      }
      
    } catch (error) {
      logger.error('Failed to record agent invocation metrics', error as Error, {
        agentType,
        success,
        responseTime
      });
    }
  }

  /**
   * Record value prediction
   */
  recordValuePrediction(
    predictionType: string,
    predictedValue: number,
    actualValue?: number
  ): void {
    try {
      this.valuePredictionCounter.add(1, {
        'prediction.type': predictionType
      });
      
      if (actualValue !== undefined) {
        const error = Math.abs(predictedValue - actualValue);
        const errorPercent = (error / actualValue) * 100;
        
        this.valuePredictionErrorHistogram.record(errorPercent, {
          'prediction.type': predictionType
        });
      }
      
    } catch (error) {
      logger.error('Failed to record value prediction metrics', error as Error, {
        predictionType,
        predictedValue
      });
    }
  }

  /**
   * Record LLM call
   */
  recordLLMCall(
    provider: string,
    model: string,
    latency: number,
    cost: number,
    cacheHit: boolean
  ): void {
    try {
      this.llmCallsCounter.add(1, {
        'llm.provider': provider,
        'llm.model': model,
        'llm.cache_hit': cacheHit
      });
      
      this.llmLatencyHistogram.record(latency, {
        'llm.provider': provider,
        'llm.model': model
      });
      
      this.llmCostCounter.add(cost, {
        'llm.provider': provider,
        'llm.model': model
      });
      
      if (cacheHit) {
        this.cacheHitsCounter.add(1, {
          'llm.provider': provider,
          'llm.model': model
        });
      } else {
        this.cacheMissesCounter.add(1, {
          'llm.provider': provider,
          'llm.model': model
        });
      }
      
    } catch (error) {
      logger.error('Failed to record LLM call metrics', error as Error, {
        provider,
        model,
        latency
      });
    }
  }

  /**
   * Get agent metrics from database
   */
  async getAgentMetrics(
    agentType?: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise\u003cAgentMetrics[]\u003e {
    if (!this.supabase) {
      throw new Error('Supabase client not configured');
    }

    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - periodMs[period]).toISOString();

    try {
      // Query agent predictions
      let query = this.supabase
        .from('agent_predictions')
        .select('*')
        .gte('created_at', since);

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data: predictions, error } = await query;

      if (error) throw error;

      // Group by agent type
      const byAgentType = this.groupByAgentType(predictions || []);
      
      // Calculate metrics for each agent type
      const metrics: AgentMetrics[] = [];
      
      for (const [type, preds] of Object.entries(byAgentType)) {
        const responseTimes = preds
          .map(p =\u003e p.processing_time_ms)
          .filter(t =\u003e t !== null)
          .sort((a, b) =\u003e a - b);
        
        const totalInvocations = preds.length;
        const successfulInvocations = preds.filter(p =\u003e !p.error).length;
        const failedInvocations = totalInvocations - successfulInvocations;
        
        metrics.push({
          agentType: type,
          totalInvocations,
          successfulInvocations,
          failedInvocations,
          successRate: successfulInvocations / totalInvocations,
          avgResponseTime: this.average(responseTimes),
          p50ResponseTime: this.percentile(responseTimes, 0.5),
          p95ResponseTime: this.percentile(responseTimes, 0.95),
          p99ResponseTime: this.percentile(responseTimes, 0.99),
          avgConfidenceScore: this.average(
            preds.map(p =\u003e p.confidence_score).filter(s =\u003e s !== null)
          ),
          hallucinationRate: preds.filter(p =\u003e p.hallucination_detected).length / totalInvocations
        });
      }
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to get agent metrics', error as Error, {
        agentType,
        period
      });
      throw error;
    }
  }

  /**
   * Get value prediction accuracy metrics
   */
  async getValuePredictionMetrics(
    predictionType?: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise\u003cValuePredictionMetrics[]\u003e {
    if (!this.supabase) {
      throw new Error('Supabase client not configured');
    }

    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - periodMs[period]).toISOString();

    try {
      // Query value predictions with actuals
      let query = this.supabase
        .from('value_prediction_accuracy')
        .select('*')
        .gte('created_at', since)
        .not('actual_value', 'is', null);

      if (predictionType) {
        query = query.eq('prediction_type', predictionType);
      }

      const { data: predictions, error } = await query;

      if (error) throw error;

      // Group by prediction type
      const byType = this.groupByPredictionType(predictions || []);
      
      // Calculate metrics for each type
      const metrics: ValuePredictionMetrics[] = [];
      
      for (const [type, preds] of Object.entries(byType)) {
        const errors = preds.map(p =\u003e {
          const error = Math.abs(p.predicted_value - p.actual_value);
          const errorPercent = (error / p.actual_value) * 100;
          return { error, errorPercent };
        });
        
        metrics.push({
          predictionType: type,
          totalPredictions: preds.length,
          avgPredictedValue: this.average(preds.map(p =\u003e p.predicted_value)),
          avgActualValue: this.average(preds.map(p =\u003e p.actual_value)),
          avgError: this.average(errors.map(e =\u003e e.error)),
          avgErrorPercent: this.average(errors.map(e =\u003e e.errorPercent)),
          accuracy: 1 - (this.average(errors.map(e =\u003e e.errorPercent)) / 100)
        });
      }
      
      return metrics;
      
    } catch (error) {
      logger.error('Failed to get value prediction metrics', error as Error, {
        predictionType,
        period
      });
      throw error;
    }
  }

  /**
   * Get system-wide metrics
   */
  async getSystemMetrics(
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise\u003cSystemMetrics\u003e {
    if (!this.supabase) {
      throw new Error('Supabase client not configured');
    }

    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - periodMs[period]).toISOString();

    try {
      // Get agent invocations
      const { data: predictions } = await this.supabase
        .from('agent_predictions')
        .select('*')
        .gte('created_at', since);

      // Get LLM calls (if tracked separately)
      const { data: llmCalls } = await this.supabase
        .from('llm_calls')
        .select('*')
        .gte('created_at', since);

      const totalAgentInvocations = predictions?.length || 0;
      const totalLLMCalls = llmCalls?.length || 0;
      const totalCacheHits = llmCalls?.filter(c =\u003e c.cache_hit).length || 0;
      const totalCacheMisses = totalLLMCalls - totalCacheHits;
      const cacheHitRate = totalLLMCalls \u003e 0 ? totalCacheHits / totalLLMCalls : 0;
      const avgLLMLatency = this.average(
        llmCalls?.map(c =\u003e c.latency_ms).filter(l =\u003e l !== null) || []
      );
      const totalCost = llmCalls?.reduce((sum, c) =\u003e sum + (c.cost || 0), 0) || 0;

      return {
        totalAgentInvocations,
        totalLLMCalls,
        totalCacheHits,
        totalCacheMisses,
        cacheHitRate,
        avgLLMLatency,
        totalCost
      };
      
    } catch (error) {
      logger.error('Failed to get system metrics', error as Error, { period });
      throw error;
    }
  }

  /**
   * Helper: Group predictions by agent type
   */
  private groupByAgentType(predictions: any[]): Record\u003cstring, any[]\u003e {
    return predictions.reduce((acc, pred) =\u003e {
      const type = pred.agent_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(pred);
      return acc;
    }, {} as Record\u003cstring, any[]\u003e);
  }

  /**
   * Helper: Group predictions by type
   */
  private groupByPredictionType(predictions: any[]): Record\u003cstring, any[]\u003e {
    return predictions.reduce((acc, pred) =\u003e {
      const type = pred.prediction_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(pred);
      return acc;
    }, {} as Record\u003cstring, any[]\u003e);
  }

  /**
   * Helper: Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) =\u003e sum + v, 0) / values.length;
  }

  /**
   * Helper: Calculate percentile
   */
  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

/**
 * Singleton instance
 */
let metricsCollectorInstance: MetricsCollector | null = null;

/**
 * Get or create metrics collector instance
 */
export function getMetricsCollector(supabase?: SupabaseClient): MetricsCollector {
  if (!metricsCollectorInstance) {
    metricsCollectorInstance = new MetricsCollector(supabase);
  }
  return metricsCollectorInstance;
}

/**
 * Reset metrics collector (for testing)
 */
export function resetMetricsCollector(): void {
  metricsCollectorInstance = null;
}
