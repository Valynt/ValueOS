/**
 * ArtifactJobRepository
 *
 * Data access layer for the artifact_jobs table.
 * Tracks the lifecycle of asynchronous artifact generation requests.
 *
 * All reads and writes enforce tenant isolation via tenant_id equality checks.
 */

import { randomUUID } from "node:crypto";

import { logger } from "../../lib/logger.js";
// service-role:justified background-worker requires elevated DB access for artifact job state management
import { createWorkerServiceSupabaseClient } from "../../lib/supabase/privileged/createWorkerServiceSupabaseClient.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArtifactJobStatus = "queued" | "running" | "completed" | "failed";

export interface ArtifactJob {
  id: string;
  tenant_id: string;
  organization_id: string;
  case_id: string;
  artifact_type: string;
  format: string;
  requested_by: string;
  status: ArtifactJobStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  artifact_id: string | null;
}

export interface CreateArtifactJobInput {
  tenantId: string;
  organizationId: string;
  caseId: string;
  artifactType: string;
  format: string;
  requestedBy: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ArtifactJobRepository {
  private readonly supabase = createWorkerServiceSupabaseClient({
    justification:
      "service-role:justified background-worker requires elevated DB access for artifact job state management",
  });

  /**
   * Create a new artifact job row with status 'queued'.
   * Returns the persisted job.
   */
  async create(input: CreateArtifactJobInput): Promise<ArtifactJob> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      case_id: input.caseId,
      artifact_type: input.artifactType,
      format: input.format,
      requested_by: input.requestedBy,
      status: "queued" as ArtifactJobStatus,
      created_at: now,
      started_at: null,
      completed_at: null,
      failed_at: null,
      error_message: null,
      artifact_id: null,
    };

    const { data, error } = await this.supabase
      .from("artifact_jobs")
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error("ArtifactJobRepository.create: insert failed", {
        caseId: input.caseId,
        tenantId: input.tenantId,
        error: error.message,
      });
      throw new Error(`Failed to create artifact job: ${error.message}`);
    }

    return data as ArtifactJob;
  }

  /**
   * Return an existing active (queued or running) job for the given
   * (caseId, artifactType, tenantId) tuple, or null if none exists.
   *
   * Used by the generate endpoint to enforce idempotency: a second request
   * for the same artifact while one is already in flight returns the existing
   * job rather than creating a duplicate.
   */
  async findActiveJob(
    caseId: string,
    artifactType: string,
    tenantId: string
  ): Promise<ArtifactJob | null> {
    const { data, error } = await this.supabase
      .from("artifact_jobs")
      .select("*")
      .eq("case_id", caseId)
      .eq("artifact_type", artifactType)
      .eq("tenant_id", tenantId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("ArtifactJobRepository.findActiveJob: query failed", {
        caseId,
        artifactType,
        tenantId,
        error: error.message,
      });
      // Non-fatal: let the caller proceed to create a new job.
      return null;
    }

    return data as ArtifactJob | null;
  }

  /**
   * Fetch a job by id, enforcing tenant isolation.
   * Returns null if not found or tenant mismatch.
   */
  async findById(jobId: string, tenantId: string): Promise<ArtifactJob | null> {
    const { data, error } = await this.supabase
      .from("artifact_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      logger.error("ArtifactJobRepository.findById: query failed", {
        jobId,
        tenantId,
        error: error.message,
      });
      throw new Error(`Failed to fetch artifact job: ${error.message}`);
    }

    return data as ArtifactJob | null;
  }

  /**
   * Transition a job to 'running'.
   */
  async markRunning(jobId: string, tenantId: string): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "running",
      started_at: new Date().toISOString(),
    });
  }

  /**
   * Transition a job to 'completed' and record the generated artifact id.
   */
  async markCompleted(
    jobId: string,
    tenantId: string,
    artifactId: string
  ): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      artifact_id: artifactId,
    });
  }

  /**
   * Transition a job to 'failed' and record the error message.
   */
  async markFailed(
    jobId: string,
    tenantId: string,
    errorMessage: string
  ): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 2000), // guard against oversized messages
    });
  }

  private async update(
    jobId: string,
    tenantId: string,
    patch: Partial<
      Omit<
        ArtifactJob,
        "id" | "tenant_id" | "organization_id" | "case_id" | "created_at"
      >
    >
  ): Promise<void> {
    const { error } = await this.supabase
      .from("artifact_jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    if (error) {
      logger.error("ArtifactJobRepository.update: failed", {
        jobId,
        tenantId,
        patch,
        error: error.message,
      });
      throw new Error(`Failed to update artifact job: ${error.message}`);
    }
  }
}
