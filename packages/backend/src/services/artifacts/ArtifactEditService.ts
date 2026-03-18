/**
 * ArtifactEditService
 *
 * Handles user edits to generated artifacts with full audit trail.
 * Persists edits to artifact_edits table and applies changes to artifact content.
 *
 * Task: 6.1, 6.2, 6.3, 6.5
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const EditArtifactInputSchema = z.object({
  tenantId: z.string(),
  organizationId: z.string().uuid(),
  artifactId: z.string().uuid(),
  caseId: z.string().uuid(),
  fieldPath: z.string(), // JSON path to the field being edited (e.g., "executive_summary")
  oldValue: z.string().optional(),
  newValue: z.string(),
  editedByUserId: z.string().uuid(),
  reason: z.string().optional(),
});

export type EditArtifactInput = z.infer<typeof EditArtifactInputSchema>;

export interface EditResult {
  editId: string;
  artifactId: string;
  applied: boolean;
  previousContent: Record<string, unknown>;
  updatedContent: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ArtifactEditService {
  /**
   * Persist a user edit to the artifact_edits table and apply to artifact content.
   */
  async editArtifact(input: EditArtifactInput): Promise<EditResult> {
    const startTime = Date.now();
    logger.info("ArtifactEditService: editing artifact", {
      artifactId: input.artifactId,
      fieldPath: input.fieldPath,
      userId: input.editedByUserId,
    });

    // Validate tenant access before proceeding
    const { data: artifact, error: fetchError } = await supabase
      .from("case_artifacts")
      .select("content_json, tenant_id, organization_id")
      .eq("id", input.artifactId)
      .eq("tenant_id", input.tenantId)
      .eq("organization_id", input.organizationId)
      .single();

    if (fetchError || !artifact) {
      logger.error("ArtifactEditService: Artifact not found or tenant mismatch", {
        artifactId: input.artifactId,
        tenantId: input.tenantId,
        error: fetchError?.message,
      });
      throw new Error("Artifact not found or access denied");
    }

    // Store the edit record in artifact_edits
    const { data: editRecord, error: editError } = await supabase
      .from("artifact_edits")
      .insert({
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
        artifact_id: input.artifactId,
        field_path: input.fieldPath,
        old_value: input.oldValue ?? null,
        new_value: input.newValue,
        edited_by_user_id: input.editedByUserId,
        reason: input.reason ?? null,
      })
      .select("id")
      .single();

    if (editError || !editRecord) {
      logger.error("ArtifactEditService: Failed to create edit record", {
        error: editError?.message,
      });
      throw new Error("Failed to persist edit audit trail");
    }

    // Apply the edit to the artifact content
    const previousContent = artifact.content_json as Record<string, unknown>;
    const updatedContent = this.applyEdit(previousContent, input.fieldPath, input.newValue);

    // Update the artifact with new content
    const { error: updateError } = await supabase
      .from("case_artifacts")
      .update({
        content_json: updatedContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.artifactId)
      .eq("tenant_id", input.tenantId);

    if (updateError) {
      logger.error("ArtifactEditService: Failed to update artifact content", {
        error: updateError.message,
      });
      throw new Error("Failed to apply edit to artifact");
    }

    const duration = Date.now() - startTime;
    logger.info("ArtifactEditService: edit complete", {
      editId: editRecord.id,
      artifactId: input.artifactId,
      durationMs: duration,
    });

    return {
      editId: editRecord.id,
      artifactId: input.artifactId,
      applied: true,
      previousContent,
      updatedContent,
    };
  }

  /**
   * Get edit history for an artifact.
   */
  async getEditHistory(
    tenantId: string,
    organizationId: string,
    artifactId: string
  ): Promise<Array<{
    id: string;
    fieldPath: string;
    oldValue: string | null;
    newValue: string;
    editedByUserId: string;
    reason: string | null;
    createdAt: string;
  }>> {
    const { data, error } = await supabase
      .from("artifact_edits")
      .select("id, field_path, old_value, new_value, edited_by_user_id, reason, created_at")
      .eq("artifact_id", artifactId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("ArtifactEditService: Failed to fetch edit history", {
        artifactId,
        error: error.message,
      });
      throw new Error("Failed to fetch edit history");
    }

    return (data || []).map((edit) => ({
      id: edit.id,
      fieldPath: edit.field_path,
      oldValue: edit.old_value,
      newValue: edit.new_value,
      editedByUserId: edit.edited_by_user_id,
      reason: edit.reason,
      createdAt: edit.created_at,
    }));
  }

  /**
   * Apply an edit to a nested field in the content object using dot notation.
   */
  private applyEdit(
    content: Record<string, unknown>,
    fieldPath: string,
    newValue: string
  ): Record<string, unknown> {
    const result = { ...content };
    const keys = fieldPath.split(".");

    let current: Record<string, unknown> = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1];
    current[finalKey] = newValue;

    return result;
  }

  /**
   * Validate that a user has permission to edit an artifact in this tenant.
   */
  async validateEditPermission(
    tenantId: string,
    organizationId: string,
    artifactId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("case_artifacts")
      .select("id")
      .eq("id", artifactId)
      .eq("tenant_id", tenantId)
      .eq("organization_id", organizationId)
      .single();

    if (error || !data) {
      return false;
    }

    // Additional permission checks could be added here (e.g., role-based)
    return true;
  }
}
