/**
 * GapResolution Widget Unit Tests
 *
 * Tests for missing data items with inline input fields, submit action, and resolved state.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GapResolution } from "../../../sdui/src/components/widgets/GapResolution";

describe("GapResolution", () => {
  const mockGaps = [
    {
      id: "g1",
      fieldName: "confirmed_budget",
      importance: "critical",
      reason: "Need to validate available budget",
      suggestedSource: "Ask economic buyer directly",
      status: "open",
    },
    {
      id: "g2",
      fieldName: "decision_timeline",
      importance: "high",
      reason: "Closing date not specified",
      suggestedSource: "CRM activity notes",
      status: "open",
    },
    {
      id: "g3",
      fieldName: "current_solution_cost",
      importance: "medium",
      reason: "Baseline cost unknown",
      suggestedSource: "Discovery call",
      status: "resolved",
      resolvedValue: "$50,000",
      resolvedAt: "2024-01-15T10:00:00Z",
    },
  ];

  it("should render all gap items", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    expect(screen.getByText("confirmed_budget")).toBeInTheDocument();
    expect(screen.getByText("decision_timeline")).toBeInTheDocument();
    expect(screen.getByText("current_solution_cost")).toBeInTheDocument();
  });

  it("should show importance indicators", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    expect(screen.getByText(/critical/i)).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
    expect(screen.getByText(/medium/i)).toBeInTheDocument();
  });

  it("should expand gap item to show input field", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    const expandButton = screen.getAllByLabelText(/expand gap/i)[0];
    fireEvent.click(expandButton);

    expect(screen.getByPlaceholderText(/enter value/i)).toBeInTheDocument();
    expect(screen.getByText(/suggested source/i)).toBeInTheDocument();
  });

  it("should submit value when form is filled", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GapResolution gaps={mockGaps} caseId="case-1" onSubmit={onSubmit} />);

    const expandButton = screen.getAllByLabelText(/expand gap/i)[0];
    fireEvent.click(expandButton);

    const input = screen.getByPlaceholderText(/enter value/i);
    fireEvent.change(input, { target: { value: "$100,000" } });

    const submitButton = screen.getByText(/submit/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        gapId: "g1",
        value: "$100,000",
        caseId: "case-1",
      });
    });
  });

  it("should show resolved state with value", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    const resolvedGap = screen.getByText("current_solution_cost").closest("[data-testid='gap-item']");
    expect(resolvedGap).toHaveAttribute("data-status", "resolved");
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("should disable submit when input is empty", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    const expandButton = screen.getAllByLabelText(/expand gap/i)[0];
    fireEvent.click(expandButton);

    const submitButton = screen.getByText(/submit/i);
    expect(submitButton).toBeDisabled();
  });

  it("should show loading state during submission", async () => {
    const onSubmit = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<GapResolution gaps={mockGaps} caseId="case-1" onSubmit={onSubmit} />);

    const expandButton = screen.getAllByLabelText(/expand gap/i)[0];
    fireEvent.click(expandButton);

    const input = screen.getByPlaceholderText(/enter value/i);
    fireEvent.change(input, { target: { value: "Test value" } });

    const submitButton = screen.getByText(/submit/i);
    fireEvent.click(submitButton);

    expect(screen.getByText(/submitting/i)).toBeInTheDocument();
  });

  it("should handle empty gaps array", () => {
    render(<GapResolution gaps={[]} caseId="case-1" />);

    expect(screen.getByText(/no data gaps/i)).toBeInTheDocument();
    expect(screen.getByText(/all required data collected/i)).toBeInTheDocument();
  });

  it("should sort by importance (critical first)", () => {
    render(<GapResolution gaps={mockGaps} caseId="case-1" />);

    const gapItems = screen.getAllByTestId("gap-item");
    expect(gapItems[0]).toHaveTextContent(/critical/i);
  });
});
