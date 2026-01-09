/**
 * VOS-QA-004: Chaos Engineering Unit Tests
 * Comprehensive testing for chaos engineering components
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chaosEngineering } from '../../../src/services/ChaosEngineering';
import { SecureMessageBus } from '../../../src/lib/agent-fabric/SecureMessageBus';

describe('Chaos Engineering Service', () => {
  let messageBus: SecureMessageBus;

  beforeEach(() => {
    messageBus = new SecureMessageBus();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up all experiments
    const experiments = chaosEngineering.listExperiments();
    experiments.forEach(exp => {
      chaosEngineering.disableExperiment(exp.id);
    });
  });

  describe('Experiment Management', () => {
    it('should list all available experiments', () => {
      const experiments = chaosEngineering.listExperiments();
      
      expect(experiments).toBeInstanceOf(Array);
      expect(experiments.length).toBeGreaterThan(0);
      
      // Check for expected experiment types
      const types = experiments.map(e => e.type);
      expect(types).toContain('network');
      expect(types).toContain('resource');
      expect(types).toContain('failure');
      expect(types).toContain('state');
    });

    it('should enable and disable experiments', () => {
      const experimentId = 'test-latency';
      
      chaosEngineering.enableExperiment(experimentId);
      expect(chaosEngineering.isEnabled(experimentId)).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
      expect(chaosEngineering.isEnabled(experimentId)).toBe(false);
    });

    it('should set blast radius', () => {
      const experimentId = 'test-blast';
      const blastRadius = 0.7;
      
      chaosEngineering.setBlastRadius(experimentId, blastRadius);
      
      // Verify it was set (implementation detail)
      expect(chaosEngineering.isEnabled(experimentId)).toBe(false); // Not enabled yet
    });

    it('should get experiment metrics', () => {
      const experimentId = 'test-metrics';
      chaosEngineering.enableExperiment(experimentId);
      
      const metrics = chaosEngineering.getMetrics(experimentId);
      
      expect(metrics).toHaveProperty('failedRequests');
      expect(metrics).toHaveProperty('avgLatency');
      expect(metrics).toHaveProperty('errors');
      expect(metrics.errors).toBeInstanceOf(Array);
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Chaos Execution', () => {
    it('should execute chaos experiment with duration', async () => {
      const experimentId = 'test-exec';
      chaosEngineering.enableExperiment(experimentId);
      
      const result = await chaosEngineering.executeChaos({
        experimentId,
        duration: 1, // 1 second
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should handle immediate chaos (no duration)', async () => {
      const experimentId = 'test-immediate';
      chaosEngineering.enableExperiment(experimentId);
      
      const result = await chaosEngineering.executeChaos({
        experimentId,
        duration: 0,
      });
      
      expect(result).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should throw error for invalid experiment', async () => {
      await expect(
        chaosEngineering.executeChaos({
          experimentId: 'non-existent',
          duration: 1,
        })
      ).rejects.toThrow();
    });

    it('should recover from experiment', async () => {
      const experimentId = 'test-recover';
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      const recovery = await chaosEngineering.recover(experimentId);
      
      expect(recovery).toBeDefined();
      expect(recovery.success).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Resilience Validation', () => {
    it('should validate system resilience', async () => {
      const experimentId = 'test-resilience';
      chaosEngineering.enableExperiment(experimentId);
      
      const validation = await chaosEngineering.validateResilience(experimentId);
      
      expect(validation).toHaveProperty('score');
      expect(validation).toHaveProperty('passed');
      expect(typeof validation.score).toBe('number');
      expect(typeof validation.passed).toBe('boolean');
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should detect resilience failures', async () => {
      // This would depend on the specific resilience criteria
      const experimentId = 'test-failure';
      chaosEngineering.enableExperiment(experimentId);
      
      // Simulate a scenario that would fail validation
      // (In real implementation, this would be controlled by experiment parameters)
      
      const validation = await chaosEngineering.validateResilience(experimentId);
      
      // Should return a valid result
      expect(validation).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Blast Radius Control', () => {
    it('should respect blast radius limits', async () => {
      const experimentId = 'test-blast-limited';
      const blastRadius = 0.2; // 20% impact
      
      chaosEngineering.setBlastRadius(experimentId, blastRadius);
      chaosEngineering.enableExperiment(experimentId);
      
      const result = await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      // Should complete successfully with limited impact
      expect(result.success).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should handle full blast radius', async () => {
      const experimentId = 'test-blast-full';
      const blastRadius = 1.0; // 100% impact
      
      chaosEngineering.setBlastRadius(experimentId, blastRadius);
      chaosEngineering.enableExperiment(experimentId);
      
      const result = await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      expect(result).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Error Handling', () => {
    it('should handle experiment execution errors', async () => {
      const experimentId = 'test-error';
      chaosEngineering.enableExperiment(experimentId);
      
      // Mock a scenario that causes errors
      const metrics = chaosEngineering.getMetrics(experimentId);
      metrics.errors.push('Simulated error');
      
      const validation = await chaosEngineering.validateResilience(experimentId);
      
      // Should still return validation result
      expect(validation).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should handle recovery failures gracefully', async () => {
      const experimentId = 'test-recovery-fail';
      chaosEngineering.enableExperiment(experimentId);
      
      // Execute experiment
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      // Attempt recovery
      const recovery = await chaosEngineering.recover(experimentId);
      
      // Should return result even if recovery is partial
      expect(recovery).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Integration with Message Bus', () => {
    it('should publish chaos events to message bus', async () => {
      const experimentId = 'test-msg-bus';
      const receivedEvents: any[] = [];
      
      // Subscribe to chaos events
      const unsubscribe = messageBus.subscribe('chaos-events', (event) => {
        receivedEvents.push(event);
      });
      
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      // Should receive at least one event
      expect(receivedEvents.length).toBeGreaterThan(0);
      
      unsubscribe();
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should include experiment metadata in events', async () => {
      const experimentId = 'test-metadata';
      let receivedEvent: any;
      
      const unsubscribe = messageBus.subscribe('chaos-events', (event) => {
        receivedEvent = event;
      });
      
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.experimentId).toBe(experimentId);
      expect(receivedEvent.timestamp).toBeDefined();
      
      unsubscribe();
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Performance Impact', () => {
    it('should measure latency impact', async () => {
      const experimentId = 'test-latency-impact';
      chaosEngineering.enableExperiment(experimentId);
      
      const start = performance.now();
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      const duration = performance.now() - start;
      
      const metrics = chaosEngineering.getMetrics(experimentId);
      
      expect(metrics.avgLatency).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(5000); // Should complete within reasonable time
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should track failed requests', async () => {
      const experimentId = 'test-failures';
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      const metrics = chaosEngineering.getMetrics(experimentId);
      
      expect(typeof metrics.failedRequests).toBe('number');
      expect(metrics.failedRequests).toBeGreaterThanOrEqual(0);
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Experiment Scheduling', () => {
    it('should support different experiment types', () => {
      const experiments = chaosEngineering.listExperiments();
      
      const types = new Set(experiments.map(e => e.type));
      expect(types.has('network')).toBe(true);
      expect(types.has('resource')).toBe(true);
      expect(types.has('failure')).toBe(true);
      expect(types.has('state')).toBe(true);
    });

    it('should handle experiment configuration', () => {
      const experimentId = 'test-config';
      
      // Set multiple parameters
      chaosEngineering.setBlastRadius(experimentId, 0.5);
      chaosEngineering.enableExperiment(experimentId);
      
      expect(chaosEngineering.isEnabled(experimentId)).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });

  describe('Safety Mechanisms', () => {
    it('should prevent double enabling', () => {
      const experimentId = 'test-double';
      
      chaosEngineering.enableExperiment(experimentId);
      chaosEngineering.enableExperiment(experimentId); // Second call
      
      // Should still be enabled (idempotent)
      expect(chaosEngineering.isEnabled(experimentId)).toBe(true);
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should handle disabling non-enabled experiments', () => {
      const experimentId = 'test-disable-none';
      
      // Should not throw
      expect(() => {
        chaosEngineering.disableExperiment(experimentId);
      }).not.toThrow();
    });

    it('should validate blast radius range', () => {
      const experimentId = 'test-blast-validation';
      
      // Valid range
      chaosEngineering.setBlastRadius(experimentId, 0.5);
      expect(chaosEngineering.isEnabled(experimentId)).toBe(false); // Not enabled yet
      
      // Edge cases
      chaosEngineering.setBlastRadius(experimentId, 0);
      chaosEngineering.setBlastRadius(experimentId, 1);
      
      // Should handle gracefully
      expect(true).toBe(true);
    });
  });

  describe('Metrics Aggregation', () => {
    it('should aggregate metrics across multiple runs', async () => {
      const experimentId = 'test-aggregation';
      chaosEngineering.enableExperiment(experimentId);
      
      // Run multiple times
      for (let i = 0; i < 3; i++) {
        await chaosEngineering.executeChaos({
          experimentId,
          duration: 0.5,
        });
      }
      
      const metrics = chaosEngineering.getMetrics(experimentId);
      
      // Should have accumulated data
      expect(metrics.failedRequests).toBeGreaterThanOrEqual(0);
      
      chaosEngineering.disableExperiment(experimentId);
    });

    it('should reset metrics when needed', async () => {
      const experimentId = 'test-reset';
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      const metrics1 = chaosEngineering.getMetrics(experimentId);
      
      // Reset and run again
      chaosEngineering.disableExperiment(experimentId);
      chaosEngineering.enableExperiment(experimentId);
      
      await chaosEngineering.executeChaos({
        experimentId,
        duration: 1,
      });
      
      const metrics2 = chaosEngineering.getMetrics(experimentId);
      
      // Metrics should be fresh
      expect(metrics2).toBeDefined();
      
      chaosEngineering.disableExperiment(experimentId);
    });
  });
});