import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase as defaultSupabase } from "../../lib/supabase.js";

export type LinkageEdgeType = "supports" | "contradicts" | "insufficient_for";

interface ClaimNodeRecord {
  id: string;
  organization_id: string;
  opportunity_id: string;
  hypothesis_id: string | null;
  claim_text: string;
  impact_level: "low" | "medium" | "high";
  created_by_agent: string;
  created_at: string;
  updated_at: string;
}

interface EvidenceArtifactRecord {
  id: string;
  organization_id: string;
  opportunity_id: string;
  artifact_type: string;
  source_uri: string | null;
  title: string;
  excerpt: string | null;
  captured_at: string;
  metadata: Record<string, unknown> | null;
  version_no: number;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ClaimEvidenceEdgeRecord {
  id: string;
  organization_id: string;
  opportunity_id: string;
  claim_id: string;
  evidence_artifact_id: string;
  edge_type: LinkageEdgeType;
  rationale: string | null;
  created_by: string;
  created_at: string;
}

interface ClaimConfidenceSnapshotRecord {
  id: string;
  organization_id: string;
  opportunity_id: string;
  claim_id: string;
  run_id: string | null;
  lifecycle_stage: string | null;
  confidence_score: number;
  evidence_coverage_score: number;
  scorer_name: string;
  scorer_version: string;
  provenance: Record<string, unknown> | null;
  rationale: string | null;
  recorded_at: string;
}

export interface ClaimCentricView {
  opportunity_id: string;
  organization_id: string;
  claims: Array<{
    claim: ClaimNodeRecord;
    latest_confidence: ClaimConfidenceSnapshotRecord | null;
    confidence_history: ClaimConfidenceSnapshotRecord[];
    evidence_links: Array<{
      edge: ClaimEvidenceEdgeRecord;
      evidence: EvidenceArtifactRecord | null;
    }>;
  }>;
}

export interface EvidenceCentricView {
  opportunity_id: string;
  organization_id: string;
  evidence: Array<{
    artifact: EvidenceArtifactRecord;
    linked_claims: Array<{
      edge: ClaimEvidenceEdgeRecord;
      claim: ClaimNodeRecord | null;
      latest_confidence: ClaimConfidenceSnapshotRecord | null;
    }>;
  }>;
}

export interface ConfidenceDriftView {
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
    timeline: ClaimConfidenceSnapshotRecord[];
  }>;
}

export class ClaimEvidenceGraphService {
  private readonly supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient = defaultSupabase) {
    this.supabase = supabaseClient;
  }

  async getClaimCentricView(
    opportunityId: string,
    organizationId: string,
    claimId?: string,
  ): Promise<ClaimCentricView> {
    const claims = await this.getClaims(opportunityId, organizationId, claimId);
    const claimIds = claims.map((claim) => claim.id);
    const [edges, artifacts, snapshots] = await Promise.all([
      this.getEdges(opportunityId, organizationId, claimIds),
      this.getArtifacts(opportunityId, organizationId),
      this.getSnapshots(opportunityId, organizationId, claimIds),
    ]);

    const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    const snapshotsByClaim = this.groupByClaim(snapshots);

    return {
      opportunity_id: opportunityId,
      organization_id: organizationId,
      claims: claims.map((claim) => {
        const claimSnapshots = snapshotsByClaim.get(claim.id) ?? [];
        const latest = claimSnapshots[claimSnapshots.length - 1] ?? null;
        return {
          claim,
          latest_confidence: latest,
          confidence_history: claimSnapshots,
          evidence_links: edges
            .filter((edge) => edge.claim_id === claim.id)
            .map((edge) => ({
              edge,
              evidence: artifactById.get(edge.evidence_artifact_id) ?? null,
            })),
        };
      }),
    };
  }

  async getEvidenceCentricView(
    opportunityId: string,
    organizationId: string,
    evidenceId?: string,
  ): Promise<EvidenceCentricView> {
    const artifacts = await this.getArtifacts(opportunityId, organizationId, evidenceId);
    const artifactIds = artifacts.map((artifact) => artifact.id);
    const edges = await this.getEdgesByArtifacts(opportunityId, organizationId, artifactIds);
    const claimIds = [...new Set(edges.map((edge) => edge.claim_id))];
    const [claims, snapshots] = await Promise.all([
      this.getClaims(opportunityId, organizationId, undefined, claimIds),
      this.getSnapshots(opportunityId, organizationId, claimIds),
    ]);

    const claimById = new Map(claims.map((claim) => [claim.id, claim]));
    const snapshotsByClaim = this.groupByClaim(snapshots);

    return {
      opportunity_id: opportunityId,
      organization_id: organizationId,
      evidence: artifacts.map((artifact) => ({
        artifact,
        linked_claims: edges
          .filter((edge) => edge.evidence_artifact_id === artifact.id)
          .map((edge) => {
            const claimSnapshots = snapshotsByClaim.get(edge.claim_id) ?? [];
            return {
              edge,
              claim: claimById.get(edge.claim_id) ?? null,
              latest_confidence: claimSnapshots[claimSnapshots.length - 1] ?? null,
            };
          }),
      })),
    };
  }

  async getConfidenceDrift(
    opportunityId: string,
    organizationId: string,
    claimId?: string,
  ): Promise<ConfidenceDriftView> {
    const claims = await this.getClaims(opportunityId, organizationId, claimId);
    const claimIds = claims.map((claim) => claim.id);
    const snapshots = await this.getSnapshots(opportunityId, organizationId, claimIds);
    const snapshotsByClaim = this.groupByClaim(snapshots);

    return {
      opportunity_id: opportunityId,
      organization_id: organizationId,
      generated_at: new Date().toISOString(),
      claims: claims.flatMap((claim) => {
        const timeline = snapshotsByClaim.get(claim.id) ?? [];
        if (timeline.length === 0) {
          return [];
        }

        const first = timeline[0];
        const latest = timeline[timeline.length - 1];

        return [{
          claim_id: claim.id,
          claim_text: claim.claim_text,
          first_score: first.confidence_score,
          latest_score: latest.confidence_score,
          delta: latest.confidence_score - first.confidence_score,
          first_recorded_at: first.recorded_at,
          latest_recorded_at: latest.recorded_at,
          timeline,
        }];
      }),
    };
  }

  private groupByClaim(
    snapshots: ClaimConfidenceSnapshotRecord[],
  ): Map<string, ClaimConfidenceSnapshotRecord[]> {
    const grouped = new Map<string, ClaimConfidenceSnapshotRecord[]>();

    for (const snapshot of snapshots.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))) {
      const list = grouped.get(snapshot.claim_id) ?? [];
      list.push(snapshot);
      grouped.set(snapshot.claim_id, list);
    }

    return grouped;
  }

  private async getClaims(
    opportunityId: string,
    organizationId: string,
    claimId?: string,
    claimIds?: string[],
  ): Promise<ClaimNodeRecord[]> {
    let query = this.supabase
      .from("claim_nodes")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (claimId) {
      query = query.eq("id", claimId);
    }

    if (claimIds && claimIds.length > 0) {
      query = query.in("id", claimIds);
    }

    const result = await query;
    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []) as ClaimNodeRecord[];
  }

  private async getArtifacts(
    opportunityId: string,
    organizationId: string,
    artifactId?: string,
  ): Promise<EvidenceArtifactRecord[]> {
    let query = this.supabase
      .from("evidence_artifacts")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .order("captured_at", { ascending: true });

    if (artifactId) {
      query = query.eq("id", artifactId);
    }

    const result = await query;
    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []) as EvidenceArtifactRecord[];
  }

  private async getEdges(
    opportunityId: string,
    organizationId: string,
    claimIds: string[],
  ): Promise<ClaimEvidenceEdgeRecord[]> {
    if (claimIds.length === 0) {
      return [];
    }

    const result = await this.supabase
      .from("claim_evidence_edges")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .in("claim_id", claimIds)
      .order("created_at", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []) as ClaimEvidenceEdgeRecord[];
  }

  private async getEdgesByArtifacts(
    opportunityId: string,
    organizationId: string,
    artifactIds: string[],
  ): Promise<ClaimEvidenceEdgeRecord[]> {
    if (artifactIds.length === 0) {
      return [];
    }

    const result = await this.supabase
      .from("claim_evidence_edges")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .in("evidence_artifact_id", artifactIds)
      .order("created_at", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []) as ClaimEvidenceEdgeRecord[];
  }

  private async getSnapshots(
    opportunityId: string,
    organizationId: string,
    claimIds: string[],
  ): Promise<ClaimConfidenceSnapshotRecord[]> {
    if (claimIds.length === 0) {
      return [];
    }

    const result = await this.supabase
      .from("claim_confidence_snapshots")
      .select("*")
      .eq("opportunity_id", opportunityId)
      .eq("organization_id", organizationId)
      .in("claim_id", claimIds)
      .order("recorded_at", { ascending: true });

    if (result.error) {
      throw result.error;
    }

    return (result.data ?? []) as ClaimConfidenceSnapshotRecord[];
  }
}

export const claimEvidenceGraphService = new ClaimEvidenceGraphService();
