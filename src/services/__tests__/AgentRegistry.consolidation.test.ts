/**
 * AgentRegistry Consolidation Tests
 * 
 * Tests for the updated AgentRegistry that uses canonical agent types
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentRegistry,
  AgentRegistration,
  AgentRecord,
  AgentState,
  fromCanonicalRegistration,
  toCanonicalRecord,
  RoutingContext,
} from '../AgentRegistry';
import {
  AgentRegistration as CanonicalAgentRegistration,
  AgentRecord as CanonicalAgentRecord,
} from '../../types/agent';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('Agent Registration', () => {
    it('should register new agent', () => {
      const registration: AgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze', 'recommend'],
      };

      const record = registry.registerAgent(registration);

      expect(record.id).toBe('agent-1');
      expect(record.name).toBe('Test Agent');
      expect(record.lifecycle_stage).toBe('opportunity');
      expect(record.capabilities).toEqual(['analyze', 'recommend']);
    });

    it('should initialize agent with healthy status', () => {
      const registration: AgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      };

      const record = registry.registerAgent(registration);

      expect(record.status).toBe('healthy');
      expect(record.load).toBe(0);
      expect(record.consecutive_failures).toBe(0);
    });

    it('should throw on duplicate registration', () => {
      const registration: AgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      };

      registry.registerAgent(registration);

      expect(() => registry.registerAgent(registration)).toThrow(
        "Agent with ID 'agent-1' is already registered"
      );
    });

    it('should allow optional fields', () => {
      const registration: AgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze'],
        region: 'us-east-1',
        endpoint: 'http://localhost:8080',
        metadata: { version: '1.0.0' },
      };

      const record = registry.registerAgent(registration);

      expect(record.region).toBe('us-east-1');
      expect(record.endpoint).toBe('http://localhost:8080');
      expect(record.metadata?.version).toBe('1.0.0');
    });
  });

  describe('Agent Retrieval', () => {
    it('should get agent by ID', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      const agent = registry.getAgent('agent-1');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('agent-1');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.getAgent('non-existent');
      expect(agent).toBeUndefined();
    });
  });

  describe('Heartbeat Management', () => {
    it('should update heartbeat timestamp', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      const before = registry.getAgent('agent-1')?.last_heartbeat;
      
      // Wait a bit to ensure timestamp difference
      const updated = registry.updateHeartbeat('agent-1');

      expect(updated?.last_heartbeat).toBeGreaterThanOrEqual(before!);
    });

    it('should update load on heartbeat', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.updateHeartbeat('agent-1', 0.5);
      const agent = registry.getAgent('agent-1');

      expect(agent?.load).toBe(0.5);
    });

    it('should clamp load between 0 and 1', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.updateHeartbeat('agent-1', 1.5);
      expect(registry.getAgent('agent-1')?.load).toBe(1);

      registry.updateHeartbeat('agent-1', -0.5);
      expect(registry.getAgent('agent-1')?.load).toBe(0);
    });

    it('should reset consecutive failures on heartbeat', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordFailure('agent-1');
      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.consecutive_failures).toBe(2);

      registry.updateHeartbeat('agent-1');
      expect(registry.getAgent('agent-1')?.consecutive_failures).toBe(0);
    });
  });

  describe('Load Management', () => {
    it('should increment load on assignment', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordAssignment('agent-1');
      expect(registry.getAgent('agent-1')?.load).toBe(0.1);

      registry.recordAssignment('agent-1');
      expect(registry.getAgent('agent-1')?.load).toBe(0.2);
    });

    it('should decrement load on release', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordAssignment('agent-1');
      registry.recordAssignment('agent-1');
      expect(registry.getAgent('agent-1')?.load).toBe(0.2);

      registry.recordRelease('agent-1');
      expect(registry.getAgent('agent-1')?.load).toBeCloseTo(0.15);
    });

    it('should not exceed max load of 1', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      // Assign 15 times (would be 1.5 without clamping)
      for (let i = 0; i < 15; i++) {
        registry.recordAssignment('agent-1');
      }

      expect(registry.getAgent('agent-1')?.load).toBe(1);
    });

    it('should not go below 0 load', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordRelease('agent-1');
      registry.recordRelease('agent-1');

      expect(registry.getAgent('agent-1')?.load).toBe(0);
    });
  });

  describe('Failure Tracking', () => {
    it('should track consecutive failures', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.consecutive_failures).toBe(1);

      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.consecutive_failures).toBe(2);
    });

    it('should mark agent as degraded after 2 failures', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.status).toBe('healthy');

      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.status).toBe('degraded');
    });

    it('should mark agent as offline after 3 failures', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordFailure('agent-1');
      registry.recordFailure('agent-1');
      registry.recordFailure('agent-1');

      expect(registry.getAgent('agent-1')?.status).toBe('offline');
    });

    it('should allow marking agent as healthy', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.recordFailure('agent-1');
      registry.recordFailure('agent-1');
      registry.recordFailure('agent-1');
      expect(registry.getAgent('agent-1')?.status).toBe('offline');

      registry.markHealthy('agent-1');
      expect(registry.getAgent('agent-1')?.status).toBe('healthy');
      expect(registry.getAgent('agent-1')?.consecutive_failures).toBe(0);
    });
  });

  describe('Lifecycle Stage Filtering', () => {
    beforeEach(() => {
      registry.registerAgent({
        id: 'opp-1',
        name: 'Opportunity 1',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });
      registry.registerAgent({
        id: 'opp-2',
        name: 'Opportunity 2',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });
      registry.registerAgent({
        id: 'target-1',
        name: 'Target 1',
        lifecycle_stage: 'target',
        capabilities: [],
      });
    });

    it('should get agents by lifecycle stage', () => {
      const opportunityAgents = registry.getAgentsByLifecycle('opportunity');

      expect(opportunityAgents).toHaveLength(2);
      expect(opportunityAgents.every(a => a.lifecycle_stage === 'opportunity')).toBe(true);
    });

    it('should exclude offline agents', () => {
      registry.recordFailure('opp-1');
      registry.recordFailure('opp-1');
      registry.recordFailure('opp-1');

      const agents = registry.getAgentsByLifecycle('opportunity');

      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe('opp-2');
    });

    it('should include degraded agents when requested', () => {
      registry.recordFailure('opp-1');
      registry.recordFailure('opp-1');

      const withDegraded = registry.getAgentsByLifecycle('opportunity', true);
      const withoutDegraded = registry.getAgentsByLifecycle('opportunity', false);

      expect(withDegraded).toHaveLength(2);
      expect(withoutDegraded).toHaveLength(1);
    });

    it('should sort by load (ascending)', () => {
      registry.recordAssignment('opp-2');
      registry.recordAssignment('opp-2');
      registry.recordAssignment('opp-2');

      const agents = registry.getAgentsByLifecycle('opportunity');

      expect(agents[0].id).toBe('opp-1');
      expect(agents[1].id).toBe('opp-2');
    });
  });

  describe('Sticky Sessions', () => {
    it('should mark sticky session', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.markStickySession('session-1', 'agent-1');

      const agent = registry.getAgent('agent-1');
      expect(agent?.sticky_sessions.has('session-1')).toBe(true);
    });

    it('should release sticky session', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.markStickySession('session-1', 'agent-1');
      registry.releaseStickySession('session-1', 'agent-1');

      const agent = registry.getAgent('agent-1');
      expect(agent?.sticky_sessions.has('session-1')).toBe(false);
    });

    it('should get sticky agent for session', () => {
      registry.registerAgent({
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: [],
      });

      registry.markStickySession('session-1', 'agent-1');

      const stickyAgent = registry.getStickyAgent('session-1');
      expect(stickyAgent?.id).toBe('agent-1');
    });

    it('should return undefined for non-sticky session', () => {
      const stickyAgent = registry.getStickyAgent('non-existent');
      expect(stickyAgent).toBeUndefined();
    });
  });
});

describe('Type Conversion Helpers', () => {
  describe('fromCanonicalRegistration()', () => {
    it('should convert canonical to registry format', () => {
      const canonical: CanonicalAgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycleStage: 'opportunity',
        capabilities: ['analyze'],
        region: 'us-east-1',
        endpoint: 'http://localhost',
        metadata: { version: '1.0' },
      };

      const result = fromCanonicalRegistration(canonical);

      expect(result.id).toBe('agent-1');
      expect(result.lifecycle_stage).toBe('opportunity');
      expect(result.capabilities).toEqual(['analyze']);
      expect(result.region).toBe('us-east-1');
    });
  });

  describe('toCanonicalRecord()', () => {
    it('should convert registry to canonical format', () => {
      const record: AgentRecord = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycle_stage: 'opportunity',
        capabilities: ['analyze'],
        load: 0.5,
        status: 'healthy',
        last_heartbeat: Date.now(),
        consecutive_failures: 0,
        sticky_sessions: new Set(['session-1']),
      };

      const result = toCanonicalRecord(record);

      expect(result.id).toBe('agent-1');
      expect(result.lifecycleStage).toBe('opportunity');
      expect(result.load).toBe(0.5);
      expect(result.status).toBe('healthy');
      expect(result.stickySessions.has('session-1')).toBe(true);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve data through round-trip', () => {
      const canonical: CanonicalAgentRegistration = {
        id: 'agent-1',
        name: 'Test Agent',
        lifecycleStage: 'opportunity',
        capabilities: ['analyze', 'recommend'],
      };

      const registry = new AgentRegistry();
      const registryFormat = fromCanonicalRegistration(canonical);
      const record = registry.registerAgent(registryFormat);
      const backToCanonical = toCanonicalRecord(record);

      expect(backToCanonical.id).toBe(canonical.id);
      expect(backToCanonical.name).toBe(canonical.name);
      expect(backToCanonical.lifecycleStage).toBe(canonical.lifecycleStage);
      expect(backToCanonical.capabilities).toEqual(canonical.capabilities);
    });
  });
});
