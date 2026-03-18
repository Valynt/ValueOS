/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";


import { KPITargetCard } from "../KPITargetCard";

describe("KPITargetCard", () => {
  const mockKPIs = [
    { id: "kpi-1", metricName: "Cost Reduction", baseline: 100000, target: 150000, unit: "USD", timeline: { startDate: "2024-01-01", targetDate: "2024-12-31" }, source: "customer-confirmed", progress: 45 },
    { id: "kpi-2", metricName: "Efficiency Gain", baseline: 80, target: 95, unit: "%", timeline: { startDate: "2024-01-01", targetDate: "2024-06-30" }, source: "benchmark-derived", progress: 60 },
  ];

  it("renders all KPI cards", () => {
    render(<KPITargetCard id="kpi-target-card" data={{ kpiTargets: mockKPIs }} />);

    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
    expect(screen.getByText("Efficiency Gain")).toBeInTheDocument();
  });

  it("displays baseline to target range", () => {
    render(<KPITargetCard id="kpi-target-card" data={{ kpiTargets: mockKPIs }} />);

    expect(screen.getByText("$100,000")).toBeInTheDocument();
    expect(screen.getByText("$150,000")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("shows source badge for each KPI", () => {
    render(<KPITargetCard id="kpi-target-card" data={{ kpiTargets: mockKPIs }} />);

    expect(screen.getByText("Customer Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Derived")).toBeInTheDocument();
  });

  it("displays progress indicator", () => {
    render(<KPITargetCard id="kpi-target-card" data={{ kpiTargets: mockKPIs }} />);

    expect(screen.getByText("45%")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("shows timeline dates", () => {
    render(<KPITargetCard id="kpi-target-card" data={{ kpiTargets: mockKPIs }} />);

    expect(screen.getByText("Dec 31, 2024")).toBeInTheDocument();
  });
});
