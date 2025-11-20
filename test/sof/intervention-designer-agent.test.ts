/**
 * InterventionDesignerAgent Tests
 * 
 * Tests for the InterventionDesignerAgent that designs interventions
 * based on system maps and leverage points.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InterventionDesignerAgent } from '../../src/agents/sof/InterventionDesignerAgent';
import type { SystemMap, InterventionPoint } from '../../src/types/sof';

describe('InterventionDesignerAgent', () => {
  let agent: InterventionDesignerAgent;

  beforeEach(() => {
    agent = new InterventionDesignerAgent();
  });

  describe('designInterventions', () => {
    it('should design interventions from system map', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-123',
        business_case_id: 'bc-123',
        map_name: 'Customer Onboarding System',
        map_description: 'System for onboarding new customers',
      };

      const leveragePoints = [
        {
          id: 'lp-1',
          system_map_id: 'map-123',
          leverage_type: 'information_flow',
          leverage_description: 'Customer communication channel',
          impact_potential: 8,
          feasibility_score: 7,
        },
      ];

      const result = await agent.designInterventions(
        systemMap as SystemMap,
        leveragePoints
      );

      expect(result).toBeDefined();
      expect(result.interventions).toBeInstanceOf(Array);
      expect(result.interventions.length).toBeGreaterThan(0);
    });

    it('should prioritize high-impact interventions', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-456',
        business_case_id: 'bc-456',
        map_name: 'Sales Process',
      };

      const leveragePoints = [
        {
          id: 'lp-1',
          system_map_id: 'map-456',
          leverage_type: 'rules',
          leverage_description: 'Pricing policy',
          impact_potential: 9,
          feasibility_score: 6,
        },
        {
          id: 'lp-2',
          system_map_id: 'map-456',
          leverage_type: 'information_flow',
          leverage_description: 'Lead routing',
          impact_potential: 5,
          feasibility_score: 8,
        },
      ];

      const result = await agent.designInterventions(
        systemMap as SystemMap,
        leveragePoints
      );

      // Should prioritize by impact * feasibility
      expect(result.interventions[0].expected_impact).toBeGreaterThanOrEqual(
        result.interventions[result.interventions.length - 1].expected_impact
      );
    });

    it('should create intervention sequences', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-789',
        business_case_id: 'bc-789',
        map_name: 'Digital Transformation',
      };

      const leveragePoints = [
        {
          id: 'lp-1',
          system_map_id: 'map-789',
          leverage_type: 'paradigms',
          leverage_description: 'Digital-first mindset',
          impact_potential: 10,
          feasibility_score: 4,
        },
      ];

      const result = await agent.designInterventions(
        systemMap as SystemMap,
        leveragePoints
      );

      const intervention = result.interventions[0];
      expect(intervention.intervention_sequence).toBeDefined();
      expect(intervention.intervention_sequence.length).toBeGreaterThan(0);
    });
  });

  describe('assessFeasibility', () => {
    it('should assess intervention feasibility', async () => {
      const intervention: Partial<InterventionPoint> = {
        intervention_type: 'structural',
        intervention_description: 'Reorganize customer service team',
        required_resources: ['budget', 'time', 'change management'],
      };

      const feasibility = await agent.assessFeasibility(
        intervention as InterventionPoint
      );

      expect(feasibility).toBeDefined();
      expect(feasibility.score).toBeGreaterThan(0);
      expect(feasibility.score).toBeLessThanOrEqual(10);
      expect(feasibility.factors).toBeInstanceOf(Array);
    });

    it('should identify implementation risks', async () => {
      const intervention: Partial<InterventionPoint> = {
        intervention_type: 'policy',
        intervention_description: 'Change compensation structure',
        required_resources: ['executive approval', 'legal review'],
      };

      const feasibility = await agent.assessFeasibility(
        intervention as InterventionPoint
      );

      expect(feasibility.risks).toBeDefined();
      expect(feasibility.risks.length).toBeGreaterThan(0);
    });

    it('should estimate resource requirements', async () => {
      const intervention: Partial<InterventionPoint> = {
        intervention_type: 'capability',
        intervention_description: 'Implement training program',
        required_resources: [],
      };

      const feasibility = await agent.assessFeasibility(
        intervention as InterventionPoint
      );

      expect(feasibility.resources).toBeDefined();
      expect(feasibility.resources.time).toBeDefined();
      expect(feasibility.resources.budget).toBeDefined();
      expect(feasibility.resources.people).toBeDefined();
    });
  });

  describe('generateInterventionOptions', () => {
    it('should generate multiple intervention options', async () => {
      const leveragePoint = {
        id: 'lp-1',
        system_map_id: 'map-123',
        leverage_type: 'feedback_loops',
        leverage_description: 'Customer feedback loop',
        impact_potential: 7,
        feasibility_score: 8,
      };

      const options = await agent.generateInterventionOptions(leveragePoint);

      expect(options).toBeInstanceOf(Array);
      expect(options.length).toBeGreaterThanOrEqual(2);
      expect(options.length).toBeLessThanOrEqual(5);
    });

    it('should vary intervention types', async () => {
      const leveragePoint = {
        id: 'lp-2',
        system_map_id: 'map-456',
        leverage_type: 'rules',
        leverage_description: 'Approval process',
        impact_potential: 6,
        feasibility_score: 7,
      };

      const options = await agent.generateInterventionOptions(leveragePoint);

      const types = options.map((opt) => opt.intervention_type);
      expect(new Set(types).size).toBeGreaterThan(1);
    });
  });

  describe('createInterventionSequence', () => {
    it('should create logical intervention sequence', async () => {
      const intervention: Partial<InterventionPoint> = {
        intervention_type: 'structural',
        intervention_description: 'Implement new CRM system',
        expected_impact: 8,
      };

      const sequence = await agent.createInterventionSequence(
        intervention as InterventionPoint
      );

      expect(sequence).toBeInstanceOf(Array);
      expect(sequence.length).toBeGreaterThan(0);
      
      // Should have foundation, catalyst, amplification phases
      const phases = sequence.map((step) => step.phase);
      expect(phases).toContain('foundation');
      expect(phases).toContain('catalyst');
    });

    it('should order steps logically', async () => {
      const intervention: Partial<InterventionPoint> = {
        intervention_type: 'capability',
        intervention_description: 'Digital skills training',
        expected_impact: 7,
      };

      const sequence = await agent.createInterventionSequence(
        intervention as InterventionPoint
      );

      // Foundation steps should come before catalyst
      const foundationIndex = sequence.findIndex((s) => s.phase === 'foundation');
      const catalystIndex = sequence.findIndex((s) => s.phase === 'catalyst');
      
      if (foundationIndex >= 0 && catalystIndex >= 0) {
        expect(foundationIndex).toBeLessThan(catalystIndex);
      }
    });
  });

  describe('error handling', () => {
    it('should handle empty leverage points', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-999',
        business_case_id: 'bc-999',
        map_name: 'Empty System',
      };

      const result = await agent.designInterventions(
        systemMap as SystemMap,
        []
      );

      expect(result.interventions).toBeInstanceOf(Array);
      expect(result.interventions.length).toBe(0);
    });

    it('should handle invalid system map', async () => {
      await expect(
        agent.designInterventions(null as any, [])
      ).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const invalidIntervention: Partial<InterventionPoint> = {
        // Missing required fields
      };

      await expect(
        agent.assessFeasibility(invalidIntervention as InterventionPoint)
      ).rejects.toThrow();
    });
  });
});
