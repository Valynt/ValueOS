
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentOutputListener } from '../services/AgentOutputListener';
import { AgentOutput } from '../types/agent-output';

// Mock dependencies
const mockInvalidateCache = vi.fn();
const mockGetCachedSchema = vi.fn();
const mockCacheSchemaWithCAS = vi.fn();
const mockApplyActions = vi.fn();

vi.mock('../services/CanvasSchemaService', () => ({
  canvasSchemaService: {
    invalidateCache: (...args) => mockInvalidateCache(...args),
    getCachedSchema: (...args) => mockGetCachedSchema(...args),
    cacheSchemaWithCAS: (...args) => mockCacheSchemaWithCAS(...args),
  },
}));

vi.mock('../services/ComponentMutationService', () => ({
  getComponentMutationService: () => ({
    applyActions: (...args) => mockApplyActions(...args),
  }),
}));

const mockProcessAgentOutputWithIntents = vi.fn();
vi.mock('../services/AgentSDUIAdapter', () => ({
  agentSDUIAdapter: {
    processAgentOutputWithIntents: (...args) => mockProcessAgentOutputWithIntents(...args),
  },
}));

describe('AgentOutputListener', () => {
  let listener: AgentOutputListener;

  beforeEach(() => {
    listener = new AgentOutputListener();
    vi.clearAllMocks();
  });

  it('should process full_schema updates', async () => {
    const output: AgentOutput = {
      agentId: 'test-agent',
      agentType: 'orchestrator',
      workspaceId: 'ws-123',
      output: {},
      timestamp: Date.now(),
      confidence: 1.0,
      metadata: {},
    };

    mockProcessAgentOutputWithIntents.mockResolvedValue({
      type: 'full_schema',
    });

    await listener.handleAgentOutput(output);

    expect(mockInvalidateCache).toHaveBeenCalledWith('ws-123');
  });

  it('should process atomic_actions updates', async () => {
    const output: AgentOutput = {
      agentId: 'test-agent',
      agentType: 'orchestrator',
      workspaceId: 'ws-123',
      output: {},
      timestamp: Date.now(),
      confidence: 1.0,
      metadata: {},
    };

    const actions = [{ type: 'update_layout', layout: 'grid' }];
    mockProcessAgentOutputWithIntents.mockResolvedValue({
      type: 'atomic_actions',
      actions: actions,
    });

    // Setup for atomic actions flow
    const currentSchema = { sections: [] };
    mockGetCachedSchema.mockResolvedValue(currentSchema);

    const newSchema = { sections: [{ component: 'test' }] };
    mockApplyActions.mockResolvedValue({
      layout: newSchema,
      results: [{ success: true }],
    });

    await listener.handleAgentOutput(output);

    expect(mockGetCachedSchema).toHaveBeenCalledWith('ws-123');
    expect(mockApplyActions).toHaveBeenCalledWith(currentSchema, actions);
    expect(mockCacheSchemaWithCAS).toHaveBeenCalledWith('ws-123', newSchema);
  });
});
