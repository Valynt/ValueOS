/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { render, screen } from "@testing-library/react";

import { getSourceTier, SourceBadge, SourceType } from "../SourceBadge";

describe("SourceBadge", () => {
  it("renders customer-confirmed with correct icon and tier 1", () => {
    render(<SourceBadge sourceType="customer-confirmed" showTooltip={false} />);
    expect(screen.getByText("Customer Confirmed")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
    const badge = screen.getByLabelText("Source: Customer Confirmed, Tier 1");
    expect(badge.className).toContain("bg-emerald-100");
  });

  it("renders CRM-derived with tier 2", () => {
    render(<SourceBadge sourceType="CRM-derived" showTooltip={false} />);
    expect(screen.getByText("CRM Derived")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("renders inferred with tier 3", () => {
    render(<SourceBadge sourceType="inferred" showTooltip={false} />);
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
    const badge = screen.getByLabelText("Source: Inferred, Tier 3");
    expect(badge.className).toContain("bg-amber-100");
  });

  it("renders SEC-filing with tier 1", () => {
    render(<SourceBadge sourceType="SEC-filing" showTooltip={false} />);
    expect(screen.getByText("SEC Filing")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
  });

  it("renders benchmark-derived with tier 2", () => {
    render(<SourceBadge sourceType="benchmark-derived" showTooltip={false} />);
    expect(screen.getByText("Benchmark Derived")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("renders call-derived with tier 2", () => {
    render(<SourceBadge sourceType="call-derived" showTooltip={false} />);
    expect(screen.getByText("Call Derived")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("renders manually-overridden with tier 1", () => {
    render(<SourceBadge sourceType="manually-overridden" showTooltip={false} />);
    expect(screen.getByText("Manually Overridden")).toBeInTheDocument();
    expect(screen.getByText("T1")).toBeInTheDocument();
  });

  it("renders note-derived with tier 2", () => {
    render(<SourceBadge sourceType="note-derived" showTooltip={false} />);
    expect(screen.getByText("Note Derived")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("renders externally-researched with tier 2", () => {
    render(<SourceBadge sourceType="externally-researched" showTooltip={false} />);
    expect(screen.getByText("Externally Researched")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
  });

  it("handles unknown source type gracefully", () => {
    render(<SourceBadge sourceType="unknown-source" showTooltip={false} />);
    expect(screen.getByText("unknown-source")).toBeInTheDocument();
    expect(screen.getByText("T3")).toBeInTheDocument();
  });

  it("supports small size variant", () => {
    render(<SourceBadge sourceType="customer-confirmed" size="sm" showTooltip={false} />);
    const badge = screen.getByLabelText("Source: Customer Confirmed, Tier 1");
    expect(badge.className).toContain("px-2 py-0.5");
  });

  it("can hide tier badge", () => {
    render(<SourceBadge sourceType="customer-confirmed" showTier={false} showTooltip={false} />);
    expect(screen.queryByText("T1")).not.toBeInTheDocument();
  });

  it("getSourceTier returns correct tier for each source type", () => {
    expect(getSourceTier("customer-confirmed")).toBe(1);
    expect(getSourceTier("SEC-filing")).toBe(1);
    expect(getSourceTier("manually-overridden")).toBe(1);
    expect(getSourceTier("CRM-derived")).toBe(2);
    expect(getSourceTier("benchmark-derived")).toBe(2);
    expect(getSourceTier("call-derived")).toBe(2);
    expect(getSourceTier("inferred")).toBe(3);
    expect(getSourceTier("unknown")).toBe(3);
  });
});
