import { describe, expect, it, vi } from "vitest";

import type { AgentRequest, AgentResponse, IAgent } from "../../core/IAgent.js";
import { AgentRetryManager } from "../AgentRetryManager.js";

const successResponse: AgentResponse = {
  success: true,
  confidence: "high",
  data: { repaired: true },
  metadata: {
    executionId: "exec-1",
    agentType: "opportunity",
    startTime: new Date("2026-04-05T00:00:00.000Z"),
    endTime: new Date("2026-04-05T00:00:00.010Z"),
    duration: 10,
    tokenUsage: { input: 1, output: 1, total: 2, cost: 0.0001 },
    cacheHit: false,
    retryCount: 0,
    circuitBreakerTripped: false,
  },
};

function buildAgent(executeImpl: IAgent["execute"]): IAgent {
  return {
    execute: executeImpl,
    getAgentType: () => "opportunity",
    getCapabilities: () => [],
    validateInput: () => ({ valid: true, errors: [], warnings: [] }),
    getMetadata: () => ({}) as ReturnType<IAgent["getMetadata"]>,
    healthCheck: async () => ({}) as Awaited<ReturnType<IAgent["healthCheck"]>>,
    getConfiguration: () => ({}) as ReturnType<IAgent["getConfiguration"]>,
    updateConfiguration: async () => undefined,
    getPerformanceMetrics: () => ({}) as ReturnType<IAgent["getPerformanceMetrics"]>,
    reset: async () => undefined,
    supportsCapability: () => true,
    getInputSchema: () => ({}),
    getOutputSchema: () => ({}),
  };
}

describe("AgentRetryManager contract repair loop", () => {
  it("recovers within retry budget after contract-validation failures", async () => {
    const manager = AgentRetryManager.getInstance();
    manager.reset();

    const execute = vi
      .fn<IAgent["execute"]>()
      .mockRejectedValueOnce(new Error("SCHEMA_VALIDATION_FAILED: first response malformed"))
      .mockRejectedValueOnce(new Error("MISSING_EVIDENCE: high confidence without evidence"))
      .mockResolvedValueOnce(successResponse);

    const agent = buildAgent(execute);

    const request: AgentRequest = {
      agentType: "opportunity",
      query: "Repair and return valid contract output",
      sessionId: "session-1",
      userId: "user-1",
      organizationId: "org-1",
      context: {
        traceId: "trace-repair-success",
        contractVersion: "2.1.0",
      },
    };

    const result = await manager.executeWithRetry(agent, request, {
      maxRetries: 2,
      baseDelay: 0,
      maxDelay: 0,
      jitterFactor: 0,
      retryableErrors: ["Error"],
    });

    expect(result.success).toBe(true);
    expect(result.totalAttempts).toBe(3);
    expect(result.response?.data).toEqual({ repaired: true });
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("fails terminally after max retries are exhausted", async () => {
    const manager = AgentRetryManager.getInstance();
    manager.reset();

    const execute = vi
      .fn<IAgent["execute"]>()
      .mockRejectedValue(new Error("SCHEMA_VALIDATION_FAILED: still invalid"));

    const agent = buildAgent(execute);

    const request: AgentRequest = {
      agentType: "opportunity",
      query: "Return contract object",
      sessionId: "session-2",
      userId: "user-2",
      organizationId: "org-2",
      context: {
        traceId: "trace-terminal-failure",
        contractVersion: "2.1.0",
      },
    };

    const result = await manager.executeWithRetry(agent, request, {
      maxRetries: 1,
      baseDelay: 0,
      maxDelay: 0,
      jitterFactor: 0,
      retryableErrors: ["Error"],
    });

    expect(result.success).toBe(false);
    expect(result.totalAttempts).toBe(2);
    expect(result.error?.message).toContain("SCHEMA_VALIDATION_FAILED");
    expect(result.error?.retryable).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });
});
