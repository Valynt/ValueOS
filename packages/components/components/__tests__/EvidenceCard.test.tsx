/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import { EvidenceCard } from "../EvidenceCard";

describe("EvidenceCard", () => {
  const defaultProps = {
    id: "ev-1",
    description: "Customer reported 15% efficiency gain",
    sourceType: "customer-confirmed" as const,
    confidenceScore: 0.85,
    freshnessDate: "2024-01-15T00:00:00Z",
    tier: 1 as const,
  };

  it("renders description and badges", () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.getByText("Customer reported 15% efficiency gain")).toBeInTheDocument();
    expect(screen.getByText("Customer Confirmed")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Tier 1")).toBeInTheDocument();
  });

  it("displays formatted date", () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
  });

  it("toggles expanded state on click", () => {
    render(
      <EvidenceCard
        {...defaultProps}
        sourceUrl="https://example.com/source"
        metadata={{ author: "John Doe", verified: "true" }}
      />
    );

    const toggleButton = screen.getByText("More details");
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText("Less details")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/source")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Less details"));
    expect(screen.getByText("More details")).toBeInTheDocument();
  });

  it("does not show expand button when no sourceUrl or metadata", () => {
    render(<EvidenceCard {...defaultProps} />);
    expect(screen.queryByText("More details")).not.toBeInTheDocument();
  });

  it("has correct aria-expanded attribute", () => {
    render(
      <EvidenceCard
        {...defaultProps}
        sourceUrl="https://example.com/source"
      />
    );

    const button = screen.getByText("More details");
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(screen.getByText("Less details")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders with tier 2 colors", () => {
    render(<EvidenceCard {...defaultProps} tier={2} />);
    const tierBadge = screen.getByLabelText("Evidence tier 2");
    expect(tierBadge.className).toContain("bg-blue-100");
    expect(tierBadge.className).toContain("text-blue-800");
  });

  it("renders with tier 3 colors", () => {
    render(<EvidenceCard {...defaultProps} tier={3} />);
    const tierBadge = screen.getByLabelText("Evidence tier 3");
    expect(tierBadge.className).toContain("bg-amber-100");
    expect(tierBadge.className).toContain("text-amber-800");
  });
});
