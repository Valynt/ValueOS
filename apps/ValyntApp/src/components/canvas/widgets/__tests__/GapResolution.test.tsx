/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { GapResolution } from "../GapResolution";

describe("GapResolution", () => {
  const mockGaps = [
    { id: "gap-1", field: "Company Size", description: "Number of employees", required: true, resolved: false },
    { id: "gap-2", field: "Industry", description: "Primary industry sector", required: true, resolved: true, value: "Technology" },
    { id: "gap-3", field: "Budget", description: "Annual budget range", required: false, resolved: false },
  ];

  it("renders all gaps", () => {
    render(<GapResolution id="gap-resolution" data={{ gaps: mockGaps, caseId: "case-123" }} />);

    expect(screen.getByText("Company Size")).toBeInTheDocument();
    expect(screen.getByText("Industry")).toBeInTheDocument();
    expect(screen.getByText("Budget")).toBeInTheDocument();
  });

  it("shows inline input for unresolved gaps", () => {
    render(<GapResolution id="gap-resolution" data={{ gaps: mockGaps, caseId: "case-123" }} />);

    const input = screen.getByPlaceholderText("Enter Company Size...");
    expect(input).toBeInTheDocument();
  });

  it("marks resolved gaps with checkmark", () => {
    render(<GapResolution id="gap-resolution" data={{ gaps: mockGaps, caseId: "case-123" }} />);

    expect(screen.getByText("Technology")).toBeInTheDocument();
  });

  it("emits submit action with gap value", () => {
    const onAction = vi.fn();
    render(
      <GapResolution
        id="gap-resolution"
        data={{ gaps: mockGaps, caseId: "case-123" }}
        onAction={onAction}
      />
    );

    const input = screen.getByPlaceholderText("Enter Company Size...");
    fireEvent.change(input, { target: { value: "500" } });

    const submitButton = screen.getAllByText("Submit")[0];
    fireEvent.click(submitButton);

    expect(onAction).toHaveBeenCalledWith("submitGap", { gapId: "gap-1", value: "500" });
  });

  it("shows required indicator for required gaps", () => {
    render(<GapResolution id="gap-resolution" data={{ gaps: mockGaps, caseId: "case-123" }} />);

    const requiredBadges = screen.getAllByText("Required");
    expect(requiredBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("renders empty state when no gaps", () => {
    render(<GapResolution id="gap-resolution" data={{ gaps: [], caseId: "case-123" }} />);

    expect(screen.getByText("No data gaps")).toBeInTheDocument();
  });
});
