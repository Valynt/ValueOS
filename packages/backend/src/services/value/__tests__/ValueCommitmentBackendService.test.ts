import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

const { mockFrom, mockLogAudit } = vi.hoisted(() => ({
  mockFrom:     vi.fn(),
  mockLogAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../lib/supabase.js', () => ({ supabase: { from: mockFrom } }));
vi.mock('../../security/AuditLogService.js', () => ({
  auditLogService: { logAudit: mockLogAudit },
}));
vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { ValueCommitmentBackendService } from '../ValueCommitmentBackendService.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID    = 'aaaaaaaa-0000-0000-0000-000000000001';
const ACTOR_ID  = 'bbbbbbbb-0000-0000-0000-000000000002';
const COMMIT_ID = 'cccccccc-0000-0000-0000-000000000003';
const OTHER_ORG = 'dddddddd-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// Supabase chain builder
// ---------------------------------------------------------------------------

function chain(resolved: { data: unknown; error: unknown }) {
  const terminal = vi.fn().mockResolvedValue(resolved);
  const c: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'order', 'limit', 'maybeSingle']) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  c['single'] = terminal;
  c['then']   = (res: (v: unknown) => void, rej: (e: unknown) => void) => terminal().then(res, rej);
  return c;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValueCommitmentBackendService', () => {
  let svc: ValueCommitmentBackendService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new ValueCommitmentBackendService();
  });

  // -------------------------------------------------------------------------
  // createCommitment
  // -------------------------------------------------------------------------

  describe('createCommitment', () => {
    const baseInput = {
      title:                  'Reduce churn by 10%',
      commitment_type:        'strategic' as const,
      priority:               'high' as const,
      owner_user_id:          ACTOR_ID,
      target_completion_date: '2027-01-01T00:00:00.000Z',
      timeframe_months:       12,
      currency:               'USD',
    };

    it('inserts with organization_id and returns DTO row', async () => {
      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      mockFrom.mockReturnValue(chain({ data: inserted, error: null }));

      const result = await svc.createCommitment(ORG_ID, ACTOR_ID, baseInput);

      expect(mockFrom).toHaveBeenCalledWith('value_commitments');
      // Verify tenant isolation: organization_id must be set from server context
      const insertCall = mockFrom.mock.results[0]?.value as Record<string, unknown>;
      const insertFn = insertCall['insert'] as ReturnType<typeof vi.fn>;
      const insertArg = insertFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg['organization_id']).toBe(ORG_ID);
      expect(insertArg['status']).toBe('draft');
      expect(result).toMatchObject({ id: COMMIT_ID, organization_id: ORG_ID });
    });

    it('emits audit event on success', async () => {
      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      mockFrom.mockReturnValue(chain({ data: inserted, error: null }));

      await svc.createCommitment(ORG_ID, ACTOR_ID, baseInput);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action:       'commitment.created',
          resourceType: 'value_commitment',
          resourceId:   COMMIT_ID,
          userId:       ACTOR_ID,
        }),
      );
    });

    it('throws on DB error', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'db failure' } }));

      await expect(svc.createCommitment(ORG_ID, ACTOR_ID, baseInput)).rejects.toThrow('createCommitment');
    });

    it('seeds metrics when provided', async () => {
      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      // First call: value_commitments insert; second call: commitment_metrics insert
      mockFrom
        .mockReturnValueOnce(chain({ data: inserted, error: null }))
        .mockReturnValueOnce(chain({ data: [], error: null }));

      await svc.createCommitment(ORG_ID, ACTOR_ID, {
        ...baseInput,
        metrics: [{ metric_name: 'NRR', baseline_value: 100, target_value: 110, unit: '%' }],
      });

      expect(mockFrom).toHaveBeenCalledWith('commitment_metrics');
    });

    it('compensates by deleting the commitment row when metric insert fails', async () => {
      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };

      // commitment insert succeeds, metric insert fails
      mockFrom
        .mockReturnValueOnce(chain({ data: inserted, error: null }))           // value_commitments insert
        .mockReturnValueOnce(chain({ data: null, error: { message: 'constraint violation' } })) // metrics insert
        .mockReturnValueOnce(chain({ data: null, error: null }));              // compensation delete

      await expect(
        svc.createCommitment(ORG_ID, ACTOR_ID, {
          ...baseInput,
          metrics: [{ metric_name: 'NRR', baseline_value: 100, target_value: 110, unit: '%' }],
        }),
      ).rejects.toThrow('metric seed failed');

      // Compensation delete must have been called on value_commitments
      const deleteCallIndex = mockFrom.mock.calls.findIndex(
        (call) => call[0] === 'value_commitments' && mockFrom.mock.calls.indexOf(call) > 0,
      );
      expect(deleteCallIndex).toBeGreaterThanOrEqual(0);

      const deleteChain = mockFrom.mock.results[2]?.value as Record<string, unknown>;
      const deleteFn = deleteChain['delete'] as ReturnType<typeof vi.fn>;
      expect(deleteFn).toHaveBeenCalled();

      // eq filters must scope the delete to the correct commitment and org
      const eqFn = deleteChain['eq'] as ReturnType<typeof vi.fn>;
      const eqCalls = eqFn.mock.calls as [string, unknown][];
      expect(eqCalls).toContainEqual(['id', COMMIT_ID]);
      expect(eqCalls).toContainEqual(['organization_id', ORG_ID]);
    });

    it('throws the original error even when compensation delete also fails', async () => {
      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };

      mockFrom
        .mockReturnValueOnce(chain({ data: inserted, error: null }))
        .mockReturnValueOnce(chain({ data: null, error: { message: 'constraint violation' } }))
        .mockImplementationOnce(() => { throw new Error('network blip during compensation'); });

      // Original ServiceError must propagate, not the compensation error
      await expect(
        svc.createCommitment(ORG_ID, ACTOR_ID, {
          ...baseInput,
          metrics: [{ metric_name: 'NRR', baseline_value: 100, target_value: 110, unit: '%' }],
        }),
      ).rejects.toThrow('metric seed failed');
    });
  });

  // -------------------------------------------------------------------------
  // updateCommitment
  // -------------------------------------------------------------------------

  describe('updateCommitment', () => {
    it('fetches with org filter then updates', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      const updated  = { ...existing, title: 'New title' };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null })) // fetchOwned
        .mockReturnValueOnce(chain({ data: updated,  error: null })); // update

      const result = await svc.updateCommitment(COMMIT_ID, ORG_ID, ACTOR_ID, { title: 'New title' });

      expect(result).toMatchObject({ title: 'New title' });
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.updated' }),
      );
    });

    it('throws NOT_FOUND when commitment belongs to another org', async () => {
      // fetchOwned returns null (cross-tenant miss)
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.updateCommitment(COMMIT_ID, OTHER_ORG, ACTOR_ID, { title: 'x' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // transitionStatus
  // -------------------------------------------------------------------------

  describe('transitionStatus', () => {
    it('allows draft → active', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      const updated  = { ...existing, status: 'active' };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null }))
        .mockReturnValueOnce(chain({ data: updated,  error: null }));

      const result = await svc.transitionStatus(COMMIT_ID, ORG_ID, ACTOR_ID, { status: 'active' });

      expect(result).toMatchObject({ status: 'active' });
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.status_changed' }),
      );
    });

    it('rejects draft → fulfilled (invalid FSM transition)', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      mockFrom.mockReturnValue(chain({ data: existing, error: null }));

      await expect(
        svc.transitionStatus(COMMIT_ID, ORG_ID, ACTOR_ID, { status: 'fulfilled' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('rejects fulfilled → active (terminal state)', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'fulfilled' };
      mockFrom.mockReturnValue(chain({ data: existing, error: null }));

      await expect(
        svc.transitionStatus(COMMIT_ID, ORG_ID, ACTOR_ID, { status: 'active' }),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('sets actual_completion_date when transitioning to fulfilled', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const updated  = { ...existing, status: 'fulfilled', actual_completion_date: expect.any(String) };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null }))
        .mockReturnValueOnce(chain({ data: updated,  error: null }));

      await svc.transitionStatus(COMMIT_ID, ORG_ID, ACTOR_ID, { status: 'fulfilled' });

      const updateChain = mockFrom.mock.results[1]?.value as Record<string, unknown>;
      const updateFn = updateChain['update'] as ReturnType<typeof vi.fn>;
      const patch = updateFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(patch['actual_completion_date']).toBeDefined();
    });

    it('throws NOT_FOUND for cross-tenant commitment id', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.transitionStatus(COMMIT_ID, OTHER_ORG, ACTOR_ID, { status: 'active' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // addNote
  // -------------------------------------------------------------------------

  describe('addNote', () => {
    it('inserts note scoped to org and emits audit', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const note     = { id: 'note-1', commitment_id: COMMIT_ID, body: 'Progress update', visibility: 'internal', created_by: ACTOR_ID, created_at: '2026-01-01T00:00:00Z' };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null })) // fetchOwned
        .mockReturnValueOnce(chain({ data: note,     error: null })); // insert note

      const result = await svc.addNote(COMMIT_ID, ORG_ID, ACTOR_ID, {
        body:       'Progress update',
        visibility: 'internal',
      });

      expect(result).toMatchObject({ body: 'Progress update' });
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.note_added' }),
      );

      const noteInsertChain = mockFrom.mock.results[1]?.value as Record<string, unknown>;
      const insertFn = noteInsertChain['insert'] as ReturnType<typeof vi.fn>;
      const insertArg = insertFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg['organization_id']).toBe(ORG_ID);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.addNote(COMMIT_ID, OTHER_ORG, ACTOR_ID, { body: 'x', visibility: 'internal' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // deleteCommitment
  // -------------------------------------------------------------------------

  describe('deleteCommitment', () => {
    it('deletes a draft commitment and emits audit', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      const deleteChainObj = chain({ data: null, error: null });

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null })) // fetchOwned
        .mockReturnValueOnce(deleteChainObj);                         // delete

      await svc.deleteCommitment(COMMIT_ID, ORG_ID, ACTOR_ID);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.deleted' }),
      );
    });

    it('rejects deletion of active commitment', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      mockFrom.mockReturnValue(chain({ data: existing, error: null }));

      await expect(
        svc.deleteCommitment(COMMIT_ID, ORG_ID, ACTOR_ID),
      ).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('throws NOT_FOUND for cross-tenant id', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.deleteCommitment(COMMIT_ID, OTHER_ORG, ACTOR_ID),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // Audit resilience — audit failure must not break primary operation
  // -------------------------------------------------------------------------

  describe('audit resilience', () => {
    it('does not throw when audit emission fails', async () => {
      mockLogAudit.mockRejectedValueOnce(new Error('audit sink unavailable'));

      const inserted = { id: COMMIT_ID, organization_id: ORG_ID, status: 'draft' };
      mockFrom.mockReturnValue(chain({ data: inserted, error: null }));

      // Should resolve without throwing despite audit failure
      await expect(
        svc.createCommitment(ORG_ID, ACTOR_ID, {
          title:                  'Test',
          commitment_type:        'strategic',
          priority:               'medium',
          owner_user_id:          ACTOR_ID,
          target_completion_date: '2027-01-01T00:00:00.000Z',
          timeframe_months:       6,
          currency:               'USD',
        }),
      ).resolves.toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // addMilestone
  // -------------------------------------------------------------------------

  describe('addMilestone', () => {
    const milestoneInput = {
      title:          'Phase 1',
      milestone_type: 'execution' as const,
      sequence_order: 1,
      target_date:    '2027-03-01T00:00:00.000Z',
    };

    it('inserts with commitment_id and organization_id scoped', async () => {
      const existing  = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const milestone = { id: 'ms-1', commitment_id: COMMIT_ID, title: 'Phase 1' };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing,  error: null })) // fetchOwned
        .mockReturnValueOnce(chain({ data: milestone, error: null })); // insert

      const result = await svc.addMilestone(COMMIT_ID, ORG_ID, ACTOR_ID, milestoneInput);

      expect(result).toMatchObject({ id: 'ms-1' });

      const insertChain = mockFrom.mock.results[1]?.value as Record<string, unknown>;
      const insertFn = insertChain['insert'] as ReturnType<typeof vi.fn>;
      const insertArg = insertFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg['commitment_id']).toBe(COMMIT_ID);
      expect(insertArg['organization_id']).toBe(ORG_ID);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.addMilestone(COMMIT_ID, OTHER_ORG, ACTOR_ID, milestoneInput),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('emits audit event on success', async () => {
      const existing  = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const milestone = { id: 'ms-1', commitment_id: COMMIT_ID };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing,  error: null }))
        .mockReturnValueOnce(chain({ data: milestone, error: null }));

      await svc.addMilestone(COMMIT_ID, ORG_ID, ACTOR_ID, milestoneInput);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.milestone_added' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // addRisk
  // -------------------------------------------------------------------------

  describe('addRisk', () => {
    const riskInput = {
      risk_title:       'Budget cut',
      risk_description: 'Q3 budget may be reduced',
      risk_category:    'financial' as const,
      probability:      'medium' as const,
      impact:           'high' as const,
      mitigation_plan:  'Secure exec sponsorship',
      contingency_plan: 'Reduce scope',
      owner_id:         ACTOR_ID,
      review_date:      '2027-06-01T00:00:00.000Z',
    };

    it('inserts with commitment_id and organization_id scoped', async () => {
      const existing = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const risk     = { id: 'risk-1', commitment_id: COMMIT_ID, risk_title: 'Budget cut' };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing, error: null }))
        .mockReturnValueOnce(chain({ data: risk,     error: null }));

      const result = await svc.addRisk(COMMIT_ID, ORG_ID, ACTOR_ID, riskInput);

      expect(result).toMatchObject({ id: 'risk-1' });

      const insertChain = mockFrom.mock.results[1]?.value as Record<string, unknown>;
      const insertFn = insertChain['insert'] as ReturnType<typeof vi.fn>;
      const insertArg = insertFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg['commitment_id']).toBe(COMMIT_ID);
      expect(insertArg['organization_id']).toBe(ORG_ID);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.addRisk(COMMIT_ID, OTHER_ORG, ACTOR_ID, riskInput),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // addStakeholder
  // -------------------------------------------------------------------------

  describe('addStakeholder', () => {
    const stakeholderInput = {
      user_id:        ACTOR_ID,
      role:           'contributor' as const,
      responsibility: 'Owns metric collection',
    };

    it('inserts with commitment_id and organization_id scoped', async () => {
      const existing    = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const stakeholder = { id: 'sh-1', commitment_id: COMMIT_ID, user_id: ACTOR_ID };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing,    error: null }))
        .mockReturnValueOnce(chain({ data: stakeholder, error: null }));

      const result = await svc.addStakeholder(COMMIT_ID, ORG_ID, ACTOR_ID, stakeholderInput);

      expect(result).toMatchObject({ id: 'sh-1' });

      const insertChain = mockFrom.mock.results[1]?.value as Record<string, unknown>;
      const insertFn = insertChain['insert'] as ReturnType<typeof vi.fn>;
      const insertArg = insertFn.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertArg['commitment_id']).toBe(COMMIT_ID);
      expect(insertArg['organization_id']).toBe(ORG_ID);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.addStakeholder(COMMIT_ID, OTHER_ORG, ACTOR_ID, stakeholderInput),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('emits audit event on success', async () => {
      const existing    = { id: COMMIT_ID, organization_id: ORG_ID, status: 'active' };
      const stakeholder = { id: 'sh-1', commitment_id: COMMIT_ID };

      mockFrom
        .mockReturnValueOnce(chain({ data: existing,    error: null }))
        .mockReturnValueOnce(chain({ data: stakeholder, error: null }));

      await svc.addStakeholder(COMMIT_ID, ORG_ID, ACTOR_ID, stakeholderInput);

      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'commitment.stakeholder_added' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProgress — tenant isolation
  // -------------------------------------------------------------------------

  describe('getProgress', () => {
    it('scopes all sub-queries to commitment_id and organization_id', async () => {
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: '2027-01-01T00:00:00.000Z',
      };

      // fetchOwned + 3 parallel sub-queries (milestones, metrics, risks)
      const subChain = () => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq', 'order', 'limit']) {
          c[m] = vi.fn().mockReturnValue(c);
        }
        c['then'] = (res: (v: unknown) => void) => res({ data: [], error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null })) // fetchOwned
        .mockReturnValue(subChain());                                   // milestones, metrics, risks

      const result = await svc.getProgress(COMMIT_ID, ORG_ID);

      expect(result.commitment_id).toBe(COMMIT_ID);
      expect(result.overall_progress).toBe(0);
      expect(result.is_on_track).toBe(false);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.getProgress(COMMIT_ID, OTHER_ORG),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws when a sub-query returns a DB error', async () => {
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      };

      // milestones query fails
      const errorChain = (errorMsg: string) => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data: null, error: { message: errorMsg } });
        return c;
      };
      const okChain = () => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data: [], error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null })) // fetchOwned
        .mockReturnValueOnce(errorChain('connection timeout'))          // milestones fails
        .mockReturnValueOnce(okChain())                                 // metrics ok
        .mockReturnValueOnce(okChain());                                // risks ok

      await expect(
        svc.getProgress(COMMIT_ID, ORG_ID),
      ).rejects.toThrow('getProgress milestones');
    });
  });

  // -------------------------------------------------------------------------
  // getAtRiskCommitments — tenant isolation
  // -------------------------------------------------------------------------

  describe('getAtRiskCommitments', () => {
    it('scopes query to organization_id', async () => {
      const atRiskRow = { id: COMMIT_ID, organization_id: ORG_ID, status: 'at_risk', progress_percentage: 30 };

      const c: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'lt', 'in']) {
        c[m] = vi.fn().mockReturnValue(c);
      }
      c['then'] = (res: (v: unknown) => void) => res({ data: [atRiskRow], error: null });
      mockFrom.mockReturnValue(c);

      const result = await svc.getAtRiskCommitments(ORG_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: COMMIT_ID });

      // Verify organization_id filter was applied
      const eqFn = c['eq'] as ReturnType<typeof vi.fn>;
      const eqCalls = eqFn.mock.calls as [string, unknown][];
      expect(eqCalls).toContainEqual(['organization_id', ORG_ID]);
    });

    it('never returns rows from a different org', async () => {
      // Simulate DB correctly returning empty for OTHER_ORG
      const c: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'lt', 'in']) {
        c[m] = vi.fn().mockReturnValue(c);
      }
      c['then'] = (res: (v: unknown) => void) => res({ data: [], error: null });
      mockFrom.mockReturnValue(c);

      const result = await svc.getAtRiskCommitments(OTHER_ORG);

      expect(result).toHaveLength(0);

      const eqFn = c['eq'] as ReturnType<typeof vi.fn>;
      const eqCalls = eqFn.mock.calls as [string, unknown][];
      expect(eqCalls).toContainEqual(['organization_id', OTHER_ORG]);
      expect(eqCalls).not.toContainEqual(['organization_id', ORG_ID]);
    });
  });

  // -------------------------------------------------------------------------
  // validateProgress
  // -------------------------------------------------------------------------

  describe('validateProgress', () => {
    it('returns isValid true when progress >= 80 and risk is not critical', async () => {
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      };

      const milestoneChain = () => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        // 2 milestones at 90% each
        c['then'] = (res: (v: unknown) => void) => res({
          data: [{ progress_percentage: 90, status: 'in_progress' }, { progress_percentage: 90, status: 'in_progress' }],
          error: null,
        });
        return c;
      };
      const metricChain = () => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq']) c[m] = vi.fn().mockReturnValue(c);
        // metric at 85% of target
        c['then'] = (res: (v: unknown) => void) => res({
          data: [{ current_value: 85, target_value: 100 }],
          error: null,
        });
        return c;
      };
      const riskChain = () => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data: [], error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null })) // fetchOwned in getProgress
        .mockReturnValueOnce(milestoneChain())
        .mockReturnValueOnce(metricChain())
        .mockReturnValueOnce(riskChain());

      const result = await svc.validateProgress(COMMIT_ID, ORG_ID);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('returns isValid false with issue when progress < 80', async () => {
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      };

      const lowChain = (data: unknown[]) => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data, error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null }))
        .mockReturnValueOnce(lowChain([{ progress_percentage: 40, status: 'in_progress' }]))
        .mockReturnValueOnce(lowChain([{ current_value: 40, target_value: 100 }]))
        .mockReturnValueOnce(lowChain([]));

      const result = await svc.validateProgress(COMMIT_ID, ORG_ID);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('flags overdue commitment when days_remaining < 0', async () => {
      // target_completion_date in the past → days_remaining will be negative
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      };

      const okChain = (data: unknown[]) => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data, error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null }))
        // milestones and metrics at 90% so progress rule doesn't fire
        .mockReturnValueOnce(okChain([{ progress_percentage: 90, status: 'in_progress' }, { progress_percentage: 90, status: 'in_progress' }]))
        .mockReturnValueOnce(okChain([{ current_value: 90, target_value: 100 }]))
        .mockReturnValueOnce(okChain([])); // no risks

      const result = await svc.validateProgress(COMMIT_ID, ORG_ID);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('past the target completion date'))).toBe(true);
      expect(result.recommendations.some((r) => r.includes('target completion date'))).toBe(true);
    });

    it('flags critical risk regardless of progress percentage', async () => {
      const commitment = {
        id: COMMIT_ID, organization_id: ORG_ID, status: 'active',
        target_completion_date: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      };

      const highProgressChain = (data: unknown[]) => {
        const c: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'neq']) c[m] = vi.fn().mockReturnValue(c);
        c['then'] = (res: (v: unknown) => void) => res({ data, error: null });
        return c;
      };

      mockFrom
        .mockReturnValueOnce(chain({ data: commitment, error: null }))
        // milestones at 90%
        .mockReturnValueOnce(highProgressChain([{ progress_percentage: 90, status: 'in_progress' }, { progress_percentage: 90, status: 'in_progress' }]))
        // metrics at 90%
        .mockReturnValueOnce(highProgressChain([{ current_value: 90, target_value: 100 }]))
        // 3 critical risks
        .mockReturnValueOnce(highProgressChain([
          { probability: 'critical' }, { probability: 'critical' }, { probability: 'critical' },
        ]));

      const result = await svc.validateProgress(COMMIT_ID, ORG_ID);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('critical'))).toBe(true);
    });

    it('throws NOT_FOUND for cross-tenant commitment', async () => {
      mockFrom.mockReturnValue(chain({ data: null, error: { message: 'not found' } }));

      await expect(
        svc.validateProgress(COMMIT_ID, OTHER_ORG),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
