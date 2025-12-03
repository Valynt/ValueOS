/**
 * OpportunityAgent Tests
 * 
 * Tests for the Opportunity Discovery Agent following MCP Ground Truth patterns.
 * 
 * Coverage Areas:
 * - Opportunity analysis and discovery
 * - Persona fit scoring
 * - Business objective extraction
 * - Pain point identification
 * - Value model generation
 * - Capability matching
 * - Integration with Value Fabric
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpportunityAgent } from '../../lib/agent-fabric/agents/OpportunityAgent';
import type { OpportunityAgentInput } from '../../types/vos';

describe('OpportunityAgent', () => {
  let agent: OpportunityAgent;
  let mockLLMGateway: any;
  let mockMemorySystem: any;
  let mockAuditLogger: any;
  let mockSupabase: any;
  let mockValueFabricService: any;

  beforeEach(() => {
    // Mock LLM Gateway
    mockLLMGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          opportunity_summary: 'Customer needs to reduce manual data entry by 50%',
          persona_fit: {
            score: 0.85,
            role: 'VP of Operations',
            seniority: 'executive',
            decision_authority: 'high',
            fit_reasoning: 'Strong alignment with operational efficiency goals'
          },
          business_objectives: [
            {
              name: 'Reduce operational costs',
              description: 'Decrease manual processing costs by 40%',
              priority: 1,
              owner: 'VP Operations'
            },
            {
              name: 'Improve data accuracy',
              description: 'Reduce data entry errors from 5% to 1%',
              priority: 2,
              owner: 'Data Quality Manager'
            }
          ],
          pain_points: [
            {
              category: 'efficiency',
              description: 'Manual data entry takes 20 hours per week',
              severity: 'high',
              frequency: 'daily',
              estimated_annual_cost: 100000,
              affected_stakeholders: ['Operations Team', 'Finance Team']
            },
            {
              category: 'cost',
              description: 'High error rate requires rework',
              severity: 'medium',
              frequency: 'weekly',
              estimated_annual_cost: 50000,
              affected_stakeholders: ['Quality Assurance', 'Customer Support']
            }
          ],
          initial_value_model: {
            outcomes: [
              {
                name: 'Automated data processing',
                description: 'Reduce manual entry by 80%',
                measurement: 'Hours saved per week',
                timeframe: '3 months'
              }
            ],
            kpis: [
              {
                name: 'Processing time',
                baseline: 20,
                target: 4,
                unit: 'hours/week',
                measurement_type: 'time'
              }
            ],
            financial_impact: {
              revenue_opportunity: 0,
              cost_savings: 120000,
              risk_reduction: 30000,
              total_value: 150000,
              confidence_level: 'medium'
            }
          },
          recommended_capability_tags: ['automation', 'data-integration', 'workflow'],
          confidence_level: 'high',
          reasoning: 'Clear pain points with quantifiable impact'
        }),
        tokens_used: 1500,
        model: 'gpt-4'
      })
    };

    // Mock Memory System
    mockMemorySystem = {
      storeSemanticMemory: vi.fn().mockResolvedValue(undefined)
    };

    // Mock Audit Logger
    mockAuditLogger = {
      log: vi.fn().mockResolvedValue(undefined)
    };

    // Mock Supabase
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'obj-123',
          value_case_id: 'vc-456',
          name: 'Test Objective',
          created_at: new Date().toISOString()
        },
        error: null
      })
    };

    // Create agent instance with AgentConfig
    agent = new OpportunityAgent({
      id: 'opportunity-agent-1',
      organizationId: 'org-123',
      userId: 'user-456',
      sessionId: 'session-789',
      llmGateway: mockLLMGateway,
      memorySystem: mockMemorySystem,
      auditLogger: mockAuditLogger,
      supabase: mockSupabase
    });

    // Mock ValueFabricService methods
    mockValueFabricService = {
      getCapabilities: vi.fn().mockResolvedValue([
        {
          id: 'cap-1',
          name: 'Process Automation',
          description: 'Automate repetitive tasks',
          tags: ['automation', 'workflow']
        },
        {
          id: 'cap-2',
          name: 'Data Integration',
          description: 'Connect disparate data sources',
          tags: ['data-integration', 'etl']
        }
      ]),
      semanticSearchCapabilities: vi.fn().mockResolvedValue([
        {
          item: {
            id: 'cap-3',
            name: 'Quality Assurance',
            description: 'Automated quality checks',
            tags: ['quality', 'validation']
          },
          score: 0.85
        }
      ])
    };

    // Inject mock service
    (agent as any).valueFabricService = mockValueFabricService;
  });

  describe('Opportunity Analysis', () => {
    it('should analyze discovery data and identify opportunities', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: [
          'Customer mentioned spending 20 hours per week on manual data entry',
          'VP of Operations expressed frustration with error rates',
          'Looking to reduce operational costs by 40% this year'
        ],
        customerProfile: {
          company_name: 'Acme Corp',
          industry: 'Manufacturing',
          size: '500-1000 employees',
          revenue_range: '$50M-$100M'
        }
      };

      const result = await agent.execute('session-123', input);

      // Verify opportunity summary
      expect(result.opportunitySummary).toBeDefined();
      expect(result.opportunitySummary).toContain('reduce');

      // Verify LLM was called
      expect(mockLLMGateway.complete).toHaveBeenCalledTimes(1);
      expect(mockLLMGateway.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
          temperature: 0.4,
          max_tokens: 3000
        })
      );
    });

    it('should score persona fit accurately', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['VP of Operations discussing efficiency improvements'],
        customerProfile: {
          company_name: 'Test Corp',
          industry: 'Technology'
        }
      };

      const result = await agent.execute('session-123', input);

      // Verify persona fit
      expect(result.personaFit).toBeDefined();
      expect(result.personaFit.score).toBeGreaterThan(0);
      expect(result.personaFit.score).toBeLessThanOrEqual(1);
      expect(result.personaFit.role).toBeDefined();
      expect(result.personaFit.decision_authority).toMatch(/low|medium|high/);
    });

    it('should extract business objectives', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Need to reduce costs and improve efficiency'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Verify business objectives
      expect(result.businessObjectives).toBeDefined();
      expect(Array.isArray(result.businessObjectives)).toBe(true);
      expect(result.businessObjectives.length).toBeGreaterThan(0);

      // Verify objective structure
      const objective = result.businessObjectives[0];
      expect(objective).toBeDefined();
      expect(objective?.name).toBeDefined();
      expect(objective?.description).toBeDefined();
      expect(objective?.priority).toBeGreaterThan(0);
      expect(objective?.owner).toBeDefined();
    });

    it('should identify and quantify pain points', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Manual processes costing $100k annually'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Verify initial value model contains pain points
      expect(result.initialValueModel).toBeDefined();
      expect(result.initialValueModel.financial_impact).toBeDefined();
      expect(result.initialValueModel.financial_impact.total_value).toBeGreaterThan(0);
    });

    it('should generate initial value model', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Looking for ROI within 6 months'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Verify value model structure
      expect(result.initialValueModel).toBeDefined();
      expect(result.initialValueModel.outcomes).toBeDefined();
      expect(result.initialValueModel.kpis).toBeDefined();
      expect(result.initialValueModel.financial_impact).toBeDefined();

      // Verify financial impact
      const impact = result.initialValueModel.financial_impact;
      expect(impact.total_value).toBeGreaterThan(0);
      expect(impact.confidence_level).toMatch(/low|medium|high/);
    });
  });

  describe('Capability Matching', () => {
    it('should recommend relevant capabilities', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Need automation and data integration'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Verify capabilities were matched
      expect(result.recommendedCapabilities).toBeDefined();
      expect(Array.isArray(result.recommendedCapabilities)).toBe(true);
      expect(result.recommendedCapabilities.length).toBeGreaterThan(0);

      // Verify capability structure
      const capability = result.recommendedCapabilities[0];
      expect(capability).toBeDefined();
      expect(capability?.id).toBeDefined();
      expect(capability?.name).toBeDefined();
      expect(capability?.description).toBeDefined();
    });

    it('should use tag-based capability matching', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Need workflow automation'],
        customerProfile: { company_name: 'Test Corp' }
      };

      await agent.execute('session-123', input);

      // Verify Value Fabric was queried with tags
      expect(mockValueFabricService.getCapabilities).toHaveBeenCalled();
      expect(mockValueFabricService.getCapabilities).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['automation'])
        })
      );
    });

    it('should fall back to semantic search when tag matching insufficient', async () => {
      // Mock fewer tag results
      mockValueFabricService.getCapabilities.mockResolvedValue([
        { id: 'cap-1', name: 'Single Capability', tags: ['automation'] }
      ]);

      const input: OpportunityAgentInput = {
        discoveryData: ['Complex business process optimization needed'],
        customerProfile: { company_name: 'Test Corp' }
      };

      await agent.execute('session-123', input);

      // Verify semantic search was used
      expect(mockValueFabricService.semanticSearchCapabilities).toHaveBeenCalled();
    });

    it('should limit capabilities to top 10', async () => {
      // Mock many capabilities
      const manyCapabilities = Array.from({ length: 20 }, (_, i) => ({
        id: `cap-${i}`,
        name: `Capability ${i}`,
        tags: ['test']
      }));
      mockValueFabricService.getCapabilities.mockResolvedValue(manyCapabilities);

      const input: OpportunityAgentInput = {
        discoveryData: ['Need many capabilities'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Verify limited to 10
      expect(result.recommendedCapabilities.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Memory and Logging', () => {
    it('should store semantic memory', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Important discovery data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      await agent.execute('session-123', input);

      // Verify memory was stored
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalled();
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        'session-123',
        'opportunity-agent-1',
        expect.stringContaining('Opportunity:'),
        expect.objectContaining({
          persona_fit: expect.any(Object),
          business_objectives: expect.any(Array),
          pain_points: expect.any(Array)
        })
      );
    });

    it('should log performance metrics', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const startTime = Date.now();
      await agent.execute('session-123', input);
      const duration = Date.now() - startTime;

      // Verify execution completed in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Business Objective Persistence', () => {
    it('should persist business objectives to database', async () => {
      const objectives = [
        {
          name: 'Reduce costs',
          description: 'Cut operational expenses by 30%',
          priority: 1 as const,
          owner: 'CFO'
        }
      ];

      const result = await agent.persistBusinessObjectives(
        'value-case-123',
        objectives,
        'session-123'
      );

      // Verify database insert
      expect(mockSupabase.from).toHaveBeenCalledWith('business_objectives');
      expect(mockSupabase.insert).toHaveBeenCalled();

      // Verify result
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toBeDefined();
      expect(result[0]?.id).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const objectives = [
        {
          name: 'Test Objective',
          description: 'Test',
          priority: 1 as const,
          owner: 'Test'
        }
      ];

      const result = await agent.persistBusinessObjectives(
        'value-case-123',
        objectives
      );

      // Should return empty array on error
      expect(result).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM failures gracefully', async () => {
      mockLLMGateway.complete.mockRejectedValue(new Error('LLM service unavailable'));

      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      // Should throw error
      await expect(agent.execute('session-123', input)).rejects.toThrow();
    });

    it('should handle invalid JSON from LLM', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: 'Invalid JSON response',
        tokens_used: 100,
        model: 'gpt-4'
      });

      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      // Should throw error
      await expect(agent.execute('session-123', input)).rejects.toThrow();
    });

    it('should handle empty discovery data', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: [],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Should still execute but with minimal data
      expect(result).toBeDefined();
      expect(mockLLMGateway.complete).toHaveBeenCalled();
    });

    it('should handle semantic search failures', async () => {
      mockValueFabricService.semanticSearchCapabilities.mockRejectedValue(
        new Error('Search service unavailable')
      );

      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      // Should still complete using tag-based results
      const result = await agent.execute('session-123', input);
      expect(result).toBeDefined();
      expect(result.recommendedCapabilities).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long discovery data', async () => {
      const longDiscoveryData = Array.from({ length: 100 }, (_, i) =>
        `Discovery document ${i}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`
      );

      const input: OpportunityAgentInput = {
        discoveryData: longDiscoveryData,
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Should handle large input
      expect(result).toBeDefined();
      expect(mockLLMGateway.complete).toHaveBeenCalled();
    });

    it('should handle missing customer profile fields', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: {} // Empty profile
      };

      const result = await agent.execute('session-123', input);

      // Should still execute
      expect(result).toBeDefined();
    });

    it('should handle zero pain points identified', async () => {
      mockLLMGateway.complete.mockResolvedValue({
        content: JSON.stringify({
          opportunity_summary: 'No clear opportunity',
          persona_fit: { score: 0.3, role: 'Unknown', seniority: 'unknown', decision_authority: 'low', fit_reasoning: 'Poor fit' },
          business_objectives: [],
          pain_points: [],
          initial_value_model: {
            outcomes: [],
            kpis: [],
            financial_impact: {
              revenue_opportunity: 0,
              cost_savings: 0,
              risk_reduction: 0,
              total_value: 0,
              confidence_level: 'low'
            }
          },
          recommended_capability_tags: [],
          confidence_level: 'low',
          reasoning: 'Insufficient data'
        }),
        tokens_used: 500,
        model: 'gpt-4'
      });

      const input: OpportunityAgentInput = {
        discoveryData: ['Vague conversation'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const result = await agent.execute('session-123', input);

      // Should handle zero results
      expect(result).toBeDefined();
      expect(result.businessObjectives).toEqual([]);
      expect(result.initialValueModel.financial_impact.total_value).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should complete full opportunity analysis workflow', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: [
          'Customer: We spend too much time on manual data entry',
          'Customer: Our error rate is around 5% which causes rework',
          'Customer: We need to reduce operational costs by 40% this year',
          'VP Operations: This is a top priority for our team'
        ],
        customerProfile: {
          company_name: 'Acme Manufacturing',
          industry: 'Manufacturing',
          size: '500-1000 employees',
          revenue_range: '$50M-$100M',
          location: 'United States'
        }
      };

      const result = await agent.execute('session-123', input);

      // Verify complete workflow
      expect(result.opportunitySummary).toBeDefined();
      expect(result.personaFit.score).toBeGreaterThan(0.5);
      expect(result.businessObjectives.length).toBeGreaterThan(0);
      expect(result.recommendedCapabilities.length).toBeGreaterThan(0);
      expect(result.initialValueModel.financial_impact.total_value).toBeGreaterThan(0);

      // Verify all systems were called
      expect(mockLLMGateway.complete).toHaveBeenCalled();
      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalled();
      expect(mockValueFabricService.getCapabilities).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should complete analysis within acceptable time', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      const startTime = Date.now();
      await agent.execute('session-123', input);
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent executions', async () => {
      const input: OpportunityAgentInput = {
        discoveryData: ['Test data'],
        customerProfile: { company_name: 'Test Corp' }
      };

      // Execute multiple times concurrently
      const promises = [
        agent.execute('session-1', input),
        agent.execute('session-2', input),
        agent.execute('session-3', input)
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.opportunitySummary).toBeDefined();
      });
    });
  });
});
