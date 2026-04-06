import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  getSupabaseClient: vi.fn(),
  // Named export consumed by modules that import supabase directly
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('../../AssumptionService.js', () => ({
  assumptionService: { updateAssumption: vi.fn() },
}));

vi.mock('../../post-v1/AtomicActionExecutor.js', () => ({
  atomicActionExecutor: { executeAction: vi.fn() },
}));

vi.mock('../../post-v1/ManifestoEnforcer.js', () => ({
  manifestoEnforcer: { requestOverride: vi.fn(), decideOverride: vi.fn() },
}));

vi.mock('../../sdui/CanvasSchemaService.js', () => ({
  canvasSchemaService: { getCachedSchema: vi.fn() },
}));

vi.mock('../../WorkspaceStateService.js', () => ({
  workspaceStateService: { persistState: vi.fn() },
}));

vi.mock('../../ValueTreeService.js', () => {
  return {
    ValueTreeService: vi.fn().mockImplementation(() => ({
      updateValueTree: vi.fn(),
    })),
  };
});

vi.mock('./ActionRouterExport.js', () => ({
  handleExportAction: vi.fn(),
}));

vi.mock('../AgentScalingPolicy.js', () => ({
  assertInteractiveAgentAllowed: vi.fn(),
  InteractiveAgentPolicyError: class InteractiveAgentPolicyError extends Error {},
  isInteractiveAgentAllowed: vi.fn(() => true),
  isScaleToZeroAgent: vi.fn(() => false),
  isAsyncWarmAgent: vi.fn(() => false),
  getAgentScalingDescriptor: vi.fn(() => ({})),
}));

vi.mock('./AgentScalingPolicy.js', () => ({
  assertInteractiveAgentAllowed: vi.fn(),
}));

import { assumptionService } from '../../AssumptionService.js';
import { atomicActionExecutor } from '../../post-v1/AtomicActionExecutor.js';
import { manifestoEnforcer } from '../../post-v1/ManifestoEnforcer.js';
import { canvasSchemaService } from '../../sdui/CanvasSchemaService.js';
import { workspaceStateService } from '../../WorkspaceStateService.js';
import { ValueTreeService } from '../../ValueTreeService.js';
import {
  findComponentById,
  registerDefaultActionHandlers,
  validateAssumptionEvidence,
  validateValueTreeStructure,
} from '../ActionRouterHandlers.js';

describe('registerDefaultActionHandlers', () => {
  const handlers = new Map<string, (action: unknown, context: unknown) => Promise<unknown>>();
  const mockValueTreeService = new ValueTreeService({} as never);

  const deps = {
    auditLogService: { query: vi.fn() },
    executionRuntime: { executeWorkflow: vi.fn() },
    agentAPI: { invokeAgent: vi.fn() },
    componentMutationService: { mutateComponent: vi.fn() },
    getValueTreeService: vi.fn(() => mockValueTreeService),
    setValueTreeService: vi.fn(),
  };

  const context = {
    workspaceId: 'workspace-1',
    organizationId: 'org-1',
    userId: 'user-1',
    sessionId: 'session-1',
    timestamp: Date.now(),
    execution: { intent: 'FullValueAnalysis', environment: 'production' },
    metadata: {},
  };

  beforeEach(() => {
    handlers.clear();
    vi.clearAllMocks();

    deps.getValueTreeService.mockReturnValue(mockValueTreeService);

    registerDefaultActionHandlers((actionType, handler) => {
      handlers.set(
        actionType,
        typeof handler === 'function' ? handler : handler.execute.bind(handler),
      );
    }, deps as never);
  });

  it('registers expected handlers', () => {
    expect(handlers.has('invokeAgent')).toBe(true);
    expect(handlers.has('runWorkflowStep')).toBe(true);
    expect(handlers.has('updateValueTree')).toBe(true);
    expect(handlers.has('updateAssumption')).toBe(true);
    expect(handlers.has('exportArtifact')).toBe(true);
    expect(handlers.has('openAuditTrail')).toBe(true);
    expect(handlers.has('showExplanation')).toBe(true);
    expect(handlers.has('navigateToStage')).toBe(true);
    expect(handlers.has('saveWorkspace')).toBe(true);
    expect(handlers.has('mutateComponent')).toBe(true);
    expect(handlers.has('requestOverride')).toBe(true);
    expect(handlers.has('approveOverride')).toBe(true);
    expect(handlers.has('rejectOverride')).toBe(true);
  });

  describe('invokeAgent', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('invokeAgent');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('successfully invokes agent', async () => {
      const handler = handlers.get('invokeAgent');
      expect(handler).toBeDefined();

      deps.agentAPI.invokeAgent.mockResolvedValueOnce({ success: true, data: 'test-response' });

      const action = {
        type: 'invokeAgent',
        agentId: 'opportunity',
        input: 'test input',
        execution: { intent: 'test-intent' },
      };

      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { success: true, data: 'test-response' } });
      expect(deps.agentAPI.invokeAgent).toHaveBeenCalledWith({
        agent: 'opportunity',
        query: 'test input',
        context: expect.objectContaining({
          workspaceId: 'workspace-1',
        }),
      });
    });

    it('handles invokeAgent error', async () => {
      const handler = handlers.get('invokeAgent');
      expect(handler).toBeDefined();

      deps.agentAPI.invokeAgent.mockRejectedValueOnce(new Error('Agent error'));

      const action = { type: 'invokeAgent', agentId: 'opportunity' };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: false, error: 'Agent error' });
    });
  });

  describe('runWorkflowStep', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('runWorkflowStep');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('successfully executes workflow step', async () => {
      const handler = handlers.get('runWorkflowStep');
      expect(handler).toBeDefined();

      deps.executionRuntime.executeWorkflow.mockResolvedValueOnce({ stepResult: 'done' });

      const action = {
        type: 'runWorkflowStep',
        workflowId: 'wf-1',
        stepId: 'step-1',
      };

      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { stepResult: 'done' } });
      expect(deps.executionRuntime.executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ intent: 'run-workflow-step' }),
        'wf-1',
        expect.objectContaining({ stepId: 'step-1' }),
        'user-1',
      );
    });
  });

  describe('updateValueTree', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('updateValueTree');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('handles ValueTreeService unavailability', async () => {
      const handler = handlers.get('updateValueTree');
      expect(handler).toBeDefined();

      deps.getValueTreeService.mockReturnValueOnce(undefined as never);

      const { logger } = await import('../../../lib/logger.js');
      vi.mocked(logger.error).mockImplementationOnce(() => {});

      const { getSupabaseClient } = await import('../../../lib/supabase.js');
      vi.mocked(getSupabaseClient).mockImplementationOnce(() => {
        throw new Error('DB Error');
      });

      const result = await handler!({ type: 'updateValueTree' }, context);
      expect(result).toEqual({ success: false, error: 'ValueTreeService not available' });
    });

    it('returns error for invalid value tree structure', async () => {
      const handler = handlers.get('updateValueTree');
      expect(handler).toBeDefined();

      deps.getValueTreeService.mockReturnValueOnce(mockValueTreeService as never);

      const action = {
        type: 'updateValueTree',
        updates: { structure: { capabilities: [] } },
      };

      const result = await handler!(action, context);
      expect(result).toEqual({ success: false, error: 'Invalid value tree structure updates' });
    });

    it('successfully updates value tree', async () => {
      const handler = handlers.get('updateValueTree');
      expect(handler).toBeDefined();

      deps.getValueTreeService.mockReturnValueOnce(mockValueTreeService as never);
      vi.mocked(mockValueTreeService.updateValueTree).mockResolvedValueOnce({
        id: 'tree-1',
        version: 2,
      } as never);

      const action = {
        type: 'updateValueTree',
        treeId: 'tree-1',
        updates: { some: 'update' },
      };

      const result = await handler!(action, context);

      expect(result).toEqual({
        success: true,
        data: { treeId: 'tree-1', updated: true, version: 2 },
      });
      expect(mockValueTreeService.updateValueTree).toHaveBeenCalledWith(
        'tree-1',
        { some: 'update' },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });

  describe('updateAssumption', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('updateAssumption');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('returns error for invalid assumption evidence', async () => {
      const handler = handlers.get('updateAssumption');
      expect(handler).toBeDefined();

      const action = {
        type: 'updateAssumption',
        updates: { source: 'estimate' },
      };
      const result = await handler!(action, context);
      expect(result).toEqual({ success: false, error: 'Invalid assumption evidence updates' });
    });

    it('successfully updates assumption', async () => {
      const handler = handlers.get('updateAssumption');
      expect(handler).toBeDefined();

      vi.mocked(assumptionService.updateAssumption).mockResolvedValueOnce({ updated: true } as never);

      const action = {
        type: 'updateAssumption',
        assumptionId: 'assump-1',
        updates: { source: 'verified', value: 100 },
      };

      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { updated: true } });
      expect(assumptionService.updateAssumption).toHaveBeenCalledWith(
        'assump-1',
        { source: 'verified', value: 100 },
        expect.objectContaining({ userId: 'user-1' }),
      );
    });
  });

  describe('validateValueTreeStructure', () => {
    it('returns true for invalid or non-object inputs', () => {
      expect(validateValueTreeStructure(null)).toBe(true);
      expect(validateValueTreeStructure(undefined)).toBe(true);
      expect(validateValueTreeStructure('string')).toBe(true);
    });

    it('returns true if no structure object is provided', () => {
      expect(validateValueTreeStructure({ otherKey: 'value' })).toBe(true);
    });

    it('returns false if structure is missing required fields', () => {
      expect(validateValueTreeStructure({ structure: { capabilities: [] } })).toBe(false);
      expect(validateValueTreeStructure({ structure: { outcomes: [] } })).toBe(false);
      expect(validateValueTreeStructure({ structure: { kpis: [] } })).toBe(false);
    });

    it('returns true if structure has all required fields', () => {
      expect(
        validateValueTreeStructure({
          structure: { capabilities: [], outcomes: [], kpis: [] },
        }),
      ).toBe(true);
    });
  });

  describe('validateAssumptionEvidence', () => {
    it('returns true for invalid or non-object inputs', () => {
      expect(validateAssumptionEvidence(null)).toBe(true);
      expect(validateAssumptionEvidence(undefined)).toBe(true);
      expect(validateAssumptionEvidence('string')).toBe(true);
    });

    it('returns true if source is not string', () => {
      expect(validateAssumptionEvidence({ source: 123 })).toBe(true);
    });

    it('returns false if source is estimate', () => {
      expect(validateAssumptionEvidence({ source: 'estimate' })).toBe(false);
    });

    it('returns false if source is empty string', () => {
      expect(validateAssumptionEvidence({ source: '' })).toBe(false);
    });

    it('returns true if source is valid string', () => {
      expect(validateAssumptionEvidence({ source: 'verified' })).toBe(true);
    });
  });

  describe('findComponentById', () => {
    const mockSchema = {
      sections: [
        {
          component: 'Header',
          props: { id: 'header-1' },
        },
        {
          component: 'Content',
          props: {
            items: [
              { component: 'Nested', props: { id: 'nested-1' } },
              { id: 'direct-id-1' },
            ],
          },
        },
        {
          id: 'section-id',
          component: 'Footer',
        },
      ],
    } as never;

    it('finds component by props.id in top level section', () => {
      const result = findComponentById(mockSchema, 'header-1');
      expect(result).toEqual({ component: mockSchema.sections[0], path: 'sections[0]' });
    });

    it('finds component by implicit id in top level section', () => {
      const result = findComponentById(mockSchema, 'Content_1');
      expect(result).toEqual({ component: mockSchema.sections[1], path: 'sections[1]' });
    });

    it('finds component by section id in top level section', () => {
      const result = findComponentById(mockSchema, 'section-id');
      expect(result).toEqual({ component: mockSchema.sections[2], path: 'sections[2]' });
    });

    it('finds nested component by props.id', () => {
      const result = findComponentById(mockSchema, 'nested-1');
      expect(result).toEqual({
        component: { component: 'Nested', props: { id: 'nested-1' } },
        path: 'sections[1].items[0]',
      });
    });

    it('finds nested component by direct id when component metadata is present', () => {
      const mockSchemaWithDirectId = {
        sections: [
          {
            component: 'Wrapper',
            props: {
              component: 'TargetComponent',
              id: 'direct-id-1',
            },
          },
        ],
      } as never;

      const result = findComponentById(mockSchemaWithDirectId, 'direct-id-1');

      expect(result).toEqual({
        component: {
          component: 'Wrapper',
          props: {
            component: 'TargetComponent',
            id: 'direct-id-1',
          },
        },
        path: 'sections[0]',
      });
    });

    it('returns null if component not found', () => {
      const result = findComponentById(mockSchema, 'non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('openAuditTrail', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('openAuditTrail');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('successfully queries audit log', async () => {
      const handler = handlers.get('openAuditTrail');
      expect(handler).toBeDefined();

      const mockLogs = [{ id: 'log-1' }];
      deps.auditLogService.query.mockResolvedValueOnce(mockLogs as never);

      const action = {
        type: 'openAuditTrail',
        entityId: 'ent-1',
        entityType: 'workflow',
      };

      const result = await handler!(action, context);

      expect(result).toEqual({
        success: true,
        data: {
          entityId: 'ent-1',
          entityType: 'workflow',
          logs: mockLogs,
        },
      });
      expect(deps.auditLogService.query).toHaveBeenCalledWith({
        tenantId: 'org-1',
        resourceId: 'ent-1',
        resourceType: 'workflow',
        limit: 100,
      });
    });
  });

  describe('showExplanation', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('showExplanation');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('returns error if no schema available', async () => {
      const handler = handlers.get('showExplanation');
      expect(handler).toBeDefined();

      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValueOnce(null);

      const action = { type: 'showExplanation', componentId: 'comp-1', topic: 'topic-1' };
      const result = await handler!(action, context);

      expect(result).toEqual({
        success: false,
        error: 'No schema available for workspace to explain component',
      });
    });

    it('returns error if component not found', async () => {
      const handler = handlers.get('showExplanation');
      expect(handler).toBeDefined();

      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValueOnce({ sections: [] } as never);

      const action = { type: 'showExplanation', componentId: 'comp-1', topic: 'topic-1' };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: false, error: 'Component not found with ID: comp-1' });
    });

    it('successfully invokes narrative agent for explanation', async () => {
      const handler = handlers.get('showExplanation');
      expect(handler).toBeDefined();

      const mockSchema = {
        sections: [
          { props: { id: 'comp-1', title: 'test-title' }, component: 'TestComponent' },
        ],
      };

      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValueOnce(mockSchema as never);
      deps.agentAPI.invokeAgent.mockResolvedValueOnce({ success: true, data: 'test explanation' });

      const action = { type: 'showExplanation', componentId: 'comp-1', topic: 'test-topic' };
      const result = await handler!(action, context);

      expect(result).toEqual({
        success: true,
        data: {
          componentId: 'comp-1',
          topic: 'test-topic',
          explanation: 'test explanation',
        },
      });
      expect(deps.agentAPI.invokeAgent).toHaveBeenCalledWith({
        agent: 'narrative',
        query: expect.stringContaining(
          'Explain the "test-topic" for the component "TestComponent"',
        ),
        context: expect.objectContaining({
          workspaceId: 'workspace-1',
          componentName: 'TestComponent',
          topic: 'test-topic',
        }),
      });
    });
  });

  describe('navigateToStage', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('navigateToStage');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('successfully navigates to stage', async () => {
      const handler = handlers.get('navigateToStage');
      expect(handler).toBeDefined();

      const action = { type: 'navigateToStage', stage: 'stage-2' };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { stage: 'stage-2' } });
    });
  });

  describe('saveWorkspace', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('saveWorkspace');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('successfully saves workspace', async () => {
      const handler = handlers.get('saveWorkspace');
      expect(handler).toBeDefined();

      const action = { type: 'saveWorkspace', workspaceId: 'ws-1' };

      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { workspaceId: 'ws-1', saved: true } });
      expect(workspaceStateService.persistState).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('mutateComponent', () => {
    it('returns error for invalid action type', async () => {
      const handler = handlers.get('mutateComponent');
      expect(handler).toBeDefined();

      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });

    it('returns error if no schema available', async () => {
      const handler = handlers.get('mutateComponent');
      expect(handler).toBeDefined();

      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValueOnce(null);

      const action = { type: 'mutateComponent', action: {} };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: false, error: 'No schema available for workspace' });
    });

    it('successfully executes atomic action', async () => {
      const handler = handlers.get('mutateComponent');
      expect(handler).toBeDefined();

      const mockSchema = { sections: [] };
      vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValueOnce(mockSchema as never);

      const mockExecutionResult = {
        success: true,
        executionId: 'exec-1',
        actionResult: { affected_components: ['comp-1'] },
      };
      vi.mocked(atomicActionExecutor.executeAction).mockResolvedValueOnce(mockExecutionResult as never);

      const action = { type: 'mutateComponent', action: { type: 'some-atomic-action' } };
      const result = await handler!(action, context);

      expect(result).toEqual({
        success: true,
        data: {
          executionId: 'exec-1',
          ...mockExecutionResult.actionResult,
        },
      });
      expect(atomicActionExecutor.executeAction).toHaveBeenCalledWith(
        { type: 'some-atomic-action' },
        mockSchema,
        'workspace-1',
      );
    });
  });

  describe('override handlers', () => {
    it('successfully requests override', async () => {
      const handler = handlers.get('requestOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.requestOverride).mockResolvedValueOnce('req-1');

      const action = {
        type: 'requestOverride',
        actionId: 'act-1',
        violations: [],
        justification: 'reason',
      };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { requestId: 'req-1' } });
      expect(manifestoEnforcer.requestOverride).toHaveBeenCalledWith(
        'act-1',
        'user-1',
        [],
        'reason',
      );
    });

    it('successfully approves override', async () => {
      const handler = handlers.get('approveOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.decideOverride).mockResolvedValueOnce(undefined as never);

      const action = { type: 'approveOverride', requestId: 'req-1', reason: 'ok' };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { requestId: 'req-1', approved: true } });
      expect(manifestoEnforcer.decideOverride).toHaveBeenCalledWith(
        'req-1',
        true,
        'user-1',
        'ok',
      );
    });

    it('successfully rejects override', async () => {
      const handler = handlers.get('rejectOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.decideOverride).mockResolvedValueOnce(undefined as never);

      const action = { type: 'rejectOverride', requestId: 'req-1', reason: 'no' };
      const result = await handler!(action, context);

      expect(result).toEqual({ success: true, data: { requestId: 'req-1', approved: false } });
      expect(manifestoEnforcer.decideOverride).toHaveBeenCalledWith(
        'req-1',
        false,
        'user-1',
        'no',
      );
    });
  });
});