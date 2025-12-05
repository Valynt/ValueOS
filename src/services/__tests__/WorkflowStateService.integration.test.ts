import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowStateService } from '../WorkflowStateService';

// In-memory stub for agent_sessions table
const sessionStore: Record<string, any> = {};

const supabaseStub = {
  from: vi.fn((table: string) => {
    if (table !== 'agent_sessions') {
      throw new Error(`Unexpected table ${table}`);
    }

    return {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn((payload: any) => {
        const id = `sess-${Object.keys(sessionStore).length + 1}`;
        sessionStore[id] = {
          id,
          ...payload,
          workflow_state: payload.workflow_state,
          status: payload.status,
          created_at: payload.created_at || new Date().toISOString(),
          updated_at: payload.updated_at || new Date().toISOString(),
        };
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id }, error: null }),
        };
      }),
      update: vi.fn((payload: any) => ({
        eq: vi.fn((_, id: string) => {
          if (sessionStore[id]) {
            sessionStore[id] = {
              ...sessionStore[id],
              ...payload,
              workflow_state: payload.workflow_state ?? sessionStore[id].workflow_state,
              updated_at: payload.updated_at || new Date().toISOString(),
            };
          }
          return { error: null };
        }),
      })),
      delete: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: string) => {
        const rows = Object.values(sessionStore).filter((row: any) => row[field] === value);
        return {
          single: vi.fn().mockResolvedValue({ data: rows[0] || null, error: rows[0] ? null : { message: 'not found' } }),
          select: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    };
  }),
};

describe('WorkflowStateService (integration-ish)', () => {
  beforeEach(() => {
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k]);
  });

  it('creates session and saves/reads state round-trip', async () => {
    const service = new WorkflowStateService(supabaseStub as any);

    const { sessionId, state } = await service.loadOrCreateSession({
      caseId: 'case-1',
      userId: 'user-1',
      initialStage: 'opportunity',
      context: { company: 'Acme' },
    });

    expect(sessionId).toBeDefined();
    expect(state.context.caseId).toBe('case-1');

    const updated = { ...state, currentStage: 'target', completedStages: ['opportunity'] };
    await service.saveWorkflowState(sessionId, updated);

    const fetched = await service.getWorkflowState(sessionId);
    expect(fetched?.currentStage).toBe('target');
    expect(fetched?.completedStages).toContain('opportunity');
  });
});
