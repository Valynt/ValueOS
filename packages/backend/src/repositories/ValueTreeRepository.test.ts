import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerWarn, loggerInfo, loggerError } = vi.hoisted(() => ({
  loggerWarn: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
}));

// Mock supabase before importing the repository
vi.mock('../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: {
    warn: loggerWarn,
    info: loggerInfo,
    error: loggerError,
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { supabase } from '../lib/supabase.js';

import { ValueTreeRepository } from './ValueTreeRepository.js';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

function makeChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

describe('ValueTreeRepository', () => {
  let repo: ValueTreeRepository;

  beforeEach(() => {
    repo = new ValueTreeRepository(supabase);
    vi.clearAllMocks();
  });

  describe('getNodesForCase', () => {
    it('returns nodes ordered by sort_order', async () => {
      const nodes = [
        { id: 'n1', case_id: 'c1', organization_id: 'o1', label: 'Root', sort_order: 0 },
        { id: 'n2', case_id: 'c1', organization_id: 'o1', label: 'Child', sort_order: 1 },
      ];
      const chain = makeChain({ order: vi.fn().mockResolvedValue({ data: nodes, error: null }) });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getNodesForCase('c1', 'o1');

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Root');
      expect(chain.eq).toHaveBeenCalledWith('case_id', 'c1');
      expect(chain.eq).toHaveBeenCalledWith('organization_id', 'o1');
    });

    it('returns empty array when no nodes exist', async () => {
      const chain = makeChain({ order: vi.fn().mockResolvedValue({ data: [], error: null }) });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getNodesForCase('c1', 'o1');
      expect(result).toEqual([]);
    });

    it('throws on DB error', async () => {
      const chain = makeChain({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });
      mockFrom.mockReturnValue(chain);

      await expect(repo.getNodesForCase('c1', 'o1')).rejects.toThrow('Failed to fetch value tree nodes');
    });
  });

  describe('replaceNodesForCase', () => {
    it('deletes existing nodes then inserts new ones and bulk updates parents once', async () => {
      const deleteChain = makeChain({
        eq: vi.fn().mockReturnThis(),
      });
      let eqCallCount = 0;
      deleteChain.eq = vi.fn().mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) return Promise.resolve({ error: null });
        return deleteChain;
      });

      const insertedRows = [
        { id: 'n1', node_key: 'root' },
        { id: 'n2', node_key: 'child' },
      ];
      const insertChain = makeChain({
        select: vi.fn().mockResolvedValue({ data: insertedRows, error: null }),
      });

      const getChain = makeChain({
        order: vi.fn().mockResolvedValue({
          data: insertedRows.map((row, index) => ({
            ...row,
            case_id: 'c1',
            organization_id: 'o1',
            label: index === 0 ? 'Root' : 'Child',
            parent_id: index === 0 ? null : 'n1',
            sort_order: index,
          })),
          error: null,
        }),
      });

      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return deleteChain;
        if (callIndex === 2) return insertChain;
        return getChain;
      });
      mockRpc.mockResolvedValue({ error: null });

      const nodes = [
        { node_key: 'root', label: 'Root', sort_order: 0, metadata: {} },
        { node_key: 'child', label: 'Child', parent_node_key: 'root', sort_order: 1, metadata: {} },
      ];
      const result = await repo.replaceNodesForCase('c1', 'o1', nodes);

      expect(result).toBeDefined();
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith('bulk_update_value_tree_node_parents', {
        p_case_id: 'c1',
        p_organization_id: 'o1',
        p_parent_links: [{ node_id: 'n2', parent_id: 'n1' }],
      });
      expect(loggerInfo).toHaveBeenCalledWith('ValueTreeRepository: nodes replaced', {
        case_id: 'c1',
        organization_id: 'o1',
        node_count: 2,
        parent_links: 1,
      });
    });

    it('logs a warning when the bulk parent update fails', async () => {
      const deleteChain = makeChain();
      let eqCount = 0;
      deleteChain.eq = vi.fn().mockImplementation(() => {
        eqCount++;
        if (eqCount === 2) return Promise.resolve({ error: null });
        return deleteChain;
      });

      const insertChain = makeChain({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'n1', node_key: 'root' },
            { id: 'n2', node_key: 'child' },
          ],
          error: null,
        }),
      });

      const getChain = makeChain({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      });

      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        if (callIndex === 1) return deleteChain;
        if (callIndex === 2) return insertChain;
        return getChain;
      });
      mockRpc.mockResolvedValue({ error: { message: 'rpc failed' } });

      await repo.replaceNodesForCase('c1', 'o1', [
        { node_key: 'root', label: 'Root', sort_order: 0, metadata: {} },
        { node_key: 'child', label: 'Child', parent_node_key: 'root', sort_order: 1, metadata: {} },
      ]);

      expect(loggerWarn).toHaveBeenCalledWith('ValueTreeRepository: failed to set parent_id', {
        case_id: 'c1',
        organization_id: 'o1',
        parent_links: 1,
        error: 'rpc failed',
      });
    });

    it('returns empty array when nodes list is empty', async () => {
      const deleteChain = makeChain();
      let eqCount = 0;
      deleteChain.eq = vi.fn().mockImplementation(() => {
        eqCount++;
        if (eqCount === 2) return Promise.resolve({ error: null });
        return deleteChain;
      });
      mockFrom.mockReturnValue(deleteChain);

      const result = await repo.replaceNodesForCase('c1', 'o1', []);
      expect(result).toEqual([]);
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe('deleteNodesForCase', () => {
    it('deletes all nodes for a case', async () => {
      const chain = makeChain();
      let eqCount = 0;
      chain.eq = vi.fn().mockImplementation(() => {
        eqCount++;
        if (eqCount === 2) return Promise.resolve({ error: null });
        return chain;
      });
      mockFrom.mockReturnValue(chain);

      await expect(repo.deleteNodesForCase('c1', 'o1')).resolves.toBeUndefined();
    });

    it('throws on DB error', async () => {
      const chain = makeChain();
      let eqCount = 0;
      chain.eq = vi.fn().mockImplementation(() => {
        eqCount++;
        if (eqCount === 2) return Promise.resolve({ error: { message: 'delete failed' } });
        return chain;
      });
      mockFrom.mockReturnValue(chain);

      await expect(repo.deleteNodesForCase('c1', 'o1')).rejects.toThrow('Failed to delete value tree nodes');
    });
  });
});
