/**
 * EntityGraph — Tier 2 VML dependency graph engine
 *
 * Manages Account → KPI → NPV dependency chains and propagates
 * value changes through the graph using topological ordering.
 *
 * Backed by the `kpi_dependencies` and `entity_graph_edges` tables.
 */
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export type EntityNodeType =
  | "account"
  | "kpi"
  | "financial_model"
  | "value_driver"
  | "assumption";

export type EdgeType = "depends_on" | "drives" | "constrains" | "validates";

export type PropagationType = "linear" | "multiplicative" | "threshold" | "custom";

export interface EntityNode {
  id: string;
  type: EntityNodeType;
  label: string;
  value: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  sourceType: EntityNodeType;
  targetId: string;
  targetType: EntityNodeType;
  edgeType: EdgeType;
  weight: number;
  propagationType: PropagationType;
  lagPeriods: number;
  metadata: Record<string, unknown>;
}

export interface KpiDependency {
  id: string;
  tenantId: string;
  valueCaseId: string;
  sourceKpiId: string;
  targetKpiId: string;
  weight: number;
  propagationType: PropagationType;
  lagPeriods: number;
  metadata: Record<string, unknown>;
}

export interface PropagationResult {
  nodeId: string;
  nodeType: EntityNodeType;
  previousValue: number;
  newValue: number;
  delta: number;
  depth: number;
  path: string[];
}

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath: string[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const KpiDependencySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().min(1),
  valueCaseId: z.string().uuid(),
  sourceKpiId: z.string().uuid(),
  targetKpiId: z.string().uuid(),
  weight: z.number().min(0).max(100).default(1.0),
  propagationType: z
    .enum(["linear", "multiplicative", "threshold", "custom"])
    .default("linear"),
  lagPeriods: z.number().int().min(0).default(0),
  metadata: z.record(z.unknown()).default({}),
});

export const EntityGraphEdgeSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().min(1),
  valueCaseId: z.string().uuid(),
  sourceType: z.enum([
    "account",
    "kpi",
    "financial_model",
    "value_driver",
    "assumption",
  ]),
  sourceId: z.string().uuid(),
  targetType: z.enum([
    "account",
    "kpi",
    "financial_model",
    "value_driver",
    "assumption",
  ]),
  targetId: z.string().uuid(),
  edgeType: z
    .enum(["depends_on", "drives", "constrains", "validates"])
    .default("depends_on"),
  weight: z.number().min(0).max(100).default(1.0),
  metadata: z.record(z.unknown()).default({}),
});

// ============================================================================
// Persistence interface (dependency injection)
// ============================================================================

export interface EntityGraphStore {
  getKpiDependencies(
    tenantId: string,
    valueCaseId: string
  ): Promise<KpiDependency[]>;

  upsertKpiDependency(dep: KpiDependency): Promise<KpiDependency>;

  deleteKpiDependency(id: string, tenantId: string): Promise<void>;

  getEntityEdges(
    tenantId: string,
    valueCaseId: string
  ): Promise<GraphEdge[]>;

  upsertEntityEdge(
    tenantId: string,
    valueCaseId: string,
    edge: Omit<GraphEdge, "id">
  ): Promise<GraphEdge>;

  deleteEntityEdge(id: string, tenantId: string): Promise<void>;
}

// ============================================================================
// EntityGraph class
// ============================================================================

export class EntityGraph {
  private nodes: Map<string, EntityNode> = new Map();
  private adjacency: Map<string, GraphEdge[]> = new Map();
  private reverseAdjacency: Map<string, GraphEdge[]> = new Map();

  constructor(
    private readonly tenantId: string,
    private readonly valueCaseId: string,
    private readonly store?: EntityGraphStore
  ) {}

  // --------------------------------------------------------------------------
  // Graph construction
  // --------------------------------------------------------------------------

  addNode(node: EntityNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
    if (!this.reverseAdjacency.has(node.id)) {
      this.reverseAdjacency.set(node.id, []);
    }
  }

  removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.adjacency.delete(nodeId);
    this.reverseAdjacency.delete(nodeId);
    // Remove all edges referencing this node
    for (const [key, edges] of this.adjacency) {
      this.adjacency.set(
        key,
        edges.filter((e) => e.targetId !== nodeId)
      );
    }
    for (const [key, edges] of this.reverseAdjacency) {
      this.reverseAdjacency.set(
        key,
        edges.filter((e) => e.sourceId !== nodeId)
      );
    }
  }

  addEdge(edge: GraphEdge): void {
    // Validate no self-loop
    if (edge.sourceId === edge.targetId && edge.sourceType === edge.targetType) {
      throw new EntityGraphError("Self-loop edges are not allowed");
    }

    const outgoing = this.adjacency.get(edge.sourceId) ?? [];
    outgoing.push(edge);
    this.adjacency.set(edge.sourceId, outgoing);

    const incoming = this.reverseAdjacency.get(edge.targetId) ?? [];
    incoming.push(edge);
    this.reverseAdjacency.set(edge.targetId, incoming);
  }

  removeEdge(edgeId: string): void {
    for (const [key, edges] of this.adjacency) {
      this.adjacency.set(
        key,
        edges.filter((e) => e.id !== edgeId)
      );
    }
    for (const [key, edges] of this.reverseAdjacency) {
      this.reverseAdjacency.set(
        key,
        edges.filter((e) => e.id !== edgeId)
      );
    }
  }

  getNode(nodeId: string): EntityNode | undefined {
    return this.nodes.get(nodeId);
  }

  getNodes(): EntityNode[] {
    return Array.from(this.nodes.values());
  }

  getEdges(): GraphEdge[] {
    const allEdges: GraphEdge[] = [];
    for (const edges of this.adjacency.values()) {
      allEdges.push(...edges);
    }
    return allEdges;
  }

  getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.adjacency.get(nodeId) ?? [];
  }

  getIncomingEdges(nodeId: string): GraphEdge[] {
    return this.reverseAdjacency.get(nodeId) ?? [];
  }

  // --------------------------------------------------------------------------
  // Cycle detection (Kahn's algorithm)
  // --------------------------------------------------------------------------

  detectCycle(): CycleDetectionResult {
    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edges of this.adjacency.values()) {
      for (const edge of edges) {
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    let processed = 0;
    while (queue.length > 0) {
      const current = queue.shift()!;
      processed++;
      for (const edge of this.adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(edge.targetId) ?? 1) - 1;
        inDegree.set(edge.targetId, newDegree);
        if (newDegree === 0) queue.push(edge.targetId);
      }
    }

    if (processed === this.nodes.size) {
      return { hasCycle: false, cyclePath: [] };
    }

    // Find cycle path via DFS
    const cyclePath = this.findCyclePath();
    return { hasCycle: true, cyclePath };
  }

  private findCyclePath(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    for (const nodeId of this.nodes.keys()) {
      if (this.dfsForCycle(nodeId, visited, recursionStack, path)) {
        return path;
      }
    }
    return [];
  }

  private dfsForCycle(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): boolean {
    if (recursionStack.has(nodeId)) {
      path.push(nodeId);
      return true;
    }
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    for (const edge of this.adjacency.get(nodeId) ?? []) {
      if (this.dfsForCycle(edge.targetId, visited, recursionStack, path)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    path.pop();
    return false;
  }

  // --------------------------------------------------------------------------
  // Topological sort (Kahn's algorithm)
  // --------------------------------------------------------------------------

  topologicalSort(): string[] {
    const cycle = this.detectCycle();
    if (cycle.hasCycle) {
      throw new EntityGraphError(
        `Cannot topologically sort: cycle detected through [${cycle.cyclePath.join(" → ")}]`
      );
    }

    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const edges of this.adjacency.values()) {
      for (const edge of edges) {
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const edge of this.adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(edge.targetId) ?? 1) - 1;
        inDegree.set(edge.targetId, newDegree);
        if (newDegree === 0) queue.push(edge.targetId);
      }
    }

    return sorted;
  }

  // --------------------------------------------------------------------------
  // Value propagation
  // --------------------------------------------------------------------------

  /**
   * Propagate a value change from a source node through all downstream
   * dependencies using topological ordering.
   *
   * @param sourceNodeId - The node whose value changed
   * @param newValue     - The new value for the source node
   * @returns Array of propagation results for every affected node
   */
  propagateChange(
    sourceNodeId: string,
    newValue: number
  ): PropagationResult[] {
    const sourceNode = this.nodes.get(sourceNodeId);
    if (!sourceNode) {
      throw new EntityGraphError(`Node ${sourceNodeId} not found in graph`);
    }

    const previousValue = sourceNode.value;
    const delta = newValue - previousValue;
    sourceNode.value = newValue;

    const results: PropagationResult[] = [
      {
        nodeId: sourceNodeId,
        nodeType: sourceNode.type,
        previousValue,
        newValue,
        delta,
        depth: 0,
        path: [sourceNodeId],
      },
    ];

    if (delta === 0) return results;

    // BFS propagation in topological order
    const order = this.topologicalSort();
    const sourceIndex = order.indexOf(sourceNodeId);
    const downstream = order.slice(sourceIndex + 1);

    // Track accumulated deltas per node
    const deltas = new Map<string, number>();
    deltas.set(sourceNodeId, delta);

    // Track paths for provenance
    const paths = new Map<string, string[]>();
    paths.set(sourceNodeId, [sourceNodeId]);

    for (const nodeId of downstream) {
      const incomingEdges = this.reverseAdjacency.get(nodeId) ?? [];
      let accumulatedDelta = 0;
      let bestPath: string[] = [];

      for (const edge of incomingEdges) {
        const sourceDelta = deltas.get(edge.sourceId);
        if (sourceDelta === undefined || sourceDelta === 0) continue;

        const propagatedDelta = this.applyPropagation(
          sourceDelta,
          edge.weight,
          edge.propagationType as PropagationType
        );
        accumulatedDelta += propagatedDelta;

        const sourcePath = paths.get(edge.sourceId) ?? [];
        if (sourcePath.length + 1 > bestPath.length) {
          bestPath = [...sourcePath, nodeId];
        }
      }

      if (accumulatedDelta !== 0) {
        const node = this.nodes.get(nodeId);
        if (node) {
          const prev = node.value;
          node.value += accumulatedDelta;
          deltas.set(nodeId, accumulatedDelta);
          paths.set(nodeId, bestPath);

          results.push({
            nodeId,
            nodeType: node.type,
            previousValue: prev,
            newValue: node.value,
            delta: accumulatedDelta,
            depth: bestPath.length - 1,
            path: bestPath,
          });
        }
      }
    }

    return results;
  }

  private applyPropagation(
    delta: number,
    weight: number,
    propagationType: PropagationType
  ): number {
    switch (propagationType) {
      case "linear":
        return delta * weight;
      case "multiplicative":
        // Weight acts as an elasticity coefficient
        return delta * weight;
      case "threshold":
        // Only propagate if delta exceeds weight (used as threshold)
        return Math.abs(delta) >= weight ? delta : 0;
      case "custom":
        // Custom propagation defers to metadata; default to linear
        return delta * weight;
      default:
        return delta * weight;
    }
  }

  // --------------------------------------------------------------------------
  // Subgraph extraction
  // --------------------------------------------------------------------------

  /**
   * Extract the downstream dependency subgraph from a given node.
   */
  getDownstreamSubgraph(nodeId: string): { nodes: EntityNode[]; edges: GraphEdge[] } {
    const visited = new Set<string>();
    const subNodes: EntityNode[] = [];
    const subEdges: GraphEdge[] = [];

    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (node) subNodes.push(node);

      for (const edge of this.adjacency.get(current) ?? []) {
        subEdges.push(edge);
        if (!visited.has(edge.targetId)) {
          queue.push(edge.targetId);
        }
      }
    }

    return { nodes: subNodes, edges: subEdges };
  }

  /**
   * Extract the upstream dependency subgraph (ancestors) of a given node.
   */
  getUpstreamSubgraph(nodeId: string): { nodes: EntityNode[]; edges: GraphEdge[] } {
    const visited = new Set<string>();
    const subNodes: EntityNode[] = [];
    const subEdges: GraphEdge[] = [];

    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (node) subNodes.push(node);

      for (const edge of this.reverseAdjacency.get(current) ?? []) {
        subEdges.push(edge);
        if (!visited.has(edge.sourceId)) {
          queue.push(edge.sourceId);
        }
      }
    }

    return { nodes: subNodes, edges: subEdges };
  }

  // --------------------------------------------------------------------------
  // Persistence helpers
  // --------------------------------------------------------------------------

  /**
   * Load the graph from the store for a given value case.
   */
  async loadFromStore(): Promise<void> {
    if (!this.store) {
      throw new EntityGraphError("No store configured for persistence");
    }

    const edges = await this.store.getEntityEdges(this.tenantId, this.valueCaseId);
    for (const edge of edges) {
      // Ensure nodes exist for both endpoints
      if (!this.nodes.has(edge.sourceId)) {
        this.addNode({
          id: edge.sourceId,
          type: edge.sourceType,
          label: edge.sourceId,
          value: 0,
          metadata: {},
        });
      }
      if (!this.nodes.has(edge.targetId)) {
        this.addNode({
          id: edge.targetId,
          type: edge.targetType,
          label: edge.targetId,
          value: 0,
          metadata: {},
        });
      }
      this.addEdge(edge);
    }
  }

  /**
   * Persist the current graph state to the store.
   */
  async saveToStore(): Promise<void> {
    if (!this.store) {
      throw new EntityGraphError("No store configured for persistence");
    }

    for (const edge of this.getEdges()) {
      await this.store.upsertEntityEdge(this.tenantId, this.valueCaseId, edge);
    }
  }

  // --------------------------------------------------------------------------
  // Serialization
  // --------------------------------------------------------------------------

  toJSON(): { nodes: EntityNode[]; edges: GraphEdge[] } {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    };
  }

  static fromJSON(
    tenantId: string,
    valueCaseId: string,
    data: { nodes: EntityNode[]; edges: GraphEdge[] },
    store?: EntityGraphStore
  ): EntityGraph {
    const graph = new EntityGraph(tenantId, valueCaseId, store);
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }
    return graph;
  }
}

// ============================================================================
// Error class
// ============================================================================

export class EntityGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityGraphError";
  }
}
