import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  getSupabaseClient: vi.fn(),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
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

import { assumptionService } from '../../AssumptionService.js';
import { atomicActionExecutor } from '../../post-v1/AtomicActionExecutor.js';
import { manifestoEnforcer } from '../../post-v1/ManifestoEnforcer.js';
import { workspaceStateService } from '../../WorkspaceStateService.js';
import { registerDefaultActionHandlers } from '../ActionRouterHandlers.js';

describe('registerDefaultActionHandlers', () => {
  const handlers = new Map<string, (action: unknown, context: unknown) => Promise<unknown>>();
  const deps = {
    auditLogService: { query: vi.fn() },
    executionRuntime: { executeWorkflow: vi.fn() },
    agentAPI: { invokeAgent: vi.fn() },
    componentMutationService: { mutateComponent: vi.fn() },
    getValueTreeService: vi.fn(),
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

  describe('runWorkflowStep handler', () => {
    it('executes workflow using runtime dependency', async () => {
      const handler = handlers.get('runWorkflowStep');
      expect(handler).toBeDefined();

      vi.mocked(deps.executionRuntime.executeWorkflow).mockResolvedValueOnce({
        workflowId: 'wf-1',
        status: 'completed',
        data: { test: 'result' },
      } as never);

      const result = await handler!({
        type: 'runWorkflowStep',
        workflowId: 'wf-1',
        stepId: 'step-1'
      }, context);

      expect(deps.executionRuntime.executeWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ intent: 'run-workflow-step' }),
        'wf-1',
        expect.objectContaining({ stepId: 'step-1', workspaceId: 'workspace-1' }),
        'user-1'
      );
      expect(result).toEqual({
        success: true,
        data: { workflowId: 'wf-1', status: 'completed', data: { test: 'result' } }
      });
    });

    it('returns error if action type is invalid', async () => {
      const handler = handlers.get('runWorkflowStep');
      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });
  });

  describe('updateAssumption handler', () => {
    it('updates assumption via assumptionService', async () => {
      const handler = handlers.get('updateAssumption');
      expect(handler).toBeDefined();

      vi.mocked(assumptionService.updateAssumption).mockResolvedValueOnce({ id: 'assump-1', value: 42 } as never);

      const result = await handler!({
        type: 'updateAssumption',
        assumptionId: 'assump-1',
        updates: { value: 42 }
      }, context);

      expect(assumptionService.updateAssumption).toHaveBeenCalledWith(
        'assump-1',
        { value: 42 },
        expect.objectContaining({ userId: 'user-1', valueCaseId: 'workspace-1' })
      );
      expect(result).toEqual({ success: true, data: { id: 'assump-1', value: 42 } });
    });

    it('returns error if action type is invalid', async () => {
      const handler = handlers.get('updateAssumption');
      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });
  });

  describe('openAuditTrail handler', () => {
    it('queries audit logs via auditLogService', async () => {
      const handler = handlers.get('openAuditTrail');
      expect(handler).toBeDefined();

      const mockLogs = [{ id: 'log-1' }];
      vi.mocked(deps.auditLogService.query).mockResolvedValueOnce(mockLogs as never);

      const result = await handler!({
        type: 'openAuditTrail',
        entityId: 'ent-1',
        entityType: 'type-1'
      }, context);

      expect(deps.auditLogService.query).toHaveBeenCalledWith({
        tenantId: 'org-1',
        resourceId: 'ent-1',
        resourceType: 'type-1',
        limit: 100,
      });
      expect(result).toEqual({
        success: true,
        data: { entityId: 'ent-1', entityType: 'type-1', logs: mockLogs }
      });
    });
  });

  describe('navigateToStage handler', () => {
    it('returns success with the provided stage', async () => {
      const handler = handlers.get('navigateToStage');
      expect(handler).toBeDefined();

      const result = await handler!({
        type: 'navigateToStage',
        stage: 'stage-2'
      }, context);

      expect(result).toEqual({ success: true, data: { stage: 'stage-2' } });
    });

    it('returns error if action type is invalid', async () => {
      const handler = handlers.get('navigateToStage');
      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });
  });

  describe('saveWorkspace handler', () => {
    it('persists workspace state and returns success', async () => {
      const handler = handlers.get('saveWorkspace');
      expect(handler).toBeDefined();

      vi.mocked(workspaceStateService.persistState).mockResolvedValueOnce(undefined as never);

      const result = await handler!({
        type: 'saveWorkspace',
        workspaceId: 'ws-123'
      }, context);

      expect(workspaceStateService.persistState).toHaveBeenCalledWith('ws-123');
      expect(result).toEqual({ success: true, data: { workspaceId: 'ws-123', saved: true } });
    });

    it('returns error if action type is invalid', async () => {
      const handler = handlers.get('saveWorkspace');
      const result = await handler!({ type: 'invalidType' }, context);
      expect(result).toEqual({ success: false, error: 'Invalid action type' });
    });
  });

  describe('requestOverride handler', () => {
    it('requests override via manifestoEnforcer', async () => {
      const handler = handlers.get('requestOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.requestOverride).mockResolvedValueOnce('req-123');

      const result = await handler!({
        type: 'requestOverride',
        actionId: 'act-1',
        violations: [],
        justification: 'because'
      }, context);

      expect(manifestoEnforcer.requestOverride).toHaveBeenCalledWith(
        'act-1',
        'user-1',
        [],
        'because'
      );
      expect(result).toEqual({ success: true, data: { requestId: 'req-123' } });
    });
  });

  describe('approveOverride handler', () => {
    it('approves override via manifestoEnforcer', async () => {
      const handler = handlers.get('approveOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.decideOverride).mockResolvedValueOnce(undefined as never);

      const result = await handler!({
        type: 'approveOverride',
        requestId: 'req-123',
        reason: 'approved'
      }, context);

      expect(manifestoEnforcer.decideOverride).toHaveBeenCalledWith(
        'req-123',
        true,
        'user-1',
        'approved'
      );
      expect(result).toEqual({ success: true, data: { requestId: 'req-123', approved: true } });
    });
  });

  describe('rejectOverride handler', () => {
    it('rejects override via manifestoEnforcer', async () => {
      const handler = handlers.get('rejectOverride');
      expect(handler).toBeDefined();

      vi.mocked(manifestoEnforcer.decideOverride).mockResolvedValueOnce(undefined as never);

      const result = await handler!({
        type: 'rejectOverride',
        requestId: 'req-123',
        reason: 'denied'
      }, context);

      expect(manifestoEnforcer.decideOverride).toHaveBeenCalledWith(
        'req-123',
        false,
        'user-1',
        'denied'
      );
      expect(result).toEqual({ success: true, data: { requestId: 'req-123', approved: false } });
    });
  });
});
