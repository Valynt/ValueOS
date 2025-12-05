import { describe, expect, it, beforeEach } from 'vitest';
import { AgentRegistry } from '../../services/AgentRegistry';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry(5000);
  });

  describe('registerAgent', () => {
    it('successfully registers a new agent', () => {
      const agent = registry.registerAgent({
        id: 'agent_1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze', 'plan']
      });

      expect(agent.id).toBe('agent_1');
      expect(agent.name).toBe('Test Agent');
      expect(agent.load).toBe(0);
      expect(agent.status).toBe('healthy');
      expect(agent.consecutive_failures).toBe(0);
      expect(agent.sticky_sessions.size).toBe(0);
    });

    it('throws an error when attempting to register an agent with an existing ID', () => {
      // Register the first agent
      registry.registerAgent({
        id: 'agent_duplicate',
        name: 'First Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze']
      });

      // Attempt to register a second agent with the same ID
      expect(() => {
        registry.registerAgent({
          id: 'agent_duplicate',
          name: 'Second Agent',
          lifecycle_stage: 'target',
          capabilities: ['plan']
        });
      }).toThrow("Agent with ID 'agent_duplicate' is already registered");
    });

    it('preserves state when duplicate registration is prevented', () => {
      // Register the first agent
      const originalAgent = registry.registerAgent({
        id: 'agent_state',
        name: 'Original Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze']
      });

      // Modify the agent's state
      registry.updateHeartbeat('agent_state', 0.5, 'healthy');
      registry.markStickySession('session_1', 'agent_state');

      // Attempt to register a duplicate
      try {
        registry.registerAgent({
          id: 'agent_state',
          name: 'Duplicate Agent',
          lifecycle_stage: 'target',
          capabilities: ['plan']
        });
      } catch (e) {
        // Expected error
      }

      // Verify the original agent's state is preserved
      const agent = registry.getAgent('agent_state');
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Original Agent');
      expect(agent?.load).toBe(0.5);
      expect(agent?.sticky_sessions.has('session_1')).toBe(true);
    });
  });
});
