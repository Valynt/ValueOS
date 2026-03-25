/**
 * Value Graph API client
 *
 * Typed wrappers around GET /api/v1/opportunities/:opportunityId/value-graph.
 * All calls go through the shared UnifiedApiClient so auth headers and retry
 * logic are handled centrally.
 *
 * Sprint 50: Initial implementation.
 */

import type {
  ValueGraphEdge,
  ValueGraphEntityType,
  VgCapability,
  VgMetric,
  VgValueDriver,
} from "@valueos/shared";

import { apiClient } from "@/api/client/unified-api-client";

// ---------------------------------------------------------------------------
// Graph shape types (mirrors ValueGraph / ValueGraphNode from backend service)
// ---------------------------------------------------------------------------

export interface ValueGraphNode {
  entity_type: ValueGraphEntityType;
  entity_id: string;
  data: Record<string, unknown>;
}

export interface ValueGraph {
  opportunity_id: string;
  organization_id: string;
  ontology_version: string;
  nodes: ValueGraphNode[];
  edges: ValueGraphEdge[];
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/**
 * A single traversable path from a UseCase to a VgValueDriver.
 * Mirrors ValuePath from ValueGraphService on the backend.
 */
export interface ValuePath {
  edges: ValueGraphEdge[];
  path_confidence: number;
  value_driver: VgValueDriver;
  use_case_id: string;
  metrics: VgMetric[];
  capabilities: VgCapability[];
}

export interface ValueGraphResponse {
  graph: ValueGraph;
  paths: ValuePath[];
}

// ---------------------------------------------------------------------------
// API function
// ---------------------------------------------------------------------------

/**
 * Fetch the Value Graph and value paths for an opportunity.
 * Paths are pre-sorted by path_confidence descending by the server.
 */
export async function fetchValueGraph(
  opportunityId: string
): Promise<ValueGraphResponse> {
  const result = await apiClient.get<ValueGraphResponse>(
    `/api/v1/opportunities/${opportunityId}/value-graph`
  );

  if (!result.success || !result.data) {
    throw new Error(result.error?.message ?? "Failed to load value graph");
  }

  return result.data;
}

// Re-export entity types used by consumers so they don't need a second import
export type {
  ValueGraphEntityType,
  VgCapability,
  VgMetric,
  VgValueDriver,
  ValueGraphEdge,
};
