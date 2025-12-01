/**
 * Multi-user workflows using execute layer with in-memory mocks.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpportunityAgent } from '../../src/lib/agent-fabric/agents/OpportunityAgent';
import { TargetAgent } from '../../src/lib/agent-fabric/agents/TargetAgent';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../mocks/mockSupabaseClient';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeMaybe = runIntegration ? describe : describe.skip;

const opportunityLLMResponse = JSON.stringify({
  opportunity_summary: 'Reduce manual entry',
  persona_fit: { score: 0.85, role: 'VP Ops', seniority: 'senior', decision_authority: 'high', fit_reasoning: 'Aligned' },
  business_objectives: [{ name: 'Reduce costs', description: '', priority: 1, owner: 'CFO' }],
  pain_points: [{ category: 'cost', description: 'Manual work', severity: 'high', frequency: 'weekly', estimated_annual_cost: 50000, affected_stakeholders: ['Ops'] }],
  initial_value_model: { outcomes: [], kpis: [], financial_impact: { revenue_opportunity: 0, cost_savings: 50000, risk_reduction: 0, total_value: 50000, confidence_level: 'medium' } },
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
  kpi_targets: [],
  value_commit: { notes: 'commit', target_date: '2025-12-31' },
  business_case_summary: 'summary',
  confidence_level: 'high',
  reasoning: 'reasoning'
});

describeMaybe('MultiUserWorkflow - execute layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any) = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
    });
  });

  it('supports concurrent opportunity execution for multiple users', async () => {
    const supabase = createBoltClientMock({
      capabilities: [{ id: 'cap-1', name: 'Automation', is_active: true, tags: ['automation'] }]
    });
    const infra = createAgentInfrastructureMocks();
    infra.llmGateway.complete.mockResolvedValue({ content: opportunityLLMResponse, tokens_used: 5, model: 'test' });
    const agent = new OpportunityAgent('opportunity', infra.llmGateway as any, infra.memorySystem as any, infra.auditLogger as any, supabase as any);

    const [r1, r2] = await Promise.all([
      agent.execute('session-user-1', { discoveryData: ['call 1'], customerProfile: { user: 'user-1' } } as any),
      agent.execute('session-user-2', { discoveryData: ['call 2'], customerProfile: { user: 'user-2' } } as any)
    ]);

    expect(r1.businessObjectives[0].name).toBe('Reduce costs');
    expect(r2.recommendedCapabilities.length).toBeGreaterThan(0);
  });

  it('persists target artifacts once and reuses Supabase mock for concurrent updates', async () => {
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

    const baseOutput = await agent.execute('session-1', { valueCaseId: 'vc-1', businessObjectives: [], capabilities: [] } as any);
    const persisted = await agent.persistTargetArtifacts(baseOutput, 'vc-1');

    // Simulate two follow-up executions sharing the same Supabase mock
    const [update1, update2] = await Promise.all([
      agent.execute('session-2', { valueCaseId: 'vc-1', businessObjectives: [], capabilities: [] } as any),
      agent.execute('session-3', { valueCaseId: 'vc-1', businessObjectives: [], capabilities: [] } as any)
    ]);

    expect(persisted.valueTreeId).toBeDefined();
    expect(update1.valueTree.name).toBe('Automation Tree');
    expect(update2.valueCommit.target_date).toBe('2025-12-31');
    expect(supabase.tables.value_trees.length).toBeGreaterThan(0);
  });
});
