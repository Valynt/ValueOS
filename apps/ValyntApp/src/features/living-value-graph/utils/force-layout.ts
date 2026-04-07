/**
 * Force Layout Engine — Canvas Physics for Value Tree Graph
 *
 * Phase 5.1: Canvas Physics — Magnetic Connections
 */

import type {
  SimulationNodeDatum,
} from "d3-force";

import type { Graph, ValueNode } from "@/features/living-value-graph/types/graph.types";

// Extended node type with simulation properties
interface ForceNode extends SimulationNodeDatum {
  id: string;
  value: number;
  confidence: number;
  warmth?: string;
}

export interface ForceLayoutOptions {
  valueGravity: boolean;
  confidenceRepulsion: boolean;
  warmthClustering: boolean;
  linkDistance?: number;
  repulsionStrength?: number;
  collisionRadius?: number;
  iterations?: number;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_OPTIONS: Required<ForceLayoutOptions> = {
  valueGravity: true,
  confidenceRepulsion: true,
  warmthClustering: false,
  linkDistance: 200,
  repulsionStrength: -300,
  collisionRadius: 80,
  iterations: 300,
  centerX: 0,
  centerY: 0,
};

/**
 * Stub: computeForceLayout - requires d3-force to be installed.
 * Returns a simple grid layout as fallback until d3-force is available.
 */
export function computeForceLayout(
  graph: Graph,
  options?: ForceLayoutOptions
): Record<string, { x: number; y: number }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes = Object.values(graph.nodes);

  // Simple grid layout as stub
  const positions: Record<string, { x: number; y: number }> = {};
  const cols = Math.ceil(Math.sqrt(nodes.length));

  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions[node.id] = {
      x: (col - cols / 2) * (opts.linkDistance ?? 200),
      y: (row - Math.ceil(nodes.length / cols) / 2) * (opts.linkDistance ?? 200),
    };
  });

  return positions;
}

/**
 * Async version with Web Worker support.
 */
export async function computeForceLayoutAsync(
  graph: Graph,
  options?: ForceLayoutOptions
): Promise<Record<string, { x: number; y: number }>> {
  // For now, use sync version
  return computeForceLayout(graph, options);
}

/**
 * Check if Web Worker should be used.
 */
export function shouldUseWebWorker(nodeCount: number): boolean {
  return nodeCount > 50;
}

/**
 * Get recommended iteration count.
 */
export function getRecommendedIterations(nodeCount: number): number {
  if (nodeCount <= 20) return 100;
  if (nodeCount <= 50) return 200;
  if (nodeCount <= 100) return 300;
  return 400;
}
