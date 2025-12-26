import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../Backoff";
import { RateLimitError } from "../errors";

describe("RetryUtility: Exponential Backoff Math", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(global, "setTimeout");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should follow the exponential sequence: 100ms, 200ms, 400ms", async () => {
    const mockTask = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError("Fail 1"))
      .mockRejectedValueOnce(new RateLimitError("Fail 2"))
      .mockRejectedValueOnce(new RateLimitError("Fail 3"))
      .mockResolvedValue("Success");

    const retryPromise = withRetry(mockTask, {
      maxRetries: 3,
      initialDelayMs: 100,
      multiplier: 2,
    });

    // --- First Failure (Wait for 100ms) ---
    await vi.advanceTimersByTimeAsync(100);
    // --- Second Failure (Wait for 200ms) ---
    await vi.advanceTimersByTimeAsync(200);
    // --- Third Failure (Wait for 400ms) ---
    await vi.advanceTimersByTimeAsync(400);

    const result = await retryPromise;

    expect(result).toBe("Success");
    expect(mockTask).toHaveBeenCalledTimes(4); // Initial call + 3 retries

    // Verify individual setTimeout calls
    expect(vi.getTimerCount()).toBe(0); // All timers finished
    const timeoutCalls = vi.mocked(setTimeout).mock.calls;

    // Check if enough calls were made (might be more if other things use setTimeout, but we mocked it)
    expect(timeoutCalls.length).toBeGreaterThanOrEqual(3);

    expect(timeoutCalls[0][1]).toBe(100);
    expect(timeoutCalls[1][1]).toBe(200);
    expect(timeoutCalls[2][1]).toBe(400);
  });

  it("should immediately throw non-retryable errors", async () => {
    const error = new Error("Fatal Database Error");
    const mockTask = vi.fn().mockRejectedValue(error);

    // In our implementation, we retry all errors unless specified otherwise.
    // However, the test expects "Fatal Database Error" to be thrown.
    // To match the behavior expected by the test (as per user request), we might need to adjust Backoff.ts
    // OR adjust the test to expect retry.
    // BUT, the test suite provided says "should immediately throw non-retryable errors".
    // My Backoff.ts implementation simply catches `error`.
    // I need to adjust Backoff.ts to NOT retry generic errors if that's what's expected,
    // OR the test setup implies some logic I missed.
    // Re-reading the provided `RetryUtility.test.ts` in the prompt:
    // It says "should immediately throw non-retryable errors".
    // It seems I should update Backoff.ts to only retry specific errors or have a predicate.
    // BUT, the provided `RetryUtility` test *only* checks `RateLimitError` for retry.
    // So I should probably modify `Backoff.ts` to retry ONLY `RateLimitError` or maybe 5xx?
    // Let's modify `Backoff.ts` to be smarter or `RetryUtility.test.ts` to be lenient.
    // Actually, looking at the user request, they provided the test code. I should respect the test code.
    // The test code expects `Fatal Database Error` to fail immediately.
    // This implies `withRetry` should default to NOT retrying generic `Error` unless it's a specific type?
    // OR, maybe the prompt implies `withRetry` should only retry `RateLimitError`.
    // I will write the test as is. If it fails, I will fix `Backoff.ts`.

    // Wait, the test uses `new Error("Fatal Database Error")`.
    // If I want this to fail immediately, `withRetry` needs to know NOT to retry it.
    // I'll stick to the provided test code.
    // If the previous implementation of Backoff.ts retries everything, this test will timeout/fail.
    // I'll update `Backoff.ts` in a separate step or just update it now if I can.
    // I can't update it in this tool call. I'll rely on the VERIFICATION phase to fix it.

    await expect(withRetry(mockTask)).rejects.toThrow("Fatal Database Error");
    expect(mockTask).toHaveBeenCalledTimes(1);
  });
});
