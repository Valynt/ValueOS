/**
 * Confidence Monitoring Service
 * 
 * Tracks agent confidence levels, triggers alerts for low confidence,
 * and provides analytics on prediction quality.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { ConfidenceLevel } from '../lib/agent-fabric/schemas/SecureAgentOutput';

export interface ConfidenceMetrics {
  agentType: string;
  period: 'hour' | 'day' | 'week' | 'month';
  totalPredictions: number;
  avgConfidenceScore: number;
  lowConfidenceCount: number;
  mediumConfidenceCount: number;
  highConfidenceCount: number;
  hallucinationCount: number;
  hallucinationRate: number;
}

export interface ConfidenceAlert {
  id: string;
  agentType: string;
  alertType: 'low_confidence_spike' | 'high_hallucination_rate' | 'confidence_degradation';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Record<string, any>;
  createdAt: Date;
}

export interface ConfidenceThresholdConfig {
  /** Alert if confidence drops below this */
  minAcceptable: number;
  /** Alert if hallucination rate exceeds this */
  maxHallucinationRate: number;
  /** Alert if low confidence predictions exceed this percentage */
  maxLowConfidenceRate: number;
  /** Window size for calculating rates (in predictions) */
  windowSize: number;
}

const DEFAULT_THRESHOLD_CONFIG: ConfidenceThresholdConfig = {
  minAcceptable: 0.6,
  maxHallucinationRate: 0.2, // 20%
  maxLowConfidenceRate: 0.3, // 30%
  windowSize: 20
};

export class ConfidenceMonitor {
  private supabase: SupabaseClient;
  private thresholds: ConfidenceThresholdConfig;
  private alertCallbacks: Array<(alert: ConfidenceAlert) => void> = [];

  constructor(
    supabaseClient: SupabaseClient,
    thresholds: Partial<ConfidenceThresholdConfig> = {}
  ) {
    this.supabase = supabaseClient;
    this.thresholds = { ...DEFAULT_THRESHOLD_CONFIG, ...thresholds };
  }

  /**
   * Register callback for confidence alerts
   */
  onAlert(callback: (alert: ConfidenceAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Check recent predictions and trigger alerts if needed
   */
  async checkConfidenceLevels(agentType?: string): Promise<ConfidenceAlert[]> {
    const alerts: ConfidenceAlert[] = [];

    try {
      // Get recent predictions
      let query = this.supabase
        .from('agent_predictions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(this.thresholds.windowSize);

      if (agentType) {
        query = query.eq('agent_type', agentType);
      }

      const { data: predictions, error } = await query;

      if (error) throw error;
      if (!predictions || predictions.length === 0) return alerts;

      // Group by agent type
      const byAgentType = this.groupByAgentType(predictions);

      for (const [type, preds] of Object.entries(byAgentType)) {
        const typeAlerts = await this.analyzeAgentPredictions(type, preds);
        alerts.push(...typeAlerts);
      }

      // Trigger callbacks
      for (const alert of alerts) {
        this.triggerAlert(alert);
      }

      return alerts;

    } catch (error) {
      logger.error('Failed to check confidence levels', { error: error.message });
      return alerts;
    }
  }

  /**
   * Get confidence metrics for an agent
   */
  async getMetrics(
    agentType: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<ConfidenceMetrics> {
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };

    const since = new Date(Date.now() - periodMs[period]).toISOString();

    const { data: predictions, error } = await this.supabase
      .from('agent_predictions')
      .select('confidence_level, confidence_score, hallucination_detected')
      .eq('agent_type', agentType)
      .gte('created_at', since);

    if (error) throw error;

    const totalPredictions = predictions?.length || 0;
    const avgConfidenceScore = totalPredictions > 0
      ? predictions.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / totalPredictions
      : 0;

    const lowConfidenceCount = predictions?.filter(p => p.confidence_level === 'low').length || 0;
    const mediumConfidenceCount = predictions?.filter(p => p.confidence_level === 'medium').length || 0;
    const highConfidenceCount = predictions?.filter(p => p.confidence_level === 'high').length || 0;
    const hallucinationCount = predictions?.filter(p => p.hallucination_detected).length || 0;

    return {
      agentType,
      period,
      totalPredictions,
      avgConfidenceScore,
      lowConfidenceCount,
      mediumConfidenceCount,
      highConfidenceCount,
      hallucinationCount,
      hallucinationRate: totalPredictions > 0 ? hallucinationCount / totalPredictions : 0
    };
  }

  /**
   * Get confidence trend over time
   */
  async getConfidenceTrend(
    agentType: string,
    days: number = 7
  ): Promise<Array<{ date: string; avgConfidence: number; hallucinationRate: number }>> {
    const trend: Array<{ date: string; avgConfidence: number; hallucinationRate: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: predictions } = await this.supabase
        .from('agent_predictions')
        .select('confidence_score, hallucination_detected')
        .eq('agent_type', agentType)
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const count = predictions?.length || 0;
      const avgConfidence = count > 0
        ? predictions.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / count
        : 0;
      const hallucinationRate = count > 0
        ? predictions.filter(p => p.hallucination_detected).length / count
        : 0;

      trend.push({
        date: date.toISOString().split('T')[0],
        avgConfidence,
        hallucinationRate
      });
    }

    return trend;
  }

  /**
   * Log confidence threshold violation
   */
  async logThresholdViolation(
    agentType: string,
    predictionId: string,
    violationType: 'low_confidence' | 'hallucination' | 'data_gaps',
    details: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('confidence_violations').insert({
        agent_type: agentType,
        prediction_id: predictionId,
        violation_type: violationType,
        details,
        created_at: new Date().toISOString()
      });

      logger.warn('Confidence threshold violation', {
        agentType,
        predictionId,
        violationType,
        details
      });
    } catch (error) {
      logger.error('Failed to log threshold violation', { error: error.message });
    }
  }

  private groupByAgentType(predictions: any[]): Record<string, any[]> {
    return predictions.reduce((acc, pred) => {
      const type = pred.agent_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(pred);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private async analyzeAgentPredictions(
    agentType: string,
    predictions: any[]
  ): Promise<ConfidenceAlert[]> {
    const alerts: ConfidenceAlert[] = [];

    // Calculate metrics
    const totalCount = predictions.length;
    const lowConfidenceCount = predictions.filter(p => p.confidence_level === 'low').length;
    const hallucinationCount = predictions.filter(p => p.hallucination_detected).length;
    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence_score || 0), 0) / totalCount;

    const lowConfidenceRate = lowConfidenceCount / totalCount;
    const hallucinationRate = hallucinationCount / totalCount;

    // Check for low confidence spike
    if (lowConfidenceRate > this.thresholds.maxLowConfidenceRate) {
      alerts.push({
        id: `alert-${Date.now()}-${agentType}-low-confidence`,
        agentType,
        alertType: 'low_confidence_spike',
        severity: lowConfidenceRate > 0.5 ? 'critical' : 'warning',
        message: `${agentType} agent has ${(lowConfidenceRate * 100).toFixed(1)}% low confidence predictions (threshold: ${(this.thresholds.maxLowConfidenceRate * 100).toFixed(1)}%)`,
        metrics: {
          lowConfidenceRate,
          lowConfidenceCount,
          totalCount,
          avgConfidence
        },
        createdAt: new Date()
      });
    }

    // Check for high hallucination rate
    if (hallucinationRate > this.thresholds.maxHallucinationRate) {
      alerts.push({
        id: `alert-${Date.now()}-${agentType}-hallucination`,
        agentType,
        alertType: 'high_hallucination_rate',
        severity: hallucinationRate > 0.3 ? 'critical' : 'warning',
        message: `${agentType} agent has ${(hallucinationRate * 100).toFixed(1)}% hallucination rate (threshold: ${(this.thresholds.maxHallucinationRate * 100).toFixed(1)}%)`,
        metrics: {
          hallucinationRate,
          hallucinationCount,
          totalCount
        },
        createdAt: new Date()
      });
    }

    // Check for confidence degradation
    if (avgConfidence < this.thresholds.minAcceptable) {
      alerts.push({
        id: `alert-${Date.now()}-${agentType}-degradation`,
        agentType,
        alertType: 'confidence_degradation',
        severity: avgConfidence < 0.5 ? 'critical' : 'warning',
        message: `${agentType} agent average confidence ${avgConfidence.toFixed(2)} below threshold ${this.thresholds.minAcceptable}`,
        metrics: {
          avgConfidence,
          threshold: this.thresholds.minAcceptable,
          totalCount
        },
        createdAt: new Date()
      });
    }

    return alerts;
  }

  private triggerAlert(alert: ConfidenceAlert): void {
    logger.warn('Confidence alert triggered', {
      alertType: alert.alertType,
      agentType: alert.agentType,
      severity: alert.severity,
      message: alert.message
    });

    for (const callback of this.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback failed', { error: error.message });
      }
    }
  }
}
