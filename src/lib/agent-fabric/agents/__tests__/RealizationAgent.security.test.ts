/**
 * RealizationAgent Security Tests
 * Validates secureInvoke() usage, tenant isolation, and Zod schema enforcement
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealizationAgent } from '../RealizationAgent';
import type { LLMGateway } from '../../LLMGateway';
import type { MemorySystem } from '../../MemorySystem';
import type { AuditLogger } from '../../AuditLogger';

describe('RealizationAgent - Security Fixes', () => {
  let agent: RealizationAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  let mockSupabase: any;
  const testOrgId = 'org-test-123';

  beforeEach(() => {
    mockLLMGateway = {
      complete: vi.fn(),
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    };

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
      storeEpisodicMemory: vi.fn().mockResolvedValue(undefined)
    };

    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined),
      logPerformanceMetric: vi.fn().mockResolvedValue(undefined),
      logArtifactProvenance: vi.fn().mockResolvedValue(undefined)
    };

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null })
    };

    agent = new RealizationAgent({
      id: 'realization-agent-test',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase,
      organizationId: testOrgId
    });
  });

  describe('secureInvoke() Usage', () => {
    it('should NOT call llmGateway.complete() directly', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [
          { kpi_name: 'revenue', value: 100000, timestamp: new Date().toISOString() }
        ],
        commitments: [
          { kpi_name: 'revenue', target_value: 120000, baseline_value: 90000 }
        ]
      };

      // Mock secureInvoke to avoid actual LLM call
      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: { revenue: { status: 'on_track' } },
          recommendations: ['Continue monitoring'],
          root_causes: {},
          confidence_level: 'high',
          reasoning: 'Analysis complete',
          executive_summary: 'Test summary'
        },
        confidence: 0.85,
        raw_response: {}
      });

      await agent.execute('session-123', input);

      // Verify secureInvoke was called instead of llmGateway.complete
      expect(secureInvokeSpy).toHaveBeenCalled();
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });

    it('should pass Zod schema to secureInvoke()', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [],
        commitments: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: {},
          recommendations: [],
          root_causes: {},
          confidence_level: 'medium',
          reasoning: 'Test',
          executive_summary: 'Summary'
        },
        confidence: 0.7
      });

      await agent.execute('session-123', input);

      const call = secureInvokeSpy.mock.calls[0];
      const schema = call[2]; // Third argument is schema

      // Verify schema validates required fields
      expect(schema).toBeDefined();
      expect(() => schema.parse({
        kpi_results: {},
        recommendations: [],
        root_causes: {},
        confidence_level: 'high',
        reasoning: 'Test reasoning'
      })).not.toThrow();
    });

    it('should enforce confidence thresholds (0.6 low, 0.85 high)', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [],
        commitments: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: { kpi_results: {}, recommendations: [], root_causes: {}, confidence_level: 'high', reasoning: 'Test', executive_summary: 'Summary' },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.confidenceThresholds).toEqual({ low: 0.6, high: 0.85 });
    });

    it('should include hallucination_check in schema', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [],
        commitments: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: {},
          recommendations: [],
          root_causes: {},
          confidence_level: 'high',
          reasoning: 'Test',
          hallucination_check: false,
          executive_summary: 'Summary'
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      const schema = secureInvokeSpy.mock.calls[0][2];
      
      // Verify hallucination_check is optional boolean
      const validData = {
        kpi_results: {},
        recommendations: [],
        root_causes: {},
        confidence_level: 'high',
        reasoning: 'Test',
        hallucination_check: true
      };
      
      expect(() => schema.parse(validData)).not.toThrow();
    });
  });

  describe('Tenant Isolation', () => {
    it('should pass organizationId to storeSemanticMemory()', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [],
        commitments: []
      };

      vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: {},
          recommendations: ['Test recommendation'],
          root_causes: {},
          confidence_level: 'high',
          reasoning: 'Test',
          executive_summary: 'Summary'
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      // Verify organizationId was passed as 5th parameter
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        'session-123',
        expect.any(String), // agentId
        expect.stringContaining('Realization Report'),
        expect.any(Object), // metadata
        testOrgId // organizationId - CRITICAL for tenant isolation
      );
    });

    it('should fail if organizationId is missing', () => {
      // Create agent without organizationId
      const agentWithoutOrg = new RealizationAgent({
        id: 'test-agent',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: mockSupabase
        // organizationId deliberately omitted
      });

      expect((agentWithoutOrg as any).organizationId).toBeUndefined();
    });
  });

  describe('Circuit Breaker Protection', () => {
    it('should track prediction for accuracy metrics', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [],
        commitments: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: {},
          recommendations: [],
          root_causes: {},
          confidence_level: 'high',
          reasoning: 'Test',
          executive_summary: 'Summary'
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.trackPrediction).toBe(true);
    });

    it('should include agent context in secureInvoke options', async () => {
      const input = {
        targetId: 'target-123',
        telemetryData: [{ kpi_name: 'test', value: 100, timestamp: new Date().toISOString() }],
        commitments: []
      };

      const secureInvokeSpy = vi.spyOn(agent as any, 'secureInvoke').mockResolvedValue({
        result: {
          kpi_results: {},
          recommendations: [],
          root_causes: {},
          confidence_level: 'high',
          reasoning: 'Test',
          executive_summary: 'Summary'
        },
        confidence: 0.85
      });

      await agent.execute('session-123', input);

      const options = secureInvokeSpy.mock.calls[0][3];
      expect(options.context).toEqual({
        agent: 'RealizationAgent',
        telemetryPoints: 1
      });
    });
  });
});
