/**
 * TDD tests for WarmthValueNode — Phase 2 Canvas Mode
 *
 * Tests the warmth-styled React Flow custom node component.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WarmthState } from "@shared/domain/Warmth";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { WarmthValueNode } from "./WarmthValueNode";

function buildNodeData(overrides: Record<string, unknown> = {}) {
  return {
    node: {
      id: "node-1",
      type: "driver" as const,
      label: "Automated Reconciliation",
      value: 2400000,
      confidence: 0.78,
      evidence: [
        { id: "ev-1", type: "10-K", source: "SEC", title: "Annual Report", confidence: 0.9, date: "2026-01-01" },
        { id: "ev-2", type: "benchmark", source: "Gartner", title: "Industry Benchmark", confidence: 0.7, date: "2026-02-01" },
      ],
      metadata: { locked: false },
      ...overrides,
    },
    warmth: "firm" as WarmthState,
    ...(overrides.warmth ? { warmth: overrides.warmth as WarmthState } : {}),
  };
}

describe("WarmthValueNode", () => {
  it("renders node label, value, and type", () => {
    render(<WarmthValueNode data={buildNodeData()} />);

    expect(screen.getByText("Automated Reconciliation")).toBeInTheDocument();
    expect(screen.getByText("$2.4M")).toBeInTheDocument();
    expect(screen.getByText(/driver/i)).toBeInTheDocument();
  });

  it("applies dashed border + amber bg for forming warmth", () => {
    const { container } = render(
      <WarmthValueNode data={buildNodeData({ warmth: "forming" })} />,
    );

    const node = container.firstElementChild;
    expect(node?.className).toMatch(/dashed|border-dashed/);
    expect(node?.className).toMatch(/amber/);
  });

  it("applies solid border + white bg for firm warmth", () => {
    const { container } = render(
      <WarmthValueNode data={buildNodeData({ warmth: "firm" })} />,
    );

    const node = container.firstElementChild;
    expect(node?.className).toMatch(/solid|border-solid|border-blue/);
    expect(node?.className).not.toMatch(/dashed/);
  });

  it("applies solid border + blue bg + glow for verified warmth", () => {
    const { container } = render(
      <WarmthValueNode data={buildNodeData({ warmth: "verified" })} />,
    );

    const node = container.firstElementChild;
    expect(node?.className).toMatch(/blue/);
  });

  it("shows firming modifier icon when confidence > 0.7 in forming", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ warmth: "forming", confidence: 0.75 })}
      />,
    );

    expect(screen.getByLabelText(/firming/i)).toBeInTheDocument();
  });

  it("shows needs_review modifier icon when confidence < 0.5 in verified", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ warmth: "verified", confidence: 0.4 })}
      />,
    );

    expect(screen.getByLabelText(/needs.review/i)).toBeInTheDocument();
  });

  it("displays source count badge when evidence exists", () => {
    render(<WarmthValueNode data={buildNodeData()} />);

    expect(screen.getByText(/2 sources/i)).toBeInTheDocument();
  });

  it("shows lock icon when node is locked", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ metadata: { locked: true } })}
      />,
    );

    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument();
  });
});
