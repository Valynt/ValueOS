import { describe, expect, it, beforeEach } from 'vitest';
import { AgentRegistry } from '../../services/AgentRegistry';
import { AgentRoutingLayer } from '../../services/AgentRoutingLayer';
import { AgentRoutingScorer } from '../../services/AgentRoutingScorer';
import { WorkflowDAG } from '../../types/workflow';

const TEST_HEARTBEAT_TIMEOUT_MS = 5000;

const retryConfig = {
  max_attempts: 2,
  initial_delay_ms: 100,
  max_delay_ms: 1000,
  multiplier: 2,
  jitter: false
};

const baseDag: WorkflowDAG = {
  id: 'dag',
  name: 'Routing DAG',
  description: 'tests',
  version: 1,
  stages: [
    {
      id: 'stage_one',
      name: 'Stage One',
      agent_type: 'opportunity',
      required_capabilities: ['analyze', 'plan'],
      timeout_seconds: 30,
      retry_config: retryConfig
    }
  ],
  transitions: [],
  initial_stage: 'stage_one',
  final_stages: ['stage_one'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const createLayer = () => {
  const registry = new AgentRegistry(TEST_HEARTBEAT_TIMEOUT_MS);
  const scorer = new AgentRoutingScorer();
  const layer = new AgentRoutingLayer(registry, scorer);
  return { registry, layer };
};

describe('AgentRoutingLayer', () => {
  let registry: AgentRegistry;
  let layer: AgentRoutingLayer;

  beforeEach(() => {
    const created = createLayer();
    registry = created.registry;
    layer = created.layer;
  });

  it('routes to healthiest agent that matches required capabilities and load', () => {
    registry.registerAgent({
      id: 'agent_a',
      name: 'North Analyst',
      lifecycle_stage: 'opportunity',
      capabilities: ['analyze', 'plan', 'summarize'],
      region: 'us'
    });
    registry.registerAgent({
      id: 'agent_b',
      name: 'Busy Planner',
      lifecycle_stage: 'opportunity',
      capabilities: ['plan'],
      region: 'eu'
    });
    registry.updateHeartbeat('agent_a', 0.2);
    registry.updateHeartbeat('agent_b', 0.05);

    const route = layer.routeStage(baseDag, 'stage_one', { region: 'us' });

    expect(route.selected_agent.id).toBe('agent_a');
    expect(route.fallback_agents.map(a => a.id)).toContain('agent_b');
    expect(route.score.capabilityScore).toBeGreaterThan(route.score.loadScore);
  });

  it('honors stickiness across calls even if load changes', () => {
    registry.registerAgent({
      id: 'sticky_agent',
      name: 'Sticky',
      lifecycle_stage: 'opportunity',
      capabilities: ['analyze', 'plan'],
      region: 'us'
    });
    registry.registerAgent({
      id: 'fresh_agent',
      name: 'Fresh',
      lifecycle_stage: 'opportunity',
      capabilities: ['analyze', 'plan'],
      region: 'us'
    });

    const firstRoute = layer.routeStage(baseDag, 'stage_one', { session_id: 'sess-1', region: 'us' });
    expect(firstRoute.selected_agent.id).toBe('sticky_agent');

    registry.updateHeartbeat('fresh_agent', 0);
    registry.updateHeartbeat('sticky_agent', 0.8);

    const secondRoute = layer.routeStage(baseDag, 'stage_one', { session_id: 'sess-1', region: 'us' });
    expect(secondRoute.selected_agent.id).toBe('sticky_agent');
    expect(secondRoute.sticky_session_applied).toBe(true);
  });

  it('falls back to degraded agent when healthy pool is exhausted and notes capability mismatches', () => {
    registry.registerAgent({
      id: 'healthy_but_old',
      name: 'Stale',
      lifecycle_stage: 'opportunity',
      capabilities: ['plan'],
      region: 'us'
    });
    const degraded = registry.registerAgent({
      id: 'degraded_agent',
      name: 'Degraded',
      lifecycle_stage: 'opportunity',
      capabilities: ['plan'],
      region: 'eu'
    });

    degraded.status = 'degraded';
    degraded.last_heartbeat = Date.now();

    // Force healthy agent to be marked offline by staleness
    const stale = registry.getAgent('healthy_but_old');
    if (stale) {
      stale.last_heartbeat = Date.now() - 10000;
    }

    const route = layer.routeStage(baseDag, 'stage_one', { region: 'eu' });

    expect(route.selected_agent.id).toBe('degraded_agent');
    expect(route.reason).toContain('missing capabilities');
    expect(route.reason).toContain('selected degraded agent');
  });
});
