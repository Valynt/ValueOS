/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { RealizationTracker } from "../../views/RealizationTracker";

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

    expect(screen.getByText(/base/i)).toBeInTheDocument();
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument();
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

    expect(screen.getByText("Assumptions")).toBeInTheDocument();
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
