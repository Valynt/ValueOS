/**
 * TDD tests for NarrativeView — Phase 2 Narrative Mode
 *
 * Tests the narrative mode view with stream, outline, and export actions.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { NarrativeView } from "./NarrativeView";

function buildBlocks() {
  return [
    {
      id: "block-1",
      content: "Automated Reconciliation reduces month-end friction by 42%",
      type: "insight" as const,
      confidence: 0.82,
      sources: ["SEC 10-K"],
      warmth: "firm" as const,
      nodeId: "node-1",
    },
  ];
}

describe("NarrativeView", () => {
  it("renders NarrativeStream as primary content", () => {
    render(
      <NarrativeView
        blocks={buildBlocks()}
        warmth="firm"
        onNavigateToNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/Automated Reconciliation/)).toBeInTheDocument();
  });

  it("renders export actions: PDF, presentation", () => {
    render(
      <NarrativeView
        blocks={buildBlocks()}
        warmth="firm"
        onNavigateToNode={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /pdf|export/i })).toBeInTheDocument();
  });

  it('shows "Edit in Canvas" affordance per section', () => {
    render(
      <NarrativeView
        blocks={buildBlocks()}
        warmth="firm"
        onNavigateToNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/edit in canvas|view in canvas/i)).toBeInTheDocument();
  });

  it("renders empty state when no blocks", () => {
    render(
      <NarrativeView
        blocks={[]}
        warmth="forming"
        onNavigateToNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/no narrative|start building/i)).toBeInTheDocument();
  });
});
