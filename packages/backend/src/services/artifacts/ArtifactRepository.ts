/**
 * ArtifactRepository
 *
 * Data access layer for case_artifacts table.
 * Handles CRUD operations with tenant isolation.
 */

import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";

export interface ArtifactRecord {
  id: string;
  tenant_id: string;
  organization_id: string;
  case_id: string;
  artifact_type: "executive_memo" | "cfo_recommendation" | "customer_narrative" | "internal_case";
  content_json: Record<string, unknown>;
  status: "draft" | "final";
  readiness_score_at_generation: number;
  generated_by_agent: string;
  provenance_refs: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateArtifactInput {
  tenantId: string;
  organizationId: string;
  caseId: string;
  artifactType: ArtifactRecord["artifact_type"];
  contentJson: Record<string, unknown>;
  status: ArtifactRecord["status"];
  readinessScoreAtGeneration: number;
  generatedByAgent: string;
  provenanceRefs: string[];
}

export class ArtifactRepository {
  /**
   * Create a new artifact record.
   */
  async create(input: CreateArtifactInput): Promise<ArtifactRecord> {
    const { data, error } = await supabase
      .from("case_artifacts")
      .insert({
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
        case_id: input.caseId,
        artifact_type: input.artifactType,
        content_json: input.contentJson,
        status: input.status,
        readiness_score_at_generation: input.readinessScoreAtGeneration,
        generated_by_agent: input.generatedByAgent,
        provenance_refs: input.provenanceRefs,
      })
      .select()
      .single();

    if (error || !data) {
      logger.error("ArtifactRepository: Failed to create artifact", { error: error?.message });
      throw new Error(`Failed to create artifact: ${error?.message}`);
    }

    return data as ArtifactRecord;
  }

  /**
   * Get a single artifact by ID with tenant validation.
   */
  async getById(
    artifactId: string,
    tenantId: string,
    organizationId: string
  ): Promise<ArtifactRecord | null> {
    const { data, error } = await supabase
      .from("case_artifacts")
      .select()
      .eq("id", artifactId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      logger.error("ArtifactRepository: Failed to fetch artifact", { error: error.message });
      throw new Error(`Failed to fetch artifact: ${error.message}`);
    }

    return data as ArtifactRecord;
  }

  /**
   * Get all artifacts for a case with tenant validation.
   */
  async getByCaseId(
    caseId: string,
    tenantId: string,
    organizationId: string
  ): Promise<ArtifactRecord[]> {
    const { data, error } = await supabase
      .from("case_artifacts")
      .select()
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("ArtifactRepository: Failed to fetch artifacts", { error: error.message });
      throw new Error(`Failed to fetch artifacts: ${error.message}`);
    }

    return (data || []) as ArtifactRecord[];
  }

  /**
   * Update artifact status.
   */
  async updateStatus(
    artifactId: string,
    tenantId: string,
    organizationId: string,
    status: "draft" | "final"
  ): Promise<void> {
    const { error } = await supabase
      .from("case_artifacts")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", artifactId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("ArtifactRepository: Failed to update artifact status", { error: error.message });
      throw new Error(`Failed to update artifact status: ${error.message}`);
    }
  }

  /**
   * Delete an artifact (with tenant validation).
   */
  async delete(
    artifactId: string,
    tenantId: string,
    organizationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("case_artifacts")
      .delete()
      .eq("id", artifactId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId);

    if (error) {
      logger.error("ArtifactRepository: Failed to delete artifact", { error: error.message });
      throw new Error(`Failed to delete artifact: ${error.message}`);
    }
  }
}
