/**
 * useAgentJob — unit tests
 *
 * Verifies tenant-scoped cache keys, retrying state, polling behaviour,
 * and explicit retry/resume mutations.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentJob } from "../useAgentJob";
import type { AgentJobResult } from "../useAgentJob";

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({ currentTenant: { id: "tenant-test" }, tenants: [], isLoading: false })),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  createBrowserSupabaseClient: vi.fn(() => ({ auth: {} })),
}));

import { apiClient } from "@/api/client/unified-api-client";
import { useTenant } from "@/contexts/TenantContext";

const mockFetchJobStatus = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);
const mockUseTenant = vi.mocked(useTenant);

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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockFetchJobStatus.mockReset();
  mockPost.mockReset();
  window.localStorage.clear();
  mockUseTenant.mockReturnValue({ currentTenant: { id: "tenant-test" }, tenants: [], isLoading: false } as ReturnType<typeof useTenant>);
});

describe("useAgentJob", () => {
  it("continues polling when status is retrying", async () => {
    mockFetchJobStatus
      .mockResolvedValueOnce({ success: true, data: { data: makeResult({ status: "retrying", attemptsMade: 1 }) } })
      .mockResolvedValueOnce({ success: true, data: { data: makeResult({ status: "completed" }) } });

    const { result } = renderHook(() => useAgentJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe("retrying"));
    await waitFor(() => expect(result.current.data?.status).toBe("completed"), { timeout: 5000 });
  });

  it("persists and surfaces last known good output during transient outage", async () => {
    mockFetchJobStatus
      .mockResolvedValueOnce({
        success: true,
        data: { data: makeResult({ status: "completed", result: { artifactId: "a-1" }, completedAt: "2026-03-27T10:00:00.000Z" }) },
      })
      .mockResolvedValueOnce({
        success: false,
        error: { message: "503 unavailable" },
      } as never);

    const { result, rerender } = renderHook(() => useAgentJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe("completed"));
    await act(async () => {
      await result.current.refetch();
    });
    rerender();

    await waitFor(() => expect(result.current.data?.status).toBe("unavailable"));
    expect(result.current.data?.lastKnownGoodOutput).toEqual({ artifactId: "a-1" });
  });

  it("sends idempotency-safe payload when manually retrying", async () => {
    mockFetchJobStatus.mockResolvedValue({ success: true, data: { data: makeResult({ status: "failed" }) } });
    mockPost.mockResolvedValue({ success: true, data: { data: makeResult({ status: "queued" }) } });

    const { result } = renderHook(() => useAgentJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.retryRun.mutateAsync();
    });

    expect(mockPost).toHaveBeenCalledWith("/api/agents/jobs/job-1/retry", {
      idempotency_key: "tenant-test:job-1:manual-retry",
    });
  });

  it("resumes polling with idempotency-safe payload", async () => {
    mockFetchJobStatus.mockResolvedValue({ success: true, data: { data: makeResult({ status: "unavailable" }) } });
    mockPost.mockResolvedValue({ success: true, data: { data: makeResult({ status: "processing" }) } });

    const { result } = renderHook(() => useAgentJob("job-1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.resumePolling.mutateAsync();
    });

    expect(mockPost).toHaveBeenCalledWith("/api/agents/jobs/job-1/resume", {
      idempotency_key: "tenant-test:job-1:resume-polling",
    });
  });
});
