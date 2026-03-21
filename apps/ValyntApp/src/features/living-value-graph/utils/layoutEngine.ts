/**
 * Layout Engine for ValueTreeCanvas
 *
 * Provides a proper hierarchical tree layout using the ELK (Eclipse Layout Kernel)
 * algorithm via elkjs. This replaces the naive `index * 250` positioning that
 * caused node overlaps and produced unreadable graphs.
 *
 * The engine computes positions asynchronously and returns React Flow-compatible
 * node positions. It supports left-to-right (LR) and top-to-bottom (TB) layouts.
 */

import ELK, { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";
import { Node, Edge } from "reactflow";

const elk = new ELK();

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSeparation?: number;
  rankSeparation?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: "TB",
  nodeWidth: 200,
  nodeHeight: 80,
  nodeSeparation: 40,
  rankSeparation: 80,
};

/**
 * Compute hierarchical layout positions for a set of React Flow nodes and edges
 * using the ELK layout engine.
 *
 * @param nodes - React Flow nodes (positions will be overwritten)
 * @param edges - React Flow edges
 * @param options - Layout configuration options
 * @returns Promise resolving to nodes with computed positions
 */
export async function computeElkLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<Node[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const elkNodes: ElkNode["children"] = nodes.map((node) => ({
    id: node.id,
    width: opts.nodeWidth,
    height: opts.nodeHeight,
  }));

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const elkGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": opts.direction,
      "elk.spacing.nodeNode": String(opts.nodeSeparation),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(opts.rankSeparation),
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layouted = await elk.layout(elkGraph);

  return nodes.map((node) => {
    const elkNode = layouted.children?.find((n) => n.id === node.id);
    if (!elkNode?.x || !elkNode?.y) return node;
    return {
      ...node,
      position: {
        x: elkNode.x,
        y: elkNode.y,
      },
    };
  });
}

/**
 * Synchronous fallback layout using a simple Reingold-Tilford-inspired
 * tree layout. Used when ELK is unavailable or for initial render.
 *
 * This is significantly better than the naive `index * 250` approach
 * as it respects the parent-child hierarchy of the graph.
 *
 * @param nodes - React Flow nodes
 * @param edges - React Flow edges
 * @param options - Layout configuration options
 * @returns Nodes with computed positions
 */
export function computeFallbackLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodeWidth = opts.nodeWidth + opts.nodeSeparation;
  const nodeHeight = opts.nodeHeight + opts.rankSeparation;

  // Build adjacency map for parent → children
  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();

  for (const edge of edges) {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(edge.target);
    parentMap.set(edge.target, edge.source);
  }

  // Find root nodes (nodes with no parent)
  const rootIds = nodes
    .map((n) => n.id)
    .filter((id) => !parentMap.has(id));

  // BFS to assign levels
  const levelMap = new Map<string, number>();
  const queue: Array<{ id: string; level: number }> = rootIds.map((id) => ({
    id,
    level: 0,
  }));

  while (queue.length > 0) {
    const item = queue.shift()!;
    levelMap.set(item.id, item.level);
    const children = childrenMap.get(item.id) ?? [];
    for (const child of children) {
      queue.push({ id: child, level: item.level + 1 });
    }
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>();
  for (const [id, level] of levelMap.entries()) {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  }

  // Assign positions
  const positionMap = new Map<string, { x: number; y: number }>();

  for (const [level, ids] of levelGroups.entries()) {
    const totalWidth = ids.length * nodeWidth;
    const startX = -totalWidth / 2;
    ids.forEach((id, i) => {
      positionMap.set(id, {
        x: startX + i * nodeWidth,
        y: level * nodeHeight,
      });
    });
  }

  // Handle nodes not in the graph (no edges)
  let orphanX = 0;
  const maxLevel = Math.max(...levelMap.values(), 0);

  return nodes.map((node) => {
    const pos = positionMap.get(node.id);
    if (pos) {
      return { ...node, position: pos };
    }
    // Orphan nodes placed below the main tree
    const orphanPos = { x: orphanX, y: (maxLevel + 1) * nodeHeight };
    orphanX += nodeWidth;
    return { ...node, position: orphanPos };
  });
}
