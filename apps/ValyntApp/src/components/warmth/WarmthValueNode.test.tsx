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
    label: "Automated Reconciliation",
    value: 2400000,
    format: "currency" as const,
    confidence: 0.78,
    evidenceCount: 2,
    warmth: "firm" as WarmthState,
    warmthModifier: null,
    isLocked: false,
    ...overrides,
  };
}

describe("WarmthValueNode", () => {
  it("renders node label and formatted value", () => {
    render(<WarmthValueNode data={buildNodeData()} />);

    expect(screen.getByText("Automated Reconciliation")).toBeInTheDocument();
    expect(screen.getByText("$2.4M")).toBeInTheDocument();
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
    expect(node?.className).toMatch(/emerald/);
  });

  it("shows firming modifier icon when modifier is firming", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ warmth: "forming", confidence: 0.75, warmthModifier: "firming" })}
      />,
    );

    expect(screen.getByTitle(/firming/i)).toBeInTheDocument();
  });

  it("shows needs_review modifier icon when modifier is needs_review", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ warmth: "verified", confidence: 0.4, warmthModifier: "needs_review" })}
      />,
    );

    expect(screen.getByTitle(/needs_review/i)).toBeInTheDocument();
  });

  it("displays source count badge when evidence exists", () => {
    render(<WarmthValueNode data={buildNodeData()} />);

    expect(screen.getByText(/2 sources/i)).toBeInTheDocument();
  });

  it("shows lock icon when node is locked", () => {
    render(
      <WarmthValueNode
        data={buildNodeData({ isLocked: true })}
      />,
    );

    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument();
  });
});
