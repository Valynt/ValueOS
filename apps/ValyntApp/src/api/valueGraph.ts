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

export interface ClaimCentricViewResponse {
  opportunity_id: string;
  organization_id: string;
  claims: Array<{
    claim: {
      id: string;
      claim_text: string;
      impact_level: "low" | "medium" | "high";
      created_at: string;
      updated_at: string;
    };
    latest_confidence: {
      confidence_score: number;
      evidence_coverage_score: number;
      rationale: string | null;
      scorer_name: string;
      scorer_version: string;
      recorded_at: string;
    } | null;
    confidence_history: Array<{
      confidence_score: number;
      evidence_coverage_score: number;
      rationale: string | null;
      recorded_at: string;
      lifecycle_stage: string | null;
    }>;
    evidence_links: Array<{
      edge: {
        id: string;
        edge_type: "supports" | "contradicts" | "insufficient_for";
        rationale: string | null;
        created_at: string;
      };
      evidence: {
        id: string;
        title: string;
        source_uri: string | null;
        excerpt: string | null;
        version_no: number;
        captured_at: string;
      } | null;
    }>;
  }>;
}

export interface EvidenceCentricViewResponse {
  opportunity_id: string;
  organization_id: string;
  evidence: Array<{
    artifact: {
      id: string;
      title: string;
      source_uri: string | null;
      excerpt: string | null;
      version_no: number;
      captured_at: string;
    };
    linked_claims: Array<{
      edge: {
        id: string;
        edge_type: "supports" | "contradicts" | "insufficient_for";
        rationale: string | null;
      };
      claim: {
        id: string;
        claim_text: string;
        impact_level: "low" | "medium" | "high";
      } | null;
      latest_confidence: {
        confidence_score: number;
        rationale: string | null;
        recorded_at: string;
      } | null;
    }>;
  }>;
}

export interface ConfidenceDriftViewResponse {
  opportunity_id: string;
  organization_id: string;
  generated_at: string;
  claims: Array<{
    claim_id: string;
    claim_text: string;
    first_score: number;
    latest_score: number;
    delta: number;
    first_recorded_at: string;
    latest_recorded_at: string;
    timeline: Array<{
      confidence_score: number;
      evidence_coverage_score: number;
      rationale: string | null;
      recorded_at: string;
    }>;
  }>;
}

export async function fetchClaimCentricView(opportunityId: string): Promise<ClaimCentricViewResponse> {
  const result = await apiClient.get<ClaimCentricViewResponse>(
    `/api/v1/opportunities/${opportunityId}/claim-evidence/claims`,
  );

  if (!result.success || !result.data) {
    throw new Error(result.error?.message ?? "Failed to load claim-centric view");
  }

  return result.data;
}

export async function fetchEvidenceCentricView(opportunityId: string): Promise<EvidenceCentricViewResponse> {
  const result = await apiClient.get<EvidenceCentricViewResponse>(
    `/api/v1/opportunities/${opportunityId}/claim-evidence/evidence`,
  );

  if (!result.success || !result.data) {
    throw new Error(result.error?.message ?? "Failed to load evidence-centric view");
  }

  return result.data;
}

export async function fetchConfidenceDriftView(opportunityId: string): Promise<ConfidenceDriftViewResponse> {
  const result = await apiClient.get<ConfidenceDriftViewResponse>(
    `/api/v1/opportunities/${opportunityId}/claim-evidence/confidence-drift`,
  );

  if (!result.success || !result.data) {
    throw new Error(result.error?.message ?? "Failed to load confidence drift view");
  }

  return result.data;
}
