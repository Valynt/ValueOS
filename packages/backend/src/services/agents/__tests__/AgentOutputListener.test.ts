import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentOutputListener, agentOutputListener } from '../AgentOutputListener.js';
import { AgentOutput } from '../../../types/agent-output.js';
import { canvasSchemaService } from '../../sdui/CanvasSchemaService.js';
import { getComponentMutationService } from '../../sdui/ComponentMutationService.js';
import { agentSDUIAdapter } from '../AgentSDUIAdapter.js';
import { logger } from '../../../lib/logger.js';

// Mock dependencies
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../sdui/CanvasSchemaService.js', () => ({
  canvasSchemaService: {
    invalidateCache: vi.fn(),
    getCachedSchema: vi.fn(),
    cacheSchemaWithCAS: vi.fn(),
  },
}));

vi.mock('../../sdui/ComponentMutationService.js', () => ({
  getComponentMutationService: vi.fn(() => ({
    applyActions: vi.fn(),
  })),
}));

vi.mock('../AgentSDUIAdapter.js', () => ({
  agentSDUIAdapter: {
    processAgentOutputWithIntents: vi.fn(),
  },
}));

describe('AgentOutputListener', () => {
  let listener: AgentOutputListener;

  beforeEach(() => {
    listener = new AgentOutputListener();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lifecycle and basic operations', () => {
    it('instantiates correctly and is enabled by default', () => {
      expect(listener).toBeDefined();
      // Test using handleAgentOutput to see if it processes (i.e. enabled)
      const mockOutput: AgentOutput = { agent_id: '123', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      vi.spyOn(listener, 'emit');
      listener.handleAgentOutput(mockOutput);
      expect(listener.emit).toHaveBeenCalled();
    });

    it('can be disabled and enabled', async () => {
      const mockOutput: AgentOutput = { agent_id: '123', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      vi.spyOn(listener, 'emit');

      listener.disable();
      await listener.handleAgentOutput(mockOutput);
      expect(listener.emit).not.toHaveBeenCalled();

      listener.enable();
      await listener.handleAgentOutput(mockOutput);
      expect(listener.emit).toHaveBeenCalled();
    });
  });

  describe('Callback registration and execution', () => {
    it('registers and calls agent-specific callbacks', async () => {
      const callback = vi.fn();
      listener.onAgentOutput('agent-1', callback);

      const mockOutput1: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      const mockOutput2: AgentOutput = { agent_id: 'agent-2', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };

      await listener.handleAgentOutput(mockOutput1);
      expect(callback).toHaveBeenCalledWith(mockOutput1);

      callback.mockClear();
      await listener.handleAgentOutput(mockOutput2);
      expect(callback).not.toHaveBeenCalled();
    });

    it('registers and calls wildcard callbacks', async () => {
      const callback = vi.fn();
      listener.onAnyAgentOutput(callback);

      const mockOutput1: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      const mockOutput2: AgentOutput = { agent_id: 'agent-2', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };

      await listener.handleAgentOutput(mockOutput1);
      expect(callback).toHaveBeenCalledWith(mockOutput1);

      await listener.handleAgentOutput(mockOutput2);
      expect(callback).toHaveBeenCalledWith(mockOutput2);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('removes callbacks', async () => {
      const callback = vi.fn();
      listener.onAgentOutput('agent-1', callback);
      listener.removeCallback('agent-1', callback);

      const mockOutput1: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('clears all callbacks', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      listener.onAgentOutput('agent-1', callback1);
      listener.onAnyAgentOutput(callback2);

      listener.clearCallbacks();

      const mockOutput1: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput1);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('continues executing callbacks even if one fails', async () => {
      const callback1 = vi.fn().mockRejectedValue(new Error('test error'));
      const callback2 = vi.fn();

      listener.onAgentOutput('agent-1', callback1);
      listener.onAgentOutput('agent-1', callback2);

      const mockOutput1: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput1);

      expect(callback1).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Agent callback failed', expect.any(Object));
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('SDUI Processing', () => {
    it('processes SDUI full_schema update', async () => {
      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
        type: 'full_schema'
      });

      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput);

      expect(agentSDUIAdapter.processAgentOutputWithIntents).toHaveBeenCalled();
      expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith('ws-1');
    });

    it('processes SDUI atomic_actions update successfully', async () => {
      const mockActions = [{ type: 'mutate_component', selector: { id: 'c1' }, mutations: [] }];
      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
        type: 'atomic_actions',
        actions: mockActions as any
      });

      const mockSchema = { sections: [] };
      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(mockSchema as any);

      const mockMutationService = {
        applyActions: vi.fn().mockResolvedValue({
          layout: { sections: [{ component: 'Test' }] },
          results: [{ success: true }]
        })
      };
      vi.mocked(getComponentMutationService).mockReturnValue(mockMutationService as any);

      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput);

      expect(canvasSchemaService.getCachedSchema).toHaveBeenCalledWith('ws-1');
      expect(mockMutationService.applyActions).toHaveBeenCalledWith(mockSchema, mockActions);
      expect(canvasSchemaService.cacheSchemaWithCAS).toHaveBeenCalled();
    });

    it('handles atomic_actions failure - all actions fail', async () => {
      const mockActions = [{ type: 'mutate_component', selector: { id: 'c1' }, mutations: [] }];
      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
        type: 'atomic_actions',
        actions: mockActions as any
      });

      const mockSchema = { sections: [] };
      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(mockSchema as any);

      const mockMutationService = {
        applyActions: vi.fn().mockResolvedValue({
          layout: { sections: [] },
          results: [{ success: false }] // All failed
        })
      };
      vi.mocked(getComponentMutationService).mockReturnValue(mockMutationService as any);

      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput);

      expect(mockMutationService.applyActions).toHaveBeenCalled();
      expect(canvasSchemaService.cacheSchemaWithCAS).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('All atomic actions failed', expect.any(Object));
    });

    it('handles atomic_actions when no cached schema is found', async () => {
      const mockActions = [{ type: 'mutate_component', selector: { id: 'c1' }, mutations: [] }];
      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockResolvedValue({
        type: 'atomic_actions',
        actions: mockActions as any
      });

      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue(null);

      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };
      await listener.handleAgentOutput(mockOutput);

      expect(canvasSchemaService.invalidateCache).toHaveBeenCalledWith('ws-1');
      expect(logger.warn).toHaveBeenCalledWith('Could not apply atomic actions: No cached schema found', expect.any(Object));
    });

    it('handles general errors during SDUI processing safely', async () => {
      vi.mocked(agentSDUIAdapter.processAgentOutputWithIntents).mockRejectedValue(new Error('SDUI mapping error'));

      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };

      // Should not throw, but should log error and still emit complete event
      vi.spyOn(listener, 'emit');
      await listener.handleAgentOutput(mockOutput);

      expect(logger.error).toHaveBeenCalledWith('Failed to process agent output for SDUI', expect.any(Object));
      expect(listener.emit).toHaveBeenCalledWith('agent:complete', mockOutput);
    });
  });

  describe('Error handling in handleAgentOutput', () => {
    it('emits agent:error if something throws synchronously in handleAgentOutput', async () => {
      const mockOutput: AgentOutput = { agent_id: 'agent-1', agent_type: 'test', workspaceId: 'ws-1', status: 'success' };

      // Force an error in emit, which is the first thing handleAgentOutput does
      vi.spyOn(listener, 'emit').mockImplementation((event) => {
        if (event === 'agent:output') {
          throw new Error('Emit failed');
        }
        return true;
      });

      await listener.handleAgentOutput(mockOutput);

      expect(logger.error).toHaveBeenCalledWith('Failed to handle agent output', expect.any(Object));
      expect(listener.emit).toHaveBeenCalledWith('agent:error', {
        output: mockOutput,
        error: 'Emit failed'
      });
    });
  });

  describe('Singleton instance', () => {
    it('exports a pre-configured instance', () => {
      expect(agentOutputListener).toBeDefined();
      expect(agentOutputListener).toBeInstanceOf(AgentOutputListener);
    });
  });
});
