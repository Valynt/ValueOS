/**
 * SystemMapperAgent Tests
 * 
 * Tests for the SystemMapperAgent that analyzes discovery data
 * and creates system maps.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemMapperAgent } from '../../src/agents/sof/SystemMapperAgent';
import type { SystemMap, Entity, Relationship } from '../../src/types/sof';

describe('SystemMapperAgent', () => {
  let agent: SystemMapperAgent;

  beforeEach(() => {
    agent = new SystemMapperAgent();
  });

  describe('analyzeDiscoveryData', () => {
    it('should create a system map from discovery data', async () => {
      const discoveryData = {
        problem_statement: 'Customer churn is increasing due to poor onboarding',
        stakeholders: ['customers', 'support team', 'product team'],
        current_state: 'Manual onboarding process with high drop-off',
        desired_state: 'Automated onboarding with 90% completion rate',
      };

      const result = await agent.analyzeDiscoveryData(
        'business-case-123',
        discoveryData
      );

      expect(result).toBeDefined();
      expect(result.systemMap).toBeDefined();
      expect(result.systemMap.business_case_id).toBe('business-case-123');
      expect(result.entities).toBeInstanceOf(Array);
      expect(result.relationships).toBeInstanceOf(Array);
      expect(result.leveragePoints).toBeInstanceOf(Array);
    });

    it('should identify key entities from stakeholders', async () => {
      const discoveryData = {
        problem_statement: 'Sales cycle is too long',
        stakeholders: ['sales team', 'prospects', 'marketing'],
        current_state: 'Average 90-day sales cycle',
      };

      const result = await agent.analyzeDiscoveryData(
        'business-case-456',
        discoveryData
      );

      expect(result.entities.length).toBeGreaterThan(0);
      
      const entityTypes = result.entities.map((e) => e.entity_type);
      expect(entityTypes).toContain('actor');
    });

    it('should identify relationships between entities', async () => {
      const discoveryData = {
        problem_statement: 'Inventory management inefficiency',
        stakeholders: ['warehouse', 'suppliers', 'retail stores'],
        current_state: 'Frequent stockouts and overstocking',
      };

      const result = await agent.analyzeDiscoveryData(
        'business-case-789',
        discoveryData
      );

      expect(result.relationships.length).toBeGreaterThan(0);
      
      const relationshipTypes = result.relationships.map((r) => r.relationship_type);
      expect(relationshipTypes.length).toBeGreaterThan(0);
    });

    it('should identify leverage points', async () => {
      const discoveryData = {
        problem_statement: 'Low employee engagement',
        stakeholders: ['employees', 'managers', 'HR'],
        current_state: 'Engagement score of 5.5/10',
        desired_state: 'Engagement score of 8/10',
      };

      const result = await agent.analyzeDiscoveryData(
        'business-case-101',
        discoveryData
      );

      expect(result.leveragePoints.length).toBeGreaterThan(0);
      
      result.leveragePoints.forEach((lp) => {
        expect(lp.leverage_type).toBeDefined();
        expect(lp.impact_potential).toBeGreaterThan(0);
        expect(lp.impact_potential).toBeLessThanOrEqual(10);
      });
    });

    it('should handle minimal discovery data', async () => {
      const discoveryData = {
        problem_statement: 'Need to improve efficiency',
      };

      const result = await agent.analyzeDiscoveryData(
        'business-case-202',
        discoveryData
      );

      expect(result).toBeDefined();
      expect(result.systemMap).toBeDefined();
      // Should still create some basic structure
      expect(result.entities.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('identifyLeveragePoints', () => {
    it('should rank leverage points by impact potential', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-123',
        business_case_id: 'bc-123',
        map_name: 'Test Map',
      };

      const entities: Partial<Entity>[] = [
        {
          id: 'entity-1',
          entity_type: 'actor',
          entity_name: 'Customer',
        },
        {
          id: 'entity-2',
          entity_type: 'process',
          entity_name: 'Onboarding',
        },
      ];

      const relationships: Partial<Relationship>[] = [
        {
          id: 'rel-1',
          source_entity_id: 'entity-1',
          target_entity_id: 'entity-2',
          relationship_type: 'participates_in',
        },
      ];

      const leveragePoints = await agent.identifyLeveragePoints(
        systemMap as SystemMap,
        entities as Entity[],
        relationships as Relationship[]
      );

      expect(leveragePoints.length).toBeGreaterThan(0);
      
      // Should be sorted by impact potential (descending)
      for (let i = 0; i < leveragePoints.length - 1; i++) {
        expect(leveragePoints[i].impact_potential).toBeGreaterThanOrEqual(
          leveragePoints[i + 1].impact_potential
        );
      }
    });

    it('should identify different leverage types', async () => {
      const systemMap: Partial<SystemMap> = {
        id: 'map-456',
        business_case_id: 'bc-456',
        map_name: 'Complex System',
      };

      const entities: Partial<Entity>[] = [
        { id: 'e1', entity_type: 'actor', entity_name: 'User' },
        { id: 'e2', entity_type: 'process', entity_name: 'Workflow' },
        { id: 'e3', entity_type: 'resource', entity_name: 'Data' },
        { id: 'e4', entity_type: 'structure', entity_name: 'Policy' },
      ];

      const relationships: Partial<Relationship>[] = [
        { id: 'r1', source_entity_id: 'e1', target_entity_id: 'e2', relationship_type: 'uses' },
        { id: 'r2', source_entity_id: 'e2', target_entity_id: 'e3', relationship_type: 'produces' },
        { id: 'r3', source_entity_id: 'e4', target_entity_id: 'e2', relationship_type: 'governs' },
      ];

      const leveragePoints = await agent.identifyLeveragePoints(
        systemMap as SystemMap,
        entities as Entity[],
        relationships as Relationship[]
      );

      const leverageTypes = leveragePoints.map((lp) => lp.leverage_type);
      expect(new Set(leverageTypes).size).toBeGreaterThan(1);
    });
  });

  describe('updateSystemMap', () => {
    it('should update an existing system map', async () => {
      const systemMapId = 'map-789';
      const updates = {
        map_name: 'Updated Map Name',
        map_description: 'Updated description',
      };

      const updatedMap = await agent.updateSystemMap(systemMapId, updates);

      expect(updatedMap).toBeDefined();
      expect(updatedMap.id).toBe(systemMapId);
    });

    it('should add new entities to existing map', async () => {
      const systemMapId = 'map-101';
      const newEntity: Partial<Entity> = {
        entity_type: 'actor',
        entity_name: 'New Stakeholder',
        entity_description: 'A newly identified stakeholder',
      };

      const result = await agent.addEntity(systemMapId, newEntity);

      expect(result).toBeDefined();
      expect(result.entity_name).toBe('New Stakeholder');
    });

    it('should add new relationships to existing map', async () => {
      const systemMapId = 'map-202';
      const newRelationship: Partial<Relationship> = {
        source_entity_id: 'entity-1',
        target_entity_id: 'entity-2',
        relationship_type: 'influences',
        relationship_strength: 0.8,
      };

      const result = await agent.addRelationship(systemMapId, newRelationship);

      expect(result).toBeDefined();
      expect(result.relationship_type).toBe('influences');
      expect(result.relationship_strength).toBe(0.8);
    });
  });

  describe('error handling', () => {
    it('should handle invalid discovery data gracefully', async () => {
      const invalidData = null;

      await expect(
        agent.analyzeDiscoveryData('bc-999', invalidData as any)
      ).rejects.toThrow();
    });

    it('should handle missing business case ID', async () => {
      const discoveryData = {
        problem_statement: 'Test problem',
      };

      await expect(
        agent.analyzeDiscoveryData('', discoveryData)
      ).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      // Mock database error
      vi.spyOn(agent as any, 'saveSystemMap').mockRejectedValue(
        new Error('Database connection failed')
      );

      const discoveryData = {
        problem_statement: 'Test problem',
      };

      await expect(
        agent.analyzeDiscoveryData('bc-error', discoveryData)
      ).rejects.toThrow('Database connection failed');
    });
  });
});
