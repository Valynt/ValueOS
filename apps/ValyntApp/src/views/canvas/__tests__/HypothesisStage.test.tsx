/**
 * HypothesisStage — debounce tests
 *
 * Verifies that rapid double-clicks on "Run Stage" result in exactly one
 * mutation call, preventing duplicate BullMQ job enqueues.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { HypothesisStage } from "../HypothesisStage";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mutateFn = vi.fn();

vi.mock("@/hooks/useHypothesis", () => ({
  useHypothesisOutput: () => ({
    data: { hypotheses: [] },
    isLoading: false,
    isError: false,
  }),
  useRunHypothesisAgent: () => ({
    mutate: mutateFn,
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock("@/contexts/CompanyContextProvider", () => ({
  useCompanyValueContext: () => ({
    companyContext: { context: { company_name: "Acme Corp" } },
    isReady: false,
    onboardingStatus: "pending",
  }),
}));

vi.mock("@/hooks/useDomainPacks", () => ({
  useHardenAllKPIs: () => ({ mutate: vi.fn(), isPending: false }),
  useHardenKPI: () => ({ mutate: vi.fn(), isPending: false }),
  useMergedContext: () => ({ data: null, isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HypothesisStage — Run Stage debounce", () => {
  beforeEach(() => {
    mutateFn.mockReset();
  });

  function getRunStageButton() {
    // Multiple elements may contain "Run Stage" text — find the button element
    const buttons = screen
      .getAllByText(/run stage/i)
      .map((el) => el.closest("button"))
      .filter((el): el is HTMLButtonElement => el !== null);
    expect(buttons.length).toBeGreaterThan(0);
    return buttons[0]!;
  }

  it("calls mutate exactly once on a single click", () => {
    render(<HypothesisStage />, { wrapper });
    fireEvent.click(getRunStageButton());
    expect(mutateFn).toHaveBeenCalledTimes(1);
  });

  it("does not enqueue a second job on rapid double-click", () => {
    render(<HypothesisStage />, { wrapper });
    const btn = getRunStageButton();

    // Simulate two rapid clicks before isPending becomes true
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(mutateFn).toHaveBeenCalledTimes(1);
  });

  it("button is not disabled initially", () => {
    render(<HypothesisStage />, { wrapper });
    expect(getRunStageButton()).not.toBeDisabled();
  });
});
