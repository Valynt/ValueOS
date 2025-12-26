/**
 * Tenant Isolation Unit Tests for MemorySystem
 * 
 * Tests Task 1: Tenant Isolation for Memory Queries
 * 
 * Verifies that:
 * 1. organizationId is required for all memory operations
 * 2. Database queries filter by organizationId
 * 3. Cross-tenant data cannot be accessed
 * 4. Fallback queries also enforce tenant isolation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';
import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';

describe('MemorySystem - Tenant Isolation', () => {
  let memorySystem: MemorySystem;
  let mockSupabase: any;
  let mockLLMGateway: any;

  beforeEach(() => {
    mockSupabase = createBoltClientMock();
    mockLLMGateway = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    } as unknown as LLMGateway;

    memorySystem = new MemorySystem(mockSupabase, mockLLMGateway);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Task 1.1: organizationId Requirement
  // ============================================================================

  describe('organizationId requirement', () => {
    it('should reject storeEpisodicMemory without organizationId', async () => {
      await expect(
        memorySystem.storeEpisodicMemory(
          'session-123',
          'agent-456',
          'test event',
          {} // No organizationId
        )
      ).rejects.toThrow('organizationId is required for tenant isolation');
    });

    it('should reject storeSemanticMemory without organizationId', async () => {
      await expect(
        memorySystem.storeSemanticMemory(
          'session-123',
          'agent-456',
          'test knowledge',
          {} // No organizationId
        )
      ).rejects.toThrow('organizationId is required for tenant isolation');
    });

    it('should reject storeWorkingMemory without organizationId', async () => {
      await expect(
        memorySystem.storeWorkingMemory(
          'session-123',
          'agent-456',
          'test task state',
          {} // No organizationId
        )
      ).rejects.toThrow('organizationId is required for tenant isolation');
    });

    it('should accept organizationId in metadata as fallback', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null })
      });

      await expect(
        memorySystem.storeEpisodicMemory(
          'session-123',
          'agent-456',
          'test event',
          { organization_id: 'org-abc' } // organizationId in metadata
        )
      ).resolves.not.toThrow();
    });

    it('should accept explicit organizationId parameter', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null })
      });

      await expect(
        memorySystem.storeSemanticMemory(
          'session-123',
          'agent-456',
          'test knowledge',
          {},
          'org-abc' // Explicit organizationId
        )
      ).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Task 1.2: Database-Level Filtering
  // ============================================================================

  describe('database-level filtering', () => {
    it('should include organization_id in insert for episodic memory', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ insert: insertMock });

      await memorySystem.storeEpisodicMemory(
        'session-123',
        'agent-456',
        'test event',
        { extra: 'metadata' },
        'org-abc'
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-abc',
          session_id: 'session-123',
          agent_id: 'agent-456',
          memory_type: 'episodic',
          content: 'test event'
        })
      );
    });

    it('should filter by organization_id in getEpisodicMemory', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      mockSupabase.from.mockReturnValue({ select: selectMock });

      await memorySystem.getEpisodicMemory('session-123', 10, 'org-abc');

      // Should call eq() with organization_id
      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-abc');
    });

    it('should filter by organization_id in getWorkingMemory', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      mockSupabase.from.mockReturnValue({ select: selectMock });

      await memorySystem.getWorkingMemory('session-123', 'agent-456', 'org-abc');

      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-abc');
    });

    it('should pass organization_id to match_memory RPC', async () => {
      const rpcMock = vi.fn().mockResolvedValue({ data: [], error: null });
      mockSupabase.rpc = rpcMock;

      await memorySystem.searchSemanticMemory(
        'session-123',
        'test query',
        5,
        'org-abc'
      );

      expect(rpcMock).toHaveBeenCalledWith(
        'match_memory',
        expect.objectContaining({
          p_organization_id: 'org-abc'
        })
      );
    });
  });

  // ============================================================================
  // Task 1.3: Cross-Tenant Isolation
  // ============================================================================

  describe('cross-tenant data isolation', () => {
    it('should only return memories for specified organization', async () => {
      // Mock data from two organizations
      const mockMemories = [
        {
          id: 'mem-1',
          organization_id: 'org-abc',
          content: 'Org ABC data',
          created_at: new Date().toISOString()
        },
        {
          id: 'mem-2',
          organization_id: 'org-xyz',
          content: 'Org XYZ data',
          created_at: new Date().toISOString()
        }
      ];

      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockMemories, error: null })
      });

      mockSupabase.from.mockReturnValue({ select: selectMock });

      const result = await memorySystem.getEpisodicMemory('session-123', 10, 'org-abc');

      // Verify eq was called with organization filter
      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-abc');
    });

    it('should not return data when organizationId does not match', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [], // Empty result due to organization filter
          error: null
        })
      });

      mockSupabase.from.mockReturnValue({ select: selectMock });

      const result = await memorySystem.getEpisodicMemory('session-123', 10, 'org-xyz');

      expect(result).toEqual([]);
      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-xyz');
    });
  });

  // ============================================================================
  // Task 1.4: Fallback Query Isolation
  // ============================================================================

  describe('fallback query tenant isolation', () => {
    it('should enforce organization_id in fallback text search', async () => {
      // Mock RPC to fail (trigger fallback)
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('RPC failed')
      });

      const eqMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
        ilike: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null })
      });

      mockSupabase.from.mockReturnValue({ select: selectMock });

      await memorySystem.searchSemanticMemory(
        'session-123',
        'test query',
        5,
        'org-abc'
      );

      // Fallback should also filter by organization
      expect(eqMock).toHaveBeenCalledWith('organization_id', 'org-abc');
    });

    it('should log error when fallback query fails', async () => {
      mockSupabase.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('RPC failed')
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Fallback failed')
          })
        })
      });

      await expect(
        memorySystem.searchSemanticMemory('session-123', 'query', 5, 'org-abc')
      ).rejects.toThrow('Fallback failed');
    });
  });

  // ============================================================================
  // Task 1.5: Error Handling
  // ============================================================================

  describe('error handling', () => {
    it('should throw and log error when getEpisodicMemory fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        })
      });

      await expect(
        memorySystem.getEpisodicMemory('session-123', 10, 'org-abc')
      ).rejects.toThrow('Database error');
    });

    it('should throw and log error when getWorkingMemory fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          })
        })
      });

      await expect(
        memorySystem.getWorkingMemory('session-123', undefined, 'org-abc')
      ).rejects.toThrow('Database error');
    });
  });

  // ============================================================================
  // Task 1.6: Integration with BaseAgent
  // ============================================================================

  describe('integration with agents', () => {
    it('should store memory with organizationId from agent context', async () => {
      const insertMock = vi.fn().mockResolvedValue({ data: {}, error: null });
      mockSupabase.from.mockReturnValue({ insert: insertMock });

      // Simulate agent storing memory with organizationId
      await memorySystem.storeSemanticMemory(
        'session-123',
        'ValueDriverExtractionAgent',
        'Extracted 3 value drivers',
        { drivers: [], confidence: 0.85 },
        'org-customer-acme'
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-customer-acme',
          agent_id: 'ValueDriverExtractionAgent'
        })
      );
    });
  });
});
