/**
 * Cross-Component Integration (execute layer)
 *
 * Verifies data flow between agents, memory, and Supabase mocks without using the legacy .invoke API.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpportunityAgent } from '../../src/lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../src/lib/agent-fabric/agents/TargetAgent';
import { ExpansionAgent } from '../../src/lib/agent-fabric/agents/ExpansionAgent';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../mocks/mockSupabaseClient';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeMaybe = runIntegration ? describe : describe.skip;

const opportunityLLMResponse = JSON.stringify({
  opportunity_summary: 'Automation value',
  persona_fit: { score: 0.88, role: 'VP Ops', seniority: 'senior', decision_authority: 'high', fit_reasoning: 'Aligned' },
  business_objectives: [{ name: 'Reduce costs', description: '', priority: 1, owner: 'CFO' }],
  pain_points: [{ category: 'cost', description: 'Manual work', severity: 'high', frequency: 'weekly', estimated_annual_cost: 40000, affected_stakeholders: ['Ops'] }],
  initial_value_model: { outcomes: [], kpis: [], financial_impact: { revenue_opportunity: 0, cost_savings: 40000, risk_reduction: 0, total_value: 40000, confidence_level: 'medium' } },
  recommended_capability_tags: ['automation'],
  confidence_level: 'high',
  reasoning: 'clear'
});

const targetLLMResponse = JSON.stringify({
  value_tree: {
    name: 'Automation Tree',
    description: 'Tree',
    nodes: [
      { node_id: 'cap_1', label: 'Automation', type: 'capability', reference_id: 'cap-1' },
      { node_id: 'kpi_1', label: 'Hours saved', type: 'kpi' }
    ],
    links: [{ parent_node_id: 'cap_1', child_node_id: 'kpi_1', weight: 1 }]
  },
  roi_model: { name: 'ROI', assumptions: [], calculations: [], confidence_level: 'high' },
  kpi_targets: [{ kpi_name: 'Hours saved', baseline_value: 10, target_value: 2, unit: 'hours', deadline: '2025-12-31', confidence_level: 'high' }],
  value_commit: { notes: 'commit', target_date: '2025-12-31' },
  business_case_summary: 'summary',
  confidence_level: 'high',
  reasoning: 'reasoning'
});

describeMaybe('CrossComponentIntegration - execute layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    });
  });

  it('writes semantic memory during opportunity analysis', async () => {
    const supabase = createBoltClientMock({
      capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }]
    });
    const infra = createAgentInfrastructureMocks();
    infra.llmGateway.complete.mockResolvedValue({ content: opportunityLLMResponse, tokens_used: 5, model: 'test' });

    const agent = new OpportunityAgent('opportunity', infra.llmGateway as any, infra.memorySystem as any, infra.auditLogger as any, supabase as any);
    await agent.execute('session-123', { discoveryData: ['call'], customerProfile: { name: 'ACME' } } as any);

    expect(infra.memorySystem.storeSemanticMemory).toHaveBeenCalledWith(
      'session-123',
      'opportunity',
      expect.stringContaining('Opportunity:'),
      expect.objectContaining({ business_objectives: expect.any(Array) })
    );
  });

  it('persists value tree/ROI artifacts in Supabase mock', async () => {
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
    infra.llmGateway.complete.mockResolvedValue({ content: targetLLMResponse, tokens_used: 5, model: 'test' });

    const agent = new TargetAgent('target', infra.llmGateway as any, infra.memorySystem as any, infra.auditLogger as any, supabase as any);
    const output = await agent.execute('session-1', { valueCaseId: 'vc-1', businessObjectives: [], capabilities: [] } as any);
    const persisted = await agent.persistTargetArtifacts(output, 'vc-1');

    expect(persisted.valueTreeId).toBeDefined();
    expect(supabase.tables.roi_models.length).toBe(1);
    expect(supabase.tables.kpi_targets.length).toBe(1);
  });

  it('passes opportunity outputs into target and expansion stages', async () => {
    const oppInfra = createAgentInfrastructureMocks();
    oppInfra.llmGateway.complete.mockResolvedValue({ content: opportunityLLMResponse, tokens_used: 5, model: 'test' });
    const targetInfra = createAgentInfrastructureMocks();
    targetInfra.llmGateway.complete.mockResolvedValue({ content: targetLLMResponse, tokens_used: 5, model: 'test' });

    const oppSupabase = createBoltClientMock({ capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }] });
    const targetSupabase = createBoltClientMock({
      value_trees: [],
      value_tree_nodes: [],
      value_tree_links: [],
      roi_models: [],
      roi_model_calculations: [],
      value_commits: [],
      kpi_targets: []
    });

    const opportunityAgent = new OpportunityAgent('opp', oppInfra.llmGateway as any, oppInfra.memorySystem as any, oppInfra.auditLogger as any, oppSupabase as any);
    const targetAgent = new TargetAgent('target', targetInfra.llmGateway as any, targetInfra.memorySystem as any, targetInfra.auditLogger as any, targetSupabase as any);

    const expansionAgent = new ExpansionAgent('expansion', {} as any, {} as any, {} as any, createBoltClientMock() as any);
    vi.spyOn(expansionAgent, 'execute').mockResolvedValue({
      expansionModel: { opportunities: ['upsell'] },
      recommendations: ['Add analytics']
    } as any);

    const oppOutput = await opportunityAgent.execute('session-1', {
      discoveryData: ['call transcript'],
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

    expect(targetOutput.businessCase.nodes.length).toBeGreaterThan(0);
    expect(expansion.expansionModel.opportunities).toContain('upsell');
  });
});
