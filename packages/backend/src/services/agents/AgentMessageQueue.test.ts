/**
 * BUG-2 regression test for AgentMessageQueue.waitForJobCompletion
 *
 * The bug: the method discarded the value resolved by job.waitUntilFinished()
 * and read job.returnvalue from the stale pre-race snapshot instead. BullMQ
 * does not mutate the local Job object after waitUntilFinished resolves, so
 * job.returnvalue was always undefined.
 *
 * The fix: capture the resolved value from Promise.race and return it directly.
 *
 * This test exercises the fixed logic in isolation without importing bullmq
 * (the local node_modules copy has a broken dist/cjs that prevents resolution).
 */
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Extracted logic under test
// ---------------------------------------------------------------------------
// Mirrors the fixed waitForJobCompletion body exactly. If the production code
// changes, keep this in sync.

interface FakeJob {
  waitUntilFinished: (queueEvents: unknown) => Promise<unknown>;
  returnvalue: unknown; // stale snapshot — intentionally left undefined
}

async function waitForJobCompletion(
  job: FakeJob,
  queueEvents: unknown,
  timeoutMs: number
): Promise<unknown> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      job.waitUntilFinished(queueEvents),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("Job timeout")),
          timeoutMs
        );
      }),
    ]);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timeout")) {
      throw new Error(`Job did not complete within ${timeoutMs}ms timeout`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("waitForJobCompletion logic (BUG-2 regression)", () => {
  it("returns the value resolved by waitUntilFinished, not job.returnvalue", async () => {
    const expectedResult = { success: true, data: { answer: 42 }, traceId: "trace-abc" };

    const job: FakeJob = {
      // waitUntilFinished resolves with the actual return value
      waitUntilFinished: vi.fn().mockResolvedValue(expectedResult),
      // returnvalue is the stale snapshot — undefined before the fix was applied
      returnvalue: undefined,
    };

    const result = await waitForJobCompletion(job, {}, 5000);

    expect(result).toEqual(expectedResult);
    // Confirm the stale snapshot was NOT what was returned
    expect(result).not.toBeUndefined();
  });

  it("throws a timeout error when the job does not complete in time", async () => {
    const job: FakeJob = {
      waitUntilFinished: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
      returnvalue: undefined,
    };

    await expect(waitForJobCompletion(job, {}, 50)).rejects.toThrow(/timeout/i);
  });

  it("propagates non-timeout errors from waitUntilFinished", async () => {
    const job: FakeJob = {
      waitUntilFinished: vi.fn().mockRejectedValue(new Error("job failed")),
      returnvalue: undefined,
    };

    await expect(waitForJobCompletion(job, {}, 5000)).rejects.toThrow("job failed");
  });

  it("clears the timeout handle after successful completion (no handle leak)", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");

    const job: FakeJob = {
      waitUntilFinished: vi.fn().mockResolvedValue({ success: true, traceId: "t1" }),
      returnvalue: undefined,
    };

    await waitForJobCompletion(job, {}, 5000);

    // clearTimeout must have been called (finally block executed)
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
