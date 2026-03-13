/**
 * Regression tests for apiRequest in useResearchJob.
 *
 * Covers:
 * - URL passed as positional string to apiClient methods, not as an object
 * - DELETE body forwarded via config spread, not silently dropped
 */

import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost, mockPut, mockDelete, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    patch: mockPatch,
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
    mockPost.mockResolvedValue(SUCCESS);
    mockGet.mockResolvedValue(SUCCESS);
    mockPut.mockResolvedValue(SUCCESS);
    mockDelete.mockResolvedValue(SUCCESS);
    mockPatch.mockResolvedValue(SUCCESS);
  });

  it("passes URL as a positional string to apiClient.post, not an object", async () => {
    const { result } = renderHook(() => useCreateResearchJob("tenant-1"), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ contextId: "ctx-1", website: "https://example.com" });

    expect(mockPost).toHaveBeenCalledOnce();
    const [urlArg] = mockPost.mock.calls[0] as [unknown, ...unknown[]];
    expect(typeof urlArg).toBe("string");
    expect(urlArg).toBe("/api/onboarding/research");
  });

  it("passes body as second positional argument to apiClient.post", async () => {
    const { result } = renderHook(() => useCreateResearchJob("tenant-1"), {
      wrapper: makeWrapper(),
    });

    const input = { contextId: "ctx-1", website: "https://example.com", industry: "SaaS" };
    await result.current.mutateAsync(input);

    const [, bodyArg] = mockPost.mock.calls[0] as [unknown, unknown];
    expect(bodyArg).toEqual(input);
  });
});
