/**
 * ExportJobRepository
 *
 * Data access layer for the export_jobs table.
 * Tracks the lifecycle of asynchronous export requests (PDF, PPTX).
 * Supports real-time progress tracking and event streaming.
 *
 * All reads and writes enforce tenant isolation via tenant_id equality checks.
 *
 * @task P0 - Async Export Queue
 */

import { randomUUID } from "node:crypto";
import { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";
// service-role:justified background-worker requires elevated DB access for export job state management
import { createWorkerServiceSupabaseClient } from "../../lib/supabase/privileged/createWorkerServiceSupabaseClient.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type ExportFormat = "pdf" | "pptx";
export type ExportType = "full" | "executive_summary" | "financials_only" | "hypotheses_only";

export interface ExportJob {
  id: string;
  tenant_id: string;
  organization_id: string;
  case_id: string;
  user_id: string;
  format: ExportFormat;
  export_type: ExportType;
  title: string | null;
  owner_name: string | null;
  render_url: string | null;
  status: ExportJobStatus;
  progress_percent: number;
  current_step: string | null;
  progress_steps: ProgressStep[];
  storage_path: string | null;
  signed_url: string | null;
  signed_url_expires_at: string | null;
  file_size_bytes: number | null;
  integrity_score_at_export: number | null;
  readiness_score_at_export: number | null;
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
}

export interface ProgressStep {
  name: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  percent: number;
}

export interface CreateExportJobInput {
  tenantId: string;
  organizationId: string;
  caseId: string;
  userId: string;
  format: ExportFormat;
  exportType?: ExportType;
  title?: string;
  ownerName?: string;
  renderUrl?: string;
  integrityScoreAtExport?: number;
  readinessScoreAtExport?: number;
}

export interface ExportJobEvent {
  id: string;
  export_job_id: string;
  tenant_id: string;
  event_type: "progress" | "step_start" | "step_complete" | "error" | "complete" | "cancelled";
  event_data: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ExportJobRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabase =
      supabase ??
      createWorkerServiceSupabaseClient({
        justification:
          "service-role:justified background-worker requires elevated DB access for export job state management",
      });
  }

  /**
   * Create a new export job with status 'queued'.
   */
  async create(input: CreateExportJobInput): Promise<ExportJob> {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Initialize progress steps based on format
    const progressSteps: ProgressStep[] = this.initializeProgressSteps(input.format);

    const row = {
      id,
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      case_id: input.caseId,
      user_id: input.userId,
      format: input.format,
      export_type: input.exportType ?? "full",
      title: input.title ?? null,
      owner_name: input.ownerName ?? null,
      render_url: input.renderUrl ?? null,
      status: "queued" as ExportJobStatus,
      progress_percent: 0,
      current_step: null,
      progress_steps: progressSteps,
      storage_path: null,
      signed_url: null,
      signed_url_expires_at: null,
      file_size_bytes: null,
      integrity_score_at_export: input.integrityScoreAtExport ?? null,
      readiness_score_at_export: input.readinessScoreAtExport ?? null,
      error_message: null,
      error_code: null,
      retry_count: 0,
      created_at: now,
      started_at: null,
      completed_at: null,
      failed_at: null,
      cancelled_at: null,
      updated_at: now,
    };

    const { data, error } = await this.supabase
      .from("export_jobs")
      .insert(row)
      .select()
      .single();

    if (error) {
      logger.error("ExportJobRepository.create: insert failed", {
        caseId: input.caseId,
        tenantId: input.tenantId,
        error: error.message,
      });
      throw new Error(`Failed to create export job: ${error.message}`);
    }

    return data as ExportJob;
  }

  /**
   * Find an existing active (queued or running) job for the same case/format.
   * Used for idempotency - prevents duplicate exports.
   */
  async findActiveJob(
    caseId: string,
    format: ExportFormat,
    tenantId: string
  ): Promise<ExportJob | null> {
    const { data, error } = await this.supabase
      .from("export_jobs")
      .select("*")
      .eq("case_id", caseId)
      .eq("format", format)
      .eq("tenant_id", tenantId)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error("ExportJobRepository.findActiveJob: query failed", {
        caseId,
        format,
        tenantId,
        error: error.message,
      });
      return null;
    }

    return data as ExportJob | null;
  }

  /**
   * Fetch a job by id, enforcing tenant isolation.
   */
  async findById(jobId: string, tenantId: string): Promise<ExportJob | null> {
    const { data, error } = await this.supabase
      .from("export_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error) {
      logger.error("ExportJobRepository.findById: query failed", {
        jobId,
        tenantId,
        error: error.message,
      });
      throw new Error(`Failed to fetch export job: ${error.message}`);
    }

    return data as ExportJob | null;
  }

  /**
   * List export history for a case (completed exports only).
   */
  async findCompletedByCase(
    caseId: string,
    tenantId: string,
    limit: number = 10
  ): Promise<ExportJob[]> {
    const { data, error } = await this.supabase
      .from("export_jobs")
      .select("*")
      .eq("case_id", caseId)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("ExportJobRepository.findCompletedByCase: query failed", {
        caseId,
        tenantId,
        error: error.message,
      });
      throw new Error(`Failed to fetch export history: ${error.message}`);
    }

    return (data as ExportJob[]) ?? [];
  }

  /**
   * Transition a job to 'running'.
   */
  async markRunning(jobId: string, tenantId: string): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "running",
      started_at: new Date().toISOString(),
      current_step: "initializing",
    });

    // Emit event
    await this.createEvent(jobId, tenantId, "step_start", {
      step: "initializing",
      message: "Starting export...",
    });
  }

  /**
   * Update progress for a specific step.
   */
  async updateProgress(
    jobId: string,
    tenantId: string,
    stepName: string,
    stepStatus: ProgressStep["status"],
    stepPercent: number,
    overallPercent: number,
    message?: string
  ): Promise<void> {
    // Fetch current job to update progress_steps array
    const { data: job, error: fetchError } = await this.supabase
      .from("export_jobs")
      .select("progress_steps")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError) {
      logger.error("ExportJobRepository.updateProgress: fetch failed", {
        jobId,
        error: fetchError.message,
      });
      return;
    }

    // Update the specific step in the array
    const progressSteps = (job?.progress_steps as ProgressStep[]) ?? [];
    const updatedSteps = progressSteps.map((step) =>
      step.name === stepName
        ? { ...step, status: stepStatus, percent: stepPercent }
        : step
    );

    await this.update(jobId, tenantId, {
      progress_steps: updatedSteps,
      progress_percent: overallPercent,
      current_step: message ?? stepName,
    });

    // Emit progress event
    await this.createEvent(jobId, tenantId, "progress", {
      step: stepName,
      step_status: stepStatus,
      step_percent: stepPercent,
      overall_percent: overallPercent,
      message,
    });
  }

  /**
   * Transition a job to 'completed' and store result.
   */
  async markCompleted(
    jobId: string,
    tenantId: string,
    result: {
      storagePath: string;
      signedUrl: string;
      signedUrlExpiresAt: Date;
      fileSizeBytes: number;
    }
  ): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      current_step: "complete",
      storage_path: result.storagePath,
      signed_url: result.signedUrl,
      signed_url_expires_at: result.signedUrlExpiresAt.toISOString(),
      file_size_bytes: result.fileSizeBytes,
    });

    await this.createEvent(jobId, tenantId, "complete", {
      storage_path: result.storagePath,
      file_size_bytes: result.fileSizeBytes,
    });
  }

  /**
   * Transition a job to 'failed'.
   */
  async markFailed(
    jobId: string,
    tenantId: string,
    errorMessage: string,
    errorCode?: string
  ): Promise<void> {
    await this.update(jobId, tenantId, {
      status: "failed",
      failed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 2000),
      error_code: errorCode ?? null,
    });

    await this.createEvent(jobId, tenantId, "error", {
      error_message: errorMessage,
      error_code: errorCode,
    });
  }

  /**
   * Cancel a queued or running job.
   */
  async cancel(jobId: string, tenantId: string): Promise<void> {
    const { data: job, error: fetchError } = await this.supabase
      .from("export_jobs")
      .select("status")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch job for cancellation: ${fetchError.message}`);
    }

    if (!job || (job.status !== "queued" && job.status !== "running")) {
      throw new Error(`Cannot cancel job with status: ${job?.status}`);
    }

    await this.update(jobId, tenantId, {
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    });

    await this.createEvent(jobId, tenantId, "cancelled", {});
  }

  /**
   * Create a progress event for SSE streaming.
   */
  async createEvent(
    jobId: string,
    tenantId: string,
    eventType: ExportJobEvent["event_type"],
    eventData: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase.from("export_job_events").insert({
      export_job_id: jobId,
      tenant_id: tenantId,
      event_type: eventType,
      event_data: eventData,
    });

    if (error) {
      logger.error("ExportJobRepository.createEvent: insert failed", {
        jobId,
        eventType,
        error: error.message,
      });
    }
  }

  /**
   * Fetch events for a job (for SSE/polling).
   * Validates that the job belongs to the specified case for security.
   */
  async getEvents(
    jobId: string,
    tenantId: string,
    caseId: string,
    since?: string
  ): Promise<ExportJobEvent[]> {
    // First verify the job belongs to this case (prevents job ID enumeration)
    const { data: jobCheck, error: jobError } = await this.supabase
      .from("export_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .eq("case_id", caseId)
      .maybeSingle();

    if (jobError || !jobCheck) {
      throw new Error("Export job not found or access denied");
    }

    let query = this.supabase
      .from("export_job_events")
      .select("*")
      .eq("export_job_id", jobId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      logger.error("ExportJobRepository.getEvents: query failed", {
        jobId,
        error: error.message,
      });
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return (data as ExportJobEvent[]) ?? [];
  }

  /**
   * Refresh an expired signed URL (if within 24h of expiry).
   */
  async refreshSignedUrl(
    jobId: string,
    tenantId: string,
    newSignedUrl: string,
    newExpiresAt: Date
  ): Promise<void> {
    await this.update(jobId, tenantId, {
      signed_url: newSignedUrl,
      signed_url_expires_at: newExpiresAt.toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async update(
    jobId: string,
    tenantId: string,
    patch: Partial<
      Omit<
        ExportJob,
        "id" | "tenant_id" | "organization_id" | "case_id" | "user_id" | "created_at"
      >
    >
  ): Promise<void> {
    const { error } = await this.supabase
      .from("export_jobs")
      .update(patch)
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    if (error) {
      logger.error("ExportJobRepository.update: failed", {
        jobId,
        tenantId,
        patch,
        error: error.message,
      });
      throw new Error(`Failed to update export job: ${error.message}`);
    }
  }

  private initializeProgressSteps(format: ExportFormat): ProgressStep[] {
    if (format === "pptx") {
      return [
        { name: "fetch_data", label: "Fetching case data", status: "pending", percent: 0 },
        { name: "build_deck", label: "Building presentation", status: "pending", percent: 0 },
        { name: "add_slides", label: "Generating slides", status: "pending", percent: 0 },
        { name: "upload", label: "Uploading to storage", status: "pending", percent: 0 },
        { name: "finalize", label: "Finalizing", status: "pending", percent: 0 },
      ];
    }

    // PDF steps
    return [
      { name: "validate_integrity", label: "Validating integrity", status: "pending", percent: 0 },
      { name: "launch_browser", label: "Launching browser", status: "pending", percent: 0 },
      { name: "render_page", label: "Rendering page", status: "pending", percent: 0 },
      { name: "generate_pdf", label: "Generating PDF", status: "pending", percent: 0 },
      { name: "upload", label: "Uploading to storage", status: "pending", percent: 0 },
      { name: "finalize", label: "Finalizing", status: "pending", percent: 0 },
    ];
  }
}
