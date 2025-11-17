import { describe, expect, it } from 'vitest';
import { IntegrityAgent } from '../../lib/agent-fabric/agents/IntegrityAgent';
import { ROIFormulaInterpreter } from '../../services/ROIFormulaInterpreter';
import { createAgentInfrastructureMocks, createBoltClientMock } from '../utils/mockSupabaseClient';
import type { IntegrityCheckInput } from '../../lib/agent-fabric/agents/IntegrityAgent';

function buildAgent(supabase: any) {
  const { llmGateway, memorySystem, auditLogger } = createAgentInfrastructureMocks();
  const agent = new IntegrityAgent(
    { id: 'integrity-agent', name: 'IntegrityAgent', description: '', capabilities: [] },
    llmGateway as any,
    memorySystem as any,
    auditLogger as any,
    supabase as any
  );
  // ensure interpreter uses mocked supabase too
  (agent as any).roiInterpreter = new ROIFormulaInterpreter(supabase as any);
  return { agent, llmGateway, memorySystem, auditLogger };
}

describe('IntegrityAgent manifesto validation', () => {
  it('validates value tree compliance across manifesto rules', async () => {
    const supabase = createBoltClientMock({
      value_tree_nodes: [
        { id: 'node_fin_1', value_tree_id: 'tree-1', node_id: 'financial_1', label: 'Revenue', type: 'financialMetric' },
        { id: 'node_kpi_1', value_tree_id: 'tree-1', node_id: 'kpi_1', label: 'Churn Reduction', type: 'kpi', reference_id: 'kpi-1' },
      ],
      kpi_hypotheses: [{ id: 'kpi-1', kpi_name: 'Churn Reduction', baseline_value: 5, unit: '%' }],
    });

    const { agent } = buildAgent(supabase);

    const input: IntegrityCheckInput = {
      artifact_type: 'value_tree',
      artifact_id: 'tree-1',
      artifact_data: { reasoning: 'This is a detailed reasoning narrative that exceeds fifty characters to satisfy the rule.' },
    };

    const result = await agent.execute('session-1', input);

    expect(result.is_compliant).toBe(true);
    expect(result.compliance_report.total_rules).toBe(4);
    expect(result.blocking_issues).toHaveLength(0);
  });

  it('captures ROI model assumption and formula provenance failures', async () => {
    const supabase = createBoltClientMock({
      roi_models: [{ id: 'roi-1', assumptions: ['Source: analyst', 'missing reference'] }],
      roi_model_calculations: [
        { id: 'calc-1', roi_model_id: 'roi-1', name: 'invalid', formula: 'SUM(1,2', calculation_order: 1 },
      ],
    });

    const { agent } = buildAgent(supabase);

    const input: IntegrityCheckInput = {
      artifact_type: 'roi_model',
      artifact_id: 'roi-1',
      artifact_data: { reasoning: 'Reasoning that meets the minimum length requirements for validation.' },
    };

    const result = await agent.execute('session-2', input);

    expect(result.is_compliant).toBe(false);
    expect(result.blocking_issues.some(issue => issue.includes('Assumption Quality'))).toBe(false);
    expect(result.blocking_issues.some(issue => issue.includes('Formula'))).toBe(true);
  });
});
