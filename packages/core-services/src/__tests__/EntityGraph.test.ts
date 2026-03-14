import { describe, it, expect } from "vitest";
import {
  EntityGraph,
  EntityGraphError,
  KpiDependencySchema,
  EntityGraphEdgeSchema,
} from "../EntityGraph.js";
import type { EntityNode, GraphEdge } from "../EntityGraph.js";

function makeNode(
  id: string,
  type: "account" | "kpi" | "financial_model" = "kpi",
  value = 100
): EntityNode {
  return { id, type, label: id, value, metadata: {} };
}

function makeEdge(
  id: string,
  sourceId: string,
  targetId: string,
  opts: Partial<GraphEdge> = {}
): GraphEdge {
  return {
    id,
    sourceId,
    sourceType: "kpi",
    targetId,
    targetType: "kpi",
    edgeType: "drives",
    weight: 1.0,
    propagationType: "linear",
    lagPeriods: 0,
    metadata: {},
    ...opts,
  };
}

describe("EntityGraph", () => {
  it("adds and retrieves nodes", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("n1"));
    graph.addNode(makeNode("n2"));
    expect(graph.getNodes()).toHaveLength(2);
    expect(graph.getNode("n1")?.label).toBe("n1");
  });

  it("adds edges and retrieves outgoing/incoming", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    graph.addNode(makeNode("b"));
    graph.addEdge(makeEdge("e1", "a", "b"));

    expect(graph.getOutgoingEdges("a")).toHaveLength(1);
    expect(graph.getIncomingEdges("b")).toHaveLength(1);
    expect(graph.getOutgoingEdges("b")).toHaveLength(0);
  });

  it("rejects self-loop edges (same type)", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    expect(() => graph.addEdge(makeEdge("e1", "a", "a"))).toThrow(
      "Self-loop edges are not allowed"
    );
  });

  it("rejects self-loop edges where sourceId === targetId but types differ", () => {
    // Regression: the original guard required BOTH sourceId===targetId AND
    // sourceType===targetType, so a cross-type self-loop slipped through.
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a", "kpi"));
    expect(() =>
      graph.addEdge(
        makeEdge("e1", "a", "a", { sourceType: "kpi", targetType: "account" })
      )
    ).toThrow("Self-loop edges are not allowed");
  });

  it("detects cycles", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    graph.addNode(makeNode("b"));
    graph.addNode(makeNode("c"));
    graph.addEdge(makeEdge("e1", "a", "b"));
    graph.addEdge(makeEdge("e2", "b", "c"));
    graph.addEdge(makeEdge("e3", "c", "a"));

    const result = graph.detectCycle();
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath.length).toBeGreaterThan(0);
  });

  it("reports no cycle in a DAG", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    graph.addNode(makeNode("b"));
    graph.addNode(makeNode("c"));
    graph.addEdge(makeEdge("e1", "a", "b"));
    graph.addEdge(makeEdge("e2", "b", "c"));

    const result = graph.detectCycle();
    expect(result.hasCycle).toBe(false);
  });

  it("topologically sorts a DAG", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    graph.addNode(makeNode("b"));
    graph.addNode(makeNode("c"));
    graph.addEdge(makeEdge("e1", "a", "b"));
    graph.addEdge(makeEdge("e2", "b", "c"));

    const sorted = graph.topologicalSort();
    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
  });

  it("throws on topological sort with cycle", () => {
    const graph = new EntityGraph("t1", "vc1");
    graph.addNode(makeNode("a"));
    graph.addNode(makeNode("b"));
    graph.addEdge(makeEdge("e1", "a", "b"));
    graph.addEdge(makeEdge("e2", "b", "a"));

    expect(() => graph.topologicalSort()).toThrow(EntityGraphError);
  });

  describe("propagateChange", () => {
    it("propagates linear changes through a chain", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("account", "account", 1000));
      graph.addNode(makeNode("kpi1", "kpi", 500));
      graph.addNode(makeNode("npv", "financial_model", 10000));

      graph.addEdge(
        makeEdge("e1", "account", "kpi1", {
          sourceType: "account",
          targetType: "kpi",
          weight: 0.5,
        })
      );
      graph.addEdge(
        makeEdge("e2", "kpi1", "npv", {
          sourceType: "kpi",
          targetType: "financial_model",
          weight: 2.0,
        })
      );

      const results = graph.propagateChange("account", 1200);

      expect(results).toHaveLength(3);
      // Account: 1000 → 1200, delta = 200
      expect(results[0].delta).toBe(200);
      // KPI1: 500 + (200 * 0.5) = 600
      expect(results[1].newValue).toBe(600);
      // NPV: 10000 + (100 * 2.0) = 10200
      expect(results[2].newValue).toBe(10200);
    });

    it("returns only source when delta is zero", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("a", "kpi", 100));
      graph.addNode(makeNode("b", "kpi", 200));
      graph.addEdge(makeEdge("e1", "a", "b"));

      const results = graph.propagateChange("a", 100);
      expect(results).toHaveLength(1);
      expect(results[0].delta).toBe(0);
    });

    it("handles threshold propagation", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("a", "kpi", 100));
      graph.addNode(makeNode("b", "kpi", 200));
      graph.addEdge(
        makeEdge("e1", "a", "b", {
          propagationType: "threshold",
          weight: 50, // threshold = 50
        })
      );

      // Delta of 10 is below threshold of 50
      const results1 = graph.propagateChange("a", 110);
      expect(results1).toHaveLength(1); // Only source node

      // Reset and try delta above threshold
      graph.getNode("a")!.value = 100;
      const results2 = graph.propagateChange("a", 200);
      expect(results2).toHaveLength(2);
    });
  });

  describe("subgraph extraction", () => {
    it("extracts downstream subgraph", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addNode(makeNode("d"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));
      // d is disconnected

      const sub = graph.getDownstreamSubgraph("a");
      expect(sub.nodes).toHaveLength(3);
      expect(sub.edges).toHaveLength(2);
    });

    it("extracts upstream subgraph", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addNode(makeNode("c"));
      graph.addEdge(makeEdge("e1", "a", "b"));
      graph.addEdge(makeEdge("e2", "b", "c"));

      const sub = graph.getUpstreamSubgraph("c");
      expect(sub.nodes).toHaveLength(3);
    });
  });

  describe("serialization", () => {
    it("round-trips through JSON", () => {
      const graph = new EntityGraph("t1", "vc1");
      graph.addNode(makeNode("a"));
      graph.addNode(makeNode("b"));
      graph.addEdge(makeEdge("e1", "a", "b"));

      const json = graph.toJSON();
      const restored = EntityGraph.fromJSON("t1", "vc1", json);

      expect(restored.getNodes()).toHaveLength(2);
      expect(restored.getEdges()).toHaveLength(1);
    });
  });

  describe("Zod schemas", () => {
    it("validates a KpiDependency", () => {
      const result = KpiDependencySchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        tenantId: "tenant-1",
        valueCaseId: "00000000-0000-0000-0000-000000000002",
        sourceKpiId: "00000000-0000-0000-0000-000000000003",
        targetKpiId: "00000000-0000-0000-0000-000000000004",
        weight: 1.5,
        propagationType: "linear",
        lagPeriods: 0,
        metadata: {},
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid weight", () => {
      const result = KpiDependencySchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        tenantId: "tenant-1",
        valueCaseId: "00000000-0000-0000-0000-000000000002",
        sourceKpiId: "00000000-0000-0000-0000-000000000003",
        targetKpiId: "00000000-0000-0000-0000-000000000004",
        weight: -5,
        propagationType: "linear",
        lagPeriods: 0,
        metadata: {},
      });
      expect(result.success).toBe(false);
    });

    it("validates an EntityGraphEdge", () => {
      const result = EntityGraphEdgeSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        tenantId: "tenant-1",
        valueCaseId: "00000000-0000-0000-0000-000000000002",
        sourceType: "account",
        sourceId: "00000000-0000-0000-0000-000000000003",
        targetType: "kpi",
        targetId: "00000000-0000-0000-0000-000000000004",
        edgeType: "drives",
        weight: 1.0,
        metadata: {},
      });
      expect(result.success).toBe(true);
    });
  });
});
