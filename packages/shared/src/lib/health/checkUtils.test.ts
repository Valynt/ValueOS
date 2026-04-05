import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitState,
  checkDockerService,
  commandExists,
  runCommand,
} from "./checkUtils.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should start in CLOSED state and execute operation successfully", async () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    const result = await breaker.execute(async () => "success");
    expect(result).toBe("success");
    expect(breaker.getFailureCount()).toBe(0);
  });

  it("should record failures and transition to OPEN state when threshold is reached", async () => {
    const breaker = new CircuitBreaker(3, 10000, 60000); // threshold=3, timeout=10s, monitor=60s
    const errorOperation = async () => {
      throw new Error("fail");
    };

    // First failure
    await expect(breaker.execute(errorOperation)).rejects.toThrow("fail");
    expect(breaker.getFailureCount()).toBe(1);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Second failure
    await expect(breaker.execute(errorOperation)).rejects.toThrow("fail");
    expect(breaker.getFailureCount()).toBe(2);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);

    // Third failure (Threshold reached)
    const timeBeforeThirdFail = Date.now();
    await expect(breaker.execute(errorOperation)).rejects.toThrow("fail");
    expect(breaker.getFailureCount()).toBe(3);
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getLastFailureTime()).toBeGreaterThanOrEqual(timeBeforeThirdFail);
    expect(breaker.getNextAttemptTime()).toBe(breaker.getLastFailureTime() + 10000);
  });

  it("should skip operation and return null when OPEN", async () => {
    const breaker = new CircuitBreaker(2, 10000, 60000);
    breaker.recordFailure();
    breaker.recordFailure(); // Transitions to OPEN

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    let executed = false;
    const result = await breaker.execute(async () => {
      executed = true;
      return "skipped";
    });

    expect(result).toBeNull();
    expect(executed).toBe(false);
  });

  it("should transition to HALF_OPEN after recovery timeout and allow one attempt", async () => {
    const breaker = new CircuitBreaker(2, 10000, 60000);
    breaker.recordFailure();
    breaker.recordFailure(); // Transitions to OPEN

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Advance time past the recovery timeout
    vi.advanceTimersByTime(10001);

    // Execute operation, which should now transition to HALF_OPEN and run the operation
    const result = await breaker.execute(async () => "recovered");

    // Success in HALF_OPEN resets the circuit
    expect(result).toBe("recovered");
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
  });

  it("should transition back to OPEN if operation fails in HALF_OPEN state", async () => {
    const breaker = new CircuitBreaker(2, 10000, 60000);
    breaker.recordFailure();
    breaker.recordFailure(); // Transitions to OPEN

    // Advance time past the recovery timeout
    vi.advanceTimersByTime(10001);

    // Operation fails again
    const errorOperation = async () => {
      throw new Error("fail again");
    };
    await expect(breaker.execute(errorOperation)).rejects.toThrow("fail again");

    // State should revert to OPEN
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    // Failure count still increments
    expect(breaker.getFailureCount()).toBe(3);
  });

  it("should reset failure count if monitoring period has passed since last failure", async () => {
    const breaker = new CircuitBreaker(3, 10000, 60000); // Monitor period is 60s
    const errorOperation = async () => {
      throw new Error("fail");
    };

    // First failure
    await expect(breaker.execute(errorOperation)).rejects.toThrow("fail");
    expect(breaker.getFailureCount()).toBe(1);

    // Advance time past monitoring period
    vi.advanceTimersByTime(60001);

    // Next execution should reset the previous failure count
    const result = await breaker.execute(async () => "success");
    expect(result).toBe("success");
    expect(breaker.getFailureCount()).toBe(0);
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it("should explicitly reset all states when reset() is called", () => {
    const breaker = new CircuitBreaker(2, 10000, 60000);
    breaker.recordFailure();
    breaker.recordFailure(); // Transitions to OPEN

    expect(breaker.getState()).toBe(CircuitState.OPEN);
    expect(breaker.getFailureCount()).toBe(2);

    breaker.reset();

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
    expect(breaker.getFailureCount()).toBe(0);
    expect(breaker.getLastFailureTime()).toBe(0);
    expect(breaker.getNextAttemptTime()).toBe(0);
  });
});

describe("command execution hardening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid docker service names containing shell metacharacters", () => {
    const result = checkDockerService("api;rm -rf /", "/tmp");

    expect(result.healthy).toBe(false);
    expect(result.message).toBe("invalid service name");
  });

  it("commandExists rejects command payloads containing shell metacharacters", () => {
    expect(commandExists("docker;echo pwned")).toBe(false);
  });

  it("runCommand rejects non-allowlisted commands", () => {
    expect(() => runCommand({ cmd: "cat", args: ["/etc/passwd"] })).toThrow(
      "Command 'cat' is not allowed"
    );
  });

  it("runCommand rejects command payloads containing shell metacharacters", () => {
    expect(() => runCommand({ cmd: "docker;echo", args: ["ps"] })).toThrow(
      "Invalid command token"
    );
  });

  it("runCommand rejects argument payloads containing shell metacharacters", () => {
    expect(() => runCommand({ cmd: "docker", args: ["compose", "ps;echo"] })).toThrow(
      "Invalid command arguments"
    );
  });
});
