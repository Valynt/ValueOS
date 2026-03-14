/**
 * Dynamic Baseline Service
 *
 * Replaces hardcoded thresholds with tenant-specific learning
 * Implements adaptive anomaly detection based on historical patterns
 */

import { SupabaseClient } from '@supabase/supabase-js';

import { log } from '../../lib/logger.js'

import { TenantAwareService } from './TenantAwareService.js'

export interface TenantBaseline {
  id: string;
  tenantId: string;
  metricName: string;
  baseline: {
    mean: number;
    stdDev: number;
    threshold: number;
    confidence: number;
    sampleSize: number;
    lastUpdated: Date;
  };
  learningConfig: {
    learningRate: number;
    minSamples: number;
    maxHistory: number; // days
    adaptationSpeed: 'slow' | 'medium' | 'fast';
  };
}

export interface MetricData {
  value: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface BaselineCalculation {
  mean: number;
  stdDev: number;
  threshold: number;
  confidence: number;
  sampleSize: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  seasonality?: number[];
}

export class DynamicBaselineService extends TenantAwareService {
  private readonly DEFAULT_CONFIG = {
    learningRate: 0.1,
    minSamples: 30,
    maxHistory: 90, // days
    adaptationSpeed: 'medium' as const
  };

  private readonly THRESHOLD_MULTIPLIERS = {
    low: 2.0,
    medium: 2.5,
    high: 3.0,
    critical: 3.5
  };

  constructor(supabase: SupabaseClient) {
    super('DynamicBaselineService');
    this.supabase = supabase;
  }

  /**
   * Get or create tenant-specific baseline for a metric
   */
  async getTenantBaseline(
    tenantId: string,
    metricName: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<TenantBaseline> {
    try {
      // Try to get existing baseline
      const { data: existingBaseline } = await this.supabase
        .from('tenant_baselines')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('metric_name', metricName)
        .single();

      if (existingBaseline) {
        // Check if baseline needs updating
        const lastUpdated = new Date(existingBaseline.last_updated);
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceUpdate > 1) { // Update daily
          await this.updateBaseline(existingBaseline.id);
          return await this.getTenantBaseline(tenantId, metricName, severity);
        }

        return this.mapDbBaseline(existingBaseline);
      }

      // Create new baseline with initial learning
      const newBaseline = await this.createInitialBaseline(tenantId, metricName, severity);
      return newBaseline;

    } catch (error) {
      log.error('Failed to get tenant baseline', error as Error, { tenantId, metricName });

      // Fallback to default baseline
      return this.getDefaultBaseline(tenantId, metricName, severity);
    }
  }

  /**
   * Create initial baseline for a new metric
   */
  private async createInitialBaseline(
    tenantId: string,
    metricName: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<TenantBaseline> {
    // Gather historical data for initial baseline
    const historicalData = await this.gatherHistoricalData(tenantId, metricName, 30); // 30 days

    if (historicalData.length < this.DEFAULT_CONFIG.minSamples) {
      log.warn('Insufficient data for baseline, using defaults', {
        tenantId,
        metricName,
        dataPoints: historicalData.length
      });
      return this.getDefaultBaseline(tenantId, metricName, severity);
    }

    const calculation = this.calculateBaseline(historicalData);

    const baseline: TenantBaseline = {
      id: crypto.randomUUID(),
      tenantId,
      metricName,
      baseline: {
        mean: calculation.mean,
        stdDev: calculation.stdDev,
        threshold: calculation.threshold,
        confidence: calculation.confidence,
        sampleSize: calculation.sampleSize,
        lastUpdated: new Date()
      },
      learningConfig: this.DEFAULT_CONFIG
    };

    // Store in database
    await this.supabase.from('tenant_baselines').insert({
      id: baseline.id,
      tenant_id: tenantId,
      metric_name: metricName,
      baseline: baseline.baseline,
      learning_config: baseline.learningConfig,
      created_at: new Date(),
      last_updated: new Date()
    });

    log.info('Initial baseline created', {
      tenantId,
      metricName,
      mean: calculation.mean,
      stdDev: calculation.stdDev,
      sampleSize: calculation.sampleSize
    });

    return baseline;
  }

  /**
   * Update existing baseline with new data
   */
  private async updateBaseline(baselineId: string): Promise<void> {
    try {
      // Get current baseline
      const { data: baseline } = await this.supabase
        .from('tenant_baselines')
        .select('*')
        .eq('id', baselineId)
        .single();

      if (!baseline) {
        log.error('Baseline not found for update', { baselineId });
        return;
      }

      // Gather new data since last update
      const newData = await this.gatherHistoricalData(
        baseline.tenant_id,
        baseline.metric_name,
        7 // Last 7 days for incremental updates
      );

      if (newData.length < 5) { // Need some new data to update
        log.debug('Insufficient new data for baseline update', {
          baselineId,
          newDataPoints: newData.length
        });
        return;
      }

      // Calculate new baseline using exponential moving average
      const currentBaseline = baseline.baseline as {
        mean: number;
        std_dev: number;
        threshold: number;
        confidence: number;
        sample_size: number;
      };
      const newCalculation = this.calculateBaseline(newData);

      // Apply learning rate for smooth adaptation
      const learningRate = baseline.learning_config?.learning_rate ?? this.DEFAULT_CONFIG.learningRate;

      const updatedBaseline = {
        mean: currentBaseline.mean * (1 - learningRate) + newCalculation.mean * learningRate,
        stdDev: currentBaseline.std_dev * (1 - learningRate) + newCalculation.stdDev * learningRate,
        threshold: currentBaseline.threshold * (1 - learningRate) + newCalculation.threshold * learningRate,
        confidence: Math.min(currentBaseline.confidence * (1 - learningRate) + newCalculation.confidence * learningRate, 1.0),
        sampleSize: currentBaseline.sample_size + newData.length,
        lastUpdated: new Date()
      };

      // Update database
      await this.supabase
        .from('tenant_baselines')
        .update({
          baseline: updatedBaseline,
          last_updated: new Date()
        })
        .eq('id', baselineId);

      log.debug('Baseline updated', {
        baselineId,
        oldMean: currentBaseline.mean,
        newMean: updatedBaseline.mean,
        learningRate
      });

    } catch (error) {
      log.error('Failed to update baseline', error as Error, { baselineId });
    }
  }

  /**
   * Calculate baseline from metric data
   */
  private calculateBaseline(data: MetricData[]): BaselineCalculation {
    const values = data.map(d => d.value);
    const sampleSize = values.length;

    // Calculate basic statistics
    const mean = values.reduce((sum, val) => sum + val, 0) / sampleSize;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sampleSize;
    const stdDev = Math.sqrt(variance);

    // Calculate confidence based on sample size and variance
    const confidence = Math.min(sampleSize / 100, 1.0) * (1 - (stdDev / mean));

    // Detect trend
    const trend = this.detectTrend(values);

    // Detect seasonality (simplified)
    const seasonality = this.detectSeasonality(data);

    // Dynamic threshold based on data characteristics
    let thresholdMultiplier = 2.5; // default

    if (stdDev / mean > 0.5) { // High variability
      thresholdMultiplier = 3.0;
    } else if (stdDev / mean < 0.1) { // Low variability
      thresholdMultiplier = 2.0;
    }

    const threshold = mean + (thresholdMultiplier * stdDev);

    return {
      mean,
      stdDev,
      threshold,
      confidence: Math.max(0, Math.min(1, confidence)),
      sampleSize,
      trend,
      seasonality
    };
  }

  /**
   * Detect trend in data
   */
  private detectTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstMean = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondMean = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;

    const change = (secondMean - firstMean) / firstMean;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Detect seasonality patterns (simplified)
   */
  private detectSeasonality(data: MetricData[]): number[] {
    // This is a simplified seasonality detection
    // In production, would use more sophisticated methods like FFT
    const hourlyPatterns = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    for (const point of data) {
      const hour = point.timestamp.getHours();
      hourlyPatterns[hour] += point.value;
      hourlyCounts[hour]++;
    }

    // Normalize patterns
    for (let i = 0; i < 24; i++) {
      if (hourlyCounts[i] > 0) {
        hourlyPatterns[i] /= hourlyCounts[i];
      }
    }

    return hourlyPatterns;
  }

  /**
   * Gather historical data for baseline calculation
   */
  private async gatherHistoricalData(
    tenantId: string,
    metricName: string,
    days: number
  ): Promise<MetricData[]> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const { data } = await this.supabase
        .from<{value: number; timestamp: string}>('security_metrics')
        .select('value, timestamp')
        .eq('tenant_id', tenantId)
        .eq('metric_name', metricName)
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: true });

      if (!data) return [];

      return data.map(row => ({
        value: row.value,
        timestamp: new Date(row.timestamp)
      }));

    } catch (error) {
      log.error('Failed to gather historical data', error as Error, { tenantId, metricName, days });
      return [];
    }
  }

  /**
   * Get default baseline when insufficient data
   */
  private getDefaultBaseline(
    tenantId: string,
    metricName: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): TenantBaseline {
    // Use conservative defaults based on metric type
    const defaults = this.getMetricDefaults(metricName);
    const thresholdMultiplier = this.THRESHOLD_MULTIPLIERS[severity];

    return {
      id: crypto.randomUUID(),
      tenantId,
      metricName,
      baseline: {
        mean: defaults.mean,
        stdDev: defaults.stdDev,
        threshold: defaults.mean + (thresholdMultiplier * defaults.stdDev),
        confidence: 0.5, // Low confidence for defaults
        sampleSize: 0,
        lastUpdated: new Date()
      },
      learningConfig: this.DEFAULT_CONFIG
    };
  }

  /**
   * Get default values for different metric types
   */
  private getMetricDefaults(metricName: string): { mean: number; stdDev: number } {
    const defaults: Record<string, { mean: number; stdDev: number }> = {
      'login_spike': { mean: 50, stdDev: 10 },
      'api_traffic_anomaly': { mean: 1000, stdDev: 200 },
      'data_access_anomaly': { mean: 100, stdDev: 25 },
      'auth_failures': { mean: 5, stdDev: 2 },
      'request_rate': { mean: 100, stdDev: 30 },
      'response_time': { mean: 200, stdDev: 50 },
      'error_rate': { mean: 0.05, stdDev: 0.02 }
    };

    return defaults[metricName] || { mean: 100, stdDev: 20 };
  }

  /**
   * Check if value is anomalous based on tenant baseline
   */
  async isAnomalous(
    tenantId: string,
    metricName: string,
    value: number,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{
    isAnomalous: boolean;
    baseline: TenantBaseline;
    zScore: number;
    confidence: number;
  }> {
    const baseline = await this.getTenantBaseline(tenantId, metricName, severity);

    // Calculate z-score
    const zScore = Math.abs(value - baseline.baseline.mean) / baseline.baseline.stdDev;
    const isAnomalous = zScore > (baseline.baseline.threshold - baseline.baseline.mean) / baseline.baseline.stdDev;

    return {
      isAnomalous,
      baseline,
      zScore,
      confidence: baseline.baseline.confidence
    };
  }

  /**
   * Record new metric data point
   */
  async recordMetric(
    tenantId: string,
    metricName: string,
    value: number,
    context?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.supabase.from('security_metrics').insert({
        tenant_id: tenantId,
        metric_name: metricName,
        value,
        context: context || {},
        timestamp: new Date()
      });

      // Trigger baseline update if needed
      const baseline = await this.getTenantBaseline(tenantId, metricName);
      const isAnomalous = await this.isAnomalous(tenantId, metricName, value);

      if (isAnomalous.isAnomalous) {
        log.info('Anomalous metric detected', {
          tenantId,
          metricName,
          value,
          baseline: baseline.baseline.mean,
          zScore: isAnomalous.zScore
        });
      }

    } catch (error) {
      log.error('Failed to record metric', error as Error, { tenantId, metricName, value });
    }
  }

  /**
   * Get baseline statistics for monitoring
   */
  async getBaselineStatistics(tenantId: string): Promise<{
    totalBaselines: number;
    highConfidenceBaselines: number;
    recentlyUpdated: number;
    metricsByConfidence: Record<string, number>;
  }> {
    try {
      const { data } = await this.supabase
        .from<{ baseline: { confidence: number }; last_updated: string }>('tenant_baselines')
        .select('baseline, last_updated')
        .eq('tenant_id', tenantId);

      if (!data) {
        return {
          totalBaselines: 0,
          highConfidenceBaselines: 0,
          recentlyUpdated: 0,
          metricsByConfidence: {}
        };
      }

      const totalBaselines = data.length;
      const highConfidenceBaselines = data.filter(b =>
        b.baseline.confidence > 0.8
      ).length;

      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentlyUpdated = data.filter(b =>
        new Date(b.last_updated) > oneWeekAgo
      ).length;

      const metricsByConfidence = data.reduce((acc, b) => {
        const confidence = b.baseline.confidence;
        const bucket = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
        acc[bucket] = (acc[bucket] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        totalBaselines,
        highConfidenceBaselines,
        recentlyUpdated,
        metricsByConfidence
      };

    } catch (error) {
      log.error('Failed to get baseline statistics', error as Error, { tenantId });
      return {
        totalBaselines: 0,
        highConfidenceBaselines: 0,
        recentlyUpdated: 0,
        metricsByConfidence: {}
      };
    }
  }

  /**
   * Map database record to TenantBaseline interface
   */
  private mapDbBaseline(dbRecord: {
    id: string;
    tenant_id: string;
    metric_name: string;
    baseline: TenantBaseline['baseline'];
    learning_config?: TenantBaseline['learningConfig'];
  }): TenantBaseline {
    return {
      id: dbRecord.id,
      tenantId: dbRecord.tenant_id,
      metricName: dbRecord.metric_name,
      baseline: dbRecord.baseline,
      learningConfig: dbRecord.learning_config || this.DEFAULT_CONFIG
    };
  }

  /**
   * Cleanup old baselines and data
   */
  async cleanupOldData(): Promise<void> {
    try {
      // Remove baselines older than 6 months with no activity
      const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);

      const { data: oldBaselines } = await this.supabase
        .from<{ id: string; tenant_id: string; metric_name: string }>('tenant_baselines')
        .select('id, tenant_id, metric_name')
        .lt('last_updated', sixMonthsAgo);

      if (oldBaselines) {
        for (const baseline of oldBaselines) {
          // Check if there's recent metric data
          const { data: recentData } = await this.supabase
            .from<{ id: string }>('security_metrics')
            .select('id')
            .eq('tenant_id', baseline.tenant_id)
            .eq('metric_name', baseline.metric_name)
            .gte('timestamp', sixMonthsAgo.toISOString())
            .limit(1);

          if (!recentData || recentData.length === 0) {
            // Remove old baseline
            await this.supabase
              .from('tenant_baselines')
              .delete()
              .eq('id', baseline.id);

            log.info('Cleaned up old baseline', {
              baselineId: baseline.id,
              tenantId: baseline.tenant_id,
              metricName: baseline.metric_name
            });
          }
        }
      }

      // Remove metric data older than 1 year
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

      const { count: deletedMetrics } = await this.supabase
        .from('security_metrics')
        .delete()
        .lt('timestamp', oneYearAgo.toISOString());

      if (deletedMetrics) {
        log.info('Cleaned up old metric data', { deletedCount: deletedMetrics });
      }

    } catch (error) {
      log.error('Failed to cleanup old data', error as Error);
    }
  }
}