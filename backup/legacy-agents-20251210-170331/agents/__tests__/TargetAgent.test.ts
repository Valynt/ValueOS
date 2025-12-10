/**
 * TargetAgent Tests
 * 
 * Tests for Target Agent with MCP Ground Truth integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TargetAgent } from '../../lib/agent-fabric/agents/TargetAgent';
import { createBoltClientMock } from '../../../test/mocks/mockSupabaseClient';

describe('TargetAgent', () => {
  let agent: TargetAgent;
  let mockLLM: any;
  let mockMemory: any;
  let mockAudit: any;
  let mockDB: any;

  beforeEach(() => {
    mockLLM = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          value_tree: {
            name: 'Cost Reduction Value Tree',
            description: 'Automation drives efficiency',
            nodes: [
              { node_id: 'cap_1', label: 'Automation', type: 'capability', reference_id: 'cap-123' },
              { node_id: 'outcome_1', label: 'Reduced manual work', type: 'outcome' },
              { node_id: 'kpi_1', label: 'Hours saved', type: 'kpi' },
              { node_id: 'fin_1', label: 'Cost savings', type: 'financialMetric' }
            ],
            links: [
              { parent_node_id: 'cap_1', child_node_id: 'outcome_1', weight: 1.0 }
            ]
          },
          roi_model: {
            name: 'ROI Model',
            assumptions: ['50 employees affected', 'Average rate $50/hr'],
            calculations: [
              {
                name: 'annual_savings',
                formula: 'employees * hours * rate * 52',
                description: 'Annual cost savings',
                calculation_order: 1,
                result_type: 'cost',
                unit: 'USD',
                input_variables: [
                  { name: 'employees', source: 'discovery', description: 'Headcount' }
                ],
                source_references: { employees: 'kpi:headcount' },
                reasoning_trace: 'Based on time savings from automation capability'
              }
            ],
            confidence_level: 'high'
          },
          kpi_targets: [
            {
              kpi_name: 'Processing time',
              baseline_value: 20,
              target_value: 4,
              unit: 'hours/week',
              deadline: '2025-12-31',
              confidence_level: 'high'
            }
          ],
          value_commit: {
            notes: 'Commit to 80% reduction',
            target_date: '2025-12-31'
          },
          business_case_summary: 'Automation will save $130k annually',
          confidence_level: 'high',
          reasoning: 'Based on industry benchmarks'
        }),
        tokens_used: 2000,
        model: 'gpt-4'
      })
    };

    mockMemory = { storeSemanticMemory: vi.fn() };
    mockAudit = { log: vi.fn() };
    mockDB = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'node-id' } })
    };

    agent = new TargetAgent('target-1', mockLLM, mockMemory, mockAudit, mockDB);
  });

  describe('Business Case Creation', () => {
    it('should create value tree', async () => {
      const input = {
        valueCaseId: 'vc-123',
        businessObjectives: [{ name: 'Reduce costs', priority: 1 }],
        capabilities: [{ id: 'cap-1', name: 'Automation' }]
      };

      const result = await agent.execute('session-1', input);

      expect(result.valueTree).toBeDefined();
      expect(result.valueTree.name).toBeDefined();
      expect(result.businessCase.nodes.length).toBeGreaterThan(0);
    });

    it('should create ROI model', async () => {
      const input = {
        valueCaseId: 'vc-123',
        businessObjectives: [],
        capabilities: []
      };

      const result = await agent.execute('session-1', input);

      expect(result.roiModel).toBeDefined();
      expect(result.roiModel.assumptions).toBeDefined();
      expect(result.businessCase.calculations.length).toBeGreaterThan(0);
    });

    it('should create value commit', async () => {
      const input = {
        valueCaseId: 'vc-123',
        businessObjectives: [],
        capabilities: []
      };

      const result = await agent.execute('session-1', input);

      expect(result.valueCommit).toBeDefined();
      expect(result.valueCommit.target_date).toBeDefined();
    });
  });

  describe('Persistence', () => {
    it('should persist artifacts to database', async () => {
      const output = {
        valueTree: { name: 'Test Tree', value_case_id: 'vc-1' },
        roiModel: { name: 'Test Model', assumptions: [] },
        valueCommit: { notes: 'Test', target_date: '2025-12-31' },
        businessCase: {
          summary: 'Test',
          nodes: [{ node_id: 'n1', label: 'Node', type: 'capability' }],
          links: [],
          calculations: [],
          kpi_targets: [],
          reasoning: 'Test',
          confidence_level: 'high'
        }
      };

      const result = await agent.persistTargetArtifacts(output, 'vc-1', 'session-1');

      expect(result.valueTreeId).toBeDefined();
      expect(result.roiModelId).toBeDefined();
      expect(result.valueCommitId).toBeDefined();
    });

    it('throws when inserting duplicate node IDs', async () => {
      const supabase = createBoltClientMock({
        value_tree_nodes: [{ id: 'existing', value_tree_id: 'tree-dup', node_id: 'dup', label: 'Dup', type: 'capability' }]
      });

      const agentWithMockDb = new TargetAgent('target-dup', mockLLM as any, mockMemory as any, mockAudit as any, supabase as any);
      const output = {
        valueTree: { name: 'Tree', value_case_id: 'vc-1' },
        roiModel: { name: 'ROI', assumptions: [] },
        valueCommit: { notes: 'Test', target_date: '2025-12-31' },
        businessCase: {
          summary: 'Test',
          nodes: [
            { node_id: 'dup', label: 'Node', type: 'capability' },
            { node_id: 'dup', label: 'Node2', type: 'capability' }
          ],
          links: [],
          calculations: [],
          kpi_targets: [],
          reasoning: 'Test',
          confidence_level: 'high'
        }
      };

      const originalFrom = supabase.from;
      supabase.from = vi.fn((table: string) => {
        if (table === 'value_tree_nodes') {
          return {
            insert: () => {
              throw new Error('duplicate node_id');
            }
          } as any;
        }
        return originalFrom(table);
      });

      await expect(agentWithMockDb.persistTargetArtifacts(output as any, 'vc-1')).rejects.toThrow(/duplicate node_id/);
    });

    it('propagates ROI model insert errors and stops before value commit', async () => {
      const supabase = createBoltClientMock({
        value_trees: [],
        value_tree_nodes: [],
        value_tree_links: [],
        roi_models: [],
        roi_model_calculations: [],
        value_commits: [],
        kpi_targets: []
      });

      const agentWithMockDb = new TargetAgent('target-roi-fail', mockLLM as any, mockMemory as any, mockAudit as any, supabase as any);
      const output = {
        valueTree: { name: 'Tree', value_case_id: 'vc-1' },
        roiModel: { name: 'ROI', assumptions: [] },
        valueCommit: { notes: 'Test', target_date: '2025-12-31' },
        businessCase: {
          summary: 'Test',
          nodes: [{ node_id: 'n1', label: 'Node', type: 'capability' }],
          links: [],
          calculations: [{ name: 'calc', formula: '1+1', description: '', calculation_order: 1, result_type: 'cost', unit: 'usd' }],
          kpi_targets: [],
          reasoning: 'Test',
          confidence_level: 'high'
        }
      };

      const originalFrom = supabase.from;
      supabase.from = vi.fn((table: string) => {
        if (table === 'roi_models') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: null, error: new Error('ROI fail') })
              })
            })
          } as any;
        }
        return originalFrom(table);
      });

      await expect(agentWithMockDb.persistTargetArtifacts(output as any, 'vc-1')).rejects.toThrow(/ROI fail/);
      expect(supabase.tables.value_commits || []).toHaveLength(0);
    });

    it('throws when KPI target insertion fails', async () => {
      const supabase = createBoltClientMock({
        value_trees: [],
        value_tree_nodes: [],
        value_tree_links: [],
        roi_models: [],
        roi_model_calculations: [],
        value_commits: [],
        kpi_targets: []
      });

      const agentWithMockDb = new TargetAgent('target-kpi-fail', mockLLM as any, mockMemory as any, mockAudit as any, supabase as any);
      const output = {
        valueTree: { name: 'Tree', value_case_id: 'vc-1' },
        roiModel: { name: 'ROI', assumptions: [] },
        valueCommit: { notes: 'Test', target_date: '2025-12-31' },
        businessCase: {
          summary: 'Test',
          nodes: [{ node_id: 'n1', label: 'Node', type: 'capability' }],
          links: [],
          calculations: [],
          kpi_targets: [{ kpi_name: 'Hours', baseline_value: 1, target_value: 2, unit: 'hours', deadline: '2025-12-31', confidence_level: 'high' }],
          reasoning: 'Test',
          confidence_level: 'high'
        }
      };

      const originalFrom = supabase.from;
      supabase.from = vi.fn((table: string) => {
        if (table === 'kpi_targets') {
          return {
            insert: () => {
              throw new Error('KPI insert fail');
            }
          } as any;
        }
        return originalFrom(table);
      });

      await expect(agentWithMockDb.persistTargetArtifacts(output as any, 'vc-1')).rejects.toThrow(/KPI insert fail/);
      expect(supabase.tables.kpi_targets).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM failures', async () => {
      mockLLM.complete.mockRejectedValue(new Error('LLM error'));

      await expect(
        agent.execute('session-1', { valueCaseId: 'vc-1', businessObjectives: [], capabilities: [] })
      ).rejects.toThrow();
    });
  });
});
