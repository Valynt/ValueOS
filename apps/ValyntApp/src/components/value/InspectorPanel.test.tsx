/**
 * TDD tests for InspectorPanel — Phase 2 Canvas Mode
 *
 * Tests the dual-layer status inspector: warmth surface by default,
 * operational deep state one click away.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { WarmthState } from "@shared/domain/Warmth";

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { InspectorPanel } from "./InspectorPanel";

function buildNode(overrides: Record<string, unknown> = {}) {
  return {
    id: "node-1",
    type: "driver" as const,
    label: "Automated Reconciliation",
    value: 2400000,
    confidence: 0.78,
    evidence: [
      { id: "ev-1", type: "10-K", source: "SEC", title: "Annual Report", confidence: 0.9, date: "2026-01-01" },
      { id: "ev-2", type: "benchmark", source: "Gartner", title: "Industry Bench", confidence: 0.7, date: "2026-02-01" },
      { id: "ev-3", type: "internal", source: "CRM", title: "Pipeline Data", confidence: 0.6, date: "2026-03-01" },
    ],
    metadata: { locked: false, lastModified: "2026-04-06T12:00:00Z", owner: "alice" },
    ...overrides,
  };
}

function buildOperationalState() {
  return {
    sagaState: "VALIDATING",
    confidenceScore: 0.78,
    blockingReasons: ["1 assumption needs evidence"],
    lastAgentAction: "FinancialModelingAgent completed analysis",
    agentStatus: "idle" as const,
  };
}

describe("InspectorPanel", () => {
  it('renders "Select a node" message when no node selected', () => {
    render(<InspectorPanel node={null} warmth="firm" operationalState={null} />);

    expect(screen.getByText(/select a node/i)).toBeInTheDocument();
  });

  it("renders node summary with warmth badge", () => {
    render(
      <InspectorPanel
        node={buildNode()}
        warmth={"firm" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    expect(screen.getByText("Automated Reconciliation")).toBeInTheDocument();
    expect(screen.getByText(/firm/i)).toBeInTheDocument();
  });

  it("shows confidence score and source count", () => {
    render(
      <InspectorPanel
        node={buildNode()}
        warmth={"firm" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    expect(screen.getByText(/78%|0\.78/)).toBeInTheDocument();
    expect(screen.getByText(/3 sources/i)).toBeInTheDocument();
  });

  it("renders action buttons: Show lineage, Edit, Request evidence", () => {
    render(
      <InspectorPanel
        node={buildNode()}
        warmth={"firm" as WarmthState}
        operationalState={buildOperationalState()}
        onShowLineage={vi.fn()}
        onEdit={vi.fn()}
        onRequestEvidence={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /lineage/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /evidence/i })).toBeInTheDocument();
  });

  it("hides operational state by default (collapsed)", () => {
    render(
      <InspectorPanel
        node={buildNode()}
        warmth={"firm" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    expect(screen.queryByText(/VALIDATING/)).not.toBeInTheDocument();
  });

  it('shows operational state when "Deeper state" toggle clicked', async () => {
    const user = userEvent.setup();

    render(
      <InspectorPanel
        node={buildNode()}
        warmth={"firm" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    const toggle = screen.getByRole("button", { name: /deeper state|operational|details/i });
    await user.click(toggle);

    expect(screen.getByText(/VALIDATING/)).toBeInTheDocument();
    expect(screen.getByText(/FinancialModelingAgent/)).toBeInTheDocument();
    expect(screen.getByText(/1 assumption needs evidence/)).toBeInTheDocument();
  });

  it("applies warmth-appropriate badge styling for forming", () => {
    const { container } = render(
      <InspectorPanel
        node={buildNode()}
        warmth={"forming" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    const badge = container.querySelector("[class*='amber']");
    expect(badge).toBeTruthy();
  });

  it("applies warmth-appropriate badge styling for verified", () => {
    const { container } = render(
      <InspectorPanel
        node={buildNode()}
        warmth={"verified" as WarmthState}
        operationalState={buildOperationalState()}
      />,
    );

    const badge = container.querySelector("[class*='blue']");
    expect(badge).toBeTruthy();
  });
});
