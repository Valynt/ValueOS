import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sanitizeUserInput } from '../../../../utils/security';
import { createSecureAgentSchema, getSecureAgentSystemPrompt } from '../../schemas/SecureAgentOutput';

vi.mock('../../../logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../observability', () => ({
  getTracer: () => ({ startSpan: vi.fn().mockReturnValue({ setAttribute: vi.fn(), addEvent: vi.fn(), end: vi.fn(), recordException: vi.fn(), setStatus: vi.fn() })}),
  addSpanAttributes: vi.fn(),
  addSpanEvent: vi.fn(),
  recordSpanException: vi.fn()
}));

vi.mock('../../../../utils/security', async () => {
  const actual = await import('../../../../utils/security');
  return { ...actual, sanitizeUserInput: vi.fn(actual.sanitizeUserInput) };
});
import { BackgroundTestOptimizationAgent } from '../BackgroundTestOptimizationAgent';
import type { LLMGateway } from '../../LLMGateway';
import type { MemorySystem } from '../../MemorySystem';
import type { AuditLogger } from '../../AuditLogger';

describe('BackgroundTestOptimizationAgent', () => {
  let agent: BackgroundTestOptimizationAgent;
  let mockLLMGateway: LLMGateway;
  let mockMemorySystem: MemorySystem;
  let mockAuditLogger: AuditLogger;
  let mockSupabase: any;

  let secureSpy: any;

  beforeEach(() => {
    (global as any).sanitizeUserInput = (value: string) => value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
    (global as any).createSecureAgentSchema = createSecureAgentSchema;
    (global as any).getSecureAgentSystemPrompt = getSecureAgentSystemPrompt;
    mockLLMGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          analysis: { missing_tests: { unit: ['src/foo.ts'] }, flaky_tests: [], coverage_risks: [] },
          recommendedPatches: ['diff --git a/src/foo.ts b/src/foo.ts']
        }),
        model: 'test-model',
        tokens_used: 10
      })
    } as any;

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
      retrieveRelevantMemories: vi.fn().mockResolvedValue([])
    } as any;

    mockAuditLogger = {
      logAction: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined),
      logPerformanceMetric: vi.fn().mockResolvedValue(undefined)
    } as any;

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null })
    };

    agent = new BackgroundTestOptimizationAgent({
      id: 'test-btoa-agent',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase
    });

    // Stub secureInvoke to avoid calling BaseAgent internals and global dependencies
    secureSpy = vi.spyOn(BackgroundTestOptimizationAgent.prototype as any, 'secureInvoke').mockResolvedValue({
      result: {
        analysis: { missing_tests: { unit: ['src/foo.ts'] }, flaky_tests: [], coverage_risks: [] },
        recommendedPatches: ['diff --git a/src/foo.ts b/src/foo.ts']
      },
      confidence_level: 'high',
      confidence_score: 0.9,
      hallucination_check: false,
      assumptions: [],
      data_gaps: [],
      evidence: [],
      reasoning: 'test reasoning'
    });
  });

  it('should return a json shaped analysis and recommended patches', async () => {
    const result = await agent.execute('session-1', { diff: {}, coverageReport: {} });

    expect(result).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(Array.isArray(result.recommendedPatches)).toBe(true);
  });

  it('should call LLM with system and user prompts', async () => {
    await agent.execute('session-1', { diff: {}, coverageReport: {} });

    expect(secureSpy).toHaveBeenCalledWith('session-1', expect.stringContaining('Background Test Optimization Agent'), expect.anything(), expect.anything());
  });

  it('should log performance metrics', async () => {
    await agent.execute('session-1', { diff: {}, coverageReport: {} });

    expect(mockAuditLogger.logPerformanceMetric).toHaveBeenCalled();
  });
});
