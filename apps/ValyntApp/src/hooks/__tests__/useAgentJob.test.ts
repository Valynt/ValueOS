/**
 * useAgentJob — P0 multi-tenant cache isolation tests
 *
 * Covers:
 * - Query key includes tenantId (cache is tenant-scoped)
 * - Tenant A's job is not accessible under Tenant B's query key
 * - Hook is disabled when tenantId is null (no network request fires)
 * - Polling stops when job reaches a terminal status
 * - Query is disabled when jobId is null
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — hoisted so vi.mock factory can reference them
// ---------------------------------------------------------------------------

const { mockGet, mockUseTenant } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUseTenant: vi.fn(),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { get: mockGet },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: mockUseTenant,
}));

import { useAgentJob } from "../useAgentJob";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenantInfo(id: string) {
  return {
    id,
    name: `Tenant ${id}`,
    slug: id,
    color: "#000000",
    role: "admin",
    status: "active" as const,
    createdAt: new Date().toISOString(),
  };
}

function makeTenant(id: string) {
  return {
    currentTenant: id ? makeTenantInfo(id) : null,
    tenants: id ? [makeTenantInfo(id)] : [],
    isLoading: false,
    error: null,
    isApiEnabled: true,
    switchTenant: vi.fn(),
    refreshTenants: vi.fn(),
    validateTenantAccess: vi.fn(() => true),
    getTenantById: vi.fn(),
  };
}

function makeWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeJobResponse(jobId: string, status = "processing") {
  return {
    success: true,
    data: { data: { jobId, status, agentId: "opportunity" } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentJob — multi-tenant cache isolation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
      },
    });
  });

  it("fetches job status when jobId and tenantId are both present", async () => {
    mockUseTenant.mockReturnValue(makeTenant("tenant-A"));
    mockGet.mockResolvedValueOnce(makeJobResponse("job-1"));

    const { result } = renderHook(() => useAgentJob("job-1"), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith("/api/agents/jobs/job-1");
    expect(result.current.data?.jobId).toBe("job-1");
  });

  it("does not fetch when tenantId is null", async () => {
    // makeTenant("") produces currentTenant: null (empty id → null branch)
    mockUseTenant.mockReturnValue(makeTenant(""));

    const { result } = renderHook(() => useAgentJob("job-2"), {
      wrapper: makeWrapper(queryClient),
    });

    // Hook should be disabled — no fetch, no data
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("does not fetch when jobId is null", async () => {
    mockUseTenant.mockReturnValue(makeTenant("tenant-A"));

    const { result } = renderHook(() => useAgentJob(null), {
      wrapper: makeWrapper(queryClient),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("Tenant B cannot read Tenant A's cached job result", async () => {
    // Tenant A fetches job-3 and gets a completed result.
    mockUseTenant.mockReturnValue(makeTenant("tenant-A"));
    mockGet.mockResolvedValueOnce(makeJobResponse("job-3", "completed"));

    const { result: resultA } = renderHook(() => useAgentJob("job-3"), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(resultA.current.isSuccess).toBe(true));
    expect(resultA.current.data?.jobId).toBe("job-3");
    expect(resultA.current.data?.status).toBe("completed");

    // Switch to Tenant B — same queryClient, same jobId.
    // Tenant B's own fetch returns a *different* status so we can distinguish
    // "served Tenant A's cached value" from "fetched Tenant B's own value".
    mockUseTenant.mockReturnValue(makeTenant("tenant-B"));
    mockGet.mockResolvedValueOnce(makeJobResponse("job-3", "processing"));

    const { result: resultB } = renderHook(() => useAgentJob("job-3"), {
      wrapper: makeWrapper(queryClient),
    });

    // Tenant B's query key ["agent-job", "tenant-B", "job-3", undefined] is a
    // cache miss, so a new fetch fires and returns Tenant B's own data.
    await waitFor(() => expect(resultB.current.isSuccess).toBe(true));

    // If cache bleed occurred, resultB would show "completed" (Tenant A's value).
    // The correct result is "processing" — Tenant B's own fetched value.
    expect(resultB.current.data?.status).toBe("processing");
    expect(resultB.current.data?.status).not.toBe("completed");

    // Confirm the two entries live under distinct keys in the cache.
    const cacheKeys = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    const tenantAKey = cacheKeys.find(
      (k) => Array.isArray(k) && k[1] === "tenant-A" && k[2] === "job-3",
    );
    const tenantBKey = cacheKeys.find(
      (k) => Array.isArray(k) && k[1] === "tenant-B" && k[2] === "job-3",
    );
    expect(tenantAKey).toBeDefined();
    expect(tenantBKey).toBeDefined();
    expect(tenantAKey).not.toEqual(tenantBKey);
  });

  it("stops polling when job reaches a terminal status", async () => {
    mockUseTenant.mockReturnValue(makeTenant("tenant-A"));
    mockGet
      .mockResolvedValueOnce(makeJobResponse("job-4", "processing"))
      .mockResolvedValueOnce(makeJobResponse("job-4", "completed"));

    const { result } = renderHook(() => useAgentJob("job-4"), {
      wrapper: makeWrapper(queryClient),
    });

    // First fetch: processing
    await waitFor(() => expect(result.current.data?.status).toBe("processing"));

    // Wait for polling interval (2000ms) plus buffer
    await act(async () => {
      await new Promise((r) => setTimeout(r, 2100));
    });

    // Second fetch: completed — polling should stop
    await waitFor(() => expect(result.current.data?.status).toBe("completed"));

    // No further fetches should occur — call count must not increase after terminal state
    const callCountAfterTerminal = mockGet.mock.calls.length;
    // Give React Query one tick to potentially schedule another refetch
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(mockGet.mock.calls.length).toBe(callCountAfterTerminal);
  });

  it("returns direct result immediately without fetching when provided", async () => {
    mockUseTenant.mockReturnValue(makeTenant("tenant-A"));

    const directResult = {
      jobId: "job-direct",
      status: "completed" as const,
      mode: "direct" as const,
      result: "Immediate answer",
    };

    const { result } = renderHook(() => useAgentJob("job-direct", directResult), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobId).toBe("job-direct");
    expect(result.current.data?.result).toBe("Immediate answer");
    // No network call for direct mode
    expect(mockGet).not.toHaveBeenCalled();
  });
});
