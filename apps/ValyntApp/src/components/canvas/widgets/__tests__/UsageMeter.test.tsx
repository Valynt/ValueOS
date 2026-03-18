/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";


import { UsageMeter } from "../UsageMeter";

describe("UsageMeter", () => {
  const mockMeter = {
    meterKey: "ai_tokens",
    meterName: "AI Tokens",
    used: 750000,
    cap: 1000000,
    unit: "tokens",
    trend: "up" as const,
    trendPercentage: 15,
    resetDate: "2024-02-01",
  };

  it("renders meter name and usage", () => {
    render(<UsageMeter id="usage-meter" data={mockMeter} />);

    expect(screen.getByText("AI Tokens")).toBeInTheDocument();
    // formatValue converts 750000 to "750K" and 1000000 to "1.0M"
    expect(screen.getByText("750K")).toBeInTheDocument();
    expect(screen.getByText("1.0M")).toBeInTheDocument();
  });

  it("displays percentage used", () => {
    render(<UsageMeter id="usage-meter" data={mockMeter} />);

    // Use regex to match percentage that might be in multiple elements
    expect(screen.getByText(/75\.0%/)).toBeInTheDocument();
  });

  it("shows amber color at 80% threshold", () => {
    const amberMeter = { ...mockMeter, used: 800000 };
    render(<UsageMeter id="usage-meter" data={amberMeter} />);

    // Check for the warning message at 80% threshold
    expect(screen.getByText(/Approaching usage limit/i)).toBeInTheDocument();
    // Verify amber styling on warning div (bg-amber-50 not bg-amber)
    const warning = screen.getByText(/Approaching usage limit/i).closest("div");
    expect(warning?.className).toContain("bg-amber-50");
  });

  it("shows red color at 100% threshold", () => {
    const redMeter = { ...mockMeter, used: 1000000 };
    render(<UsageMeter id="usage-meter" data={redMeter} />);

    // Check for the error message at 100% threshold
    expect(screen.getByText(/Usage limit exceeded/i)).toBeInTheDocument();
    // Verify red styling on error div (bg-red-50 not bg-red)
    const error = screen.getByText(/Usage limit exceeded/i).closest("div");
    expect(error?.className).toContain("bg-red-50");
  });

  it("displays reset date", () => {
    render(<UsageMeter id="usage-meter" data={mockMeter} />);

    // toLocaleDateString format varies by locale
    expect(screen.getByText(/Resets/i)).toBeInTheDocument();
    expect(screen.getByText(/2024/i)).toBeInTheDocument();
  });

  it("shows trend indicator", () => {
    render(<UsageMeter id="usage-meter" data={mockMeter} />);

    // toFixed(1) adds decimal: "15.0%" not "15%"
    expect(screen.getByText("↑ 15.0%")).toBeInTheDocument();
  });
});
