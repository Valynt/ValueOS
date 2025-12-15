import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';
import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';

describe('MemorySystem - Garbage Collection & TTL', () => {
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

  it('should call set_memory_ttl RPC when setting TTL', async () => {
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const id = 'mem-123';
    const expireAt = new Date(Date.now() + 1000 * 60 * 60);
    await memorySystem.setMemoryTTL(id, expireAt);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('set_memory_ttl', { p_id: id, p_expires_at: expireAt });
  });
});
