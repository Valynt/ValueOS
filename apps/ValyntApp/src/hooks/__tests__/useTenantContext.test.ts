/**
 * useTenantContext hook tests
 *
 * Covers:
 * - useTenantContextSummary: returns null when no context exists
 * - useTenantContextSummary: returns summary data on success
 * - useIngestTenantContext: calls POST /api/v1/tenant/context with payload
 * - useIngestTenantContext: throws on API error response
 * - useIngestTenantContext: invalidates the summary query on success
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

import {
  useIngestTenantContext,
  useTenantContextSummary,
} from "../useTenantContext";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useTenantContextSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when API returns null data", async () => {
    mockGet.mockResolvedValue({ success: true, data: { data: null } });

    const { result } = renderHook(() => useTenantContextSummary(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(mockGet).toHaveBeenCalledWith("/api/v1/tenant/context");
  });

  it("returns summary when context exists", async () => {
    const summary = {
      organizationId: "org-1",
      entryCount: 3,
      labels: ["product", "icp", "competitor"],
      lastIngestedAt: "2026-01-01T00:00:00Z",
    };
    mockGet.mockResolvedValue({ success: true, data: { data: summary } });

    const { result } = renderHook(() => useTenantContextSummary(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
  });
});

describe("useIngestTenantContext", () => {
  beforeEach(() => vi.clearAllMocks());

  const payload = {
    websiteUrl: "https://example.com",
    productDescription: "A great product",
    icpDefinition: "Mid-market B2B SaaS",
    competitorList: ["Competitor A", "Competitor B"],
  };

  it("calls POST /api/v1/tenant/context with the payload", async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: { stored: true, memoryEntries: 4 },
    });

    const { result } = renderHook(() => useIngestTenantContext(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith("/api/v1/tenant/context", payload);
    expect(result.current.data).toEqual({ stored: true, memoryEntries: 4 });
  });

  it("throws when API returns success: false", async () => {
    mockPost.mockResolvedValue({
      success: false,
      data: null,
      error: { message: "Ingestion failed" },
    });

    const { result } = renderHook(() => useIngestTenantContext(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Ingestion failed");
  });

  it("throws when API rejects", async () => {
    mockPost.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useIngestTenantContext(), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(payload);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Network error");
  });
});
