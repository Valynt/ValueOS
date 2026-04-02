/**
 * useAgentJob integration behavior tests for degraded recovery.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentJob } from "../useAgentJob";

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: vi.fn(() => ({
    currentTenant: { id: "tenant-test" },
    tenants: [],
    isLoading: false,
  })),
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

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useAgentJob integration recovery", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    window.localStorage.clear();
  });

  it("restores processing via resume after transient 503 outage", async () => {
    mockGet
      .mockResolvedValueOnce({
        success: true,
        data: {
          data: {
            jobId: "job-reload",
            status: "processing",
          },
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: { message: "503 unavailable" },
      } as never)
      .mockResolvedValue({
        success: true,
        data: {
          data: {
            jobId: "job-reload",
            status: "processing",
          },
        },
      });

    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        data: {
          jobId: "job-reload",
          status: "processing",
        },
      },
    });

    const { result } = renderHook(() => useAgentJob("job-reload"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data?.status).toBe("processing"));

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.status).toBe("unavailable"));

    await act(async () => {
      await result.current.resumePolling.mutateAsync();
    });

    expect(mockPost).toHaveBeenCalledWith("/api/agents/jobs/job-reload/resume", {
      idempotency_key: "tenant-test:job-reload:resume-polling",
    });
  });

  it("allows manual retry after a failed run", async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        data: {
          jobId: "job-retry",
          status: "failed",
        },
      },
    });

    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        data: {
          jobId: "job-retry",
          status: "queued",
        },
      },
    });

    const { result } = renderHook(() => useAgentJob("job-retry"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data?.status).toBe("failed"));

    await act(async () => {
      await result.current.retryRun.mutateAsync();
    });

    expect(mockPost).toHaveBeenCalledWith("/api/agents/jobs/job-retry/retry", {
      idempotency_key: "tenant-test:job-retry:manual-retry",
    });
  });
});
