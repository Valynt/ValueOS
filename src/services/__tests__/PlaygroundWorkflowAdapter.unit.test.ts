import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaygroundWorkflowAdapter } from '../PlaygroundWorkflowAdapter';
import { ExecutionRequest } from '../../types/execution';

vi.mock('../PlaygroundAutoSave', () => {
  return {
    getAutoSaveWorker: () => ({ startAutoSave: vi.fn() }),
  };
});

describe('PlaygroundWorkflowAdapter', () => {
  it('starts draft workflow and creates session', async () => {
    const orchestrator: any = { executeWorkflow: vi.fn().mockResolvedValue('wf-exec-1') };
    const sessionService: any = {
      createSession: vi.fn().mockResolvedValue({ sessionId: 'session-1', metadata: { autoSaveInterval: 1000 } }),
      loadSession: vi.fn()
    };

    const adapter = new PlaygroundWorkflowAdapter(orchestrator as any, sessionService as any);

    const execution: ExecutionRequest = { intent: 'WhatIfScenario', environment: 'sandbox', parameters: { foo: 'bar' } };
    const res = await adapter.startDraftWorkflow('wf-def', 'user-1', 'org-1', { components: [] }, execution);

    expect(res.sessionId).toBe('session-1');
    expect(res.workflowExecutionId).toBeDefined();
    expect(sessionService.createSession).toHaveBeenCalled();
  });
});
