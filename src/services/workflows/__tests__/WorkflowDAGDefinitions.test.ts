/**
 * Tests for Workflow DAG Definitions
 */

import { describe, it, expect } from 'vitest';
import {
  OPPORTUNITY_WORKFLOW,
  TARGET_WORKFLOW,
  REALIZATION_WORKFLOW,
  EXPANSION_WORKFLOW,
  INTEGRITY_WORKFLOW,
  COMPLETE_LIFECYCLE_WORKFLOW,
  PARALLEL_LIFECYCLE_WORKFLOW,
  ALL_WORKFLOW_DEFINITIONS,
  getWorkflowById,
  getWorkflowByName,
  getWorkflowsByStage,
  getStageById,
  validateWorkflowDAG,
} from '../WorkflowDAGDefinitions';

describe('Workflow DAG Definitions', () => {
  describe('Individual Workflows', () => {
    it('should have valid opportunity workflow', () => {
      expect(OPPORTUNITY_WORKFLOW).toBeDefined();
      expect(OPPORTUNITY_WORKFLOW.id).toBe('opportunity-discovery-v1');
      expect(OPPORTUNITY_WORKFLOW.stages.length).toBeGreaterThan(0);
      expect(OPPORTUNITY_WORKFLOW.transitions.length).toBeGreaterThan(0);
    });

    it('should have valid target workflow', () => {
      expect(TARGET_WORKFLOW).toBeDefined();
      expect(TARGET_WORKFLOW.id).toBe('target-value-commit-v1');
      expect(TARGET_WORKFLOW.stages.length).toBeGreaterThan(0);
    });

    it('should have valid realization workflow', () => {
      expect(REALIZATION_WORKFLOW).toBeDefined();
      expect(REALIZATION_WORKFLOW.id).toBe('realization-tracking-v1');
      expect(REALIZATION_WORKFLOW.stages.length).toBeGreaterThan(0);
    });

    it('should have valid expansion workflow', () => {
      expect(EXPANSION_WORKFLOW).toBeDefined();
      expect(EXPANSION_WORKFLOW.id).toBe('expansion-modeling-v1');
      expect(EXPANSION_WORKFLOW.stages.length).toBeGreaterThan(0);
    });

    it('should have valid integrity workflow', () => {
      expect(INTEGRITY_WORKFLOW).toBeDefined();
      expect(INTEGRITY_WORKFLOW.id).toBe('integrity-controls-v1');
      expect(INTEGRITY_WORKFLOW.stages.length).toBeGreaterThan(0);
    });

    it('should have valid complete lifecycle workflow', () => {
      expect(COMPLETE_LIFECYCLE_WORKFLOW).toBeDefined();
      expect(COMPLETE_LIFECYCLE_WORKFLOW.id).toBe('complete-value-lifecycle-v1');
      expect(COMPLETE_LIFECYCLE_WORKFLOW.stages.length).toBe(5);
    });

    it('should have valid parallel lifecycle workflow', () => {
      expect(PARALLEL_LIFECYCLE_WORKFLOW).toBeDefined();
      expect(PARALLEL_LIFECYCLE_WORKFLOW.id).toBe('parallel-value-lifecycle-v1');
      expect(PARALLEL_LIFECYCLE_WORKFLOW.stages.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow Registry', () => {
    it('should contain all workflow definitions', () => {
      expect(ALL_WORKFLOW_DEFINITIONS.length).toBe(7);
    });

    it('should get workflow by ID', () => {
      const workflow = getWorkflowById('opportunity-discovery-v1');
      expect(workflow).toBeDefined();
      expect(workflow?.id).toBe('opportunity-discovery-v1');
    });

    it('should return undefined for non-existent workflow ID', () => {
      const workflow = getWorkflowById('non-existent');
      expect(workflow).toBeUndefined();
    });

    it('should get workflow by name', () => {
      const workflow = getWorkflowByName('Opportunity Discovery Workflow');
      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('Opportunity Discovery Workflow');
    });

    it('should get workflows by stage', () => {
      const workflows = getWorkflowsByStage('opportunity');
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows.some(w => w.stages.some(s => s.agent_type === 'opportunity'))).toBe(true);
    });

    it('should get stage by ID', () => {
      const stage = getStageById('opportunity-discovery-v1', 'opportunity_research');
      expect(stage).toBeDefined();
      expect(stage?.id).toBe('opportunity_research');
    });
  });

  describe('Workflow Validation', () => {
    it('should validate opportunity workflow', () => {
      const result = validateWorkflowDAG(OPPORTUNITY_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate target workflow', () => {
      const result = validateWorkflowDAG(TARGET_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate realization workflow', () => {
      const result = validateWorkflowDAG(REALIZATION_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate expansion workflow', () => {
      const result = validateWorkflowDAG(EXPANSION_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate integrity workflow', () => {
      const result = validateWorkflowDAG(INTEGRITY_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate complete lifecycle workflow', () => {
      const result = validateWorkflowDAG(COMPLETE_LIFECYCLE_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate parallel lifecycle workflow', () => {
      const result = validateWorkflowDAG(PARALLEL_LIFECYCLE_WORKFLOW);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should detect invalid initial stage', () => {
      const invalidWorkflow = {
        ...OPPORTUNITY_WORKFLOW,
        initial_stage: 'non_existent_stage',
      };

      const result = validateWorkflowDAG(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Initial stage');
    });

    it('should detect invalid final stage', () => {
      const invalidWorkflow = {
        ...OPPORTUNITY_WORKFLOW,
        final_stages: ['non_existent_stage'],
      };

      const result = validateWorkflowDAG(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Final stage');
    });

    it('should detect invalid transition', () => {
      const invalidWorkflow = {
        ...OPPORTUNITY_WORKFLOW,
        transitions: [
          { from_stage: 'non_existent', to_stage: 'also_non_existent' },
        ],
      };

      const result = validateWorkflowDAG(invalidWorkflow);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Stage Properties', () => {
    it('should have retry config for all stages', () => {
      ALL_WORKFLOW_DEFINITIONS.forEach(workflow => {
        workflow.stages.forEach(stage => {
          expect(stage.retry_config).toBeDefined();
          expect(stage.retry_config.max_attempts).toBeGreaterThan(0);
          expect(stage.retry_config.initial_delay_ms).toBeGreaterThan(0);
        });
      });
    });

    it('should have timeout for all stages', () => {
      ALL_WORKFLOW_DEFINITIONS.forEach(workflow => {
        workflow.stages.forEach(stage => {
          expect(stage.timeout_seconds).toBeGreaterThan(0);
          expect(stage.timeout_seconds).toBeLessThanOrEqual(300); // Max 5 minutes
        });
      });
    });

    it('should have compensation handlers for critical stages', () => {
      const criticalStages = COMPLETE_LIFECYCLE_WORKFLOW.stages;
      criticalStages.forEach(stage => {
        expect(stage.compensation_handler).toBeDefined();
        expect(stage.compensation_handler).toContain('compensate');
      });
    });
  });

  describe('Workflow Structure', () => {
    it('should have linear flow in complete lifecycle', () => {
      const workflow = COMPLETE_LIFECYCLE_WORKFLOW;
      expect(workflow.transitions.length).toBe(workflow.stages.length - 1);
    });

    it('should have fork/join in parallel lifecycle', () => {
      const workflow = PARALLEL_LIFECYCLE_WORKFLOW;
      
      // Count transitions from initial stage
      const fromInitial = workflow.transitions.filter(
        t => t.from_stage === workflow.initial_stage
      );
      
      // Should have multiple transitions (fork)
      expect(fromInitial.length).toBeGreaterThan(1);
    });

    it('should have all stages reachable', () => {
      ALL_WORKFLOW_DEFINITIONS.forEach(workflow => {
        const result = validateWorkflowDAG(workflow);
        const unreachableWarnings = result.warnings.filter(w => w.includes('unreachable'));
        expect(unreachableWarnings.length).toBe(0);
      });
    });
  });
});
