import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentType } from "../../agent-types.js";
import type { RetryAttempt, RetryResult } from "./AgentRetryTypes.js";
import { AgentRetryManager } from "./AgentRetryManager.js";

interface RetryManagerInternals {
  retryHistory: Map<string, RetryResult[]>;
}

function createAttempt(params: {
  attempt: number;
  agentType: AgentType;
  success: boolean;
  duration?: number;
  startTime: Date;
  errorType?: string;
}): RetryAttempt {
  return {
    attempt: params.attempt,
    agentType: params.agentType,
    success: params.success,
    duration: params.duration,
    startTime: params.startTime,
    endTime: new Date(params.startTime.getTime() + (params.duration ?? 0)),
    delay: 0,
    error: params.errorType
      ? {
          type: params.errorType,
          message: params.errorType,
          retryable: true,
          severity: "medium",
          timestamp: params.startTime,
        }
      : undefined,
  };
}

function createResult(params: {
  requestId: string;
  attempts: RetryAttempt[];
  success: boolean;
  fallbackUsed: boolean;
}): RetryResult {
  return {
    requestId: params.requestId,
    success: params.success,
    totalAttempts: params.attempts.length,
    attempts: params.attempts,
    totalDuration: params.attempts.reduce((sum, attempt) => sum + (attempt.duration ?? 0), 0),
    fallbackUsed: params.fallbackUsed,
    strategy: "exponential_backoff",
    statistics: {
      avgAttemptDuration: 0,
      totalRetryDelay: 0,
      successRateByAttempt: {},
      errorDistribution: {},
      agentPerformance: {} as RetryResult["statistics"]["agentPerformance"],
    },
  };
}

describe("AgentRetryManager.getRetryStatistics", () => {
  const manager = AgentRetryManager.getInstance();

  beforeEach(() => {
    manager.reset();
  });

  it("aggregates agent stats from one pass accumulators", () => {
    const internals = manager as unknown as RetryManagerInternals;
    const baseTime = new Date("2026-01-01T00:00:00.000Z");

    const history: RetryResult[] = [
      createResult({
        requestId: "r1",
        success: true,
        fallbackUsed: false,
        attempts: [
          createAttempt({
            attempt: 1,
            agentType: "opportunity",
            success: false,
            duration: 10,
            startTime: baseTime,
            errorType: "timeout",
          }),
          createAttempt({
            attempt: 2,
            agentType: "opportunity",
            success: true,
            duration: 40,
            startTime: new Date(baseTime.getTime() + 20),
          }),
        ],
      }),
      createResult({
        requestId: "r2",
        success: true,
        fallbackUsed: true,
        attempts: [
          createAttempt({
            attempt: 1,
            agentType: "target",
            success: true,
            duration: 30,
            startTime: new Date(baseTime.getTime() + 50),
          }),
        ],
      }),
      createResult({
        requestId: "r3",
        success: false,
        fallbackUsed: true,
        attempts: [
          createAttempt({
            attempt: 1,
            agentType: "target",
            success: false,
            duration: 15,
            startTime: new Date(baseTime.getTime() + 100),
            errorType: "rate_limit",
          }),
        ],
      }),
    ];

    internals.retryHistory = new Map([["session-1", history]]);

    const statistics = manager.getRetryStatistics();

    expect(statistics.totalRetries).toBe(3);
    expect(statistics.successRate).toBeCloseTo(2 / 3);
    expect(statistics.avgAttempts).toBeCloseTo(4 / 3);
    expect(statistics.fallbackUsageRate).toBeCloseTo(2 / 3);

    expect(statistics.agentPerformance.opportunity).toEqual({
      attempts: 2,
      successes: 1,
      successRate: 0.5,
      avgDuration: 40,
    });

    expect(statistics.agentPerformance.target).toEqual({
      attempts: 2,
      successes: 1,
      successRate: 0.5,
      avgDuration: 30,
    });

    expect(statistics.errorDistribution).toEqual({
      timeout: 1,
      rate_limit: 1,
    });
  });

  it("handles large retry histories without using flatMap", () => {
    const internals = manager as unknown as RetryManagerInternals;
    const baseTime = new Date("2026-02-01T00:00:00.000Z");

    const history: RetryResult[] = [];
    for (let i = 0; i < 1200; i++) {
      const startTime = new Date(baseTime.getTime() + i * 1000);
      history.push(
        createResult({
          requestId: `request-${i}`,
          success: i % 3 !== 0,
          fallbackUsed: i % 4 === 0,
          attempts: [
            createAttempt({
              attempt: 1,
              agentType: i % 2 === 0 ? "opportunity" : "target",
              success: i % 3 !== 0,
              duration: 20 + (i % 5),
              startTime,
              errorType: i % 3 === 0 ? "transient" : undefined,
            }),
            createAttempt({
              attempt: 2,
              agentType: "opportunity",
              success: true,
              duration: 35,
              startTime: new Date(startTime.getTime() + 20),
            }),
          ],
        })
      );
    }

    internals.retryHistory = new Map([["session-large", history]]);
    const flatMapSpy = vi.spyOn(Array.prototype, "flatMap");

    const statistics = manager.getRetryStatistics();

    expect(flatMapSpy).not.toHaveBeenCalled();
    expect(statistics.totalRetries).toBe(1200);
    expect(statistics.avgAttempts).toBe(2);
    expect(statistics.agentPerformance.opportunity.attempts).toBe(1800);
    expect(statistics.agentPerformance.target.attempts).toBe(600);
    expect(statistics.errorDistribution.transient).toBe(400);

    flatMapSpy.mockRestore();
  });
});

describe("AgentRetryManager.executeContractAwareRetry", () => {
  const manager = AgentRetryManager.getInstance();

  beforeEach(() => {
    manager.reset();
  });

  it("retries parse/schema failures and returns approved output", async () => {
    const generator = vi
      .fn<({ prompt }: { prompt: string; attempt: number }) => Promise<string>>()
      .mockResolvedValueOnce("not-json")
      .mockResolvedValueOnce('{"fixed": true}');

    const validate = vi
      .fn<
        (
          rawOutput: string,
          payload: { outputSchema: unknown; originalSchema: unknown }
        ) => Promise<{ approved: boolean; output?: { fixed: boolean }; failureType?: "parse" }>
      >()
      .mockResolvedValueOnce({
        approved: false,
        failureType: "parse",
        details: "JSON parse error",
      })
      .mockResolvedValueOnce({
        approved: true,
        output: { fixed: true },
      });

    const result = await manager.executeContractAwareRetry({
      generator,
      complianceEngine: { validate },
      outputSchema: { type: "object", properties: { fixed: { type: "boolean" } } },
      initialPrompt: "Generate output",
      agentPolicy: { maxRetries: 2 },
    });

    expect(result.approved).toBe(true);
    expect(result.output).toEqual({ fixed: true });
    expect(result.retryCount).toBe(1);
    expect(generator).toHaveBeenCalledTimes(2);
    expect(generator.mock.calls[1]?.[0].prompt).toContain("Violations to fix");
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("returns terminal non-retryable error for business-rule failures", async () => {
    const generator = vi.fn().mockResolvedValue('{"confidence": 0.95}');
    const validate = vi.fn().mockResolvedValue({
      approved: false,
      failureType: "business_rule",
      details: "High confidence output requires evidence references.",
      violations: [{ path: "evidence", message: "Missing supporting evidence" }],
    });

    const result = await manager.executeContractAwareRetry({
      generator,
      complianceEngine: { validate },
      outputSchema: { type: "object" },
      initialPrompt: "Generate output",
      agentPolicy: { maxRetries: 3 },
    });

    expect(result.approved).toBe(false);
    expect(result.error?.code).toBe("BUSINESS_RULE_VALIDATION_FAILED");
    expect(result.error?.retryable).toBe(false);
    expect(generator).toHaveBeenCalledTimes(1);
  });
});
