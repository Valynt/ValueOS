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

const { BackendSubscriptionSchema } = vi.hoisted(() => {
  // Stub the schema to pass through data without validation
  return {
    BackendSubscriptionSchema: { parse: (v: unknown) => v as any },
  };
});

vi.mock("@valueos/shared", () => ({
  BackendSubscriptionSchema,
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
    await waitFor(() => {
      console.log("Mount test state:", {
        subscription: result.current.subscription,
        error: result.current.error,
        isLoading: result.current.isLoading,
      });
      return result.current.subscription !== null;
    }, {
      timeout: 5000,
      interval: 100,
    });

    console.log("Final subscription:", result.current.subscription);

    expect(mockGet).toHaveBeenCalledWith("/api/billing/subscription");
    expect(result.current.subscription).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch error", async () => {
    mockGet.mockImplementation(() => {
      console.log("mockGet called");
      return Promise.resolve({
        success: false,
        error: { message: "Network error", code: "500" },
      });
    });

    const { result } = renderHook(() => useSubscription(), { wrapper: createWrapper() });

    // Wait for loading to finish first
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });

    // Now check error state
    console.log("After loading:", { error: result.current.error, subscription: result.current.subscription });

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
