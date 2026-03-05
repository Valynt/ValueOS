import { describe, expect, it, vi } from "vitest";

import { WorkflowExecutionStore } from "../workflows/WorkflowExecutionStore";

describe("WorkflowExecutionStore tenant isolation", () => {
  it("applies organization_id filter in status query", async () => {
    const eq = vi.fn();
    const builder = {
      eq,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    eq.mockReturnValue(builder);
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(builder),
      }),
    } as never;

    const store = new WorkflowExecutionStore(supabase);
    await store.getExecutionStatus("exec-1", "org-1");

    expect(eq).toHaveBeenCalledWith("organization_id", "org-1");
  });

  it("applies organization_id filter when updating execution status", async () => {
    const eq = vi.fn();
    const builder = { eq };
    eq.mockReturnValue(builder);
    const supabase = {
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(builder) }),
    } as never;

    const store = new WorkflowExecutionStore(supabase);
    await store.updateExecutionStatus({
      executionId: "exec",
      organizationId: "org",
      status: "failed",
      currentStage: null,
    });

    expect(eq).toHaveBeenCalledWith("organization_id", "org");
  });
});
