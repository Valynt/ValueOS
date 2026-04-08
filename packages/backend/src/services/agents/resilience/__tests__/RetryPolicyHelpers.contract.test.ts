import { describe, expect, it } from "vitest";

import { calculateRetryDelay } from "../RetryDelayCalculator.js";
import { shouldRetryForError } from "../RetryPolicyResolver.js";

describe("agent retry helper contracts", () => {
  it("calculates fixed delay strategy without jitter", () => {
    const delay = calculateRetryDelay(
      3,
      {
        maxRetries: 3,
        strategy: "fixed_delay",
        baseDelay: 250,
        maxDelay: 2000,
        backoffMultiplier: 2,
        jitterFactor: 0,
        retryableErrors: [],
        nonRetryableErrors: [],
        fallbackAgents: [],
        fallbackStrategy: "sequential",
        attemptTimeout: 1000,
        overallTimeout: 5000,
      },
      () => 0.9
    );

    expect(delay).toBe(250);
  });

  it("matches retryability contract", () => {
    expect(
      shouldRetryForError(
        {
          type: "NetworkError",
          message: "temporary network timeout",
          retryable: true,
          severity: "medium",
          timestamp: new Date(),
        },
        {
          maxRetries: 2,
          strategy: "exponential_backoff",
          baseDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
          jitterFactor: 0,
          retryableErrors: ["NetworkError"],
          nonRetryableErrors: [],
          fallbackAgents: [],
          fallbackStrategy: "sequential",
          attemptTimeout: 1000,
          overallTimeout: 5000,
        },
        0
      )
    ).toBe(true);
  });
});
