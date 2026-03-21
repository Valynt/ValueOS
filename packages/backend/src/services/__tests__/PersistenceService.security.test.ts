import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryCall {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  filters: Array<{ column: string; value: unknown }>;
  payload?: unknown;
  selectClause?: string;
  orderBy?: { column: string; options?: Record<string, unknown> };
  limit?: number;
}

type QueryResult = { data: unknown; error: Error | null };

const queryCalls: QueryCall[] = [];
let responseFactory: (call: QueryCall) => QueryResult = () => ({ data: null, error: null });

const createQueryBuilder = (table: string) => {
  const call: QueryCall = {
    table,
    operation: 'select',
    filters: [],
  };
  queryCalls.push(call);

  const builder = {
    insert(payload: unknown) {
      call.operation = 'insert';
      call.payload = payload;
      return builder;
    },
    update(payload: unknown) {
      call.operation = 'update';
      call.payload = payload;
      return builder;
    },
    delete() {
      call.operation = 'delete';
      return builder;
    },
    select(selectClause?: string) {
      if (call.operation === 'select') {
        call.operation = 'select';
      }
      call.selectClause = selectClause;
      return builder;
    },
    eq(column: string, value: unknown) {
      call.filters.push({ column, value });
      return builder;
    },
    order(column: string, options?: Record<string, unknown>) {
      call.orderBy = { column, options };
      return builder;
    },
    limit(value: number) {
      call.limit = value;
      return builder;
    },
    single() {
      return builder;
    },
    maybeSingle() {
      return builder;
    },
    then<TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve(responseFactory(call)).then(onfulfilled, onrejected);
    },
  };

  return builder;
};

vi.mock('../../lib/supabase.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/supabase.js')>();

  return {
    ...actual,
    createServerSupabaseClient: vi.fn(),
    createUserSupabaseClient: vi.fn(),
    getSupabaseClient: vi.fn(),
    supabase: {
      auth: {} as typeof actual.supabase.auth,
      storage: {} as typeof actual.supabase.storage,
      realtime: {} as typeof actual.supabase.realtime,
      from: vi.fn((table: string) => createQueryBuilder(table)),
      rpc: vi.fn(),
      channel: vi.fn(),
      removeChannel: vi.fn(),
      getChannels: vi.fn(() => []),
      removeAllChannels: vi.fn(),
    },
  };
});

vi.mock('../../lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../config/featureFlags.js', () => ({
  featureFlags: {
    DISABLE_LEGACY_BUSINESS_CASES: false,
  },
}));

import { persistenceService } from '../workflow/PersistenceService.js';

const getFilter = (call: QueryCall, column: string) =>
  call.filters.find(filter => filter.column === column)?.value;

const requireOrganizationScope = (call: QueryCall, organizationId: string) => {
  expect(getFilter(call, 'organization_id')).toBe(organizationId);
};

describe('PersistenceService tenant isolation', () => {
  beforeEach(() => {
    queryCalls.length = 0;
    responseFactory = () => ({ data: null, error: null });
    persistenceService.flushSaveQueue();
  });

  it('rejects missing organizationId for all public workflow persistence APIs', async () => {
    const component = {
      id: 'component-1',
      type: 'text',
      position: { x: 10, y: 20 },
      size: { width: 100, height: 50 },
      props: { text: 'Hello' },
    };

    await expect(
      persistenceService.createBusinessCase('', 'Case', 'Client', 'user-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.getBusinessCase('', 'case-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.updateBusinessCase('', 'case-1', { name: 'Updated' })
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.saveComponent('', 'case-1', component)
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.updateComponent('', 'component-1', { props: { ok: true } })
    ).rejects.toThrow(/organizationId/);
    expect(() =>
      persistenceService.debouncedUpdateComponent('', 'component-1', { props: { ok: true } })
    ).toThrow(/organizationId/);
    await expect(
      persistenceService.deleteComponent('', 'component-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.loadComponents('', 'case-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.logHistory('', 'component-1', 'created', 'user', {})
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.getComponentHistory('', 'component-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.getGlobalHistory('', 'case-1')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.logAgentActivity('', 'case-1', 'agent', 'suggestion', 't', 'c')
    ).rejects.toThrow(/organizationId/);
    await expect(
      persistenceService.getAgentActivities('', 'case-1')
    ).rejects.toThrow(/organizationId/);
  });

  it('persists organization_id on inserts and scopes subsequent history writes', async () => {
    responseFactory = call => {
      if (call.table === 'business_cases' && call.operation === 'insert') {
        return {
          data: {
            id: 'case-1',
            name: 'Case',
            client: 'Acme',
            status: 'draft',
            owner_id: 'user-1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        };
      }

      if (call.table === 'canvas_components' && call.operation === 'insert') {
        return { data: { id: 'component-1' }, error: null };
      }

      return { data: null, error: null };
    };

    await persistenceService.createBusinessCase('org-1', 'Case', 'Acme', 'user-1');
    await persistenceService.saveComponent('org-1', 'case-1', {
      id: 'draft-component',
      type: 'text',
      position: { x: 1, y: 2 },
      size: { width: 3, height: 4 },
      props: { text: 'Hello' },
    });
    await persistenceService.logAgentActivity(
      'org-1',
      'case-1',
      'narrative-agent',
      'suggestion',
      'Title',
      'Content',
      { foo: 'bar' }
    );

    const businessCaseInsert = queryCalls.find(
      call => call.table === 'business_cases' && call.operation === 'insert'
    );
    const componentInsert = queryCalls.find(
      call => call.table === 'canvas_components' && call.operation === 'insert'
    );
    const historyInsert = queryCalls.find(
      call => call.table === 'component_history' && call.operation === 'insert'
    );
    const activityInsert = queryCalls.find(
      call => call.table === 'agent_activities' && call.operation === 'insert'
    );

    expect(businessCaseInsert).toBeDefined();
    expect(componentInsert).toBeDefined();
    expect(historyInsert).toBeDefined();
    expect(activityInsert).toBeDefined();

    expect(businessCaseInsert?.payload).toMatchObject({ organization_id: 'org-1' });
    expect(componentInsert?.payload).toMatchObject({ organization_id: 'org-1' });
    expect(historyInsert?.payload).toMatchObject({ organization_id: 'org-1' });
    expect(activityInsert?.payload).toMatchObject({ organization_id: 'org-1' });
  });

  it('prevents cross-tenant reads by scoping select queries to organization_id', async () => {
    responseFactory = call => {
      const organizationId = getFilter(call, 'organization_id');
      const caseId = getFilter(call, 'case_id');
      const componentId = getFilter(call, 'component_id');

      if (call.table === 'business_cases') {
        return {
          data: organizationId === 'org-1' ? {
            id: 'case-1',
            name: 'Case',
            client: 'Acme',
            status: 'draft',
            owner_id: 'user-1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          } : null,
          error: null,
        };
      }

      if (call.table === 'canvas_components' && call.operation === 'select') {
        return {
          data: organizationId === 'org-1' && caseId === 'case-1'
            ? [{
                id: 'component-1',
                type: 'text',
                position_x: 1,
                position_y: 2,
                width: 3,
                height: 4,
                props: { text: 'Hello' },
              }]
            : [],
          error: null,
        };
      }

      if (call.table === 'component_history') {
        return {
          data: organizationId === 'org-1' && componentId === 'component-1'
            ? [{
                id: 'history-1',
                component_id: 'component-1',
                action_type: 'updated',
                actor: 'user-1',
                changes: {},
                timestamp: '2024-01-01T00:00:00Z',
              }]
            : [],
          error: null,
        };
      }

      if (call.table === 'agent_activities') {
        return {
          data: organizationId === 'org-1' && caseId === 'case-1'
            ? [{
                id: 'activity-1',
                case_id: 'case-1',
                agent_name: 'narrative-agent',
                activity_type: 'suggestion',
                title: 'Title',
                content: 'Content',
                metadata: {},
                timestamp: '2024-01-01T00:00:00Z',
              }]
            : [],
          error: null,
        };
      }

      return { data: [], error: null };
    };

    await expect(persistenceService.getBusinessCase('org-2', 'case-1')).resolves.toBeNull();
    await expect(persistenceService.loadComponents('org-2', 'case-1')).resolves.toEqual([]);
    await expect(
      persistenceService.getComponentHistory('org-2', 'component-1')
    ).resolves.toEqual([]);
    await expect(persistenceService.getGlobalHistory('org-2', 'case-1')).resolves.toEqual([]);
    await expect(persistenceService.getAgentActivities('org-2', 'case-1')).resolves.toEqual([]);

    const relevantCalls = queryCalls.filter(call =>
      ['business_cases', 'canvas_components', 'component_history', 'agent_activities'].includes(call.table)
    );

    expect(relevantCalls.length).toBeGreaterThanOrEqual(5);
    relevantCalls.forEach(call => requireOrganizationScope(call, 'org-2'));
    expect(
      queryCalls.some(
        call =>
          call.table === 'component_history' &&
          getFilter(call, 'canvas_components.organization_id') === 'org-2'
      )
    ).toBe(true);
  });

  it('prevents cross-tenant updates and deletes by requiring a tenant-scoped row match', async () => {
    responseFactory = call => {
      const organizationId = getFilter(call, 'organization_id');
      const id = getFilter(call, 'id');

      if (call.table === 'business_cases' && call.operation === 'update') {
        return {
          data: organizationId === 'org-1' && id === 'case-1' ? { id: 'case-1' } : null,
          error: null,
        };
      }

      if (call.table === 'canvas_components' && call.operation === 'update') {
        return {
          data: organizationId === 'org-1' && id === 'component-1' ? { id: 'component-1' } : null,
          error: null,
        };
      }

      if (call.table === 'canvas_components' && call.operation === 'delete') {
        return {
          data: organizationId === 'org-1' && id === 'component-1' ? { id: 'component-1' } : null,
          error: null,
        };
      }

      return { data: null, error: null };
    };

    await expect(
      persistenceService.updateBusinessCase('org-2', 'case-1', { name: 'Nope' })
    ).resolves.toBe(false);
    await expect(
      persistenceService.updateComponent('org-2', 'component-1', { props: { text: 'Nope' } })
    ).resolves.toBe(false);
    await expect(
      persistenceService.deleteComponent('org-2', 'component-1')
    ).resolves.toBe(false);

    const businessCaseUpdate = queryCalls.find(
      call => call.table === 'business_cases' && call.operation === 'update'
    );
    const componentUpdate = queryCalls.find(
      call => call.table === 'canvas_components' && call.operation === 'update'
    );
    const componentDelete = queryCalls.find(
      call => call.table === 'canvas_components' && call.operation === 'delete'
    );

    requireOrganizationScope(businessCaseUpdate!, 'org-2');
    requireOrganizationScope(componentUpdate!, 'org-2');
    requireOrganizationScope(componentDelete!, 'org-2');
  });
});
