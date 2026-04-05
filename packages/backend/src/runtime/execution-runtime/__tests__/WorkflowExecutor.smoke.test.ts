import { describe, expect, it, vi } from 'vitest';

import { WorkflowExecutor } from '../WorkflowExecutor.js';

vi.mock('../../../services/agents/resilience/AgentRetryManager', () => ({
  AgentRetryManager: {
    getInstance: vi.fn(() => ({
      executeWithRetry: vi.fn().mockResolvedValue({ success: true, response: { data: { ok: true } }, attempts: 1 }),
    })),
  },
}));


const persistence = {
  getActiveWorkflowDefinition: vi.fn().mockResolvedValue({
    id: 'wf-1',
    name: 'Smoke WF',
    version: '1',
    organization_id: null,
    dag_schema: {
      initial_stage: 's1',
      final_stages: ['s1'],
      stages: [{ id: 's1', agent_type: 'discovery' }],
      transitions: [],
    },
  }),
  createWorkflowExecution: vi.fn().mockResolvedValue({ id: 'exec-1' }),
  updateWorkflowExecutionContext: vi.fn().mockResolvedValue(undefined),
  persistExecutionRecord: vi.fn().mockResolvedValue(undefined),
  updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
  recordStageRun: vi.fn().mockResolvedValue(undefined),
  recordWorkflowEvent: vi.fn().mockResolvedValue(undefined),
  markWorkflowFailed: vi.fn().mockResolvedValue(undefined),
};

describe('WorkflowExecutor smoke', () => {
  it('executes workflow entrypoint and returns initiated status', async () => {
    const executor = new WorkflowExecutor(
      {
        assertTenantExecutionAllowed: vi.fn().mockResolvedValue(undefined),
        checkHITL: vi.fn().mockReturnValue({ hitl_required: false, details: { rule_id: 'R1' } }),
      } as never,
      { routeStage: vi.fn().mockReturnValue({ selected_agent: { id: 'a1' } }) } as never,
      { execute: vi.fn(async (_k: string, fn: () => unknown) => fn()) } as never,
      { recordRelease: vi.fn(), markHealthy: vi.fn(), recordFailure: vi.fn() } as never,
      { sendToAgent: vi.fn().mockResolvedValue({ success: true, data: { ok: true } }) } as never,
      { retrieve: vi.fn().mockResolvedValue([]), storeEpisode: vi.fn().mockResolvedValue(undefined) } as never,
      vi.fn().mockReturnValue(true),
      { enableWorkflows: true, maxRetryAttempts: 2, maxAgentInvocationsPerMinute: 10 },
      { executionPersistence: persistence },
    );

    const result = await executor.executeWorkflow({ organizationId: 'org-1' } as never, 'wf-1', {});
    expect(result.status).toBe('initiated');
  });
});
