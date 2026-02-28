import { describe, expect, it, vi } from 'vitest';

import { BillingExecutionControlService } from '../../BillingExecutionControlService.js';
import { BillingSpendEvaluationService } from '../../BillingSpendEvaluationService.js';
import { TenantExecutionStateService } from '../../TenantExecutionStateService.js';

vi.mock('../../../AuditLogService.js', () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

type QueryRow = Record<string, unknown>;

class MockSupabase {
  public organizationConfigurations: Record<string, QueryRow> = {};
  public ratedLedger: QueryRow[] = [];
  public tenantExecutionState: Record<string, QueryRow> = {};
  public tenantExecutionStateAudit: QueryRow[] = [];

  from(table: string) {
    return new MockQueryBuilder(this, table);
  }
}

class MockQueryBuilder {
  private filters: Record<string, unknown> = {};
  private updatePayload: QueryRow | null = null;
  private upsertPayload: QueryRow | null = null;

  constructor(
    private readonly db: MockSupabase,
    private readonly table: string,
  ) {}

  select(_columns?: string) {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters[key] = value;

    if (this.updatePayload) {
      return this.executeUpdate();
    }

    return this;
  }

  gte(_key: string, _value: unknown) {
    return this;
  }

  lt(_key: string, _value: unknown) {
    return Promise.resolve(this.executeSelect());
  }

  maybeSingle() {
    const result = this.executeSelect();
    const first = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return Promise.resolve({ data: first, error: null });
  }

  single() {
    const result = this.executeSelect();
    const first = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return Promise.resolve({ data: first, error: null });
  }

  update(payload: QueryRow) {
    this.updatePayload = payload;
    return this;
  }

  upsert(payload: QueryRow) {
    this.upsertPayload = payload;

    if (this.table === 'tenant_execution_state') {
      const organizationId = String(payload.organization_id);
      this.db.tenantExecutionState[organizationId] = { ...payload };
    }

    return this;
  }

  insert(payload: QueryRow | QueryRow[]) {
    if (this.table === 'tenant_execution_state_audit') {
      if (Array.isArray(payload)) {
        this.db.tenantExecutionStateAudit.push(...payload);
      } else {
        this.db.tenantExecutionStateAudit.push(payload);
      }
    }

    return Promise.resolve({ data: payload, error: null });
  }

  private executeUpdate() {
    if (this.table === 'organization_configurations') {
      const organizationId = String(this.filters.organization_id);
      const existing = this.db.organizationConfigurations[organizationId] ?? { organization_id: organizationId };
      this.db.organizationConfigurations[organizationId] = {
        ...existing,
        ...this.updatePayload,
      };
      return Promise.resolve({ data: this.db.organizationConfigurations[organizationId], error: null });
    }

    return Promise.resolve({ data: null, error: null });
  }

  private executeSelect() {
    if (this.table === 'organization_configurations') {
      if (this.filters.organization_id) {
        const organizationId = String(this.filters.organization_id);
        const row = this.db.organizationConfigurations[organizationId];
        return { data: row ? [row] : [], error: null };
      }
      return { data: Object.values(this.db.organizationConfigurations), error: null };
    }

    if (this.table === 'rated_ledger') {
      const tenantId = String(this.filters.tenant_id);
      return {
        data: this.db.ratedLedger.filter((row) => String(row.tenant_id) === tenantId),
        error: null,
      };
    }

    if (this.table === 'tenant_execution_state') {
      const organizationId = String(this.filters.organization_id);
      const state = this.db.tenantExecutionState[organizationId];
      if (!state) {
        return { data: [], error: null };
      }
      if (this.filters.is_paused !== undefined && state.is_paused !== this.filters.is_paused) {
        return { data: [], error: null };
      }
      return { data: [state], error: null };
    }

    return { data: [], error: null };
  }
}

describe('Spend pause integration', () => {
  it('automatically pauses tenant on daily threshold breach and resumes after override', async () => {
    const db = new MockSupabase();
    const organizationId = '11111111-1111-1111-1111-111111111111';

    db.organizationConfigurations[organizationId] = {
      organization_id: organizationId,
      llm_spending_limits: {
        organizationId,
        dailyLimit: 100,
        dailySpend: 0,
        monthlyHardCap: 1000,
        monthlySoftCap: 800,
        perRequestLimit: 10,
        alertThreshold: 80,
        alertRecipients: [],
      },
    };

    db.ratedLedger = [
      { tenant_id: organizationId, amount: 55, rated_at: new Date().toISOString() },
      { tenant_id: organizationId, amount: 60, rated_at: new Date().toISOString() },
    ];

    const executionStateService = new TenantExecutionStateService(db as never);
    const evaluator = new BillingSpendEvaluationService(db as never, executionStateService);

    const events = await evaluator.evaluateAllTenantsDailySpend();
    expect(events).toHaveLength(1);
    expect(events[0].threshold).toBe('critical');

    const pausedState = await executionStateService.getActiveState(organizationId);
    expect(pausedState?.is_paused).toBe(true);

    const controlService = new BillingExecutionControlService(db as never, executionStateService);
    await controlService.clearPauseWithOverride({
      organizationId,
      actorUserId: 'admin-1',
      actorEmail: 'admin@valueos.com',
      reason: 'Budget approved by finance',
    });

    const resumedState = await executionStateService.getActiveState(organizationId);
    expect(resumedState).toBeNull();
    expect(db.tenantExecutionStateAudit.length).toBe(2);
  });

  it('resumes tenant after top-up and records audit trail', async () => {
    const db = new MockSupabase();
    const organizationId = '22222222-2222-2222-2222-222222222222';

    db.organizationConfigurations[organizationId] = {
      organization_id: organizationId,
      llm_spending_limits: {
        organizationId,
        dailyLimit: 100,
        dailySpend: 100,
        monthlyHardCap: 1000,
        monthlySoftCap: 800,
        perRequestLimit: 10,
        alertThreshold: 80,
        alertRecipients: [],
      },
    };

    db.tenantExecutionState[organizationId] = {
      organization_id: organizationId,
      is_paused: true,
      reason: 'Daily spend cap reached',
      paused_at: new Date().toISOString(),
      paused_by: 'system',
      actor_type: 'system',
      metadata: {},
      updated_at: new Date().toISOString(),
    };

    const executionStateService = new TenantExecutionStateService(db as never);
    const controlService = new BillingExecutionControlService(db as never, executionStateService);

    await controlService.topUpAndResume({
      organizationId,
      actorUserId: 'admin-2',
      actorEmail: 'ops@valueos.com',
      topUpAmount: 50,
      reason: 'Emergency top-up approved',
    });

    const policy = db.organizationConfigurations[organizationId].llm_spending_limits as Record<string, number>;
    expect(policy.dailyLimit).toBe(150);

    const pausedState = await executionStateService.getActiveState(organizationId);
    expect(pausedState).toBeNull();
    expect(db.tenantExecutionStateAudit).toHaveLength(1);
    expect(db.tenantExecutionStateAudit[0].action).toBe('resumed');
  });
});
