import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentMemoryIntegration } from '../AgentMemoryIntegration';

// Mock dependencies
vi.mock('../AgentAPI');
vi.mock('../../lib/agent-fabric/MemorySystem');
vi.mock('../../lib/agent-fabric/LLMGateway');
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

describe('AgentMemoryIntegration', () => {
  let integration: AgentMemoryIntegration;

  beforeEach(() => {
    vi.clearAllMocks();
    integration = new AgentMemoryIntegration();
  });

  describe('Memory-Enhanced Invocation', () => {
    it('should invoke agent with memory retrieval', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
        useMemory: true,
        sessionId: 'test-session',
      };

      // Mock AgentAPI response
      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunities: [] },
        tokenUsage: { totalTokens: 100 },
      });

      // Mock memory retrieval
      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([
        {
          task_intent: 'Previous similar task',
          success: true,
          reward_score: 0.8,
        },
      ]);
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      const response = await integration.invokeWithMemory(request);

      expect(response.success).toBe(true);
      expect(response.episodeId).toBe('episode-1');
      expect(response.similarEpisodes).toHaveLength(1);
      expect(response.memoryStats).toBeDefined();
      expect(response.memoryStats?.memoryStored).toBe(true);
    });

    it('should work without memory when disabled', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
        useMemory: false,
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunities: [] },
        tokenUsage: { totalTokens: 100 },
      });

      const response = await integration.invokeWithMemory(request);

      expect(response.success).toBe(true);
      expect(response.episodeId).toBeUndefined();
      expect(response.similarEpisodes).toBeUndefined();
    });

    it('should handle memory retrieval failures gracefully', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
        useMemory: true,
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: { opportunities: [] },
        tokenUsage: { totalTokens: 100 },
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi
        .fn()
        .mockRejectedValue(new Error('Memory error'));
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      // Should not throw despite memory failure
      const response = await integration.invokeWithMemory(request);

      expect(response.success).toBe(true);
      expect(response.similarEpisodes).toHaveLength(0);
    });
  });

  describe('Context Enhancement', () => {
    it('should enhance context with past experiences', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
        useMemory: true,
        context: { industry: 'tech' },
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      let capturedContext: any = null;
      
      mockAgentAPI.invokeAgent = vi.fn().mockImplementation((req: any) => {
        capturedContext = req.context;
        return Promise.resolve({
          success: true,
          data: {},
          tokenUsage: { totalTokens: 100 },
        });
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([
        {
          task_intent: 'Past task',
          success: true,
          reward_score: 0.8,
        },
      ]);
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      await integration.invokeWithMemory(request);

      expect(capturedContext).toBeDefined();
      expect(capturedContext.industry).toBe('tech');
      expect(capturedContext.pastExperiences).toBeDefined();
      expect(capturedContext.pastExperiences).toHaveLength(1);
      expect(capturedContext.memoryNote).toContain('past experiences');
    });
  });

  describe('Episode Storage', () => {
    it('should store successful episodes', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
        sessionId: 'test-session',
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: { result: 'success' },
        tokenUsage: { totalTokens: 200 },
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([]);
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      await integration.invokeWithMemory(request);

      expect(mockMemorySystem.storeEpisode).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          agentId: 'opportunity',
          success: true,
        })
      );

      expect(mockMemorySystem.storeEpisodicMemory).toHaveBeenCalled();
    });

    it('should not store episodes when agent fails', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Find market opportunities',
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: false,
        error: 'Agent failed',
        tokenUsage: { totalTokens: 50 },
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([]);
      mockMemorySystem.storeEpisode = vi.fn();

      await integration.invokeWithMemory(request);

      expect(mockMemorySystem.storeEpisode).not.toHaveBeenCalled();
    });
  });

  describe('Reward Scoring', () => {
    it('should calculate higher reward for successful responses', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Test query',
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: {},
        tokenUsage: { totalTokens: 100 },
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([]);
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      await integration.invokeWithMemory(request);

      const storeCall = mockMemorySystem.storeEpisode.mock.calls[0][0];
      expect(storeCall.rewardScore).toBeGreaterThan(0.5);
    });
  });

  describe('Session Management', () => {
    it('should generate session ID if not provided', async () => {
      const request = {
        agent: 'opportunity' as const,
        query: 'Test query',
      };

      const mockAgentAPI = integration.getAgentAPI() as any;
      mockAgentAPI.invokeAgent = vi.fn().mockResolvedValue({
        success: true,
        data: {},
        tokenUsage: { totalTokens: 100 },
      });

      const mockMemorySystem = integration.getMemorySystem() as any;
      mockMemorySystem.retrieveSimilarEpisodes = vi.fn().mockResolvedValue([]);
      mockMemorySystem.storeEpisode = vi.fn().mockResolvedValue('episode-1');
      mockMemorySystem.storeEpisodicMemory = vi.fn().mockResolvedValue(undefined);

      await integration.invokeWithMemory(request);

      const storeCall = mockMemorySystem.storeEpisode.mock.calls[0][0];
      expect(storeCall.sessionId).toMatch(/^session_/);
    });
  });
});
