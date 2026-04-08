import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowExecutor } from '../WorkflowExecutor.js';

vi.mock('uuid', () => ({ v4: (() => { let n = 0; return () => `uuid-${++n}`; })() }));
vi.mock('../../../observability/valueLoopMetrics', () => ({
  recordAgentInvocation: vi.fn(),
  recordLoopCompletion: vi.fn(),
  recordWorkflowExecutionActive: vi.fn(),
  recordStageTransition: vi.fn(),
  recordHypothesisConfidence: vi.fn(),
  recordFinancialCalculation: vi.fn(),
  recordUsageEvent: vi.fn(),
  recordWorkflowDeadlineViolation: vi.fn(),
}));
vi.mock('../../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@opentelemetry/api', () => {
  const activeContext = {};
  const activeSpan = undefined;
  const trace = {
    getTracer: vi.fn(() => ({
      startSpan: vi.fn(() => ({
        setAttributes: vi.fn(),
        setStatus: vi.fn(),
        recordException: vi.fn(),
        end: vi.fn(),
      })),
    })),
    getSpan: vi.fn(() => activeSpan),
    getActiveSpan: vi.fn(() => activeSpan),
    setSpan: vi.fn((_ctx: unknown, span: unknown) => ({ ...activeContext, span })),
  };
  const context = {
    active: vi.fn(() => activeContext),
    with: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  };

  return {
    Span: vi.fn(),
    SpanStatusCode: { OK: 1, ERROR: 2 },
    context,
    trace,
  };
});
vi.mock('../../../config/telemetry', () => ({
  getTracer: vi.fn(function () {
    return {
      startActiveSpan: vi.fn(function (...args: unknown[]) {
        const fn = typeof args[args.length - 1] === 'function' ? args[args.length - 1] as (s: unknown) => unknown : null;
        const span = { setAttributes: vi.fn(), setStatus: vi.fn(), recordException: vi.fn(), end: vi.fn() };
        return fn ? fn(span) : undefined;
      }),
    };
  }),
}));
vi.mock('../../../services/CircuitBreaker', () => ({
  CircuitBreakerManager: vi.fn(function () {
    return { execute: vi.fn(function (_k: string, fn: () => unknown) { return fn(); }) };
  }),
}));
vi.mock('../../../services/agents/AgentRegistry', () => ({
  AgentRegistry: vi.fn(function () {
    return { recordRelease: vi.fn(), markHealthy: vi.fn(), recordFailure: vi.fn() };
  }),
}));
vi.mock('../../../services/agents/AgentMessageBroker', () => ({
  AgentMessageBroker: vi.fn(function () {
    return { sendToAgent: vi.fn().mockResolvedValue({ success: true, data: { result: 'ok' } }) };
  }),
}));
vi.mock('../../../services/agents/resilience/AgentRetryManager', () => ({
  AgentRetryManager: {
    getInstance: vi.fn(function () {
      return {
        executeWithRetry: vi.fn().mockResolvedValue({ success: true, response: { data: { out: 'done' } }, attempts: 1 }),
      };
    }),
  },
}));
vi.mock('../../../services/post-v1/EnhancedParallelExecutor', () => ({
  getEnhancedParallelExecutor: vi.fn(function () {
    return {
      executeRunnableTasks: vi.fn(async function (
        tasks: Array<{ id: string; payload: unknown }>,
        fn: (t: { id: string; payload: unknown }) => Promise<unknown>,
      ) {
        const results = [];
        for (const task of tasks) {
          try { results.push({ taskId: task.id, success: true, result: await fn(task) }); }
          catch (e) { results.push({ taskId: task.id, success: false, error: (e as Error).message }); }
        }
        return results;
      }),
    };
  }),
}));
vi.mock('../../../lib/agent-fabric/MemorySystem', () => ({
  MemorySystem: vi.fn(function () {
    return {
      retrieve: vi.fn().mockResolvedValue([]),
      storeEpisode: vi.fn().mockResolvedValue(undefined),
      storeEpisodicMemory: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));
vi.mock('../../../repositories/ValueTreeRepository.js', () => ({
  valueTreeRepository: {
    getNodesForCase: vi.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePolicyMock() {
  return {
    assertTenantExecutionAllowed: vi.fn().mockResolvedValue(undefined),
    evaluateIntegrityVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    evaluateStructuralTruthVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    checkHITL: vi.fn().mockReturnValue({ allowed: true, hitl_required: false, details: { rule_id: 'HITL-01', is_external_artifact_action: false } }),
  };
}

function makeExecutionPersistenceMock() {
  return {
    getActiveWorkflowDefinition: vi.fn().mockResolvedValue({
      id: 'wf-1',
      name: 'WF',
      version: '1',
      organization_id: null,
      dag_schema: {
        initial_stage: 'stage-1',
        final_stages: ['stage-1'],
        stages: [{ id: 'stage-1', agent_type: 'coordinator' }],
        transitions: [],
      },
    }),
    createWorkflowExecution: vi.fn().mockResolvedValue({ id: 'exec-1' }),
    updateWorkflowExecutionContext: vi.fn().mockResolvedValue(undefined),
    persistExecutionRecord: vi.fn().mockResolvedValue(undefined),
    updateExecutionStatus: vi.fn().mockResolvedValue(undefined),
    recordStageRun: vi.fn().mockResolvedValue(undefined),
    recordWorkflowEvent: vi.fn().mockResolvedValue(undefined),
    markWorkflowFailed: vi.fn().mockResolvedValue(undefined),
  };
}

async function makeExecutor(
  policy = makePolicyMock(),
  cfg: Partial<{ enableWorkflows: boolean; maxRetryAttempts: number; maxAgentInvocationsPerMinute: number }> = {},
  rateLimitFn: (t: string) => boolean = () => true,
  executionPersistence = makeExecutionPersistenceMock(),
) {
  const { CircuitBreakerManager } = await import('../../../services/CircuitBreaker.js');
  const { AgentRegistry } = await import('../../../services/agents/AgentRegistry.js');
  const { AgentMessageBroker } = await import('../../../services/agents/AgentMessageBroker.js');
  const { MemorySystem } = await import('../../../lib/agent-fabric/MemorySystem.js');
  const { valueTreeRepository } = await import('../../../repositories/ValueTreeRepository.js');
  return new WorkflowExecutor(
    policy as never,
    { routeStage: vi.fn().mockReturnValue({ selected_agent: { id: 'agent-1' } }) } as never,
    new CircuitBreakerManager() as never,
    new AgentRegistry() as never,
    new AgentMessageBroker() as never,
    new MemorySystem() as never,
    rateLimitFn as never,
    { enableWorkflows: true, maxRetryAttempts: 3, maxAgentInvocationsPerMinute: 20, ...cfg },
    {
      executionPersistence: executionPersistence as never,
      valueTreeRepo: valueTreeRepository as never,
    },
  );
}

const makeStage = (o: Record<string, unknown> = {}) => ({
  id: 'stage-1', name: 'Test Stage', agent_type: 'coordinator', description: 'Run coordinator',
  timeout_seconds: 10, retry_config: { max_attempts: 2, initial_delay_ms: 100, max_delay_ms: 1000, multiplier: 2, jitter: false },
  ...o,
});
const makeDAG = (o: Record<string, unknown> = {}) => ({
  id: 'dag-1', initial_stage: 'stage-1', final_stages: ['stage-1'], stages: [makeStage()], transitions: [], ...o,
});
const makeCtx = () => ({ organizationId: 'org-1', sessionId: 'session-1', userId: 'user-1' });
const makeEnvelope = () => ({
  intent: 'test', actor: { id: 'user-1' }, organizationId: 'org-1',
  entryPoint: 'api', reason: 'test', timestamps: { requestedAt: new Date().toISOString() },
});

// ---------------------------------------------------------------------------
// _validateWorkflowDAG
// ---------------------------------------------------------------------------

describe('WorkflowExecutor._validateWorkflowDAG', () => {
  let executor: WorkflowExecutor;
  beforeEach(async () => { executor = await makeExecutor(); });

  it('throws when dag is null', () => {
    expect(() => (executor as never)._validateWorkflowDAG(null)).toThrow('must be an object');
  });
  it('throws when stages is empty', () => {
    expect(() => (executor as never)._validateWorkflowDAG({ stages: [], initial_stage: 's1', final_stages: ['s1'] })).toThrow('non-empty array');
  });
  it('throws when initial_stage is missing', () => {
    expect(() => (executor as never)._validateWorkflowDAG({ stages: [{ id: 's1' }], initial_stage: '', final_stages: ['s1'] })).toThrow('initial_stage is required');
  });
  it('throws when initial_stage does not reference an existing stage', () => {
    expect(() => (executor as never)._validateWorkflowDAG({ stages: [{ id: 's1' }], initial_stage: 'missing', final_stages: ['s1'] })).toThrow('initial_stage must reference an existing stage');
  });
  it('throws when final_stages reference missing stages', () => {
    expect(() => (executor as never)._validateWorkflowDAG({ stages: [{ id: 's1' }], initial_stage: 's1', final_stages: ['missing'] })).toThrow('final_stages reference missing stages');
  });
  it('throws when transitions contain a cycle', () => {
    expect(() => (executor as never)._validateWorkflowDAG({
      stages: [{ id: 's1' }, { id: 's2' }],
      initial_stage: 's1',
      final_stages: ['s2'],
      transitions: [
        { from_stage: 's1', to_stage: 's2' },
        { from_stage: 's2', to_stage: 's1' },
      ],
    })).toThrow('contains cycle');
  });
  it('returns the dag when valid', () => {
    const dag = makeDAG();
    expect((executor as never)._validateWorkflowDAG(dag)).toBe(dag);
  });
});

// ---------------------------------------------------------------------------
// executeWorkflow
// ---------------------------------------------------------------------------

describe('WorkflowExecutor.executeWorkflow', () => {
  it('throws when workflows are disabled', async () => {
    const executor = await makeExecutor(makePolicyMock(), { enableWorkflows: false });
    await expect(executor.executeWorkflow(makeEnvelope() as never, 'wf-1')).rejects.toThrow('Workflow execution is disabled');
  });

  it('calls assertTenantExecutionAllowed before querying DB', async () => {
    const policy = makePolicyMock();
    policy.assertTenantExecutionAllowed.mockRejectedValueOnce(new Error('Tenant paused'));
    const executor = await makeExecutor(policy);
    await expect(executor.executeWorkflow(makeEnvelope() as never, 'wf-1')).rejects.toThrow('Tenant paused');
    expect(policy.assertTenantExecutionAllowed).toHaveBeenCalledWith('org-1');
  });

  it('throws when workflow definition is not found', async () => {
    const persistence = makeExecutionPersistenceMock();
    persistence.getActiveWorkflowDefinition.mockResolvedValueOnce(null);
    const executor = await makeExecutor(makePolicyMock(), {}, () => true, persistence);

    await expect(executor.executeWorkflow(makeEnvelope() as never, 'wf-missing')).rejects.toThrow('Workflow definition not found');
  });

  it('throws when workflow belongs to a different organization', async () => {
    const persistence = makeExecutionPersistenceMock();
    // Ports are responsible for tenant authorization and return null when scoped out.
    persistence.getActiveWorkflowDefinition.mockResolvedValueOnce(null);
    const executor = await makeExecutor(makePolicyMock(), {}, () => true, persistence);

    await expect(executor.executeWorkflow(makeEnvelope() as never, 'wf-1')).rejects.toThrow('Workflow definition not found');
  });
});

// ---------------------------------------------------------------------------
// executeStage
// ---------------------------------------------------------------------------

describe('WorkflowExecutor.executeStage', () => {
  let executor: WorkflowExecutor;
  beforeEach(async () => { executor = await makeExecutor(); });


  it('rejects stage execution when context tenant mismatches', async () => {
    const executor = await makeExecutor();

    await expect(
      executor.executeStage(makeStage() as never, { ...makeCtx(), organizationId: 'org-1', tenantId: 'org-2' } as never, { selected_agent: null } as never),
    ).rejects.toThrow(/Tenant context mismatch/);
  });

  it('returns stage output on success', async () => {
    (executor as never).messageBroker.sendToAgent.mockResolvedValueOnce({ success: true, data: { value: 42 } });
    const result = await executor.executeStage(makeStage() as never, makeCtx(), { selected_agent: null } as never);
    expect(result.stage_id).toBe('stage-1');
    expect(result.output).toEqual({ value: 42 });
  });

  it('throws when message broker reports failure', async () => {
    (executor as never).messageBroker.sendToAgent.mockResolvedValueOnce({ success: false, error: 'broker timeout' });
    await expect(executor.executeStage(makeStage() as never, makeCtx(), { selected_agent: null } as never))
      .rejects.toThrow('Agent communication failed: broker timeout');
  });

  it('continues when memory retrieval fails (non-fatal)', async () => {
    (executor as never).memorySystem.retrieve.mockRejectedValueOnce(new Error('memory unavailable'));
    (executor as never).messageBroker.sendToAgent.mockResolvedValueOnce({ success: true, data: {} });
    await expect(executor.executeStage(makeStage() as never, makeCtx(), { selected_agent: null } as never)).resolves.toBeDefined();
  });

  it('includes past memories in broker context when available', async () => {
    (executor as never).memorySystem.retrieve.mockResolvedValueOnce([{ content: 'prior', memory_type: 'episodic', importance: 0.8 }]);
    (executor as never).messageBroker.sendToAgent.mockResolvedValueOnce({ success: true, data: {} });
    await executor.executeStage(makeStage() as never, makeCtx(), { selected_agent: null } as never);
    expect(JSON.stringify((executor as never).messageBroker.sendToAgent.mock.calls[0])).toContain('pastMemories');
  });
});

// ---------------------------------------------------------------------------
// executeStageWithRetry
// ---------------------------------------------------------------------------

describe('WorkflowExecutor.executeStageWithRetry', () => {
  let executor: WorkflowExecutor;
  beforeEach(async () => { executor = await makeExecutor(); });

  it('returns completed status on success', async () => {
    (executor as never).retryManager.executeWithRetry.mockResolvedValueOnce({ success: true, response: { data: { output: 'done' } }, attempts: 1 });
    const result = await executor.executeStageWithRetry('exec-1', makeStage() as never, makeCtx(), { selected_agent: { id: 'a1' } } as never, 'trace-1');
    expect(result.status).toBe('completed');
    expect(result.output).toEqual({ output: 'done' });
  });

  it('returns failed status when retry manager exhausts attempts', async () => {
    (executor as never).retryManager.executeWithRetry.mockResolvedValueOnce({ success: false, error: new Error('all retries failed'), attempts: 3 });
    const result = await executor.executeStageWithRetry('exec-1', makeStage() as never, makeCtx(), { selected_agent: { id: 'a1' } } as never, 'trace-1');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('all retries failed');
  });

  it('records agent failure in registry when stage fails', async () => {
    (executor as never).retryManager.executeWithRetry.mockResolvedValueOnce({ success: false, error: new Error('fail'), attempts: 1 });
    await executor.executeStageWithRetry('exec-1', makeStage() as never, makeCtx(), { selected_agent: { id: 'a1' } } as never, 'trace-1');
    expect((executor as never).registry.recordFailure).toHaveBeenCalledWith('a1');
  });

  it('records agent release and marks healthy when stage succeeds', async () => {
    (executor as never).retryManager.executeWithRetry.mockResolvedValueOnce({ success: true, response: { data: { out: 1 } }, attempts: 1 });
    await executor.executeStageWithRetry('exec-1', makeStage() as never, makeCtx(), { selected_agent: { id: 'a1' } } as never, 'trace-1');
    expect((executor as never).registry.recordRelease).toHaveBeenCalledWith('a1');
    expect((executor as never).registry.markHealthy).toHaveBeenCalledWith('a1');
  });

  it('returns failed when rate limit is exceeded inside retry agent execute()', async () => {
    const limited = await makeExecutor(makePolicyMock(), {}, () => false);
    (limited as never).retryManager.executeWithRetry.mockImplementationOnce(async (agent: { execute: () => Promise<unknown> }) => {
      try { await agent.execute(); } catch (e) { return { success: false, error: e as Error, attempts: 1 }; }
    });
    const result = await limited.executeStageWithRetry('exec-1', makeStage() as never, makeCtx(), { selected_agent: null } as never, 'trace-1');
    expect(result.status).toBe('failed');
    expect(result.error).toContain('rate limit exceeded');
  });

  it('returns pending_approval without retry execution when HITL is required', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValueOnce({
      allowed: false,
      hitl_required: true,
      hitl_reason: 'Approval required before external artifact generation',
      details: { rule_id: 'HITL-01', confidence_score: 0.45, is_external_artifact_action: true },
    });
    const guarded = await makeExecutor(policy);

    const result = await guarded.executeStageWithRetry(
      'exec-1',
      makeStage({ id: 'narrative', name: 'Narrative', description: 'Generate customer-facing narrative', agent_type: 'composing' }) as never,
      { ...makeCtx(), confidence_score: 0.45 } as never,
      { selected_agent: { id: 'a1' } } as never,
      'trace-1',
    );

    expect(result.status).toBe('pending_approval');
    expect((guarded as never).retryManager.executeWithRetry).not.toHaveBeenCalled();
    expect(result.output).toMatchObject({ rule_id: 'HITL-01', traceId: 'trace-1' });
  });
});

// ---------------------------------------------------------------------------
// executeDAGAsync — integrity veto paths
// ---------------------------------------------------------------------------

describe('WorkflowExecutor.executeDAGAsync', () => {
  it('stops DAG and marks execution failed when structural truth veto fires', async () => {
    const policy = makePolicyMock();
    policy.evaluateStructuralTruthVeto.mockResolvedValueOnce({ vetoed: true, metadata: { integrityVeto: true } });
    const executor = await makeExecutor(policy);
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: { output: 'x' } }, attempts: 1 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, makeCtx(), 'trace-1');
    expect(policy.evaluateStructuralTruthVeto).toHaveBeenCalled();
    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('marks execution failed when integrity veto fires', async () => {
    const policy = makePolicyMock();
    policy.evaluateStructuralTruthVeto.mockResolvedValue({ vetoed: false });
    policy.evaluateIntegrityVeto.mockResolvedValueOnce({ vetoed: true, metadata: { integrityVeto: true } });
    const executor = await makeExecutor(policy);
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: { output: 'x' } }, attempts: 1 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, makeCtx(), 'trace-1');
    expect(policy.evaluateIntegrityVeto).toHaveBeenCalled();
    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });


  it('rejects DAG execution when stage context tenant mismatches authoritative tenant', async () => {
    const executor = await makeExecutor();

    await expect(
      executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, { ...makeCtx(), organizationId: 'org-2' } as never, 'trace-1'),
    ).rejects.toThrow(/Tenant context mismatch/);
  });

  it('marks execution completed when all stages pass', async () => {
    const executor = await makeExecutor();
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: { output: 'ok' } }, attempts: 1 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, makeCtx(), 'trace-1');
    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('marks execution failed when stage execution fails', async () => {
    const executor = await makeExecutor();
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: false, error: new Error('stage error'), attempts: 3 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, makeCtx(), 'trace-1');
    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('fails scenario_building stage when output violates canonical scenario schema', async () => {
    const executor = await makeExecutor();
    const malformedScenarioOutput = {
      conservative: { scenario_type: 'conservative' },
      base: { scenario_type: 'base' },
      upside: { scenario_type: 'upside' },
    };
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: malformedScenarioOutput }, attempts: 1 });

    await executor.executeDAGAsync(
      'exec-1',
      'org-1',
      makeDAG({ stages: [makeStage({ id: 'scenario_building', name: 'Build Scenarios' })] }) as never,
      makeCtx(),
      'trace-1',
    );

    expect((executor as never).executionPersistence.recordWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'stage_failed',
      stageId: 'scenario_building',
      metadata: expect.objectContaining({
        reason: 'schema_violation',
        schema: 'ScenarioBuildOutputSchema',
        stageId: 'scenario_building',
        issues: expect.any(Array),
      }),
    }));
    expect((executor as never).executionPersistence.recordStageRun).not.toHaveBeenCalled();
    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('calls assertTenantExecutionAllowed on each DAG iteration', async () => {
    const policy = makePolicyMock();
    const executor = await makeExecutor(policy);
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: {} }, attempts: 1 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG() as never, makeCtx(), 'trace-1');
    expect(policy.assertTenantExecutionAllowed).toHaveBeenCalledWith('org-1');
  });

  it('fails fast before any stage execution when value-modeling snapshot capture fails', async () => {
    const executor = await makeExecutor();
    const { valueTreeRepository } = await import('../../../repositories/ValueTreeRepository.js');
    vi.mocked(valueTreeRepository.getNodesForCase).mockRejectedValueOnce(new Error('snapshot unavailable'));
    const stageSpy = vi.spyOn(executor, 'executeStageWithRetry');

    await expect(
      executor.executeDAGAsync(
        'exec-1',
        'org-1',
        makeDAG({ id: 'value-modeling-v1' }) as never,
        { ...makeCtx(), caseId: 'case-1' } as never,
        'trace-1',
      ),
    ).rejects.toThrow('Failed to capture pre-modeling snapshot');

    expect(stageSpy).not.toHaveBeenCalled();
  });

  it('persists preModelingSnapshot into workflow execution context for value-modeling workflow', async () => {
    const executor = await makeExecutor();
    const { valueTreeRepository } = await import('../../../repositories/ValueTreeRepository.js');
    vi.mocked(valueTreeRepository.getNodesForCase).mockResolvedValueOnce([
      {
        id: 'node-1',
        case_id: 'case-1',
        organization_id: 'org-1',
        parent_id: null,
        node_key: 'root',
        label: 'Root Node',
        description: null,
        driver_type: 'revenue',
        impact_estimate: 100,
        confidence: 0.9,
        sort_order: 0,
        source_agent: 'opportunity',
        metadata: { seeded: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    await executor.executeDAGAsync(
      'exec-2',
      'org-1',
      makeDAG({ id: 'value-modeling-v1' }) as never,
      { ...makeCtx(), caseId: 'case-1' } as never,
      'trace-2',
    );

    expect((executor as never).executionPersistence.updateWorkflowExecutionContext).toHaveBeenCalledWith(
      'exec-2',
      'org-1',
      expect.objectContaining({
        preModelingSnapshot: expect.arrayContaining([
          expect.objectContaining({
            node_key: 'root',
            label: 'Root Node',
          }),
        ]),
      }),
    );
  });

  it('marks execution pending_approval and halts when stage HITL is required', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValueOnce({
      allowed: false,
      hitl_required: true,
      hitl_reason: 'Approval required',
      details: { rule_id: 'HITL-01', confidence_score: 0.4, is_external_artifact_action: true },
    });
    const executor = await makeExecutor(policy);

    await executor.executeDAGAsync(
      'exec-1',
      'org-1',
      makeDAG({ stages: [makeStage({ id: 'narrative', name: 'Narrative', description: 'customer narrative', agent_type: 'composing' })] }) as never,
      { ...makeCtx(), confidence_score: 0.4 } as never,
      'trace-1',
    );

    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_approval' }));
    expect((executor as never).executionPersistence.recordWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'stage_waiting_for_approval' }));
  });
});

describe('WorkflowExecutor HITL integration', () => {
  it('persists pending_approval and emits audit event when stage is blocked by HITL', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValueOnce({
      allowed: false,
      hitl_required: true,
      hitl_reason: 'Approval required before external artifact generation',
      details: { rule_id: 'HITL-01', confidence_score: 0.45, is_external_artifact_action: true },
    });

    const executor = await makeExecutor(policy);

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG({ stages: [makeStage({ agent_type: 'narrative' })] }) as never, makeCtx(), 'trace-1');

    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_approval' }));
    expect((executor as never).executionPersistence.recordWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'stage_hitl_pending_approval',
      metadata: expect.objectContaining({ rule_id: 'HITL-01', confidence_score: 0.45, traceId: 'trace-1' }),
    }));
    expect((executor as never).retryManager.executeWithRetry).not.toHaveBeenCalled();
  });

  it('executes stage autonomously when HITL is not required', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValue({
      allowed: true,
      hitl_required: false,
      details: { rule_id: 'HITL-01', confidence_score: 0.9, is_external_artifact_action: true },
    });

    const executor = await makeExecutor(policy);
    (executor as never).retryManager.executeWithRetry.mockResolvedValue({ success: true, response: { data: { output: 'ok' } }, attempts: 1 });

    await executor.executeDAGAsync('exec-1', 'org-1', makeDAG({ stages: [makeStage({ agent_type: 'narrative' })] }) as never, makeCtx(), 'trace-1');

    expect((executor as never).executionPersistence.updateExecutionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    expect((executor as never).retryManager.executeWithRetry).toHaveBeenCalled();
  });
});
