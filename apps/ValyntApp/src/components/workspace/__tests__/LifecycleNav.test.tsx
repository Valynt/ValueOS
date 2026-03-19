/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";


import { LifecycleNav } from "../LifecycleNav";

const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ caseId: "test-case-123" }),
  useLocation: () => ({ pathname: "/workspace/test-case-123/model" }),
}));

describe("LifecycleNav", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders all 5 lifecycle stages", () => {
    render(<LifecycleNav />);

    expect(screen.getByText("Assembly")).toBeInTheDocument();
    expect(screen.getByText("Modeling")).toBeInTheDocument();
    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Outputs")).toBeInTheDocument();
    expect(screen.getByText("Realization")).toBeInTheDocument();
  });

  it("highlights active stage based on URL", () => {
    render(<LifecycleNav />);

    const modelingButton = screen.getByText("Modeling").closest("button");
    expect(modelingButton).toHaveAttribute("aria-current", "step");
  });

  it("shows checkmark for completed stages", () => {
    render(<LifecycleNav completedStages={["assembly"]} />);

    const assemblyButton = screen.getByText("Assembly").closest("button");
    expect(assemblyButton?.querySelector("svg")).toBeInTheDocument();
  });

  it("shows lock icon for locked stages", () => {
    render(<LifecycleNav lockedStages={["realization"]} />);

    const realizationButton = screen.getByText("Realization").closest("button");
    expect(realizationButton).toHaveAttribute("aria-disabled", "true");
    expect(realizationButton?.querySelector("svg")).toBeInTheDocument();
  });

  it("disables click on locked stages", () => {
    render(<LifecycleNav lockedStages={["integrity"]} />);

    const integrityButton = screen.getByText("Integrity").closest("button");
    fireEvent.click(integrityButton!);

    // Locked stages shouldn't navigate
    expect(integrityButton).toHaveAttribute("aria-disabled", "true");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates when clicking unlocked stage", () => {
    render(<LifecycleNav />);

    const outputsButton = screen.getByText("Outputs").closest("button");
    fireEvent.click(outputsButton!);

    expect(mockNavigate).toHaveBeenCalledWith("/workspace/test-case-123/outputs");
  });

  it("displays case status when provided", () => {
    render(<LifecycleNav caseStatus="presentation-ready" />);

    expect(screen.getByText("Case status:")).toBeInTheDocument();
    expect(screen.getByText("presentation ready")).toBeInTheDocument();
  });

  it("has correct aria-label for navigation", () => {
    render(<LifecycleNav />);

    expect(screen.getByLabelText("Case lifecycle")).toBeInTheDocument();
  });

  it("applies correct styling for blocked status", () => {
    render(<LifecycleNav caseStatus="blocked" />);

    const statusBadge = screen.getByText("blocked");
    expect(statusBadge.className).toContain("bg-red-100");
  });
});
