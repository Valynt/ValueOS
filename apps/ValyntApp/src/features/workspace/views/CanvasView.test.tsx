/**
 * TDD tests for CanvasView — Phase 2 Canvas Mode
 *
 * Tests the canvas mode view wrapping React Flow with warmth nodes.
 * Written before implementation.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock React Flow (jsdom cannot render SVG canvas)
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  MiniMap: () => <div data-testid="rf-minimap" />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
}));

// @ts-expect-error — TDD: module will be created during Phase 2 implementation
import { CanvasView } from "./CanvasView";

function buildGraph() {
  return {
    id: "graph-1",
    versionId: "v1",
    scenarioId: "baseline",
    nodes: {
      "node-1": {
        id: "node-1",
        type: "driver" as const,
        label: "Automated Reconciliation",
        value: 2400000,
        confidence: 0.78,
        evidence: [],
      },
      "node-2": {
        id: "node-2",
        type: "metric" as const,
        label: "Month-End Close Time",
        value: 42,
        confidence: 0.65,
        evidence: [],
      },
    },
    edges: {
      "edge-1": { id: "edge-1", source: "node-2", target: "node-1", type: "dependency" as const },
    },
    computedAt: "2026-04-07T10:00:00Z",
    globalMetrics: { npv: 2400000, confidence: 0.72, defensibilityScore: 0.68 },
    evidenceCoverage: 0.6,
  };
}

describe("CanvasView", () => {
  it("renders ReactFlow container", () => {
    render(<CanvasView graph={buildGraph()} warmth="firm" onNodeSelect={vi.fn()} />);

    expect(screen.getByTestId("react-flow")).toBeInTheDocument();
  });

  it("renders toolbar with zoom controls", () => {
    render(<CanvasView graph={buildGraph()} warmth="firm" onNodeSelect={vi.fn()} />);

    expect(screen.getByTestId("rf-controls")).toBeInTheDocument();
  });

  it("renders empty state when no graph data", () => {
    render(<CanvasView graph={null} warmth="forming" onNodeSelect={vi.fn()} />);

    expect(screen.getByText(/no graph|no value tree|empty/i)).toBeInTheDocument();
  });

  it("renders minimap", () => {
    render(<CanvasView graph={buildGraph()} warmth="firm" onNodeSelect={vi.fn()} />);

    expect(screen.getByTestId("rf-minimap")).toBeInTheDocument();
  });
});
