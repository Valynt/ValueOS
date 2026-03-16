import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSubscription } from "../useSubscription";
import { api } from "../../../../api/client/unified-api-client";

// Mock the unified api client
vi.mock("../../../../api/client/unified-api-client", () => ({
  api: {
    getSubscription: vi.fn(),
    changePlan: vi.fn(),
    cancelSubscription: vi.fn(),
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useSubscription", () => {
  const mockSubscription = {
    id: "sub_1",
    userId: "user_1",
    planTier: "pro",
    status: "active",
    currentPeriodStart: "2023-01-01T00:00:00Z",
    currentPeriodEnd: "2023-02-01T00:00:00Z",
    cancelAtPeriodEnd: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch subscription on mount", async () => {
    (api.getSubscription as any).mockResolvedValue({
      success: true,
      data: mockSubscription,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(api.getSubscription).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toEqual(mockSubscription);
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch error", async () => {
    (api.getSubscription as any).mockResolvedValue({
      success: false,
      error: { message: "Network error" },
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("Network error");
    expect(result.current.subscription).toBeNull();
  });

  it("should change plan successfully", async () => {
    (api.getSubscription as any).mockResolvedValue({
      success: true,
      data: mockSubscription,
    });

    const updatedSubscription = { ...mockSubscription, planTier: "enterprise" };
    (api.changePlan as any).mockResolvedValue({
      success: true,
      data: updatedSubscription,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.changePlan("enterprise");
    });

    expect(api.changePlan).toHaveBeenCalledWith("enterprise");
    expect(result.current.subscription).toEqual(updatedSubscription);
    expect(result.current.error).toBeNull();
  });

  it("should handle change plan error", async () => {
    (api.getSubscription as any).mockResolvedValue({
      success: true,
      data: mockSubscription,
    });

    (api.changePlan as any).mockResolvedValue({
      success: false,
      error: { message: "Failed to upgrade" },
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.changePlan("enterprise");
    });

    expect(result.current.error).toBe("Failed to upgrade");
    // Subscription should remain unchanged
    expect(result.current.subscription).toEqual(mockSubscription);
  });

  it("should cancel subscription successfully", async () => {
    (api.getSubscription as any).mockResolvedValue({
      success: true,
      data: mockSubscription,
    });

    const canceledSubscription = { ...mockSubscription, cancelAtPeriodEnd: true };
    (api.cancelSubscription as any).mockResolvedValue({
      success: true,
      data: canceledSubscription,
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.cancelSubscription();
    });

    expect(api.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(result.current.subscription).toEqual(canceledSubscription);
  });
});
