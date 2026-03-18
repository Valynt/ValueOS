import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Define mocks with vi.hoisted() BEFORE importing the hook (required for proper mock hoisting)
const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  },
}));

import { useSubscription } from "../useSubscription";

// Minimal backend subscription shape that passes BackendSubscriptionSchema
const backendSub = {
  id: "sub_1",
  stripe_subscription_id: "stripe_sub_1",
  customer_id: "cust_1",
  organization_id: "org_1",
  plan_tier: "standard" as const,
  status: "active",
  current_period_start: "2023-01-01T00:00:00Z",
  current_period_end: "2023-02-01T00:00:00Z",
  cancel_at_period_end: false,
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
}

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch subscription on mount", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    // Wait for data to be populated instead of checking isLoading
    await waitFor(() => expect(result.current.subscription).not.toBeNull(), {
      timeout: 5000,
      interval: 100,
    });

    expect(mockGet).toHaveBeenCalledWith("/api/billing/subscription");
    expect(result.current.subscription).toMatchObject({
      id: "sub_1",
      planTier: "standard",
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

    // Wait for error state - check multiple times with longer timeout
    await waitFor(() => {
      console.log("Current state:", {
        error: result.current.error,
        errorType: typeof result.current.error,
        isError: result.current.error instanceof Error,
        subscription: result.current.subscription
      });
      return result.current.error !== null;
    }, { timeout: 5000 });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe("Network error");
    expect(result.current.subscription).toBeNull();
  });

  it("should change plan successfully", async () => {
    mockGet.mockResolvedValue({ success: true, data: backendSub });
    mockPost.mockResolvedValue({ success: true, data: {} });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.subscription).not.toBeNull());

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
    await waitFor(() => expect(result.current.subscription).not.toBeNull());

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
    await waitFor(() => expect(result.current.subscription).not.toBeNull());

    await act(async () => {
      await result.current.cancelSubscription();
    });

    expect(mockDelete).toHaveBeenCalledWith("/api/billing/subscription");
  });
});
