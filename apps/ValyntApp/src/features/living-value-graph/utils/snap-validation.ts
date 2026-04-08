/**
 * Snap Validation — Magnetic Connection Compatibility
 *
 * Phase 5.1: Canvas Physics — Magnetic Connections
 *
 * Defines which node types can connect to which other types.
 * Used for magnetic snap validation during drag-and-drop.
 */

import type { ValueNode } from "@/features/living-value-graph/types/graph.types";

/**
 * Compatibility matrix for magnetic snap connections.
 * Maps source node type to array of valid target node types.
 *
 * Rules:
 * - input → driver, metric (raw data feeds into drivers and metrics)
 * - driver → output, metric (drivers calculate outputs and metrics)
 * - metric → output, driver (metrics can drive outputs or feed back into drivers)
 * - output → [] (outputs are terminal nodes, cannot connect further)
 * - assumption → driver, input, metric (assumptions modify calculations)
 */
export const SNAP_COMPATIBILITY: Readonly<Record<ValueNode["type"], ValueNode["type"][]>> = {
  input: ["driver", "metric"],
  driver: ["output", "metric"],
  metric: ["output", "driver"],
  output: [],
  assumption: ["driver", "input", "metric"],
} as const;

/**
 * Check if a connection between two node types is valid.
 *
 * @param sourceType — Type of the source node
 * @param targetType — Type of the target node
 * @returns true if the connection is valid
 */
export function isValidConnection(
  sourceType: ValueNode["type"],
  targetType: ValueNode["type"]
): boolean {
  return SNAP_COMPATIBILITY[sourceType].includes(targetType);
}

/**
 * Get all valid target types for a given source type.
 *
 * @param sourceType — Type of the source node
 * @returns Array of valid target types
 */
export function getValidTargets(sourceType: ValueNode["type"]): ValueNode["type"][] {
  return [...SNAP_COMPATIBILITY[sourceType]];
}

/**
 * Get snap radius for magnetic pull effect.
 * When dragging a node within this distance of a valid target,
 * show the magnetic pull animation.
 *
 * @returns Snap radius in pixels
 */
export function getSnapRadius(): number {
  return 100;
}

/**
 * Check if two nodes are within snap radius.
 *
 * @param sourcePos — Position of source node
 * @param targetPos — Position of target node
 * @returns true if within snap radius
 */
export function isWithinSnapRadius(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): boolean {
  const dx = sourcePos.x - targetPos.x;
  const dy = sourcePos.y - targetPos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= getSnapRadius();
}

/**
 * Calculate magnetic pull strength based on distance.
 * Closer distance = stronger pull.
 *
 * @param distance — Current distance between nodes in pixels
 * @returns Pull strength as a value 0-1
 */
export function calculateMagneticPull(distance: number): number {
  const radius = getSnapRadius();
  if (distance >= radius) return 0;
  return 1 - distance / radius;
}

/**
 * Get CSS transform for magnetic pull animation.
 *
 * @param sourcePos — Current source position
 * @param targetPos — Target position to pull toward
 * @returns CSS transform string
 */
export function getMagneticTransform(
  sourcePos: { x: number; y: number },
  targetPos: { x: number; y: number }
): string {
  const dx = targetPos.x - sourcePos.x;
  const dy = targetPos.y - sourcePos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const pull = calculateMagneticPull(distance);

  // Apply subtle pull (max 20px movement)
  const moveX = (dx / distance) * pull * 20;
  const moveY = (dy / distance) * pull * 20;

  return `translate(${moveX}px, ${moveY}px)`;
}

/**
 * Validate edge type for a connection.
 * Different connection types have different validation rules.
 *
 * @param edgeType — Type of edge being created
 * @param sourceType — Source node type
 * @param targetType — Target node type
 * @returns true if the edge type is valid for this connection
 */
export function isValidEdgeType(
  edgeType: "dependency" | "calculation" | "input",
  sourceType: ValueNode["type"],
  targetType: ValueNode["type"]
): boolean {
  // All edge types must pass base compatibility
  if (!isValidConnection(sourceType, targetType)) {
    return false;
  }

  // Edge-specific rules
  switch (edgeType) {
    case "input":
      // Only input nodes can create input edges
      return sourceType === "input";
    case "calculation":
      // Drivers and metrics can create calculation edges
      return sourceType === "driver" || sourceType === "metric";
    case "dependency":
      // Any valid connection can be a dependency
      return true;
    default:
      return false;
  }
}
