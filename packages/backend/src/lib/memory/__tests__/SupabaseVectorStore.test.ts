import type { VectorChunk } from '@valueos/memory';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupabaseVectorStore } from '../SupabaseVectorStore.js';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockRpc = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('../../supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: mockInsert,
      delete: () => ({
        eq: () => ({
          select: () => ({ data: [{ id: 'chunk-1' }], error: null }),
        }),
      }),
      select: () => ({
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      }),
    }),
    rpc: mockRpc,
  }),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ARTIFACT_ID = '00000000-0000-0000-0000-000000000002';
const EMBEDDING = new Array(1536).fill(0.1);

const baseChunk: VectorChunk = {
  id: '00000000-0000-0000-0000-000000000003',
  artifactId: ARTIFACT_ID,
  content: 'Infrastructure cost reduction through server consolidation',
  embedding: EMBEDDING,
  chunkIndex: 0,
  metadata: { source_agent: 'RealizationAgent' },
  tenantId: TENANT_ID,
};

const rpcRow = {
  id: baseChunk.id,
  type: 'workflow_result',
  content: baseChunk.content,
  metadata: { artifact_id: ARTIFACT_ID, chunk_index: 0, source_agent: 'RealizationAgent' },
  source_agent: 'RealizationAgent',
  session_id: null,
  similarity: 0.88,
  created_at: '2026-03-22T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupabaseVectorStore', () => {
  let store: SupabaseVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new SupabaseVectorStore();
  });

  describe('insertChunk', () => {
    it('inserts a single chunk without error', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await expect(store.insertChunk(baseChunk)).resolves.toBeUndefined();
      expect(mockInsert).toHaveBeenCalledOnce();

      const arg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(arg['organization_id']).toBe(TENANT_ID);
      expect(arg['type']).toBe('workflow_result');
      const meta = arg['metadata'] as Record<string, unknown>;
      expect(meta['artifact_id']).toBe(ARTIFACT_ID);
    });

    it('throws when Supabase returns an error', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'insert failed' } });

      await expect(store.insertChunk(baseChunk)).rejects.toThrow('insert failed');
    });
  });

  describe('insertChunks', () => {
    it('inserts multiple chunks in a single call', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const chunks = [baseChunk, { ...baseChunk, id: 'chunk-2', chunkIndex: 1 }];
      await expect(store.insertChunks(chunks)).resolves.toBeUndefined();

      const arg = mockInsert.mock.calls[0][0] as unknown[];
      expect(arg).toHaveLength(2);
    });

    it('is a no-op for empty array', async () => {
      await expect(store.insertChunks([])).resolves.toBeUndefined();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('vectorSearch', () => {
    it('calls match_semantic_memory RPC and maps results', async () => {
      mockRpc.mockResolvedValue({ data: [rpcRow], error: null });

      const results = await store.vectorSearch(EMBEDDING, TENANT_ID, {
        threshold: 0.7,
        limit: 10,
      });

      expect(mockRpc).toHaveBeenCalledWith('match_semantic_memory', {
        query_embedding: EMBEDDING,
        p_organization_id: TENANT_ID,
        match_threshold: 0.7,
        match_count: 10,
        p_type: null,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.similarity).toBe(0.88);
      expect(results[0]!.chunk.tenantId).toBe(TENANT_ID);
    });

    it('filters by valueCaseId when provided', async () => {
      const rowWithCase = { ...rpcRow, metadata: { ...rpcRow.metadata, value_case_id: 'case-1' } };
      const rowOtherCase = { ...rpcRow, id: 'other', metadata: { value_case_id: 'case-2' } };
      mockRpc.mockResolvedValue({ data: [rowWithCase, rowOtherCase], error: null });

      const results = await store.vectorSearch(EMBEDDING, TENANT_ID, {
        threshold: 0.7,
        limit: 10,
        valueCaseId: 'case-1',
      });

      expect(results).toHaveLength(1);
    });

    it('throws when RPC returns an error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc error' } });

      await expect(
        store.vectorSearch(EMBEDDING, TENANT_ID, { threshold: 0.7, limit: 10 }),
      ).rejects.toThrow('rpc error');
    });
  });

  describe('deleteByArtifactId', () => {
    it('includes organization_id filter when tenantId is supplied', async () => {
      const eqCalls: Array<[string, string]> = [];

      // Build a delete chain that records every .eq() call
      const deleteChain: Record<string, unknown> = {};
      deleteChain['eq'] = (col: string, val: string) => {
        eqCalls.push([col, val]);
        return deleteChain;
      };
      deleteChain['select'] = () => Promise.resolve({ data: [{ id: 'chunk-1' }], error: null });

       
      vi.spyOn((store as any).supabase, 'from').mockReturnValue({
        delete: () => deleteChain,
      });

      const count = await store.deleteByArtifactId(ARTIFACT_ID, TENANT_ID);

      expect(count).toBe(1);
      const artifactFilter = eqCalls.find(([col]) => col === 'metadata->>artifact_id');
      const orgFilter = eqCalls.find(([col]) => col === 'organization_id');
      expect(artifactFilter).toBeDefined();
      expect(orgFilter).toBeDefined();
      expect(orgFilter![1]).toBe(TENANT_ID);
    });

    it('fails fast when tenantId is an empty string', async () => {
      await expect(store.deleteByArtifactId(ARTIFACT_ID, '')).rejects.toThrow('tenantId is required');
    });
  });

  describe('hybridSearch', () => {
    it('calls match_semantic_memory_hybrid RPC', async () => {
      mockRpc.mockResolvedValue({ data: [rpcRow], error: null });

      const results = await store.hybridSearch('cost reduction', EMBEDDING, TENANT_ID, {
        threshold: 0.6,
        limit: 5,
        vectorWeight: 0.7,
        ftsWeight: 0.3,
      });

      expect(mockRpc).toHaveBeenCalledWith('match_semantic_memory_hybrid', expect.objectContaining({
        query_text: 'cost reduction',
        p_organization_id: TENANT_ID,
      }));
      expect(results).toHaveLength(1);
      expect(results[0]!.combinedScore).toBe(0.88);
    });
  });
});
