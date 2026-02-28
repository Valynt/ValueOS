// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../../../api/client/unified-api-client";

import { useWorkflow } from "./useWorkflow";

vi.mock("../../../api/client/unified-api-client", () => ({
  api: {
    getWorkflow: vi.fn(),
    executeWorkflow: vi.fn(),
  },
}));

describe("useWorkflow executeWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executes workflow through API and marks status active", async () => {
    (api.getWorkflow as any).mockResolvedValue({
      success: true,
      data: {
        data: {
          id: "wf-1",
          name: "Workflow",
          status: "draft",
          steps: [],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    });
    (api.executeWorkflow as any).mockResolvedValue({ success: true, data: { executionId: "ex-1" } });

    const { result } = renderHook(() => useWorkflow());

    await act(async () => {
      await result.current.loadWorkflow("wf-1");
    });

    await waitFor(() => {
      expect(result.current.workflow?.id).toBe("wf-1");
    });

    await act(async () => {
      await result.current.executeWorkflow();
    });

    expect(api.executeWorkflow).toHaveBeenCalledWith({ workflowId: "wf-1" });
    expect(result.current.workflow?.status).toBe("active");
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("captures execution errors and marks status failed", async () => {
    (api.getWorkflow as any).mockResolvedValue({
      success: true,
      data: {
        data: {
          id: "wf-2",
          name: "Workflow",
          status: "draft",
          steps: [],
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      },
    });
    (api.executeWorkflow as any).mockResolvedValue({
      success: false,
      error: { message: "engine down" },
    });

    const { result } = renderHook(() => useWorkflow());

    await act(async () => {
      await result.current.loadWorkflow("wf-2");
    });

    await waitFor(() => {
      expect(result.current.workflow?.id).toBe("wf-2");
    });

    await act(async () => {
      await result.current.executeWorkflow();
    });

    expect(result.current.workflow?.status).toBe("failed");
    expect(result.current.error).toBe("engine down");
    expect(result.current.isLoading).toBe(false);
  });
});
