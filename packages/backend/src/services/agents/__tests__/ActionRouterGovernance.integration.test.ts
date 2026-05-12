import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('../../../lib/supabase.js', () => ({
  createServerSupabaseClient: () => ({ from: mockSupabaseFrom }),
  supabase: { from: mockSupabaseFrom },
}));

vi.mock('@shared/lib/permissions', () => ({
  USER_ROLE_PERMISSIONS: {
    member: ['projects:view', 'value_trees:edit'],
    viewer: ['projects:view'],
    admin: ['projects:view', 'value_trees:edit', 'proposal.publish'],
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { checkGovernanceRules } from '../ActionRouterGovernance.js';
import { __resetPermissionCacheForTests } from '../../../lib/rules.js';

describe('ActionRouterGovernance integration — enforceRules anti-drift path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPermissionCacheForTests();
  });

  it('fails closed after role drift from member to viewer for updateValueTree', async () => {
    let role: 'member' | 'viewer' = 'member';

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
      }
      if (table === 'user_roles') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role }], error: null }) }) }) };
      }
      if (table === 'user_permissions') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
    });

    const action = { type: 'updateValueTree', payload: { nodeId: 'n1' } } as any;
    const context = {
      userId: 'user-1',
      organizationId: 'tenant-1',
      workspaceId: 'tenant-1',
      traceId: 'trace-1',
      sessionId: 's-1',
      timestamp: Date.now(),
    } as any;

    const first = await checkGovernanceRules(action, context);
    expect(first.allowed).toBe(true);

    role = 'viewer';
    __resetPermissionCacheForTests();

    const second = await checkGovernanceRules(action, context);
    expect(second.allowed).toBe(false);
    expect(second.metadata?.reasonCode).toBe('DENY_UNAUTHORIZED');
  });
});
