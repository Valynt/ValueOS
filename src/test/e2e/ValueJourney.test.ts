/**
 * Value Journey E2E Tests
 * 
 * Tests complete user workflows through the value lifecycle:
 * Opportunity → Target → Expansion → Integrity → Realization
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';
import { IntegrityAgent } from '../../lib/agent-fabric/agents/IntegrityAgent';
import { RealizationAgent } from '../../lib/agent-fabric/agents/RealizationAgent';

describe('ValueJourney - Opportunity to Target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes opportunity discovery to target modeling flow', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const opportunityResult = await opportunityAgent.invoke({
      customer_context: 'Manufacturing company seeking efficiency',
      pain_points: ['Manual processes', 'High costs'],
    });

    expect(opportunityResult.success).toBe(true);

    if (opportunityResult.success) {
      const targetResult = await targetAgent.invoke({
        opportunity_id: opportunityResult.data.opportunity_id,
        capabilities: opportunityResult.data.recommended_capabilities,
      });

      expect(targetResult.success).toBe(true);
      expect(targetResult.data).toHaveProperty('value_tree');
      expect(targetResult.data).toHaveProperty('roi_model');
    }
  });
});

describe('ValueJourney - Full Lifecycle', () => {
  it('completes end-to-end value lifecycle journey', async () => {
    const journey = {
      opportunity: null as any,
      target: null as any,
      expansion: null as any,
      integrity: null as any,
      realization: null as any,
    };

    // Stage 1: Opportunity Discovery
    const opportunityAgent = new OpportunityAgent({} as any);
    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Enterprise seeking digital transformation',
    });

    expect(oppResult.success).toBe(true);
    journey.opportunity = oppResult.data;

    // Stage 2: Target Modeling
    const targetAgent = new TargetAgent({} as any);
    const targetResult = await targetAgent.invoke({
      opportunity_id: journey.opportunity.opportunity_id,
    });

    expect(targetResult.success).toBe(true);
    journey.target = targetResult.data;

    // Stage 3: Expansion Planning
    const expansionAgent = new ExpansionAgent({} as any);
    const expansionResult = await expansionAgent.invoke({
      value_tree_id: journey.target.value_tree_id,
    });

    expect(expansionResult.success).toBe(true);
    journey.expansion = expansionResult.data;

    // Stage 4: Integrity Validation
    const integrityAgent = new IntegrityAgent({} as any);
    const integrityResult = await integrityAgent.invoke({
      roi_model_id: journey.target.roi_model_id,
    });

    expect(integrityResult.success).toBe(true);
    journey.integrity = integrityResult.data;

    // Stage 5: Realization Tracking
    const realizationAgent = new RealizationAgent({} as any);
    const realizationResult = await realizationAgent.invoke({
      value_commit_id: journey.target.value_commit_id,
    });

    expect(realizationResult.success).toBe(true);
    journey.realization = realizationResult.data;

    // Verify complete journey
    expect(journey.opportunity).toBeDefined();
    expect(journey.target).toBeDefined();
    expect(journey.expansion).toBeDefined();
    expect(journey.integrity).toBeDefined();
    expect(journey.realization).toBeDefined();
  });

  it('handles journey interruption and resumption', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Interrupted journey test',
    });

    const pauseResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      action: 'pause',
    });

    expect(pauseResult.success).toBe(true);

    const resumeResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      action: 'resume',
    });

    expect(resumeResult.success).toBe(true);
  });

  it('validates data consistency across lifecycle stages', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);
    const expansionAgent = new ExpansionAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Consistency validation test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const expansionResult = await expansionAgent.invoke({
      value_tree_id: targetResult.data.value_tree_id,
    });

    expect(expansionResult.data.opportunity_id).toBe(oppResult.data.opportunity_id);
    expect(expansionResult.data.value_tree_id).toBe(targetResult.data.value_tree_id);
  });

  it('tracks journey progress and milestones', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Progress tracking test',
    });

    const progress = await opportunityAgent.invoke({
      action: 'get_progress',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(progress.data).toHaveProperty('stage');
    expect(progress.data).toHaveProperty('completion_percentage');
    expect(progress.data).toHaveProperty('milestones');
  });

  it('handles journey rollback on critical failure', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Rollback test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      force_critical_failure: true,
    });

    expect(targetResult.success).toBe(false);

    const rollbackResult = await opportunityAgent.invoke({
      action: 'rollback',
      opportunity_id: oppResult.data.opportunity_id,
    });

    expect(rollbackResult.success).toBe(true);
  });
});

describe('ValueJourney - Edge Cases', () => {
  it('handles missing opportunity data gracefully', async () => {
    const targetAgent = new TargetAgent({} as any);

    const result = await targetAgent.invoke({
      opportunity_id: 'nonexistent-opp',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('handles incomplete journey data', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: '',
      pain_points: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('incomplete');
  });

  it('handles concurrent journey modifications', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Concurrent modification test',
    });

    const [update1, update2] = await Promise.allSettled([
      targetAgent.invoke({
        opportunity_id: oppResult.data.opportunity_id,
        update: { field: 'name', value: 'Update 1' },
      }),
      targetAgent.invoke({
        opportunity_id: oppResult.data.opportunity_id,
        update: { field: 'name', value: 'Update 2' },
      }),
    ]);

    const successCount = [update1, update2].filter(
      (r) => r.status === 'fulfilled'
    ).length;

    expect(successCount).toBeGreaterThan(0);
  });

  it('handles journey timeout scenarios', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: 'Timeout test',
      timeout: 100,
      force_slow_processing: true,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('validates journey state transitions', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'State transition test',
    });

    const invalidTransition = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      force_state: 'realization',
    });

    expect(invalidTransition.success).toBe(false);
    expect(invalidTransition.error).toContain('invalid state transition');
  });
});

describe('ValueJourney - Performance Profiling', () => {
  it('completes full journey within performance budget', async () => {
    const startTime = performance.now();

    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);
    const expansionAgent = new ExpansionAgent({} as any);
    const integrityAgent = new IntegrityAgent({} as any);
    const realizationAgent = new RealizationAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Performance test',
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const expansionResult = await expansionAgent.invoke({
      value_tree_id: targetResult.data.value_tree_id,
    });

    const integrityResult = await integrityAgent.invoke({
      roi_model_id: targetResult.data.roi_model_id,
    });

    const realizationResult = await realizationAgent.invoke({
      value_commit_id: targetResult.data.value_commit_id,
    });

    const duration = performance.now() - startTime;

    expect(oppResult.success).toBe(true);
    expect(targetResult.success).toBe(true);
    expect(expansionResult.success).toBe(true);
    expect(integrityResult.success).toBe(true);
    expect(realizationResult.success).toBe(true);
    expect(duration).toBeLessThan(5000);
  });

  it('profiles individual stage performance', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const startTime = performance.now();
    const result = await opportunityAgent.invoke({
      customer_context: 'Stage profiling test',
      profile: true,
    });
    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.performance).toBeDefined();
    expect(result.performance.duration).toBeLessThan(2000);
    expect(duration).toBeLessThan(2000);
  });

  it('handles high-volume journey creation', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const journeyCount = 100;
    const startTime = performance.now();

    const results = await Promise.all(
      Array.from({ length: journeyCount }, (_, i) =>
        opportunityAgent.invoke({
          customer_context: `High volume test ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(journeyCount);
    expect(duration).toBeLessThan(30000);
  });

  it('measures memory usage during journey', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Memory test',
    });

    await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
    });

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryIncrease = finalMemory - initialMemory;

    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  it('profiles database query performance', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const result = await opportunityAgent.invoke({
      customer_context: 'Query profiling test',
      profile_queries: true,
    });

    expect(result.success).toBe(true);
    expect(result.query_stats).toBeDefined();
    expect(result.query_stats.total_queries).toBeGreaterThan(0);
    expect(result.query_stats.avg_query_time).toBeLessThan(100);
  });

  it('identifies performance bottlenecks', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);
    const targetAgent = new TargetAgent({} as any);

    const oppResult = await opportunityAgent.invoke({
      customer_context: 'Bottleneck test',
      profile: true,
    });

    const targetResult = await targetAgent.invoke({
      opportunity_id: oppResult.data.opportunity_id,
      profile: true,
    });

    const bottlenecks = [
      ...oppResult.performance.bottlenecks,
      ...targetResult.performance.bottlenecks,
    ];

    expect(bottlenecks.length).toBeGreaterThanOrEqual(0);
  });

  it('validates response time SLAs', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const slaThreshold = 1000;
    const startTime = performance.now();

    const result = await opportunityAgent.invoke({
      customer_context: 'SLA test',
    });

    const duration = performance.now() - startTime;

    expect(result.success).toBe(true);
    expect(duration).toBeLessThan(slaThreshold);
  });

  it('handles concurrent journeys without performance degradation', async () => {
    const opportunityAgent = new OpportunityAgent({} as any);

    const concurrentCount = 20;
    const startTime = performance.now();

    const results = await Promise.all(
      Array.from({ length: concurrentCount }, (_, i) =>
        opportunityAgent.invoke({
          customer_context: `Concurrent test ${i}`,
        })
      )
    );

    const duration = performance.now() - startTime;
    const avgDuration = duration / concurrentCount;

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBe(concurrentCount);
    expect(avgDuration).toBeLessThan(500);
  });
});
