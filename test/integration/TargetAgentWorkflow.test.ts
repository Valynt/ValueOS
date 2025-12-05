import { describe, expect, it } from 'vitest';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../utils/mockSupabaseClient';

const mockLLMResponse = JSON.stringify({
  value_tree: {
    name: 'Test Tree',
    description: 'Generated tree',
    nodes: [
      { node_id: 'cap_1', label: 'Automation', type: 'capability', reference_id: 'cap-1' },
      { node_id: 'outcome_1', label: 'Outcome', type: 'outcome' },
      { node_id: 'kpi_1', label: 'NPS', type: 'kpi' },
      { node_id: 'financial_1', label: 'Revenue', type: 'financialMetric' },
    ],
    links: [
      { parent_node_id: 'cap_1', child_node_id: 'outcome_1', weight: 1 },
      { parent_node_id: 'outcome_1', child_node_id: 'kpi_1', weight: 1 },
    ],
  },
  roi_model: {
    name: 'ROI',
    assumptions: ['source: analyst'],
    calculations: [
      { name: 'calc1', formula: '1+1', description: 'simple', calculation_order: 1, result_type: 'intermediate', unit: 'count' },
    ],
    confidence_level: 'high',
  },
  kpi_targets: [
    { kpi_name: 'NPS', baseline_value: 10, target_value: 20, unit: 'pts', deadline: '2025-12-31', confidence_level: 'high' },
  ],
  value_commit: { notes: 'commit', target_date: '2025-12-31' },
  business_case_summary: 'summary',
  confidence_level: 'high',
  reasoning: 'Sufficient reasoning content that satisfies the base agent logging.',
});

describe('TargetAgent value tree creation workflow', () => {
  it('creates value tree, ROI model, and value commit records', async () => {
    const supabase = createBoltClientMock({
      value_trees: [],
      value_tree_nodes: [],
      value_tree_links: [],
      roi_models: [],
      roi_model_calculations: [],
      value_commits: [],
      kpi_targets: [],
    });

    const { llmGateway, memorySystem, auditLogger } = createAgentInfrastructureMocks();
    llmGateway.complete.mockResolvedValue({ content: mockLLMResponse, tokens_used: 10, model: 'test' });

    const agent = new TargetAgent(
      { id: 'target-agent', name: 'Target', description: '', capabilities: [] },
      llmGateway as any,
      memorySystem as any,
      auditLogger as any,
      supabase as any
    );

    const output = await agent.execute('session-1', {
      valueCaseId: 'vc-1',
      businessObjectives: [],
      capabilities: [],
    } as any);

    const persisted = await agent.persistTargetArtifacts(output, 'vc-1');

    expect(persisted.valueTreeId).toBeTruthy();
    expect(supabase.tables.value_tree_nodes).toHaveLength(4);
    expect(supabase.tables.roi_model_calculations).toHaveLength(1);
    expect(supabase.tables.kpi_targets).toHaveLength(1);
  });
});
