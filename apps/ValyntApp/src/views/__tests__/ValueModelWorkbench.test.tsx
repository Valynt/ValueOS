/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { ValueModelWorkbench } from "../../views/ValueModelWorkbench";

// Mock hooks
vi.mock("@/hooks/useValueModeling", () => ({
  useHypotheses: () => ({
    data: [
      { id: "h1", valueDriver: "Cost Reduction", impactRange: { low: 100000, high: 200000 }, evidenceTier: "tier2", confidenceScore: 0.75, status: "pending" },
    ],
    isLoading: false,
    error: null,
  }),
  useAssumptions: () => ({
    data: [
      { id: "a1", name: "Employee Count", value: 500, unit: "people", source: "customer-confirmed", confidenceScore: 0.9, unsupported: false, plausibility: "plausible", lastModified: "2024-01-01" },
    ],
    isLoading: false,
  }),
  useScenarios: () => ({
    data: [
      { id: "s1", name: "conservative", roi: 120, npv: 500000, paybackMonths: 18, evfDecomposition: { revenueUplift: 200000, costReduction: 150000, riskMitigation: 100000, efficiencyGain: 50000 }, isBase: false },
      { id: "s2", name: "base", roi: 150, npv: 750000, paybackMonths: 12, evfDecomposition: { revenueUplift: 300000, costReduction: 200000, riskMitigation: 150000, efficiencyGain: 100000 }, isBase: true },
    ],
    isLoading: false,
  }),
  useSensitivity: () => ({
    data: {
      caseId: "case-123",
      tornadoData: [{ assumptionId: "a1", assumptionName: "Employee Count", impactPositive: 50000, impactNegative: -30000, leverage: 2.5 }],
      baseScenario: "base",
    },
    isLoading: false,
  }),
  useAcceptHypothesis: () => ({ mutate: vi.fn() }),
  useRejectHypothesis: () => ({ mutate: vi.fn() }),
}));

vi.mock("react-router-dom", () => ({
  useParams: () => ({ caseId: "case-123" }),
}));

describe("ValueModelWorkbench", () => {
  it("renders all tabs", () => {
    render(<ValueModelWorkbench />);

    expect(screen.getByText("Hypotheses")).toBeInTheDocument();
    expect(screen.getByText("Assumptions")).toBeInTheDocument();
    expect(screen.getByText("Scenarios")).toBeInTheDocument();
    expect(screen.getByText("Sensitivity")).toBeInTheDocument();
  });

  it("switches between tabs", () => {
    render(<ValueModelWorkbench />);

    fireEvent.click(screen.getByText("Hypotheses"));
    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Assumptions"));
    expect(screen.getByText("Employee Count")).toBeInTheDocument();
  });

  it("displays hypothesis cards with accept/reject actions", () => {
    render(<ValueModelWorkbench />);

    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows scenario comparison", () => {
    render(<ValueModelWorkbench />);

    fireEvent.click(screen.getByText("Scenarios"));
    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
  });

  it("handles hypothesis acceptance", () => {
    render(<ValueModelWorkbench />);

    fireEvent.click(screen.getByText("Accept"));
    // Mock mutation would be called
  });
});
