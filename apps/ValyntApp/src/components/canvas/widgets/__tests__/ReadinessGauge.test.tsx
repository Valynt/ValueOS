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

  it("renders circular gauge with composite score", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("displays four component bars", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("Validation Rate")).toBeInTheDocument();
    expect(screen.getByText("Grounding")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Coverage")).toBeInTheDocument();
    expect(screen.getByText("Unsupported")).toBeInTheDocument();
  });

  it("shows component scores as percentages", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("applies green color for presentation-ready status", () => {
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: mockReadinessData }} />);

    const gauge = screen.getByText("82%").closest("div");
    expect(gauge?.className).toContain("text-green");
  });

  it("shows blockers count when present", () => {
    const withBlockers = {
      ...mockReadinessData,
      status: "blocked" as const,
      blockers: ["Missing benchmark", "Low confidence"],
    };
    render(<ReadinessGauge id="readiness-gauge" data={{ readiness: withBlockers }} />);

    expect(screen.getByText("2 blockers")).toBeInTheDocument();
  });
});
