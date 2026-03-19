/**
 * TenantDeletionService tests
 *
 * Covers the three deletion phases, guard conditions, and the scheduled
 * deletion job — all without a live DB.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock factory ─────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function makeSupabaseMock(store: Record<string, Row[]>) {
  const deleted: Record<string, Row[]> = {};
  const updates: Array<{ table: string; id: unknown; payload: Row }> = [];

  function tableChain(tableName: string) {
    const filters: Array<{ col: string; val: unknown; op: string }> = [];
    let selectCols = '*';
    let isSingle = false;
    let updatePayload: Row | null = null;
    let isDelete = false;
    let rangeStart: number | null = null;
    let rangeEnd: number | null = null;

    const applyFilters = (rows: Row[]) =>
      rows.filter(r =>
        filters.every(f => {
          if (f.op === 'eq')  return r[f.col] === f.val;
          if (f.op === 'lte') return r[f.col] != null && r[f.col]! <= f.val;
          if (f.op === 'is')  return f.val === null ? r[f.col] == null : r[f.col] != null;
          return true;
        })
      );

    const chain: Record<string, unknown> = {
      select: vi.fn((cols = '*') => { selectCols = cols; return chain; }),
      eq:     vi.fn((col: string, val: unknown) => { filters.push({ col, val, op: 'eq' }); return chain; }),
      lte:    vi.fn((col: string, val: unknown) => { filters.push({ col, val, op: 'lte' }); return chain; }),
      is:     vi.fn((col: string, val: unknown) => { filters.push({ col, val, op: 'is' }); return chain; }),
      range:  vi.fn((from: number, to: number) => { rangeStart = from; rangeEnd = to; return chain; }),
      order:  vi.fn(() => chain),
      single: vi.fn(() => { isSingle = true; return chain; }),
      update: vi.fn((payload: Row) => { updatePayload = payload; return chain; }),
      delete: vi.fn(() => { isDelete = true; return chain; }),
    };

    const execute = () => Promise.resolve().then(() => {
      const rows = store[tableName] ?? [];

      if (isDelete) {
        const toDelete = applyFilters(rows);
        deleted[tableName] = [...(deleted[tableName] ?? []), ...toDelete];
        store[tableName] = rows.filter(r => !toDelete.includes(r));
        return { data: toDelete, error: null };
      }

      if (updatePayload) {
        const matched = applyFilters(rows);
        matched.forEach(r => {
          Object.assign(r, updatePayload);
          updates.push({ table: tableName, id: r['id'], payload: updatePayload! });
        });
        return { data: matched, error: null };
      }

      let result = applyFilters(rows);
      if (rangeStart !== null && rangeEnd !== null) {
        result = result.slice(rangeStart, rangeEnd + 1);
      }
      if (isSingle) {
        return result.length > 0
          ? { data: result[0], error: null }
          : { data: null, error: { message: 'Not found' } };
      }
      return { data: result, error: null };
    });

    Object.assign(chain, {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        execute().then(onFulfilled, onRejected),
      catch: (onRejected?: (reason: unknown) => unknown) => execute().catch(onRejected),
      finally: (onFinally?: () => void) => execute().finally(onFinally),
    });
    return chain;
  }

  const supabase = {
    from: vi.fn((table: string) => tableChain(table)),
    _deleted: deleted,
    _updates: updates,
  };

  return supabase;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function activeTenant(id = 'tenant-1'): Row {
  return {
    id,
    status: 'active',
    deletion_requested_at: null,
    deletion_scheduled_at: null,
    data_exported_at: null,
    deleted_at: null,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('TenantDeletionService', () => {
  afterEach(() => {
    vi.resetModules();
  });

  // ── Phase 1: soft delete ────────────────────────────────────────────────────

  describe('initiateSoftDelete', () => {
    it('marks tenant pending_deletion and sets scheduled_at', async () => {
      const store = { tenants: [activeTenant()] };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({
        deprovisionTenant: vi.fn().mockResolvedValue({ success: true, errors: [] }),
      }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.initiateSoftDelete('tenant-1', 'admin@test.com', 'contract ended');

      expect(result.success).toBe(true);
      expect(store.tenants[0].status).toBe('pending_deletion');
      expect(store.tenants[0].deletion_scheduled_at).toBeTruthy();
    });

    it('rejects if tenant is already pending_deletion', async () => {
      const tenant = { ...activeTenant(), status: 'pending_deletion' };
      const store = { tenants: [tenant] };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({
        deprovisionTenant: vi.fn().mockResolvedValue({ success: true, errors: [] }),
      }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.initiateSoftDelete('tenant-1', 'admin', 'reason');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/already in deletion/);
    });

    it('returns error if tenant not found', async () => {
      const store = { tenants: [] };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({
        deprovisionTenant: vi.fn(),
      }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.initiateSoftDelete('missing', 'admin', 'reason');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/not found/);
    });
  });

  // ── Phase 2: export ─────────────────────────────────────────────────────────

  describe('exportTenantData', () => {
    it('exports all tables and records data_exported_at', async () => {
      const store: Record<string, Row[]> = {
        tenants: [activeTenant()],
        value_cases: [{ id: 'vc-1', organization_id: 'tenant-1' }],
        agent_audit_logs: [],
        value_loop_events: [],
        saga_transitions: [],
        usage_ledger: [],
        rated_ledger: [],
        prompt_executions: [],
        agent_predictions: [],
        active_sessions: [],
        sessions: [],
        messages: [],
        agent_memory: [],
        integrity_outputs: [],
        narrative_drafts: [],
        realization_reports: [],
        hypothesis_outputs: [],
        workflow_executions: [],
        crm_connections: [],
        user_tenants: [],
      };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({ deprovisionTenant: vi.fn() }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const exportData = await svc.exportTenantData('tenant-1');

      expect(exportData.tenant_id).toBe('tenant-1');
      expect(exportData.exported_at).toBeTruthy();
      expect(exportData.tables['tenants']).toHaveLength(1);
      // data_exported_at should be set on the tenant row
      expect(store.tenants[0].data_exported_at).toBeTruthy();
    });
  });

  // ── Phase 3: hard delete ────────────────────────────────────────────────────

  describe('hardDelete', () => {
    it('deletes all tenant data in FK-safe order', async () => {
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const store: Record<string, Row[]> = {
        tenants: [{
          id: 'tenant-1',
          status: 'pending_deletion',
          deletion_scheduled_at: pastDate,
          data_exported_at: pastDate,
          deleted_at: null,
        }],
        value_cases: [{ id: 'vc-1', organization_id: 'tenant-1' }],
        agent_audit_logs: [{ id: 'al-1', organization_id: 'tenant-1' }],
        value_loop_events: [],
        saga_transitions: [],
        usage_ledger: [],
        rated_ledger: [],
        prompt_executions: [],
        agent_predictions: [],
        active_sessions: [],
        sessions: [],
        messages: [],
        agent_memory: [],
        integrity_outputs: [],
        narrative_drafts: [],
        realization_reports: [],
        hypothesis_outputs: [],
        workflow_executions: [],
        crm_connections: [],
        user_tenants: [],
      };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({ deprovisionTenant: vi.fn() }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.hardDelete('tenant-1');

      expect(result.success).toBe(true);
      expect(store.value_cases).toHaveLength(0);
      expect(store.agent_audit_logs).toHaveLength(0);
      expect(store.tenants[0].status).toBe('deleted');
      expect(store.tenants[0].deleted_at).toBeTruthy();
    });

    it('rejects if data has not been exported', async () => {
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const store = {
        tenants: [{
          id: 'tenant-1',
          status: 'pending_deletion',
          deletion_scheduled_at: pastDate,
          data_exported_at: null, // not exported
          deleted_at: null,
        }],
      };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({ deprovisionTenant: vi.fn() }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.hardDelete('tenant-1');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/export must be completed/);
    });

    it('rejects if soft-delete window has not elapsed', async () => {
      const futureDate = new Date(Date.now() + 86_400_000 * 10).toISOString();
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const store = {
        tenants: [{
          id: 'tenant-1',
          status: 'pending_deletion',
          deletion_scheduled_at: futureDate, // still in window
          data_exported_at: pastDate,
          deleted_at: null,
        }],
      };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({ deprovisionTenant: vi.fn() }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.hardDelete('tenant-1');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/window has not elapsed/);
    });
  });

  // ── Scheduled job ───────────────────────────────────────────────────────────

  describe('processScheduledDeletions', () => {
    it('skips tenants without a completed export and counts them as errors', async () => {
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const store = {
        tenants: [{
          id: 'tenant-1',
          status: 'pending_deletion',
          deletion_scheduled_at: pastDate,
          data_exported_at: null, // not exported
          deleted_at: null,
        }],
      };
      const supabase = makeSupabaseMock(store);

      vi.doMock('../../lib/supabase.js', () => ({ createServerSupabaseClient: () => supabase }));
      vi.doMock('./TenantProvisioning.js', () => ({ deprovisionTenant: vi.fn() }));

      const { TenantDeletionService } = await import('./TenantDeletionService.js');
      const svc = new TenantDeletionService();

      const result = await svc.processScheduledDeletions();

      expect(result.processed).toBe(0);
      expect(result.errors).toBe(1);
    });
  });
});
