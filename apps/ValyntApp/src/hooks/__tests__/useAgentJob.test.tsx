/**
 * useAgentJob — unit tests
 *
 * Verifies tenant-scoped cache keys, retrying state, and polling behaviour.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { useAgentJob } from "../useAgentJob";
import type { AgentJobResult } from "../useAgentJob";

// ---------------------------------------------------------------------------
// Mock the API client
// vi.mock is hoisted — use vi.fn() inside the factory, then grab the ref after
// ---------------------------------------------------------------------------

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ currentTenant: { id: "tenant-test" }, tenants: [], isLoading: false })),
}));

// Prevent the browser Supabase client from throwing at module load time when
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are absent in the test env.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  createBrowserSupabaseClient: vi.fn(() => ({ auth: {} })),
}));

// Grab mock references after modules are mocked
import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";
const mockFetchJobStatus = vi.mocked(apiClient.get);
const mockUseTenant = vi.mocked(useTenant);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(overrides: Partial<AgentJobResult> = {}): AgentJobResult {
  return {
    jobId: "job-1",
    status: "processing",
    agentId: "opportunity",
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockFetchJobStatus.mockReset();
  // Default: tenant is available
  mockUseTenant.mockReturnValue({ currentTenant: { id: "tenant-test" }, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentJob", () => {
  describe("tenant-scoped cache key", () => {
    it("does not execute when tenantId is null", () => {
      // Simulate no active tenant — hook should disable the query
      mockUseTenant.mockReturnValue({ currentTenant: null, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
      mockFetchJobStatus.mockResolvedValue({
        success: true,
        data: { data: makeResult({ status: "completed" }) },
      });

      const { result } = renderHook(
        () => useAgentJob("job-1"),
        { wrapper: createWrapper() },
      );

      // Query should be disabled — fetchStatus is 'idle', not 'fetching'
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockFetchJobStatus).not.toHaveBeenCalled();
    });

    it("executes when both jobId and tenantId are provided", async () => {
      mockUseTenant.mockReturnValue({ currentTenant: { id: "tenant-abc" }, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
      mockFetchJobStatus.mockResolvedValue({
        success: true,
        data: { data: makeResult({ status: "completed" }) },
      });

      const { result } = renderHook(
        () => useAgentJob("job-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFetchJobStatus).toHaveBeenCalledTimes(1);
    });

    it("uses separate cache entries for different tenants", async () => {
      const resultA = makeResult({ status: "completed", jobId: "job-1" });
      const resultB = makeResult({ status: "processing", jobId: "job-1" });

      // Pre-populate the cache for each tenant so no network calls are needed.
      // This avoids the race condition where mockUseTenant changes between renders.
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      queryClient.setQueryData(["agent-job", "tenant-A", "job-1"], resultA);
      queryClient.setQueryData(["agent-job", "tenant-B", "job-1"], resultB);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      // hookA reads from tenant-A's cache entry
      mockUseTenant.mockReturnValue({ currentTenant: { id: "tenant-A" }, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
      const { result: hookA } = renderHook(() => useAgentJob("job-1"), { wrapper });

      // hookB reads from tenant-B's cache entry
      mockUseTenant.mockReturnValue({ currentTenant: { id: "tenant-B" }, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
      const { result: hookB } = renderHook(() => useAgentJob("job-1"), { wrapper });

      await waitFor(() => expect(hookA.current.isSuccess).toBe(true));
      await waitFor(() => expect(hookB.current.isSuccess).toBe(true));

      // Different tenants → different cache entries → different results
      expect(hookA.current.data?.status).toBe("completed");
      expect(hookB.current.data?.status).toBe("processing");
    });
  });

  describe("retrying status", () => {
    it("continues polling when status is retrying", async () => {
      // First call returns retrying, second returns completed
      mockFetchJobStatus
        .mockResolvedValueOnce({
          success: true,
          data: {
            data: makeResult({
              status: "retrying",
              attemptsMade: 1,
              nextRetryAt: new Date(Date.now() + 30000).toISOString(),
            }),
          },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { data: makeResult({ status: "completed" }) },
        });

      const { result } = renderHook(
        () => useAgentJob("job-1"),
        { wrapper: createWrapper() },
      );

      // First result: retrying
      await waitFor(() => expect(result.current.data?.status).toBe("retrying"));
      expect(result.current.data?.attemptsMade).toBe(1);
      expect(result.current.data?.nextRetryAt).toBeDefined();

      // Polling continues — eventually reaches completed
      await waitFor(() => expect(result.current.data?.status).toBe("completed"), {
        timeout: 5000,
      });
    });

    it("stops polling on terminal statuses", async () => {
      mockFetchJobStatus.mockResolvedValue({
        success: true,
        data: { data: makeResult({ status: "completed" }) },
      });

      const { result } = renderHook(
        () => useAgentJob("job-1"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.data?.status).toBe("completed"));

      const callCount = mockFetchJobStatus.mock.calls.length;
      // Wait a polling interval — no additional calls should occur
      await new Promise((r) => setTimeout(r, 2500));
      expect(mockFetchJobStatus.mock.calls.length).toBe(callCount);
    });
  });

  describe("direct-mode result", () => {
    it("returns directResult immediately without fetching", () => {
      const direct = makeResult({ status: "completed", mode: "direct" });

      const { result } = renderHook(
        () => useAgentJob("job-1", direct),
        { wrapper: createWrapper() },
      );

      // Should resolve synchronously from the pre-resolved value
      expect(result.current.data).toEqual(direct);
      expect(mockFetchJobStatus).not.toHaveBeenCalled();
    });
  });
});
