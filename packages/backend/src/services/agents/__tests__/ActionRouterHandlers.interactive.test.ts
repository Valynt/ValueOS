import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../lib/supabase.js', () => ({
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
  manifestoEnforcer: { requestOverride: vi.fn() },
}));

vi.mock('../../sdui/CanvasSchemaService.js', () => ({
  canvasSchemaService: { getCachedSchema: vi.fn() },
}));

vi.mock('../../WorkspaceStateService.js', () => ({
  workspaceStateService: { persistState: vi.fn() },
}));

import { canvasSchemaService } from '../../sdui/CanvasSchemaService.js';
import { registerDefaultActionHandlers } from '../ActionRouterHandlers.js';

describe('registerDefaultActionHandlers interactive agent guard', () => {
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

  it('blocks async-only agents from generic interactive invokeAgent actions', async () => {
    const handler = handlers.get('invokeAgent');
    expect(handler).toBeDefined();

    const result = await handler!({
      type: 'invokeAgent',
      agentId: 'narrative',
      input: 'draft the story',
    }, context);

    expect(result).toMatchObject({ success: false, error: expect.stringContaining('async-only') });
    expect(deps.agentAPI.invokeAgent).not.toHaveBeenCalled();
  });

  it('blocks showExplanation from invoking the narrative agent inline', async () => {
    vi.mocked(canvasSchemaService.getCachedSchema).mockResolvedValue({
      sections: [{ component: 'InsightCard', props: { id: 'cmp-1', title: 'ROI' } }],
    } as never);

    const handler = handlers.get('showExplanation');
    expect(handler).toBeDefined();

    const result = await handler!({
      type: 'showExplanation',
      componentId: 'cmp-1',
      topic: 'ROI summary',
    }, context);

    expect(result).toMatchObject({ success: false, error: expect.stringContaining('async-only') });
    expect(deps.agentAPI.invokeAgent).not.toHaveBeenCalled();
  });
});
