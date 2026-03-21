import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "./MetricCard";
import type { MetricCardMetric } from "./MetricCard";

const BASE_METRIC: MetricCardMetric = {
  id: "metric-1",
  name: "Days Sales Outstanding (DSO)",
  unit: "days",
  baseline_value: 45,
  target_value: 30,
  impact_timeframe_months: 6,
  measurement_method: "ERP export → average of (invoice_date - payment_date) over 90 days",
};

describe("MetricCard", () => {
  it("renders metric name", () => {
    render(<MetricCard metric={BASE_METRIC} />);
    expect(screen.getByText("Days Sales Outstanding (DSO)")).toBeInTheDocument();
  });

  it("renders baseline and target values formatted for days unit", () => {
    render(<MetricCard metric={BASE_METRIC} />);
    expect(screen.getByText("45 days")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
  });

  it("renders USD values with $ prefix", () => {
    const metric: MetricCardMetric = {
      ...BASE_METRIC,
      unit: "usd",
      baseline_value: 1_500_000,
      target_value: 800_000,
    };
    render(<MetricCard metric={metric} />);
    expect(screen.getByText("$1.5M")).toBeInTheDocument();
    expect(screen.getByText("$800K")).toBeInTheDocument();
  });

  it("renders percent values with % suffix", () => {
    const metric: MetricCardMetric = {
      ...BASE_METRIC,
      unit: "percent",
      baseline_value: 12.5,
      target_value: 8.0,
    };
    render(<MetricCard metric={metric} />);
    expect(screen.getByText("12.5%")).toBeInTheDocument();
    expect(screen.getByText("8.0%")).toBeInTheDocument();
  });

  it("renders impact timeframe", () => {
    render(<MetricCard metric={BASE_METRIC} />);
    expect(screen.getByText(/6/)).toBeInTheDocument();
    expect(screen.getByText(/months/)).toBeInTheDocument();
  });

  it("renders singular 'month' for timeframe of 1", () => {
    render(<MetricCard metric={{ ...BASE_METRIC, impact_timeframe_months: 1 }} />);
    expect(screen.getByText(/1/)).toBeInTheDocument();
    expect(screen.getByText(/month/)).toBeInTheDocument();
  });

  it("renders evidence tier badge for gold tier", () => {
    render(<MetricCard metric={BASE_METRIC} evidenceTier="gold" />);
    const badge = screen.getByTestId("evidence-tier-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Gold");
  });

  it("renders evidence tier badge for platinum tier", () => {
    render(<MetricCard metric={BASE_METRIC} evidenceTier="platinum" />);
    expect(screen.getByTestId("evidence-tier-badge")).toHaveTextContent("Platinum");
  });

  it("renders evidence tier badge for silver tier", () => {
    render(<MetricCard metric={BASE_METRIC} evidenceTier="silver" />);
    expect(screen.getByTestId("evidence-tier-badge")).toHaveTextContent("Silver");
  });

  it("does not render evidence tier badge when evidenceTier is null", () => {
    render(<MetricCard metric={BASE_METRIC} evidenceTier={null} />);
    expect(screen.queryByTestId("evidence-tier-badge")).not.toBeInTheDocument();
  });

  it("renders measurement method truncated with expand button", () => {
    render(<MetricCard metric={BASE_METRIC} />);
    expect(screen.getByText(BASE_METRIC.measurement_method!)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show more/i })).toBeInTheDocument();
  });

  it("expands measurement method on button click", () => {
    render(<MetricCard metric={BASE_METRIC} />);
    const btn = screen.getByRole("button", { name: /show more/i });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /show less/i })).toBeInTheDocument();
  });

  it("renders empty state gracefully when no baseline or target", () => {
    const metric: MetricCardMetric = {
      id: "m2",
      name: "Headcount",
      unit: "headcount",
    };
    render(<MetricCard metric={metric} />);
    expect(screen.getByText("Headcount")).toBeInTheDocument();
    // No baseline/target row rendered
    expect(screen.queryByText("→")).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <MetricCard metric={BASE_METRIC} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
