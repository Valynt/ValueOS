/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { DealAssemblyWorkspace } from "../../views/DealAssemblyWorkspace";

// Mock CanvasHost to render widget content directly
vi.mock("@/components/canvas/CanvasHost", () => ({
  CanvasHost: ({ widgets }: { widgets: any[] }) => (
    <div data-testid="canvas-host">
      {widgets?.map((widget: any) => (
        <div key={widget.id} data-testid={`widget-${widget.id}`}>
          {widget.componentType === "stakeholder-map" && widget.props?.stakeholders && (
            <div>
              {widget.props.stakeholders.map((s: any) => (
                <div key={s.id}>
                  <span>{s.name}</span>
                  <span>{s.role}</span>
                </div>
              ))}
            </div>
          )}
          {widget.componentType === "gap-resolution" && widget.props?.gaps && (
            <div>
              {widget.props.gaps.map((g: any) => (
                <div key={g.id}>
                  <span>{g.field}</span>
                  <span>{g.description}</span>
                  {g.value && <span>{g.value}</span>}
                  {!g.resolved && (
                    <input placeholder={`Enter ${g.field.toLowerCase()}...`} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  ),
}));

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
    expect(screen.getByText(/1 of 2 gaps resolved/i)).toBeInTheDocument();
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

  it("shows the primary workflow actions for unresolved gaps", () => {
    render(<DealAssemblyWorkspace />);

    const input = screen.getByPlaceholderText(/enter budget/i);
    fireEvent.change(input, { target: { value: "100000" } });

    expect(screen.getByRole("button", { name: /re-assemble/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm & proceed/i })).toBeDisabled();
  });
});
