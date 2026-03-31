/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReadinessGauge } from "../ReadinessGauge";

describe("ReadinessGauge", () => {
  const mockReadinessData = {
    compositeScore: 0.82,
    status: "presentation-ready" as const,
    blockers: [],
    components: {
      validationRate: { name: "Validation Rate", score: 0.85, weight: 0.3 },
      grounding: { name: "Grounding", score: 0.78, weight: 0.3 },
      benchmarkCoverage: { name: "Benchmark Coverage", score: 0.9, weight: 0.2 },
      unsupportedCount: { name: "Unsupported", score: 0.75, weight: 0.2 },
    },
    confidenceDistribution: { high: 5, medium: 3, low: 2 },
  };

  it("renders circular gauge with composite score percentage", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("82%")).toBeInTheDocument();
  });

  it("displays 'Ready' status label when presentation-ready", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders all four component bars with correct labels", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("Validation Rate")).toBeInTheDocument();
    expect(screen.getByText("Grounding")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Coverage")).toBeInTheDocument();
    expect(screen.getByText("Unsupported")).toBeInTheDocument();
  });

  it("displays component scores as rounded percentages", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("applies green visual indicator for high composite scores (≥80%)", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    const scoreDisplay = screen.getByText("82%").closest("[role='meter']") ||
      screen.getByText("82%").parentElement;
    expect(scoreDisplay?.className).toContain("text-green-600");
  });

  it("shows blocker count and list when status is blocked", () => {
    const withBlockers = {
      ...mockReadinessData,
      status: "blocked" as const,
      blockers: ["Missing benchmark data", "Low confidence score below threshold"],
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: withBlockers }} />);

    expect(screen.getByText("2 blockers")).toBeInTheDocument();
    expect(screen.getByText(/Missing benchmark data/)).toBeInTheDocument();
    expect(screen.getByText(/Low confidence score below threshold/)).toBeInTheDocument();
  });

  it("applies amber visual indicator for medium scores (50-79%)", () => {
    const mediumScoreData = {
      ...mockReadinessData,
      compositeScore: 0.65,
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mediumScoreData }} />);

    const scoreDisplay = screen.getByText("65%").closest("[role='meter']") ||
      screen.getByText("65%").parentElement;
    expect(scoreDisplay?.className).toContain("text-amber-600");
  });

  it("applies red visual indicator for low scores (<50%)", () => {
    const lowScoreData = {
      ...mockReadinessData,
      compositeScore: 0.35,
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: lowScoreData }} />);

    const scoreDisplay = screen.getByText("35%").closest("[role='meter']") ||
      screen.getByText("35%").parentElement;
    expect(scoreDisplay?.className).toContain("text-red-600");
  });

  it("displays correct status badge for draft status", () => {
    const draftData = {
      ...mockReadinessData,
      status: "draft" as const,
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: draftData }} />);

    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("displays correct status badge for blocked status", () => {
    const blockedData = {
      ...mockReadinessData,
      status: "blocked" as const,
      blockers: ["Test blocker"],
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: blockedData }} />);

    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
  });

  it("renders loading state when readiness data is undefined", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{}} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders loading state when readiness data is null", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: null }} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("has accessible meter role with correct ARIA attributes", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    const meter = screen.getByRole("meter");
    expect(meter).toHaveAttribute("aria-label", "Defense readiness score");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(meter).toHaveAttribute("aria-valuenow", "82");
  });
});
