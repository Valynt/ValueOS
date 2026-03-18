/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { EvidenceGapList } from "../EvidenceGapList";

describe("EvidenceGapList", () => {
  const mockGaps = [
    { id: "gap-1", claimId: "claim-1", field: "Revenue Assumption", currentTier: "tier3" as const, requiredTier: "tier2" as const, suggestedAction: "Validate with customer data", impact: "high" as const },
    { id: "gap-2", claimId: "claim-2", field: "Cost Benchmark", currentTier: "tier3" as const, requiredTier: "tier1" as const, suggestedAction: "Add industry benchmark", impact: "medium" as const },
  ];

  it("renders all evidence gaps", () => {
    render(<EvidenceGapList id="evidence-gap-list" data={{ gaps: mockGaps }} />);

    expect(screen.getByText("Revenue Assumption")).toBeInTheDocument();
    expect(screen.getByText("Cost Benchmark")).toBeInTheDocument();
  });

  it("shows current and required tier for each gap", () => {
    render(<EvidenceGapList id="evidence-gap-list" data={{ gaps: mockGaps }} />);

    // Combined tier labels - use getAllByText for labels that appear multiple times
    const currentTier3 = screen.getAllByText("Current: Tier 3");
    expect(currentTier3.length).toBe(2); // Both gaps have tier3 current

    expect(screen.getByText("Required: Tier 2")).toBeInTheDocument();
    expect(screen.getByText("Required: Tier 1")).toBeInTheDocument();
  });

  it("displays suggested action for each gap", () => {
    render(<EvidenceGapList id="evidence-gap-list" data={{ gaps: mockGaps }} />);

    expect(screen.getByText("Validate with customer data")).toBeInTheDocument();
    expect(screen.getByText("Add industry benchmark")).toBeInTheDocument();
  });

  it("shows impact level with color coding", () => {
    render(<EvidenceGapList id="evidence-gap-list" data={{ gaps: mockGaps }} />);

    expect(screen.getByText("High impact")).toBeInTheDocument();
    expect(screen.getByText("Medium impact")).toBeInTheDocument();
  });

  it("emits action when gap item is clicked", () => {
    const onAction = vi.fn();
    render(
      <EvidenceGapList
        id="evidence-gap-list"
        data={{ gaps: mockGaps }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText("Revenue Assumption"));
    expect(onAction).toHaveBeenCalledWith("select", { gapId: "gap-1" });
  });

  it("renders empty state when no gaps", () => {
    render(<EvidenceGapList id="evidence-gap-list" data={{ gaps: [] }} />);

    expect(screen.getByText("No evidence gaps")).toBeInTheDocument();
  });
});
