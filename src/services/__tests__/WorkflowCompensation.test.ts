import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowCompensation } from '../../services/WorkflowCompensation';
import { createBoltClientMock } from '../utils/mockSupabaseClient';

let supabaseClient: any = createBoltClientMock();
vi.mock('../../lib/supabase', () => ({
  get supabase() {
    return supabaseClient;
  }
}));

describe('WorkflowCompensation', () => {
  beforeEach(() => {
    supabaseClient = createBoltClientMock({
      workflow_executions: [
        {
          id: 'exec-1',
          status: 'failed',
          context: {
            executed_steps: [
              { stage_id: 'opportunity_discovery', stage_type: 'opportunity', compensator: 'opportunity' },
              { stage_id: 'target_value_commit', stage_type: 'target', compensator: 'target' }
            ],
            compensation_policy: 'continue_on_error'
          }
        }
      ],
      workflow_execution_logs: [
        {
          id: 'log-1',
          execution_id: 'exec-1',
          stage_id: 'opportunity_discovery',
          status: 'completed',
          output_data: { artifacts_created: ['opp-artifact'] },
          completed_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'log-2',
          execution_id: 'exec-1',
          stage_id: 'target_value_commit',
          status: 'completed',
          output_data: { artifacts_created: ['target-artifact'], amount: 5000 },
          completed_at: '2024-01-02T00:00:00Z'
        }
      ],
      workflow_events: [],
      opportunity_artifacts: [{ id: 'opp-artifact' }],
      target_artifacts: [{ id: 'target-artifact', status: 'approved' }],
      value_commits: [{ id: 'target-artifact', status: 'active', metadata: {} }],
      kpi_targets: [{ id: 'kpi-1', value_commit_id: 'target-artifact' }]
    });
  });

  it('rolls back completed stages in reverse order and records progress in context', async () => {
    const compensation = new WorkflowCompensation();

    await compensation.rollbackExecution('exec-1');
    await compensation.rollbackExecution('exec-1');

    expect(supabaseClient.tables.workflow_events).toHaveLength(4);
    expect(supabaseClient.tables.value_commits[0].status).toBe('cancelled');
    expect(supabaseClient.tables.target_artifacts[0].status).toBe('draft');
    expect(supabaseClient.tables.opportunity_artifacts).toHaveLength(0);

    const execution = supabaseClient.tables.workflow_executions[0];
    expect(execution.status).toBe('rolled_back');
    expect(execution.context.rollback_state.status).toBe('completed');
    expect(execution.context.rollback_state.completed_steps).toEqual([
      'target_value_commit',
      'opportunity_discovery'
    ]);
  });

  it('honors halt_on_error policy when a compensator fails', async () => {
    supabaseClient.tables.workflow_executions[0].context.compensation_policy = 'halt_on_error';

    const compensation = new WorkflowCompensation();
    const handlers = (compensation as any).handlers as Map<string, any>;
    handlers.set('opportunity', vi.fn().mockRejectedValue(new Error('compensator failed')));
    handlers.set('target', vi.fn());

    await compensation.rollbackExecution('exec-1');

    expect(handlers.get('target')).toHaveBeenCalled();
    expect(handlers.get('opportunity')).toHaveBeenCalled();

    const execution = supabaseClient.tables.workflow_executions[0];
    expect(execution.status).toBe('failed');
    expect(execution.context.rollback_state.status).toBe('failed');
    expect(execution.context.rollback_state.completed_steps).toEqual(['target_value_commit']);
    expect(execution.context.rollback_state.failed_stage).toBe('opportunity_discovery');
    expect(supabaseClient.tables.workflow_events.at(-1).metadata.rollback_event).toBe('stage_compensation_failed');
  });
});
