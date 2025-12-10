/**
 * OpportunityAgent Tests
 * 
 * Tests for Outcome Engineer Agent with systemic outcome framework
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpportunityAgent } from '../../agents/OpportunityAgent';

describe('OpportunityAgent', () => {
  let agent: OpportunityAgent;

  beforeEach(() => {
    agent = new OpportunityAgent();
  });

  describe('Outcome Hypothesis Engineering', () => {
    it('should create outcome hypotheses', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'Operations System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Process Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: [
          {
            id: 'kpi-1',
            name: 'Processing Time',
            current: 20,
            target: 4,
            unit: 'hours/week'
          }
        ]
      };

      const result = await agent.engineer(input);

      expect(result).toBeDefined();
      expect(result.outcomeHypotheses).toBeDefined();
      expect(Array.isArray(result.outcomeHypotheses)).toBe(true);
      expect(result.outcomeHypotheses.length).toBeGreaterThan(0);
    });

    it('should include causal chains', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: [
          {
            id: 'kpi-1',
            name: 'Efficiency',
            current: 50,
            target: 80,
            unit: 'percent'
          }
        ]
      };

      const result = await agent.engineer(input);

      const hypothesis = result.outcomeHypotheses[0];
      expect(hypothesis.causal_chain).toBeDefined();
      expect(Array.isArray(hypothesis.causal_chain)).toBe(true);
    });

    it('should include assumptions', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: [
          {
            id: 'kpi-1',
            name: 'Cost',
            current: 100000,
            target: 60000,
            unit: 'USD'
          }
        ]
      };

      const result = await agent.engineer(input);

      const hypothesis = result.outcomeHypotheses[0];
      expect(hypothesis.assumptions).toBeDefined();
      expect(Array.isArray(hypothesis.assumptions)).toBe(true);
    });

    it('should calculate confidence scores', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: [
          {
            id: 'kpi-1',
            name: 'Metric',
            current: 10,
            target: 20,
            unit: 'units'
          }
        ]
      };

      const result = await agent.engineer(input);

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('SDUI Generation', () => {
    it('should generate SDUI layout', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: []
      };

      const result = await agent.engineer(input);

      expect(result.sduiLayout).toBeDefined();
      expect(result.sduiLayout.type).toBe('OutcomeEngineeringPage');
      expect(result.sduiLayout.components).toBeDefined();
      expect(Array.isArray(result.sduiLayout.components)).toBe(true);
    });
  });

  describe('Insights', () => {
    it('should provide insights', async () => {
      const input = {
        organizationId: 'org-1',
        systemMap: {
          id: 'map-1',
          name: 'System',
          nodes: [],
          edges: []
        },
        interventionPoint: {
          id: 'int-1',
          name: 'Automation',
          type: 'capability',
          system_map_id: 'map-1'
        },
        kpis: []
      };

      const result = await agent.engineer(input);

      expect(result.insights).toBeDefined();
      expect(result.insights.primaryHypothesis).toBeDefined();
      expect(result.insights.confidenceLevel).toBeDefined();
    });
  });
});
