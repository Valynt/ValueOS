import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseSemanticStore } from '../SupabaseSemanticStore.js';
import type { SemanticFact } from '@valueos/memory';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpdateRow = vi.fn();
const mockRpc = vi.fn();
const mockEq = vi.fn();
const mockEqInner = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();

// Flexible builder: every method returns `this` so chains work regardless of order.
// Individual mocks override specific terminal calls.
function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder['insert'] = mockInsert;
  builder['update'] = (v: unknown) => { mockUpdateRow(v); return builder; };
  builder['select'] = self;
  builder['eq'] = mockEq;
  builder['order'] = mockOrder;
  builder['single'] = mockSingle;
  builder['maybeSingle'] = mockMaybeSingle;
  return builder;
}

vi.mock('../../supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: () => makeBuilder(),
    rpc: mockRpc,
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const FACT_ID = '00000000-0000-0000-0000-000000000002';
const EMBEDDING = new Array(1536).fill(0.1);

const baseFact: SemanticFact = {
  id: FACT_ID,
  type: 'opportunity',
  content: 'Cloud migration reduces infra cost by 40%',
  embedding: EMBEDDING,
  metadata: { source_agent: 'OpportunityAgent' },
  status: 'draft',
  version: 1,
  organizationId: ORG_ID,
  confidenceScore: 0.85,
  createdAt: '2026-03-22T00:00:00Z',
  updatedAt: '2026-03-22T00:00:00Z',
};

const dbRow = {
  id: FACT_ID,
  organization_id: ORG_ID,
  type: 'opportunity',
  content: 'Cloud migration reduces infra cost by 40%',
  embedding: EMBEDDING,
  metadata: {
    source_agent: 'OpportunityAgent',
    status: 'draft',
    version: 1,
    confidence_score: 0.85,
  },
  source_agent: 'OpportunityAgent',
  session_id: null,
  created_at: '2026-03-22T00:00:00Z',
  updated_at: '2026-03-22T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupabaseSemanticStore', () => {
  let store: SupabaseSemanticStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new SupabaseSemanticStore();
  });

  describe('insert', () => {
    it('inserts a fact row without error', async () => {
      mockInsert.mockResolvedValue({ error: null });

      await expect(store.insert(baseFact)).resolves.toBeUndefined();
      expect(mockInsert).toHaveBeenCalledOnce();

      const insertArg = mockInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(insertArg['id']).toBe(FACT_ID);
      expect(insertArg['organization_id']).toBe(ORG_ID);
      expect(insertArg['type']).toBe('opportunity');
    });

    it('throws when Supabase returns an error', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'insert failed' } });

      await expect(store.insert(baseFact)).rejects.toThrow('insert failed');
    });
  });

  describe('findById', () => {
    it('returns a mapped SemanticFact when row exists', async () => {
      // builder.eq() → builder, builder.maybeSingle() resolves
      mockEq.mockReturnThis();
      mockMaybeSingle.mockResolvedValue({ data: dbRow, error: null });

      const result = await store.findById(FACT_ID);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(FACT_ID);
      expect(result!.organizationId).toBe(ORG_ID);
      expect(result!.type).toBe('opportunity');
      expect(result!.status).toBe('draft');
    });

    it('returns null when row does not exist', async () => {
      mockEq.mockReturnThis();
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const result = await store.findById(FACT_ID);
      expect(result).toBeNull();
    });
  });

  describe('findByOrganization', () => {
    it('returns all facts for an organization', async () => {
      mockEq.mockReturnThis();
      mockOrder.mockResolvedValue({ data: [dbRow], error: null });

      const results = await store.findByOrganization(ORG_ID);

      expect(results).toHaveLength(1);
      expect(results[0]!.organizationId).toBe(ORG_ID);
    });

    it('filters by type when provided', async () => {
      mockEq.mockReturnThis();
      mockOrder.mockResolvedValue({ data: [dbRow], error: null });

      const results = await store.findByOrganization(ORG_ID, 'opportunity');
      expect(results).toHaveLength(1);
    });
  });

  describe('searchByEmbedding', () => {
    it('calls match_semantic_memory RPC with correct args', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            id: FACT_ID,
            type: 'opportunity',
            content: 'Cloud migration',
            metadata: { status: 'approved', version: 1, confidence_score: 0.9 },
            source_agent: 'OpportunityAgent',
            session_id: null,
            similarity: 0.92,
            created_at: '2026-03-22T00:00:00Z',
          },
        ],
        error: null,
      });

      const results = await store.searchByEmbedding(EMBEDDING, ORG_ID, {
        threshold: 0.7,
        limit: 10,
      });

      expect(mockRpc).toHaveBeenCalledWith('match_semantic_memory', {
        query_embedding: EMBEDDING,
        p_organization_id: ORG_ID,
        match_threshold: 0.7,
        match_count: 10,
        p_type: null,
      });
      expect(results).toHaveLength(1);
      expect(results[0]!.similarity).toBe(0.92);
    });

    it('filters by statusFilter client-side', async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            id: FACT_ID,
            type: 'opportunity',
            content: 'Cloud migration',
            metadata: { status: 'draft' },
            source_agent: 'OpportunityAgent',
            session_id: null,
            similarity: 0.88,
            created_at: '2026-03-22T00:00:00Z',
          },
        ],
        error: null,
      });

      // Only want 'approved' — draft row should be filtered out
      const results = await store.searchByEmbedding(EMBEDDING, ORG_ID, {
        threshold: 0.7,
        limit: 10,
        statusFilter: ['approved'],
      });

      expect(results).toHaveLength(0);
    });

    it('throws when RPC returns an error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

      await expect(
        store.searchByEmbedding(EMBEDDING, ORG_ID, { threshold: 0.7, limit: 10 }),
      ).rejects.toThrow('rpc failed');
    });
  });
});
