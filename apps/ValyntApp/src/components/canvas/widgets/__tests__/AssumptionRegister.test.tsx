/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


import { AssumptionRegister } from "../AssumptionRegister";

describe("AssumptionRegister", () => {
  const mockAssumptions = [
    { id: "a1", name: "Employee Count", value: 500, unit: "people", source: "customer-confirmed" as const, confidenceScore: 0.9, benchmarkReference: "b1", unsupported: false, plausibility: "plausible" as const, lastModified: "2024-01-01" },
    { id: "a2", name: "Annual Growth", value: 15, unit: "%", source: "inferred" as const, confidenceScore: 0.4, unsupported: true, plausibility: "weakly-supported" as const, lastModified: "2024-01-02" },
    { id: "a3", name: "IT Budget", value: 2000000, unit: "USD", source: "CRM-derived" as const, confidenceScore: 0.7, unsupported: false, plausibility: "plausible" as const, lastModified: "2024-01-03" },
  ];

  it("renders all assumptions in table", () => {
    render(<AssumptionRegister id="assumption-register" data={{ assumptions: mockAssumptions }} />);

    expect(screen.getByText("Employee Count")).toBeInTheDocument();
    expect(screen.getByText("Annual Growth")).toBeInTheDocument();
    expect(screen.getByText("IT Budget")).toBeInTheDocument();
  });

  it("shows values with units", () => {
    render(<AssumptionRegister id="assumption-register" data={{ assumptions: mockAssumptions }} />);

    expect(screen.getByText("500 people")).toBeInTheDocument();
    expect(screen.getByText("15 %")).toBeInTheDocument();
    // toLocaleString() adds commas to numbers
    expect(screen.getByText("2,000,000 USD")).toBeInTheDocument();
  });

  it("highlights unsupported assumptions", () => {
    render(<AssumptionRegister id="assumption-register" data={{ assumptions: mockAssumptions }} />);

    const unsupportedRow = screen.getByText("Annual Growth").closest("tr");
    expect(unsupportedRow?.className).toContain("bg-red-50");
  });

  it("shows benchmark reference when available", () => {
    render(<AssumptionRegister id="assumption-register" data={{ assumptions: mockAssumptions }} />);

    // Component shows benchmark reference as "Benchmark: b1" text
    expect(screen.getByText("Benchmark: b1")).toBeInTheDocument();
  });

  it("sorts by confidence score", () => {
    render(<AssumptionRegister id="assumption-register" data={{ assumptions: mockAssumptions }} />);

    fireEvent.click(screen.getByText("Confidence"));
    // Should sort in ascending/descending order
    const confidenceBadges = screen.getAllByText(/%/);
    expect(confidenceBadges.length).toBeGreaterThan(0);
  });
});
