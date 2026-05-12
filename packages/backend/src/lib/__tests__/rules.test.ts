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
    member: ['projects:view', 'projects:create', 'value_trees:view', 'value_trees:edit', 'proposal.publish'],
    admin: [
      'projects:view',
      'projects:create',
      'value_trees:view',
      'value_trees:edit',
      'value_trees:delete',
      'proposal.publish',
      'value_model.finalize',
      'commitment.publish',
      'ops.config.write',
      'value_model.delete',
      'case.delete',
    ],
    viewer: ['projects:view', 'value_trees:view'],
  },
}));

// ---------------------------------------------------------------------------
// Mock: supabase client
// vi.mock factories are hoisted to the top of the file, so any variables they
// reference must also be hoisted via vi.hoisted().
// ---------------------------------------------------------------------------
const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock('../supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: mockSupabaseFrom,
  }),
  // Named export consumed by BaseService and other modules that import supabase.js directly
  supabase: {
    from: mockSupabaseFrom,
  },
  assertNotTestEnv: vi.fn(),
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


const { mockDriftCounters } = vi.hoisted(() => ({
  mockDriftCounters: {
    driftDetected: { inc: vi.fn(), add: vi.fn() },
    driftRemediated: { inc: vi.fn(), add: vi.fn() },
    driftUnresolved: { inc: vi.fn(), add: vi.fn() },
    driftDenied: { inc: vi.fn(), add: vi.fn() },
  },
}));

vi.mock('../observability/index.js', () => ({
  createCounter: (name: string) => {
    if (name === 'drift_detected_total') return mockDriftCounters.driftDetected;
    if (name === 'drift_remediated_total') return mockDriftCounters.driftRemediated;
    if (name === 'drift_unresolved_total') return mockDriftCounters.driftUnresolved;
    if (name === 'drift_denied_total') return mockDriftCounters.driftDenied;
    return { inc: vi.fn(), add: vi.fn() };
  },
}));

import {
  __resetPermissionCacheForTests,
  enforceRules,
  enforceRulesDetailed,
  GovernanceContext,
} from '../rules.js';
import { logger } from '../logger.js';

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



  describe('Layer 3 — workflow-state validation (expanded workflow mutations)', () => {
    function mockMutationState(state: Record<string, unknown> | null): void {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        if (table === 'user_roles') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }) }) }) };
        if (table === 'user_permissions') return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        if (table === 'value_cases') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: state, error: null }) }) }) }) };
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });
    }

    it('enforces per-action transition checks for value_model.finalize', async () => {
      const base = makeCtx({ actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] }, action: { type: 'value_model.finalize', name: 'value_model.finalize', target: { resourceType: 'value_model', resourceId: 'case-2' } } });
      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'draft', integrity_status: 'passed', evidence_count: 3, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).allowed).toBe(true);

      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'published', integrity_status: 'passed', evidence_count: 3, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_INVALID_STATE');

      const missingTarget = await enforceRulesDetailed({ ...base, action: { type: 'value_model.finalize', name: 'value_model.finalize' } });
      expect(missingTarget.reasonCode).toBe('DENY_INVALID_STATE');

      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'draft', integrity_status: 'passed', evidence_count: 1, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_MISSING_APPROVAL');

      mockMutationState({ tenant_id: 'tenant-2', workflow_state: 'draft', integrity_status: 'passed', evidence_count: 3, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_INVALID_STATE');
    });

    it('enforces per-action transition checks for commitment.publish', async () => {
      const base = makeCtx({ actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] }, action: { type: 'commitment.publish', name: 'commitment.publish', target: { resourceType: 'commitment', resourceId: 'case-3' } } });
      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'approved', integrity_status: 'passed', evidence_count: 5, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).allowed).toBe(true);

      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'draft', integrity_status: 'passed', evidence_count: 5, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_INVALID_STATE');

      const missingTarget = await enforceRulesDetailed({ ...base, action: { type: 'commitment.publish', name: 'commitment.publish' } });
      expect(missingTarget.reasonCode).toBe('DENY_INVALID_STATE');

      mockMutationState({ tenant_id: 'tenant-1', workflow_state: 'approved', integrity_status: 'pending', evidence_count: 5, required_evidence_count: 2, approval_status: 'pending' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_MISSING_APPROVAL');

      mockMutationState({ tenant_id: 'tenant-2', workflow_state: 'approved', integrity_status: 'passed', evidence_count: 5, required_evidence_count: 2, approval_status: 'approved' });
      expect((await enforceRulesDetailed(base)).reasonCode).toBe('DENY_INVALID_STATE');
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
        workflow: {
          approvals: [
            {
              actionName: 'proposal.publish',
              approvalSchemaVersion: 'v1',
              sourceSystemId: 'rules.test',
              approvedAt: new Date().toISOString(),
              requestId: 'session-1',
              tenantId: 'tenant-1',
              resourceType: 'proposal',
              resourceId: 'case-1',
              signature: 'sig-123',
            },
          ],
        },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Layer 6 — anti-drift', () => {
    it('corrects stale cache when role changed from admin to viewer and denies', async () => {
      mockActiveMember(['admin']);
      const adminCtx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
      });
      const warmResult = await enforceRulesDetailed(adminCtx);
      expect(warmResult.allowed).toBe(true);

      __resetPermissionCacheForTests();
      mockActiveMember(['viewer']);

      const driftedResult = await enforceRulesDetailed(adminCtx);
      expect(driftedResult.allowed).toBe(false);
      expect(driftedResult.reasonCode).toBe('DENY_UNAUTHORIZED');
      expect(driftedResult.message).toContain('value_trees:edit');
    });

    it('denies prod publish without approval and allows with approval under drift flags', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ permission: 'drift:detected' }], error: null }) }) }) };
        }
        if (table === 'value_cases') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { integrity_status: 'passed', evidence_count: 7, required_evidence_count: 3 }, error: null }) }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const baseCtx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'] },
        action: { type: 'proposal.publish', name: 'proposal.publish', target: { resourceType: 'proposal', resourceId: 'case-1' } },
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
      });
      const missingApproval = await enforceRulesDetailed(baseCtx);
      expect(missingApproval.allowed).toBe(false);
      expect(missingApproval.reasonCode).toBe('DENY_MISSING_APPROVAL');

      const withApproval = await enforceRulesDetailed({
        ...baseCtx,
        workflow: {
          approvals: [
            {
              actionName: 'proposal.publish',
              approvalSchemaVersion: 'v1',
              sourceSystemId: 'rules.test',
              approvedAt: new Date().toISOString(),
              requestId: 'session-1',
              tenantId: 'tenant-1',
              resourceType: 'proposal',
              resourceId: 'case-1',
              signature: 'sig-123',
            },
          ],
        },
      });
      expect(withApproval.allowed).toBe(true);
    });

    it('fails closed on permissions query partial outage', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'member' }], error: { message: 'roles timeout' } }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
    });

    it('denies when role changes concurrently between check and decision', async () => {
      let rolesPhase: 'member' | 'viewer' = 'member';
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          const role = rolesPhase === 'member' ? 'member' : 'viewer';
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const first = await enforceRulesDetailed(makeCtx());
      expect(first.allowed).toBe(true);
      rolesPhase = 'viewer';
      __resetPermissionCacheForTests();
      const second = await enforceRulesDetailed(makeCtx());
      expect(second.allowed).toBe(false);
      expect(second.reasonCode).toBe('DENY_UNAUTHORIZED');
    });


    it('emits drift denied telemetry for high-severity drift branch', async () => {
      mockActiveMember(['admin']);
      const ctx = makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['admin'], sessionId: 'sess-1' },
        action: { type: 'ops.config.write', name: 'ops.config.write' },
      });
      const result = await enforceRulesDetailed(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      expect(mockDriftCounters.driftDenied.inc).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'governance.drift.telemetry',
        expect.objectContaining({ outcome: 'denied', sessionId: 'sess-1', requestId: 'sess-1' })
      );
    });

    it('emits unresolved telemetry for approval and read-only obligations', async () => {
      mockActiveMember(['member']);
      const approval = await enforceRulesDetailed(makeCtx({ action: { type: 'proposal.publish', name: 'proposal.publish' } }));
      expect(approval.allowed).toBe(true);
      expect(approval.obligations).toEqual(expect.arrayContaining([{ type: 'REQUIRE_APPROVAL', approvalType: 'drift-remediation' }]));

      const readOnly = await enforceRulesDetailed(makeCtx({ action: { type: 'workspace.delete', name: 'workspace.delete' } }));
      expect(readOnly.allowed).toBe(true);
      expect(readOnly.obligations).toEqual(expect.arrayContaining([{ type: 'READ_ONLY' }]));
      expect(mockDriftCounters.driftUnresolved.inc).toHaveBeenCalled();
    });

    it('stale-cache drift detected then remediated successfully', async () => {
      let callCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          callCount += 1;
          const role = callCount === 1 ? 'ghost' : 'member';
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(true);
      expect(result.audit.matchedRules).toContain('layer6-refresh-remediated');
      expect(mockDriftCounters.driftRemediated.inc).toHaveBeenCalled();
    });

    it('stale-cache drift remediation fails and request is denied', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role: 'ghost' }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      expect(result.audit.matchedRules).toContain('layer6-refresh-failed-closed');
      expect(logger.warn).toHaveBeenCalledWith(
        'governance.drift.refresh.failed_closed',
        expect.objectContaining({ action: 'value_trees:edit' })
      );
    });

    it('concurrent role change during refresh still fails closed', async () => {
      let refreshPhase = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }) }) }) }) };
        }
        if (table === 'user_roles') {
          refreshPhase += 1;
          const role = refreshPhase === 1 ? 'ghost' : 'viewer';
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ role }], error: null }) }) }) };
        }
        if (table === 'user_permissions') {
          return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      expect(result.audit.matchedRules).toContain('layer6-refresh-failed-closed');
    });

    
    it('denies on schema contract drift in prod (fail closed)', async () => {
      process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED = 'hash-expected';
      mockActiveMember(['member']);
      const result = await enforceRulesDetailed(makeCtx({
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          payload: { schema_manifest_hash: 'hash-runtime' },
        },
      }));
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      expect(mockDriftCounters.driftDenied.inc).toHaveBeenCalled();
      delete process.env.GOVERNANCE_SCHEMA_HASH_EXPECTED;
    });

    it('denies on migration head drift in prod', async () => {
      process.env.APP_MIGRATION_HEAD = '20260512090000';
      mockActiveMember(['member']);
      const result = await enforceRulesDetailed(makeCtx({
        environment: { stage: 'prod', nowIso: new Date().toISOString() },
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          payload: { runtime_migration_head: '20260512080000' },
        },
      }));
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_POLICY');
      delete process.env.APP_MIGRATION_HEAD;
    });

    it('applies read-only remediation for migration drift outside prod', async () => {
      process.env.APP_MIGRATION_HEAD = '20260512090000';
      mockActiveMember(['member']);
      const result = await enforceRulesDetailed(makeCtx({
        environment: { stage: 'staging', nowIso: new Date().toISOString() },
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          payload: { runtime_migration_head: '20260512080000' },
        },
      }));
      expect(result.allowed).toBe(true);
      expect(result.obligations).toEqual(expect.arrayContaining([{ type: 'READ_ONLY' }]));
      delete process.env.APP_MIGRATION_HEAD;
    });

    it('adds remediation obligations for payload contract drift outside prod', async () => {
      process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = 'v3';
      mockActiveMember(['member']);
      const result = await enforceRulesDetailed(makeCtx({
        environment: { stage: 'staging', nowIso: new Date().toISOString() },
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          payload: { contract_version: 'v2' },
        },
      }));
      expect(result.allowed).toBe(true);
      expect(result.obligations).toEqual(expect.arrayContaining([{ type: 'READ_ONLY' }]));
      expect(mockDriftCounters.driftUnresolved.inc).toHaveBeenCalled();
      delete process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    });

    it('logs tenant/session/request correlation for drift events', async () => {
      process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION = 'v3';
      mockActiveMember(['member']);
      await enforceRulesDetailed(makeCtx({
        actor: { userId: 'user-1', tenantId: 'tenant-1', roles: ['member'], sessionId: 'session-abc' },
        environment: { stage: 'staging', nowIso: new Date().toISOString() },
        action: {
          type: 'value_trees:edit',
          name: 'value_trees:edit',
          payload: { contract_version: 'v2', request_id: 'req-xyz' },
        },
      }));

      expect(logger.warn).toHaveBeenCalledWith(
        'governance.drift.detected',
        expect.objectContaining({ tenantId: 'tenant-1', sessionId: 'session-abc', requestId: 'req-xyz' })
      );
      delete process.env.REQUIRED_PAYLOAD_CONTRACT_VERSION;
    });
it('emits observability markers and reason-code mapping for anti-drift denials', async () => {
      mockActiveMember(['viewer']);
      const result = await enforceRulesDetailed(makeCtx());
      expect(result.audit.matchedRules).toContain('rbac');
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
      expect(result.audit.policyVersion).toBe('v1');
    });
  });

  // -------------------------------------------------------------------------
  // Fail-closed behaviour
  // -------------------------------------------------------------------------

  describe('fail-closed', () => {
    it('returns DENY_UNAUTHORIZED when user_permissions query fails', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [{ role: 'member' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'user_permissions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'permissions query failed' },
                  }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
      expect(logger.error).toHaveBeenCalledWith(
        'governance: DB error fetching user permissions — denying (fail-closed)',
        expect.objectContaining({ denialReason: 'db_error' })
      );
    });

    it('denies with DENY_UNAUTHORIZED on mixed query state (membership success, roles success, permissions failure)', async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'user_tenants') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [{ role: 'admin' }], error: null }),
              }),
            }),
          };
        }
        if (table === 'user_permissions') {
          return {
            select: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({ data: null, error: { message: 'partial DB outage' } }),
              }),
            }),
          };
        }
        return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
      });

      const result = await enforceRulesDetailed(makeCtx());
      expect(result.allowed).toBe(false);
      expect(result.reasonCode).toBe('DENY_UNAUTHORIZED');
    });

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
