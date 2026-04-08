import { describe, expect, it, vi } from 'vitest';

import { WorkflowPersistence } from '../workflow-persistence.js';

function makePort() {
  return {
    persistExecutionRecord: vi.fn().mockResolvedValue(undefined),
    updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
    recordWorkflowEvent: vi.fn().mockResolvedValue(undefined),
    markWorkflowFailed: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WorkflowPersistence', () => {
  it('persists record before status update', async () => {
    const port = makePort();
    const persistence = new WorkflowPersistence(port as never);

    await persistence.persistAndUpdate('exec-1', 'org-1', { id: 'exec-1' } as never, 'in_progress', 'stage-1');

    expect(port.persistExecutionRecord.mock.invocationCallOrder[0]).toBeLessThan(
      port.updateExecutionStatus.mock.invocationCallOrder[0],
    );
    expect(port.updateExecutionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ executionId: 'exec-1', organizationId: 'org-1', status: 'in_progress', currentStage: 'stage-1' }),
    );
  });

  it('records workflow event with stable payload shape', async () => {
    const port = makePort();
    const persistence = new WorkflowPersistence(port as never);

    await persistence.recordWorkflowEvent('exec-1', 'org-1', 'stage_failed', 'stage-1', { reason: 'execution_error' });

    expect(port.recordWorkflowEvent).toHaveBeenCalledWith({
      executionId: 'exec-1',
      organizationId: 'org-1',
      eventType: 'stage_failed',
      stageId: 'stage-1',
      metadata: { reason: 'execution_error' },
    });
  });
});
