/**
 * ArtifactEditService
 *
 * Persists user edits to artifacts with full audit trail.
 * Tracks original value, new value, editor, and optional reason.
 *
 * Reference: openspec/changes/executive-output-generation/tasks.md §6
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ArtifactEditSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  artifact_id: z.string().uuid(),
  field_path: z.string(),
  old_value: z.unknown().nullable(),
  new_value: z.unknown(),
  edited_by_user_id: z.string().uuid(),
  reason: z.string().max(1000).optional(),
  created_at: z.string().datetime(),
});

export type ArtifactEdit = z.infer<typeof ArtifactEditSchema>;

export interface EditArtifactInput {
  tenantId: string;
  artifactId: string;
  fieldPath: string;
  newValue: unknown;
  editedByUserId: string;
  reason?: string;
}

export interface ApplyEditResult {
  editId: string;
  artifactId: string;
  applied: boolean;
  previousValue: unknown;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ArtifactEditService {
  /**
   * Apply an edit to an artifact and record the change.
   */
  async applyEdit(input: EditArtifactInput): Promise<ApplyEditResult> {
    logger.info(`Applying edit to artifact ${input.artifactId}, field ${input.fieldPath}`);

    // Verify artifact exists and get current value
    const { data: artifact, error: fetchError } = await supabase
      .from("case_artifacts")
      .select("id, content_json, tenant_id")
      .eq("id", input.artifactId)
      .eq("tenant_id", input.tenantId)
      .single();

    if (fetchError || !artifact) {
      throw new Error(`Artifact not found: ${input.artifactId}`);
    }

    // Extract current value from field path
    const oldValue = this.getValueAtPath(artifact.content_json, input.fieldPath);

    // Apply the edit
    const newContent = this.setValueAtPath(
      artifact.content_json,
      input.fieldPath,
      input.newValue,
    );

    // Update artifact
    const { error: updateError } = await supabase
      .from("case_artifacts")
      .update({
        content_json: newContent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.artifactId)
      .eq("tenant_id", input.tenantId);

    if (updateError) {
      throw new Error(`Failed to update artifact: ${updateError.message}`);
    }

    // Record the edit
    const editId = crypto.randomUUID();
    const { error: editError } = await supabase.from("artifact_edits").insert({
      id: editId,
      tenant_id: input.tenantId,
      artifact_id: input.artifactId,
      field_path: input.fieldPath,
      old_value: oldValue,
      new_value: input.newValue,
      edited_by_user_id: input.editedByUserId,
      reason: input.reason || null,
      created_at: new Date().toISOString(),
    });

    if (editError) {
      logger.error(`Failed to record edit: ${editError.message}`);
      // Don't throw - the edit was applied, just not recorded
    }

    logger.info(`Edit applied to artifact ${input.artifactId}, edit ${editId}`);

    return {
      editId,
      artifactId: input.artifactId,
      applied: true,
      previousValue: oldValue,
    };
  }

  /**
   * Get edit history for an artifact.
   */
  async getEditHistory(tenantId: string, artifactId: string): Promise<ArtifactEdit[]> {
    const { data, error } = await supabase
      .from("artifact_edits")
      .select("*")
      .eq("artifact_id", artifactId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch edit history: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      artifact_id: row.artifact_id,
      field_path: row.field_path,
      old_value: row.old_value,
      new_value: row.new_value,
      edited_by_user_id: row.edited_by_user_id,
      reason: row.reason,
      created_at: row.created_at,
    }));
  }

  /**
   * Get value at a dot-notation path in an object.
   */
  private getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current !== "object") {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Set value at a dot-notation path in an object.
   */
  private setValueAtPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Record<string, unknown> {
    const parts = path.split(".");
    const result = { ...obj };
    let current: Record<string, unknown> = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== "object") {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return result;
  }
}
