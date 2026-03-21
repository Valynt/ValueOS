/**
 * ValueGraphVisualization unit tests
 *
 * ReactFlow does not render meaningfully in jsdom, so we mock it and focus on:
 *   - Loading skeleton renders while data is fetching
 *   - Error state renders when the hook errors
 *   - Empty state renders when graph has no nodes
 *   - The container renders when graph data is present
 *   - onNodeSelect callback fires on node click (via mocked ReactFlow)
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock reactflow — it uses browser APIs unavailable in jsdom.
// useNodesState/useEdgesState use real React state so node updates from the
// ELK useEffect are reflected in the rendered output.
vi.mock("reactflow", () => {
  const { useState } = require("react");

  const MockReactFlow = ({
    nodes,
    onNodeClick,
    children,
  }: {
    nodes: Array<{ id: string; data: Record<string, unknown> }>;
    onNodeClick?: (e: React.MouseEvent, node: { id: string; data: Record<string, unknown> }) => void;
    children?: React.ReactNode;
  }) => (
    <div data-testid="react-flow-mock">
      {nodes.map((n) => (
        <button
          key={n.id}
          data-testid={`node-${n.id}`}
          onClick={(e) => onNodeClick?.(e, n)}
        >
          {String(n.data?.label ?? n.id)}
        </button>
      ))}
      {children}
    </div>
  );
  MockReactFlow.displayName = "ReactFlow";

  return {
    default: MockReactFlow,
    Background: () => null,
    Controls: () => null,
    MiniMap: () => null,
    Handle: () => null,
    Position: { Top: "top", Bottom: "bottom" },
    useNodesState: (init: unknown[]) => {
      const [nodes, setNodes] = useState(init);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (init: unknown[]) => {
      const [edges, setEdges] = useState(init);
      return [edges, setEdges, vi.fn()];
    },
  };
});

// Mock elkjs
vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockELK {
    async layout(graph: { children?: Array<{ id: string }> }) {
      return {
        ...graph,
        children: (graph.children ?? []).map((c) => ({ ...c, x: 0, y: 0 })),
      };
    }
  },
}));

// Mock useValueGraph
vi.mock("@/hooks/useValueGraph", () => ({
  useValueGraph: vi.fn(),
}));

import { useValueGraph } from "@/hooks/useValueGraph";
import { ValueGraphVisualization } from "./ValueGraphVisualization";

const mockUseValueGraph = vi.mocked(useValueGraph);

const MOCK_GRAPH_DATA = {
  graph: {
    opportunity_id: "opp-1",
    organization_id: "org-1",
    ontology_version: "1.0",
    nodes: [
      {
        entity_type: "vg_capability" as const,
        entity_id: "cap-1",
        data: { id: "cap-1", name: "Automated matching" },
      },
      {
        entity_type: "vg_metric" as const,
        entity_id: "metric-1",
        data: { id: "metric-1", name: "DSO" },
      },
    ],
    edges: [
      {
        id: "edge-1",
        organization_id: "org-1",
        opportunity_id: "opp-1",
        from_entity_type: "vg_capability" as const,
        from_entity_id: "cap-1",
        to_entity_type: "vg_metric" as const,
        to_entity_id: "metric-1",
        edge_type: "capability_impacts_metric" as const,
        confidence_score: 0.8,
        evidence_ids: [],
        created_by_agent: "TargetAgent",
        ontology_version: "1.0",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
  },
  paths: [],
};

describe("ValueGraphVisualization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton while fetching", () => {
    mockUseValueGraph.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useValueGraph>);

    render(
      <ValueGraphVisualization opportunityId="opp-1" />
    );

    expect(screen.getByTestId("graph-skeleton")).toBeInTheDocument();
  });

  it("renders error state when hook errors", () => {
    mockUseValueGraph.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useValueGraph>);

    render(<ValueGraphVisualization opportunityId="opp-1" />);

    expect(screen.getByTestId("graph-error")).toBeInTheDocument();
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
  });

  it("renders empty state when graph has no nodes", () => {
    mockUseValueGraph.mockReturnValue({
      data: {
        graph: { ...MOCK_GRAPH_DATA.graph, nodes: [], edges: [] },
        paths: [],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useValueGraph>);

    render(<ValueGraphVisualization opportunityId="opp-1" />);

    expect(screen.getByTestId("graph-empty")).toBeInTheDocument();
    expect(screen.getByText(/no graph data yet/i)).toBeInTheDocument();
  });

  it("renders the graph container when data is present", () => {
    mockUseValueGraph.mockReturnValue({
      data: MOCK_GRAPH_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useValueGraph>);

    render(<ValueGraphVisualization opportunityId="opp-1" />);

    expect(screen.getByTestId("value-graph-visualization")).toBeInTheDocument();
  });

  it("calls onNodeSelect with entityType and entityId when a node is clicked", async () => {
    mockUseValueGraph.mockReturnValue({
      data: MOCK_GRAPH_DATA,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useValueGraph>);

    const onNodeSelect = vi.fn();

    render(
      <ValueGraphVisualization
        opportunityId="opp-1"
        onNodeSelect={onNodeSelect}
      />
    );

    // ELK layout resolves asynchronously — wait for node buttons to appear
    const nodeButton = await waitFor(() =>
      screen.getByTestId("node-vg_capability:cap-1")
    );

    fireEvent.click(nodeButton);

    expect(onNodeSelect).toHaveBeenCalledOnce();
    expect(onNodeSelect).toHaveBeenCalledWith("vg_capability", "cap-1");
  });

  it("passes opportunityId to useValueGraph", () => {
    mockUseValueGraph.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as unknown as ReturnType<typeof useValueGraph>);

    render(<ValueGraphVisualization opportunityId="opp-abc" />);

    expect(mockUseValueGraph).toHaveBeenCalledWith("opp-abc");
  });
});
