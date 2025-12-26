import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySystem } from '../../../src/lib/agent-fabric/MemorySystem';
import { createBoltClientMock } from '../../mocks/mockSupabaseClient';
import { LLMGateway } from '../../../src/lib/agent-fabric/LLMGateway';

describe('MemorySystem - Provenance', () => {
  let memorySystem: MemorySystem;
  let mockSupabase: any;
  let mockLLMGateway: any;

  beforeEach(() => {
    mockSupabase = createBoltClientMock();
    mockLLMGateway = { generateEmbedding: vi.fn().mockResolvedValue([0.1,0.2,0.3]) } as unknown as LLMGateway;
    memorySystem = new MemorySystem(mockSupabase, mockLLMGateway);
  });

  it('should insert provenance row linking to memory', async () => {
    mockSupabase.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: {}, error: null }) });

    await memorySystem.addMemoryProvenance('mem-1', 'documents', 'doc-123', { confidence: 0.9 });

    expect(mockSupabase.from).toHaveBeenCalledWith('memory_provenance');
    expect(mockSupabase.from().insert).toHaveBeenCalledWith(expect.objectContaining({ memory_id: 'mem-1', source_table: 'documents', source_id: 'doc-123' }));
  });
});
