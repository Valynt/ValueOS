import { beforeEach, describe, expect, it } from "vitest";
import { LLMCircuitBreaker } from "../CircuitBreaker";
import { CircuitBreakerError } from "../errors";

describe("LLMGateway: Circuit Breaker Reliability", () => {
  let circuitBreaker: LLMCircuitBreaker;

  beforeEach(() => {
    // Use a fresh instance to avoid state pollution between tests
    circuitBreaker = new LLMCircuitBreaker();
  });

  it("should transition to OPEN state when failure rate exceeds 5% after 20+ requests", async () => {
    const TOTAL_REQUESTS = 100;
    const FAILURE_RATE = 0.06; // 6% failure rate

    // The previous implementation used exact count which might be tricky with "fail every 16th", so let's stick to the logic.
    // 100 requests. 6 failures.
    // 100 * 0.06 = 6.
    // If we fail every 16th request starting from index 16 (0-indexed?):
    // 16, 32, 48, 64, 80, 96. That's 6 failures.

    const successFn = async () => "success";
    const failFn = async () => {
      throw new Error("Upstream Failure");
    };

    // Simulate 100 requests
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      try {
        // Fail every ~16th request to reach 6 failures in 100
        if (i > 0 && i % 16 === 0) {
          await circuitBreaker.execute(failFn);
        } else {
          await circuitBreaker.execute(successFn);
        }
      } catch (e) {
        // Expected failures
      }
    }

    // At this point, failure rate is 6/100 (6%), exceeding the 5% threshold.
    // The next request should immediately throw CircuitBreakerError without executing the function.
    let functionExecuted = false;
    const probeFn = async () => {
      functionExecuted = true;
      return "should-not-run";
    };

    await expect(circuitBreaker.execute(probeFn)).rejects.toThrow(
      CircuitBreakerError
    );
    expect(functionExecuted).toBe(false);
  });

  it("should remain CLOSED if failure rate is exactly 5% (boundary condition)", async () => {
    const circuit = new LLMCircuitBreaker();

    // 1 failure in 20 requests = 5.0%
    // 19 success, 1 failure.
    for (let i = 0; i < 19; i++) await circuit.execute(async () => "ok");
    try {
      await circuit.execute(async () => {
        throw new Error();
      });
    } catch {}

    // Should still allow execution
    const result = await circuit.execute(async () => "still-closed");
    expect(result).toBe("still-closed");
  });
});
