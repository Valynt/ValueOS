import { describe, expect, it, vi } from "vitest";

import { DelegatingWorkflowRunner } from "../workflows/WorkflowRunner";

describe("DelegatingWorkflowRunner", () => {
  it("delegates dag and stage execution calls", async () => {
    const executeDAGAsync = vi.fn().mockResolvedValue(undefined);
    const executeStageWithRetry = vi.fn().mockResolvedValue({ status: "completed", output: { ok: true } });
    const executeStage = vi.fn().mockResolvedValue({ stage_id: "s1" });

    const runner = new DelegatingWorkflowRunner({
      executeDAGAsync,
      executeStageWithRetry,
      executeStage,
    });

    await runner.executeDAGAsync("e1", "org", { stages: [], transitions: [], initial_stage: "s1", final_stages: ["s1"] } as never, { organizationId: "org" }, "trace-1");
    const retryResult = await runner.executeStageWithRetry("e1", { id: "s1" } as never, { organizationId: "org" }, { selected_agent: { id: "a1" } }, "trace-1");
    await runner.executeStage({ id: "s1" } as never, { organizationId: "org" }, { selected_agent: { id: "a1" } });

    expect(executeDAGAsync).toHaveBeenCalled();
    expect(executeStageWithRetry).toHaveBeenCalled();
    expect(executeStage).toHaveBeenCalled();
    expect(retryResult.status).toBe("completed");
  });
});
