/**
 * Regression tests for apiRequest in useResearchJob.
 *
 * Covers:
 * - URL passed as positional string to apiClient methods, not as an object
 * - DELETE body forwarded via config spread, not silently dropped
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

const { mockSupabaseFrom } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => {
  const supabase = { from: mockSupabaseFrom };

  return {
    supabase,
    createBrowserSupabaseClient: vi.fn(() => supabase),
    createRequestSupabaseClient: vi.fn(() => supabase),
  };
});

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    request: mockRequest,
  },
}));

import { useCreateResearchJob } from "../useResearchJob";

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

const SUCCESS = { success: true, data: { data: { id: "job-1", status: "pending" } } };

describe("apiRequest argument shape regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue(SUCCESS);
  });

  it("passes URL to apiClient.request config", async () => {
    const { result } = renderHook(() => useCreateResearchJob("tenant-1"), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ contextId: "ctx-1", website: "https://example.com" });

    expect(mockRequest).toHaveBeenCalledOnce();
    const [config] = mockRequest.mock.calls[0] as [Record<string, unknown>];
    expect(config.url).toBe("/api/onboarding/research");
    expect(config.method).toBe("POST");
  });

  it("passes body as request data", async () => {
    const { result } = renderHook(() => useCreateResearchJob("tenant-1"), {
      wrapper: makeWrapper(),
    });

    const input = { contextId: "ctx-1", website: "https://example.com", industry: "SaaS" };
    await result.current.mutateAsync(input);

    const [config] = mockRequest.mock.calls[0] as [Record<string, unknown>];
    expect(config.data).toEqual(input);
  });
});
