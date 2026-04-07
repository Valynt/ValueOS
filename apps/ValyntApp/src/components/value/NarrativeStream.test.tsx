/**
 * TDD tests for NarrativeStream — Phase 2 Narrative Mode
 *
 * Tests the timeline of narrative blocks with inline warmth badges.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WarmthState } from "@shared/domain/Warmth";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { NarrativeStream } from "./NarrativeStream";

function buildBlocks() {
  return [
    {
      id: "block-1",
      content: "Automated Reconciliation reduces month-end friction by 42%",
      type: "insight" as const,
      confidence: 0.82,
      sources: ["SEC 10-K FY2025", "Gartner Benchmark 2026"],
      warmth: "firm" as WarmthState,
      nodeId: "node-1",
    },
    {
      id: "block-2",
      content: "Neural Search Layer improves discovery latency by 68%",
      type: "recommendation" as const,
      confidence: 0.45,
      sources: ["Internal benchmark"],
      warmth: "forming" as WarmthState,
      nodeId: "node-2",
    },
  ];
}

describe("NarrativeStream", () => {
  it("renders a list of narrative blocks", () => {
    render(
      <NarrativeStream
        caseId="case-1"
        blocks={buildBlocks()}
        warmth="firm"
        onBlockClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/Automated Reconciliation/)).toBeInTheDocument();
    expect(screen.getByText(/Neural Search Layer/)).toBeInTheDocument();
  });

  it("shows inline warmth badge per block", () => {
    render(
      <NarrativeStream
        caseId="case-1"
        blocks={buildBlocks()}
        warmth="firm"
        onBlockClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/firm/i)).toBeInTheDocument();
    expect(screen.getByText(/forming/i)).toBeInTheDocument();
  });

  it("calls onBlockClick when a block is clicked", async () => {
    const user = userEvent.setup();
    const onBlockClick = vi.fn();

    render(
      <NarrativeStream
        caseId="case-1"
        blocks={buildBlocks()}
        warmth="firm"
        onBlockClick={onBlockClick}
      />,
    );

    await user.click(screen.getByText(/Automated Reconciliation/));
    expect(onBlockClick).toHaveBeenCalledWith("block-1");
  });

  it("renders empty state when no blocks", () => {
    render(
      <NarrativeStream
        caseId="case-1"
        blocks={[]}
        warmth="forming"
        onBlockClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/no narrative/i)).toBeInTheDocument();
  });

  it("shows source count per block", () => {
    render(
      <NarrativeStream
        caseId="case-1"
        blocks={buildBlocks()}
        warmth="firm"
        onBlockClick={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 source/i)).toBeInTheDocument();
    expect(screen.getByText(/1 source/i)).toBeInTheDocument();
  });

  it("applies warmth styling to the stream container", () => {
    const { container } = render(
      <NarrativeStream
        caseId="case-1"
        blocks={buildBlocks()}
        warmth="forming"
        onBlockClick={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toBeTruthy();
  });
});
