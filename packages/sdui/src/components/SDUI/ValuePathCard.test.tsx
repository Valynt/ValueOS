import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ValuePathCard } from "./ValuePathCard";
import type { ValuePathCardPath } from "./ValuePathCard";

const BASE_PATH: ValuePathCardPath = {
  path_confidence: 0.72,
  use_case_id: "uc-uuid-001",
  use_case_label: "Automate invoice reconciliation",
  capabilities: [
    { id: "cap-1", name: "Automated matching engine" },
  ],
  metrics: [
    {
      id: "metric-1",
      name: "Days Sales Outstanding",
      unit: "days",
      evidence_tier: "gold",
      evidence_source_url: "https://example.com/evidence/1",
    },
  ],
  value_driver: {
    id: "vd-1",
    name: "Reduce invoice processing cost",
    type: "cost_reduction",
    estimated_impact_usd: 1_200_000,
  },
};

describe("ValuePathCard", () => {
  it("renders the use case label", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText("Automate invoice reconciliation")).toBeInTheDocument();
  });

  it("falls back to truncated use_case_id when no label", () => {
    const path = { ...BASE_PATH, use_case_label: undefined };
    const { container } = render(<ValuePathCard path={path} />);
    // Component slices to 8 chars + "…": "uc-uuid-…"
    expect(container.textContent).toMatch(/uc-uuid-/);
  });

  it("renders capability name", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText("Automated matching engine")).toBeInTheDocument();
  });

  it("renders metric name", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText("Days Sales Outstanding")).toBeInTheDocument();
  });

  it("renders value driver name", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText("Reduce invoice processing cost")).toBeInTheDocument();
  });

  it("renders confidence as percentage", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByTestId("confidence-pill")).toHaveTextContent("72% confidence");
  });

  it("renders driver type badge", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText("Cost Reduction")).toBeInTheDocument();
  });

  it("renders evidence tier chip for metric with tier", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    const chips = screen.getAllByTestId("evidence-chip");
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveTextContent("Gold");
  });

  it("renders evidence chip as a link when source_url is present", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com/evidence/1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("does not render evidence section when no metrics have tiers", () => {
    const path: ValuePathCardPath = {
      ...BASE_PATH,
      metrics: [{ id: "m1", name: "DSO", unit: "days" }],
    };
    render(<ValuePathCard path={path} />);
    expect(screen.queryByTestId("evidence-chip")).not.toBeInTheDocument();
  });

  it("renders estimated impact when present", () => {
    render(<ValuePathCard path={BASE_PATH} />);
    expect(screen.getByText(/\$1\.2M/)).toBeInTheDocument();
  });

  it("does not render estimated impact when null", () => {
    const path: ValuePathCardPath = {
      ...BASE_PATH,
      value_driver: { ...BASE_PATH.value_driver, estimated_impact_usd: null },
    };
    render(<ValuePathCard path={path} />);
    expect(screen.queryByText(/Est\. impact/)).not.toBeInTheDocument();
  });

  it("renders multiple capabilities in order", () => {
    const path: ValuePathCardPath = {
      ...BASE_PATH,
      capabilities: [
        { id: "c1", name: "Cap Alpha" },
        { id: "c2", name: "Cap Beta" },
      ],
    };
    render(<ValuePathCard path={path} />);
    expect(screen.getByText("Cap Alpha")).toBeInTheDocument();
    expect(screen.getByText("Cap Beta")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ValuePathCard path={BASE_PATH} className="my-class" />
    );
    expect(container.firstChild).toHaveClass("my-class");
  });
});
