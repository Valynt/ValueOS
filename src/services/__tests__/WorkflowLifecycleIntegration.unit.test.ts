import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowLifecycleIntegration } from '../WorkflowLifecycleIntegration';

// Mock ValueLifecycleOrchestrator to avoid running agents
vi.mock('../ValueLifecycleOrchestrator', async () => {
  const actual = await vi.importActual('../ValueLifecycleOrchestrator');
  return {
    ...actual,
    ValueLifecycleOrchestrator: vi.fn().mockImplementation(() => ({
      executeLifecycleStage: vi.fn().mockResolvedValue({ success: true, data: { result: 'ok' } }),
    })),
  };
});

describe('WorkflowLifecycleIntegration', () => {
  it('executes full lifecycle and completes', async () => {
    const fakeSupabase: any = {}; // Not used in happy path due to mocks
    const integration = new WorkflowLifecycleIntegration(fakeSupabase as any);

    const exec = await integration.executeWorkflow('user-1', { initial: true });

    expect(exec.status).toBe('completed');
    expect(exec.completedStages.length).toBeGreaterThan(0);
  });

  it('compensates on failure when autoCompensate is true', async () => {
    // Mock orchestrator to throw for a specific stage
    const { ValueLifecycleOrchestrator } = await import('../ValueLifecycleOrchestrator');
    (ValueLifecycleOrchestrator as any).mockImplementation(() => ({
      executeLifecycleStage: vi.fn().mockImplementationOnce(async () => ({ success: true, data: {} })).mockImplementationOnce(async () => { throw new Error('Stage failed'); }),
    }));

    const fakeSupabase: any = {};
    const integration = new WorkflowLifecycleIntegration(fakeSupabase as any);

    await expect(integration.executeWorkflow('user-1', { some: 'input' })).rejects.toThrow('Stage failed');

    // Ensure failed execution recorded
    const executions = integration.getUserExecutions('user-1');
    expect(executions.length).toBeGreaterThan(0);
    expect(executions[0].status).toBe('failed');
  });
});
