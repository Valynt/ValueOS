import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedAgentOrchestrator } from '../UnifiedAgentOrchestrator';

const envelope = {
  intent: 'unit-test',
  actor: { id: 'user-1' },
  organizationId: 'org-1',
  entryPoint: 'unit-test',
  reason: 'test-execution',
  timestamps: { requestedAt: new Date().toISOString() },
};

// Mock supabase client used by the orchestrator
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'workflow_definitions') {
          return {
            select: () => ({
              eq: (_k: string, _v: unknown) => ({
                eq: (_k2: string, _v2: unknown) => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === 'workflow_executions') {
          return {
            insert: (_payload: unknown) => ({
              select: () => ({ single: async () => ({ data: { id: 'exec-1' }, error: null }) }),
            }),
          };
        }

        return {
          insert: () => Promise.resolve({ data: null, error: null }),
          select: () => ({ eq: () => ({}) }),
        };
      },
    },
  };
});

describe('UnifiedAgentOrchestrator.executeWorkflow', () => {
  it('throws when workflow definition not found', async () => {
    const orchestrator = new UnifiedAgentOrchestrator();

    await expect(orchestrator.executeWorkflow(envelope, 'non-existent-workflow', {}, 'user-1')).rejects.toThrow();
  });

  it('creates execution record and returns executionId when definition exists', async () => {
    // Re-mock supabase to return a definition
    const mockDef = {
      id: 'wf-123',
      name: 'Test WF',
      version: '1.0',
      dag_schema: {
        initial_stage: 'opportunity',
        stages: [
          {
            id: 'opportunity',
            agent_type: 'opportunity',
            name: 'Opportunity',
            retry_config: { max_attempts: 1, initial_delay_ms: 0, max_delay_ms: 0, multiplier: 1, jitter: false },
          },
        ],
        transitions: [],
        final_stages: ['opportunity'],
      },
    };

    const supabaseModule = await import('../../lib/supabase');
    (supabaseModule.supabase.from as any) = (table: string) => {
      if (table === 'workflow_definitions') {
        return {
          select: () => ({
            eq: (_k: string, _v: unknown) => ({
              eq: (_k2: string, _v2: unknown) => ({
                maybeSingle: async () => ({ data: mockDef, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === 'workflow_executions') {
        return {
          insert: (_payload: unknown) => ({
            select: () => ({ single: async () => ({ data: { id: 'exec-42' }, error: null }) }),
          }),
        };
      }

      return { insert: vi.fn(), select: () => ({}) };
    };

    const orchestrator = new UnifiedAgentOrchestrator();
    // Spy on executeDAGAsync so it doesn't throw while running in test
    const spy = vi.spyOn(orchestrator as any, 'executeDAGAsync').mockImplementation(async () => Promise.resolve());

    const result = await orchestrator.executeWorkflow(envelope, 'wf-123', { foo: 'bar' }, 'user-1');

    expect(result.executionId).toBe('exec-42');
    expect(result.status).toBe('initiated');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
