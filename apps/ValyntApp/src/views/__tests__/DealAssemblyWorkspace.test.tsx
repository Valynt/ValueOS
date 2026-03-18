/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { DealAssemblyWorkspace } from "../../views/DealAssemblyWorkspace";

// Mock hooks
vi.mock("@/hooks/useDealAssembly", () => ({
  useDealContext: () => ({
    data: {
      caseId: "case-123",
      accountName: "Acme Corp",
      industry: "Technology",
      companySize: "500",
      stakeholders: [
        { id: "s1", name: "John Doe", role: "Decision Maker", priority: "high", source: "CRM-derived" },
      ],
      useCases: [{ id: "u1", name: "Cost Optimization", description: "Reduce cloud costs", valueDrivers: ["efficiency"] }],
      gaps: [
        { id: "g1", field: "Budget", description: "Annual budget", required: true, resolved: false },
        { id: "g2", field: "Timeline", description: "Implementation timeline", required: true, resolved: true, value: "6 months" },
      ],
      assemblyStatus: "review",
      sources: [{ type: "CRM", id: "crm-1", timestamp: "2024-01-01" }],
    },
    isLoading: false,
    error: null,
  }),
  useSubmitGapFill: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useTriggerAssembly: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ caseId: "case-123" }),
  useNavigate: () => vi.fn(),
}));

describe("DealAssemblyWorkspace", () => {
  it("renders deal context data", () => {
    render(<DealAssemblyWorkspace />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Technology")).toBeInTheDocument();
  });

  it("displays stakeholder map", () => {
    render(<DealAssemblyWorkspace />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Decision Maker")).toBeInTheDocument();
  });

  it("shows gap resolution widget", () => {
    render(<DealAssemblyWorkspace />);

    expect(screen.getByText("Budget")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();
    expect(screen.getByText("6 months")).toBeInTheDocument();
  });

  it("displays assembly status", () => {
    render(<DealAssemblyWorkspace />);

    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });

  it("handles gap fill submission", () => {
    render(<DealAssemblyWorkspace />);

    const input = screen.getByPlaceholderText(/budget/i);
    fireEvent.change(input, { target: { value: "100000" } });

    fireEvent.click(screen.getByText(/submit/i));
    // Mock mutation would be called
  });
});
