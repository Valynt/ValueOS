/**
 * Unit tests for ActionRouter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActionRouter } from '../ActionRouter';
import { CanonicalAction, ActionContext } from '../../types/sdui-integration';
import { AuditLogService } from '../AuditLogService';
import { AgentOrchestrator } from '../AgentOrchestrator';
import { WorkflowOrchestrator } from '../WorkflowOrchestrator';
import { ComponentMutationService } from '../ComponentMutationService';

// Mock dependencies
vi.mock('../AuditLogService');
vi.mock('../AgentOrchestrator');
vi.mock('../WorkflowOrchestrator');
vi.mock('../ComponentMutationService');
vi.mock('../../lib/logger');

describe('ActionRouter', () => {
  let router: ActionRouter;
  let mockAuditLogService: AuditLogService;
  let mockAgentOrchestrator: AgentOrchestrator;
  let mockWorkflowOrchestrator: WorkflowOrchestrator;
  let mockComponentMutationService: ComponentMutationService;

  const context: ActionContext = {
    workspaceId: 'workspace-1',
    userId: 'user-1',
    sessionId: 'session-1',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    mockAuditLogService = new AuditLogService();
    mockAgentOrchestrator = new AgentOrchestrator();
    mockWorkflowOrchestrator = new WorkflowOrchestrator();
    mockComponentMutationService = new ComponentMutationService();

    router = new ActionRouter(
      mockAuditLogService,
      mockAgentOrchestrator,
      mockWorkflowOrchestrator,
      mockComponentMutationService
    );
  });

  describe('validateAction', () => {
    it('should validate invokeAgent action', () => {
      const action: CanonicalAction = {
        type: 'invokeAgent',
        agentId: 'agent-1',
        input: { query: 'test' },
        context: {},
      };

      const result = router.validateAction(action);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for invokeAgent without agentId', () => {
      const action: any = {
        type: 'invokeAgent',
        input: { query: 'test' },
        context: {},
      };

      const result = router.validateAction(action);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('agentId is required');
    });

    it('should validate navigateToStage action', () => {
      const action: CanonicalAction = {
        type: 'navigateToStage',
        stage: 'target',
      };

      const result = router.validateAction(action);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for navigateToStage without stage', () => {
      const action: any = {
        type: 'navigateToStage',
      };

      const result = router.validateAction(action);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('stage is required');
    });

    it('should validate saveWorkspace action', () => {
      const action: CanonicalAction = {
        type: 'saveWorkspace',
        workspaceId: 'workspace-1',
      };

      const result = router.validateAction(action);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('checkManifestoRules', () => {
    it('should allow actions that pass Manifesto rules', async () => {
      const action: CanonicalAction = {
        type: 'navigateToStage',
        stage: 'target',
      };

      const result = await router.checkManifestoRules(action, context);

      expect(result.allowed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect violations for updateValueTree without proper structure', async () => {
      const action: CanonicalAction = {
        type: 'updateValueTree',
        treeId: 'tree-1',
        updates: {
          structure: {
            // Missing required fields
          },
        },
      };

      const result = await router.checkManifestoRules(action, context);

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('RULE_003');
    });

    it('should detect violations for updateAssumption without evidence', async () => {
      const action: CanonicalAction = {
        type: 'updateAssumption',
        assumptionId: 'assumption-1',
        updates: {
          source: 'estimate',
        },
      };

      const result = await router.checkManifestoRules(action, context);

      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].rule).toBe('RULE_004');
    });

    it('should provide warnings for exportArtifact', async () => {
      const action: CanonicalAction = {
        type: 'exportArtifact',
        artifactType: 'report',
        format: 'pdf',
      };

      const result = await router.checkManifestoRules(action, context);

      expect(result.allowed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('routeAction', () => {
    it('should route invokeAgent action successfully', async () => {
      const action: CanonicalAction = {
        type: 'invokeAgent',
        agentId: 'agent-1',
        input: { query: 'test' },
        context: {},
      };

      vi.spyOn(mockAgentOrchestrator, 'invokeAgent').mockResolvedValue({
        success: true,
        data: { result: 'test result' },
      });

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should route navigateToStage action successfully', async () => {
      const action: CanonicalAction = {
        type: 'navigateToStage',
        stage: 'target',
      };

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ stage: 'target' });
    });

    it('should route saveWorkspace action successfully', async () => {
      const action: CanonicalAction = {
        type: 'saveWorkspace',
        workspaceId: 'workspace-1',
      };

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ workspaceId: 'workspace-1', saved: true });
    });

    it('should fail routing for invalid action', async () => {
      const action: any = {
        type: 'invokeAgent',
        // Missing required fields
      };

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should fail routing for action violating Manifesto rules', async () => {
      const action: CanonicalAction = {
        type: 'updateValueTree',
        treeId: 'tree-1',
        updates: {
          structure: {
            // Missing required fields
          },
        },
      };

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Manifesto rules violated');
    });

    it('should handle errors gracefully', async () => {
      const action: CanonicalAction = {
        type: 'invokeAgent',
        agentId: 'agent-1',
        input: { query: 'test' },
        context: {},
      };

      vi.spyOn(mockAgentOrchestrator, 'invokeAgent').mockRejectedValue(
        new Error('Test error')
      );

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('registerHandler', () => {
    it('should register custom handler', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        success: true,
        data: { custom: true },
      });

      router.registerHandler('customAction', customHandler);

      const action: any = {
        type: 'customAction',
      };

      // Manually call handler since routeAction validates action type
      const handler = (router as any).handlers.get('customAction');
      const result = await handler(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ custom: true });
    });
  });
});
