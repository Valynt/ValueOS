/**
 * Confidence Calibration Service Tests
 * 
 * P0 BLOCKER FIX: Validates confidence calibration against historical performance
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfidenceCalibrationService } from '../ConfidenceCalibration';

describe('ConfidenceCalibrationService', () => {
  let mockSupabase: any;
  let calibrationService: ConfidenceCalibrationService;

  beforeEach(() => {
    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      insert: vi.fn(() => mockSupabase),
      update: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      not: vi.fn(() => mockSupabase),
      order: vi.fn(() => mockSupabase),
      limit: vi.fn(() => mockSupabase),
      single: vi.fn(() => ({ data: null, error: null })),
      maybeSingle: vi.fn(() => ({ data: null, error: null }))
    };

    calibrationService = new ConfidenceCalibrationService(mockSupabase);
  });

  describe('calibrate', () => {
    it('should calibrate raw confidence score', async () => {
      // Mock stored calibration model
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.5,
          parameter_b: -0.5,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.8);

      expect(result.rawConfidence).toBe(0.8);
      expect(result.calibratedConfidence).toBeGreaterThan(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
      expect(result.shouldTriggerFallback).toBeDefined();
      expect(result.shouldTriggerRetraining).toBeDefined();
    });

    it('should trigger fallback when calibrated confidence below threshold', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: -2.0,  // Negative A will lower confidence
          parameter_b: 1.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.6);

      expect(result.shouldTriggerFallback).toBe(true);
    });

    it('should trigger retraining when calibration error high', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.20,  // High error
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.8);

      expect(result.shouldTriggerRetraining).toBe(true);
    });

    it('should throw error for invalid raw confidence', async () => {
      await expect(
        calibrationService.calibrate('test-agent', 1.5)
      ).rejects.toThrow('Invalid raw confidence');

      await expect(
        calibrationService.calibrate('test-agent', -0.1)
      ).rejects.toThrow('Invalid raw confidence');
    });

    it('should use default model when no historical data', async () => {
      // Mock no stored model
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock insufficient predictions
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await calibrationService.calibrate('new-agent', 0.8);

      expect(result.calibratedConfidence).toBeDefined();
      expect(result.calibrationModel.sampleSize).toBe(0);
      expect(result.calibrationModel.calibrationError).toBe(0.5);  // High uncertainty
    });
  });

  describe('Platt Scaling', () => {
    it('should apply identity transformation with A=1, B=0', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.05,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.5);

      // With A=1, B=0: C_cal = 1 / (1 + exp(-0.5)) ≈ 0.622
      expect(result.calibratedConfidence).toBeCloseTo(0.622, 2);
    });

    it('should increase confidence with positive A', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 2.0,  // Positive A increases confidence
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.05,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.5);

      // With A=2, B=0: C_cal = 1 / (1 + exp(-1.0)) ≈ 0.731
      expect(result.calibratedConfidence).toBeGreaterThan(0.7);
    });

    it('should decrease confidence with negative A', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: -2.0,  // Negative A decreases confidence
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.05,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.8);

      // With A=-2, B=0: C_cal = 1 / (1 + exp(1.6)) ≈ 0.168
      expect(result.calibratedConfidence).toBeLessThan(0.3);
    });

    it('should clamp calibrated confidence to [0, 1]', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 10.0,  // Extreme A
          parameter_b: 5.0,   // Extreme B
          sample_size: 100,
          calibration_error: 0.05,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.9);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('triggerRetraining', () => {
    it('should insert retraining request', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ data: {}, error: null });

      await calibrationService.triggerRetraining('test-agent', 'High calibration error');

      expect(mockSupabase.from).toHaveBeenCalledWith('agent_retraining_queue');
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'test-agent',
          reason: 'High calibration error',
          priority: 'high',
          status: 'pending'
        })
      );
    });
  });

  describe('getCalibrationStats', () => {
    it('should return calibration statistics', async () => {
      // Mock calibration model
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      // Mock recent predictions
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: [
          { variance_percentage: 10 },  // Correct
          { variance_percentage: 15 },  // Correct
          { variance_percentage: 30 },  // Incorrect
          { variance_percentage: 5 }    // Correct
        ],
        error: null
      });

      const stats = await calibrationService.getCalibrationStats('test-agent');

      expect(stats.model).toBeDefined();
      expect(stats.recentAccuracy).toBeCloseTo(0.75, 2);  // 3/4 correct
      expect(stats.predictionCount).toBe(4);
      expect(stats.needsRecalibration).toBeDefined();
    });

    it('should flag need for recalibration when error high', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.20,  // High error
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const stats = await calibrationService.getCalibrationStats('test-agent');

      expect(stats.needsRecalibration).toBe(true);
    });

    it('should flag need for recalibration when model old', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);  // 10 days ago

      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.05,  // Low error
          last_calibrated: oldDate.toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const stats = await calibrationService.getCalibrationStats('test-agent');

      expect(stats.needsRecalibration).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should cache calibration models', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      // First call - should fetch from database
      await calibrationService.calibrate('test-agent', 0.8);
      expect(mockSupabase.from).toHaveBeenCalled();

      // Reset mock
      mockSupabase.from.mockClear();

      // Second call - should use cache
      await calibrationService.calibrate('test-agent', 0.8);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should clear cache on demand', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      // First call
      await calibrationService.calibrate('test-agent', 0.8);
      mockSupabase.from.mockClear();

      // Clear cache
      calibrationService.clearCache();

      // Second call - should fetch from database again
      await calibrationService.calibrate('test-agent', 0.8);
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed')
      });

      // Should fall back to default model
      const result = await calibrationService.calibrate('test-agent', 0.8);

      expect(result.calibratedConfidence).toBeDefined();
      expect(result.calibrationModel.sampleSize).toBe(0);
    });

    it('should handle zero confidence', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 0.0);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle perfect confidence', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          parameter_a: 1.0,
          parameter_b: 0.0,
          sample_size: 100,
          calibration_error: 0.08,
          last_calibrated: new Date().toISOString(),
          min_threshold: 0.7,
          retraining_threshold: 0.15
        },
        error: null
      });

      const result = await calibrationService.calibrate('test-agent', 1.0);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });
  });
});
