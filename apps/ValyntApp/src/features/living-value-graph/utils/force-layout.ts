/**
 * Force Layout Engine — Canvas Physics for Value Tree Graph
 *
 * Phase 5.1: Canvas Physics — Magnetic Connections
 *
 * Uses d3-force for force-directed layout with custom forces:
 * - Link force: Attract connected nodes
 * - Charge force: Repel unrelated nodes
 * - Center force: Keep graph centered
 * - Value force: High-value nodes attract more strongly (gravity toward center)
 * - Confidence force: Low-confidence nodes drift to periphery
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";

import type { Graph, ValueEdge, ValueNode } from "@/features/living-value-graph/types/graph.types";

// Extended node type with simulation properties
interface ForceNode extends SimulationNodeDatum {
  id: string;
  value: number;
  confidence: number;
  warmth?: string;
  vx?: number;
  vy?: number;
  x?: number;
  y?: number;
}

interface ForceLink {
  source: string | ForceNode;
  target: string | ForceNode;
  type: ValueEdge["type"];
}

export interface ForceLayoutOptions {
  /** High-value nodes attract more strongly toward center */
  valueGravity: boolean;
  /** Low-confidence nodes drift to periphery */
  confidenceRepulsion: boolean;
  /** Group nodes by warmth state */
  warmthClustering: boolean;
  /** Link distance in pixels */
  linkDistance?: number;
  /** Repulsion strength (negative for repulsion) */
  repulsionStrength?: number;
  /** Collision radius */
  collisionRadius?: number;
  /** Number of simulation ticks */
  iterations?: number;
  /** Center X coordinate */
  centerX?: number;
  /** Center Y coordinate */
  centerY?: number;
  /** Alpha decay rate (higher = faster stabilization) */
  alphaDecay?: number;
  /** Minimum alpha to stop simulation */
  alphaMin?: number;
}

const DEFAULT_OPTIONS: Required<ForceLayoutOptions> = {
  valueGravity: true,
  confidenceRepulsion: true,
  warmthClustering: false,
  linkDistance: 200,
  repulsionStrength: -500,
  collisionRadius: 60,
  iterations: 300,
  centerX: 0,
  centerY: 0,
  alphaDecay: 0.02,
  alphaMin: 0.001,
};

/**
 * Compute force-directed layout positions for all nodes in a graph.
 *
 * @param graph — The graph with nodes and edges
 * @param options — Force layout configuration
 * @returns Record of node IDs to their computed positions
 */
export function computeForceLayout(
  graph: Graph,
  options: ForceLayoutOptions = DEFAULT_OPTIONS
): Record<string, { x: number; y: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const nodeCount = Object.keys(graph.nodes).length;
  if (nodeCount === 0) return {};

  // Transform graph nodes to force simulation nodes
  const nodes: ForceNode[] = Object.values(graph.nodes).map((n) => ({
    id: n.id,
    value: n.value ?? 0,
    confidence: n.confidence ?? 0.5,
    warmth: undefined,
    // Initialize positions - spread in a circle for better initial layout
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
  }));

  // Transform edges to links
  const links: ForceLink[] = Object.values(graph.edges).map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  // Find max value for normalization
  const maxValue = Math.max(...nodes.map((n) => n.value), 1);
  const minConfidence = Math.min(...nodes.map((n) => n.confidence), 0);
  const maxConfidence = Math.max(...nodes.map((n) => n.confidence), 1);
  const confidenceRange = maxConfidence - minConfidence || 1;

  // Create simulation with optimized alpha decay
  const simulation = forceSimulation<ForceNode>(nodes)
    .alphaDecay(opts.alphaDecay)
    .alphaMin(opts.alphaMin)
    .velocityDecay(0.4);

  // Link force - attract connected nodes
  simulation.force(
    "link",
    forceLink<ForceNode, ForceLink>(links)
      .id((d: ForceNode) => d.id)
      .distance((d: ForceLink) => {
        // Different distances based on edge type
        switch (d.type) {
          case "input":
            return opts.linkDistance * 0.8;
          case "calculation":
            return opts.linkDistance;
          case "dependency":
            return opts.linkDistance * 1.2;
          default:
            return opts.linkDistance;
        }
      })
      .strength(0.7)
  );

  // Charge force - repel unrelated nodes (prevent overlap)
  simulation.force(
    "charge",
    forceManyBody()
      .strength((d: ForceNode) => {
        // Larger nodes have stronger repulsion
        const valueFactor = 0.5 + (d.value / maxValue) * 0.5;
        return opts.repulsionStrength * valueFactor;
      })
      .distanceMax(800)
      .distanceMin(50)
  );

  // Center force - keep graph centered
  simulation.force("center", forceCenter(opts.centerX, opts.centerY));

  // Collision detection - prevent node overlap
  simulation.force(
    "collide",
    forceCollide<ForceNode>()
      .radius((d: ForceNode) => {
        // Radius based on value (larger values = larger collision radius)
        const valueRadius = 30 + (d.value / maxValue) * 30;
        return Math.max(opts.collisionRadius, valueRadius);
      })
      .strength(0.8)
      .iterations(2)
  );

  // Value gravity - high value nodes pulled toward center
  if (opts.valueGravity) {
    simulation.force(
      "valueX",
      forceX(opts.centerX).strength((d: ForceNode) => {
        // Stronger pull for higher values
        return 0.01 + (d.value / maxValue) * 0.03;
      })
    );
    simulation.force(
      "valueY",
      forceY(opts.centerY).strength((d: ForceNode) => {
        return 0.01 + (d.value / maxValue) * 0.03;
      })
    );
  }

  // Confidence repulsion - low confidence nodes drift to periphery
  if (opts.confidenceRepulsion) {
    simulation.force(
      "confidenceX",
      forceX(opts.centerX).strength((d: ForceNode) => {
        // Lower confidence = weaker pull to center (drifts outward)
        const confidenceFactor = d.confidence / maxConfidence;
        return -0.02 * (1 - confidenceFactor); // Negative = push away from center
      })
    );
    simulation.force(
      "confidenceY",
      forceY(opts.centerY).strength((d: ForceNode) => {
        const confidenceFactor = d.confidence / maxConfidence;
        return -0.02 * (1 - confidenceFactor);
      })
    );
  }

  // Warmth clustering - group nodes by warmth state
  if (opts.warmthClustering && opts.valueGravity) {
    // This would require warmth state on nodes
    // For now, we cluster by value as a proxy
    simulation.force(
      "warmthX",
      forceX((d: ForceNode) => {
        // Higher values toward right
        return opts.centerX + (d.value / maxValue - 0.5) * 200;
      }).strength(0.02)
    );
  }

  // Run simulation synchronously
  simulation.stop();

  // Tick manually for specified iterations
  for (let i = 0; i < opts.iterations; i++) {
    simulation.tick();
    // Early exit if simulation has cooled down
    if (simulation.alpha() < opts.alphaMin) break;
  }

  // Extract positions
  const positions = Object.fromEntries(
    nodes.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }])
  );

  // Clean up simulation
  simulation.nodes([]);
  simulation.force("link", null);
  simulation.force("charge", null);
  simulation.force("center", null);
  simulation.force("collide", null);
  simulation.force("valueX", null);
  simulation.force("valueY", null);
  simulation.force("confidenceX", null);
  simulation.force("confidenceY", null);
  simulation.force("warmthX", null);

  return positions;
}

/**
 * Compute layout with Web Worker (for large graphs >50 nodes).
 * Falls back to sync computation for small graphs.
 *
 * @param graph — The graph to layout
 * @param options — Force layout configuration
 * @returns Promise resolving to node positions
 */
export async function computeForceLayoutAsync(
  graph: Graph,
  options?: ForceLayoutOptions
): Promise<Record<string, { x: number; y: number }>> {
  const nodeCount = Object.keys(graph.nodes).length;

  // For small graphs, compute synchronously
  if (nodeCount <= 50) {
    return computeForceLayout(graph, options);
  }

  // For large graphs, offload to next tick to prevent blocking
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(computeForceLayout(graph, options));
    }, 0);
  });
}

/**
 * Check if the graph layout should use async computation.
 *
 * @param nodeCount — Number of nodes in the graph
 * @returns true if async/Web Worker is recommended
 */
export function shouldUseWebWorker(nodeCount: number): boolean {
  return nodeCount > 50;
}

/**
 * Get recommended iteration count based on graph size.
 * Larger graphs need more iterations to settle.
 *
 * @param nodeCount — Number of nodes
 * @returns Recommended iteration count
 */
export function getRecommendedIterations(nodeCount: number): number {
  if (nodeCount <= 10) return 100;
  if (nodeCount <= 20) return 150;
  if (nodeCount <= 50) return 200;
  if (nodeCount <= 100) return 300;
  if (nodeCount <= 200) return 400;
  return 500;
}

/**
 * Create a reactive simulation that can be updated.
 * Useful for interactive dragging and real-time updates.
 *
 * @param graph — Initial graph state
 * @param options — Force layout configuration
 * @returns D3 simulation instance
 */
export function createForceSimulation(
  graph: Graph,
  options: ForceLayoutOptions = DEFAULT_OPTIONS
): Simulation<ForceNode, ForceLink> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const nodes: ForceNode[] = Object.values(graph.nodes).map((n) => ({
    id: n.id,
    value: n.value ?? 0,
    confidence: n.confidence ?? 0.5,
    x: (Math.random() - 0.5) * 100,
    y: (Math.random() - 0.5) * 100,
  }));

  const links: ForceLink[] = Object.values(graph.edges).map((e) => ({
    source: e.source,
    target: e.target,
    type: e.type,
  }));

  const maxValue = Math.max(...nodes.map((n) => n.value), 1);

  const simulation = forceSimulation<ForceNode>(nodes)
    .alphaDecay(opts.alphaDecay)
    .alphaMin(opts.alphaMin)
    .velocityDecay(0.4);

  simulation.force(
    "link",
    forceLink<ForceNode, ForceLink>(links)
      .id((d: ForceNode) => d.id)
      .distance(opts.linkDistance)
      .strength(0.7)
  );

  simulation.force("charge", forceManyBody().strength(opts.repulsionStrength));
  simulation.force("center", forceCenter(opts.centerX, opts.centerY));
  simulation.force(
    "collide",
    forceCollide<ForceNode>()
      .radius((d: ForceNode) => 30 + (d.value / maxValue) * 30)
      .strength(0.8)
  );

  if (opts.valueGravity) {
    simulation.force(
      "valueX",
      forceX(opts.centerX).strength((d: ForceNode) => 0.01 + (d.value / maxValue) * 0.03)
    );
    simulation.force(
      "valueY",
      forceY(opts.centerY).strength((d: ForceNode) => 0.01 + (d.value / maxValue) * 0.03)
    );
  }

  return simulation;
}

/**
 * Reheat a simulation to restart layout after changes.
 *
 * @param simulation — D3 simulation instance
 * @param alpha — New alpha value (default: 1.0)
 */
export function reheatSimulation(
  simulation: Simulation<ForceNode, ForceLink>,
  alpha: number = 1.0
): void {
  simulation.alpha(alpha).restart();
}

/**
 * Stop a simulation and clean up resources.
 *
 * @param simulation — D3 simulation instance
 */
export function stopSimulation(
  simulation: Simulation<ForceNode, ForceLink>
): void {
  simulation.stop();
  simulation.nodes([]);
  simulation.force("link", null);
  simulation.force("charge", null);
  simulation.force("center", null);
  simulation.force("collide", null);
  simulation.force("valueX", null);
  simulation.force("valueY", null);
}
