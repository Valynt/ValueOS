/**
 * Confidence Calibration Service Tests
 * 
 * P0 BLOCKER FIX: Validates confidence calibration against historical performance
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfidenceCalibrationService } from '../ConfidenceCalibration';

describe('ConfidenceCalibrationService', () => {
  let mockSupabase: any;
  let calibrationService: ConfidenceCalibrationService;
  const testTenantId = 'test-tenant';

  beforeEach(() => {
    // Mock chain that handles both .maybeSingle() (awaited promise) and .limit() (awaited chain)
    const mockChain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      // Make the chain thenable to support awaiting the builder directly (e.g. after .limit())
      then: function(resolve: any) {
        resolve(this._resolvedValue || { data: [], error: null });
      },
      _resolvedValue: { data: [], error: null }
    };

    mockSupabase = {
      from: vi.fn(() => mockChain),
    };

    calibrationService = new ConfidenceCalibrationService(mockSupabase);
  });

  describe('calibrate', () => {
    it('should calibrate raw confidence score', async () => {
      // Mock stored calibration model
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.8, testTenantId);

      expect(result.rawConfidence).toBe(0.8);
      expect(result.calibratedConfidence).toBeGreaterThan(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
      expect(result.shouldTriggerFallback).toBeDefined();
      expect(result.shouldTriggerRetraining).toBeDefined();
    });

    it('should trigger fallback when calibrated confidence below threshold', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.6, testTenantId);

      expect(result.shouldTriggerFallback).toBe(true);
    });

    it('should trigger retraining when calibration error high', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.8, testTenantId);

      expect(result.shouldTriggerRetraining).toBe(true);
    });

    it('should throw error for invalid raw confidence', async () => {
      await expect(
        calibrationService.calibrate('test-agent', 1.5, testTenantId)
      ).rejects.toThrow('Invalid raw confidence');

      await expect(
        calibrationService.calibrate('test-agent', -0.1, testTenantId)
      ).rejects.toThrow('Invalid raw confidence');
    });

    it('should use default model when no historical data', async () => {
      const mockChain = mockSupabase.from();
      // Mock no stored model
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null
      });

      // Mock insufficient predictions (list query)
      mockChain._resolvedValue = {
        data: [],
        error: null
      };

      const result = await calibrationService.calibrate('new-agent', 0.8, testTenantId);

      expect(result.calibratedConfidence).toBeDefined();
      expect(result.calibrationModel.sampleSize).toBe(0);
      expect(result.calibrationModel.calibrationError).toBe(0.5);  // High uncertainty
    });
  });

  describe('Platt Scaling', () => {
    it('should apply identity transformation with A=1, B=0', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.5, testTenantId);

      // With A=1, B=0: C_cal = 1 / (1 + exp(-0.5)) ≈ 0.622
      expect(result.calibratedConfidence).toBeCloseTo(0.622, 2);
    });

    it('should increase confidence with positive A', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.5, testTenantId);

      // With A=2, B=0: C_cal = 1 / (1 + exp(-1.0)) ≈ 0.731
      expect(result.calibratedConfidence).toBeGreaterThan(0.7);
    });

    it('should decrease confidence with negative A', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.8, testTenantId);

      // With A=-2, B=0: C_cal = 1 / (1 + exp(1.6)) ≈ 0.168
      expect(result.calibratedConfidence).toBeLessThan(0.3);
    });

    it('should clamp calibrated confidence to [0, 1]', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.9, testTenantId);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('triggerRetraining', () => {
    it('should insert retraining request', async () => {
      const mockChain = mockSupabase.from();

      await calibrationService.triggerRetraining('test-agent', testTenantId, 'High calibration error');

      expect(mockSupabase.from).toHaveBeenCalledWith('agent_retraining_queue');
      expect(mockChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'test-agent',
          tenant_id: testTenantId,
          reason: 'High calibration error',
          priority: 'high',
          status: 'pending'
        })
      );
    });
  });

  describe('getCalibrationStats', () => {
    it('should return calibration statistics', async () => {
      const mockChain = mockSupabase.from();
      // Mock calibration model (first call)
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      // Mock recent predictions (second call - list query)
      mockChain._resolvedValue = {
        data: [
          { variance_percentage: 10 },  // Correct
          { variance_percentage: 15 },  // Correct
          { variance_percentage: 30 },  // Incorrect
          { variance_percentage: 5 }    // Correct
        ],
        error: null
      };

      const stats = await calibrationService.getCalibrationStats('test-agent', testTenantId);

      expect(stats.model).toBeDefined();
      expect(stats.recentAccuracy).toBeCloseTo(0.75, 2);  // 3/4 correct
      expect(stats.predictionCount).toBe(4);
      expect(stats.needsRecalibration).toBeDefined();
    });

    it('should flag need for recalibration when error high', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      mockChain._resolvedValue = {
        data: [],
        error: null
      };

      const stats = await calibrationService.getCalibrationStats('test-agent', testTenantId);

      expect(stats.needsRecalibration).toBe(true);
    });

    it('should flag need for recalibration when model old', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);  // 10 days ago

      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      mockChain._resolvedValue = {
        data: [],
        error: null
      };

      const stats = await calibrationService.getCalibrationStats('test-agent', testTenantId);

      expect(stats.needsRecalibration).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should cache calibration models', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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
      await calibrationService.calibrate('test-agent', 0.8, testTenantId);
      expect(mockSupabase.from).toHaveBeenCalled();

      // Reset mock
      mockSupabase.from.mockClear();

      // Second call - should use cache
      await calibrationService.calibrate('test-agent', 0.8, testTenantId);
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should clear cache on demand', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValue({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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
      await calibrationService.calibrate('test-agent', 0.8, testTenantId);
      mockSupabase.from.mockClear();

      // Clear cache
      calibrationService.clearCache();

      // Second call - should fetch from database again
      await calibrationService.calibrate('test-agent', 0.8, testTenantId);
      expect(mockSupabase.from).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: new Error('Database connection failed')
      });
      // also mock list response for computeCalibrationModel fallthrough
      mockChain._resolvedValue = {
        data: [],
        error: new Error('Database connection failed')
      };

      // Should fall back to default model
      const result = await calibrationService.calibrate('test-agent', 0.8, testTenantId);

      expect(result.calibratedConfidence).toBeDefined();
      expect(result.calibrationModel.sampleSize).toBe(0);
    });

    it('should handle zero confidence', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 0.0, testTenantId);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle perfect confidence', async () => {
      const mockChain = mockSupabase.from();
      mockChain.maybeSingle.mockResolvedValueOnce({
        data: {
          agent_id: 'test-agent',
          agent_type: 'opportunity',
          tenant_id: testTenantId,
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

      const result = await calibrationService.calibrate('test-agent', 1.0, testTenantId);

      expect(result.calibratedConfidence).toBeGreaterThanOrEqual(0);
      expect(result.calibratedConfidence).toBeLessThanOrEqual(1);
    });
  });
});
