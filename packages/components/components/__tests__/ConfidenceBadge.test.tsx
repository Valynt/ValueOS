/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders with correct percentage for score 0.85", () => {
    render(<ConfidenceBadge score={0.85} showTooltip={false} />);
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("• High")).toBeInTheDocument();
  });

  it("renders with correct percentage for score 0.5", () => {
    render(<ConfidenceBadge score={0.5} showTooltip={false} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("• Medium")).toBeInTheDocument();
  });

  it("renders with correct percentage for score 0.3", () => {
    render(<ConfidenceBadge score={0.3} showTooltip={false} />);
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("• Low")).toBeInTheDocument();
  });

  it("clamps score to 0-1 range", () => {
    render(<ConfidenceBadge score={1.5} showTooltip={false} />);
    expect(screen.getByText("100%")).toBeInTheDocument();

    render(<ConfidenceBadge score={-0.5} showTooltip={false} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("applies green color class for high confidence", () => {
    render(<ConfidenceBadge score={0.85} showTooltip={false} />);
    const badge = screen.getByLabelText("Confidence: 85% - High confidence");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
  });

  it("applies amber color class for medium confidence", () => {
    render(<ConfidenceBadge score={0.6} showTooltip={false} />);
    const badge = screen.getByLabelText("Confidence: 60% - Medium confidence");
    expect(badge.className).toContain("bg-amber-100");
    expect(badge.className).toContain("text-amber-800");
  });

  it("applies red color class for low confidence", () => {
    render(<ConfidenceBadge score={0.4} showTooltip={false} />);
    const badge = screen.getByLabelText("Confidence: 40% - Low confidence");
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("handles boundary value 0.8 correctly", () => {
    render(<ConfidenceBadge score={0.8} showTooltip={false} />);
    const badge = screen.getByLabelText("Confidence: 80% - High confidence");
    expect(badge.className).toContain("bg-green-100");
    expect(screen.getByText("• High")).toBeInTheDocument();
  });

  it("handles boundary value 0.5 correctly", () => {
    render(<ConfidenceBadge score={0.5} showTooltip={false} />);
    const badge = screen.getByLabelText("Confidence: 50% - Medium confidence");
    expect(badge.className).toContain("bg-amber-100");
    expect(screen.getByText("• Medium")).toBeInTheDocument();
  });

  it("includes aria-label with confidence info", () => {
    render(<ConfidenceBadge score={0.75} showTooltip={false} />);
    expect(screen.getByLabelText("Confidence: 75% - High confidence")).toBeInTheDocument();
  });
});
