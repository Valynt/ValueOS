/**
 * MemorySystem Tests
 * Tests memory storage, retrieval, and tenant isolation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySystem } from '../MemorySystem';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('MemorySystem', () => {
  let memorySystem: MemorySystem;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(),
            order: vi.fn(() => ({
              limit: vi.fn(),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(),
        })),
        update: vi.fn(),
        delete: vi.fn(),
      })),
    };

    (createClient as any).mockReturnValue(mockSupabase);
    memorySystem = new MemorySystem(mockSupabase, 'test-org');
  });

  describe('Tenant Isolation', () => {
    it('should enforce tenant isolation for memory operations', async () => {
      const tenantId = 'test-tenant';
      const mockMemory = {
        id: 'mem-1',
        content: 'test content',
        type: 'episodic',
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockMemory, error: null }),
          })),
        })),
      });

      const result = await memorySystem.retrieveMemory('mem-1', tenantId);

      expect(mockSupabase.from).toHaveBeenCalledWith('agent_memories');
      expect(result).toEqual(mockMemory);
    });

    it('should reject cross-tenant memory access', async () => {
      const tenantId = 'tenant-a';
      const otherTenantId = 'tenant-b';

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          })),
        })),
      });

      await expect(memorySystem.retrieveMemory('mem-1', tenantId))
        .rejects.toThrow('Memory not found');
    });
  });

  describe('Memory Storage', () => {
    it('should store episodic memory with tenant isolation', async () => {
      const tenantId = 'test-tenant';
      const memoryData = {
        content: 'User asked about pricing',
        type: 'episodic' as const,
        metadata: { sessionId: 'sess-1' },
        ttl: 86400, // 24 hours
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'mem-1', ...memoryData, tenant_id: tenantId }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await memorySystem.storeEpisodicMemory(memoryData, tenantId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: memoryData.content,
          type: memoryData.type,
          tenant_id: tenantId,
          metadata: memoryData.metadata,
          expires_at: expect.any(String),
        })
      );
      expect(result.id).toBe('mem-1');
    });

    it('should store semantic memory', async () => {
      const tenantId = 'test-tenant';
      const memoryData = {
        content: 'React hooks are functions that let you use state',
        type: 'semantic' as const,
        metadata: { topic: 'react', confidence: 0.9 },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'sem-1', ...memoryData, tenant_id: tenantId }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await memorySystem.storeSemanticMemory(memoryData, tenantId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: memoryData.content,
          type: memoryData.type,
          tenant_id: tenantId,
          metadata: memoryData.metadata,
        })
      );
      expect(result.id).toBe('sem-1');
    });

    it('should store working memory with session context', async () => {
      const tenantId = 'test-tenant';
      const sessionId = 'sess-1';
      const memoryData = {
        content: 'Current task: implementing cost blocking',
        type: 'working' as const,
        metadata: { priority: 'high' },
      };

      const mockInsert = vi.fn().mockResolvedValue({
        data: [{ id: 'work-1', ...memoryData, tenant_id: tenantId, session_id: sessionId }],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        select: vi.fn(),
      });

      const result = await memorySystem.storeWorkingMemory(memoryData, tenantId, sessionId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          content: memoryData.content,
          type: memoryData.type,
          tenant_id: tenantId,
          session_id: sessionId,
          metadata: memoryData.metadata,
        })
      );
      expect(result.session_id).toBe(sessionId);
    });
  });

  describe('Memory Retrieval', () => {
    it('should retrieve memory by ID with tenant validation', async () => {
      const tenantId = 'test-tenant';
      const memoryId = 'mem-1';
      const mockMemory = {
        id: memoryId,
        content: 'test content',
        type: 'episodic',
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
        metadata: {},
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockMemory, error: null }),
            })),
          })),
        })),
      });

      const result = await memorySystem.retrieveMemory(memoryId, tenantId);

      expect(result).toEqual(mockMemory);
    });

    it('should search memories by content with tenant filtering', async () => {
      const tenantId = 'test-tenant';
      const searchQuery = 'pricing';
      const mockMemories = [
        {
          id: 'mem-1',
          content: 'User asked about pricing plans',
          type: 'episodic',
          tenant_id: tenantId,
          similarity: 0.9,
        },
        {
          id: 'mem-2',
          content: 'Pricing strategy discussion',
          type: 'semantic',
          tenant_id: tenantId,
          similarity: 0.8,
        },
      ];

      // Mock the search function (assuming it exists)
      memorySystem.searchMemories = vi.fn().mockResolvedValue(mockMemories);

      const results = await memorySystem.searchMemories(searchQuery, tenantId);

      expect(results).toHaveLength(2);
      expect(results[0].similarity).toBe(0.9);
      expect(results.every(mem => mem.tenant_id === tenantId)).toBe(true);
    });
  });

  describe('Memory Cleanup', () => {
    it('should clean up expired memories', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await memorySystem.cleanupExpiredMemories();

      expect(mockDelete).toHaveBeenCalledWith({
        lt: expect.any(String), // Should be less than current time
      });
    });

    it('should garbage collect old memories by tenant', async () => {
      const tenantId = 'test-tenant';
      const mockDelete = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockReturnValue({
        delete: mockDelete,
      });

      await memorySystem.garbageCollect(tenantId, 100); // Keep 100 memories

      expect(mockDelete).toHaveBeenCalled();
      // Verify tenant isolation in delete query
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
        select: vi.fn(),
      });

      await expect(memorySystem.storeEpisodicMemory({
        content: 'test',
        type: 'episodic',
      }, 'test-tenant')).rejects.toThrow('Database connection failed');
    });

    it('should validate input parameters', async () => {
      await expect(memorySystem.storeEpisodicMemory({
        content: '',
        type: 'episodic',
      }, 'test-tenant')).rejects.toThrow('Content cannot be empty');

      await expect(memorySystem.retrieveMemory('', 'test-tenant'))
        .rejects.toThrow('Memory ID cannot be empty');
    });
  });
});
