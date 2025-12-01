/**
 * Observability Stack End-to-End Tests
 * 
 * Tests the complete observability stack including:
 * - OpenTelemetry tracing
 * - Metrics collection
 * - Alerting
 * - Value prediction tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  initializeObservability,
  shutdownObservability,
  isObservabilityEnabled,
  traceAgentExecution,
  traceValueTreeOperation,
  traceWorkflowOperation,
  traceSDUIGeneration,
  recordAgentConfidence,
  recordValuePrediction
} from '../../lib/observability';
import { getMetricsCollector, resetMetricsCollector } from '../../services/MetricsCollector';
import { getAlertingService, resetAlertingService } from '../../services/AlertingService';
import { getValuePredictionTracker, resetValuePredictionTracker } from '../../services/ValuePredictionTracker';

// Mock Supabase client
const mockSupabase = createClient(
  'https://test.supabase.co',
  'test-key'
);

describe('Observability Stack', () => {
  beforeEach(() => {
    resetMetricsCollector();
    resetAlertingService();
    resetValuePredictionTracker();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await shutdownObservability();
  });

  describe('Initialization', () => {
    it('should initialize observability stack', () => {
      initializeObservability();
      // In browser environment, observability is skipped
      expect(isObservabilityEnabled()).toBe(false);
    });

    it('should shutdown gracefully', async () => {
      initializeObservability();
      await expect(shutdownObservability()).resolves.not.toThrow();
    });
  });

  describe('Agent Tracing', () => {
    it('should trace agent execution', async () => {
      const result = await traceAgentExecution(
        'test_operation',
        {
          agentId: 'test-agent',
          agentName: 'TestAgent',
          lifecycleStage: 'test',
          version: '1.0.0',
          sessionId: 'test-session'
        },
        async (span) => {
          expect(span).toBeDefined();
          return { success: true };
        }
      );

      expect(result).toEqual({ success: true });
    });

    it('should handle errors in traced operations', async () => {
      await expect(
        traceAgentExecution(
          'failing_operation',
          {
            agentId: 'test-agent',
            agentName: 'TestAgent',
            lifecycleStage: 'test',
            version: '1.0.0',
            sessionId: 'test-session'
          },
          async () => {
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');
    });

    it('should record agent confidence', () => {
      expect(() => {
        recordAgentConfidence('high', 0.95, false);
      }).not.toThrow();
    });
  });

  describe('Critical Path Tracing', () => {
    it('should trace value tree operations', async () => {
      const result = await traceValueTreeOperation(
        'build',
        {
          sessionId: 'test-session',
          treeId: 'tree-1',
          nodeCount: 10,
          depth: 3
        },
        async (span) => {
          return { nodes: 10, links: 9 };
        }
      );

      expect(result).toEqual({ nodes: 10, links: 9 });
    });

    it('should trace workflow operations', async () => {
      const result = await traceWorkflowOperation(
        'execute',
        {
          sessionId: 'test-session',
          workflowId: 'workflow-1',
          workflowType: 'expansion',
          currentStage: 'target',
          stageCount: 5
        },
        async (span) => {
          return { completed: true };
        }
      );

      expect(result).toEqual({ completed: true });
    });

    it('should trace SDUI generation', async () => {
      const result = await traceSDUIGeneration(
        'generate',
        {
          sessionId: 'test-session',
          componentType: 'value_tree',
          componentCount: 5,
          dataSize: 1024
        },
        async (span) => {
          return { components: 5 };
        }
      );

      expect(result).toEqual({ components: 5 });
    });
  });

  describe('Metrics Collection', () => {
    it('should record agent invocation metrics', () => {
      const metrics = getMetricsCollector(mockSupabase);

      expect(() => {
        metrics.recordAgentInvocation(
          'test_agent',
          true,
          1500,
          0.85,
          false
        );
      }).not.toThrow();
    });

    it('should record LLM call metrics', () => {
      const metrics = getMetricsCollector(mockSupabase);

      expect(() => {
        metrics.recordLLMCall(
          'together_ai',
          'meta-llama/Llama-3-70b-chat-hf',
          800,
          0.05,
          false
        );
      }).not.toThrow();
    });

    it('should record value prediction metrics', () => {
      const metrics = getMetricsCollector(mockSupabase);

      expect(() => {
        metrics.recordValuePrediction(
          'roi',
          100000,
          95000
        );
      }).not.toThrow();
    });

    it('should get agent metrics', async () => {
      const metrics = getMetricsCollector(mockSupabase);

      // Mock Supabase response
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      } as any);

      const agentMetrics = await metrics.getAgentMetrics('test_agent', 'day');
      expect(Array.isArray(agentMetrics)).toBe(true);
    });
  });

  describe('Value Prediction Tracking', () => {
    it('should record a prediction', async () => {
      const tracker = getValuePredictionTracker(mockSupabase);

      // Mock Supabase response
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'pred-1' },
              error: null
            })
          })
        })
      } as any);

      const predictionId = await tracker.recordPrediction({
        id: 'pred-1',
        predictionType: 'roi',
        predictedValue: 100000,
        confidence: 0.85,
        sessionId: 'test-session',
        agentId: 'test-agent'
      });

      expect(predictionId).toBe('pred-1');
    });

    it('should record actual outcome', async () => {
      const tracker = getValuePredictionTracker(mockSupabase);

      // Mock Supabase responses
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'pred-1',
                prediction: { type: 'roi', value: 100000 }
              },
              error: null
            })
          })
        }),
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null
        })
      } as any);

      await expect(
        tracker.recordActualOutcome({
          predictionId: 'pred-1',
          actualValue: 95000,
          measurementDate: new Date(),
          notes: 'Test measurement'
        })
      ).resolves.not.toThrow();
    });
  });

  describe('Alerting Service', () => {
    it('should start alerting service', () => {
      const alerting = getAlertingService(mockSupabase);

      expect(() => {
        alerting.start();
      }).not.toThrow();

      alerting.stop();
    });

    it('should add custom alert rule', () => {
      const alerting = getAlertingService(mockSupabase);

      expect(() => {
        alerting.addAlertRule({
          id: 'test-alert',
          name: 'Test Alert',
          enabled: true,
          thresholds: [
            {
              metricName: 'test.metric',
              operator: 'gt',
              threshold: 100,
              severity: 'warning',
              description: 'Test threshold'
            }
          ],
          checkIntervalMinutes: 5,
          notificationChannels: ['sentry']
        });
      }).not.toThrow();

      alerting.stop();
    });

    it('should get active alerts', () => {
      const alerting = getAlertingService(mockSupabase);

      const alerts = alerting.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should clear alerts', () => {
      const alerting = getAlertingService(mockSupabase);

      expect(() => {
        alerting.clearAlert('test.metric');
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should trace agent with metrics recording', async () => {
      const metrics = getMetricsCollector(mockSupabase);
      const startTime = Date.now();

      const result = await traceAgentExecution(
        'integrated_test',
        {
          agentId: 'test-agent',
          agentName: 'TestAgent',
          lifecycleStage: 'test',
          version: '1.0.0',
          sessionId: 'test-session'
        },
        async (span) => {
          // Simulate work
          await new Promise(resolve =\u003e setTimeout(resolve, 100));
          
          recordAgentConfidence('high', 0.9, false);
          
          return { success: true, value: 42 };
        }
      );

      const duration = Date.now() - startTime;

      // Record metrics
      metrics.recordAgentInvocation(
        'test_agent',
        true,
        duration,
        0.9,
        false
      );

      expect(result).toEqual({ success: true, value: 42 });
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should handle complete prediction workflow', async () => {
      const tracker = getValuePredictionTracker(mockSupabase);
      const metrics = getMetricsCollector(mockSupabase);

      // Mock Supabase
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'pred-1' },
              error: null
            })
          })
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'pred-1',
                prediction: { type: 'roi', value: 100000 }
              },
              error: null
            })
          })
        })
      } as any);

      // Record prediction
      const predictionId = await tracker.recordPrediction({
        id: 'pred-1',
        predictionType: 'roi',
        predictedValue: 100000,
        confidence: 0.85,
        sessionId: 'test-session',
        agentId: 'test-agent'
      });

      // Record in metrics
      metrics.recordValuePrediction('roi', 100000);

      // Record actual outcome
      await tracker.recordActualOutcome({
        predictionId,
        actualValue: 95000,
        measurementDate: new Date()
      });

      // Record in metrics with actual
      metrics.recordValuePrediction('roi', 100000, 95000);

      expect(predictionId).toBe('pred-1');
    });

    it('should trigger alerts on threshold violations', async () => {
      const alerting = getAlertingService(mockSupabase);
      const metrics = getMetricsCollector(mockSupabase);

      const insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      vi.spyOn(mockSupabase, 'from').mockReturnValue({ insert: insertSpy } as any);
      vi.spyOn(metrics, 'getAgentMetrics').mockResolvedValue([
        {
          agentType: 'test_agent',
          totalInvocations: 10,
          successfulInvocations: 5,
          failedInvocations: 5,
          successRate: 0.5,
          avgResponseTime: 6000,
          p50ResponseTime: 3000,
          p95ResponseTime: 6000,
          p99ResponseTime: 7000,
          avgConfidenceScore: 0.4,
          hallucinationRate: 0.2
        }
      ]);

      alerting.start();
      await new Promise(resolve => setTimeout(resolve, 0));
      alerting.stop();

      expect(insertSpy).toHaveBeenCalled();
      expect(alerting.getActiveAlerts().length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const metrics = getMetricsCollector(mockSupabase);

      // Mock database error
      vi.spyOn(mockSupabase, 'from').mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        })
      } as any);

      await expect(
        metrics.getAgentMetrics('test_agent', 'day')
      ).rejects.toThrow('Database error');
    });

    it('should handle tracing errors gracefully', async () => {
      await expect(
        traceAgentExecution(
          'error_test',
          {
            agentId: 'test-agent',
            agentName: 'TestAgent',
            lifecycleStage: 'test',
            version: '1.0.0',
            sessionId: 'test-session'
          },
          async () => {
            throw new Error('Simulated error');
          }
        )
      ).rejects.toThrow('Simulated error');
    });
  });

  describe('Performance', () => {
    it('should have minimal tracing overhead', async () => {
      const iterations = 100;
      
      // Without tracing
      const startWithout = Date.now();
      for (let i = 0; i \u003c iterations; i++) {
        await Promise.resolve({ value: i });
      }
      const durationWithout = Date.now() - startWithout;

      // With tracing
      const startWith = Date.now();
      for (let i = 0; i \u003c iterations; i++) {
        await traceAgentExecution(
          'perf_test',
          {
            agentId: 'test-agent',
            agentName: 'TestAgent',
            lifecycleStage: 'test',
            version: '1.0.0',
            sessionId: 'test-session'
          },
          async () => ({ value: i })
        );
      }
      const durationWith = Date.now() - startWith;

      const overhead = durationWith - durationWithout;
      const overheadPercent = (overhead / durationWithout) * 100;

      // Overhead should be less than 50% (very generous for test environment)
      expect(overheadPercent).toBeLessThan(50);
    });
  });
});
