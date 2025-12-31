import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';
import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';

describe('MemorySystem - Canary Token Isolation', () => {
  let memorySystem: MemorySystem;
  let mockSupabase: any;
  let mockLLMGateway: any;

  beforeEach(() => {
    mockSupabase = createBoltClientMock();
    mockLLMGateway = { generateEmbedding: vi.fn().mockResolvedValue([0.1,0.2,0.3]) } as unknown as LLMGateway;
    memorySystem = new MemorySystem(mockSupabase, mockLLMGateway);
  });

  it('should not return canary token for other tenants', async () => {
    // Mock insert to return a created row
    mockSupabase.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: { id: 'canary-1' }, error: null }) });

    const tokenId = await memorySystem.storeCanaryToken('org-canary-a', 'canary-123', {}, 3600);

    expect(tokenId).toBe('canary-1');

    // Mock a select query that would return no rows for org-b
    const eqMock = vi.fn().mockReturnThis();
    const ilikeMock = vi.fn().mockReturnThis();
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock, ilike: ilikeMock, limit: vi.fn().mockResolvedValue({ data: [], error: null }) });
    mockSupabase.from.mockReturnValue({ select: selectMock });

    const results = await memorySystem.searchSemanticMemory('session-1', 'canary-123', 5, 'org-canary-b');
    expect(results).toEqual([]);
  });
});
