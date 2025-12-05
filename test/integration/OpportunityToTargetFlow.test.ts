import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../utils/mockSupabaseClient';

const opportunityLLMResponse = JSON.stringify({
  opportunity_summary: 'Improve efficiency',
  persona_fit: { score: 0.9, role: 'VP Ops', seniority: 'senior', decision_authority: 'high', fit_reasoning: 'aligned' },
  business_objectives: [
    { name: 'Reduce costs', description: 'lower spend', priority: 1, owner: 'CFO' },
  ],
  pain_points: [
    {
      category: 'cost',
      description: 'Manual processes',
      severity: 'high',
      frequency: 'weekly',
      estimated_annual_cost: 50000,
      affected_stakeholders: ['Ops'],
    },
  ],
  initial_value_model: {
    outcomes: [{ name: 'Faster cycle times', description: '', measurement: '', timeframe: '' }],
    kpis: [{ name: 'Cycle time', baseline: 10, target: 5, unit: 'days', measurement_type: 'time' }],
    financial_impact: { revenue_opportunity: 100000, cost_savings: 50000, risk_reduction: 0, total_value: 150000, confidence_level: 'medium' },
  },
  recommended_capability_tags: ['automation'],
  confidence_level: 'high',
  reasoning: 'opportunity reasoning',
});

const targetLLMResponse = JSON.stringify({
  value_tree: {
    name: 'Lifecycle Tree',
    description: 'Combined',
    nodes: [
      { node_id: 'cap_1', label: 'Automation', type: 'capability', reference_id: 'cap-1' },
      { node_id: 'kpi_1', label: 'Cycle time', type: 'kpi' },
      { node_id: 'financial_1', label: 'Cost savings', type: 'financialMetric' },
    ],
    links: [
      { parent_node_id: 'cap_1', child_node_id: 'kpi_1', weight: 1 },
      { parent_node_id: 'kpi_1', child_node_id: 'financial_1', weight: 1 },
    ],
  },
  roi_model: {
    name: 'Lifecycle ROI',
    assumptions: ['source: discovery'],
    calculations: [
      { name: 'savings', formula: '1000', description: '', calculation_order: 1, result_type: 'final', unit: 'usd' },
    ],
    confidence_level: 'medium',
  },
  kpi_targets: [
    { kpi_name: 'Cycle time', baseline_value: 10, target_value: 5, unit: 'days', deadline: '2025-12-31', confidence_level: 'medium' },
  ],
  value_commit: { notes: 'commit', target_date: '2025-12-31' },
  business_case_summary: 'summary',
  confidence_level: 'medium',
  reasoning: 'target reasoning',
});

describe('Opportunity to Target lifecycle flow', () => {
  beforeEach(() => {
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces compatible outputs and persisted artifacts', async () => {
    const supabase = createBoltClientMock({
      capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }],
      value_trees: [],
      value_tree_nodes: [],
      value_tree_links: [],
      roi_models: [],
      roi_model_calculations: [],
      value_commits: [],
      kpi_targets: [],
    });

    const infra = createAgentInfrastructureMocks();
    infra.llmGateway.complete.mockResolvedValueOnce({ content: opportunityLLMResponse, tokens_used: 5, model: 'test' });
    infra.llmGateway.complete.mockResolvedValueOnce({ content: targetLLMResponse, tokens_used: 5, model: 'test' });

    const opportunityAgent = new OpportunityAgent(
      { id: 'opportunity', name: 'Opportunity', description: '', capabilities: [] },
      infra.llmGateway as any,
      infra.memorySystem as any,
      infra.auditLogger as any,
      supabase as any
    );

    const targetAgent = new TargetAgent(
      { id: 'target', name: 'Target', description: '', capabilities: [] },
      infra.llmGateway as any,
      infra.memorySystem as any,
      infra.auditLogger as any,
      supabase as any
    );

    const oppOutput = await opportunityAgent.execute('session-1', {
      discoveryData: ['call transcript'],
      customerProfile: { name: 'ACME' },
    } as any);

    const targetOutput = await targetAgent.execute('session-1', {
      valueCaseId: 'vc-1',
      businessObjectives: oppOutput.businessObjectives,
      capabilities: oppOutput.recommendedCapabilities,
    } as any);

    const persisted = await targetAgent.persistTargetArtifacts(targetOutput, 'vc-1');

    expect(oppOutput.businessObjectives[0].name).toBe('Reduce costs');
    expect(targetOutput.businessCase.nodes).toHaveLength(3);
    expect(persisted.valueTreeId).toBeDefined();
    expect(supabase.tables.value_commits).toHaveLength(1);
  });
});
