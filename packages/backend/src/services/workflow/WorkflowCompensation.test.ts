import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoltClientMock } from '../utils/mockSupabaseClient.js'
import { WorkflowCompensation } from './WorkflowCompensation.js'

let supabaseClient: ReturnType<typeof createBoltClientMock> = createBoltClientMock();

vi.mock('../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  get supabase() {
    return supabaseClient;
  }
}));

describe('WorkflowCompensation payload guards', () => {
  beforeEach(() => {
    supabaseClient = createBoltClientMock();
  });

  it('fails closed when execution.context is malformed', async () => {
    supabaseClient = createBoltClientMock({
      workflow_executions: [
        {
          id: 'exec-malformed-context',
          status: 'failed',
          context: 'unexpected-context-shape'
        }
      ],
      workflow_execution_logs: [
        {
          id: 'log-1',
          execution_id: 'exec-malformed-context',
          stage_id: 'opportunity_discovery',
          status: 'completed',
          output_data: { artifacts_created: ['opp-artifact'] },
          completed_at: '2024-01-01T00:00:00Z'
        }
      ],
      workflow_events: [],
      opportunity_artifacts: [{ id: 'opp-artifact' }]
    });

    const compensation = new WorkflowCompensation();

    await compensation.rollbackExecution('exec-malformed-context');

    expect(supabaseClient.tables.workflow_events).toHaveLength(0);
    expect(supabaseClient.tables.opportunity_artifacts).toEqual([{ id: 'opp-artifact' }]);
    expect(supabaseClient.tables.workflow_executions[0].status).toBe('failed');
  });

  it('fails closed when log.output_data is malformed', async () => {
    supabaseClient = createBoltClientMock({
      workflow_executions: [
        {
          id: 'exec-malformed-log',
          status: 'failed',
          context: {
            executed_steps: [
              { stage_id: 'opportunity_discovery', stage_type: 'opportunity', compensator: 'opportunity' }
            ],
            compensation_policy: 'continue_on_error'
          }
        }
      ],
      workflow_execution_logs: [
        {
          id: 'log-1',
          execution_id: 'exec-malformed-log',
          stage_id: 'opportunity_discovery',
          status: 'completed',
          output_data: 'unexpected-log-shape',
          completed_at: '2024-01-01T00:00:00Z'
        }
      ],
      workflow_events: [],
      opportunity_artifacts: [{ id: 'opp-artifact' }]
    });

    const compensation = new WorkflowCompensation();

    await compensation.rollbackExecution('exec-malformed-log');

    expect(supabaseClient.tables.opportunity_artifacts).toEqual([{ id: 'opp-artifact' }]);
    expect(supabaseClient.tables.workflow_events.map(event => event.metadata.rollback_event)).toEqual([
      'started',
      'completed'
    ]);
    expect(supabaseClient.tables.workflow_executions[0].context.rollback_state).toEqual({
      status: 'completed',
      completed_steps: []
    });
  });
});
