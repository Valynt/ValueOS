/**
 * RealizationAgent Tests
 * 
 * Tests for Realization Agent with value tracking and telemetry
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealizationAgent } from '../../lib/agent-fabric/agents/RealizationAgent';

describe('RealizationAgent', () => {
  let agent: RealizationAgent;
  let mockLLM: any;
  let mockMemory: any;
  let mockAudit: any;
  let mockDB: any;

  beforeEach(() => {
    mockLLM = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          executive_summary: 'Strong value realization with 80% of targets met',
          insights: [
            'Processing time reduced by 75%',
            'Cost savings exceeded target by 20%',
            'User adoption at 90%'
          ],
          recommendations: [
            'Continue current trajectory',
            'Focus on remaining 20% adoption'
          ],
          root_causes: [],
          confidence_level: 'high'
        }),
        tokens_used: 1000,
        model: 'gpt-4'
      })
    };

    mockMemory = { storeSemanticMemory: vi.fn() };
    mockAudit = { log: vi.fn() };
    mockDB = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'target-1',
            kpi_name: 'Processing time',
            baseline_value: 20,
            target_value: 4,
            unit: 'hours/week'
          }
        ]
      })
    };

    agent = new RealizationAgent('realization-1', mockLLM, mockMemory, mockAudit, mockDB);
  });

  describe('Value Tracking', () => {
    it('should track KPI progress', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [
          {
            kpi_name: 'Processing time',
            value: 5,
            timestamp: '2025-01-01T00:00:00Z'
          }
        ],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });

    it('should calculate variance', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [
          {
            kpi_name: 'Processing time',
            value: 5,
            timestamp: '2025-01-01T00:00:00Z'
          }
        ],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result.results[0].variance).toBeDefined();
      expect(result.results[0].variance_percentage).toBeDefined();
    });

    it('should determine result status', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [
          {
            kpi_name: 'Processing time',
            value: 4,
            timestamp: '2025-01-01T00:00:00Z'
          }
        ],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result.results[0].status).toMatch(/on_track|at_risk|off_track|achieved/);
    });
  });

  describe('Report Generation', () => {
    it('should generate realization report', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result.report).toBeDefined();
      expect(result.report.executive_summary).toBeDefined();
    });

    it('should provide insights', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result.report.insights).toBeDefined();
      expect(Array.isArray(result.report.insights)).toBe(true);
      expect(result.report.insights.length).toBeGreaterThan(0);
    });

    it('should provide recommendations', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result.report.recommendations).toBeDefined();
      expect(Array.isArray(result.report.recommendations)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing telemetry data', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const result = await agent.execute('session-1', input);

      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
    });

    it('should handle LLM failures', async () => {
      mockLLM.complete.mockRejectedValue(new Error('LLM error'));

      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      await expect(agent.execute('session-1', input)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should complete within acceptable time', async () => {
      const input = {
        valueCommitId: 'commit-1',
        telemetryEvents: [],
        reportPeriod: {
          start: '2025-01-01',
          end: '2025-01-31'
        }
      };

      const start = Date.now();
      await agent.execute('session-1', input);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });
  });
});
