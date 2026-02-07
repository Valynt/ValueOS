import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnifiedAgentOrchestrator } from '../UnifiedAgentOrchestrator.js'

describe('UnifiedAgentOrchestrator Integrity / RE-REFINE behavior', () => {
  let orchestrator: UnifiedAgentOrchestrator;

  beforeEach(() => {
    orchestrator = new UnifiedAgentOrchestrator();
  });

  it('should request re-refine when ConfidenceMonitor avgConfidenceScore < 0.85', async () => {
    // Arrange: stub confidenceMonitor
    orchestrator.confidenceMonitor = {
      getMetrics: vi.fn().mockResolvedValue({ avgConfidenceScore: 0.7 }),
    } as any;

    // Act
    const res = await orchestrator.evaluateIntegrityVeto({}, { traceId: 't1', agentType: 'test' });

    // Assert
    expect(res.reRefine).toBe(true);
    expect(res.vetoed).toBe(false);
  });

  it('should veto when IntegrityAgent reports high severity issue', async () => {
    // Arrange: make confidence monitor healthy
    orchestrator.confidenceMonitor = { getMetrics: vi.fn().mockResolvedValue({ avgConfidenceScore: 0.95 }) } as any;

    // Mock agentAPI to return an integrity issue
    orchestrator.agentAPI = {
      invokeAgent: vi.fn().mockResolvedValue({
        success: true,
        data: {
          integrityCheck: {
            confidence: 0.95,
            issues: [
              { type: 'data_integrity', severity: 'high', description: 'Untrusted source' },
            ],
          },
        },
      }),
    } as any;

    const res = await orchestrator.evaluateIntegrityVeto({}, { traceId: 't2', agentType: 'test' });
    expect(res.vetoed).toBe(true);
    expect(res.metadata).toBeTruthy();
    expect(res.metadata?.integrityVeto).toBe(true);
  });
});
