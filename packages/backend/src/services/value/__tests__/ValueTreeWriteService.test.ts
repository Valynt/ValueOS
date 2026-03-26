import { describe, expect, it } from 'vitest';

import { ValueTreeService, type ValueTree } from '../ValueTreeWriteService';

type QueryState = {
  eqCalls: Array<{ column: string; value: string }>;
};

type RpcState = {
  args?: Record<string, unknown>;
};

type QueryBuilderResult = {
  data: unknown;
  error: unknown;
};

const buildQueryBuilder = (result: QueryBuilderResult, state: QueryState) => ({
  select: () => ({
    eq: (column: string, value: string) => {
      state.eqCalls.push({ column, value });

      return {
        eq: (nextColumn: string, nextValue: string) => {
          state.eqCalls.push({ column: nextColumn, value: nextValue });
          return {
            single: async () => result
          };
        },
        single: async () => result
      };
    }
  })
});

const sampleTree: ValueTree = {
  id: 'tree-1',
  name: 'Tree',
  version: 2,
  nodes: [],
  links: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

describe('ValueTreeWriteService tenant scoping', () => {
  it('fails closed when tenant context is missing in updateValueTree', async () => {
    const service = new ValueTreeService({} as never);

    await expect(
      service.updateValueTree('tree-1', { expectedVersion: 1 }, { userId: 'user-1' })
    ).rejects.toThrow('Tenant context is required');
  });

  it('scopes update pre-read to tenant and passes tenant to RPC', async () => {
    const queryState: QueryState = { eqCalls: [] };
    const rpcState: RpcState = {};

    const supabaseMock = {
      from: () => buildQueryBuilder({ data: sampleTree, error: null }, queryState),
      rpc: (_name: string, args: Record<string, unknown>) => {
        rpcState.args = args;
        return Promise.resolve({ data: sampleTree, error: null });
      },
      channel: () => ({
        send: () => Promise.resolve()
      })
    };

    const service = new ValueTreeService(supabaseMock as never);

    await service.updateValueTree(
      'tree-1',
      { expectedVersion: 2 },
      { userId: 'user-1', organizationId: 'org-a' }
    );

    expect(queryState.eqCalls).toContainEqual({ column: 'tenant_id', value: 'org-a' });
    expect(rpcState.args?.p_tenant_id).toBe('org-a');
  });

  it('does not allow same treeId to be read across tenants', async () => {
    const orgAState: QueryState = { eqCalls: [] };
    const orgBState: QueryState = { eqCalls: [] };

    const serviceOrgA = new ValueTreeService({
      from: () => buildQueryBuilder({ data: { ...sampleTree, value_tree_nodes: [], value_tree_links: [] }, error: null }, orgAState)
    } as never);

    const serviceOrgB = new ValueTreeService({
      from: () => buildQueryBuilder({ data: null, error: { message: 'No rows found' } }, orgBState)
    } as never);

    await expect(serviceOrgA.getValueTree('tree-1', 'org-a')).resolves.toMatchObject({ id: 'tree-1' });
    await expect(serviceOrgB.getValueTree('tree-1', 'org-b')).rejects.toMatchObject({ message: 'No rows found' });

    expect(orgAState.eqCalls).toContainEqual({ column: 'tenant_id', value: 'org-a' });
    expect(orgBState.eqCalls).toContainEqual({ column: 'tenant_id', value: 'org-b' });
  });
});
