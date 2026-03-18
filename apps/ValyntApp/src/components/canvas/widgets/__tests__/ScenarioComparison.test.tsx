/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";


import { ScenarioComparison } from "../ScenarioComparison";

describe("ScenarioComparison", () => {
  const mockScenarios = [
    { id: "s1", name: "conservative" as const, roi: 120, npv: 500000, paybackMonths: 18, evfDecomposition: { revenueUplift: 200000, costReduction: 150000, riskMitigation: 100000, efficiencyGain: 50000 }, isBase: false },
    { id: "s2", name: "base" as const, roi: 150, npv: 750000, paybackMonths: 12, evfDecomposition: { revenueUplift: 300000, costReduction: 200000, riskMitigation: 150000, efficiencyGain: 100000 }, isBase: true },
    { id: "s3", name: "upside" as const, roi: 200, npv: 1000000, paybackMonths: 9, evfDecomposition: { revenueUplift: 400000, costReduction: 250000, riskMitigation: 200000, efficiencyGain: 150000 }, isBase: false },
  ];

  it("renders all three scenarios in columns", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    expect(screen.getByText("Conservative")).toBeInTheDocument();
    expect(screen.getByText("Base")).toBeInTheDocument();
    expect(screen.getByText("Upside")).toBeInTheDocument();
  });

  it("emphasizes base scenario", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    const baseColumn = screen.getByText("Base").closest("div");
    expect(baseColumn?.className).toContain("border-primary");
  });

  it("displays ROI for each scenario", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    expect(screen.getByText("120%")).toBeInTheDocument();
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByText("200%")).toBeInTheDocument();
  });

  it("displays NPV for each scenario", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    expect(screen.getByText("$500,000")).toBeInTheDocument();
    expect(screen.getByText("$750,000")).toBeInTheDocument();
    expect(screen.getByText("$1,000,000")).toBeInTheDocument();
  });

  it("shows payback period for each scenario", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    expect(screen.getByText("18 months")).toBeInTheDocument();
    expect(screen.getByText("12 months")).toBeInTheDocument();
    expect(screen.getByText("9 months")).toBeInTheDocument();
  });

  it("displays EVF decomposition", () => {
    render(<ScenarioComparison id="scenario-comparison" data={{ scenarios: mockScenarios }} />);

    expect(screen.getByText("Revenue Uplift")).toBeInTheDocument();
    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("Risk Mitigation")).toBeInTheDocument();
    expect(screen.getByText("Efficiency Gain")).toBeInTheDocument();
  });
});
