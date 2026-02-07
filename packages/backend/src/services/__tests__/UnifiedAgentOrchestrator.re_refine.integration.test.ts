import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnifiedAgentOrchestrator } from '../UnifiedAgentOrchestrator.js'

// Integration-style test: simulate agent returning low-confidence outputs and ensure RE-REFINE loop is attempted

describe('UnifiedAgentOrchestrator RE-REFINE integration', () => {
  let orchestrator: UnifiedAgentOrchestrator;

  beforeEach(() => {
    orchestrator = new UnifiedAgentOrchestrator();

    // Mock ConfidenceMonitor to report low global confidence
    orchestrator.confidenceMonitor = { getMetrics: vi.fn().mockResolvedValue({ avgConfidenceScore: 0.7 }) } as any;

    // Mock ground truth service methods used in evaluateIntegrityVeto
    orchestrator.groundTruthService = {
      getBenchmark: vi.fn().mockResolvedValue({ value: 100 }),
      validateClaim: vi.fn().mockResolvedValue({ valid: true, warning: undefined, benchmark: { p50: 100 } }),
    } as any;
  });

  it('auto re-invokes agent and accepts refined result', async () => {
    // First invocation returns low-quality result
    const firstResponse = { success: true, data: { message: 'Estimate: $200 (no citations)' } };

    // Refined response with citations and numeric claims
    const refinedResponse = { success: true, data: { message: 'Estimate: $100', metrics: [{ metricId: 'edo', claimedValue: 100 }] } };

    // Mock AgentAPI.invokeAgent to return firstResponse, then refinedResponse on the next call
    const invokeMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(refinedResponse);

    orchestrator.agentAPI = { invokeAgent: invokeMock } as any;

    // Build env / query / state
    const envelope: any = { actor: { id: 'user-1' }, organizationId: 'org-1' };
    const currentState: any = { currentStage: 'start', context: {}, completedStages: [], status: 'initiated' };

    const result = await orchestrator.processQuery(envelope as any, 'What is the opportunity value?', currentState, 'user-1', 'sess-1', 'trace-1');

    // After RE-REFINE, orchestrator should return refined result (containing $100)
    expect(result.response).toBeTruthy();
    expect(result.response?.payload).toBeTruthy();
    const payload = result.response?.payload as any;
    expect(JSON.stringify(payload)).toContain('$100');

    // Ensure AgentAPI invoked at least twice (initial + refine)
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('fails gracefully when RE-REFINE cannot produce acceptable result', async () => {
    // First invocation returns low-quality result
    const firstResponse = { success: true, data: { message: 'Bad estimate: $5000' } };

    // Refined attempts continue to fail structurally or remain low quality
    const badRefine = { success: true, data: { message: 'Still bad' } };

    const invokeMock = vi.fn()
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValue(badRefine);

    orchestrator.agentAPI = { invokeAgent: invokeMock } as any;

    const envelope: any = { actor: { id: 'user-1' }, organizationId: 'org-1' };
    const currentState: any = { currentStage: 'start', context: {}, completedStages: [], status: 'initiated' };

    const result = await orchestrator.processQuery(envelope as any, 'What is the opportunity value?', currentState, 'user-1', 'sess-1', 'trace-2');

    expect(result.response).toBeTruthy();
    const payload = result.response?.payload as any;
    expect(payload.error).toBe(true);
    expect(payload.message).toContain('Unable to auto-refine');

    // Ensure multiple attempts occurred
    expect(invokeMock).toHaveBeenCalled();
    expect(invokeMock.mock.calls.length).toBeGreaterThan(1);
  });
});
