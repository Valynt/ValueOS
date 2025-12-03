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
vi.mock('../ManifestoEnforcer', () => ({
  manifestoEnforcer: {
    checkAction: vi.fn().mockResolvedValue({
      allowed: true,
      violations: [],
      warnings: [],
    }),
  },
}));

describe('ActionRouter', () => {
  let router: ActionRouter;
  let mockAuditLogService: any;
  let mockAgentOrchestrator: any;
  let mockWorkflowOrchestrator: any;
  let mockComponentMutationService: any;

  const context: ActionContext = {
    workspaceId: 'workspace-1',
    userId: 'user-1',
    sessionId: 'session-1',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    // Create proper mocks with required methods
    mockAuditLogService = {
      logAction: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockAgentOrchestrator = {
      invokeAgent: vi.fn().mockResolvedValue({ result: 'success' }),
    } as any;

    mockWorkflowOrchestrator = {
      executeWorkflow: vi.fn().mockResolvedValue({ status: 'completed' }),
    } as any;

    mockComponentMutationService = {
      mutateComponent: vi.fn().mockResolvedValue({ success: true }),
    } as any;

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
      const { manifestoEnforcer } = await import('../ManifestoEnforcer');
      vi.mocked(manifestoEnforcer.checkAction).mockResolvedValueOnce({
        allowed: false,
        violations: [{
          rule: 'RULE_003',
          severity: 'error',
          message: 'Value tree must include outcomes',
        }],
        warnings: [],
      });

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
      expect(result.violations[0]?.rule).toBe('RULE_003');
    });

    it('should detect violations for updateAssumption without evidence', async () => {
      const { manifestoEnforcer } = await import('../ManifestoEnforcer');
      vi.mocked(manifestoEnforcer.checkAction).mockResolvedValueOnce({
        allowed: false,
        violations: [{
          rule: 'RULE_004',
          severity: 'error',
          message: 'Assumptions require evidence',
        }],
        warnings: [],
      });

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
      expect(result.violations[0]?.rule).toBe('RULE_004');
    });

    it('should provide warnings for exportArtifact', async () => {
      const { manifestoEnforcer } = await import('../ManifestoEnforcer');
      vi.mocked(manifestoEnforcer.checkAction).mockResolvedValueOnce({
        allowed: true,
        violations: [],
        warnings: [{
          rule: 'EXPORT_001',
          message: 'Export may contain estimates',
        }],
      });

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

      // Mock is already configured in beforeEach
      (mockAgentOrchestrator.invokeAgent as any).mockResolvedValue({ result: 'test result' });

      const result = await router.routeAction(action, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(mockAgentOrchestrator.invokeAgent).toHaveBeenCalledWith(
        'agent-1',
        { query: 'test' },
        expect.objectContaining({ workspaceId: 'workspace-1' })
      );
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
      const { manifestoEnforcer } = await import('../ManifestoEnforcer');
      vi.mocked(manifestoEnforcer.checkAction).mockResolvedValueOnce({
        allowed: false,
        violations: [{
          rule: 'RULE_003',
          severity: 'error',
          message: 'Value tree structure incomplete',
        }],
        warnings: [],
      });

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

      // Configure mock to reject
      (mockAgentOrchestrator.invokeAgent as any).mockRejectedValue(
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
