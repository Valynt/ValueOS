/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HypothesisCard } from "../HypothesisCard";
import { ToastProvider } from "@/components/common/Toast";

// Test wrapper with ToastProvider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("HypothesisCard", () => {
  const mockHypothesis = {
    id: "hyp-1",
    valueDriver: "Cost Reduction",
    impactRange: { low: 100000, high: 250000 },
    evidenceTier: "tier2" as const,
    confidenceScore: 0.75,
    status: "pending" as const,
    benchmarkReference: { source: "Industry Data", p25: 50000, p50: 150000, p75: 300000 },
  };

  it("renders value driver and impact range", () => {
    render(<HypothesisCard id="hypothesis-card" data={{ hypotheses: [mockHypothesis] }} />, { wrapper: TestWrapper });

    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getByText("$250,000")).toBeInTheDocument();
  });

  it("displays confidence badge", () => {
    render(<HypothesisCard id="hypothesis-card" data={{ hypotheses: [mockHypothesis] }} />, { wrapper: TestWrapper });

    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("emits accept action when Accept clicked", () => {
    const onAction = vi.fn();
    render(
      <HypothesisCard
        id="hypothesis-card"
        data={{ hypotheses: [mockHypothesis] }}
        onAction={onAction}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByText("Accept"));
    expect(onAction).toHaveBeenCalledWith("accept", { hypothesisId: "hyp-1" });
  });

  it("emits reject action when Reject clicked", () => {
    const onAction = vi.fn();
    render(
      <HypothesisCard
        id="hypothesis-card"
        data={{ hypotheses: [mockHypothesis] }}
        onAction={onAction}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByText("Reject"));
    expect(onAction).toHaveBeenCalledWith("reject", { hypothesisId: "hyp-1" });
  });

  it("emits edit action when Edit clicked", () => {
    const onAction = vi.fn();
    render(
      <HypothesisCard
        id="hypothesis-card"
        data={{ hypotheses: [mockHypothesis] }}
        onAction={onAction}
      />,
      { wrapper: TestWrapper }
    );

    fireEvent.click(screen.getByText("Edit"));
    expect(onAction).toHaveBeenCalledWith("edit", { hypothesisId: "hyp-1" });
  });

  it("shows benchmark context when available", () => {
    render(<HypothesisCard id="hypothesis-card" data={{ hypotheses: [mockHypothesis] }} />, { wrapper: TestWrapper });

    expect(screen.getByText("Industry Data")).toBeInTheDocument();
  });

  it("shows status badge for accepted hypotheses", () => {
    const acceptedHypothesis = { ...mockHypothesis, status: "accepted" as const };
    render(<HypothesisCard id="hypothesis-card" data={{ hypotheses: [acceptedHypothesis] }} />, { wrapper: TestWrapper });

    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });
});
