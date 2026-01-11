import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetrievalEngine } from '../RetrievalEngine';
import { MemorySystem } from '../MemorySystem';
import { SupabaseClient } from '@supabase/supabase-js';
import { LLMGateway } from '../LLMGateway';

// Mock dependencies
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn().mockReturnThis(),
    list: vi.fn()
  }
} as unknown as SupabaseClient;

const mockLLMGateway = {
  generateEmbedding: vi.fn()
} as unknown as LLMGateway;

describe('RetrievalEngine', () => {
  let retrievalEngine: RetrievalEngine;
  let memorySystem: MemorySystem;
  const organizationId = 'org-123';
  const sessionId = 'session-123';

  beforeEach(() => {
    vi.clearAllMocks();
    memorySystem = new MemorySystem(mockSupabase, mockLLMGateway);

    // Spy on memorySystem methods
    vi.spyOn(memorySystem, 'getEpisodicMemory').mockResolvedValue([
      {
        id: '1',
        agent_id: 'agent-1',
        created_at: new Date().toISOString(),
        content: 'test content',
        metadata: { success: true },
        session_id: sessionId,
        memory_type: 'episodic',
        importance_score: 1,
        organization_id: organizationId
      }
    ]);

    vi.spyOn(memorySystem, 'searchSemanticMemory').mockResolvedValue([]);
    vi.spyOn(memorySystem, 'listStoredDocuments').mockResolvedValue([]);

    retrievalEngine = new RetrievalEngine(memorySystem, organizationId);
  });

  it('should pass organizationId to memorySystem.getEpisodicMemory', async () => {
    await retrievalEngine.retrieveContext(sessionId, 'test query', {
      use_episodic_memory: true,
      use_semantic_memory: false
    });

    expect(memorySystem.getEpisodicMemory).toHaveBeenCalledWith(
      sessionId,
      expect.any(Number),
      organizationId
    );
  });
});
