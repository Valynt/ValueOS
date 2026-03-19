/**
 * @jest-environment jsdom
 */


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { api } from "@/api/client/unified-api-client";

import { useUpdateAssumption } from "../useValueModeling";

// Mock API client
vi.mock("@/api/client/unified-api-client", () => ({
  api: {
    updateAssumption: vi.fn(() => Promise.resolve({ success: true, data: { id: "a1", value: 600 } })),
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

describe("useValueModeling mutation hooks", () => {
  describe("useUpdateAssumption", () => {
    it("performs optimistic update", async () => {
      const { result } = renderHook(() => useUpdateAssumption(), { wrapper: createWrapper() });

      result.current.mutate({
        caseId: "case-123",
        assumptionId: "a1",
        input: { value: 600, reason: "Updated based on new data" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("invalidates dependent queries on success", async () => {
      const { result } = renderHook(() => useUpdateAssumption(), { wrapper: createWrapper() });

      result.current.mutate({
        caseId: "case-123",
        assumptionId: "a1",
        input: { value: 600, reason: "Test update" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("rolls back on error", async () => {
      vi.mocked(api.updateAssumption).mockRejectedValueOnce(new Error("Update failed"));
      const { result } = renderHook(() => useUpdateAssumption(), { wrapper: createWrapper() });

      result.current.mutate({
        caseId: "case-123",
        assumptionId: "a1",
        input: { value: 600, reason: "Test" },
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
