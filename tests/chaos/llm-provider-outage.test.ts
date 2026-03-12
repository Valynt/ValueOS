/**
 * Chaos: LLM provider timeout and outage.
 *
 * Success criteria:
 * - Circuit breaker opens after sustained LLM failures
 * - User-visible state is degraded (not a phantom success)
 * - No phantom completion record is written
 * - Audit log contains trace_id and organization_id
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-test stubs — no real LLM gateway dependency
// ---------------------------------------------------------------------------

interface LLMRequest {
  prompt: string;
  sessionId: string;
  organizationId: string;
  traceId: string;
}

interface LLMResponse {
  output: string;
  model: string;
}

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  threshold: number;
}

interface AuditEntry {
  event: string;
  traceId: string;
  organizationId: string;
  severity: "info" | "warn" | "error";
  metadata: Record<string, unknown>;
}

class LLMCircuitBreaker {
  private failureCount = 0;
  private state: CircuitBreakerState["state"] = "closed";
  readonly threshold: number;

  constructor(threshold = 3) {
    this.threshold = threshold;
  }

  recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = "open";
    }
  }

  isOpen(): boolean {
    return this.state === "open";
  }

  getState(): CircuitBreakerState {
    return { state: this.state, failureCount: this.failureCount, threshold: this.threshold };
  }

  reset(): void {
    this.failureCount = 0;
    this.state = "closed";
  }
}

const mockLLMGateway = {
  complete: vi.fn<[LLMRequest], Promise<LLMResponse>>(),
};

const mockAuditLog: AuditEntry[] = [];
const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    mockAuditLog.push({
      event: msg,
      traceId: meta["traceId"] as string,
      organizationId: meta["organizationId"] as string,
      severity: "error",
      metadata: meta,
    });
  }),
  warn: vi.fn(),
  info: vi.fn(),
};

// ---------------------------------------------------------------------------
// Agent stub that uses the circuit breaker
// ---------------------------------------------------------------------------

async function invokeAgentWithCircuitBreaker(
  request: LLMRequest,
  breaker: LLMCircuitBreaker,
): Promise<{ status: "completed" | "degraded" | "circuit_open"; output?: string }> {
  if (breaker.isOpen()) {
    mockLogger.error("LLM circuit breaker is open — request rejected", {
      traceId: request.traceId,
      organizationId: request.organizationId,
      circuitState: "open",
    });
    return { status: "circuit_open" };
  }

  try {
    const result = await mockLLMGateway.complete(request);
    return { status: "completed", output: result.output };
  } catch (err) {
    breaker.recordFailure();
    mockLogger.error("LLM provider failure", {
      traceId: request.traceId,
      organizationId: request.organizationId,
      error: (err as Error).message,
      circuitState: breaker.getState().state,
    });
    return { status: "degraded" };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chaos: LLM provider outage", () => {
  let breaker: LLMCircuitBreaker;

  beforeEach(() => {
    breaker = new LLMCircuitBreaker(3);
    mockAuditLog.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseRequest: LLMRequest = {
    prompt: "analyse opportunity",
    sessionId: "sess-chaos-001",
    organizationId: "org-chaos",
    traceId: "trace-llm-001",
  };

  it("returns degraded state on LLM timeout — not a phantom success", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("LLM request timed out"));

    const result = await invokeAgentWithCircuitBreaker(baseRequest, breaker);

    expect(result.status).toBe("degraded");
    expect(result.output).toBeUndefined();
  });

  it("circuit breaker opens after threshold failures", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("provider outage"));

    for (let i = 0; i < 3; i++) {
      await invokeAgentWithCircuitBreaker(baseRequest, breaker);
    }

    expect(breaker.isOpen()).toBe(true);
  });

  it("rejects requests immediately when circuit is open", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("provider outage"));

    // Trip the breaker.
    for (let i = 0; i < 3; i++) {
      await invokeAgentWithCircuitBreaker(baseRequest, breaker);
    }

    // Next call should be rejected without hitting the LLM.
    const callCountBefore = mockLLMGateway.complete.mock.calls.length;
    const result = await invokeAgentWithCircuitBreaker(baseRequest, breaker);

    expect(result.status).toBe("circuit_open");
    expect(mockLLMGateway.complete.mock.calls.length).toBe(callCountBefore);
  });

  it("audit log contains trace_id and organization_id on failure", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("provider outage"));

    await invokeAgentWithCircuitBreaker(baseRequest, breaker);

    expect(mockAuditLog.length).toBeGreaterThan(0);
    const entry = mockAuditLog[0];
    expect(entry.traceId).toBe(baseRequest.traceId);
    expect(entry.organizationId).toBe(baseRequest.organizationId);
    expect(entry.severity).toBe("error");
  });

  it("no phantom completion is written when LLM fails", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("provider outage"));

    const result = await invokeAgentWithCircuitBreaker(baseRequest, breaker);

    expect(result.status).not.toBe("completed");
    expect(result.output).toBeUndefined();
  });

  it("retry count is bounded — does not loop infinitely", async () => {
    mockLLMGateway.complete.mockRejectedValue(new Error("provider outage"));

    // Simulate 10 calls — circuit should open at threshold and stop hitting LLM.
    for (let i = 0; i < 10; i++) {
      await invokeAgentWithCircuitBreaker(baseRequest, breaker);
    }

    // LLM should only have been called up to the threshold (3), not 10 times.
    expect(mockLLMGateway.complete.mock.calls.length).toBeLessThanOrEqual(breaker.threshold);
  });
});
