import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedAgentOrchestrator } from '../UnifiedAgentOrchestrator';

// Mock supabase client used by the orchestrator
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (table: string) => {
        if (table === 'workflow_definitions') {
          return {
            select: () => ({
              eq: (_k: string, _v: any) => ({
                eq: (_k2: string, _v2: any) => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === 'workflow_executions') {
          return {
            insert: (_payload: any) => ({
              select: () => ({ single: async () => ({ data: { id: 'exec-1' }, error: null }) }),
            }),
          };
        }

        return {
          select: () => ({ eq: () => ({}) }),
        };
      },
    },
  };
});

describe('UnifiedAgentOrchestrator.executeWorkflow', () => {
  it('throws when workflow definition not found', async () => {
    const orchestrator = new UnifiedAgentOrchestrator();

    await expect(orchestrator.executeWorkflow('non-existent-workflow', {}, 'user-1')).rejects.toThrow();
  });

  it('creates execution record and returns executionId when definition exists', async () => {
    // Re-mock supabase to return a definition
    const mockDef = { id: 'wf-123', name: 'Test WF', version: '1.0', dag_schema: { initial_stage: 'opportunity', stages: [], final_stages: [] } };

    const supabaseModule = await import('../../lib/supabase');
    (supabaseModule.supabase.from as any) = (table: string) => {
      if (table === 'workflow_definitions') {
        return {
          select: () => ({
            eq: (_k: string, _v: any) => ({
              eq: (_k2: string, _v2: any) => ({
                maybeSingle: async () => ({ data: mockDef, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === 'workflow_executions') {
        return {
          insert: (_payload: any) => ({
            select: () => ({ single: async () => ({ data: { id: 'exec-42' }, error: null }) }),
          }),
        };
      }

      return { select: () => ({}) };
    };

    const orchestrator = new UnifiedAgentOrchestrator();
    // Spy on executeDAGAsync so it doesn't throw while running in test
    const spy = vi.spyOn(orchestrator as any, 'executeDAGAsync').mockImplementation(async () => Promise.resolve());

    const result = await orchestrator.executeWorkflow('wf-123', { foo: 'bar' }, 'user-1');

    expect(result.executionId).toBe('exec-42');
    expect(result.status).toBe('initiated');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
