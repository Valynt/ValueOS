/**
 * Cross-Component Integration E2E Tests
 * 
 * Tests integration between UI components, agents, services, and data layers.
 * Validates data flow, event propagation, and system-wide interactions.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';
import { IntegrityAgent } from '../../lib/agent-fabric/agents/IntegrityAgent';
import { RealizationAgent } from '../../lib/agent-fabric/agents/RealizationAgent';

describe('CrossComponentIntegration - Agent to Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('integrates opportunity agent with semantic memory service', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: 'Enterprise seeking automation',
      use_semantic_memory: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('semantic_matches');
  });

  it('integrates target agent with financial modeling service', async () => {
    const targetAgent = new TargetAgent({} as any);

    const result = await targetAgent.invoke({
      opportunity_id: 'opp-1',
      use_financial_modeling: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('roi_model');
    expect(result.data.roi_model).toHaveProperty('calculations');
  });

  it('integrates expansion agent with value mapping service', async () => {
    const expansionAgent = new ExpansionAgent({} as any);

    const result = await expansionAgent.invoke({
      value_tree_id: 'tree-1',
      use_value_mapping: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('value_mappings');
  });

  it('integrates integrity agent with validation service', async () => {
    const integrityAgent = new IntegrityAgent({} as any);

    const result = await integrityAgent.invoke({
      roi_model_id: 'roi-1',
      validate: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('validation_results');
  });

  it('integrates realization agent with feedback loop service', async () => {
    const realizationAgent = new RealizationAgent({} as any);

    const result = await realizationAgent.invoke({
      value_commit_id: 'commit-1',
      track_feedback: true,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('feedback_loops');
  });
});

describe('CrossComponentIntegration - Service to Repository', () => {
  it('persists opportunity data through repository layer', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const createResult = await opportunityAgent.invoke({
      customer_context: 'Test opportunity',
    });

    expect(createResult.success).toBe(true);

    const opportunityId = createResult.data.opportunity_id;

    const retrieveResult = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: opportunityId,
    });

    expect(retrieveResult.success).toBe(true);
    expect(retrieveResult.data.opportunity_id).toBe(opportunityId);
  });

  it('maintains referential integrity across repositories', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Test opportunity',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(targetResult.success).toBe(true);
    expect(targetResult.data.opportunity_id).toBe(oppResult.data.opportunity_id);
  });

  it('handles cascading deletes correctly', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Test opportunity',
    });

    await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const deleteResult = await opportunityAgent.invoke({
      action: 'delete',
      opportunity_id: oppResult.data.opportunity_id,
      cascade: true,
    });

    expect(deleteResult.success).toBe(true);

    const retrieveResult = await targetAgent.invoke({
      action: 'get',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(retrieveResult.success).toBe(false);
  });
});

describe('CrossComponentIntegration - UI to Agent', () => {
  it('handles UI-triggered agent invocation', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const uiPayload = {
      customer_context: 'User input from UI',
      pain_points: ['Manual processes'],
      source: 'ui',
    };

    const result = await opportunityAgent.invoke(uiPayload);

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('opportunity_id');
  });

  it('propagates UI events through agent layer', async () => {
    const targetAgent = new TargetAgent({} as any);

    const events: any[] = [];

    const eventHandler = (event: any) => {
      events.push(event);
    };

    await targetAgent.invoke({
      opportunity_id: 'opp-1',
      on_event: eventHandler,
    });

    expect(events.length).toBeGreaterThan(0);
  });

  it('validates UI input before agent processing', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const invalidPayload = {
      customer_context: '',
      pain_points: null,
    };

    const result = await opportunityAgent.invoke(invalidPayload);

    expect(result.success).toBe(false);
    expect(result.error).toContain('validation');
  });
});

describe('CrossComponentIntegration - Data Flow', () => {
  it('flows data from opportunity to target to expansion', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);
    const expansionAgent = new ExpansionAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Data flow test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const expansionResult = await expansionAgent.invoke({
      value_tree_id: targetResult.data.value_tree_id,
    });

    expect(expansionResult.success).toBe(true);
    expect(expansionResult.data).toHaveProperty('expansion_plan');
  });

  it('maintains data consistency across components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Consistency test',
    });

    const opportunityId = oppResult.data.opportunity_id;

    const targetResult = await targetAgent.invoke({
      opportunity_id: opportunityId,
    });

    const oppRetrieve = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: opportunityId,
    });

    expect(oppRetrieve.data.opportunity_id).toBe(opportunityId);
    expect(targetResult.data.opportunity_id).toBe(opportunityId);
  });

  it('handles data transformation between components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Transformation test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      transform: true,
    });

    expect(targetResult.success).toBe(true);
    expect(targetResult.data).toHaveProperty('value_tree');
    expect(targetResult.data.value_tree).toHaveProperty('nodes');
  });
});

describe('CrossComponentIntegration - Event Propagation', () => {
  it('propagates events across component boundaries', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const events: any[] = [];

    const eventBus = {
      emit: (event: any) => events.push(event),
    };

    await opportunityAgent.invoke({
      customer_context: 'Event test',
      event_bus: eventBus,
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('type');
  });

  it('handles event subscription and unsubscription', async () => {
    const targetAgent = new TargetAgent({} as any);

    const subscription = await targetAgent.invoke({
      action: 'subscribe',
      event_type: 'value_tree_updated',
    });

    expect(subscription.success).toBe(true);

    const unsubscribe = await targetAgent.invoke({
      action: 'unsubscribe',
      subscription_id: subscription.data.subscription_id,
    });

    expect(unsubscribe.success).toBe(true);
  });

  it('filters events based on subscription criteria', async () => {
    const targetAgent = new TargetAgent({} as any);

    const events: any[] = [];

    await targetAgent.invoke({
      action: 'subscribe',
      event_type: 'value_tree_updated',
      filter: { user_id: 'user-1' },
      callback: (event: any) => events.push(event),
    });

    await targetAgent.invoke({
      value_tree_id: 'tree-1',
      user_id: 'user-1',
      action: 'update',
    });

    await targetAgent.invoke({
      value_tree_id: 'tree-1',
      user_id: 'user-2',
      action: 'update',
    });

    expect(events.length).toBe(1);
    expect(events[0].user_id).toBe('user-1');
  });
});

describe('CrossComponentIntegration - Error Propagation', () => {
  it('propagates errors from service to agent', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: 'Error test',
      force_service_error: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles partial failures in multi-component operations', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Partial failure test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      force_partial_failure: true,
    });

    expect(targetResult.success).toBe(false);
    expect(targetResult.partial_data).toBeDefined();
  });

  it('rolls back transactions on component failure', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Rollback test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      force_failure: true,
      transaction: true,
    });

    expect(targetResult.success).toBe(false);

    const oppRetrieve = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(oppRetrieve.data.target_created).toBe(false);
  });
});

describe('CrossComponentIntegration - Caching and Performance', () => {
  it('caches data across component boundaries', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result1 = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });

    const result2 = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result2.cached).toBe(true);
  });

  it('invalidates cache on data updates', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });

    await opportunityAgent.invoke({
      action: 'update',
      opportunity_id: 'opp-1',
      data: { name: 'Updated' },
    });

    const result = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      use_cache: true,
    });

    expect(result.cached).toBe(false);
  });

  it('optimizes cross-component queries', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const startTime = Date.now();

    await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
    });

    await targetAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
    });

    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(1000);
  });
});

describe('CrossComponentIntegration - Security and Authorization', () => {
  it('enforces authorization across component boundaries', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      action: 'get',
      opportunity_id: 'opp-1',
      user_id: 'unauthorized-user',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('authorization');
  });

  it('validates input across all components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: '<script>alert("xss")</script>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('validation');
  });

  it('sanitizes data between components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Test with <b>HTML</b>',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(targetResult.data.customer_context).not.toContain('<b>');
  });
});

describe('CrossComponentIntegration - State Management', () => {
  it('maintains consistent state across components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'State test',
    });

    await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const oppState = await opportunityAgent.invoke({
      action: 'get_state',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(oppState.data.state).toBe('target_created');
  });

  it('handles state transitions across components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);
    const expansionAgent = new ExpansionAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Transition test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const expansionResult = await expansionAgent.invoke({
      value_tree_id: targetResult.data.value_tree_id,
    });

    const finalState = await opportunityAgent.invoke({
      action: 'get_state',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(finalState.data.state).toBe('expansion_created');
  });

  it('synchronizes state updates across components', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Sync test',
    });

    await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      state: 'in_progress',
    });

    const oppState = await opportunityAgent.invoke({
      action: 'get_state',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(oppState.data.state).toBe('in_progress');
  });
});

describe('CrossComponentIntegration - Monitoring and Observability', () => {
  it('tracks metrics across component interactions', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    await opportunityAgent.invoke({
      customer_context: 'Metrics test',
      track_metrics: true,
    });

    const metrics = await opportunityAgent.invoke({
      action: 'get_metrics',
    });

    expect(metrics.data.metrics).toBeDefined();
    expect(metrics.data.metrics.invocation_count).toBeGreaterThan(0);
  });

  it('logs cross-component operations', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Logging test',
      enable_logging: true,
    });

    await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      enable_logging: true,
    });

    const logs = await opportunityAgent.invoke({
      action: 'get_logs',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(logs.data.logs.length).toBeGreaterThan(1);
  });

  it('traces requests across component boundaries', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const traceId = 'trace-123';

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Trace test',
      trace_id: traceId,
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      trace_id: traceId,
    });

    const trace = await opportunityAgent.invoke({
      action: 'get_trace',
      trace_id: traceId,
    });

    expect(trace.data.spans.length).toBe(2);
  });
});
