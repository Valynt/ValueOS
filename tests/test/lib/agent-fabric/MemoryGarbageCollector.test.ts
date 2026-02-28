import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';
import { MemoryGarbageCollector } from '../../../src/lib/agent-fabric/MemoryGarbageCollector';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';

describe('Memory Garbage Collector', () => {
  let memorySystem: MemorySystem;
  let collector: MemoryGarbageCollector;
  let mockSupabase: any;
  let mockLLMGateway: any;

  beforeEach(() => {
    mockSupabase = createBoltClientMock();
    mockLLMGateway = {
      generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3])
    } as unknown as LLMGateway;
    memorySystem = new MemorySystem(mockSupabase, mockLLMGateway);
    collector = new MemoryGarbageCollector(memorySystem, mockSupabase);
  });

  it('should call RPC to prune expired memories and return deleted count', async () => {
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: [{ deleted_count: 3 }], error: null });
    const deleted = await collector.runOnce(100);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('prune_expired_agent_memories', { p_limit: 100 });
    expect(deleted).toBe(3);
  });

  it('should throw when RPC fails', async () => {
    mockSupabase.rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('something wrong') });
    await expect(collector.runOnce(10)).rejects.toThrow();
  });
});
