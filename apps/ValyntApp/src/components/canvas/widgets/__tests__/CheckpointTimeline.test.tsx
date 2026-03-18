/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";


import { CheckpointTimeline } from "../CheckpointTimeline";

describe("CheckpointTimeline", () => {
  const mockCheckpoints = [
    { id: "cp-1", date: "2024-03-01", expectedRange: { min: 100000, max: 120000 }, status: "measured" as const, actualValue: 110000, notes: "On track" },
    { id: "cp-2", date: "2024-06-01", expectedRange: { min: 200000, max: 250000 }, status: "pending" as const },
    { id: "cp-3", date: "2024-09-01", expectedRange: { min: 300000, max: 350000 }, status: "missed" as const, actualValue: 280000, notes: "Below target" },
    { id: "cp-4", date: "2024-12-01", expectedRange: { min: 400000, max: 450000 }, status: "exceeded" as const, actualValue: 500000, notes: "Overperformed" },
  ];

  it("renders all checkpoints with dates", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: mockCheckpoints, unit: "$" }} />);

    expect(screen.getByText("Mar 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Jun 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Sep 1, 2024")).toBeInTheDocument();
    expect(screen.getByText("Dec 1, 2024")).toBeInTheDocument();
  });

  it("displays expected range for each checkpoint", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: mockCheckpoints, unit: "$" }} />);

    expect(screen.getByText("$100,000 - $120,000")).toBeInTheDocument();
    expect(screen.getByText("$200,000 - $250,000")).toBeInTheDocument();
  });

  it("shows status indicators correctly", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: mockCheckpoints, unit: "$" }} />);

    expect(screen.getByText("On Target")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Missed")).toBeInTheDocument();
    expect(screen.getByText("Exceeded")).toBeInTheDocument();
  });

  it("shows actual values for measured checkpoints", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: mockCheckpoints, unit: "$" }} />);

    expect(screen.getByText("$110,000")).toBeInTheDocument();
    expect(screen.getByText("$280,000")).toBeInTheDocument();
    expect(screen.getByText("$500,000")).toBeInTheDocument();
  });

  it("displays notes when available", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: mockCheckpoints, unit: "$" }} />);

    expect(screen.getByText("On track")).toBeInTheDocument();
    expect(screen.getByText("Below target")).toBeInTheDocument();
    expect(screen.getByText("Overperformed")).toBeInTheDocument();
  });

  it("renders empty state when no checkpoints", () => {
    render(<CheckpointTimeline id="checkpoint-timeline" data={{ checkpoints: [] }} />);

    expect(screen.getByText("No checkpoints scheduled")).toBeInTheDocument();
  });
});
