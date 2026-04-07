/**
 * Cluster View — Simplified view for large graphs
 *
 * Phase 5.1: Canvas Physics — Magnetic Connections
 *
 * When node count exceeds threshold, auto-switch to clustered view
 * that groups nodes by type and shows aggregate values.
 */

import type { Graph, ValueNode } from "@/features/living-value-graph/types/graph.types";

/** Threshold at which to switch to simplified cluster view */
export const SIMPLIFIED_VIEW_THRESHOLD = 100;

/** Threshold for auto-switching to Web Worker physics */
export const WEB_WORKER_THRESHOLD = 50;

interface ClusterNode {
  id: string;
  type: ValueNode["type"];
  label: string;
  count: number;
  aggregateValue: number;
  averageConfidence: number;
  nodeIds: string[];
}

interface ClusterView {
  clusters: Record<string, ClusterNode>;
  totalNodes: number;
  isClustered: boolean;
}

/**
 * Determine if cluster view should be used based on node count.
 *
 * @param nodeCount — Number of nodes in the graph
 * @returns true if cluster view is recommended
 */
export function shouldUseClusterView(nodeCount: number): boolean {
  return nodeCount > SIMPLIFIED_VIEW_THRESHOLD;
}

/**
 * Group nodes into clusters by type.
 *
 * @param graph — The full graph
 * @returns Cluster view with aggregated data
 */
export function createClusterView(graph: Graph): ClusterView {
  const nodes = Object.values(graph.nodes);
  const clusters: Record<string, ClusterNode> = {};

  // Group nodes by type
  nodes.forEach((node) => {
    const type = node.type;
    const clusterId = `cluster-${type}`;

    if (!clusters[clusterId]) {
      clusters[clusterId] = {
        id: clusterId,
        type,
        label: `${type.charAt(0).toUpperCase() + type.slice(1)}s`,
        count: 0,
        aggregateValue: 0,
        averageConfidence: 0,
        nodeIds: [],
      };
    }

    const cluster = clusters[clusterId];
    cluster.count += 1;
    cluster.aggregateValue += node.value ?? 0;
    cluster.averageConfidence += node.confidence ?? 0;
    cluster.nodeIds.push(node.id);
  });

  // Calculate averages
  Object.values(clusters).forEach((cluster) => {
    cluster.averageConfidence = cluster.count > 0
      ? cluster.averageConfidence / cluster.count
      : 0;
  });

  return {
    clusters,
    totalNodes: nodes.length,
    isClustered: true,
  };
}

/**
 * Expand a cluster to show individual nodes.
 *
 * @param cluster — The cluster to expand
 * @param graph — The full graph
 * @returns Array of nodes in the cluster
 */
export function expandCluster(
  cluster: ClusterNode,
  graph: Graph
): ValueNode[] {
  return cluster.nodeIds
    .map((id) => graph.nodes[id])
    .filter((node): node is ValueNode => node !== undefined);
}

/**
 * Get cluster position in the layout.
 * Arranges clusters in a circle around the center.
 *
 * @param clusterIndex — Index of the cluster (0-based)
 * @param totalClusters — Total number of clusters
 * @param radius — Radius of the circle
 * @returns Position {x, y} for the cluster
 */
export function getClusterPosition(
  clusterIndex: number,
  totalClusters: number,
  radius: number = 300
): { x: number; y: number } {
  const angle = (2 * Math.PI * clusterIndex) / totalClusters - Math.PI / 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

/**
 * Get view mode recommendation based on graph size.
 *
 * @param nodeCount — Number of nodes
 * @returns Recommended view mode
 */
export function getRecommendedViewMode(
  nodeCount: number
): "full" | "clustered" | "simplified" {
  if (nodeCount <= 50) return "full";
  if (nodeCount <= SIMPLIFIED_VIEW_THRESHOLD) return "clustered";
  return "simplified";
}

/**
 * Get performance recommendations for a graph size.
 *
 * @param nodeCount — Number of nodes
 * @returns Performance configuration
 */
export function getPerformanceConfig(nodeCount: number): {
  useWebWorker: boolean;
  useClusterView: boolean;
  maxIterations: number;
  targetFps: number;
} {
  return {
    useWebWorker: nodeCount > WEB_WORKER_THRESHOLD,
    useClusterView: nodeCount > SIMPLIFIED_VIEW_THRESHOLD,
    maxIterations: getRecommendedIterations(nodeCount),
    targetFps: 60,
  };
}

/**
 * Get recommended iteration count for force simulation.
 *
 * @param nodeCount — Number of nodes
 * @returns Recommended iterations
 */
function getRecommendedIterations(nodeCount: number): number {
  if (nodeCount <= 20) return 100;
  if (nodeCount <= 50) return 200;
  if (nodeCount <= 100) return 300;
  return 400;
}
