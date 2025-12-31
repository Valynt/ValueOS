/**
 * Value Journey E2E Tests (execute layer)
 *
 * Uses real agent constructors with in-memory Supabase/LLM/memory mocks.
 * All tests are opt-in via RUN_INTEGRATION_TESTS to avoid live calls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpportunityAgent } from '../../src/lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../src/lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../src/lib/agent-fabric/agents/ExpansionAgent';
import { IntegrityAgent } from '../../src/lib/agent-fabric/agents/IntegrityAgent';
import { RealizationAgent } from '../../src/lib/agent-fabric/agents/RealizationAgent';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../fixtures/mocks/mockSupabaseClient';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeMaybe = runIntegration ? describe : describe.skip;

const opportunityLLMResponse = JSON.stringify({
  opportunity_summary: 'Reduce manual work',
  persona_fit: {
    score: 0.9,
    role: 'VP Ops',
    seniority: 'senior',
    decision_authority: 'high',
    fit_reasoning: 'Aligned to automation'
  },
  business_objectives: [
    { name: 'Reduce costs', description: 'cut spend', priority: 1, owner: 'CFO' }
  ],
  pain_points: [
    {
      category: 'efficiency',
      description: 'Manual data entry',
      severity: 'high',
      frequency: 'daily',
      estimated_annual_cost: 50000,
      affected_stakeholders: ['Ops']
    }
  ],
  initial_value_model: {
    outcomes: [{ name: 'Faster cycles', description: '', measurement: '', timeframe: '' }],
    kpis: [{ name: 'Cycle time', baseline: 10, target: 5, unit: 'days', measurement_type: 'time' }],
    financial_impact: {
      revenue_opportunity: 0,
      cost_savings: 50000,
      risk_reduction: 0,
      total_value: 50000,
      confidence_level: 'medium'
    }
  },
  recommended_capability_tags: ['automation'],
  confidence_level: 'high',
  reasoning: 'clear pains'
});

const targetLLMResponse = JSON.stringify({
  value_tree: {
    name: 'Automation Tree',
    description: 'Maps automation to outcomes',
    nodes: [
      { node_id: 'cap_1', label: 'Automation', type: 'capability', reference_id: 'cap-1' },
      { node_id: 'outcome_1', label: 'Reduced manual work', type: 'outcome' },
      { node_id: 'kpi_1', label: 'Hours saved', type: 'kpi' }
    ],
    links: [{ parent_node_id: 'cap_1', child_node_id: 'outcome_1', weight: 1 }]
  },
  roi_model: {
    name: 'ROI Model',
    assumptions: ['baseline: manual processes'],
    calculations: [
      { name: 'savings', formula: '1000', description: '', calculation_order: 1, result_type: 'final', unit: 'usd' }
    ],
    confidence_level: 'medium'
  },
  kpi_targets: [
    { kpi_name: 'Hours saved', baseline_value: 10, target_value: 2, unit: 'hours', deadline: '2025-12-31', confidence_level: 'high' }
  ],
  value_commit: { notes: 'Commit to automation', target_date: '2025-12-31' },
  business_case_summary: 'Automation drives savings',
  confidence_level: 'medium',
  reasoning: 'LLM reasoning'
});

function createOpportunityAgent() {
  const supabase = createBoltClientMock({
    capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }]
  });
  const infra = createAgentInfrastructureMocks();
  infra.llmGateway.complete.mockResolvedValue({ content: opportunityLLMResponse, tokens_used: 10, model: 'test' });
  return { agent: new OpportunityAgent('opportunity', infra.llmGateway as any, infra.memorySystem as any, infra.auditLogger as any, supabase as any), supabase, infra };
}

function createTargetAgent() {
  const supabase = createBoltClientMock({
    value_trees: [],
    value_tree_nodes: [],
    value_tree_links: [],
    roi_models: [],
    roi_model_calculations: [],
    value_commits: [],
    kpi_targets: [],
    capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }]
  });
  const infra = createAgentInfrastructureMocks();
  infra.llmGateway.complete.mockResolvedValue({ content: targetLLMResponse, tokens_used: 10, model: 'test' });
  return { agent: new TargetAgent('target', infra.llmGateway as any, infra.memorySystem as any, infra.auditLogger as any, supabase as any), supabase, infra };
}

describeMaybe('ValueJourney - execute layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    });
  });

  it('flows from opportunity discovery to target modeling', async () => {
    const { agent: oppAgent } = createOpportunityAgent();
    const { agent: targetAgent } = createTargetAgent();

    const oppOutput = await oppAgent.execute('session-1', {
      discoveryData: ['call transcript'],
      customerProfile: { name: 'ACME' }
    } as any);

    const targetOutput = await targetAgent.execute('session-1', {
      valueCaseId: 'vc-1',
      businessObjectives: oppOutput.businessObjectives,
      capabilities: oppOutput.recommendedCapabilities
    } as any);

    expect(oppOutput.businessObjectives[0].name).toBe('Reduce costs');
    expect(targetOutput.businessCase.nodes).toHaveLength(3);
    expect(targetOutput.valueTree.name).toBe('Automation Tree');
  });

  it('persists target artifacts with in-memory Supabase', async () => {
    const { agent: targetAgent, supabase } = createTargetAgent();
    const output = await targetAgent.execute('session-1', {
      valueCaseId: 'vc-1',
      businessObjectives: [],
      capabilities: []
    } as any);

    const persisted = await targetAgent.persistTargetArtifacts(output, 'vc-1');

    expect(persisted.valueTreeId).toBeDefined();
    expect(supabase.tables.value_tree_nodes.length).toBeGreaterThan(0);
    expect(supabase.tables.kpi_targets.length).toBe(1);
  });

  it('runs full lifecycle by stubbing downstream agents', async () => {
    const { agent: oppAgent } = createOpportunityAgent();
    const { agent: targetAgent } = createTargetAgent();

    const expansionAgent = new ExpansionAgent('expansion', {} as any, {} as any, {} as any, createBoltClientMock() as any);
    const integrityAgent = new IntegrityAgent('integrity', {} as any, {} as any, {} as any, createBoltClientMock() as any);
    const realizationAgent = new RealizationAgent('realization', {} as any, {} as any, {} as any, createBoltClientMock() as any);

    vi.spyOn(expansionAgent, 'execute').mockResolvedValue({
      expansionModel: { opportunities: [] },
      recommendations: []
    } as any);
    vi.spyOn(integrityAgent, 'execute').mockResolvedValue({
      validationResults: [],
      kpiTargets: []
    } as any);
    vi.spyOn(realizationAgent, 'execute').mockResolvedValue({
      report: { status: 'healthy' },
      insights: []
    } as any);

    const oppOutput = await oppAgent.execute('session-1', {
      discoveryData: ['transcript'],
      customerProfile: { name: 'ACME' }
    } as any);

    const targetOutput = await targetAgent.execute('session-1', {
      valueCaseId: 'vc-1',
      businessObjectives: oppOutput.businessObjectives,
      capabilities: oppOutput.recommendedCapabilities
    } as any);

    const expansion = await expansionAgent.execute('session-1', {
      currentValueTree: targetOutput.valueTree,
      realizationReportId: 'report-1'
    } as any);
    const integrity = await integrityAgent.execute('session-1', {
      valueCommitId: 'commit-1',
      telemetryEvents: []
    } as any);
    const realization = await realizationAgent.execute('session-1', {
      valueCommitId: 'commit-1',
      telemetryEvents: []
    } as any);

    expect(targetOutput.valueCommit.target_date).toBe('2025-12-31');
    expect(expansion.recommendations).toBeDefined();
    expect(integrity.kpiTargets).toEqual([]);
    expect(realization.report.status).toBe('healthy');
  });
});
