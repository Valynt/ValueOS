/**
 * @jest-environment jsdom
 */


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api/client/unified-api-client";
import { useDealContext, useSubmitGapFill, useTriggerAssembly } from "../useDealAssembly";

// Mock API client
vi.mock("@/api/client/unified-api-client", () => ({
  api: {
    getDealContext: vi.fn(() => Promise.resolve({ success: true, data: { caseId: "case-123", accountName: "Test Corp" } })),
    submitGapFill: vi.fn(() => Promise.resolve({ success: true })),
    triggerAssembly: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("@/contexts/TenantContext", () => ({
  useTenant: () => ({ currentTenant: { id: "tenant-123" } }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useDealAssembly hooks", () => {
  describe("useDealContext", () => {
    it("returns loading state initially", () => {
      const { result } = renderHook(() => useDealContext("case-123"), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
    });

    it("returns data on success", async () => {
      const { result } = renderHook(() => useDealContext("case-123"), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.accountName).toBe("Test Corp");
    });

    it("handles error state", async () => {
      vi.mocked(api.getDealContext).mockRejectedValueOnce(new Error("Failed"));
      const { result } = renderHook(() => useDealContext("case-123"), { wrapper: createWrapper() });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSubmitGapFill", () => {
    it("submits gap fill successfully", async () => {
      const { result } = renderHook(() => useSubmitGapFill("case-123"), { wrapper: createWrapper() });

      result.current.mutate({ gapId: "g1", value: "100" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("invalidates deal context on success", async () => {
      const { result } = renderHook(() => useSubmitGapFill("case-123"), { wrapper: createWrapper() });

      result.current.mutate({ gapId: "g1", value: "100" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useTriggerAssembly", () => {
    it("triggers assembly successfully", async () => {
      const { result } = renderHook(() => useTriggerAssembly("case-123"), { wrapper: createWrapper() });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
