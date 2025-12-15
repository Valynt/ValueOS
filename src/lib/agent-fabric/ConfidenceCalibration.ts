/**
 * Confidence Calibration Service
 * 
 * P0 BLOCKER FIX: Calibrates agent confidence scores against historical performance
 * 
 * Implements Platt scaling to transform raw confidence scores into calibrated probabilities
 * that accurately reflect the true likelihood of correctness.
 * 
 * Without calibration, agents may be overconfident or underconfident, leading to
 * incorrect decision-making and undermining the regulated actor framework.
 * 
 * References:
 * - Platt, J. (1999). Probabilistic outputs for support vector machines
 * - Niculescu-Mizil & Caruana (2005). Predicting good probabilities with supervised learning
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../logger';

/**
 * Calibration model parameters (Platt scaling)
 * 
 * Transforms raw confidence C_raw to calibrated confidence C_cal using:
 * C_cal = 1 / (1 + exp(A * C_raw + B))
 */
export interface CalibrationModel {
  agentId: string;
  agentType: string;
  /** Platt scaling parameter A */
  parameterA: number;
  /** Platt scaling parameter B */
  parameterB: number;
  /** Number of predictions used for calibration */
  sampleSize: number;
  /** Mean absolute calibration error */
  calibrationError: number;
  /** Timestamp of last calibration */
  lastCalibrated: Date;
  /** Minimum confidence threshold (calibrated) */
  minThreshold: number;
  /** Recommended retraining threshold */
  retrainingThreshold: number;
}

/**
 * Historical prediction for calibration
 */
export interface HistoricalPrediction {
  predictionId: string;
  agentId: string;
  rawConfidence: number;
  wasCorrect: boolean;
  variance: number;
  timestamp: Date;
}

/**
 * Calibration result
 */
export interface CalibrationResult {
  rawConfidence: number;
  calibratedConfidence: number;
  shouldTriggerFallback: boolean;
  shouldTriggerRetraining: boolean;
  calibrationModel: CalibrationModel;
}

/**
 * Confidence Calibration Service
 * 
 * Calibrates agent confidence scores against historical accuracy to ensure
 * confidence scores accurately reflect true probability of correctness.
 */
export class ConfidenceCalibrationService {
  private supabase: SupabaseClient;
  private calibrationCache: Map<string, CalibrationModel>;
  private cacheExpiry: number = 3600000; // 1 hour

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.calibrationCache = new Map();
  }

  /**
   * Calibrate a raw confidence score using historical performance
   * 
   * @param agentId - Agent identifier
   * @param rawConfidence - Raw confidence score from LLM (0-1)
   * @param minThreshold - Minimum acceptable confidence (default: 0.7)
   * @returns Calibrated confidence and decision flags
   */
  async calibrate(
    agentId: string,
    rawConfidence: number,
    _minThreshold: number = 0.7
  ): Promise<CalibrationResult> {
    // Validate input
    if (rawConfidence < 0 || rawConfidence > 1) {
      throw new Error(`Invalid raw confidence: ${rawConfidence}. Must be between 0 and 1.`);
    }

    // Get or compute calibration model
    const model = await this.getCalibrationModel(agentId);

    // Apply Platt scaling transformation
    const calibratedConfidence = this.applyPlattScaling(
      rawConfidence,
      model.parameterA,
      model.parameterB
    );

    // Determine if fallback should be triggered
    const shouldTriggerFallback = calibratedConfidence < model.minThreshold;

    // Determine if retraining should be triggered
    const shouldTriggerRetraining = model.calibrationError > model.retrainingThreshold;

    // Log calibration
    logger.info('Confidence calibrated', {
      agentId,
      rawConfidence,
      calibratedConfidence,
      shouldTriggerFallback,
      shouldTriggerRetraining,
      calibrationError: model.calibrationError
    });

    return {
      rawConfidence,
      calibratedConfidence,
      shouldTriggerFallback,
      shouldTriggerRetraining,
      calibrationModel: model
    };
  }

  /**
   * Get calibration model for an agent (cached or computed)
   */
  private async getCalibrationModel(agentId: string): Promise<CalibrationModel> {
    // Check cache
    const cached = this.calibrationCache.get(agentId);
    if (cached && Date.now() - cached.lastCalibrated.getTime() < this.cacheExpiry) {
      return cached;
    }

    // Fetch from database
    const { data: storedModel, error: fetchError } = await this.supabase
      .from('agent_calibration_models')
      .select('*')
      .eq('agent_id', agentId)
      .order('last_calibrated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (storedModel && !fetchError) {
      const model: CalibrationModel = {
        agentId: storedModel.agent_id,
        agentType: storedModel.agent_type,
        parameterA: storedModel.parameter_a,
        parameterB: storedModel.parameter_b,
        sampleSize: storedModel.sample_size,
        calibrationError: storedModel.calibration_error,
        lastCalibrated: new Date(storedModel.last_calibrated),
        minThreshold: storedModel.min_threshold || 0.7,
        retrainingThreshold: storedModel.retraining_threshold || 0.15
      };

      this.calibrationCache.set(agentId, model);
      return model;
    }

    // No stored model - compute new calibration
    logger.info('No calibration model found, computing new model', { agentId });
    return await this.computeCalibrationModel(agentId);
  }

  /**
   * Compute calibration model from historical predictions
   * 
   * Uses Platt scaling to fit parameters A and B that minimize calibration error
   */
  private async computeCalibrationModel(agentId: string): Promise<CalibrationModel> {
    // Fetch historical predictions with outcomes
    const { data: predictions, error: _error } = await this.supabase
      .from('agent_predictions')
      .select('id, agent_id, confidence_score, actual_outcome, variance_percentage, created_at')
      .eq('agent_id', agentId)
      .not('actual_outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (_error || !predictions || predictions.length < 50) {
      logger.warn('Insufficient historical data for calibration, using default model', {
        agentId,
        sampleSize: predictions?.length || 0,
        minimumRequired: 50
      });
      return this.getDefaultCalibrationModel(agentId);
    }

    // Convert to HistoricalPrediction format
    const historicalPredictions: HistoricalPrediction[] = predictions.map(p => ({
      predictionId: p.id,
      agentId: p.agent_id,
      rawConfidence: p.confidence_score,
      wasCorrect: Math.abs(p.variance_percentage || 100) < 20, // Within 20% is "correct"
      variance: Math.abs(p.variance_percentage || 100),
      timestamp: new Date(p.created_at)
    }));

    // Fit Platt scaling parameters using maximum likelihood estimation
    const { parameterA, parameterB, calibrationError } = this.fitPlattScaling(historicalPredictions);

    // Get agent type
    const { data: agentData, error: _agentError } = await this.supabase
      .from('agents')
      .select('type')
      .eq('id', agentId)
      .single();

    const model: CalibrationModel = {
      agentId,
      agentType: agentData?.type || 'unknown',
      parameterA,
      parameterB,
      sampleSize: historicalPredictions.length,
      calibrationError,
      lastCalibrated: new Date(),
      minThreshold: 0.7,
      retrainingThreshold: 0.15
    };

    // Store in database
    await this.supabase
      .from('agent_calibration_models')
      .insert({
        agent_id: model.agentId,
        agent_type: model.agentType,
        parameter_a: model.parameterA,
        parameter_b: model.parameterB,
        sample_size: model.sampleSize,
        calibration_error: model.calibrationError,
        last_calibrated: model.lastCalibrated.toISOString(),
        min_threshold: model.minThreshold,
        retraining_threshold: model.retrainingThreshold
      });

    // Cache the model
    this.calibrationCache.set(agentId, model);

    logger.info('Calibration model computed', {
      agentId,
      sampleSize: model.sampleSize,
      calibrationError: model.calibrationError,
      parameterA: model.parameterA,
      parameterB: model.parameterB
    });

    return model;
  }

  /**
   * Fit Platt scaling parameters using maximum likelihood estimation
   * 
   * Minimizes negative log-likelihood:
   * -sum(y_i * log(p_i) + (1 - y_i) * log(1 - p_i))
   * 
   * where p_i = 1 / (1 + exp(A * c_i + B))
   */
  private fitPlattScaling(predictions: HistoricalPrediction[]): {
    parameterA: number;
    parameterB: number;
    calibrationError: number;
  } {
    // Initialize parameters
    let A = 0;
    let B = Math.log((predictions.filter(p => !p.wasCorrect).length + 1) / 
                     (predictions.filter(p => p.wasCorrect).length + 1));

    // Gradient descent parameters
    const learningRate = 0.01;
    const maxIterations = 1000;
    const tolerance = 1e-6;

    // Gradient descent optimization
    for (let iter = 0; iter < maxIterations; iter++) {
      let gradA = 0;
      let gradB = 0;

      for (const pred of predictions) {
        const c = pred.rawConfidence;
        const y = pred.wasCorrect ? 1 : 0;
        
        // Compute predicted probability
        const z = A * c + B;
        const p = 1 / (1 + Math.exp(-z));
        
        // Compute gradients
        const error = p - y;
        gradA += error * c;
        gradB += error;
      }

      // Update parameters
      const newA = A - learningRate * gradA / predictions.length;
      const newB = B - learningRate * gradB / predictions.length;

      // Check convergence
      if (Math.abs(newA - A) < tolerance && Math.abs(newB - B) < tolerance) {
        break;
      }

      A = newA;
      B = newB;
    }

    // Compute calibration error (mean absolute error between predicted and actual)
    let totalError = 0;
    for (const pred of predictions) {
      const calibratedConf = this.applyPlattScaling(pred.rawConfidence, A, B);
      const actualAccuracy = pred.wasCorrect ? 1 : 0;
      totalError += Math.abs(calibratedConf - actualAccuracy);
    }
    const calibrationError = totalError / predictions.length;

    return { parameterA: A, parameterB: B, calibrationError };
  }

  /**
   * Apply Platt scaling transformation
   * 
   * C_cal = 1 / (1 + exp(A * C_raw + B))
   */
  private applyPlattScaling(rawConfidence: number, A: number, B: number): number {
    const z = A * rawConfidence + B;
    const calibrated = 1 / (1 + Math.exp(-z));
    
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, calibrated));
  }

  /**
   * Get default calibration model when insufficient data
   */
  private getDefaultCalibrationModel(agentId: string): CalibrationModel {
    return {
      agentId,
      agentType: 'unknown',
      parameterA: 1.0,  // Identity transformation initially
      parameterB: 0.0,
      sampleSize: 0,
      calibrationError: 0.5,  // High error indicates uncertainty
      lastCalibrated: new Date(),
      minThreshold: 0.7,
      retrainingThreshold: 0.15
    };
  }

  /**
   * Trigger retraining for an agent when calibration error is high
   */
  async triggerRetraining(agentId: string, reason: string): Promise<void> {
    logger.warn('Triggering agent retraining', { agentId, reason });

    await this.supabase
      .from('agent_retraining_queue')
      .insert({
        agent_id: agentId,
        reason,
        priority: 'high',
        status: 'pending',
        created_at: new Date().toISOString()
      });
  }

  /**
   * Clear calibration cache (useful for testing or forced recalibration)
   */
  clearCache(): void {
    this.calibrationCache.clear();
    logger.info('Calibration cache cleared');
  }

  /**
   * Get calibration statistics for monitoring
   */
  async getCalibrationStats(agentId: string): Promise<{
    model: CalibrationModel | null;
    recentAccuracy: number;
    predictionCount: number;
    needsRecalibration: boolean;
  }> {
    const model = await this.getCalibrationModel(agentId);

    // Get recent accuracy
    const { data: recentPredictions } = await this.supabase
      .from('agent_predictions')
      .select('variance_percentage')
      .eq('agent_id', agentId)
      .not('actual_outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    const correctCount = recentPredictions?.filter(
      p => Math.abs(p.variance_percentage || 100) < 20
    ).length || 0;
    const recentAccuracy = recentPredictions?.length 
      ? correctCount / recentPredictions.length 
      : 0;

    const needsRecalibration = 
      model.calibrationError > model.retrainingThreshold ||
      Date.now() - model.lastCalibrated.getTime() > 7 * 24 * 3600000; // 7 days

    return {
      model,
      recentAccuracy,
      predictionCount: recentPredictions?.length || 0,
      needsRecalibration
    };
  }
}

/**
 * Create database table for calibration models
 * 
 * Migration SQL:
 * 
 * CREATE TABLE IF NOT EXISTS agent_calibration_models (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   agent_id TEXT NOT NULL,
 *   agent_type TEXT NOT NULL,
 *   parameter_a DECIMAL(10, 6) NOT NULL,
 *   parameter_b DECIMAL(10, 6) NOT NULL,
 *   sample_size INTEGER NOT NULL,
 *   calibration_error DECIMAL(5, 4) NOT NULL,
 *   last_calibrated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   min_threshold DECIMAL(3, 2) DEFAULT 0.7,
 *   retraining_threshold DECIMAL(3, 2) DEFAULT 0.15,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_agent_calibration_agent_id ON agent_calibration_models(agent_id);
 * CREATE INDEX idx_agent_calibration_last_calibrated ON agent_calibration_models(last_calibrated DESC);
 */
