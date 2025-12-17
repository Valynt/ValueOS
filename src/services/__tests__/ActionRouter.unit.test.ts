import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionRouter } from '../ActionRouter';

// Mock manifestoEnforcer and enforceRules to allow actions
vi.mock('../ManifestoEnforcer', () => ({
  manifestoEnforcer: { checkAction: vi.fn().mockResolvedValue({ allowed: true, violations: [], warnings: [] }) }
}));
vi.mock('../../lib/rules', () => ({ enforceRules: vi.fn().mockResolvedValue({ allowed: true, metadata: { globalRulesChecked: 0, localRulesChecked: 0 }, violations: [], warnings: [] }) }));

describe('ActionRouter', () => {
  it('routes runWorkflowStep action to orchestrator and returns success', async () => {
    const orchestrator: any = { executeWorkflow: vi.fn().mockResolvedValue({ executionId: 'exec-1', status: 'initiated' }) };
    const router = new ActionRouter(undefined, orchestrator as any, undefined as any, undefined as any);

    const action = { type: 'runWorkflowStep', workflowId: 'wf-1', stepId: 's1', input: { x: 1 } } as any;
    const context = {
      workspaceId: 'org-1',
      userId: 'user-1',
      timestamp: Date.now(),
      execution: { intent: 'FullValueAnalysis', environment: 'production', parameters: {} },
    } as any;

    const result = await router.routeAction(action, context);

    expect(result.success).toBe(true);
    expect(orchestrator.executeWorkflow).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ parameters: expect.objectContaining({ x: 1 }) }),
      context.userId
    );
  });

  it('returns validation error when required fields are missing', async () => {
    const router = new ActionRouter();
    const action = { type: 'runWorkflowStep', workflowId: '', stepId: '' } as any;
    const context = {
      workspaceId: 'org-1',
      userId: 'user-1',
      timestamp: Date.now(),
      execution: { intent: 'FullValueAnalysis', environment: 'production', parameters: {} },
    } as any;

    const result = await router.routeAction(action, context);

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('workflowId is required');
  });
});
