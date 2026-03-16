import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from "@/api/client/unified-api-client";
import { useSubscription } from "../useSubscription";

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

// Minimal backend subscription shape that passes BackendSubscriptionSchema
const backendSub = {
  id: "sub_1",
  organization_id: "org_1",
  plan_tier: "standard" as const,
  status: "active",
  current_period_start: "2023-01-01T00:00:00Z",
  current_period_end: "2023-02-01T00:00:00Z",
  cancel_at_period_end: false,
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch subscription on mount", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith("/api/billing/subscription");
    expect(result.current.subscription).toMatchObject({
      id: "sub_1",
      planTier: "pro", // "standard" maps to "pro"
      status: "active",
    });
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch error", async () => {
    mockGet.mockResolvedValue({
      success: false,
      error: { message: "Network error", code: "500" },
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Network error");
    expect(result.current.subscription).toBeNull();
  });

  it("should change plan successfully", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });
    mockPost.mockResolvedValue({ success: true, data: {} });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.changePlan("enterprise");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/billing/plan-change/submit",
      expect.objectContaining({ new_plan_tier: "enterprise" }),
    );
  });

  it("should handle change plan error", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });
    mockPost.mockResolvedValue({
      success: false,
      error: { message: "Failed to upgrade", code: "400" },
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.changePlan("enterprise");
      }),
    ).rejects.toThrow("Failed to upgrade");
  });

  it("should cancel subscription successfully", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });
    mockDelete.mockResolvedValue({ success: true, data: {} });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.cancelSubscription();
    });

    expect(mockDelete).toHaveBeenCalledWith("/api/billing/subscription");
  });
});
