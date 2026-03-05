import { describe, expect, it, vi } from "vitest";

import { DefaultIntegrityVetoService } from "../workflows/IntegrityVetoService";

describe("IntegrityVetoService", () => {
  it("requests re-refine when confidence is below threshold", async () => {
    const service = new DefaultIntegrityVetoService({
      agentAPI: {} as never,
      evaluateClaim: vi.fn(),
      getAverageConfidence: vi.fn().mockResolvedValue(0.2),
      logVeto: vi.fn(),
      invokeRefinement: vi.fn(),
      maxReRefineAttempts: 2,
    });

    const result = await service.evaluateIntegrityVeto({}, { traceId: "t1", agentType: "opportunity" });
    expect(result.reRefine).toBe(true);
    expect(result.vetoed).toBe(false);
  });

  it("retries refinement until accepted", async () => {
    const invokeRefinement = vi
      .fn()
      .mockResolvedValueOnce({ success: true, data: { invalid: true } })
      .mockResolvedValueOnce({ success: true, data: { economic_deltas: [{ metricId: "m1", claimedValue: 100 }] } });

    const service = new DefaultIntegrityVetoService({
      agentAPI: {} as never,
      evaluateClaim: vi.fn().mockResolvedValue({ benchmarkValue: 100 }),
      getAverageConfidence: vi.fn().mockResolvedValue(1),
      logVeto: vi.fn(),
      invokeRefinement,
      maxReRefineAttempts: 2,
    });

    const result = await service.performReRefine("opportunity", "q", { sessionId: "s" }, "trace");
    expect(result.success).toBe(true);
    expect(invokeRefinement).toHaveBeenCalledTimes(2);
  });
});
