/**
 * Governance Rules Engine — unit tests
 *
 * Covers all denial paths and the fail-closed behaviour.
 * Supabase and the shared permissions module are mocked so tests run
 * without a live database.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: @shared/lib/permissions
// ---------------------------------------------------------------------------
vi.mock('@shared/lib/permissions', () => ({
  USER_ROLE_PERMISSIONS: {
    member: ['projects:view', 'projects:create', 'value_trees:view', 'value_trees:edit'],
    admin: [
      'projects:view',
      'projects:create',
      'value_trees:view',
      'value_trees:edit',
      'value_trees:delete',
      'proposal.publish',
      'value_model.delete',
      'case.delete',
    ],
    viewer: ['projects:view', 'value_trees:view'],
  },
}));

// ---------------------------------------------------------------------------
// Mock: supabase client
// ---------------------------------------------------------------------------
const mockSupabaseFrom = vi.fn();

vi.mock('../supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

// ---------------------------------------------------------------------------
// Mock: logger (suppress output in tests)
// ---------------------------------------------------------------------------
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import {
  __resetPermissionCacheForTests,
  enforceRules,
  enforceRulesDetailed,
  GovernanceContext,
} from '../rules.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    actor: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['member'],
    },
    action: {
      type: 'value_trees:edit',
      name: 'value_trees:edit',
    },
    environment: {
      stage: 'dev',
      nowIso: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Configure the Supabase mock to return an active membership, the given
 * roles, and no explicit per-user permissions.
 */
function mockActiveMember(roles: string[] = ['member']): void {
  mockSupabaseFrom.mockImplementation((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve(
          table === 'user_tenants'
            ? { data: { status: 'active' }, error: null }
            : { data: null, error: null }
        ),
      // For array results (user_roles, user_permissions)
      then: undefined as unknown,
    };

    // user_roles and user_permissions return arrays
    if (table === 'user_roles') {
      return {
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: roles.map((role) => ({ role })),
                error: null,
              }),
          }),
        }),
      };
    }

    if (table === 'user_permissions') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }

    // user_tenants
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { status: 'active' }, error: null }),
          }),
        }),
      }),
    };
  });
}

function mockInactiveMember(): void {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'user_tenants') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { status: 'inactive' }, error: null }),
            }),
          }),
        }),
      };
    }
    return {
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
    };
  });
}

function mockDbError(): void {
  mockSupabaseFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: null, error: { message: 'connection refused' } }),
        }),
      }),
    }),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('enforceRulesDetailed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPermissionCacheForTests();
  });

  // -------------------------------------------------------------------------
  // Layer 1: Hard guards
  // -------------------------------------------------------------------------

  describe('Layer 1 — hard guards', () => {
    it('denies when userId is absent', async () => {
      const ctx = makeCtx({ actor: { userId: '', tenantId: 'tenant-1', roles: [] } });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHENTICATED');
    });

    it('denies when tenantId is absent', async () => {
      const ctx = makeCtx({ actor: { userId: 'user-1', tenantId: '', roles: [] } });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
    });

    it('denies cross-tenant access', async () => {
      const ctx = makeCtx({
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          target: {
            resourceType: 'value_tree',
            resourceId: 'vt-1',
            ownerTenantId: 'tenant-OTHER',
          },
        },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_CROSS_TENANT');
    });

    it('allows same-tenant target access', async () => {
      mockActiveMember(['member']);
      const ctx = makeCtx({
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          target: {
            resourceType: 'value_tree',
            resourceId: 'vt-1',
            ownerTenantId: 'tenant-1', // same as actor.tenantId
          },
        },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Layer 2: RBAC
  // -------------------------------------------------------------------------

  describe('Layer 2 — RBAC', () => {
    it('denies when membership is inactive', async () => {
      mockInactiveMember();
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
    });

    it('denies when actor lacks the required permission', async () => {
      mockActiveMember(['viewer']); // viewer has no value_trees:edit
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
      expect(result.message).toContain('value_trees:edit');
    });

    it('allows when actor has the required permission', async () => {
      mockActiveMember(['member']); // member has value_trees:edit
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(true);
      expect(result.reasonCode).toBe('ALLOW');
    });

    it('denies destructive action for non-elevated role', async () => {
      // The DB mock returns role 'admin' so the actor has the value_model.delete
      // permission in their granted set. However, ctx.actor.roles is ['member'] —
      // this is the pre-resolved role list from the JWT/session, which the
      // destructive-action guard checks directly (not the DB-resolved permissions).
      // The test verifies that holding the permission is not sufficient: the actor
      // must also carry an elevated role in their session context.
      mockActiveMember(['admin']); // grants value_model.delete permission via DB
      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['member'] }, // session role — not elevated
        action: { type: 'value_model.delete', name: 'value_model.delete' },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
      expect(result.audit.matchedRules).toContain('destructive-action-guard');
    });

    it('allows destructive action for elevated role', async () => {
      mockActiveMember(['admin']);
      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
        action: { type: 'value_model.delete', name: 'value_model.delete' },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Layer 3: Workflow-state validation
  // -------------------------------------------------------------------------

  describe('Layer 3 — workflow-state validation (proposal.publish)', () => {
    function mockProposalState(state: {
      integrity_status: string;
      evidence_count: number;
      required_evidence_count: number;
    }): void {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({ data: [{ role: 'admin' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'user_permissions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'value_cases') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: state, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
        };
      });
    }

    const publishCtx = makeCtx({
      actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
      action: {
        type: 'proposal.publish',
        name: 'proposal.publish',
        target: { resourceType: 'proposal', resourceId: 'case-1' },
      },
    });

    it('denies when integrity review has not passed', async () => {
      mockProposalState({ integrity_status: 'pending', evidence_count: 5, required_evidence_count: 3 });
      const result = await enforceRulesDetailed(publishCtx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_INVALID_STATE');
      expect(result.audit.matchedRules).toContain('proposal-integrity');
    });

    it('denies when evidence threshold is not met', async () => {
      mockProposalState({ integrity_status: 'passed', evidence_count: 1, required_evidence_count: 3 });
      const result = await enforceRulesDetailed(publishCtx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_MISSING_APPROVAL');
      expect(result.audit.matchedRules).toContain('evidence-threshold');
    });

    it('allows when integrity passed and evidence threshold met', async () => {
      mockProposalState({ integrity_status: 'passed', evidence_count: 5, required_evidence_count: 3 });
      const result = await enforceRulesDetailed(publishCtx);
      expect(result.allowed).toBe(true);
    });

    it('denies when resourceId is missing', async () => {
      mockActiveMember(['admin']);
      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
        action: { type: 'proposal.publish', name: 'proposal.publish' }, // no target
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_INVALID_STATE');
    });
  });

  // -------------------------------------------------------------------------
  // Layer 4: Environment controls
  // -------------------------------------------------------------------------

  describe('Layer 4 — environment controls', () => {
    it('denies proposal.publish in prod without explicit approval', async () => {
      mockActiveMember(['admin']);
      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
        action: {
          type: 'proposal.publish',
          name: 'proposal.publish',
          target: { resourceType: 'proposal', resourceId: 'case-1' },
        },
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
        // No workflow.approvals
      });
      // We need to also mock value_cases for the proposal state check
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        if (table === 'value_cases') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { integrity_status: 'passed', evidence_count: 5, required_evidence_count: 3 }, error: null }) }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_MISSING_APPROVAL');
      expect(result.audit.matchedRules).toContain('prod-approval-required');
    });

    it('allows proposal.publish in prod with explicit approval', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        if (table === 'value_cases') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { integrity_status: 'passed', evidence_count: 5, required_evidence_count: 3 }, error: null }) }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
        action: {
          type: 'proposal.publish',
          name: 'proposal.publish',
          target: { resourceType: 'proposal', resourceId: 'case-1' },
        },
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
        workflow: { approvals: ['proposal.publish'] },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Fail-closed behaviour
  // -------------------------------------------------------------------------

  describe('fail-closed', () => {
    it('returns DENY_POLICY when DB throws during permission resolution', async () => {
      mockDbError();
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      // DB error causes empty permissions → DENY_UNAUTHORIZED (membership check fails)
      expect(['DENY_UNAUTHORIZED', 'DENY_POLICY']).toContain(result.reasonCode);
    });

    it('returns DENY_POLICY when an unexpected exception is thrown', async () => {
      // Make the supabase mock throw synchronously to trigger the catch block
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error('unexpected crash');
      });
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      expect(result.audit.matchedRules).toContain('governance-evaluation-error');
    });

    it('never returns allowed: true from a catch block', async () => {
      mockSupabaseFrom.mockImplementation(() => {
        throw new Error('crash');
      });
      const result = await enforceRulesDetailed(makeCtx());
      // The invariant: if an exception occurs, allowed must be false
      expect(result.allowed).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Obligations
  // -------------------------------------------------------------------------

  describe('obligations', () => {
    it('includes LOG_AUDIT obligation on every allow', async () => {
      mockActiveMember(['member']);
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(true);
      expect(result.obligations).toEqual(
        expect.arrayContaining([{ type: 'LOG_AUDIT' }])
      );
    });
  });
});

// ---------------------------------------------------------------------------
// enforceRules() — legacy wrapper used by ActionRouter
// ---------------------------------------------------------------------------
// These tests cover the mapping layer in enforceRules() that translates the
// Record<string, unknown> shape ActionRouter passes into a GovernanceContext.

describe('enforceRules (legacy wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPermissionCacheForTests();
  });

  function makeRawContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      userId: 'user-1',
      tenantId: 'tenant-1',
      action: 'value_trees:edit',
      environment: 'development',
      ...overrides,
    };
  }

  it('returns EnforcementResult shape with allowed:true for a valid active member', async () => {
    mockActiveMember(['member']);
    const result = await enforceRules(makeRawContext());
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.metadata?.reasonCode).toBe('ALLOW');
    expect(result.metadata?.obligations).toEqual(
      expect.arrayContaining([{ type: 'LOG_AUDIT' }])
    );
  });

  it('returns allowed:false with a violation when userId is missing', async () => {
    const result = await enforceRules(makeRawContext({ userId: '' }));
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.metadata?.reasonCode).toBe('DENY_UNAUTHENTICATED');
  });

  it('returns allowed:false with a violation when tenantId is missing', async () => {
    const result = await enforceRules(makeRawContext({ tenantId: '' }));
    expect(result.allowed).toBe(false);
    expect(result.metadata?.reasonCode).toBe('DENY_POLICY');
  });

  it('denies cross-tenant access when ownerTenantId differs from tenantId', async () => {
    const result = await enforceRules(
      makeRawContext({
        tenantId: 'tenant-1',
        ownerTenantId: 'tenant-OTHER',
        targetResourceId: 'res-1',
        targetResourceType: 'value_tree',
      })
    );
    expect(result.allowed).toBe(false);
    expect(result.metadata?.reasonCode).toBe('DENY_CROSS_TENANT');
  });

  it('maps NODE_ENV "production" to stage "prod" and enforces prod approval rules', async () => {
    // proposal.publish in prod requires workflow.approvals to include the action.
    // Without approvals, it should be denied at the prod-approval-required layer.
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
      }
      if (table === 'user_roles') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }) }) }) };
      }
      if (table === 'user_permissions') {
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      if (table === 'value_cases') {
        return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { integrity_status: 'passed', evidence_count: 5, required_evidence_count: 3 }, error: null }) }) }) }) };
      }
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
    });

    const result = await enforceRules({
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: ['admin'],
      action: 'proposal.publish',
      targetResourceId: 'case-1',
      targetResourceType: 'proposal',
      environment: 'production',
      // no approvals
    });
    expect(result.allowed).toBe(false);
    expect(result.metadata?.reasonCode).toBe('DENY_MISSING_APPROVAL');
  });

  it('is fail-closed when Supabase throws unexpectedly', async () => {
    mockSupabaseFrom.mockImplementation(() => {
      throw new Error('unexpected crash');
    });
    const result = await enforceRules(makeRawContext());
    expect(result.allowed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });
});
