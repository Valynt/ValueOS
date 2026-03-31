/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { RealizationTracker } from "../../views/RealizationTracker";

vi.mock("@/components/canvas/CanvasHost", () => ({
  CanvasHost: ({
    widgets,
  }: {
    widgets: Array<{ id: string; componentType: string; props?: Record<string, unknown> }>;
  }) => (
    <div data-testid="canvas-host">
      {widgets?.map((widget) => {
        if (widget.componentType === "kpi-target-card") {
          const targets = (widget.props?.targets as Array<Record<string, unknown>> | undefined) ?? [];
          return (
            <div key={widget.id}>
              {targets.map((target) => (
                <div key={String(target.id)}>
                  <span>{String(target.metricName)}</span>
                  <span>${Number(target.baseline).toLocaleString()}</span>
                  <span>${Number(target.target).toLocaleString()}</span>
                  <span>{String(target.progress)}%</span>
                </div>
              ))}
            </div>
          );
        }

        if (widget.componentType === "checkpoint-timeline") {
          const checkpoints =
            (widget.props?.checkpoints as Array<Record<string, unknown>> | undefined) ?? [];
          return (
            <div key={widget.id}>
              {checkpoints.map((checkpoint) => (
                <div key={String(checkpoint.id)}>
                  <span>
                    {new Date(`${String(checkpoint.date)}T00:00:00`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span>
                    {String(checkpoint.status).charAt(0).toUpperCase() +
                      String(checkpoint.status).slice(1)}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return <div key={widget.id}>{widget.componentType}</div>;
      })}
    </div>
  ),
}));

// Mock hooks
vi.mock("@/hooks/useRealization", () => ({
  useBaseline: () => ({
    data: {
      caseId: "case-123",
      scenarioName: "base",
      approvalDate: "2024-01-15",
      version: "v1.0",
      kpiTargets: [
        { id: "kpi-1", metricName: "Cost Reduction", baseline: 100000, target: 150000, unit: "USD", timeline: { startDate: "2024-01-01", targetDate: "2024-12-31" }, source: "customer-confirmed", progress: 45 },
      ],
      assumptions: [{ id: "a1", name: "Employee Count", value: 500, unit: "people", source: "customer-confirmed" }],
      handoffNotes: {
        dealContext: "Enterprise SaaS deal",
        buyerPriorities: "Cost optimization",
        implementationAssumptions: "6-month rollout",
        keyRisks: "Adoption challenges",
      },
    },
    isLoading: false,
  }),
  useCheckpoints: () => ({
    data: [
      { id: "cp-1", date: "2024-03-01", expectedRange: { min: 100000, max: 120000 }, actualValue: 110000, status: "measured" },
    ],
    isLoading: false,
  }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ caseId: "case-123" }),
}));

describe("RealizationTracker", () => {
  it("renders baseline header", () => {
    render(<RealizationTracker />);

    expect(screen.getByText("Baseline Scenario")).toBeInTheDocument();
    expect(screen.getByText(/^base$/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
  });

  it("displays KPI target cards", () => {
    render(<RealizationTracker />);

    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getByText("$150,000")).toBeInTheDocument();
  });

  it("shows checkpoint timeline", () => {
    render(<RealizationTracker />);

    expect(screen.getByText(/mar 1, 2024/i)).toBeInTheDocument();
    expect(screen.getByText("Measured")).toBeInTheDocument();
  });

  it("displays carried-forward assumptions", () => {
    render(<RealizationTracker />);

    expect(screen.getByText("Baseline Assumptions")).toBeInTheDocument();
    expect(screen.getByText("Employee Count")).toBeInTheDocument();
  });

  it("shows handoff notes sections", () => {
    render(<RealizationTracker />);

    expect(screen.getByText("Deal Context")).toBeInTheDocument();
    expect(screen.getByText("Enterprise SaaS deal")).toBeInTheDocument();
    expect(screen.getByText("Buyer Priorities")).toBeInTheDocument();
    expect(screen.getByText("Cost optimization")).toBeInTheDocument();
  });

  it("renders progress indicators for KPIs", () => {
    render(<RealizationTracker />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });
});
