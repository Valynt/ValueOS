/**
 * SOF Governance Service Tests
 * 
 * Tests for governance controls and audit event management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createGovernanceControl,
  getGovernanceControls,
  updateControlCompliance,
  checkGovernanceCompliance,
  createAuditEvent,
  getAuditEvents,
  getEntityAuditTrail,
  createLifecycleLink,
  getArtifactLinks,
} from '../../src/lib/sof-governance';
import type {
  CreateGovernanceControl,
  CreateAuditEvent,
  CreateLifecycleArtifactLink,
} from '../../src/types/sof-governance';

describe('SOF Governance Service', () => {
  const testBusinessCaseId = 'test-bc-' + Date.now();
  const testSystemMapId = 'test-map-' + Date.now();
  let createdControlIds: string[] = [];
  let createdEventIds: string[] = [];

  afterEach(async () => {
    // Cleanup test data
    // Note: In real tests, you'd clean up the database
    createdControlIds = [];
    createdEventIds = [];
  });

  describe('Governance Controls', () => {
    it('should create a governance control', async () => {
      const control: CreateGovernanceControl = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        control_type: 'ethical_review',
        control_name: 'Test Ethical Review',
        control_description: 'Test control for ethical review',
        enforcement_level: 'warning',
      };

      const result = await createGovernanceControl(control);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.control_name).toBe('Test Ethical Review');
      expect(result.enforcement_level).toBe('warning');
      expect(result.compliance_status).toBe('pending');

      createdControlIds.push(result.id);
    });

    it('should get governance controls for business case', async () => {
      // Create test control first
      const control: CreateGovernanceControl = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        control_type: 'risk_mitigation',
        control_name: 'Test Risk Control',
        enforcement_level: 'advisory',
      };

      const created = await createGovernanceControl(control);
      createdControlIds.push(created.id);

      const controls = await getGovernanceControls(testBusinessCaseId);

      expect(controls).toBeInstanceOf(Array);
      expect(controls.length).toBeGreaterThan(0);
      expect(controls.some((c) => c.id === created.id)).toBe(true);
    });

    it('should update control compliance status', async () => {
      // Create test control
      const control: CreateGovernanceControl = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        control_type: 'compliance_check',
        control_name: 'Test Compliance',
        enforcement_level: 'blocking',
      };

      const created = await createGovernanceControl(control);
      createdControlIds.push(created.id);

      // Update compliance
      const updated = await updateControlCompliance(
        created.id,
        'compliant',
        [{ type: 'document', url: 'https://example.com/evidence.pdf' }]
      );

      expect(updated.compliance_status).toBe('compliant');
      expect(updated.compliance_evidence).toBeDefined();
      expect(updated.compliance_evidence.length).toBeGreaterThan(0);
      expect(updated.last_reviewed_at).toBeDefined();
    });

    it('should check governance compliance', async () => {
      // Create blocking control with non-compliant status
      const control: CreateGovernanceControl = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        control_type: 'approval_gate',
        control_name: 'Test Approval Gate',
        enforcement_level: 'blocking',
      };

      const created = await createGovernanceControl(control);
      createdControlIds.push(created.id);

      // Set to non-compliant
      await updateControlCompliance(created.id, 'non_compliant');

      const compliance = await checkGovernanceCompliance(testBusinessCaseId);

      expect(compliance).toBeDefined();
      expect(compliance.is_compliant).toBe(false);
      expect(compliance.blocking_controls).toBeGreaterThan(0);
      expect(compliance.non_compliant_controls).toBeGreaterThan(0);
    });

    it('should handle different enforcement levels', async () => {
      const levels: Array<'advisory' | 'warning' | 'blocking'> = [
        'advisory',
        'warning',
        'blocking',
      ];

      for (const level of levels) {
        const control: CreateGovernanceControl = {
          business_case_id: testBusinessCaseId,
          system_map_id: testSystemMapId,
          control_type: 'documentation_requirement',
          control_name: `Test ${level} Control`,
          enforcement_level: level,
        };

        const result = await createGovernanceControl(control);
        expect(result.enforcement_level).toBe(level);
        createdControlIds.push(result.id);
      }
    });
  });

  describe('Audit Events', () => {
    it('should create an audit event', async () => {
      const event: CreateAuditEvent = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        event_type: 'system_map_created',
        event_description: 'Test system map creation',
        actor_type: 'agent',
        agent_name: 'SystemMapperAgent',
      };

      const result = await createAuditEvent(event);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.event_type).toBe('system_map_created');
      expect(result.actor_type).toBe('agent');

      createdEventIds.push(result.id);
    });

    it('should get audit events for business case', async () => {
      // Create test event
      const event: CreateAuditEvent = {
        business_case_id: testBusinessCaseId,
        event_type: 'intervention_designed',
        event_description: 'Test intervention',
        actor_type: 'user',
      };

      const created = await createAuditEvent(event);
      createdEventIds.push(created.id);

      const events = await getAuditEvents(testBusinessCaseId);

      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.id === created.id)).toBe(true);
    });

    it('should track state changes in audit events', async () => {
      const previousState = { status: 'draft' };
      const newState = { status: 'published' };

      const event: CreateAuditEvent = {
        business_case_id: testBusinessCaseId,
        system_map_id: testSystemMapId,
        event_type: 'system_map_updated',
        event_description: 'Status changed',
        previous_state: previousState,
        new_state: newState,
        change_summary: 'Changed status from draft to published',
        actor_type: 'user',
      };

      const result = await createAuditEvent(event);

      expect(result.previous_state).toEqual(previousState);
      expect(result.new_state).toEqual(newState);
      expect(result.change_summary).toBeDefined();

      createdEventIds.push(result.id);
    });

    it('should get entity audit trail', async () => {
      const entityId = 'test-entity-' + Date.now();

      // Create multiple events for the entity
      const events: CreateAuditEvent[] = [
        {
          business_case_id: testBusinessCaseId,
          entity_id: entityId,
          event_type: 'entity_added',
          event_description: 'Entity created',
          actor_type: 'agent',
        },
        {
          business_case_id: testBusinessCaseId,
          entity_id: entityId,
          event_type: 'entity_modified',
          event_description: 'Entity updated',
          actor_type: 'user',
        },
      ];

      for (const event of events) {
        const created = await createAuditEvent(event);
        createdEventIds.push(created.id);
      }

      const trail = await getEntityAuditTrail('entity', entityId);

      expect(trail).toBeInstanceOf(Array);
      expect(trail.length).toBeGreaterThanOrEqual(2);
      
      // Should be ordered by created_at DESC
      if (trail.length > 1) {
        const dates = trail.map((e) => new Date(e.created_at).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
      }
    });

    it('should handle different actor types', async () => {
      const actorTypes: Array<'user' | 'agent' | 'system'> = [
        'user',
        'agent',
        'system',
      ];

      for (const actorType of actorTypes) {
        const event: CreateAuditEvent = {
          business_case_id: testBusinessCaseId,
          event_type: 'system_update_logged',
          event_description: `Test ${actorType} event`,
          actor_type: actorType,
        };

        const result = await createAuditEvent(event);
        expect(result.actor_type).toBe(actorType);
        createdEventIds.push(result.id);
      }
    });
  });

  describe('Lifecycle Artifact Links', () => {
    it('should create a lifecycle link', async () => {
      const link: CreateLifecycleArtifactLink = {
        source_stage: 'opportunity',
        source_type: 'discovery',
        source_artifact_id: 'artifact-1',
        target_stage: 'target',
        target_type: 'system_map',
        target_artifact_id: 'artifact-2',
        relationship_type: 'derived_from',
      };

      const result = await createLifecycleLink(link);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.source_stage).toBe('opportunity');
      expect(result.target_stage).toBe('target');
      expect(result.relationship_type).toBe('derived_from');
    });

    it('should get artifact links', async () => {
      const artifactId = 'test-artifact-' + Date.now();

      // Create upstream link
      const upstreamLink: CreateLifecycleArtifactLink = {
        source_stage: 'opportunity',
        source_type: 'discovery',
        source_artifact_id: 'source-artifact',
        target_stage: 'target',
        target_type: 'system_map',
        target_artifact_id: artifactId,
      };

      await createLifecycleLink(upstreamLink);

      // Create downstream link
      const downstreamLink: CreateLifecycleArtifactLink = {
        source_stage: 'target',
        source_type: 'system_map',
        source_artifact_id: artifactId,
        target_stage: 'realization',
        target_type: 'feedback_loop',
        target_artifact_id: 'target-artifact',
      };

      await createLifecycleLink(downstreamLink);

      const links = await getArtifactLinks(artifactId, 'both');

      expect(links).toBeInstanceOf(Array);
      expect(links.length).toBeGreaterThanOrEqual(2);
    });

    it('should support different lifecycle stages', async () => {
      const stages: Array<'opportunity' | 'target' | 'realization' | 'expansion' | 'integrity'> = [
        'opportunity',
        'target',
        'realization',
        'expansion',
        'integrity',
      ];

      for (let i = 0; i < stages.length - 1; i++) {
        const link: CreateLifecycleArtifactLink = {
          source_stage: stages[i],
          source_type: 'artifact',
          source_artifact_id: `artifact-${i}`,
          target_stage: stages[i + 1],
          target_type: 'artifact',
          target_artifact_id: `artifact-${i + 1}`,
        };

        const result = await createLifecycleLink(link);
        expect(result.source_stage).toBe(stages[i]);
        expect(result.target_stage).toBe(stages[i + 1]);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid business case ID', async () => {
      await expect(
        getGovernanceControls('')
      ).rejects.toThrow();
    });

    it('should handle invalid control ID', async () => {
      await expect(
        updateControlCompliance('invalid-id', 'compliant')
      ).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const invalidControl: any = {
        // Missing required fields
        control_name: 'Test',
      };

      await expect(
        createGovernanceControl(invalidControl)
      ).rejects.toThrow();
    });

    it('should handle invalid event type', async () => {
      const invalidEvent: any = {
        business_case_id: testBusinessCaseId,
        event_type: 'invalid_type',
        event_description: 'Test',
      };

      await expect(
        createAuditEvent(invalidEvent)
      ).rejects.toThrow();
    });
  });
});
