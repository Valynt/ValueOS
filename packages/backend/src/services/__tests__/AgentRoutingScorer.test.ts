import { describe, expect, it } from 'vitest';

import type { AgentRecord, RoutingContext } from '../../services/AgentRegistry.js';
import {
  AgentRoutingScorer,
  DEFAULT_AGENT_SCORING_WEIGHTS,
} from '../../services/AgentRoutingScorer.js';
import type { WorkflowStage } from '../../types/workflow';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentRecord> & { id: string }): AgentRecord {
  return {
    name: overrides.id,
    lifecycle_stage: 'opportunity',
    capabilities: [],
    load: 0,
    status: 'healthy',
    last_heartbeat: Date.now(),
    consecutive_failures: 0,
    sticky_sessions: new Set(),
    ...overrides,
  };
}

function makeStage(overrides: Partial<WorkflowStage> = {}): WorkflowStage {
  return {
    id: 'stage_1',
    name: 'Test Stage',
    agent_type: 'opportunity',
    timeout_seconds: 30,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RoutingContext> = {}): RoutingContext {
  return { ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AgentRoutingScorer', () => {
  const scorer = new AgentRoutingScorer();

  describe('scoreCandidates — main execution path', () => {
    it('ranks agents by weighted score and returns all breakdown fields', () => {
      const stage = makeStage({ required_capabilities: ['analyze', 'plan'] });
      const agents = [
        makeAgent({ id: 'a1', capabilities: ['analyze'], load: 0.8, region: 'us-east' }),
        makeAgent({ id: 'a2', capabilities: ['analyze', 'plan'], load: 0.2, region: 'us-east' }),
      ];
      const context = makeContext({ region: 'us-east' });

      const result = scorer.scoreCandidates(stage, agents, context);

      // a2 has full capability match + lower load → should rank first
      expect(result.ranked[0].agent.id).toBe('a2');
      expect(result.ranked[1].agent.id).toBe('a1');

      // Verify breakdown fields are populated
      const top = result.ranked[0];
      expect(top.capabilityScore).toBe(1); // 2/2
      expect(top.loadScore).toBe(0.8); // 1 - 0.2
      expect(top.proximityScore).toBe(1); // same region
      expect(top.stickinessScore).toBe(0); // no sticky
      expect(top.capabilityMismatches).toEqual([]);

      // a1 missing 'plan'
      const second = result.ranked[1];
      expect(second.capabilityScore).toBe(0.5); // 1/2
      expect(second.capabilityMismatches).toEqual(['plan']);
    });

    it('gives capability score of 1 when no capabilities are required', () => {
      const stage = makeStage({ required_capabilities: [] });
      const agents = [makeAgent({ id: 'a1', capabilities: [] })];
      const context = makeContext();

      const result = scorer.scoreCandidates(stage, agents, context);
      expect(result.ranked[0].capabilityScore).toBe(1);
    });

    it('falls back to context.required_capabilities when stage has none', () => {
      const stage = makeStage(); // no required_capabilities
      const agents = [
        makeAgent({ id: 'a1', capabilities: ['analyze'] }),
        makeAgent({ id: 'a2', capabilities: [] }),
      ];
      const context = makeContext({ required_capabilities: ['analyze'] });

      const result = scorer.scoreCandidates(stage, agents, context);
      expect(result.ranked[0].agent.id).toBe('a1');
      expect(result.ranked[0].capabilityScore).toBe(1);
      expect(result.ranked[1].capabilityScore).toBe(0);
    });

    it('applies stickiness bonus and sets stickyApplied flag', () => {
      const stage = makeStage();
      const agents = [
        makeAgent({ id: 'a1', load: 0 }),
        makeAgent({ id: 'a2', load: 0 }),
      ];
      const context = makeContext();

      const withSticky = scorer.scoreCandidates(stage, agents, context, 'a2');
      expect(withSticky.stickyApplied).toBe(true);
      expect(withSticky.ranked[0].agent.id).toBe('a2');
      expect(withSticky.ranked[0].stickinessScore).toBe(1);

      const withoutSticky = scorer.scoreCandidates(stage, agents, context);
      expect(withoutSticky.stickyApplied).toBe(false);
    });

    it('scores region proximity: same=1, different=0.25, undefined=0.5', () => {
      const stage = makeStage();
      const agents = [
        makeAgent({ id: 'same', region: 'us-east', load: 0 }),
        makeAgent({ id: 'diff', region: 'eu-west', load: 0 }),
        makeAgent({ id: 'none', load: 0 }), // no region
      ];
      const context = makeContext({ region: 'us-east' });

      const result = scorer.scoreCandidates(stage, agents, context);
      const byId = Object.fromEntries(result.ranked.map(r => [r.agent.id, r]));

      expect(byId['same'].proximityScore).toBe(1);
      expect(byId['diff'].proximityScore).toBe(0.25);
      expect(byId['none'].proximityScore).toBe(0.5);
    });

    it('clamps load score to [0, 1] for agents with load >= 1', () => {
      const stage = makeStage();
      const agents = [makeAgent({ id: 'a1', load: 1.5 })];
      const context = makeContext();

      const result = scorer.scoreCandidates(stage, agents, context);
      expect(result.ranked[0].loadScore).toBe(0);
    });

    it('returns empty ranked array for empty candidates', () => {
      const result = scorer.scoreCandidates(makeStage(), [], makeContext());
      expect(result.ranked).toEqual([]);
    });
  });

  describe('custom weights', () => {
    it('respects custom scoring weights', () => {
      // Weight capability at 100%, everything else at 0
      const capOnlyScorer = new AgentRoutingScorer({
        capability: 1,
        load: 0,
        proximity: 0,
        stickiness: 0,
      });

      const stage = makeStage({ required_capabilities: ['analyze'] });
      const agents = [
        makeAgent({ id: 'capable', capabilities: ['analyze'], load: 0.9 }),
        makeAgent({ id: 'fast', capabilities: [], load: 0 }),
      ];

      const result = capOnlyScorer.scoreCandidates(stage, agents, makeContext());
      expect(result.ranked[0].agent.id).toBe('capable');
      expect(result.ranked[0].total).toBe(1);
      expect(result.ranked[1].total).toBe(0);
    });
  });
});
