/**
 * ExpansionAgent Tests
 * 
 * Tests for Expansion Agent with growth analysis and upsell detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExpansionAgent } from '../../lib/agent-fabric/agents/ExpansionAgent';

describe('ExpansionAgent', () => {
  let agent: ExpansionAgent;
  let mockLLM: any;
  let mockMemory: any;
  let mockAudit: any;
  let mockDB: any;

  beforeEach(() => {
    mockLLM = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          expansion_opportunities: [
            {
              opportunity_type: 'upsell',
              title: 'Advanced Analytics Module',
              description: 'Add predictive analytics capabilities',
              recommended_capabilities: ['cap-analytics'],
              estimated_incremental_value: 50000,
              confidence_score: 0.85,
              reasoning: 'Strong data foundation exists'
            }
          ],
          gap_analysis: {
            underperforming_areas: ['Data quality'],
            missing_capabilities: ['Quality assurance'],
            improvement_potential: 30000
          },
          executive_summary: 'Strong expansion potential with analytics',
          confidence_level: 'high'
        }),
        tokens_used: 1500,
        model: 'gpt-4'
      })
    };

    mockMemory = { storeSemanticMemory: vi.fn() };
    mockAudit = { log: vi.fn() };
    mockDB = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'report-1',
          metadata: { overall_status: 'on_track' }
        }
      })
    };

    agent = new ExpansionAgent('expansion-1', mockLLM, mockMemory, mockAudit, mockDB);
  });

  describe('Opportunity Detection', () => {
    it('should identify expansion opportunities', async () => {
      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      const result = await agent.execute('session-1', input);

      expect(result.expansionOpportunities).toBeDefined();
      expect(Array.isArray(result.expansionOpportunities)).toBe(true);
      expect(result.expansionOpportunities.length).toBeGreaterThan(0);
    });

    it('should score opportunities by confidence', async () => {
      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      const result = await agent.execute('session-1', input);

      const opp = result.expansionOpportunities[0];
      expect(opp.confidence_score).toBeGreaterThan(0);
      expect(opp.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should estimate incremental value', async () => {
      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      const result = await agent.execute('session-1', input);

      const opp = result.expansionOpportunities[0];
      expect(opp.estimated_incremental_value).toBeGreaterThan(0);
    });
  });

  describe('Gap Analysis', () => {
    it('should identify underperforming areas', async () => {
      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      const result = await agent.execute('session-1', input);

      expect(result.gapAnalysis).toBeDefined();
      expect(result.gapAnalysis.underperforming_areas).toBeDefined();
    });

    it('should identify missing capabilities', async () => {
      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      const result = await agent.execute('session-1', input);

      expect(result.gapAnalysis.missing_capabilities).toBeDefined();
      expect(Array.isArray(result.gapAnalysis.missing_capabilities)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM failures', async () => {
      mockLLM.complete.mockRejectedValue(new Error('LLM error'));

      const input = {
        realizationReportId: 'report-1',
        currentValueTree: { id: 'tree-1' }
      };

      await expect(agent.execute('session-1', input)).rejects.toThrow();
    });
  });
});
