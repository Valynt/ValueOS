import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { useCrossGraphPatterns } from "./useCrossGraphPatterns";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useCrossGraphPatterns", () => {
  it("does not mutate the original caseIds order", async () => {
    const caseIds = ["case-3", "case-1", "case-2"];
    const originalOrder = [...caseIds];

    const { result } = renderHook(() => useCrossGraphPatterns(caseIds), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(caseIds).toEqual(originalOrder);
  });
});
