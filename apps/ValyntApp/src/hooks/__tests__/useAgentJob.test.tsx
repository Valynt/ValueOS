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

// Grab the mock reference after the module is mocked
import { apiClient } from "@/api/client/unified-api-client";
const mockFetchJobStatus = vi.mocked(apiClient.get);

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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAgentJob", () => {
  describe("tenant-scoped cache key", () => {
    it("does not execute when tenantId is null", () => {
      mockFetchJobStatus.mockResolvedValue({
        success: true,
        data: { data: makeResult({ status: "completed" }) },
      });

      const { result } = renderHook(
        () => useAgentJob("job-1", null, null),
        { wrapper: createWrapper() },
      );

      // Query should be disabled — fetchStatus is 'idle', not 'fetching'
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockFetchJobStatus).not.toHaveBeenCalled();
    });

    it("executes when both jobId and tenantId are provided", async () => {
      mockFetchJobStatus.mockResolvedValue({
        success: true,
        data: { data: makeResult({ status: "completed" }) },
      });

      const { result } = renderHook(
        () => useAgentJob("job-1", null, "tenant-abc"),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockFetchJobStatus).toHaveBeenCalledTimes(1);
    });

    it("uses separate cache entries for different tenants", async () => {
      const resultA = makeResult({ status: "completed", jobId: "job-1" });
      const resultB = makeResult({ status: "processing", jobId: "job-1" });

      mockFetchJobStatus
        .mockResolvedValueOnce({ success: true, data: { data: resultA } })
        .mockResolvedValueOnce({ success: true, data: { data: resultB } });

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result: hookA } = renderHook(
        () => useAgentJob("job-1", null, "tenant-A"),
        { wrapper },
      );
      const { result: hookB } = renderHook(
        () => useAgentJob("job-1", null, "tenant-B"),
        { wrapper },
      );

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
        () => useAgentJob("job-1", null, "tenant-abc"),
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
        () => useAgentJob("job-1", null, "tenant-abc"),
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
        () => useAgentJob("job-1", direct, "tenant-abc"),
        { wrapper: createWrapper() },
      );

      // Should resolve synchronously from the pre-resolved value
      expect(result.current.data).toEqual(direct);
      expect(mockFetchJobStatus).not.toHaveBeenCalled();
    });
  });
});
