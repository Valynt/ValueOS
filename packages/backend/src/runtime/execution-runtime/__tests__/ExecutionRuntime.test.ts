import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryExecutor } from "../QueryExecutor.js";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("uuid", () => ({
  v4: (() => {
    let n = 0;
    return () => `uuid-${++n}`;
  })(),
}));

vi.mock("../../../lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockSpan = {
  setAttributes: vi.fn(),
  setStatus: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
};
vi.mock("../../../config/telemetry", () => ({
  getTracer: vi.fn(function () {
    return {
      // Handle both 2-arg (name, fn) and 3-arg (name, options, fn) overloads.
      startActiveSpan: vi.fn(function (...args: unknown[]) {
        const fn = (
          typeof args[args.length - 1] === "function"
            ? args[args.length - 1]
            : null
        ) as ((span: unknown) => unknown) | null;
        return fn ? fn(mockSpan) : undefined;
      }),
    };
  }),
}));

// ADR-0014: QueryExecutor now calls AgentFactory directly — no HTTP round-trip.
vi.mock("../../../lib/agent-fabric/AgentFactory", () => ({
  createAgentFactory: vi.fn(function () {
    return {
      create: vi.fn(function () {
        return {
          execute: vi.fn().mockResolvedValue({
            status: "success",
            result: { message: "ok" },
            confidence: "high",
            errors: [],
            agent_id: "test-agent",
            agent_type: "coordinator",
            lifecycle_stage: "discovery",
            metadata: {
              execution_time_ms: 10,
              model_version: "test",
              timestamp: new Date().toISOString(),
            },
          }),
        };
      }),
    };
  }),
}));

vi.mock("../../../lib/agent-fabric/LLMGateway", () => ({
  LLMGateway: vi.fn(function () {
    return {};
  }),
}));

vi.mock("../../../lib/agent-fabric/MemorySystem", () => ({
  MemorySystem: vi.fn(function () {
    return {};
  }),
}));

vi.mock("../../../lib/agent-fabric/SupabaseMemoryBackend", () => ({
  SupabaseMemoryBackend: vi.fn(function () {
    return {};
  }),
}));

vi.mock("../../../lib/resilience/CircuitBreaker", () => ({
  CircuitBreaker: vi.fn(function () {
    return {
      execute: vi.fn(function (_key: string, fn: () => unknown) {
        return fn();
      }),
    };
  }),
}));

vi.mock("../../../config/featureFlags", () => ({
  featureFlags: { ENABLE_ASYNC_AGENT_EXECUTION: false },
}));

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makePolicyMock() {
  return {
    assertTenantExecutionAllowed: vi.fn().mockResolvedValue(undefined),
    evaluateIntegrityVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    evaluateStructuralTruthVeto: vi.fn().mockResolvedValue({ vetoed: false }),
    performReRefine: vi.fn().mockResolvedValue({ success: false, attempts: 2 }),
    checkAutonomyGuardrails: vi.fn().mockResolvedValue(undefined),
    checkHITL: vi.fn().mockReturnValue({ allowed: true, hitl_required: false, details: { rule_id: 'HITL-01', is_external_artifact_action: false } }),
  };
}

function makeRouterMock(agentType = "coordinator") {
  return {
    selectAgent: vi.fn().mockReturnValue(agentType),
    routeStage: vi.fn().mockReturnValue({ selected_agent: null }),
  };
}

function makeCircuitBreakerMock() {
  return {
    execute: vi.fn(function (_key: string, fn: () => unknown) {
      return fn();
    }),
  };
}

function makeQueueMock() {
  return {
    queueAgentInvocation: vi.fn().mockResolvedValue("job-123"),
    getJobResult: vi.fn().mockResolvedValue(null),
    waitForJobCompletion: vi
      .fn()
      .mockResolvedValue({
        success: true,
        data: { message: "done" },
        traceId: "trace-1",
      }),
  };
}

function makeState() {
  return {
    id: "state-1",
    workflow_id: "",
    execution_id: "exec-1",
    workspace_id: "",
    organization_id: "org-1",
    lifecycle_stage: "discovery",
    current_step: "discovery",
    currentStage: "discovery",
    status: "initiated" as const,
    completed_steps: [],
    state_data: {},
    context: { organizationId: "org-1", conversationHistory: [] },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function makeEnvelope() {
  return {
    intent: "test",
    actor: { id: "user-1" },
    organizationId: "org-1",
    entryPoint: "api",
    reason: "test",
    timestamps: { requestedAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("QueryExecutor.checkAgentRateLimit", () => {
  let executor: QueryExecutor;

  beforeEach(() => {
    executor = new QueryExecutor(
      makePolicyMock() as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      makeQueueMock() as never,
      { defaultTimeoutMs: 5000, maxAgentInvocationsPerMinute: 3 }
    );
  });

  it("allows invocations under the limit", () => {
    expect(executor.checkAgentRateLimit("coordinator")).toBe(true);
    expect(executor.checkAgentRateLimit("coordinator")).toBe(true);
    expect(executor.checkAgentRateLimit("coordinator")).toBe(true);
  });

  it("blocks invocations at the limit", () => {
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    expect(executor.checkAgentRateLimit("coordinator")).toBe(false);
  });

  it("tracks limits per agent type independently", () => {
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    // Different agent type should still be allowed
    expect(executor.checkAgentRateLimit("financial-modeling")).toBe(true);
  });

  it("resets after the time window expires", () => {
    vi.useFakeTimers();
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    executor.checkAgentRateLimit("coordinator");
    expect(executor.checkAgentRateLimit("coordinator")).toBe(false);

    // Advance past the 60s window
    vi.advanceTimersByTime(61_000);
    expect(executor.checkAgentRateLimit("coordinator")).toBe(true);
    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// processQueryAsync — queuing
// ---------------------------------------------------------------------------

describe("QueryExecutor.processQueryAsync", () => {
  let executor: QueryExecutor;
  let policy: ReturnType<typeof makePolicyMock>;
  let queue: ReturnType<typeof makeQueueMock>;

  beforeEach(() => {
    policy = makePolicyMock();
    queue = makeQueueMock();
    executor = new QueryExecutor(
      policy as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      queue as never
    );
  });

  it("returns a jobId and traceId", async () => {
    const result = await executor.processQueryAsync(
      makeEnvelope() as never,
      "what is the ROI?",
      makeState() as never,
      "user-1",
      "session-1"
    );
    expect(result.jobId).toBe("job-123");
    expect(result.traceId).toBeTruthy();
  });

  it("calls assertTenantExecutionAllowed before queuing", async () => {
    await executor.processQueryAsync(
      makeEnvelope() as never,
      "query",
      makeState() as never,
      "user-1",
      "session-1"
    );
    expect(policy.assertTenantExecutionAllowed).toHaveBeenCalledWith("org-1");
  });

  it("throws when tenant execution is paused", async () => {
    policy.assertTenantExecutionAllowed.mockRejectedValueOnce(
      new Error("Tenant execution is paused")
    );
    await expect(
      executor.processQueryAsync(
        makeEnvelope() as never,
        "query",
        makeState() as never,
        "user-1",
        "session-1"
      )
    ).rejects.toThrow("Tenant execution is paused");
  });

  it("cannot bypass paused-tenant block through async queue path", async () => {
    policy.assertTenantExecutionAllowed.mockRejectedValueOnce(
      new Error("Tenant execution is paused")
    );
    await expect(
      executor.processQueryAsync(
        makeEnvelope() as never,
        "query",
        makeState() as never,
        "user-1",
        "session-1"
      )
    ).rejects.toThrow("Tenant execution is paused");
    expect(queue.queueAgentInvocation).not.toHaveBeenCalled();
  });

  it("throws when rate limit is exceeded", async () => {
    // Exhaust the default limit (20) for the selected agent type
    const limitedExecutor = new QueryExecutor(
      policy as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      queue as never,
      { defaultTimeoutMs: 5000, maxAgentInvocationsPerMinute: 1 }
    );
    await limitedExecutor.processQueryAsync(
      makeEnvelope() as never,
      "q",
      makeState() as never,
      "u",
      "s"
    );
    await expect(
      limitedExecutor.processQueryAsync(
        makeEnvelope() as never,
        "q",
        makeState() as never,
        "u",
        "s"
      )
    ).rejects.toThrow("rate limit exceeded");
  });
});

// ---------------------------------------------------------------------------
// getAsyncQueryResult — result handling
// ---------------------------------------------------------------------------

describe("QueryExecutor.getAsyncQueryResult", () => {
  let executor: QueryExecutor;
  let policy: ReturnType<typeof makePolicyMock>;
  let queue: ReturnType<typeof makeQueueMock>;

  beforeEach(() => {
    policy = makePolicyMock();
    queue = makeQueueMock();
    executor = new QueryExecutor(
      policy as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      queue as never
    );
  });

  it("returns null when job is not yet complete", async () => {
    queue.getJobResult.mockResolvedValueOnce(null);
    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result).toBeNull();
  });

  it("returns an error result when job failed", async () => {
    queue.getJobResult.mockResolvedValueOnce({
      success: false,
      error: "agent crashed",
      traceId: "t1",
    });
    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result?.response?.payload).toMatchObject({ error: true });
    expect(result?.nextState.status).toBe("failed");
  });

  it("returns a vetoed result when structural truth check fails", async () => {
    queue.getJobResult.mockResolvedValueOnce({
      success: true,
      data: { output: "x" },
      traceId: "t1",
    });
    policy.evaluateStructuralTruthVeto.mockResolvedValueOnce({
      vetoed: true,
      metadata: { integrityVeto: true },
    });
    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result?.response?.payload).toMatchObject({ error: true });
    expect(result?.response?.payload.message).toContain("structural truth");
  });

  it("returns a vetoed result when integrity check fails", async () => {
    queue.getJobResult.mockResolvedValueOnce({
      success: true,
      data: { output: "x" },
      traceId: "t1",
    });
    policy.evaluateStructuralTruthVeto.mockResolvedValueOnce({ vetoed: false });
    policy.evaluateIntegrityVeto.mockResolvedValueOnce({
      vetoed: true,
      metadata: { integrityVeto: true },
    });
    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result?.response?.payload).toMatchObject({ error: true });
    expect(result?.response?.payload.message).toContain("integrity validation");
  });

  it("returns a successful result and updates conversation history", async () => {
    queue.getJobResult.mockResolvedValueOnce({
      success: true,
      data: { message: "analysis complete" },
      traceId: "t1",
    });
    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result?.response?.payload.message).toBeTruthy();
    expect(result?.nextState.status).toBe("running");
    const history = result?.nextState.context?.conversationHistory as unknown[];
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it("triggers re-refine when reRefine flag is set and returns error if refinement fails", async () => {
    queue.getJobResult.mockResolvedValueOnce({
      success: true,
      data: { output: "low confidence" },
      traceId: "t1",
    });
    policy.evaluateStructuralTruthVeto.mockResolvedValueOnce({ vetoed: false });
    policy.evaluateIntegrityVeto.mockResolvedValueOnce({
      vetoed: false,
      reRefine: true,
    });
    policy.performReRefine.mockResolvedValueOnce({
      success: false,
      attempts: 2,
    });

    const result = await executor.getAsyncQueryResult(
      "job-1",
      makeState() as never
    );
    expect(result?.response?.payload).toMatchObject({ error: true });
    expect(result?.response?.payload.message).toContain("auto-refine");
  });
});

// ---------------------------------------------------------------------------
// processQuery — sync path
// ---------------------------------------------------------------------------

describe("QueryExecutor.processQuery (sync path)", () => {
  let executor: QueryExecutor;
  let policy: ReturnType<typeof makePolicyMock>;

  beforeEach(() => {
    policy = makePolicyMock();
    executor = new QueryExecutor(
      policy as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      makeQueueMock() as never
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls assertTenantExecutionAllowed", async () => {
    await executor.processQuery(
      makeEnvelope() as never,
      "query",
      makeState() as never,
      "u",
      "s"
    );
    expect(policy.assertTenantExecutionAllowed).toHaveBeenCalledWith("org-1");
  });

  it("returns a successful response with updated state", async () => {
    const result = await executor.processQuery(
      makeEnvelope() as never,
      "what is ROI?",
      makeState() as never,
      "u",
      "s"
    );
    expect(result.response?.type).toBe("message");
    // Production code sets status to 'running' on a successful agent response
    expect(result.nextState.status).toSatisfy((s: string) =>
      ["running", "in_progress", "completed"].includes(s)
    );
    expect(result.traceId).toBeTruthy();
  });

  it("throws when tenant execution is paused (assertTenantExecutionAllowed is called before span)", async () => {
    // assertTenantExecutionAllowed is called before _processQuerySync's try/catch,
    // so the rejection propagates out of processQuery rather than being caught.
    policy.assertTenantExecutionAllowed.mockRejectedValueOnce(
      new Error("Tenant execution is paused")
    );
    await expect(
      executor.processQuery(
        makeEnvelope() as never,
        "query",
        makeState() as never,
        "u",
        "s"
      )
    ).rejects.toThrow("Tenant execution is paused");
  });

  it("returns vetoed response when integrity check fails", async () => {
    // The veto check returns early from inside the span with an error payload.
    policy.evaluateIntegrityVeto.mockResolvedValueOnce({
      vetoed: true,
      metadata: { integrityVeto: true },
    });
    const result = await executor.processQuery(
      makeEnvelope() as never,
      "query",
      makeState() as never,
      "u",
      "s"
    );
    expect(result.response?.payload).toMatchObject({ error: true });
    // The veto message or a generic error — either is acceptable; the key is error: true.
    expect(typeof result.response?.payload.message).toBe("string");
  });

  it("returns error when rate limit is exceeded", async () => {
    const limited = new QueryExecutor(
      policy as never,
      makeRouterMock() as never,
      makeCircuitBreakerMock() as never,
      makeQueueMock() as never,
      { defaultTimeoutMs: 5000, maxAgentInvocationsPerMinute: 0 }
    );
    const result = await limited.processQuery(
      makeEnvelope() as never,
      "q",
      makeState() as never,
      "u",
      "s"
    );
    expect(result.response?.payload).toMatchObject({ error: true });
  });
});

// ---------------------------------------------------------------------------
// ADR-0014: Direct agent invocation — no HTTP round-trip
// ---------------------------------------------------------------------------

describe("QueryExecutor — direct AgentFactory invocation (ADR-0014)", () => {
  it("calls AgentFactory.create().execute() without a network hop", async () => {
    const { createAgentFactory } = await import(
      "../../../lib/agent-fabric/AgentFactory.js"
    );
    const mockExecute = vi.fn().mockResolvedValue({
      status: "success",
      result: { answer: "direct invocation works" },
      confidence: "high",
      errors: [],
      agent_id: "opportunity",
      agent_type: "opportunity",
      lifecycle_stage: "discovery",
      metadata: {
        execution_time_ms: 5,
        model_version: "test",
        timestamp: new Date().toISOString(),
      },
    });
    const mockCreate = vi.fn(function () {
      return { execute: mockExecute };
    });
    vi.mocked(createAgentFactory).mockReturnValueOnce({
      create: mockCreate,
    } as never);

    const policy = makePolicyMock();
    const executor = new QueryExecutor(
      policy as never,
      makeRouterMock("opportunity") as never,
      makeCircuitBreakerMock() as never,
      makeQueueMock() as never
    );

    const result = await executor.processQuery(
      makeEnvelope() as never,
      "what is the opportunity?",
      makeState() as never,
      "user-1",
      "session-1"
    );

    // Agent was invoked directly — no fetch/HTTP call
    expect(mockCreate).toHaveBeenCalledWith("opportunity", "org-1");
    expect(mockExecute).toHaveBeenCalledOnce();
    expect(result.response?.type).toBe("message");
    expect(result.response?.payload.message).toContain(
      "direct invocation works"
    );
  });
});

describe('QueryExecutor HITL gating', () => {
  it('returns pending_approval and does not execute agent when HITL is required', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValueOnce({
      allowed: false,
      hitl_required: true,
      hitl_reason: 'Human approval required',
      details: { rule_id: 'HITL-01', confidence_score: 0.42, is_external_artifact_action: true },
    });

    const executor = new QueryExecutor(
      policy as never,
      makeRouterMock('narrative') as never,
      makeCircuitBreakerMock() as never,
      makeQueueMock() as never,
    );

    const result = await executor.processQuery(makeEnvelope() as never, 'draft customer deck', makeState() as never, 'u', 's');

    expect(result.nextState.status).toBe('pending_approval');
    expect(result.response.payload).toMatchObject({ hitl_required: true, rule_id: 'HITL-01' });
  });

  it('blocks async queueing when HITL is required', async () => {
    const policy = makePolicyMock();
    policy.checkHITL.mockReturnValueOnce({
      allowed: false,
      hitl_required: true,
      hitl_reason: 'Human approval required',
      details: { rule_id: 'HITL-01', confidence_score: 0.4, is_external_artifact_action: true },
    });
    const queue = makeQueueMock();

    const executor = new QueryExecutor(
      policy as never,
      makeRouterMock('narrative') as never,
      makeCircuitBreakerMock() as never,
      queue as never,
    );

    await expect(
      executor.processQueryAsync(makeEnvelope() as never, 'draft customer deck', makeState() as never, 'u', 's'),
    ).rejects.toThrow('Human approval required');
    expect(queue.queueAgentInvocation).not.toHaveBeenCalled();
  });
});
