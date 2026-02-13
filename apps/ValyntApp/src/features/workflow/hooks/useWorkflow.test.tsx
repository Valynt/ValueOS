import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflow } from "./useWorkflow";

const mockApi = vi.hoisted(() => ({
  getWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
}));

vi.mock("../../../api/client/unified-api-client", () => ({
  api: mockApi,
}));

describe("useWorkflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("executes workflow through API instead of stub", async () => {
    mockApi.getWorkflow.mockResolvedValue({
      success: true,
      data: {
        data: {
          id: "wf-1",
          steps: [],
          status: "draft",
          updatedAt: new Date().toISOString(),
        },
      },
    });
    mockApi.executeWorkflow.mockResolvedValue({ success: true, data: { runId: "run-1" } });

    const { result } = renderHook(() => useWorkflow());

    await act(async () => {
      await result.current.loadWorkflow("wf-1");
    });

    await act(async () => {
      await result.current.executeWorkflow();
    });

    expect(mockApi.executeWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "wf-1" })
    );

    await waitFor(() => {
      expect(result.current.workflow?.status).toBe("active");
    });
  });
});
