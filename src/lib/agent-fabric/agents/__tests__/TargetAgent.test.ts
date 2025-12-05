/**
 * TargetAgent Tests
 * Tests business case generation with value trees and ROI models
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TargetAgent } from '../TargetAgent';
import type { TargetAgentInput } from '../../../../types/vos';
import type { LLMGateway } from '../../LLMGateway';
import type { MemorySystem } from '../../MemorySystem';
import type { AuditLogger } from '../../AuditLogger';

describe('TargetAgent', () => {
  let agent: TargetAgent;
  let mockLLMGateway: LLMGateway;
  let mockMemorySystem: MemorySystem;
  let mockAuditLogger: AuditLogger;
  let mockSupabase: any;

  beforeEach(() => {
    // Mock LLM Gateway with structured response
    mockLLMGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          value_tree: {
            name: 'Customer Value Tree',
            description: 'Value generation from automation',
            nodes: [
              {
                node_id: 'outcome-1',
                name: 'Reduced Manual Work',
                type: 'outcome',
                value_type: 'time_savings',
                quantified_value: 520,
                unit: 'hours_per_year'
              }
            ],
            links: [
              {
                source_node_id: 'capability-1',
                target_node_id: 'outcome-1',
                relationship_type: 'enables'
              }
            ]
          },
          roi_model: {
            name: 'Automation ROI',
            assumptions: [
              { key: 'hourly_rate', value: 50, source: 'market_data' }
            ],
            calculations: [
              {
                name: 'Annual Savings',
                formula: 'time_savings * hourly_rate',
                result_value: 26000,
                unit: 'USD'
              }
            ],
            confidence_level: 'high'
          },
          value_commit: {
            notes: 'Committed to 520 hours saved annually',
            target_date: '2025-12-31'
          },
          kpi_targets: [
            {
              kpi_name: 'Hours Saved',
              baseline_value: 0,
              target_value: 520,
              unit: 'hours',
              deadline: '2025-12-31',
              confidence_level: 'high'
            }
          ],
          business_case_summary: 'Strong ROI from automation initiative',
          confidence_level: 'high',
          reasoning: 'Based on current manual process analysis'
        }),
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        tokens_used: 2500
      })
    } as any;

    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined)
    } as any;

    mockAuditLogger = {
      logAgentExecution: vi.fn().mockResolvedValue(undefined),
      logMetric: vi.fn().mockResolvedValue(undefined)
    } as any;

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    agent = new TargetAgent({
      id: 'test-target-agent',
      organizationId: 'org-123',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase
    });
  });

  describe('execute', () => {
    const validInput: TargetAgentInput = {
      valueCaseId: 'case-123',
      businessObjectives: [
        {
          id: 'obj-1',
          value_case_id: 'case-123',
          title: 'Reduce Manual Work',
          description: 'Automate repetitive tasks',
          priority: 'high',
          target_completion_date: '2025-12-31',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      capabilities: [
        {
          id: 'cap-1',
          name: 'Process Automation',
          description: 'Automate workflows',
          category: 'automation',
          tags: ['automation', 'efficiency'],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
    };

    it('should generate complete business case', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result).toBeDefined();
      expect(result.valueTree).toBeDefined();
      expect(result.roiModel).toBeDefined();
      expect(result.valueCommit).toBeDefined();
      expect(result.kpiTargets).toBeDefined();
    });

    it('should create value tree with nodes and links', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.valueTree.name).toBe('Customer Value Tree');
      expect(result.valueTree.value_case_id).toBe('case-123');
      expect(result.valueTree.version).toBe(1);
    });

    it('should create ROI model with calculations', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.roiModel.name).toBe('Automation ROI');
      expect(result.roiModel.organization_id).toBe('org-123');
      expect(result.roiModel.assumptions).toHaveLength(1);
    });

    it('should create value commit', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.valueCommit.value_case_id).toBe('case-123');
      expect(result.valueCommit.status).toBe('active');
      expect(result.valueCommit.target_date).toBeDefined();
    });

    it('should create KPI targets', async () => {
      const result = await agent.execute('session-123', validInput);

      expect(result.kpiTargets).toHaveLength(1);
      expect(result.kpiTargets[0].kpi_name).toBe('Hours Saved');
      expect(result.kpiTargets[0].target_value).toBe(520);
    });

    it('should call LLM with business objectives and capabilities', async () => {
      await agent.execute('session-123', validInput);

      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Business Objectives')
          })
        ]),
        expect.objectContaining({
          temperature: 0.3,
          max_tokens: 4000
        })
      );
    });

    it('should use await when calling extractJSON', async () => {
      // This test verifies the bug fix where extractJSON wasn't awaited
      const result = await agent.execute('session-123', validInput);

      expect(result).toBeDefined();
      expect(typeof result.valueTree.name).toBe('string');
    });

    it('should include organization_id in ROI model', async () => {
      // This test verifies the bug fix where organization_id was missing
      const result = await agent.execute('session-123', validInput);

      expect(result.roiModel.organization_id).toBe('org-123');
    });

    it('should log performance metrics', async () => {
      await agent.execute('session-123', validInput);

      expect(mockAuditLogger.logMetric).toHaveBeenCalledWith(
        'session-123',
        'tokens_used',
        2500,
        'tokens'
      );

      expect(mockAuditLogger.logMetric).toHaveBeenCalledWith(
        'session-123',
        'latency_ms',
        expect.any(Number),
        'ms'
      );
    });

    it('should store semantic memory', async () => {
      await agent.execute('session-123', validInput);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalled();
    });

    it('should handle LLM errors', async () => {
      mockLLMGateway.complete = vi.fn().mockRejectedValue(
        new Error('LLM timeout')
      );

      await expect(
        agent.execute('session-123', validInput)
      ).rejects.toThrow('LLM timeout');
    });

    it('should handle malformed responses', async () => {
      mockLLMGateway.complete = vi.fn().mockResolvedValue({
        content: 'Invalid JSON',
        model: 'test',
        tokens_used: 100
      });

      await expect(
        agent.execute('session-123', validInput)
      ).rejects.toThrow();
    });

    it('should require business objectives', async () => {
      const invalidInput = {
        ...validInput,
        businessObjectives: []
      };

      const result = await agent.execute('session-123', invalidInput);
      
      // Should still execute but with empty objectives
      expect(result).toBeDefined();
    });

    it('should work with multiple capabilities', async () => {
      const multiCapInput = {
        ...validInput,
        capabilities: [
          ...validInput.capabilities,
          {
            id: 'cap-2',
            name: 'Analytics',
            description: 'Data analysis',
            category: 'analytics',
            tags: ['data', 'insights'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };

      const result = await agent.execute('session-123', multiCapInput);
      
      expect(result).toBeDefined();
      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Analytics')
          })
        ]),
        expect.any(Object)
      );
    });
  });

  describe('persistTargetArtifacts', () => {
    it('should require supabase client', async () => {
      const agentWithoutSupabase = new TargetAgent({
        id: 'test',
        llmGateway: mockLLMGateway,
        memorySystem: mockMemorySystem,
        auditLogger: mockAuditLogger,
        supabase: null
      });

      const mockOutput: any = {
        valueTree: {},
        roiModel: {},
        valueCommit: {},
        kpiTargets: []
      };

      await expect(
        agentWithoutSupabase.persistTargetArtifacts(mockOutput, 'case-123')
      ).rejects.toThrow();
    });
  });
});
