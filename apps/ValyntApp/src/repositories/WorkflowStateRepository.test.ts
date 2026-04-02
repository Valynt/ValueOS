import { describe, expect, it, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({ logger }));

import { WorkflowStateRepository } from './WorkflowStateRepository';

function createSupabaseMock(response: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    lt: vi.fn(() => chain),
    neq: vi.fn(() => chain),
  };

  const supabase = {
    from: vi.fn(() => chain),
  };

  return { supabase };
}

describe('WorkflowStateRepository boundary parsing', () => {
  it('returns null for malformed workflow_state payload', async () => {
    const { supabase } = createSupabaseMock({
      data: {
        workflow_state: {
          currentStage: 'stage-1',
          status: 'running',
          completedStages: [],
          context: { fn: () => 'invalid in json' },
        },
      },
      error: null,
    });

    const repo = new WorkflowStateRepository(supabase as never);

    await expect(repo.getState('session-1', 'tenant-1')).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('filters malformed sessions from active session results', async () => {
    const { supabase } = createSupabaseMock({
      data: [
        {
          id: 'session-good',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          workflow_state: {
            currentStage: 'stage-1',
            status: 'running',
            completedStages: ['stage-0'],
            context: { confidence: 0.6 },
          },
          status: 'active',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'session-bad',
          tenant_id: 'tenant-1',
          user_id: 'user-1',
          workflow_state: {
            currentStage: 'stage-2',
            status: 'unknown',
            completedStages: [],
            context: {},
          },
          status: 'active',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const repo = new WorkflowStateRepository(supabase as never);
    const sessions = await repo.getActiveSessions('user-1', 'tenant-1', 10);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.id).toBe('session-good');
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws when saving state with non-json context', async () => {
    const { supabase } = createSupabaseMock({ data: null, error: null });

    const repo = new WorkflowStateRepository(supabase as never);
    await expect(
      repo.saveState(
        'session-1',
        {
          currentStage: 'stage-1',
          status: 'running',
          completedStages: [],
          context: { invalid: () => 'not json' },
        } as unknown as Parameters<WorkflowStateRepository['saveState']>[1],
        'tenant-1'
      )
    ).rejects.toBeTruthy();
  });
});
